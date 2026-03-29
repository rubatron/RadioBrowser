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
        xhr.open('GET', API_URL + '?action=get_settings', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        data._ts = Date.now();
                        sessionStorage.setItem('rb_settings', JSON.stringify(data));
                        callback(data);
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

        // Find library container
        var container = document.querySelector('#panel-header .dropdown-menu') ||
                        document.querySelector('.viewswitch .dropdown-menu');
        if (!container) return;

        // Already exists?
        if (container.querySelector('.rb-library-entry')) return;

        // Create entry
        var entry = document.createElement('a');
        entry.className = 'btn rb-library-entry';
        entry.href = '/radio-browser.php';
        entry.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em"></i> Radio Browser';
        entry.style.cssText = 'font-size:.92em;opacity:.95;border-color:transparent';

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

        // Already exists?
        if (container.querySelector('.rb-mmenu-entry')) return;

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
     * Uses jQuery Bootstrap event to add tile when modal opens
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

        jQuery(modal).on('show', function() {
            var list = modal.querySelector('#configure ul');
            if (!list) return;

            // Already exists?
            if (list.querySelector('.rb-configure-entry')) return;

            // Get template from existing tile
            var templateLi = list.querySelector('li');
            var liClass = templateLi ? templateLi.className : '';

            // Create tile
            var li = document.createElement('li');
            li.className = (liClass ? liClass + ' ' : '') + 'rb-configure-entry';
            var a = document.createElement('a');
            a.className = 'btn btn-large';
            a.href = '/radio-browser.php';
            a.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i><br>Radio Browser';
            li.appendChild(a);

            list.appendChild(li);
        });
    }

    /**
     * Initialize - run once when DOM is ready
     */
    function init() {
        getSettings(function(settings) {
            injectLibraryMenu(settings);
            injectMMenu(settings);
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
