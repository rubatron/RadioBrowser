/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Playbar Module - Mini playbar with jQuery Knob volume
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.4.0
 */

(function() {
    'use strict';

    var RB = window.RadioBrowser;

    var playbarState = {
        playing: false,
        volume: 50,
        pollInterval: null
    };

    // ========================================================================
    // MINI PLAYBAR CONTROLLER
    // ========================================================================

    function initMiniPlaybar() {
        // Bind controls
        $('#rb-playbar-play').on('click', function() {
            sendMpdCommand(playbarState.playing ? 'pause' : 'play');
        });

        $('#rb-playbar-stop').on('click', function() {
            sendMpdCommand('stop');
        });

        $('#rb-playbar-prev').on('click', function() {
            sendMpdCommand('previous');
        });

        $('#rb-playbar-next').on('click', function() {
            sendMpdCommand('next');
        });

        // Initialize jQuery Knob for volume (moOde already loads this library)
        var volumeTimeout = null;
        if ($.fn.knob) {
            $('#rb-playbar-volume').knob({
                'release': function(v) {
                    clearTimeout(volumeTimeout);
                    volumeTimeout = setTimeout(function() {
                        setMoodeVolume(Math.round(v));
                        $('#rb-vol-level').text(Math.round(v));
                    }, 50);
                },
                'change': function(v) {
                    $('#rb-vol-level').text(Math.round(v));
                }
            });
        }

        // Volume +/- buttons
        $('#rb-volumeup').on('click', function() {
            var current = playbarState.volume || 50;
            var newVol = Math.min(100, current + 5);
            setMoodeVolume(newVol);
            updateVolumeDisplay(newVol);
        });

        $('#rb-volumedn').on('click', function() {
            var current = playbarState.volume || 50;
            var newVol = Math.max(0, current - 5);
            setMoodeVolume(newVol);
            updateVolumeDisplay(newVol);
        });

        // Start polling for playback status
        updatePlaybarStatus();
        playbarState.pollInterval = setInterval(updatePlaybarStatus, 3000);
    }

    function updateVolumeDisplay(vol) {
        $('#rb-vol-level').text(vol);
        if ($.fn.knob) {
            $('#rb-playbar-volume').val(vol).trigger('change');
        }
        playbarState.volume = vol;
    }

    function sendMpdCommand(cmd, arg) {
        $.ajax({
            url: '/command/?cmd=' + cmd + (arg !== undefined ? '&arg=' + arg : ''),
            type: 'GET',
            dataType: 'json',
            timeout: 5000
        }).done(function() {
            setTimeout(updatePlaybarStatus, 200);
        });
    }

    function setMoodeVolume(level) {
        // Use moOde's volume API
        $.ajax({
            url: '/command/?cmd=vol&level=' + encodeURIComponent(level),
            type: 'GET',
            dataType: 'json',
            timeout: 5000
        }).done(function() {
            playbarState.volume = parseInt(level);
        }).fail(function() {
            console.log('Volume set failed, trying alternative endpoint...');
            $.post('/command/vol.php', { level: level });
        });
    }

    function updatePlaybarStatus() {
        $.ajax({
            url: '/engine-mpd.php',
            type: 'POST',
            data: { cmd: 'get_currentsong' },
            dataType: 'json',
            timeout: 5000
        }).done(function(data) {
            if (data) {
                var title = data.title || data.file || 'Not playing';
                var artist = data.artist || data.album || '';
                var coverUrl = data.coverurl || '/images/default-cover-v6.svg';

                // Check if it's a radio station
                if (data.file && data.file.indexOf('http') === 0) {
                    if (data.name) {
                        artist = title;
                        title = data.name;
                    }
                }

                $('#rb-playbar-title').text(title);
                $('#rb-playbar-artist').text(artist);
                $('#rb-playbar-cover-img').attr('src', coverUrl);

                // Update play/pause state
                playbarState.playing = (data.state === 'play');
                var playBtn = $('#rb-playbar-play');
                if (playbarState.playing) {
                    playBtn.addClass('playing');
                    playBtn.find('i').removeClass('fa-play').addClass('fa-pause');
                } else {
                    playBtn.removeClass('playing');
                    playBtn.find('i').removeClass('fa-pause').addClass('fa-play');
                }
            }
        });

        // Get volume and update knob
        $.ajax({
            url: '/command/?cmd=get_vol',
            type: 'GET',
            dataType: 'text',
            timeout: 5000
        }).done(function(vol) {
            var volume = parseInt(vol) || 0;
            if (playbarState.volume !== volume) {
                playbarState.volume = volume;
                updateVolumeDisplay(volume);
            }
        });
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.playbar = {
        init: initMiniPlaybar,
        updateStatus: updatePlaybarStatus,
        setVolume: setMoodeVolume,
        sendCommand: sendMpdCommand,
        state: playbarState
    };

    console.log('Radio Browser: Playbar module loaded');
})();
