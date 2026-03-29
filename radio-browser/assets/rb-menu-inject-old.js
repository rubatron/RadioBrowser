/**
 * Radio Browser Menu Injection Script (Standalone)
 *
 * This script injects Radio Browser menu entries into moOde's UI
 * without requiring ext-mgr. It runs on every page load and adds
 * Radio Browser to the Library dropdown and M Menu based on settings.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function() {
    'use strict';

    // Debug mode controlled by localStorage
    function rbDebug() {
        if (localStorage.getItem('rb_debug_mode') === 'true') {
            var args = ['[RB DEBUG]'].concat(Array.prototype.slice.call(arguments));
            console.log.apply(console, args);
        }
    }

    // Global debug helper - callable from console as rbInspectTile()
    window.rbInspectTile = function() {
        console.log('=== RB TILE INSPECTION ===');
        var modal = document.querySelector('#configure-modal');
        console.log('configure-modal:', modal);
        if (modal) {
            console.log('  modal.classList:', modal.classList.toString());
            console.log('  modal.style.display:', modal.style.display);
            var computed = window.getComputedStyle(modal);
            console.log('  computed display:', computed.display);
            console.log('  computed visibility:', computed.visibility);
        }
        var list = document.querySelector('#configure-modal #configure ul');
        console.log('configure ul:', list);
        if (list) {
            console.log('  children count:', list.children.length);
            var tile = list.querySelector('.rb-configure-entry');
            console.log('rb-configure-entry tile:', tile);
            if (tile) {
                var tileComputed = window.getComputedStyle(tile);
                console.log('  tile.outerHTML:', tile.outerHTML);
                console.log('  tile display:', tileComputed.display);
                console.log('  tile visibility:', tileComputed.visibility);
                console.log('  tile width:', tileComputed.width);
                console.log('  tile height:', tileComputed.height);
                console.log('  tile position:', tileComputed.position);
                console.log('  tile offsetParent:', tile.offsetParent);
                console.log('  tile getBoundingClientRect:', tile.getBoundingClientRect());
            }
            console.log('All list children:');
            for (var i = 0; i < list.children.length; i++) {
                var child = list.children[i];
                console.log('  [' + i + ']', child.className, '|', child.textContent.trim().substring(0, 20));
            }
        }
        return 'Done - check output above';
    };

    // Prevent double initialization
    if (window.__rbMenuInjectInit) {
        rbDebug('Script already initialized, skipping');
        return;
    }
    window.__rbMenuInjectInit = true;

    var SETTINGS_CACHE = null;
    var SETTINGS_CACHE_AT = 0;
    var SETTINGS_CACHE_TTL_MS = 30000; // Cache settings for 30s
    var API_URL = '/extensions/installed/radio-browser/backend/api.php';

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
        .then(function(res) {
            return res.json();
        })
        .then(function(data) {
            if (data && data.success && data.settings) {
                SETTINGS_CACHE = data.settings;
                SETTINGS_CACHE_AT = Date.now();
                return data.settings;
            }
            // Return defaults if API fails
            return {
                visibility: {
                    library: true,
                    m: true,
                    system: true,
                    playbar: true,
                    activityglow: true
                }
            };
        })
        .catch(function() {
            // Return defaults on error
            return {
                visibility: {
                    library: true,
                    m: true,
                    system: true,
                    playbar: true,
                    activityglow: true
                }
            };
        });
    }

    /**
     * Find the Library dropdown menu container
     */
    function findLibraryMenuContainer() {
        return document.querySelector('#viewswitch .dropdown-menu, .viewswitch .dropdown-menu, ul.dropdown-menu.context-menu');
    }

    /**
     * Remove existing Radio Browser entries from Library menu
     */
    function removeExistingLibraryEntries(container) {
        if (!container) return;
        var existing = container.querySelectorAll('.rb-library-divider, .rb-library-entry, .rb-library-header');
        existing.forEach(function(el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }

    /**
     * Inject Radio Browser into Library dropdown
     */
    function renderLibraryMenu(settings) {
        var container = findLibraryMenuContainer();
        if (!container) return;

        var visibility = (settings && settings.visibility) || {};
        var showInLibrary = visibility.library !== false;

        // Check if our entry already exists
        var existingEntry = container.querySelector('.rb-library-entry');

        if (!showInLibrary) {
            // Remove if exists and shouldn't show
            if (existingEntry) {
                removeExistingLibraryEntries(container);
            }
            return;
        }

        // Already exists - don't re-add (prevents flickering)
        if (existingEntry) {
            return;
        }

        // Check if Radio Browser entry already exists (native)
        var existingLink = container.querySelector('a[href*="radio-browser"]');
        if (existingLink) return;

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

        // Highlight if current page
        if (normalizePath(window.location.pathname) === '/radio-browser.php') {
            entry.classList.add('active');
        }

        container.appendChild(entry);
    }

    /**
     * Find the M Menu (Settings gear) container
     */
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

    /**
     * Remove existing Radio Browser entries from M Menu
     */
    function removeExistingMMenuEntries(container) {
        if (!container) return;
        var existing = container.querySelectorAll('.rb-mmenu-divider, .rb-mmenu-entry, .rb-mmenu-header');
        existing.forEach(function(el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
    }

    /**
     * Inject Radio Browser into M Menu
     */
    function renderMMenu(settings) {
        var container = findMMenuContainer();
        if (!container) return;

        var visibility = (settings && settings.visibility) || {};
        var showInMMenu = visibility.m !== false;

        // Check if our entry already exists
        var existingEntry = container.querySelector('.rb-mmenu-entry');

        if (!showInMMenu) {
            // Remove if exists and shouldn't show
            if (existingEntry) {
                removeExistingMMenuEntries(container);
            }
            return;
        }

        // Already exists - don't re-add (prevents flickering)
        if (existingEntry) {
            return;
        }

        // Check if Radio Browser entry already exists (native)
        var existingLink = container.querySelector('a[href*="radio-browser"]');
        if (existingLink) return;

        // Determine if using list items (ul) or direct links
        var useListItem = container.tagName.toLowerCase() === 'ul';

        // Find a good insertion point (before the last items like "About", "Disconnect")
        var insertBefore = null;
        var lastItems = container.querySelectorAll('li:last-child, a:last-child');
        if (lastItems.length > 0) {
            insertBefore = lastItems[lastItems.length - 1];
        }

        // Add divider
        var divider = document.createElement(useListItem ? 'li' : 'div');
        divider.className = 'rb-mmenu-divider divider';
        divider.setAttribute('aria-hidden', 'true');
        if (!useListItem) {
            divider.style.cssText = 'border-top: 1px solid rgba(128,128,128,.25); margin: 4px 0;';
        }

        // Add Radio Browser entry
        var entry;
        if (useListItem) {
            entry = document.createElement('li');
            entry.className = 'rb-mmenu-entry';
            var a = document.createElement('a');
            a.href = '/radio-browser.php';
            a.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em;"></i> Radio Browser';
            entry.appendChild(a);
        } else {
            entry = document.createElement('a');
            entry.className = 'btn rb-mmenu-entry';
            entry.href = '/radio-browser.php';
            entry.style.cssText = 'display: block; padding: 8px 12px; text-decoration: none; color: inherit;';
            entry.innerHTML = '<i class="fa-solid fa-sharp fa-radio" style="margin-right:.5em;"></i> Radio Browser';
        }

        // Insert before last items or append
        if (insertBefore && insertBefore.parentNode === container) {
            container.insertBefore(divider, insertBefore);
            container.insertBefore(entry, insertBefore);
        } else {
            container.appendChild(divider);
            container.appendChild(entry);
        }
    }

    /**
     * Debounce helper - prevents excessive calls
     */
    var debounceTimer = null;
    function debounce(fn, delay) {
        return function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fn, delay);
        };
    }

    /**
     * Check if current moOde playback is from Radio Browser
     */
    function isPlayingFromRadioBrowser() {
        try {
            var rbUrl = localStorage.getItem('rb_playing_url');
            if (!rbUrl) return false;

            // Check moOde's current state via global UI object
            if (typeof UI !== 'undefined' && UI.currentFile) {
                // Normalize URLs for comparison (strip protocol)
                var currentFile = UI.currentFile.replace(/^https?:/, '');
                var storedUrl = rbUrl.replace(/^https?:/, '');
                return currentFile === storedUrl || currentFile.indexOf(storedUrl) !== -1;
            }

            // Fallback: check MPD state
            if (typeof MPD !== 'undefined' && MPD.json && MPD.json.file) {
                var mpdFile = MPD.json.file.replace(/^https?:/, '');
                var storedUrl2 = rbUrl.replace(/^https?:/, '');
                return mpdFile === storedUrl2 || mpdFile.indexOf(storedUrl2) !== -1;
            }
        } catch (e) {}
        return false;
    }

    /**
     * Update playbar icon active state
     */
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

    /**
     * Inject Radio Browser icon into moOde's playbar
     */
    function renderPlaybarIcon(settings) {
        var toggles = document.getElementById('playbar-toggles');
        if (!toggles) return;

        // Check visibility setting
        var visible = settings && settings.visibility && settings.visibility.playbar !== false;
        var existing = document.getElementById('rb-playbar-btn');
        if (!visible) {
            if (existing) existing.remove();
            return;
        }

        // Check if already exists
        if (document.getElementById('rb-playbar-btn')) return;

        // Create Radio Browser button
        var btn = document.createElement('a');
        btn.id = 'rb-playbar-btn';
        btn.href = '/radio-browser.php';
        btn.className = 'btn';
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.title = 'Radio Browser';
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.style.cssText = 'color: var(--adapttext); opacity: 0.7; transition: opacity 0.2s;';

        // Hover effect (only when not active)
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

        // Insert at the beginning of toggles
        if (toggles.firstChild) {
            toggles.insertBefore(btn, toggles.firstChild);
        } else {
            toggles.appendChild(btn);
        }

        // Initial state check
        updatePlaybarIconState();
    }

    /**
     * Inject Radio Browser icon into coverart view button group
     */
    function renderCoverartIcon(settings) {
        var btnGroup = document.querySelector('#playbtns .btn-group, div.btn-group');
        if (!btnGroup) return;

        // Check visibility setting (reuse playbar setting)
        var visible = settings && settings.visibility && settings.visibility.playbar !== false;
        var existing = document.getElementById('rb-coverart-btn');
        if (!visible) {
            if (existing) existing.remove();
            return;
        }

        // Check if already exists
        if (document.getElementById('rb-coverart-btn')) {
            // Update state only
            updateCoverartIconState();
            return;
        }

        // Create Radio Browser button matching moOde's style
        var btn = document.createElement('button');
        btn.id = 'rb-coverart-btn';
        btn.className = 'btn btn-cmd';
        btn.setAttribute('aria-label', 'Radio Browser');
        btn.title = 'Radio Browser';
        btn.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i>';
        btn.style.cssText = 'opacity: 0.7; transition: opacity 0.2s, color 0.2s;';

        // Click handler - navigate to Radio Browser
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '/radio-browser.php';
        });

        // Hover effect
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

        // Insert at end of button group
        btnGroup.appendChild(btn);

        // Initial state check
        updateCoverartIconState();
    }

    /**
     * Update coverart icon active state
     */
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

    /**
     * Find the Configure modal tile list
     */
    function findConfigureTileList() {
        var list = document.querySelector('#configure-modal #configure ul');
        rbDebug('findConfigureTileList:', list ? 'FOUND' : 'NOT FOUND', list);
        return list;
    }

    /**
     * Remove existing Radio Browser tiles from Configure modal
     */
    function removeExistingConfigureTile(list) {
        if (!list) return;
        var existing = list.querySelectorAll('.rb-configure-entry');
        rbDebug('removeExistingConfigureTile: found', existing.length, 'existing entries');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i] && existing[i].parentNode) {
                existing[i].parentNode.removeChild(existing[i]);
            }
        }
    }

    /**
     * Inject Radio Browser tile into Configure modal
     */
    function renderConfigureTile(settings) {
        rbDebug('renderConfigureTile called, settings:', settings);
        var list = findConfigureTileList();
        if (!list) {
            rbDebug('renderConfigureTile: NO LIST FOUND');
            return;
        }

        var visibility = (settings && settings.visibility) || {};
        var showTile = !!(visibility && visibility.system);
        rbDebug('renderConfigureTile: visibility =', visibility, 'showTile =', showTile);

        // Check if tile already exists and visibility matches
        var existingTile = list.querySelector('li.rb-configure-entry');
        rbDebug('renderConfigureTile: existingTile =', existingTile);
        if (existingTile && showTile) {
            // Tile exists and should be shown - nothing to do
            rbDebug('renderConfigureTile: tile exists and showTile=true, skipping');
            return;
        }
        if (!existingTile && !showTile) {
            // Tile doesn't exist and shouldn't be shown - nothing to do
            rbDebug('renderConfigureTile: no tile and showTile=false, skipping');
            return;
        }

        // Remove existing tile if present
        removeExistingConfigureTile(list);

        // Only add if visibility.system is truthy
        if (!showTile) {
            rbDebug('renderConfigureTile: showTile=false after remove, returning');
            return;
        }

        // Inherit class from existing moOde tile (like ext-mgr does)
        var templateLi = list.querySelector('li');
        var inheritedClass = (templateLi && typeof templateLi.className === 'string') ? templateLi.className : '';
        rbDebug('renderConfigureTile: templateLi =', templateLi, 'inheritedClass =', inheritedClass);

        // Create tile entry (copy moOde's structure)
        var li = document.createElement('li');
        li.className = (inheritedClass ? inheritedClass + ' ' : '') + 'rb-configure-entry';

        var link = document.createElement('a');
        link.className = 'btn btn-large';
        link.href = '/radio-browser.php';
        link.setAttribute('data-rb-entry', 'radio-browser');
        link.innerHTML = '<i class="fa-solid fa-sharp fa-radio"></i><br>Radio Browser';
        link.title = 'Open Radio Browser';

        li.appendChild(link);
        list.appendChild(li);
        rbDebug('renderConfigureTile: TILE ADDED! className =', li.className, 'list.children.length =', list.children.length);

        // Debug: detailed tile inspection
        var liStyles = window.getComputedStyle(li);
        var linkStyles = window.getComputedStyle(link);
        rbDebug('renderConfigureTile: li.display =', liStyles.display, 'li.visibility =', liStyles.visibility);
        rbDebug('renderConfigureTile: li.width =', liStyles.width, 'li.height =', liStyles.height);
        rbDebug('renderConfigureTile: link.display =', linkStyles.display, 'link.visibility =', linkStyles.visibility);
        rbDebug('renderConfigureTile: li.offsetParent =', li.offsetParent);
        rbDebug('renderConfigureTile: li.outerHTML =', li.outerHTML);

        // Debug: check parent visibility
        var modal = document.querySelector('#configure-modal');
        if (modal) {
            var modalDisplay = window.getComputedStyle(modal).display;
            var modalVisibility = window.getComputedStyle(modal).visibility;
            rbDebug('renderConfigureTile: modal display =', modalDisplay, 'visibility =', modalVisibility);
        }
    }

    /**
     * Main render function - refresh all menu injections
     */
    function renderAll() {
        rbDebug('renderAll() called');
        fetchSettings().then(function(settings) {
            rbDebug('renderAll: fetchSettings returned, calling render functions');
            renderLibraryMenu(settings);
            renderMMenu(settings);
            renderPlaybarIcon(settings);
            renderCoverartIcon(settings);
            renderConfigureTile(settings);
        });
    }

    // Debounced version for event handlers (120ms delay, like ext-mgr)
    var renderAllDebounced = debounce(renderAll, 120);

    /**
     * MutationObserver to catch modal opens only
     * Avoids flickering by ignoring our own changes and only watching modals
     */
    var isRendering = false;

    function observeDOM() {
        if (!window.MutationObserver) {
            rbDebug('observeDOM: MutationObserver NOT available!');
            return;
        }

        // Only observe modal-related changes, not entire body
        var observer = new MutationObserver(function(mutations) {
            // Skip if we're already rendering (prevents feedback loop)
            if (isRendering) {
                return;
            }

            // Check if any mutation is modal-related (class or style change on modal)
            var modalChanged = mutations.some(function(mutation) {
                var target = mutation.target;
                // Check if mutation is on a modal or modal parent
                if (target.classList && (
                    target.classList.contains('modal') ||
                    target.id === 'configure-modal' ||
                    target.id === 'library-panel' ||
                    target.id === 'm-menu'
                )) {
                    return true;
                }
                // Check for class changes that indicate modal show/hide
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    return true;
                }
                return false;
            });

            if (modalChanged) {
                rbDebug('observeDOM: modal-related change detected');
                isRendering = true;
                fetchSettings().then(function(settings) {
                    renderLibraryMenu(settings);
                    renderMMenu(settings);
                    renderConfigureTile(settings);
                    // Reset flag after a short delay to allow DOM to settle
                    setTimeout(function() { isRendering = false; }, 50);
                }).catch(function() {
                    isRendering = false;
                });
            }
        });

        // Watch for attribute changes on modals specifically
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        rbDebug('observeDOM: MutationObserver attached (modal-focused)');
    }

    /**
     * Debug: inspect configure modal when it opens
     */
    function setupModalDebug() {
        var modal = document.querySelector('#configure-modal');
        if (!modal) {
            rbDebug('setupModalDebug: configure-modal not found');
            return;
        }

        // Listen for Bootstrap modal show event
        if (typeof jQuery !== 'undefined') {
            jQuery(modal).on('shown', function() {
                rbDebug('=== MODAL SHOWN EVENT ===');
                var list = modal.querySelector('#configure ul');
                if (list) {
                    rbDebug('Modal list children:', list.children.length);
                    var tile = list.querySelector('.rb-configure-entry');
                    if (tile) {
                        var tileStyles = window.getComputedStyle(tile);
                        rbDebug('TILE FOUND in open modal!');
                        rbDebug('  display:', tileStyles.display);
                        rbDebug('  visibility:', tileStyles.visibility);
                        rbDebug('  width:', tileStyles.width);
                        rbDebug('  height:', tileStyles.height);
                        rbDebug('  opacity:', tileStyles.opacity);
                        rbDebug('  position:', tileStyles.position);
                        rbDebug('  outerHTML:', tile.outerHTML);
                    } else {
                        rbDebug('TILE NOT FOUND in open modal! Listing all children:');
                        for (var i = 0; i < list.children.length; i++) {
                            rbDebug('  child', i, ':', list.children[i].className, list.children[i].textContent.substring(0, 30));
                        }
                    }
                } else {
                    rbDebug('Modal list (#configure ul) not found!');
                }
            });
            rbDebug('setupModalDebug: jQuery shown listener attached');
        } else {
            rbDebug('setupModalDebug: jQuery not available');
        }
    }

    /**
     * Initialize and set up observers
     */
    function init() {
        rbDebug('init() called, page:', window.location.pathname);
        // Initial render (once)
        renderAll();

        // Use MutationObserver for reliable DOM change detection
        // This catches modal opens regardless of Bootstrap version
        observeDOM();
        rbDebug('MutationObserver started');

        // Setup modal debug listener
        setupModalDebug();

        // Periodic check for playbar/coverart icon active state (every 2 seconds)
        setInterval(function() {
            updatePlaybarIconState();
            updateCoverartIconState();
        }, 2000);
    }

    // Run when DOM is ready
    rbDebug('Script loaded, readyState:', document.readyState, 'debug_mode:', localStorage.getItem('rb_debug_mode'));
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
