/**
 * Radio Browser Menu Injection Script (Standalone)
 *
 * This script injects Radio Browser menu entries into moOde's UI
 * without requiring ext-mgr. Uses signature caching to prevent flicker.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function() {
    'use strict';

    // Prevent double initialization
    if (window.__rbMenuInjectInit) {
        return;
    }
    window.__rbMenuInjectInit = true;

    // Settings cache
    var SETTINGS_CACHE = null;
    var SETTINGS_CACHE_AT = 0;
    var SETTINGS_CACHE_TTL_MS = 30000;
    var API_URL = '/extensions/installed/radio-browser/backend/api.php';

    // Signature caches to prevent flicker (like ext-mgr)
    var LAST_LIBRARY_SIG = '';
    var LAST_MMENU_SIG = '';
    var LAST_CONFIGURE_SIG = '';
    var LAST_PLAYBAR_SIG = '';

    /**
     * Escape HTML to prevent XSS
     */
    function esc(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Normalize URL path for comparison
     */
    function normalizePath(url) {
        try {
            return new URL(url, window.location.origin).pathname;
        } catch (e) {
            return String(url || '');
        }
    }

    /**
     * Fetch visibility settings from Radio Browser API
     */
    function fetchSettings() {
        var now = Date.now();
        if (SETTINGS_CACHE && (now - SETTINGS_CACHE_AT) < SETTINGS_CACHE_TTL_MS) {
            return Promise.resolve(SETTINGS_CACHE);
        }

        return fetch(API_URL + '?cmd=get_settings', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.success && data.settings) {
                SETTINGS_CACHE = data.settings;
                SETTINGS_CACHE_AT = Date.now();
                return data.settings;
            }
            return defaultSettings();
        })
        .catch(function() { return defaultSettings(); });
    }

    function defaultSettings() {
        return {
            visibility: {
                library: true,
                m: true,
                system: true,
                playbar: true,
                activityglow: true
            }
        };
    }

    // =========================================================================
    // LIBRARY MENU
    // =========================================================================

    function findLibraryMenuContainer() {
        return document.querySelector('#viewswitch .dropdown-menu, .viewswitch .dropdown-menu, ul.dropdown-menu.context-menu');
    }

    function removeExistingLibraryEntries(container) {
        if (!container) return;
        var existing = container.querySelectorAll('.rb-library-divider, .rb-library-entry, .rb-library-header');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i] && existing[i].parentNode) {
                existing[i].parentNode.removeChild(existing[i]);
            }
        }
    }

    function renderLibraryMenu(settings) {
        var container = findLibraryMenuContainer();
        if (!container) return;

        var visibility = (settings && settings.visibility) || {};
        var show = visibility.library !== false;
        var sig = show ? 'show' : 'hide';

        // Only update if changed
        if (sig === LAST_LIBRARY_SIG) return;
        LAST_LIBRARY_SIG = sig;

        removeExistingLibraryEntries(container);
        if (!show) return;

        // Check if native entry already exists
        if (container.querySelector('a[href*="radio-browser"]:not(.rb-library-entry)')) return;

        // Add divider
        var divider = document.createElement('div');
        divider.className = 'rb-library-divider';
        divider.setAttribute('aria-hidden', 'true');
        divider.style.cssText = 'border-top: 1px solid rgba(128,128,128,.2); margin: 6px 0 4px;';
        container.appendChild(divider);

        // Add header
        var header = document.createElement('div');
        header.className = 'rb-library-header';
        header.style.cssText = 'font-size: 0.78em; opacity: 0.72; padding: 4px 12px 2px;';
        header.textContent = 'Extensions';
        container.appendChild(header);

        // Add Radio Browser entry
        var entry = document.createElement('a');
        entry.className = 'btn rb-library-entry';
        entry.setAttribute('aria-label', 'Radio Browser');
        entry.href = '/radio-browser.php';
        entry.style.cssText = 'font-size: 0.92em; opacity: 0.95; border-color: transparent;';
        entry.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em;"></i> Radio Browser';

        if (normalizePath(window.location.pathname) === '/radio-browser.php') {
            entry.classList.add('active');
        }

        container.appendChild(entry);
    }

    // =========================================================================
    // M MENU (Settings gear)
    // =========================================================================

    function findMMenuContainer() {
        var selectors = [
            'ul[aria-labelledby="menu-settings"]',
            '#menu-settings ~ ul.dropdown-menu',
            '#menu-settings ~ ul',
            '.dropdown-menu[aria-labelledby="menu-settings"]'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var hit = document.querySelector(selectors[i]);
            if (hit) return hit;
        }
        return null;
    }

    function removeExistingMMenuEntries(container) {
        if (!container) return;
        var existing = container.querySelectorAll('.rb-mmenu-divider, .rb-mmenu-entry');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i] && existing[i].parentNode) {
                existing[i].parentNode.removeChild(existing[i]);
            }
        }
    }

    function renderMMenu(settings) {
        var container = findMMenuContainer();
        if (!container) return;

        // Guard: don't render inside configure modal
        if (container.closest && container.closest('#configure-modal')) return;

        var visibility = (settings && settings.visibility) || {};
        var show = visibility.m !== false;
        var sig = show ? 'show' : 'hide';

        // Only update if changed
        if (sig === LAST_MMENU_SIG) return;
        LAST_MMENU_SIG = sig;

        removeExistingMMenuEntries(container);
        if (!show) return;

        // Check if native entry already exists
        if (container.querySelector('a[href*="radio-browser"]:not(.rb-mmenu-entry)')) return;

        var useListItem = container.tagName === 'UL';

        // Add divider
        var divider = document.createElement(useListItem ? 'li' : 'div');
        divider.className = 'rb-mmenu-divider';
        if (useListItem) {
            divider.style.cssText = 'list-style: none; border-top: 1px solid rgba(128,128,128,.25); margin: 6px 0; padding: 0;';
        } else {
            divider.style.cssText = 'border-top: 1px solid rgba(128,128,128,.25); margin: 6px 0;';
        }

        // Add Radio Browser entry
        var entry;
        if (useListItem) {
            entry = document.createElement('li');
            entry.className = 'rb-mmenu-entry';
            entry.style.listStyle = 'none';
            var a = document.createElement('a');
            a.href = '/radio-browser.php';
            a.style.cssText = 'display: block; padding: 8px 12px; text-decoration: none; color: inherit;';
            a.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em;"></i> Radio Browser';
            entry.appendChild(a);
        } else {
            entry = document.createElement('a');
            entry.className = 'btn rb-mmenu-entry';
            entry.href = '/radio-browser.php';
            entry.style.cssText = 'display: block; padding: 8px 12px; text-decoration: none; color: inherit;';
            entry.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em;"></i> Radio Browser';
        }

        container.appendChild(divider);
        container.appendChild(entry);
    }

    // =========================================================================
    // PLAYBAR ICON
    // =========================================================================

    function isPlayingFromRadioBrowser() {
        try {
            var rbUrl = localStorage.getItem('rb_playing_url');
            if (!rbUrl) return false;
            if (typeof UI !== 'undefined' && UI.currentFile) {
                var currentFile = UI.currentFile.replace(/^https?:/, '');
                var storedUrl = rbUrl.replace(/^https?:/, '');
                return currentFile === storedUrl || currentFile.indexOf(storedUrl) !== -1;
            }
            if (typeof MPD !== 'undefined' && MPD.json && MPD.json.file) {
                var mpdFile = MPD.json.file.replace(/^https?:/, '');
                var storedUrl2 = rbUrl.replace(/^https?:/, '');
                return mpdFile === storedUrl2 || mpdFile.indexOf(storedUrl2) !== -1;
            }
        } catch (e) {}
        return false;
    }

    function updatePlaybarIconState() {
        var btn = document.getElementById('rb-playbar-btn');
        if (!btn) return;

        var isActive = isPlayingFromRadioBrowser();
        var showGlow = SETTINGS_CACHE && SETTINGS_CACHE.visibility && SETTINGS_CACHE.visibility.activityglow !== false;

        if (isActive && showGlow) {
            btn.classList.add('rb-active');
            btn.style.color = '#c55a11';
            btn.style.opacity = '1';
            btn.style.textShadow = '0 0 8px rgba(197, 90, 17, 0.6)';
        } else {
            btn.classList.remove('rb-active');
            btn.style.color = 'var(--adapttext)';
            btn.style.opacity = '0.7';
            btn.style.textShadow = 'none';
        }
    }

    function renderPlaybarIcon(settings) {
        var toggles = document.getElementById('playbar-toggles');
        if (!toggles) return;

        var visible = settings && settings.visibility && settings.visibility.playbar !== false;
        var sig = visible ? 'show' : 'hide';

        if (sig === LAST_PLAYBAR_SIG) return;

        var existing = document.getElementById('rb-playbar-btn');
        if (!visible) {
            if (existing) existing.remove();
            LAST_PLAYBAR_SIG = sig;
            return;
        }

        if (existing) {
            LAST_PLAYBAR_SIG = sig;
            return;
        }

        LAST_PLAYBAR_SIG = sig;

        var btn = document.createElement('a');
        btn.id = 'rb-playbar-btn';
        btn.href = '/radio-browser.php';
        btn.className = 'btn';
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.title = 'Radio Browser';
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.style.cssText = 'color: var(--adapttext); opacity: 0.7; transition: opacity 0.2s;';

        btn.addEventListener('mouseenter', function() {
            this.style.opacity = '1';
            this.style.color = '#c55a11';
        });
        btn.addEventListener('mouseleave', function() {
            if (!this.classList.contains('rb-active')) {
                this.style.opacity = '0.7';
                this.style.color = 'var(--adapttext)';
            }
        });

        if (toggles.firstChild) {
            toggles.insertBefore(btn, toggles.firstChild);
        } else {
            toggles.appendChild(btn);
        }

        updatePlaybarIconState();
    }

    // =========================================================================
    // COVERART ICON
    // =========================================================================

    function updateCoverartIconState() {
        var btn = document.getElementById('rb-coverart-btn');
        if (!btn) return;

        var isActive = isPlayingFromRadioBrowser();
        var showGlow = SETTINGS_CACHE && SETTINGS_CACHE.visibility && SETTINGS_CACHE.visibility.activityglow !== false;

        if (isActive && showGlow) {
            btn.classList.add('rb-active');
            btn.style.color = '#c55a11';
            btn.style.opacity = '1';
            btn.style.textShadow = '0 0 8px rgba(197, 90, 17, 0.6)';
        } else {
            btn.classList.remove('rb-active');
            btn.style.color = '';
            btn.style.opacity = '0.7';
            btn.style.textShadow = 'none';
        }
    }

    function renderCoverartIcon(settings) {
        var btnGroup = document.querySelector('#playbtns .btn-group, div.btn-group');
        if (!btnGroup) return;

        var visible = settings && settings.visibility && settings.visibility.playbar !== false;
        var existing = document.getElementById('rb-coverart-btn');

        if (!visible) {
            if (existing) existing.remove();
            return;
        }

        if (existing) {
            updateCoverartIconState();
            return;
        }

        var btn = document.createElement('button');
        btn.id = 'rb-coverart-btn';
        btn.className = 'btn btn-cmd';
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.title = 'Radio Browser';
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.style.cssText = 'opacity: 0.7; transition: opacity 0.2s, color 0.2s;';

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/radio-browser.php';
        });
        btn.addEventListener('mouseenter', function() {
            this.style.opacity = '1';
            this.style.color = '#c55a11';
        });
        btn.addEventListener('mouseleave', function() {
            if (!this.classList.contains('rb-active')) {
                this.style.opacity = '0.7';
                this.style.color = '';
            }
        });

        btnGroup.appendChild(btn);
        updateCoverartIconState();
    }

    // =========================================================================
    // CONFIGURE MODAL TILE
    // =========================================================================

    function findConfigureTileList() {
        return document.querySelector('#configure-modal #configure ul');
    }

    function removeExistingConfigureTile(list) {
        if (!list) return;
        var existing = list.querySelectorAll('.rb-configure-entry');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i] && existing[i].parentNode) {
                existing[i].parentNode.removeChild(existing[i]);
            }
        }
    }

    function renderConfigureTile(settings) {
        var list = findConfigureTileList();
        if (!list) return;

        var visibility = (settings && settings.visibility) || {};
        var show = visibility.system === true;
        var sig = show ? 'show' : 'hide';

        // Only update if changed
        if (sig === LAST_CONFIGURE_SIG) return;
        LAST_CONFIGURE_SIG = sig;

        removeExistingConfigureTile(list);
        if (!show) return;

        var li = document.createElement('li');
        li.className = 'rb-configure-entry';

        var link = document.createElement('a');
        link.className = 'btn btn-large';
        link.href = '/radio-browser.php';
        link.setAttribute('data-rb-entry', 'radio-browser');
        link.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i><br>Radio Browser';
        link.title = 'Open Radio Browser';

        li.appendChild(link);
        list.appendChild(li);
    }

    // =========================================================================
    // MAIN RENDER & OBSERVER
    // =========================================================================

    function renderAll() {
        fetchSettings().then(function(settings) {
            renderLibraryMenu(settings);
            renderMMenu(settings);
            renderPlaybarIcon(settings);
            renderCoverartIcon(settings);
            renderConfigureTile(settings);
        });
    }

    function observeDOM() {
        if (!window.MutationObserver) return;

        var timer = null;
        var observer = new MutationObserver(function() {
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(function() {
                fetchSettings().then(function(settings) {
                    renderLibraryMenu(settings);
                    renderMMenu(settings);
                    renderConfigureTile(settings);
                });
            }, 120);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        renderAll();
        observeDOM();

        // Periodic state check for playbar/coverart icons
        setInterval(function() {
            updatePlaybarIconState();
            updateCoverartIconState();
        }, 2000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
