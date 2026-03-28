/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Player Module - Play/stop station logic
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
    // PLAYBACK FUNCTIONS
    // ========================================================================

    function playStation(card) {
        var stationIndex = parseInt(card.data('station-index'));

        var isRecentCard = card.hasClass('rb-recent-card');
        var stationData = isRecentCard ? state.recentStationData[stationIndex] : state.stationData[stationIndex];

        if (!stationData) {
            utils.notify('Error', 'Station data not found', 'error');
            return;
        }

        var btn = card.find('.rb-play-btn');
        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');

        $.ajax({
            url: RB.API_URL + '?cmd=play',
            type: 'POST',
            data: JSON.stringify(stationData),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 20000,
            success: function(data) {
                if (data.success) {
                    // Mark ALL cards with this URL as playing
                    $('.rb-station-card').removeClass('playing');
                    $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');

                    $('.rb-station-card').each(function() {
                        var cardUrl = $(this).data('url');
                        if (cardUrl && (cardUrl === stationData.url ||
                            cardUrl.replace(/^https?:/, '') === stationData.url.replace(/^https?:/, ''))) {
                            $(this).addClass('playing');
                            $(this).find('.rb-play-btn').addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                        }
                    });

                    state.currentPlaying = stationData.url;

                    // Save URL for playbar icon glow detection
                    RB.api.savePlayedUrl(stationData.url);

                    utils.notify('Playing', stationData.name, 'success');

                    // Refresh recently played
                    RB.recents.loadRecentlyPlayed();
                } else {
                    btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                    utils.notify('Error', data.message || 'Failed to play', 'error');
                }
            },
            error: function() {
                btn.html('<i class="fa-solid fa-sharp fa-play"></i>');
                utils.notify('Error', 'Failed to play station', 'error');
            }
        });
    }

    function stopStation(card, btn) {
        btn.html('<i class="fa-solid fa-sharp fa-spinner fa-spin"></i>');

        $.get('/command/index.php?cmd=stop', function() {
            card.removeClass('playing');
            btn.removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
            state.currentPlaying = null;
            utils.notify('Stopped', 'Playback stopped', 'info');
        }).fail(function() {
            btn.html('<i class="fa-solid fa-sharp fa-stop"></i>');
        });
    }

    function checkCurrentlyPlaying() {
        $.ajax({
            url: RB.API_URL + '?cmd=current_status',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                // Reset all cards
                $('.rb-station-card').removeClass('playing');
                $('.rb-play-btn').removeClass('playing').html('<i class="fa-solid fa-sharp fa-play"></i>');
                state.currentPlaying = null;

                if (data.success && data.is_playing && data.current_url) {
                    $('.rb-station-card').each(function() {
                        var card = $(this);
                        var cardUrl = card.data('url');

                        if (cardUrl && (cardUrl === data.current_url ||
                            cardUrl.replace(/^https?:/, '') === data.current_url.replace(/^https?:/, ''))) {
                            card.addClass('playing');
                            card.find('.rb-play-btn').addClass('playing').html('<i class="fa-solid fa-sharp fa-stop"></i>');
                            state.currentPlaying = data.current_url;
                        }
                    });
                }
            }
        });
    }

    // ========================================================================
    // DOWNLOAD STREAM
    // ========================================================================

    function downloadStreamFromCard(card) {
        var streamUrl = card.attr('data-url');
        var stationName = card.attr('data-name') || card.find('.rb-name').text() || 'radio_stream';

        console.log('Download: URL=' + streamUrl + ', Name=' + stationName);

        if (!streamUrl) {
            utils.notify('Error', 'No stream URL found', 'error');
            return;
        }

        var downloadUrl = RB.API_URL + '?cmd=download_m3u&url=' + encodeURIComponent(streamUrl) + '&name=' + encodeURIComponent(stationName);

        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = downloadUrl;
        document.body.appendChild(iframe);

        setTimeout(function() {
            document.body.removeChild(iframe);
        }, 5000);
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.player = {
        playStation: playStation,
        stopStation: stopStation,
        checkCurrentlyPlaying: checkCurrentlyPlaying,
        downloadStreamFromCard: downloadStreamFromCard
    };

    console.log('Radio Browser: Player module loaded');
})();
