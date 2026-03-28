/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Favorites Module - moOde Radio favorites management
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
    // FAVORITES CHECKING
    // ========================================================================

    function isInFavorites(url, name) {
        if (!url && !name) return false;

        // Check by URL first
        if (url) {
            var normalizedUrl = utils.normalizeUrl(url);
            for (var i = 0; i < state.favorites.length; i++) {
                if (utils.normalizeUrl(state.favorites[i]) === normalizedUrl) {
                    return true;
                }
            }
        }

        // Also check by name
        if (name) {
            var normalizedName = utils.normalizeName(name);
            for (var j = 0; j < state.favoriteNames.length; j++) {
                if (utils.normalizeName(state.favoriteNames[j]) === normalizedName) {
                    return true;
                }
            }
        }

        return false;
    }

    // ========================================================================
    // LOAD FAVORITES
    // ========================================================================

    function loadFavorites(callback) {
        $.ajax({
            url: RB.API_URL + '?cmd=favorites',
            type: 'GET',
            dataType: 'json',
            timeout: 5000,
            success: function(data) {
                if (data.success && data.favorites) {
                    state.favorites = data.favorites.map(function(f) {
                        return typeof f === 'string' ? f : f.url;
                    });
                    state.favoriteNames = data.favorites.map(function(f) {
                        return typeof f === 'object' && f.name ? f.name : '';
                    }).filter(function(n) { return n; });
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

    // ========================================================================
    // ADD/REMOVE FAVORITES
    // ========================================================================

    function addToRadio(card) {
        var stationIndex = parseInt(card.data('station-index'));

        var isRecentCard = card.hasClass('rb-recent-card');
        var stationData = isRecentCard ? state.recentStationData[stationIndex] : state.stationData[stationIndex];

        if (!stationData) {
            utils.notify('Error', 'Station data not found', 'error');
            return;
        }

        var btn = card.find('.rb-add-btn');
        var isAlreadyFavorite = btn.hasClass('added');

        btn.prop('disabled', true);

        if (isAlreadyFavorite) {
            // REMOVE from favorites
            $.ajax({
                url: RB.API_URL + '?cmd=remove',
                type: 'POST',
                data: JSON.stringify({ url: stationData.url }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 10000,
                success: function(data) {
                    btn.prop('disabled', false);
                    if (data.success) {
                        updateFavoriteState(stationData.url, false);
                        utils.notify('Removed', 'Station removed from Favorites', 'success');
                    } else {
                        utils.notify('Error', data.message || 'Could not remove', 'error');
                    }
                },
                error: function() {
                    btn.prop('disabled', false);
                    utils.notify('Error', 'Failed to remove', 'error');
                }
            });
        } else {
            // ADD to favorites
            $.ajax({
                url: RB.API_URL + '?cmd=import',
                type: 'POST',
                data: JSON.stringify(stationData),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 20000,
                success: function(data) {
                    btn.prop('disabled', false);
                    if (data.success) {
                        updateFavoriteState(stationData.url, true, stationData);
                        utils.notify('Added', 'Station added to Favorites', 'success');
                    } else {
                        utils.notify('Info', data.message || 'Could not add', 'info');
                    }
                },
                error: function() {
                    btn.prop('disabled', false);
                    utils.notify('Error', 'Failed to add', 'error');
                }
            });
        }
    }

    function updateFavoriteState(url, isFavorite, stationData) {
        var name = stationData ? stationData.name : null;

        if (isFavorite) {
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

        // Update ALL cards with this URL
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

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.favorites = {
        isInFavorites: isInFavorites,
        loadFavorites: loadFavorites,
        addToRadio: addToRadio,
        updateFavoriteState: updateFavoriteState
    };

    console.log('Radio Browser: Favorites module loaded');
})();
