/**
 * Radio Browser Menu Injection Script (Simplified)
 *
 * Injects Radio Browser entries into moOde menus:
 * - Library dropdown
 * - M Menu (settings)
 * - Configure modal tile
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function() {
    'use strict';

    // Prevent double initialization
    if (window.__rbMenuInjected) return;
    window.__rbMenuInjected = true;

    var API_URL = '/extensions/installed/radio-browser/backend/api.php';

    /**
     * Fetch settings from backend (cached in sessionStorage)
     */
    function getSettings(callback) {
        var cached = sessionStorage.getItem('rb_settings');
        if (cached) {
            try {
                var data = JSON.parse(cached);
                if (data && data._ts && Date.now() - data._ts < 60000) {
                    callback(data);
                    return;
                }
            } catch (e) {}
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', API_URL + '?cmd=get_settings', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        // API returns { success: true, settings: { ... } }
                        var settings = (data && data.settings) ? data.settings : data;
                        settings._ts = Date.now();
                        sessionStorage.setItem('rb_settings', JSON.stringify(settings));
                        callback(settings);
                    } catch (e) {
                        callback({ visibility: {} });
                    }
                } else {
                    callback({ visibility: {} });
                }
            }
        };
        xhr.send();
    }

    /**
     * Add Radio Browser to Library dropdown (once)
     */
    function injectLibraryMenu(settings) {
        var visibility = settings.visibility || {};
        if (visibility.library === false) return;

        // Find library container (viewswitch is the Library dropdown)
        var container = document.querySelector('#viewswitch .dropdown-menu') ||
                        document.querySelector('.viewswitch .dropdown-menu') ||
                        document.querySelector('ul.dropdown-menu.context-menu');
        if (!container) return;

        // Don't inject into Configure modal
        if (container.closest && container.closest('#configure-modal')) return;

        // Already exists? Check for ANY radio-browser link
        if (container.querySelector('a[href*="radio-browser"]')) return;

        // Create entry (button-style to match Library menu)
        var entry = document.createElement('a');
        entry.className = 'btn rb-library-entry';
        entry.href = '/radio-browser.php';
        entry.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em"></i> Radio Browser';

        // Add divider + entry
        var divider = document.createElement('div');
        divider.className = 'rb-library-divider';
        divider.style.cssText = 'border-top:1px solid rgba(128,128,128,.2);margin:6px 0 4px';

        container.appendChild(divider);
        container.appendChild(entry);
    }

    /**
     * Add Radio Browser to M Menu (once)
     */
    function injectMMenu(settings) {
        var visibility = settings.visibility || {};
        if (visibility.m === false) return;

        // Find M menu container
        var container = document.querySelector('ul[aria-labelledby="menu-settings"]') ||
                        document.querySelector('#menu-settings ~ ul.dropdown-menu');
        if (!container) return;

        // Already exists? Check for ANY radio-browser link
        if (container.querySelector('a[href*="radio-browser"]')) return;

        // Create entry
        var li = document.createElement('li');
        li.className = 'rb-mmenu-entry';
        var a = document.createElement('a');
        a.href = '/radio-browser.php';
        a.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em"></i> Radio Browser';
        li.appendChild(a);

        // Create divider
        var divider = document.createElement('li');
        divider.className = 'rb-mmenu-divider divider';

        // Find "Power" entry to insert before it
        var powerEntry = container.querySelector('a[data-toggle$="power-modal"]');
        if (powerEntry) {
            var powerLi = powerEntry.closest('li') || powerEntry.parentNode;
            container.insertBefore(divider, powerLi);
            container.insertBefore(li, powerLi);
        } else {
            container.appendChild(divider);
            container.appendChild(li);
        }
    }

    /**
     * Add Radio Browser tile to Configure modal
     * Uses jQuery Bootstrap events to add tile when modal opens
     */
    function setupConfigureTile(settings) {
        var visibility = settings.visibility || {};
        if (visibility.system === false) return;

        // Wait for jQuery
        if (typeof jQuery === 'undefined') return;

        var modal = document.getElementById('configure-modal');
        if (!modal) return;

        // Only attach once
        if (modal.__rbTileSetup) return;
        modal.__rbTileSetup = true;

        // Add tile when modal is shown (Bootstrap 2 event)
        jQuery(modal).on('show', function() {
            addRadioBrowserTile(modal);
        });
    }

    /**
     * Inject Activity Light CSS if not present
     */
    function injectActivityLightCSS() {
        if (document.getElementById('rb-activity-light-styles')) return;
        var style = document.createElement('style');
        style.id = 'rb-activity-light-styles';
        style.textContent = [
            '/* Radio Browser Activity Light - orange when playing */',
            '#rb-playbar-btn.rb-active i,',
            '#rb-coverview-btn.rb-active i {',
            '  color: #c55a11 !important;',
            '}',
            '#rb-playbar-btn {',
            '  margin-right: 8px;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /**
     * Add Radio Browser icon to playbar (index.php only)
     * Positioned at the very front, before all other buttons
     */
    function injectPlaybar(settings) {
        var visibility = settings.visibility || {};
        if (visibility.playbar === false) return;

        // Inject Activity Light CSS
        injectActivityLightCSS();

        // Find playbar toggles container
        var container = document.getElementById('playbar-toggles');
        if (!container) return;

        // Already exists?
        var existingBtn = container.querySelector('#rb-playbar-btn');
        if (existingBtn) {
            // Update activity light state
            if (visibility.activityglow !== false) {
                existingBtn.classList.add('rb-active');
            } else {
                existingBtn.classList.remove('rb-active');
            }
            return;
        }

        // Create button
        var btn = document.createElement('button');
        btn.id = 'rb-playbar-btn';
        btn.className = 'btn btn-cmd';
        if (visibility.activityglow !== false) {
            btn.classList.add('rb-active');
        }
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.onclick = function() {
            window.location.href = '/radio-browser.php';
        };

        // Insert at the very front (before all other elements)
        if (container.firstChild) {
            container.insertBefore(btn, container.firstChild);
        } else {
            container.appendChild(btn);
        }
    }

    /**
     * Add Radio Browser icon to Coverview (album art panel)
     */
    function injectCoverview(settings) {
        var visibility = settings.visibility || {};
        if (visibility.playbar === false) return; // Use same setting as playbar

        // Find btn-group inside togglebtns
        var togglebtns = document.getElementById('togglebtns');
        if (!togglebtns) return;

        var btnGroup = togglebtns.querySelector('.btn-group');
        if (!btnGroup) return;

        // Already exists?
        if (btnGroup.querySelector('#rb-coverview-btn')) return;

        // Create button
        var btn = document.createElement('button');
        btn.id = 'rb-coverview-btn';
        btn.className = 'btn btn-cmd';
        if (visibility.activityglow !== false) {
            btn.classList.add('rb-active');
        }
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.onclick = function() {
            window.location.href = '/radio-browser.php';
        };

        // Append as last button in the group
        btnGroup.appendChild(btn);
    }

    /**
     * Add Radio Browser tile to the configure modal ul
     */
    function addRadioBrowserTile(modal) {
        var list = modal.querySelector('#configure ul');
        if (!list) return;

        // Already exists? Check for ANY radio-browser link
        if (list.querySelector('a[href*="radio-browser"]')) return;

        // Get template from existing tile
        var templateLi = list.querySelector('li');
        var liClass = templateLi ? templateLi.className : '';

        // Create tile
        var li = document.createElement('li');
        li.className = (liClass ? liClass + ' ' : '') + 'rb-configure-entry';
        var a = document.createElement('a');
        a.className = 'btn btn-large';
        a.href = '/radio-browser.php#settings';
        a.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i><br>Radio Browser';
        li.appendChild(a);

        list.appendChild(li);
    }

    /**
     * Initialize - run once when DOM is ready
     */
    function init() {
        getSettings(function(settings) {
            injectLibraryMenu(settings);
            injectMMenu(settings);
            injectPlaybar(settings);
            injectCoverview(settings);
            setupConfigureTile(settings);
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
