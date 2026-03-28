/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Recents Module - Recently played stations
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
    // RECENTLY PLAYED
    // ========================================================================

    function loadRecentlyPlayed() {
        $.ajax({
            url: RB.API_URL + '?cmd=recently_played',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success && data.stations && data.stations.length > 0) {
                    renderRecentlyPlayed(data.stations);
                }
            }
        });
    }

    function renderRecentlyPlayed(stations) {
        var container = $('#rb-recently-played');
        var html = [];

        // Reset recentStationData
        state.recentStationData = [];

        stations.forEach(function(s, index) {
            var logoUrl = '';
            if (s.logo === 'local') {
                logoUrl = '/imagesw/radio-logos/thumbs/' + encodeURIComponent(s.name) + '.jpg';
            } else if (s.logo && s.logo.startsWith('/extensions/')) {
                logoUrl = s.logo;
            } else if (s.logo && (s.logo.startsWith('http://') || s.logo.startsWith('https://'))) {
                logoUrl = s.logo;
            } else if (s.logo) {
                logoUrl = '/imagesw/radio-logos/thumbs/' + encodeURIComponent(s.name) + '.jpg';
            }

            var logoHtml = logoUrl ?
                '<img class="rb-logo" src="' + utils.escapeHtml(logoUrl) + '" alt="" onerror="this.src=\'/images/radio-logo.png\'">' :
                '<div class="rb-logo rb-logo-placeholder"><i class="fa-solid fa-sharp fa-radio"></i></div>';

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

            var isFavorite = RB.favorites.isInFavorites(s.url, s.name);
            var addBtnClass = isFavorite ? 'btn rb-add-btn added' : 'btn rb-add-btn';
            var addBtnIcon = isFavorite ? '<i class="fa-solid fa-sharp fa-heart" style="color: #d35400;"></i>' : '<i class="fa-solid fa-sharp fa-heart"></i>';
            var addBtnTitle = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

            html.push(
                '<div class="rb-station-card rb-recent-card" data-station-index="' + storeIndex + '" data-url="' + utils.escapeHtml(s.url) + '" data-name="' + utils.escapeHtml(s.name) + '">' +
                    logoHtml +
                    '<div class="rb-info">' +
                        '<div class="rb-name">' + utils.escapeHtml(s.name) + '</div>' +
                        '<div class="rb-meta">Recently played</div>' +
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

        // Check which station is currently playing
        RB.player.checkCurrentlyPlaying();
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.recents = {
        loadRecentlyPlayed: loadRecentlyPlayed,
        renderRecentlyPlayed: renderRecentlyPlayed
    };

    console.log('Radio Browser: Recents module loaded');
})();
