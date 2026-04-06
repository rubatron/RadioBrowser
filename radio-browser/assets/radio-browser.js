/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Frontend JavaScript
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 4.0.0
 */

(function waitForJQuery() {
    if (typeof jQuery !== 'undefined' || typeof $ !== 'undefined') {
        initRadioBrowser(jQuery || $);
    } else {
        setTimeout(waitForJQuery, 50);
    }
})();

function initRadioBrowser($) {
        // Capitalize only the first letter of the first word (letters only)
        function capitalizeFirstWord(str) {
            if (!str) return '';
            return str.replace(/^(\s*)([a-zA-Z])/, function(match, p1, p2) {
                return p1 + p2.toUpperCase();
            });
        }
    'use strict';

    var API_URL = '/extensions/installed/radio-browser/backend/api.php';
    var csrfToken = $('meta[name="csrf-token"]').attr('content') || '';

    // Include CSRF token in all AJAX requests
    $.ajaxSetup({
        beforeSend: function(xhr) {
            if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
        }
    });

    var state = {
        offset: 0,
        limit: 30,
        loading: false,
        currentPlaying: null,
        stationData: [],           // Search results stations
        recentStationData: [],     // Recently played stations (separate to prevent memory leak)
        favoriteStationData: [],   // Favorites section stations
        favorites: [],
        favoriteNames: [],         // Station names for matching when URLs differ
        favoritesMap: {},
        recentlyPlayed: [],
        countries: [],
        hasSearched: false,  // Track if user has searched (prevents init overwriting)
        initComplete: false, // Track if initial load is done
        searchXhr: null      // Active search AJAX request (aborted on new search)
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
        // Only initialize if on radio-browser page
        if ($('#rb-name').length > 0 || $('#rb-top-stations').length > 0) {
            initCountryAutocomplete();
            bindEvents();
            bindTabEvents();
            bindVisibilityEvents();
            loadSettings();  // Load visibility settings on init

            // Hash navigation: if URL has #settings, activate settings section
            if (window.location.hash === '#settings') {
                $('.rb-section-btn[data-section="settings"]').trigger('click');
            }

            // Initialize active section panel
            var activeSection = $('.rb-section-btn.active').data('section');
            if (activeSection) {
                $('#rb-' + activeSection + '-section').removeClass('hide');
            }

            // Load data in parallel for faster initial render
            var initPending = { favorites: false, recent: false };
            var initData = { favorites: null, recent: null };

            function checkInitComplete() {
                if (!initPending.favorites || !initPending.recent) return;
                // Both loaded - render in order
                if (initData.favorites) {
                    state.favorites = initData.favorites.map(function(f) {
                        return typeof f === 'string' ? f : f.url;
                    });
                    state.favoriteNames = initData.favorites.map(function(f) {
                        return typeof f === 'object' && f.name ? f.name : '';
                    }).filter(function(n) { return n; });
                    state.favoritesMap = {};
                    initData.favorites.forEach(function(f) {
                        var url = typeof f === 'string' ? f : f.url;
                        state.favoritesMap[url] = f;
                    });
                }
                if (initData.recent && initData.recent.length > 0) {
                    renderRecentlyPlayed(initData.recent);
                }
                if (!state.hasSearched) {
                    loadTopStations();
                }
                state.initComplete = true;
            }

            // Fire both requests in parallel
            $.ajax({
                url: API_URL + '?cmd=favorites',
                type: 'GET',
                dataType: 'json',
                timeout: 5000,
                success: function(data) {
                    if (data.success && data.favorites) {
                        initData.favorites = data.favorites;
                    }
                },
                complete: function() {
                    initPending.favorites = true;
                    checkInitComplete();
                }
            });

            $.ajax({
                url: API_URL + '?cmd=recently_played',
                type: 'GET',
                dataType: 'json',
                timeout: 5000,
                success: function(data) {
                    if (data.success && data.stations) {
                        initData.recent = data.stations;
                    }
                },
                complete: function() {
                    initPending.recent = true;
                    checkInitComplete();
                }
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

        // Filter on input (debounced to avoid excessive DOM updates)
        var countryDebounceTimer;
        input.on('input', function() {
            clearTimeout(countryDebounceTimer);
            var self = this;
            countryDebounceTimer = setTimeout(function() {
                var val = $(self).val().toLowerCase();
                showCountryList(val);
            }, 200);
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
        // Section header button switching (Search / Recently Played / Favorites / Settings)
        $(document).on('click', '.rb-section-btn', function(e) {
            e.preventDefault();
            var section = $(this).data('section');

            // Update active button
            $('.rb-section-btn').removeClass('active');
            $(this).addClass('active');

            // Show corresponding section panel, hide all others
            $('.rb-section-panel').addClass('hide');
            $('#rb-' + section + '-section').removeClass('hide');

            // Section-specific actions
            if (section === 'settings') {
                loadSettings();
                checkApiStatus();
            } else if (section === 'recently-played') {
                loadRecentlyPlayed();
            } else if (section === 'favorites') {
                loadAndRenderFavorites();
            }
            // 'search' section has no special load action
        });

        // Accordion toggle - for settings panel
        $(document).on('click', '.rb-accordion-header', function(e) {
            e.preventDefault();
            var accordion = $(this).closest('.rb-accordion, .rb-sub-accordion');
            accordion.toggleClass('open');

            // Refresh selectpicker on newly visible selects so they render correctly
            if (accordion.hasClass('open') && $.fn.selectpicker) {
                setTimeout(function() {
                    accordion.find('select').selectpicker('refresh');
                }, 50);
            }
        });

        // Refresh API status button
        $('#rb-refresh-status').on('click', function(e) {
            e.stopPropagation(); // Prevent accordion toggle
            checkApiStatus();
        });

        // radio-browser.info Status - open in new tab
        $('#rb-network-status').on('click', function(e) {
            e.stopPropagation();
            window.open('https://api.radio-browser.info/net', '_blank');
        });

        // External link buttons (docs, etc.) - open in new tab
        $(document).on('click', '.rb-ext-link[data-url]', function(e) {
            e.stopPropagation();
            window.open($(this).data('url'), '_blank');
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

        $('#rb-repair').on('click', function(e) {
            e.stopPropagation();
            repairExtension();
        });

        $('#rb-repair-thumbnails').on('click', function(e) {
            e.stopPropagation();
            repairThumbnails();
        });

        $('#rb-reinstall').on('click', function(e) {
            e.stopPropagation();
            reinstallExtension();
        });

        $('#rb-reboot-system').on('click', function(e) {
            e.stopPropagation();
            rebootSystem();
        });

        // Debug mode toggle
        var debugToggle = $('#rb-debug-mode-toggle');
        // Initialize toggle state from localStorage
        var debugEnabled = localStorage.getItem('rb_debug_mode') === 'true';
        if (debugEnabled) {
            $('#rb-debug-mode-on').prop('checked', true);
        } else {
            $('#rb-debug-mode-off').prop('checked', true);
        }
        debugToggle.on('click', 'label.toggle-radio', function(e) {
            e.stopPropagation();
            var forId = $(this).attr('for');
            var enabled = forId === 'rb-debug-mode-off';
            localStorage.setItem('rb_debug_mode', enabled ? 'true' : 'false');
            if (enabled) {
                notify('Debug mode ENABLED', 'Check browser console (F12) for [RB DEBUG] messages. This is resource intensive!', 'warning', 5000);
                console.log('[RB DEBUG] Debug mode enabled. Refresh the page to see full debug output.');
            } else {
                notify('Debug mode disabled', '', 'info', 2000);
                console.log('[RB DEBUG] Debug mode disabled.');
            }
        });

        // === Custom API Management (AJAX) ===
        // NOTE: Custom API add/remove handlers removed - feature hidden pending redesign
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

        // Download stream as .m3u
        $(document).on('click', '.rb-download-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            downloadStreamFromCard($(this).closest('.rb-station-card'));
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
                    var isLoadBalancer = function(name) { return name.indexOf('all.') === 0; };
                    data.servers.forEach(function(server) {
                        // Hide offline mirrors, always show the load balancer
                        if (!server.online && !isLoadBalancer(server.name)) return;

                        var statusClass = server.online ? 'online' : 'offline';
                        var latencyClass = server.online ? (server.latency < 500 ? 'fast' : 'slow') : 'offline';
                        var latencyText = server.online ? server.latency + 'ms' : 'offline';

                        html += '<div class="rb-status-item">' +
                            '<div class="rb-status-indicator ' + statusClass + '"></div>' +
                            '<span class="rb-status-name">' + escapeHtml(server.name) + '</span>' +
                            '<span class="rb-status-latency ' + latencyClass + '">' + latencyText + '</span>' +
                        '</div>';
                    });
                    statusContainer.html(html || '<div class="rb-status-item"><span class="rb-status-name">No servers reachable</span></div>');
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

    function checkCurrentlyPlaying() {
        // Check current playback status via API - uses currentsong.txt file URL
        $.ajax({
            url: API_URL + '?cmd=current_status',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                // Cache DOM query once — avoid repeated full-DOM traversals
                var cards = $('.rb-station-card');
                var playIcon = '<i class="fa-solid fa-sharp fa-play"></i>';
                var stopIcon = '<i class="fa-solid fa-sharp fa-stop"></i>';

                // Reset all cards
                cards.removeClass('playing').find('.rb-play-btn').removeClass('playing').html(playIcon);
                state.currentPlaying = null;

                if (data.success && data.is_playing && data.current_url) {
                    var normalizedUrl = data.current_url.replace(/^https?:/, '');
                    cards.each(function() {
                        var card = $(this);
                        var cardUrl = card.data('url');
                        if (cardUrl && cardUrl.replace(/^https?:/, '') === normalizedUrl) {
                            card.addClass('playing').find('.rb-play-btn').addClass('playing').html(stopIcon);
                            state.currentPlaying = data.current_url;
                        }
                    });
                }
            },
            error: function() {
                // Silent fail — playback status check is non-critical
            }
        });
    }

    function loadRecentlyPlayed() {
        var limit = limitsState.recentlyPlayed || 0;
        var url = API_URL + '?cmd=recently_played';
        if (limit > 0) url += '&limit=' + limit;

        $.ajax({
            url: url,
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

        // Filter moOde stations if setting is off
        var filteredStations = stations;
        if (!visibilityState.moode_recently) {
            filteredStations = stations.filter(function(s) { return !s.is_moode; });
        }

        filteredStations.forEach(function(s, index) {
            var logoUrl = resolveLogoUrl(s.logo, s.name);

            var stationData = {
                url: s.url,
                url_fallback: s.url,
                name: s.name,
                stationuuid: s.stationuuid || '',
                favicon: logoUrl,
                country: s.country || '',
                tags: s.tags || '',
                bitrate: s.bitrate || 0,
                codec: s.codec || '',
                is_moode: s.is_moode || false
            };
            state.recentStationData.push(stationData);

            html.push(buildStationCard(
                { url: s.url, name: s.name, stationuuid: s.stationuuid, logoUrl: logoUrl, country: s.country, tags: s.tags, bitrate: s.bitrate, codec: s.codec, is_moode: s.is_moode },
                index, 'rb-recent-card', isInFavorites(s.url, s.name)
            ));
        });

        container.html(html.join(''));

        // Check which station is currently playing and mark it
        checkCurrentlyPlaying();
        // Apply download button visibility based on settings
        applyDownloadButtonVisibility();
    }

    // Load and render favorites in the Favorites section
    function loadAndRenderFavorites() {
        var container = $('#rb-favorites');
        container.html('<p class="rb-no-results"><i class="fa-solid fa-sharp fa-spinner fa-spin"></i> Loading favorites...</p>');

        $.ajax({
            url: API_URL + '?cmd=favorites',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success && data.favorites && data.favorites.length > 0) {
                    var favs = data.favorites;
                    // Filter moOde stations if setting is off
                    if (!visibilityState.moode_favorites) {
                        favs = favs.filter(function(s) { return !s.is_moode; });
                    }
                    // Apply limit if set
                    if (limitsState.favorites > 0 && favs.length > limitsState.favorites) {
                        favs = favs.slice(0, limitsState.favorites);
                    }
                    renderFavorites(favs);
                } else {
                    container.html('<p class="rb-no-results">No favorites yet. Add stations from Search or Recently Played.</p>');
                }
            },
            error: function() {
                container.html('<p class="rb-no-results">Failed to load favorites.</p>');
            }
        });
    }

    function renderFavorites(favStations) {
        var container = $('#rb-favorites');
        var html = [];

        // Store favorites station data for playback
        state.favoriteStationData = [];

        favStations.forEach(function(s, index) {
            var logoUrl = resolveLogoUrl(s.logo, s.name);

            state.favoriteStationData.push({
                url: s.url,
                url_fallback: s.url,
                name: s.name,
                stationuuid: s.stationuuid || '',
                favicon: logoUrl,
                country: '',
                tags: '',
                bitrate: 0,
                codec: '',
                is_moode: s.is_moode || false
            });

            html.push(buildStationCard(
                { url: s.url, name: s.name, stationuuid: s.stationuuid, logoUrl: logoUrl, country: s.country, tags: s.tags, bitrate: s.bitrate, codec: s.codec, is_moode: s.is_moode },
                index, 'rb-favorite-card', true
            ));
        });

        container.html(html.join(''));
        checkCurrentlyPlaying();
        applyDownloadButtonVisibility();
    }

    function searchStations() {
        if (state.loading) return;
        state.loading = true;
        state.hasSearched = true;  // Mark that user has searched

        // Abort any pending search request to prevent race conditions
        if (state.searchXhr) {
            state.searchXhr.abort();
            state.searchXhr = null;
        }

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

        state.searchXhr = $.ajax({
            url: API_URL + '?cmd=search',
            type: 'GET',
            data: params,
            dataType: 'json',
            timeout: 15000,
            success: function(data) {
                state.searchXhr = null;
                state.loading = false;
                showLoading(false);
                if (data.success && data.stations && data.stations.length > 0) {
                    renderStations(data.stations);
                    updatePagination(data.stations.length);
                } else {
                    showNoResults(data.message || 'No stations found.');
                }
            },
            error: function(xhr, status) {
                state.searchXhr = null;
                if (status === 'abort') return; // Aborted by new search — ignore
                state.loading = false;
                showLoading(false);
                var msg = status === 'timeout' ? 'Request timed out.' : 'Failed to search.';
                showNoResults(msg);
            }
        });
    }

    function loadTopStations(forceLoad) {
        // Don't overwrite search results unless forced (user clicked Top Stations button)
        if (state.hasSearched && !forceLoad) {
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
        var container = $('#rb-results');
        var html = [];

        // Make sure results section is visible and loading/no-results are hidden
        $('#rb-results-section').removeClass('hide');
        $('#rb-loading').addClass('hide');
        $('#rb-no-results').addClass('hide');
        container.removeClass('hide');

        // Reset stationData array to prevent memory growth
        state.stationData = [];

        // Filter moOde stations if setting is off
        var filteredStations = stations;
        if (!visibilityState.moode_search) {
            filteredStations = stations.filter(function(s) { return !s.is_moode; });
        }

        $('#rb-result-count').text('(' + filteredStations.length + ' stations)');

        filteredStations.forEach(function(s, index) {
            var stationData = {
                url: (s.url_resolved || s.url).trim(),
                url_fallback: s.url.trim(),
                name: s.name,
                stationuuid: s.stationuuid || '',
                favicon: s.favicon || '',
                country: s.country || '',
                tags: s.tags || '',
                bitrate: s.bitrate || 0,
                codec: s.codec || '',
                is_moode: s.is_moode || false
            };

            state.stationData.push(stationData);

            html.push(buildStationCard(
                { url: stationData.url, name: s.name, stationuuid: s.stationuuid, favicon: s.favicon, country: s.country, tags: s.tags, bitrate: s.bitrate, codec: s.codec, is_moode: s.is_moode },
                index, '', isInFavorites(stationData.url, stationData.name)
            ));
        });

        container.html(html.join(''));

        // Check current playback status after rendering
        checkCurrentlyPlaying();
        // Apply download button visibility based on settings
        applyDownloadButtonVisibility();
    }

    function playStation(card) {
        var btn = card.find('.rb-play-btn');
        // Prevent double-click race condition
        if (btn.hasClass('disabled')) return;

        var stationIndex = parseInt(card.data('station-index'));

        // Check card type to get correct station data
        var isRecentCard = card.hasClass('rb-recent-card');
        var isFavoriteCard = card.hasClass('rb-favorite-card');
        var stationData;
        if (isRecentCard) {
            stationData = state.recentStationData[stationIndex];
        } else if (isFavoriteCard) {
            stationData = state.favoriteStationData[stationIndex];
        } else {
            stationData = state.stationData[stationIndex];
        }

        if (!stationData) {
            notify('Error', 'Station data not found', 'error');
            return;
        }

        var btn = card.find('.rb-play-btn');
        // Prevent double-click race condition
        if (btn.hasClass('disabled')) return;

        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');
        btn.addClass('disabled');

        $.ajax({
            url: API_URL + '?cmd=play',
            type: 'POST',
            data: JSON.stringify(stationData),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                if (data.success) {
                    // Store the playing station URL for playbar icon active state
                    try {
                        localStorage.setItem('rb_playing_url', stationData.url);
                        localStorage.setItem('rb_playing_name', stationData.name);
                    } catch (e) {}

                    // Mark ALL cards with this URL as playing (both recently played and search results)
                    $('.rb-station-card').removeClass('playing');
                    $('.rb-play-btn').removeClass('playing disabled').html('<i class="fa-solid fa-sharp fa-play"></i>');

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
                    btn.removeClass('disabled').html('<i class="fa-solid fa-sharp fa-play"></i>');
                    notify('Error', data.message || 'Failed to play', 'error');
                }
            },
            error: function() {
                btn.removeClass('disabled').html('<i class="fa-solid fa-sharp fa-play"></i>');
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

            // Clear Radio Browser playing state
            try {
                localStorage.removeItem('rb_playing_url');
                localStorage.removeItem('rb_playing_name');
            } catch (e) {}

            notify('Stopped', 'Playback stopped', 'info');
        }).fail(function() {
            btn.html('<i class="fa-solid fa-sharp fa-stop"></i>');
        });
    }

    function addToRadio(card) {
        var stationIndex = parseInt(card.data('station-index'));

        // Check card type to get correct station data
        var isRecentCard = card.hasClass('rb-recent-card');
        var isFavoriteCard = card.hasClass('rb-favorite-card');
        var stationData;
        if (isRecentCard) {
            stationData = state.recentStationData[stationIndex];
        } else if (isFavoriteCard) {
            stationData = state.favoriteStationData[stationIndex];
        } else {
            stationData = state.stationData[stationIndex];
        }

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

    function notify(title, text, type, duration) {
        if (typeof $.pnotify === 'function') {
            $.pnotify({
                title: title,
                text: text,
                type: type === 'success' ? 'success' : (type === 'error' ? 'error' : 'notice'),
                hide: true,
                delay: duration || 3000
            });
        } else {
            console.log('[' + type + '] ' + title + ': ' + text);
        }
    }

    /**
     * Resolve logo URL from a station's logo field (used by recently played & favorites).
     * Returns a URL string or empty string if no logo.
     */
    function resolveLogoUrl(logo, name) {
        if (!logo) return '';
        if (logo === 'local') {
            return '/imagesw/radio-logos/thumbs/' + encodeURIComponent(name) + '.jpg';
        }
        if (logo.startsWith('/extensions/')) return logo;
        if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
        return '/imagesw/radio-logos/thumbs/' + encodeURIComponent(name) + '.jpg';
    }

    /**
     * Build station card HTML string.
     * @param {Object} s Station data {url, name, favicon/logoUrl, country, tags, bitrate, codec}
     * @param {number} storeIndex Index for data-station-index attribute
     * @param {string} extraClass Optional extra CSS class (e.g. 'rb-recent-card', 'rb-favorite-card')
     * @param {boolean} isFavorite Whether station is in favorites
     */
    function buildStationCard(s, storeIndex, extraClass, isFavorite) {
        var logoUrl = s.logoUrl || s.favicon || '';
        var isMoode = s.is_moode || false;
        var logoHtml;

        var altText = escapeHtml(s.name || 'Station logo');
        if (isMoode) {
            // Wrap logo in container for M badge overlay
            var imgTag = logoUrl ?
                '<img class="rb-logo" src="' + escapeHtml(logoUrl) + '" alt="' + altText + '" onerror="this.src=\'/extensions/installed/radio-browser/assets/rb-default-logo.jpg\'">' :
                '<img class="rb-logo" src="/extensions/installed/radio-browser/assets/rb-default-logo.jpg" alt="' + altText + '">';
            logoHtml = '<div class="rb-logo-wrapper">' + imgTag + '<span class="rb-moode-badge">m</span></div>';
        } else {
            logoHtml = logoUrl ?
                '<img class="rb-logo" src="' + escapeHtml(logoUrl) + '" alt="' + altText + '" onerror="this.src=\'/extensions/installed/radio-browser/assets/rb-default-logo.jpg\'">' :
                '<img class="rb-logo" src="/extensions/installed/radio-browser/assets/rb-default-logo.jpg" alt="' + altText + '">';
        }

        var addBtnClass = isFavorite ? 'btn rb-add-btn added' : 'btn rb-add-btn';
        var addBtnIcon = isFavorite ? '<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>' : '<i class="fa-solid fa-sharp fa-heart"></i>';
        var addBtnTitle = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

        var cardClass = 'rb-station-card' + (extraClass ? ' ' + extraClass : '');
        var url = s.url || '';
        var uuid = s.stationuuid || '';

        return '<div class="' + cardClass + '" data-station-index="' + storeIndex + '" data-url="' + escapeHtml(url) + '" data-name="' + escapeHtml(s.name) + '" data-stationuuid="' + escapeHtml(uuid) + '">' +
            logoHtml +
            '<div class="rb-info">' +
                '<div class="rb-name">' + escapeHtml(s.name) + '</div>' +
                '<div class="rb-meta-lines">' +
                    '<div class="rb-meta rb-meta-country">' + (s.country || '') + '</div>' +
                    '<div class="rb-meta rb-meta-bitrate">' +
                        ((s.bitrate ? s.bitrate + ' kbps' : '') + (s.codec ? ' ' + s.codec : '')) +
                        (s.bitrate && s.bitrate >= 320 ? ' <span class="playback-hd-badge">HiRes</span>' : '') +
                    '</div>' +
                    '<div class="rb-meta rb-meta-genre">' +
                        (s.tags ? capitalizeFirstWord(s.tags.split(',')[0]) : '') +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="rb-actions">' +
                '<button class="btn rb-play-btn" title="Play"><i class="fa-solid fa-sharp fa-play"></i></button>' +
                '<button class="' + addBtnClass + '" title="' + addBtnTitle + '">' + addBtnIcon + '</button>' +
                '<button class="btn rb-download-btn" title="Download .m3u"><i class="fa-solid fa-sharp fa-download"></i></button>' +
            '</div>' +
        '</div>';
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

    function repairExtension() {
        var btn = $('#rb-repair');
        btn.prop('disabled', true).find('i').removeClass('fa-screwdriver-wrench').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=repair',
            type: 'POST',
            dataType: 'json',
            timeout: 30000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-screwdriver-wrench');
                if (data.success) {
                    notify('Repaired', data.message || 'Extension repaired successfully', 'success');
                } else {
                    notify('Error', data.message || 'Repair failed', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-screwdriver-wrench');
                notify('Error', 'Failed to repair extension', 'error');
            }
        });
    }

    function repairThumbnails() {
        var btn = $('#rb-repair-thumbnails');
        btn.prop('disabled', true).find('i').removeClass('fa-images').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=repair_thumbnails',
            type: 'POST',
            dataType: 'json',
            timeout: 120000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-images');
                if (data.success) {
                    var msg = data.message || 'Thumbnails repaired';
                    if (data.repaired > 0) {
                        msg += ' (' + data.repaired + ' fixed)';
                    }
                    notify('Thumbnails', msg, 'success');
                } else {
                    notify('Error', data.message || 'Thumbnail repair failed', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-images');
                notify('Error', 'Failed to repair thumbnails', 'error');
            }
        });
    }

    function reinstallExtension() {
        if (!confirm('Re-run install script? This will refresh permissions and web root files.')) {
            return;
        }

        var btn = $('#rb-reinstall');
        btn.prop('disabled', true).find('i').removeClass('fa-arrows-rotate').addClass('fa-spinner fa-spin');

        $.ajax({
            url: API_URL + '?cmd=reinstall',
            type: 'POST',
            dataType: 'json',
            timeout: 60000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-arrows-rotate');
                if (data.success) {
                    notify('Reinstalled', data.message || 'Extension reinstalled successfully', 'success');
                } else {
                    notify('Error', data.message || 'Reinstall failed', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-arrows-rotate');
                notify('Error', 'Failed to reinstall extension', 'error');
            }
        });
    }

    // ============================================================================
    // VISIBILITY OPTIONS
    // ============================================================================

    var visibilityState = {
        library: true,
        m: true,
        system: true,
        playbar: true,
        download: true,
        activityglow: true,
        moode_favorites: true,
        moode_recently: true,
        moode_search: true
    };

    var limitsState = {
        recentlyPlayed: 0,  // 0 = no limit
        favorites: 0         // 0 = no limit
    };

    // Apply download button visibility to all rendered cards
    function applyDownloadButtonVisibility() {
        if (visibilityState.download) {
            $('.rb-download-btn').show();
        } else {
            $('.rb-download-btn').hide();
        }
    }

    function visibilityAreaName(area) {
        return area === 'library' ? 'Library menu'
            : area === 'm' ? 'M Menu'
            : area === 'system' ? 'M Configuration Tile'
            : area === 'download' ? 'Download Button'
            : area === 'activityglow' ? 'Activity Glow'
            : area === 'moode_favorites' ? 'moOde Stations in Favorites'
            : area === 'moode_recently' ? 'moOde Stations in Recently Played'
            : area === 'moode_search' ? 'moOde Stations in Search'
            : 'Playbar Icon';
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

    function updatePlaybarMockup() {
        var mockup = $('#rb-playbar-mockup');
        var activityOptions = $('.rb-activityglow-option');

        if (visibilityState.playbar) {
            mockup.addClass('active');
            activityOptions.removeClass('disabled');

            if (visibilityState.activityglow) {
                mockup.addClass('rb-active');
            } else {
                mockup.removeClass('rb-active');
            }
        } else {
            mockup.removeClass('active rb-active');
            activityOptions.addClass('disabled');
        }
    }

    function renderVisibility(visibility) {
        var v = visibility || {};
        visibilityState.library = v.library !== false;
        visibilityState.m = v.m !== false;
        visibilityState.system = v.system !== false;
        visibilityState.playbar = v.playbar !== false;
        visibilityState.download = v.download !== false;
        visibilityState.activityglow = v.activityglow !== false;
        visibilityState.moode_favorites = v.moode_favorites !== false;
        visibilityState.moode_recently = v.moode_recently !== false;
        visibilityState.moode_search = v.moode_search !== false;

        applyVisibilityButtonState($('#rb-visibility-library-btn'), $('#rb-visibility-library-state'), 'library', visibilityState.library);
        applyVisibilityButtonState($('#rb-visibility-m-btn'), $('#rb-visibility-m-state'), 'm', visibilityState.m);
        applyVisibilityButtonState($('#rb-visibility-system-btn'), $('#rb-visibility-system-state'), 'system', visibilityState.system);
        applyVisibilityButtonState($('#rb-visibility-playbar-btn'), $('#rb-visibility-playbar-state'), 'playbar', visibilityState.playbar);
        applyVisibilityButtonState($('#rb-visibility-download-btn'), $('#rb-visibility-download-state'), 'download', visibilityState.download);
        applyVisibilityButtonState($('#rb-visibility-moode-search-btn'), null, 'moode_search', visibilityState.moode_search);
        applyVisibilityButtonState($('#rb-visibility-moode-favorites-btn'), null, 'moode_favorites', visibilityState.moode_favorites);
        applyVisibilityButtonState($('#rb-visibility-moode-recently-btn'), null, 'moode_recently', visibilityState.moode_recently);

        // Update playbar mockup preview
        updatePlaybarMockup();

        // Apply download button visibility to all cards
        applyDownloadButtonVisibility();
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
                    // Invalidate inject-script cache so moOde picks up changes on next navigation
                    try {
                        sessionStorage.removeItem('rb_settings');
                        sessionStorage.setItem('rb_settings_changed', '1');
                    } catch (e) {}
                    // Menu-related toggles: auto-flush cache so moOde picks up changes
                    if (['library', 'm', 'system', 'playbar'].indexOf(area) !== -1) {
                        $.ajax({
                            url: API_URL + '?cmd=flush_cache',
                            type: 'POST',
                            dataType: 'json',
                            timeout: 5000,
                            complete: function() {
                                notify('Updated', visibilityAreaName(area) + ' updated — navigate back to moOde to apply', 'success', 4000);
                            }
                        });
                    } else {
                        notify('Updated', visibilityAreaName(area) + ' visibility updated', 'success');
                    }
                } else {
                    notify('Error', data.message || 'Failed to update visibility', 'error');
                }
            },
            error: function() {
                radios.prop('disabled', false);
                toggleEl.css('pointer-events', '');
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
                    if (data.settings.limits) {
                        limitsState.recentlyPlayed = data.settings.limits.recentlyPlayed || 0;
                        limitsState.favorites = data.settings.limits.favorites || 0;
                        $('#rb-limit-recently').val(limitsState.recentlyPlayed || '');
                        $('#rb-limit-favorites').val(limitsState.favorites || '');
                    }
                }
            },
            error: function() {
                // Settings load failed — defaults remain active
            }
        });
        // Load service status for Extension Info badge
        loadServiceStatus();
    }

    function loadServiceStatus() {
        $.ajax({
            url: API_URL + '?cmd=service_status',
            type: 'GET',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data.success) {
                    // Set version
                    $('#rb-ext-version').text(data.version || 'unknown');

                    // Set status badge
                    var statusMap = {
                        running: { css: 'rb-status-running', label: 'Running' },
                        warning: { css: 'rb-status-warning', label: 'Warning' },
                        error:   { css: 'rb-status-error', label: 'Error' },
                        inactive:{ css: 'rb-status-inactive', label: 'Inactive' }
                    };
                    var s = statusMap[data.status] || statusMap.inactive;
                    $('#rb-service-status').html(
                        '<span class="rb-status-dot ' + s.css + '"></span> ' + s.label
                    );

                    // Build tooltip with check details
                    if (data.checks) {
                        var details = [];
                        $.each(data.checks, function(name, check) {
                            details.push((check.ok ? '✓' : '✗') + ' ' + name + ': ' + check.detail);
                        });
                        $('#rb-service-status').attr('title', details.join('\n'));
                    }
                }
            },
            error: function() {
                $('#rb-ext-version').text('?');
                $('#rb-service-status').html(
                    '<span class="rb-status-dot rb-status-error"></span> Unreachable'
                );
            }
        });
    }

    function bindVisibilityEvents() {
        var areas = [
            ['rb-visibility-library-btn', 'library'],
            ['rb-visibility-m-btn', 'm'],
            ['rb-visibility-system-btn', 'system'],
            ['rb-visibility-playbar-btn', 'playbar'],
            ['rb-visibility-download-btn', 'download'],
            ['rb-visibility-moode-search-btn', 'moode_search'],
            ['rb-visibility-moode-favorites-btn', 'moode_favorites'],
            ['rb-visibility-moode-recently-btn', 'moode_recently']
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

        // Activity glow toggle via mockup click
        $('#rb-playbar-mockup').on('click', function() {
            if (!visibilityState.playbar) return; // Only works when playbar is enabled
            var newState = !visibilityState.activityglow;
            visibilityState.activityglow = newState;
            updatePlaybarMockup();

            // Save to backend
            $.ajax({
                url: API_URL + '?cmd=set_visibility',
                type: 'POST',
                data: { area: 'activityglow', value: newState ? '1' : '0' },
                dataType: 'json',
                timeout: 10000
            });
        });

        // moOde station filter checkboxes replaced with toggles in areas[] above

        // Limit input handlers
        $('#rb-limit-recently').on('change', function() {
            var val = parseInt($(this).val()) || 0;
            limitsState.recentlyPlayed = val;
            $.ajax({
                url: API_URL + '?cmd=set_limit',
                type: 'POST',
                data: { type: 'recentlyPlayed', value: val },
                dataType: 'json',
                timeout: 10000,
                success: function() {
                    loadRecentlyPlayed();  // Refresh with new limit
                }
            });
        });

        $('#rb-limit-favorites').on('change', function() {
            var val = parseInt($(this).val()) || 0;
            limitsState.favorites = val;
            $.ajax({
                url: API_URL + '?cmd=set_limit',
                type: 'POST',
                data: { type: 'favorites', value: val },
                dataType: 'json',
                timeout: 10000,
                success: function() {
                    loadAndRenderFavorites();  // Refresh with new limit
                }
            });
        });
    }

    // ============================================================================
    // STREAM DOWNLOAD (Download .m3u from card via backend)
    // ============================================================================

    function downloadStreamFromCard(card) {
        // Use attr() instead of data() for reliable extraction
        var streamUrl = card.attr('data-url');
        var stationName = card.attr('data-name') || card.find('.rb-name').text() || 'radio_stream';

        if (!streamUrl) {
            notify('Error', 'No stream URL found', 'error');
            return;
        }

        // Build download URL - use backend to serve file with proper headers
        var downloadUrl = API_URL + '?cmd=download_m3u&url=' + encodeURIComponent(streamUrl) + '&name=' + encodeURIComponent(stationName);

        // Open in hidden iframe to trigger download without navigation
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = downloadUrl;
        document.body.appendChild(iframe);

        // Cleanup after delay
        setTimeout(function() {
            document.body.removeChild(iframe);
        }, 5000);
    }

    // Reload settings when settings section is opened
    $(document).on('click', '.rb-section-btn[data-section="settings"]', function() {
        loadSettings();
    });
}
