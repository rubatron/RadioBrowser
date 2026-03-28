/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Search Module - Station search and rendering
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.4.0
 */

(function() {
    'use strict';

    var RB = window.RadioBrowser;
    var state = RB.state;
    var utils = RB.utils;

    // ========================================================================
    // COUNTRY AUTOCOMPLETE
    // ========================================================================

    function initCountryAutocomplete() {
        var input = $('#rb-country');
        var list = $('#rb-country-list');

        input.on('focus', function() {
            showCountryList('');
        });

        input.on('input', function() {
            var val = $(this).val().toLowerCase();
            showCountryList(val);
        });

        input.on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                list.addClass('hide');
                state.offset = 0;
                searchStations();
            }
            if (e.keyCode === 27) {
                list.addClass('hide');
            }
        });

        list.on('click', '.rb-country-item', function() {
            var code = $(this).data('code');
            var name = $(this).text();
            input.val(name);
            input.data('selected-code', code);
            list.addClass('hide');
            state.offset = 0;
            searchStations();
        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('#rb-country, #rb-country-list').length) {
                list.addClass('hide');
            }
        });

        function showCountryList(filter) {
            var html = '';
            RB.COUNTRIES.forEach(function(c) {
                if (!filter || c.name.toLowerCase().indexOf(filter) !== -1 || c.code.toLowerCase().indexOf(filter) !== -1) {
                    html += '<div class="rb-country-item" data-code="' + c.code + '">' + utils.escapeHtml(c.name) + '</div>';
                }
            });
            list.html(html).removeClass('hide');
        }
    }

    // ========================================================================
    // SEARCH FUNCTIONS
    // ========================================================================

    function searchStations() {
        if (state.loading) return;
        state.loading = true;
        state.hasSearched = true;

        console.log('Radio Browser: searchStations - hasSearched set to true');

        var countryInput = $('#rb-country');
        var countryCode = countryInput.data('selected-code') || '';

        if (!countryCode && countryInput.val()) {
            var typed = countryInput.val().toLowerCase();
            RB.COUNTRIES.forEach(function(c) {
                if (c.name.toLowerCase() === typed) {
                    countryCode = c.code;
                }
            });
        }

        var params = {
            name: $('#rb-name').val().trim(),
            countrycode: countryCode,
            tag: $('#rb-genre').val(),
            offset: state.offset,
            limit: state.limit,
            order: 'clickcount',
            reverse: 'true'
        };

        showLoading(true);

        console.log('Radio Browser: searchStations called with params:', params);

        $.ajax({
            url: RB.API_URL + '?cmd=search',
            type: 'GET',
            data: params,
            dataType: 'json',
            timeout: 15000,
            success: function(data) {
                console.log('Radio Browser: search response:', data);
                state.loading = false;
                showLoading(false);
                if (data.success && data.stations && data.stations.length > 0) {
                    console.log('Radio Browser: rendering ' + data.stations.length + ' stations');
                    renderStations(data.stations);
                    updatePagination(data.stations.length);
                } else {
                    console.log('Radio Browser: no stations found');
                    showNoResults(data.message || 'No stations found.');
                }
            },
            error: function(xhr, status) {
                console.log('Radio Browser: search error:', status, xhr.responseText);
                state.loading = false;
                showLoading(false);
                var msg = status === 'timeout' ? 'Request timed out.' : 'Failed to search.';
                showNoResults(msg);
            }
        });
    }

    function loadTopStations(forceLoad) {
        console.log('Radio Browser: loadTopStations called, hasSearched:', state.hasSearched, 'forceLoad:', forceLoad);

        if (state.hasSearched && !forceLoad) {
            console.log('Radio Browser: loadTopStations skipped - user has searched');
            return;
        }

        if (state.loading) return;
        state.loading = true;

        showLoading(true);

        $.ajax({
            url: RB.API_URL + '?cmd=top_click',
            type: 'POST',
            data: { limit: state.limit },
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                state.loading = false;
                showLoading(false);

                if (state.hasSearched && !forceLoad) {
                    console.log('Radio Browser: loadTopStations response ignored - user searched during request');
                    return;
                }

                if (data.success && data.stations && data.stations.length > 0) {
                    renderStations(data.stations);
                    $('#rb-result-count').text('(' + data.stations.length + ' stations)');
                    $('#rb-pagination').addClass('hide');
                } else {
                    showNoResults(data.message || 'No stations found.');
                }
            },
            error: function(xhr, status) {
                state.loading = false;
                showLoading(false);
                var msg = status === 'timeout' ? 'Request timed out.' : 'Failed to load top stations.';
                showNoResults(msg);
            }
        });
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    function renderStations(stations) {
        console.log('Radio Browser: renderStations called with ' + stations.length + ' stations');
        var container = $('#rb-results');
        var html = [];

        $('#rb-results-section').removeClass('hide');
        $('#rb-loading').addClass('hide');
        $('#rb-no-results').addClass('hide');
        container.removeClass('hide');
        $('#rb-result-count').text('(' + stations.length + ' stations)');

        state.stationData = [];
        var startIndex = 0;

        stations.forEach(function(s, index) {
            var logoHtml = s.favicon ?
                '<img class="rb-logo" src="' + utils.escapeHtml(s.favicon) + '" alt="" onerror="this.src=\'/images/radio-logo.png\'">' :
                '<div class="rb-logo rb-logo-placeholder"><i class="fa-solid fa-sharp fa-radio"></i></div>';

            var metaParts = [];
            if (s.country) metaParts.push(utils.escapeHtml(s.country));
            if (s.tags) metaParts.push(utils.escapeHtml(s.tags.split(',')[0]));
            if (s.bitrate > 0) metaParts.push(s.bitrate + 'k');

            var stationData = {
                url: (s.url_resolved || s.url).trim(),
                url_fallback: s.url.trim(),
                name: s.name,
                favicon: s.favicon || '',
                country: s.country || '',
                tags: s.tags || '',
                bitrate: s.bitrate || 0,
                codec: s.codec || ''
            };

            state.stationData.push(stationData);
            var storeIndex = startIndex + index;

            var isFavorite = RB.favorites.isInFavorites(stationData.url, stationData.name);
            var addBtnClass = isFavorite ? 'btn rb-add-btn added' : 'btn rb-add-btn';
            var addBtnIcon = isFavorite ? '<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>' : '<i class="fa-solid fa-sharp fa-heart"></i>';
            var addBtnTitle = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

            html.push(
                '<div class="rb-station-card" data-station-index="' + storeIndex + '" data-url="' + utils.escapeHtml(stationData.url) + '" data-name="' + utils.escapeHtml(s.name) + '">' +
                    logoHtml +
                    '<div class="rb-info">' +
                        '<div class="rb-name">' + utils.escapeHtml(s.name) + '</div>' +
                        '<div class="rb-meta">' + metaParts.join(' • ') + '</div>' +
                    '</div>' +
                    '<div class="rb-actions">' +
                        '<button class="btn rb-play-btn" title="Play"><i class="fa-solid fa-sharp fa-play"></i></button>' +
                        '<button class="' + addBtnClass + '" title="' + addBtnTitle + '">' + addBtnIcon + '</button>' +
                        '<button class="btn rb-download-btn" title="Download .m3u"><i class="fa-solid fa-sharp fa-download"></i></button>' +
                    '</div>' +
                '</div>'
            );
        });

        container.html(html.join(''));

        // Check current playback status after rendering
        RB.player.checkCurrentlyPlaying();
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    function showLoading(show) {
        if (show) {
            $('#rb-results-section').removeClass('hide');
            $('#rb-loading').removeClass('hide');
            $('#rb-results').addClass('hide');
            $('#rb-no-results').addClass('hide');
        } else {
            $('#rb-loading').addClass('hide');
            $('#rb-results').removeClass('hide');
        }
    }

    function showNoResults(msg) {
        $('#rb-results-section').removeClass('hide');
        $('#rb-results').empty().addClass('hide');
        $('#rb-no-results').removeClass('hide').find('p').text(msg || 'No stations found.');
        $('#rb-pagination').addClass('hide');
        $('#rb-result-count').text('');
    }

    function updatePagination(count) {
        var pag = $('#rb-pagination');
        if (count < state.limit && state.offset === 0) {
            pag.addClass('hide');
            return;
        }

        pag.removeClass('hide');
        $('#rb-prev').prop('disabled', state.offset === 0);
        $('#rb-next').prop('disabled', count < state.limit);

        var start = state.offset + 1;
        var end = state.offset + count;
        $('#rb-page-info').text('Showing ' + start + ' - ' + end);
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.search = {
        initCountryAutocomplete: initCountryAutocomplete,
        searchStations: searchStations,
        loadTopStations: loadTopStations,
        renderStations: renderStations,
        showLoading: showLoading,
        showNoResults: showNoResults,
        updatePagination: updatePagination
    };

    console.log('Radio Browser: Search module loaded');
})();
