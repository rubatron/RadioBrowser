/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Main Entry Point - Initializes all modules
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.4.0
 */

console.log('Radio Browser: Main script loaded v3.4.0');

(function waitForModules() {
    // Wait for jQuery and all modules to be loaded
    if (typeof jQuery === 'undefined' && typeof $ === 'undefined') {
        console.log('Radio Browser: Waiting for jQuery...');
        setTimeout(waitForModules, 50);
        return;
    }

    var RB = window.RadioBrowser;
    if (!RB || !RB.search || !RB.player || !RB.favorites || !RB.settings || !RB.playbar || !RB.recents) {
        console.log('Radio Browser: Waiting for modules...');
        setTimeout(waitForModules, 50);
        return;
    }

    var $ = jQuery || window.$;

    console.log('Radio Browser: All modules ready, initializing...');

    $(document).ready(function() {
        // Only initialize if on radio-browser page
        if ($('#rb-name').length === 0 && $('#rb-top-stations').length === 0) {
            console.log('Radio Browser: Not on main page, skipping init');
            return;
        }

        console.log('Radio Browser: DOM ready, starting init');

        var state = RB.state;

        // Initialize country autocomplete
        RB.search.initCountryAutocomplete();

        // Bind all events
        bindEvents();
        bindTabEvents();

        // Initialize active tab panel
        var activeTab = $('.rb-tab.active').data('tab');
        if (activeTab) {
            $('#rb-' + activeTab + '-panel').removeClass('hide');
        }

        // Load favorites then top stations
        RB.favorites.loadFavorites(function() {
            RB.recents.loadRecentlyPlayed();
            if (!state.hasSearched) {
                console.log('Radio Browser: Init callback - loading top stations');
                RB.search.loadTopStations();
            }
            state.initComplete = true;
        });

        // Initialize settings and playbar
        RB.settings.bindVisibilityEvents();
        RB.settings.bindLocalToggleEvents();
        RB.settings.loadLocalSettings();
        RB.playbar.init();
    });

    // ========================================================================
    // EVENT BINDINGS
    // ========================================================================

    function bindTabEvents() {
        var state = RB.state;

        // Tab switching
        $(document).on('click', '.rb-tab', function(e) {
            e.preventDefault();
            var tab = $(this).data('tab');
            console.log('Tab clicked:', tab);

            $('.rb-tab').removeClass('active');
            $(this).addClass('active');

            $('.rb-panel').addClass('hide');
            $('#rb-' + tab + '-panel').removeClass('hide');

            if (tab === 'settings') {
                RB.settings.checkApiStatus();
                RB.settings.refreshServiceStatus();
            }
        });

        // Accordion toggle
        $(document).on('click', '.rb-accordion-header', function(e) {
            e.preventDefault();
            var accordion = $(this).closest('.rb-accordion, .rb-sub-accordion');
            accordion.toggleClass('open');
        });

        // Troubleshooting buttons
        $('#rb-refresh-status').on('click', function(e) {
            e.stopPropagation();
            RB.settings.checkApiStatus();
        });

        $('#rb-flush-cache').on('click', function(e) {
            e.stopPropagation();
            RB.settings.flushCache();
        });

        $('#rb-restart-services').on('click', function(e) {
            e.stopPropagation();
            RB.settings.restartServices();
        });

        $('#rb-view-log').on('click', function(e) {
            e.stopPropagation();
            RB.settings.viewLog();
        });

        $('#rb-clear-log').on('click', function(e) {
            e.stopPropagation();
            RB.settings.clearLog();
        });

        $('#rb-reboot-system').on('click', function(e) {
            e.stopPropagation();
            RB.settings.rebootSystem();
        });

        $('#rb-repair').on('click', function(e) {
            e.stopPropagation();
            RB.settings.repairInstallation();
        });

        $('#rb-uninstall').on('click', function(e) {
            e.stopPropagation();
            RB.settings.uninstallExtension();
        });
    }

    function bindEvents() {
        var state = RB.state;

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
            RB.search.searchStations();
        });

        // Top stations button
        $('#rb-top-stations').on('click', function(e) {
            e.preventDefault();
            if (state.loading) return;

            var star = $(this).find('.fa-star');
            star.css('color', '#d35400');

            state.offset = 0;
            state.hasSearched = false;
            RB.search.loadTopStations(true);
        });

        // Enter key on search fields
        $('#rb-name, #rb-country, #rb-genre').on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#rb-country-list').addClass('hide');
                state.offset = 0;
                RB.search.searchStations();
            }
        });

        // Pagination
        $('#rb-prev').on('click', function() {
            if (state.loading || state.offset === 0) return;
            state.offset = Math.max(0, state.offset - state.limit);
            RB.search.searchStations();
        });

        $('#rb-next').on('click', function() {
            if (state.loading) return;
            state.offset += state.limit;
            RB.search.searchStations();
        });

        // Play button
        $(document).on('click', '.rb-play-btn', function(e) {
            e.preventDefault();
            var card = $(this).closest('.rb-station-card');
            var btn = $(this);

            if (card.hasClass('playing')) {
                RB.player.stopStation(card, btn);
            } else {
                RB.player.playStation(card);
            }
        });

        // Add to favorites
        $(document).on('click', '.rb-add-btn', function(e) {
            e.preventDefault();
            RB.favorites.addToRadio($(this).closest('.rb-station-card'));
        });

        // Download stream
        $(document).on('click', '.rb-download-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            RB.player.downloadStreamFromCard($(this).closest('.rb-station-card'));
        });
    }

    // Load settings when settings tab opened
    $(document).on('click', '.rb-tab[data-tab="settings"]', function() {
        RB.settings.loadSettings();
    });

})();
