// No-op error logger to prevent ReferenceError
function logFrontendError() {}
/*!
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright 2014 The moOde audio player project / Tim Curtis
 * moOde Extensions Framework - Radio Browser
 */

(function waitForJQuery() {
    if (typeof jQuery !== 'undefined' || typeof $ !== 'undefined') {
        initRadioBrowser(jQuery || $);
    } else {
        setTimeout(waitForJQuery, 50);
    }
})();

function initRadioBrowser($) {
    'use strict';
    
    var API_URL = '/extensions/installed/radio-browser/backend/api.php';
    var state = {
        offset: 0,
        limit: 30,
        loading: false,
        currentPlaying: null,
        stationData: [] // Store station data here instead of HTML attributes
    };

    $(document).ready(function() {
        bindEvents();
        bindTabEvents();
        checkCurrentlyPlaying();
        loadTopStations(); // Auto-load top stations on page load
    });

    function bindTabEvents() {
        // Tab switching
        $('.rb-tab').on('click', function() {
            var tab = $(this).data('tab');
            
            // Update active tab
            $('.rb-tab').removeClass('active');
            $(this).addClass('active');
            
            // Show corresponding panel
            $('.rb-panel').addClass('hide');
            $('#rb-' + tab + '-panel').removeClass('hide');
            
            // Check API status when Settings tab is opened
            if (tab === 'settings') {
                checkApiStatus();
            }
        });
        
        // Refresh API status button
        $('#rb-refresh-status').on('click', function() {
            checkApiStatus();
        });
    }
    
    function checkApiStatus() {
        var statusContainer = $('#rb-api-status');
        var refreshBtn = $('#rb-refresh-status');
        
        refreshBtn.find('i').addClass('fa-spin');
        statusContainer.html('<div class="rb-status-loading"><i class="fa-solid fa-sharp fa-spinner fa-spin"></i> Checking API status...</div>');
        
        $.ajax({
            url: API_URL + '?cmd=status',
            type: 'POST',
            dataType: 'json',
            timeout: 15000,
            success: function(data) {
                refreshBtn.find('i').removeClass('fa-spin');
                if (data.success && data.servers) {
                    var html = '';
                    data.servers.forEach(function(server) {
                        var statusClass = server.online ? 'online' : 'offline';
                        var latencyClass = server.latency < 500 ? 'fast' : 'slow';
                        var latencyText = server.online ? server.latency + 'ms' : 'offline';
                        
                        html += '<div class="rb-status-item">' +
                            '<div class="rb-status-indicator ' + statusClass + '"></div>' +
                            '<span class="rb-status-name">' + escapeHtml(server.name) + '</span>' +
                            '<span class="rb-status-latency ' + latencyClass + '">' + latencyText + '</span>' +
                        '</div>';
                    });
                    statusContainer.html(html);
                } else {
                    statusContainer.html('<div class="rb-status-item"><span class="rb-status-name">Could not check API status</span></div>');
                }
            },
            error: function(xhr, status, error) {
                refreshBtn.find('i').removeClass('fa-spin');
                statusContainer.html('<div class="rb-status-item"><span class="rb-status-name">Failed to check API status. Click refresh to retry.</span></div>');
            }
        });
    }
    
    function checkCurrentlyPlaying() {
        // Check current playback status via API
        $.ajax({
            url: API_URL + '?cmd=current_status',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success) {
                    // Update UI based on current playback status
                    if (data.is_playing && data.current_url) {
                        // Find the station card that matches the current URL
                        $('.rb-station-card').each(function() {
                            var card = $(this);
                            var stationIndex = parseInt(card.data('station-index'));
                            var stationData = state.stationData[stationIndex];
                            
                            if (stationData && (stationData.url === data.current_url || stationData.url_fallback === data.current_url)) {
                                // This station is currently playing
                                $('.rb-station-card').removeClass('playing');
                                $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
                                
                                card.addClass('playing');
                                card.find('.rb-play-btn').addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                                
                                state.currentPlaying = data.current_url;
                                return false; // Break out of each loop
                            }
                        });
                    } else {
                        // Nothing is playing, reset UI
                        $('.rb-station-card').removeClass('playing');
                        $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
                        state.currentPlaying = null;
                    }
                }
            },
            error: function(xhr, status, error) {
                // Silently fail - don't show errors for status checks
                console.log('Failed to check current status:', error);
            }
        });
    }

    function bindEvents() {
        // Info toggle
        $(document).on('click', '.info-toggle', function(e) {
            e.preventDefault();
            var targetId = $(this).data('cmd');
            $('#' + targetId).toggleClass('hide');
        });

        // Country select change handler
        $('#rb-country').on('change', function() {
            if ($(this).val() === 'other') {
                $('#rb-country-custom').removeClass('hide');
            } else {
                $('#rb-country-custom').addClass('hide').val('');
            }
        });

        // Search form
        $('#radio-search-form').on('submit', function(e) {
            e.preventDefault();
            if (state.loading) return;
            state.offset = 0;
            searchStations();
        });

        // Top stations button
        $('#rb-top-stations').on('click', function(e) {
            e.preventDefault();
            if (state.loading) return;
            state.offset = 0;
            loadTopStations();
        });

        // Pagination
        $('#rb-prev').on('click', function() {
            if (state.loading || state.offset === 0) return;
            state.offset = Math.max(0, state.offset - state.limit);
            searchStations();
        });

        $('#rb-next').on('click', function() {
            if (state.loading) return;
            state.offset += state.limit;
            searchStations();
        });

        // Play button - toggle play/stop
        $(document).on('click', '.rb-play-btn', function(e) {
            e.preventDefault();
            var card = $(this).closest('.rb-station-card');
            var btn = $(this);
            
            // If this card is currently playing, stop it
            if (card.hasClass('playing')) {
                stopStation(card, btn);
            } else {
                playStation(card);
            }
        });

        // Add to favorites
        $(document).on('click', '.rb-add-btn', function(e) {
            e.preventDefault();
            addToRadio($(this).closest('.rb-station-card'));
        });
    }

    function searchStations() {
        if (state.loading) return;
        state.loading = true;
        
        var countryCode = $('#rb-country').val();
        if (countryCode === 'other') {
            countryCode = $('#rb-country-custom').val().trim().toUpperCase();
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

        $.ajax({
            url: API_URL + '?cmd=search',
            type: 'POST',
            data: params,
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                state.loading = false;
                showLoading(false);
                if (data.success && data.stations && data.stations.length > 0) {
                    renderStations(data.stations);
                    updatePagination(data.stations.length);
                } else {
                    let msg = (data && data.message) ? data.message : 'No results found.';
                    showNoResults(msg);
                    notify('Info', msg, 'notice');
                }
            },
            error: function(xhr, status, error) {
                state.loading = false;
                showLoading(false);
                let msg = 'Failed to contact radio API.';
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
                else if (xhr && xhr.status) msg += ' (HTTP ' + xhr.status + ')';
                else if (status === 'timeout') msg = 'Request timed out.';
                showNoResults(msg);
                notify('Error', msg, 'error');
                logFrontendError('searchStations', status, error, xhr);
            }
        });
    }

    function loadTopStations() {
        if (state.loading) return;
        state.loading = true;
        
        showLoading(true);
        
        $.ajax({
            url: API_URL + '?cmd=top_click',
            type: 'POST',
            data: { limit: state.limit },
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                console.log('loadTopStations: API response', data);
                state.loading = false;
                showLoading(false);
                if (data.success && data.stations && data.stations.length > 0) {
                    console.log('loadTopStations: rendering', data.stations.length, 'stations');
                    renderStations(data.stations);
                    $('#rb-result-count').text('(' + data.stations.length + ' stations)');
                    $('#rb-pagination').addClass('hide');
                } else {
                    let msg = (data && data.message) ? data.message : 'No results found.';
                    console.log('loadTopStations: no results', msg);
                    showNoResults(msg);
                    notify('Info', msg, 'notice');
                }
            },
            error: function(xhr, status, error) {
                state.loading = false;
                showLoading(false);
                let msg = 'Failed to contact radio API.';
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
                else if (xhr && xhr.status) msg += ' (HTTP ' + xhr.status + ')';
                else if (status === 'timeout') msg = 'Request timed out.';
                showNoResults(msg);
                notify('Error', msg, 'error');
                logFrontendError('loadTopStations', status, error, xhr);
            }
        });
    }

    function renderStations(stations) {
        console.log('renderStations: called with', stations.length, 'stations');
        var container = $('#rb-results');
        var html = [];
        
        $('#rb-results-section').removeClass('hide');
        $('#rb-no-results').addClass('hide');
        $('#rb-result-count').text('(' + stations.length + ' stations)');

        // Clear previous station data
        state.stationData = [];
        console.log('renderStations: cleared stationData, container found:', container.length);

        stations.forEach(function(s, index) {
            console.log('renderStations: processing station', index, s.name);
            var logoHtml = s.favicon ? 
                '<img class="rb-logo" style="width:44px;height:44px;max-width:44px;max-height:44px;object-fit:cover;" src="' + escapeHtml(s.favicon) + '" alt="" onerror="this.src=\'/images/radio-logo.png\'">' :
                '<div class="rb-logo rb-logo-placeholder" style="width:44px;height:44px;"><i class="fa-solid fa-sharp fa-radio"></i></div>';

            var metaParts = [];
            if (s.country) metaParts.push(escapeHtml(s.country));
            if (s.tags) metaParts.push(escapeHtml(s.tags.split(',')[0]));
            if (s.bitrate > 0) metaParts.push(s.bitrate + 'k');

            var stationData = {
                url: s.url_resolved || s.url,
                url_fallback: s.url,
                name: s.name,
                favicon: s.favicon || '',
                country: s.country || '',
                tags: s.tags || '',
                bitrate: s.bitrate || 0,
                codec: s.codec || ''
            };

            // Store station data in array
            state.stationData.push(stationData);

            html.push(
                '<div class="rb-station-card" data-station-index="' + index + '">' +
                    logoHtml +
                    '<div class="rb-info">' +
                        '<div class="rb-name">' + escapeHtml(s.name) + '</div>' +
                        '<div class="rb-meta">' + metaParts.join(' • ') + '</div>' +
                    '</div>' +
                    '<div class="rb-actions">' +
                        '<button class="btn rb-play-btn" title="Play"><i class="fa-solid fa-sharp fa-play"></i></button>' +
                        '<button class="btn rb-add-btn" title="Add to Favorites"><i class="fa-solid fa-sharp fa-heart"></i></button>' +
                    '</div>' +
                '</div>'
            );
        });
        
        console.log('renderStations: setting HTML, html.length =', html.length);
        container.html(html.join(''));
        console.log('renderStations: done');
    }

    function playStation(card) {
        var stationIndex = parseInt(card.data('station-index'));
        var stationData = state.stationData[stationIndex];
        
        console.log('playStation: stationIndex =', stationIndex, 'stationData =', stationData);
        
        if (!stationData) {
            console.error('playStation: Station data not found for index', stationIndex);
            notify('Error', 'Station data not found', 'error');
            return;
        }
        
        console.log('playStation: Playing station', stationData.name, 'url:', stationData.url);
        
        var btn = card.find('.rb-play-btn');
        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');
        
        $.ajax({
            url: API_URL + '?cmd=play',
            type: 'POST',
            data: JSON.stringify(stationData),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                console.log('playStation: API success response', data);
                if (data.success) {
                    $('.rb-station-card').removeClass('playing');
                    $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
                    card.addClass('playing');
                    btn.addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                    state.currentPlaying = stationData.url;

                    notify('Playing', stationData.name, 'success');
                } else {
                    btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                    notify('Error', data.message || 'Failed to play', 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('playStation: AJAX error', status, error, xhr);
                btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                let msg = 'Failed to play station.';
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
                else if (xhr && xhr.status) msg += ' (HTTP ' + xhr.status + ')';
                else if (status === 'timeout') msg = 'Request timed out.';
                notify('Error', msg, 'error');
                logFrontendError('playStation', status, error, xhr);
            }
        });
    }
    
    function stopStation(card, btn) {
        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');
        
        // Send stop command to MPD
        $.get('/command/index.php?cmd=stop', function() {
            card.removeClass('playing');
            btn.removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
            state.currentPlaying = null;
            notify('Stopped', 'Playback stopped', 'info');
        }).fail(function() {
            btn.html('<i class="fa-solid fa-sharp fa-stop"></i>');
            notify('Error', 'Failed to stop playback', 'error');
        });
    }

    function addToRadio(card) {
        var stationIndex = parseInt(card.data('station-index'));
        var stationData = state.stationData[stationIndex];
        
        if (!stationData) {
            notify('Error', 'Station data not found', 'error');
            return;
        }
        
        var btn = card.find('.rb-add-btn');
        btn.prop('disabled', true);
        
        $.ajax({
            url: API_URL + '?cmd=import',
            type: 'POST',
            data: JSON.stringify(stationData),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                btn.prop('disabled', false);
                if (data.success) {
                    btn.addClass('added');
                    btn.html('<i class="fa-solid fa-sharp fa-check"></i>');
                    notify('Added', 'Station added to Favorites', 'success');
                } else {
                    notify('Info', data.message || 'Could not add', 'info');
                }
            },
            error: function(xhr, status, error) {
                btn.prop('disabled', false);
                let msg = 'Failed to add to Favorites.';
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
                else if (xhr && xhr.status) msg += ' (HTTP ' + xhr.status + ')';
                else if (status === 'timeout') msg = 'Request timed out.';
                notify('Error', msg, 'error');
                logFrontendError('addToRadio', status, error, xhr);
            }
        });
        // Frontend error logging for diagnostics
        function logFrontendError(context, status, error, xhr) {
            if (window && window.console) {
                console.error('[RadioBrowser][' + context + '] status:', status, 'error:', error, 'xhr:', xhr);
            }
            // Optionally, send to backend or log file if needed
        }
    }

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
        $('#rb-no-results').removeClass('hide').text(msg || 'No results found.');
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

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function notify(title, text, type) {
        if (typeof $.pnotify === 'function') {
            $.pnotify({
                title: title,
                text: text,
                type: type === 'success' ? 'success' : (type === 'error' ? 'error' : 'notice'),
                hide: true,
                delay: 3000
            });
        } else {
            console.log('[' + type + '] ' + title + ': ' + text);
        }
    }
}
