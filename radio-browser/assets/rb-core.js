/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Core Module - State, API, Utilities
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.4.0
 */

(function() {
    'use strict';

    // Create global namespace
    window.RadioBrowser = window.RadioBrowser || {};

    // Constants
    var API_URL = '/extensions/installed/radio-browser/backend/api.php';
    var RB_PLAYED_KEY = 'rb_played_urls';

    // Shared state
    var state = {
        offset: 0,
        limit: 30,
        loading: false,
        currentPlaying: null,
        stationData: [],
        recentStationData: [],
        favorites: [],
        favoriteNames: [],
        favoritesMap: {},
        recentlyPlayed: [],
        countries: [],
        hasSearched: false,
        initComplete: false
    };

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

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    function normalizeUrl(url) {
        if (!url) return '';
        return url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    }

    function normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().trim();
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

    // ========================================================================
    // PLAYBAR GLOW TRACKING
    // ========================================================================

    function saveRadioBrowserPlayedUrl(url) {
        if (!url) return;
        try {
            var stored = localStorage.getItem(RB_PLAYED_KEY);
            var urls = stored ? JSON.parse(stored) : [];

            var normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
            urls = urls.filter(function(u) {
                return u.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '') !== normalizedUrl;
            });

            urls.push(url);

            if (urls.length > 100) {
                urls = urls.slice(-100);
            }

            localStorage.setItem(RB_PLAYED_KEY, JSON.stringify(urls));
        } catch (e) {
            console.log('Radio Browser: Failed to save played URL to localStorage', e);
        }
    }

    // ========================================================================
    // API HELPER
    // ========================================================================

    function apiCall(cmd, data, options) {
        options = options || {};
        var url = API_URL + '?cmd=' + cmd;
        var method = options.method || 'GET';
        var timeout = options.timeout || 15000;

        return $.ajax({
            url: url,
            type: method,
            data: data,
            dataType: 'json',
            contentType: options.json ? 'application/json' : 'application/x-www-form-urlencoded',
            timeout: timeout
        });
    }

    // ========================================================================
    // EXPORT PUBLIC API
    // ========================================================================

    RadioBrowser.API_URL = API_URL;
    RadioBrowser.RB_PLAYED_KEY = RB_PLAYED_KEY;
    RadioBrowser.COUNTRIES = COUNTRIES;
    RadioBrowser.state = state;

    RadioBrowser.utils = {
        normalizeUrl: normalizeUrl,
        normalizeName: normalizeName,
        escapeHtml: escapeHtml,
        notify: notify
    };

    RadioBrowser.api = {
        call: apiCall,
        savePlayedUrl: saveRadioBrowserPlayedUrl
    };

    console.log('Radio Browser: Core module loaded v3.4.0');
})();
