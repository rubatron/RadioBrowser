/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Frontend JavaScript
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.0.0
 */

console.log('Radio Browser: Script file loaded v3.0.1');

(function waitForJQuery() {
    if (typeof jQuery !== 'undefined' || typeof $ !== 'undefined') {
        console.log('Radio Browser: jQuery found, initializing...');
        initRadioBrowser(jQuery || $);
    } else {
        console.log('Radio Browser: jQuery not found, waiting...');
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
        stationData: [],           // Search results stations
        recentStationData: [],     // Recently played stations (separate to prevent memory leak)
        favorites: [],
        favoriteNames: [],         // Station names for matching when URLs differ
        favoritesMap: {},
        recentlyPlayed: [],
        countries: [],
        hasSearched: false,  // Track if user has searched (prevents init overwriting)
        initComplete: false  // Track if initial load is done
    };

    /**
     * Normalize URL for comparison (handles http/https, trailing slashes)
     */
    function normalizeUrl(url) {
        if (!url) return '';
        return url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    }

    /**
     * Normalize name for comparison (lowercase, trim whitespace)
     */
    function normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().trim();
    }

    /**
     * Check if station is in favorites (by URL or name)
     */
    function isInFavorites(url, name) {
        if (!url && !name) return false;

        // Check by URL first
        if (url) {
            var normalizedUrl = normalizeUrl(url);
            for (var i = 0; i < state.favorites.length; i++) {
                if (normalizeUrl(state.favorites[i]) === normalizedUrl) {
                    return true;
                }
            }
        }

        // Also check by name (handles different URLs for same station)
        if (name) {
            var normalizedName = normalizeName(name);
            for (var i = 0; i < state.favoriteNames.length; i++) {
                if (normalizeName(state.favoriteNames[i]) === normalizedName) {
                    return true;
                }
            }
        }

        return false;
    }

    // Country list for autocomplete
    var COUNTRIES = [
        {code: '', name: 'All Countries'},
        {code: 'NL', name: 'Netherlands'},
        {code: 'DE', name: 'Germany'},
        {code: 'GB', name: 'United Kingdom'},
        {code: 'US', name: 'United States'},
        {code: 'FR', name: 'France'},
        {code: 'BE', name: 'Belgium'},
        {code: 'AT', name: 'Austria'},
        {code: 'CH', name: 'Switzerland'},
        {code: 'ES', name: 'Spain'},
        {code: 'IT', name: 'Italy'},
        {code: 'AU', name: 'Australia'},
        {code: 'CA', name: 'Canada'},
        {code: 'JP', name: 'Japan'},
        {code: 'BR', name: 'Brazil'},
        {code: 'AR', name: 'Argentina'},
        {code: 'MX', name: 'Mexico'},
        {code: 'PL', name: 'Poland'},
        {code: 'SE', name: 'Sweden'},
        {code: 'NO', name: 'Norway'},
        {code: 'DK', name: 'Denmark'},
        {code: 'FI', name: 'Finland'},
        {code: 'PT', name: 'Portugal'},
        {code: 'IE', name: 'Ireland'},
        {code: 'GR', name: 'Greece'},
        {code: 'CZ', name: 'Czech Republic'},
        {code: 'RU', name: 'Russia'},
        {code: 'UA', name: 'Ukraine'},
        {code: 'IN', name: 'India'},
        {code: 'CN', name: 'China'},
        {code: 'KR', name: 'South Korea'},
        {code: 'NZ', name: 'New Zealand'},
        {code: 'ZA', name: 'South Africa'}
    ];

    $(document).ready(function() {
        console.log('Radio Browser: DOM ready');

        // Only initialize if on radio-browser page
        if ($('#rb-name').length > 0 || $('#rb-top-stations').length > 0) {
            initCountryAutocomplete();
            bindEvents();
            bindTabEvents();

            // Initialize active tab panel
            var activeTab = $('.rb-tab.active').data('tab');
            if (activeTab) {
                $('#rb-' + activeTab + '-panel').removeClass('hide');
            }

            // Load favorites then top stations
            loadFavorites(function() {
                loadRecentlyPlayed();
                // Only load top stations if user hasn't started searching yet
                if (!state.hasSearched) {
                    console.log('Radio Browser: Init callback - loading top stations');
                    loadTopStations();
                } else {
                    console.log('Radio Browser: Init callback - skipping top stations (user already searched)');
                }
                state.initComplete = true;
            });
        }
    });

    function initCountryAutocomplete() {
        var input = $('#rb-country');
        var list = $('#rb-country-list');
        var selectedCode = '';

        // Show dropdown on focus
        input.on('focus', function() {
            showCountryList('');
        });

        // Filter on input
        input.on('input', function() {
            var val = $(this).val().toLowerCase();
            showCountryList(val);
        });

        // Handle Enter key - trigger search
        input.on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                list.addClass('hide');
                state.offset = 0;
                searchStations();
            }
            // Escape closes list
            if (e.keyCode === 27) {
                list.addClass('hide');
            }
        });

        // Click on country item
        list.on('click', '.rb-country-item', function() {
            var code = $(this).data('code');
            var name = $(this).text();
            input.val(name);
            input.data('selected-code', code);
            list.addClass('hide');
            // Trigger search immediately
            state.offset = 0;
            searchStations();
        });

        // Hide on click outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#rb-country, #rb-country-list').length) {
                list.addClass('hide');
            }
        });

        function showCountryList(filter) {
            var html = '';
            COUNTRIES.forEach(function(c) {
                if (!filter || c.name.toLowerCase().indexOf(filter) !== -1 || c.code.toLowerCase().indexOf(filter) !== -1) {
                    html += '<div class="rb-country-item" data-code="' + c.code + '">' + escapeHtml(c.name) + '</div>';
                }
            });
            list.html(html).removeClass('hide');
        }
    }

    function bindTabEvents() {
        // Tab switching - use event delegation to ensure it works
        $(document).on('click', '.rb-tab', function(e) {
            e.preventDefault();
            var tab = $(this).data('tab');
            console.log('Tab clicked:', tab);

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

        // Accordion toggle - for settings panel
        $(document).on('click', '.rb-accordion-header', function(e) {
            e.preventDefault();
            var accordion = $(this).closest('.rb-accordion, .rb-sub-accordion');
            accordion.toggleClass('open');
        });

        // Refresh API status button
        $('#rb-refresh-status').on('click', function(e) {
            e.stopPropagation(); // Prevent accordion toggle
            checkApiStatus();
        });

        // Troubleshooting buttons
        $('#rb-flush-cache').on('click', function(e) {
            e.stopPropagation();
            flushCache();
        });

        $('#rb-restart-services').on('click', function(e) {
            e.stopPropagation();
            restartServices();
        });

        $('#rb-view-log').on('click', function(e) {
            e.stopPropagation();
            viewLog();
        });

        $('#rb-clear-log').on('click', function(e) {
            e.stopPropagation();
            clearLog();
        });

        $('#rb-reboot-system').on('click', function(e) {
            e.stopPropagation();
            rebootSystem();
        });
    }

    function bindEvents() {
        // Info toggle
        $(document).on('click', '.info-toggle', function(e) {
            e.preventDefault();
            var targetId = $(this).data('cmd');
            $('#' + targetId).toggleClass('hide');
        });

        // Search form
        $('#radio-search-form').on('submit', function(e) {
            e.preventDefault();
            if (state.loading) return;
            state.offset = 0;
            searchStations();
        });

        // Top stations button - simple color change, no effects
        $('#rb-top-stations').on('click', function(e) {
            e.preventDefault();
            if (state.loading) return;

            // Simple star color change to #d35400
            var star = $(this).find('.fa-star');
            star.css('color', '#d35400');

            state.offset = 0;
            state.hasSearched = false;  // Reset search flag when viewing top stations
            loadTopStations(true);  // forceLoad=true to override search protection
        });

        // Enter key on station name triggers search
        $('#rb-name').on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                state.offset = 0;
                searchStations();
            }
        });

        // Enter key on country field triggers search
        $('#rb-country').on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#rb-country-list').addClass('hide');
                state.offset = 0;
                searchStations();
            }
        });

        // Enter key on genre field triggers search
        $('#rb-genre').on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                state.offset = 0;
                searchStations();
            }
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

        // Play button
        $(document).on('click', '.rb-play-btn', function(e) {
            e.preventDefault();
            var card = $(this).closest('.rb-station-card');
            var btn = $(this);

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
            error: function() {
                refreshBtn.find('i').removeClass('fa-spin');
                statusContainer.html('<div class="rb-status-item"><span class="rb-status-name">Failed to check API status</span></div>');
            }
        });
    }

    function loadFavorites(callback) {
        $.ajax({
            url: API_URL + '?cmd=favorites',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success && data.favorites) {
                    // Store URLs for quick lookup
                    state.favorites = data.favorites.map(function(f) {
                        return typeof f === 'string' ? f : f.url;
                    });
                    // Store names for matching when URLs differ
                    state.favoriteNames = data.favorites.map(function(f) {
                        return typeof f === 'object' && f.name ? f.name : '';
                    }).filter(function(n) { return n; });
                    // Create lookup map for faster checking
                    state.favoritesMap = {};
                    data.favorites.forEach(function(f) {
                        var url = typeof f === 'string' ? f : f.url;
                        state.favoritesMap[url] = f;
                    });
                    console.log('Loaded favorites:', state.favorites.length, 'names:', state.favoriteNames.length);
                }
                if (callback) callback();
            },
            error: function() {
                if (callback) callback();
            }
        });
    }

    function checkCurrentlyPlaying() {
        // Check current playback status via API - uses currentsong.txt file URL
        $.ajax({
            url: API_URL + '?cmd=current_status',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                // First, reset all cards to not playing
                $('.rb-station-card').removeClass('playing');
                $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
                state.currentPlaying = null;

                if (data.success && data.is_playing && data.current_url) {
                    // Find ALL station cards that match the current URL (in Recently Played AND Search Results)
                    $('.rb-station-card').each(function() {
                        var card = $(this);
                        var cardUrl = card.data('url');

                        // Match URL (handle http/https and trailing slashes)
                        if (cardUrl && (cardUrl === data.current_url ||
                            cardUrl.replace(/^https?:/, '') === data.current_url.replace(/^https?:/, ''))) {
                            // This station is currently playing - mark ALL matching cards
                            card.addClass('playing');
                            card.find('.rb-play-btn').addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                            state.currentPlaying = data.current_url;
                            // DON'T break - continue to find all cards with same URL
                        }
                    });
                }
            }
        });
    }

    function loadRecentlyPlayed() {
        $.ajax({
            url: API_URL + '?cmd=recently_played',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success && data.stations && data.stations.length > 0) {
                    renderRecentlyPlayed(data.stations);
                    // checkCurrentlyPlaying is called inside renderRecentlyPlayed
                }
            }
        });
    }

    function renderRecentlyPlayed(stations) {
        var container = $('#rb-recently-played');
        var html = [];

        // Reset recentStationData to prevent memory growth
        // Using separate array from search results
        state.recentStationData = [];

        stations.forEach(function(s, index) {
            // Logo field from our API is 'logo', can be 'local', cached path, or external URL
            var logoUrl = '';
            if (s.logo === 'local') {
                // Local logo stored in moOde's radio-logos thumbs folder
                logoUrl = '/imagesw/radio-logos/thumbs/' + encodeURIComponent(s.name) + '.jpg';
            } else if (s.logo && s.logo.startsWith('/extensions/')) {
                // Cached logo in extension cache
                logoUrl = s.logo;
            } else if (s.logo && (s.logo.startsWith('http://') || s.logo.startsWith('https://'))) {
                // External URL - use directly
                logoUrl = s.logo;
            } else if (s.logo) {
                // Assume it's a local path or try moOde logo folder
                logoUrl = '/imagesw/radio-logos/thumbs/' + encodeURIComponent(s.name) + '.jpg';
            }

            var logoHtml = logoUrl ?
                '<img class="rb-logo" src="' + escapeHtml(logoUrl) + '" alt="" onerror="this.src=\'/images/radio-logo.png\'">' :
                '<div class="rb-logo rb-logo-placeholder"><i class="fa-solid fa-sharp fa-radio"></i></div>';

            // Store in recentStationData with index for playback
            var storeIndex = index;
            var stationData = {
                url: s.url,
                url_fallback: s.url,
                name: s.name,
                favicon: logoUrl,
                country: '',
                tags: '',
                bitrate: 0,
                codec: ''
            };
            state.recentStationData.push(stationData);

            // Check if this station is in favorites (by URL or name)
            var isFavorite = isInFavorites(s.url, s.name);
            var addBtnClass = isFavorite ? 'btn rb-add-btn added' : 'btn rb-add-btn';
            var addBtnIcon = isFavorite ? '<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>' : '<i class="fa-solid fa-sharp fa-heart"></i>';
            var addBtnTitle = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

            html.push(
                '<div class="rb-station-card rb-recent-card" data-station-index="' + storeIndex + '" data-url="' + escapeHtml(s.url) + '">' +
                    logoHtml +
                    '<div class="rb-info">' +
                        '<div class="rb-name">' + escapeHtml(s.name) + '</div>' +
                        '<div class="rb-meta">Recently played</div>' +
                    '</div>' +
                    '<div class="rb-actions">' +
                        '<button class="btn rb-play-btn" title="Play"><i class="fa-solid fa-sharp fa-play"></i></button>' +
                        '<button class="' + addBtnClass + '" title="' + addBtnTitle + '">' + addBtnIcon + '</button>' +
                    '</div>' +
                '</div>'
            );
        });

        container.html(html.join(''));

        // Check which station is currently playing and mark it
        checkCurrentlyPlaying();
    }

    function searchStations() {
        if (state.loading) return;
        state.loading = true;
        state.hasSearched = true;  // Mark that user has searched

        console.log('Radio Browser: searchStations - hasSearched set to true');

        // Get country code from autocomplete
        var countryInput = $('#rb-country');
        var countryCode = countryInput.data('selected-code') || '';

        // If user typed a country name, try to find the code
        if (!countryCode && countryInput.val()) {
            var typed = countryInput.val().toLowerCase();
            COUNTRIES.forEach(function(c) {
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
            url: API_URL + '?cmd=search',
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

        // Don't overwrite search results unless forced (user clicked Top Stations button)
        if (state.hasSearched && !forceLoad) {
            console.log('Radio Browser: loadTopStations skipped - user has searched');
            return;
        }

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
                state.loading = false;
                showLoading(false);

                // Double-check: don't render if user searched during our request
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

    function renderStations(stations) {
        console.log('Radio Browser: renderStations called with ' + stations.length + ' stations');
        var container = $('#rb-results');
        var html = [];

        // Make sure results section is visible and loading/no-results are hidden
        $('#rb-results-section').removeClass('hide');
        $('#rb-loading').addClass('hide');
        $('#rb-no-results').addClass('hide');
        container.removeClass('hide');
        $('#rb-result-count').text('(' + stations.length + ' stations)');

        // Reset stationData array to prevent memory growth
        state.stationData = [];
        var startIndex = 0;

        stations.forEach(function(s, index) {
            var logoHtml = s.favicon ?
                '<img class="rb-logo" src="' + escapeHtml(s.favicon) + '" alt="" onerror="this.src=\'/images/radio-logo.png\'">' :
                '<div class="rb-logo rb-logo-placeholder"><i class="fa-solid fa-sharp fa-radio"></i></div>';

            var metaParts = [];
            if (s.country) metaParts.push(escapeHtml(s.country));
            if (s.tags) metaParts.push(escapeHtml(s.tags.split(',')[0]));
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

            var isFavorite = isInFavorites(stationData.url, stationData.name);
            var addBtnClass = isFavorite ? 'btn rb-add-btn added' : 'btn rb-add-btn';
            var addBtnIcon = isFavorite ? '<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>' : '<i class="fa-solid fa-sharp fa-heart"></i>';
            var addBtnTitle = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

            html.push(
                '<div class="rb-station-card" data-station-index="' + storeIndex + '" data-url="' + escapeHtml(stationData.url) + '">' +
                    logoHtml +
                    '<div class="rb-info">' +
                        '<div class="rb-name">' + escapeHtml(s.name) + '</div>' +
                        '<div class="rb-meta">' + metaParts.join(' • ') + '</div>' +
                    '</div>' +
                    '<div class="rb-actions">' +
                        '<button class="btn rb-play-btn" title="Play"><i class="fa-solid fa-sharp fa-play"></i></button>' +
                        '<button class="' + addBtnClass + '" title="' + addBtnTitle + '">' + addBtnIcon + '</button>' +
                    '</div>' +
                '</div>'
            );
        });

        container.html(html.join(''));

        // Check current playback status after rendering
        checkCurrentlyPlaying();
    }

    function playStation(card) {
        var stationIndex = parseInt(card.data('station-index'));

        // Check if this is a recently played card or a search result card
        var isRecentCard = card.hasClass('rb-recent-card');
        var stationData = isRecentCard ? state.recentStationData[stationIndex] : state.stationData[stationIndex];

        if (!stationData) {
            notify('Error', 'Station data not found', 'error');
            return;
        }

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
                if (data.success) {
                    // Mark ALL cards with this URL as playing (both recently played and search results)
                    $('.rb-station-card').removeClass('playing');
                    $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');

                    // Find all cards with matching URL and mark as playing
                    $('.rb-station-card').each(function() {
                        var cardUrl = $(this).data('url');
                        if (cardUrl && (cardUrl === stationData.url ||
                            cardUrl.replace(/^https?:/, '') === stationData.url.replace(/^https?:/, ''))) {
                            $(this).addClass('playing');
                            $(this).find('.rb-play-btn').addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                        }
                    });

                    state.currentPlaying = stationData.url;
                    notify('Playing', stationData.name, 'success');

                    // Refresh recently played to show new order
                    loadRecentlyPlayed();
                } else {
                    btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                    notify('Error', data.message || 'Failed to play', 'error');
                }
            },
            error: function() {
                btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                notify('Error', 'Failed to play station', 'error');
            }
        });
    }

    function stopStation(card, btn) {
        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');

        $.get('/command/index.php?cmd=stop', function() {
            card.removeClass('playing');
            btn.removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
            state.currentPlaying = null;
            notify('Stopped', 'Playback stopped', 'info');
        }).fail(function() {
            btn.html('<i class="fa-solid fa-sharp fa-stop"></i>');
        });
    }

    function addToRadio(card) {
        var stationIndex = parseInt(card.data('station-index'));

        // Check if this is a recently played card or a search result card
        var isRecentCard = card.hasClass('rb-recent-card');
        var stationData = isRecentCard ? state.recentStationData[stationIndex] : state.stationData[stationIndex];

        if (!stationData) {
            notify('Error', 'Station data not found', 'error');
            return;
        }

        var btn = card.find('.rb-add-btn');
        var isAlreadyFavorite = btn.hasClass('added');

        btn.prop('disabled', true);

        if (isAlreadyFavorite) {
            // REMOVE from favorites
            $.ajax({
                url: API_URL + '?cmd=remove',
                type: 'POST',
                data: JSON.stringify({ url: stationData.url }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 10000,
                success: function(data) {
                    btn.prop('disabled', false);
                    if (data.success) {
                        // Update ALL cards with same URL (recent + search results)
                        updateFavoriteState(stationData.url, false);
                        notify('Removed', 'Station removed from Favorites', 'success');
                    } else {
                        notify('Error', data.message || 'Could not remove', 'error');
                    }
                },
                error: function() {
                    btn.prop('disabled', false);
                    notify('Error', 'Failed to remove', 'error');
                }
            });
        } else {
            // ADD to favorites
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
                        // Update ALL cards with same URL (recent + search results)
                        updateFavoriteState(stationData.url, true, stationData);
                        notify('Added', 'Station added to Favorites', 'success');
                    } else {
                        notify('Info', data.message || 'Could not add', 'info');
                    }
                },
                error: function() {
                    btn.prop('disabled', false);
                    notify('Error', 'Failed to add', 'error');
                }
            });
        }
    }

    /**
     * Update favorite state for ALL cards with matching URL
     * This ensures both Recently Played and Search Results cards stay in sync
     */
    function updateFavoriteState(url, isFavorite, stationData) {
        var name = stationData ? stationData.name : null;

        if (isFavorite) {
            // Add to state
            if (!isInFavorites(url, null)) {
                state.favorites.push(url);
            }
            if (name && state.favoriteNames.indexOf(name) === -1) {
                state.favoriteNames.push(name);
            }
            if (stationData) {
                state.favoritesMap[url] = stationData;
            }
        } else {
            // Remove from state
            var idx = state.favorites.indexOf(url);
            if (idx > -1) {
                state.favorites.splice(idx, 1);
            }
            if (name) {
                var nameIdx = state.favoriteNames.indexOf(name);
                if (nameIdx > -1) {
                    state.favoriteNames.splice(nameIdx, 1);
                }
            }
            delete state.favoritesMap[url];
        }

        // Update ALL cards with this URL (both recent and search results)
        $('.rb-station-card').each(function() {
            var card = $(this);
            var cardUrl = card.data('url');
            if (cardUrl === url) {
                var btn = card.find('.rb-add-btn');
                if (isFavorite) {
                    btn.addClass('added');
                    btn.attr('title', 'Remove from Favorites');
                    btn.html('<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>');
                } else {
                    btn.removeClass('added');
                    btn.attr('title', 'Add to Favorites');
                    btn.html('<i class="fa-solid fa-sharp fa-heart"></i>');
                }
            }
        });
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

    // Troubleshooting functions
    function flushCache() {
        var btn = $('#rb-flush-cache');
        btn.prop('disabled', true).find('i').removeClass('fa-trash-can').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=flush_cache',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-trash-can');
                if (data.success) {
                    notify('Cache Flushed', data.message || 'Cache cleared successfully', 'success');
                } else {
                    notify('Error', data.message || 'Failed to flush cache', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-trash-can');
                notify('Error', 'Failed to flush cache', 'error');
            }
        });
    }

    function restartServices() {
        var btn = $('#rb-restart-services');
        btn.prop('disabled', true).find('i').removeClass('fa-rotate').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=restart_services',
            type: 'POST',
            dataType: 'json',
            timeout: 30000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-rotate');
                if (data.success) {
                    notify('Services Restarted', data.message || 'nginx and PHP-FPM restarted', 'success');
                } else {
                    notify('Error', data.message || 'Failed to restart services', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-rotate');
                notify('Error', 'Failed to restart services', 'error');
            }
        });
    }

    function viewLog() {
        var btn = $('#rb-view-log');
        var output = $('#rb-log-output');
        btn.prop('disabled', true).find('i').removeClass('fa-file-lines').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=view_log',
            type: 'GET',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-file-lines');
                if (data.success) {
                    output.removeClass('hide').find('pre').text(data.log || 'Log is empty');
                } else {
                    notify('Error', data.message || 'Failed to read log', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-file-lines');
                notify('Error', 'Failed to read log', 'error');
            }
        });
    }

    function clearLog() {
        var btn = $('#rb-clear-log');
        btn.prop('disabled', true).find('i').removeClass('fa-eraser').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=clear_log',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-eraser');
                if (data.success) {
                    $('#rb-log-output').addClass('hide').find('pre').text('');
                    notify('Log Cleared', data.message || 'Log file cleared', 'success');
                } else {
                    notify('Error', data.message || 'Failed to clear log', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-eraser');
                notify('Error', 'Failed to clear log', 'error');
            }
        });
    }

    function rebootSystem() {
        if (!confirm('Are you sure you want to reboot the system?')) {
            return;
        }

        var btn = $('#rb-reboot-system');
        btn.prop('disabled', true).find('i').removeClass('fa-power-off').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=reboot',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data.success) {
                    notify('Rebooting', data.message || 'System is rebooting...', 'success');
                    // Don't re-enable button, system is rebooting
                } else {
                    btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-power-off');
                    notify('Error', data.message || 'Failed to reboot', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-power-off');
                notify('Error', 'Failed to reboot system', 'error');
            }
        });
    }

    // ============================================================================
    // VISIBILITY OPTIONS
    // ============================================================================

    var visibilityState = {
        header: true,
        library: true,
        m: true,
        system: true
    };

    function visibilityAreaName(area) {
        return area === 'header' ? 'Header menu'
            : area === 'library' ? 'Library menu'
            : area === 'm' ? 'M Menu'
            : 'M Configuration Tile';
    }

    function applyToggleState(toggleEl, visible) {
        if (!toggleEl || !toggleEl.length) return;
        if (visible) {
            toggleEl.removeClass('toggle-off').addClass('toggle-on');
        } else {
            toggleEl.removeClass('toggle-on').addClass('toggle-off');
        }
        toggleEl.find('input[value="On"]').prop('checked', visible);
        toggleEl.find('input[value="Off"]').prop('checked', !visible);
    }

    function applyVisibilityButtonState(toggleEl, stateEl, area, visible) {
        if (!toggleEl || !toggleEl.length) return;
        applyToggleState(toggleEl, visible);
        toggleEl.attr('title', visibilityAreaName(area) + ': ' + (visible ? 'Visible' : 'Hidden'));
        if (stateEl && stateEl.length) {
            stateEl.text(visible ? 'Visible' : 'Hidden');
        }
    }

    function renderVisibility(visibility) {
        var v = visibility || {};
        visibilityState.header = v.header !== false;
        visibilityState.library = v.library !== false;
        visibilityState.m = v.m !== false;
        visibilityState.system = v.system !== false;

        applyVisibilityButtonState($('#rb-visibility-header-btn'), $('#rb-visibility-header-state'), 'header', visibilityState.header);
        applyVisibilityButtonState($('#rb-visibility-library-btn'), $('#rb-visibility-library-state'), 'library', visibilityState.library);
        applyVisibilityButtonState($('#rb-visibility-m-btn'), $('#rb-visibility-m-state'), 'm', visibilityState.m);
        applyVisibilityButtonState($('#rb-visibility-system-btn'), $('#rb-visibility-system-state'), 'system', visibilityState.system);
    }

    function setVisibility(area, visible, toggleEl) {
        if (!toggleEl || !toggleEl.length) return;

        var radios = toggleEl.find('input[type="radio"]');
        radios.prop('disabled', true);
        toggleEl.css('pointer-events', 'none');

        $.ajax({
            url: API_URL + '?cmd=set_visibility',
            type: 'POST',
            data: { area: area, value: visible ? '1' : '0' },
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                radios.prop('disabled', false);
                toggleEl.css('pointer-events', '');

                if (data.success && data.data && data.data.visibility) {
                    renderVisibility(data.data.visibility);
                    $('#rb-visibility-note').text('Visibility updated for ' + visibilityAreaName(area) + '.')
                        .removeClass('error').addClass('ok');
                    notify('Updated', visibilityAreaName(area) + ' visibility updated', 'success');
                } else {
                    $('#rb-visibility-note').text(data.message || 'Failed to update visibility')
                        .removeClass('ok').addClass('error');
                    notify('Error', data.message || 'Failed to update visibility', 'error');
                }
            },
            error: function() {
                radios.prop('disabled', false);
                toggleEl.css('pointer-events', '');
                $('#rb-visibility-note').text('Failed to update visibility').removeClass('ok').addClass('error');
                notify('Error', 'Failed to update visibility', 'error');
            }
        });
    }

    function loadSettings() {
        $.ajax({
            url: API_URL + '?cmd=get_settings',
            type: 'GET',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data.success && data.settings) {
                    if (data.settings.visibility) {
                        renderVisibility(data.settings.visibility);
                    }
                }
            }
        });
    }

    function bindVisibilityEvents() {
        var areas = [
            ['rb-visibility-header-btn', 'header'],
            ['rb-visibility-library-btn', 'library'],
            ['rb-visibility-m-btn', 'm'],
            ['rb-visibility-system-btn', 'system']
        ];

        areas.forEach(function(e) {
            var toggleEl = $('#' + e[0]);
            var area = e[1];
            if (!toggleEl.length) return;

            toggleEl.find('input[type="radio"]').on('change', function() {
                if ($(this).prop('checked')) {
                    setVisibility(area, $(this).val() === 'On', toggleEl);
                }
            });
        });
    }

    // ============================================================================
    // STREAM DOWNLOAD (Simple - just get the URL/playlist)
    // ============================================================================

    function downloadStream() {
        var btn = $('#rb-download-stream');
        var statusEl = $('#rb-download-status');
        var infoEl = $('#rb-stream-info');

        // Check if there's a currently playing station
        if (!state.currentPlaying) {
            notify('Error', 'No station currently playing', 'error');
            statusEl.text('No station playing').css('color', '#e74c3c');
            return;
        }

        btn.prop('disabled', true);
        btn.find('i').removeClass('fa-download').addClass('fa-spinner fa-spin');
        statusEl.text('Getting stream info...').css('color', '#d35400');

        // Get station name from currently playing card
        var currentCard = $('.rb-station-card.playing').first();
        var stationName = currentCard.find('.rb-name').text() || 'radio_stream';
        var streamUrl = state.currentPlaying;

        // Show stream info
        $('#rb-stream-name').text(stationName);
        $('#rb-stream-url').text(streamUrl);
        infoEl.show();

        // Create a simple .m3u playlist file for download
        var m3uContent = '#EXTM3U\n#EXTINF:-1,' + stationName + '\n' + streamUrl + '\n';
        var blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        var url = URL.createObjectURL(blob);

        // Create download link
        var safeName = stationName.replace(/[^a-zA-Z0-9\-_\s]/g, '').trim() || 'radio_stream';
        var a = document.createElement('a');
        a.href = url;
        a.download = safeName + '.m3u';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        btn.prop('disabled', false);
        btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-download');
        statusEl.html('<i class="fa-solid fa-sharp fa-check"></i> Downloaded: ' + safeName + '.m3u')
            .css('color', '#2ecc71');
        notify('Downloaded', 'Playlist file downloaded', 'success');
    }

    function bindDownloadEvents() {
        $('#rb-download-stream').on('click', function(e) {
            e.stopPropagation();
            downloadStream();
        });
    }

    // Initialize visibility and download features when settings tab is opened
    $(document).on('click', '.rb-tab[data-tab="settings"]', function() {
        loadSettings();
    });

    // Bind events on document ready
    $(document).ready(function() {
        bindVisibilityEvents();
        bindDownloadEvents();
    });
}
