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

    // Prevent double initialization
    if (window.__rbMenuInjectInit) {
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
                    header: true,
                    library: true,
                    m: true,
                    system: false
                }
            };
        })
        .catch(function() {
            // Return defaults on error
            return {
                visibility: {
                    header: true,
                    library: true,
                    m: true,
                    system: false
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

        // Remove existing entries first
        removeExistingLibraryEntries(container);

        if (!showInLibrary) return;

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

        // Remove existing entries first
        removeExistingMMenuEntries(container);

        if (!showInMMenu) return;

        // Check if Radio Browser entry already exists
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
     * Inject Radio Browser into header tabs
     */
    function renderHeaderButton(settings) {
        var visibility = (settings && settings.visibility) || {};
        var showInHeader = visibility.header !== false;

        var tabs = document.getElementById('config-tabs');
        if (!tabs) return;

        var existing = document.getElementById('rb-header-btn');

        if (!showInHeader) {
            if (existing) existing.style.display = 'none';
            return;
        }

        if (existing) {
            existing.style.display = '';
            return;
        }

        // Create header button
        var btn = document.createElement('a');
        btn.id = 'rb-header-btn';
        btn.className = 'btn rb-header-entry';
        btn.href = '/radio-browser.php';
        btn.innerHTML = '<span>Radio</span><i class="fa-solid fa-sharp fa-radio"></i>';
        btn.style.cssText = 'margin-left: 4px;';

        // Insert after per-config-btn if exists
        var marker = document.getElementById('per-config-btn');
        if (marker && marker.parentNode === tabs && marker.nextSibling) {
            tabs.insertBefore(btn, marker.nextSibling);
        } else {
            tabs.appendChild(btn);
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
     * Inject Radio Browser icon into playbar
     */
    function renderPlaybarIcon() {
        var toggles = document.getElementById('playbar-toggles');
        if (!toggles) return;

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

        // Hover effect
        btn.addEventListener('mouseenter', function() {
            this.style.opacity = '1';
            this.style.color = '#c55a11';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.opacity = '0.7';
            this.style.color = 'var(--adapttext)';
        });

        // Insert at the beginning of toggles
        if (toggles.firstChild) {
            toggles.insertBefore(btn, toggles.firstChild);
        } else {
            toggles.appendChild(btn);
        }
    }

    /**
     * Radio logo fallback - replace missing logos with moOde default
     * Handles 404 errors for radio-logos thumbnails
     * 
     * Optimizations:
     * - Cache failed URLs to prevent repeated 404 requests
     * - Use MutationObserver to intercept new img tags before they load
     * - Persist failed URLs in sessionStorage (clears on tab close)
     */
    var FALLBACK_IMAGE = '/images/radio.png';
    var STORAGE_KEY = 'rb_failed_logos';
    var failedUrls = new Set();

    // Restore failed URLs from sessionStorage
    function loadFailedUrls() {
        try {
            var stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                JSON.parse(stored).forEach(function(url) {
                    failedUrls.add(url);
                });
            }
        } catch (e) { /* ignore */ }
    }

    // Save failed URLs to sessionStorage
    function saveFailedUrls() {
        try {
            // Limit to 100 entries to prevent storage bloat
            var urls = Array.from(failedUrls).slice(-100);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
        } catch (e) { /* ignore */ }
    }

    // Normalize URL for comparison (strip query strings, decode)
    function normalizeLogoUrl(src) {
        try {
            var url = new URL(src, window.location.origin);
            return url.origin + url.pathname;
        } catch (e) {
            return src;
        }
    }

    // Check if img should use fallback and apply it
    function applyFallbackIfNeeded(img) {
        var src = img.src || img.getAttribute('src') || '';
        if (src.indexOf('radio-logos') === -1) return false;
        if (src === FALLBACK_IMAGE) return false;

        var normalized = normalizeLogoUrl(src);
        if (failedUrls.has(normalized)) {
            img.src = FALLBACK_IMAGE;
            return true;
        }
        return false;
    }

    function setupRadioLogoFallback() {
        // Load cached failed URLs
        loadFailedUrls();

        // Event delegation for img error events (capture phase)
        document.addEventListener('error', function(e) {
            var img = e.target;
            if (img.tagName !== 'IMG') return;

            var src = img.src || '';
            if (src.indexOf('radio-logos') === -1) return;
            if (src === FALLBACK_IMAGE) return;

            // Cache this URL as failed
            var normalized = normalizeLogoUrl(src);
            if (!failedUrls.has(normalized)) {
                failedUrls.add(normalized);
                saveFailedUrls();
            }

            // Replace with fallback
            img.src = FALLBACK_IMAGE;
        }, true);

        // MutationObserver to intercept new img tags BEFORE they load
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return; // Element nodes only
                    
                    if (node.tagName === 'IMG') {
                        applyFallbackIfNeeded(node);
                    } else if (node.querySelectorAll) {
                        var imgs = node.querySelectorAll('img[src*="radio-logos"]');
                        imgs.forEach(applyFallbackIfNeeded);
                    }
                });
            });
        });

        // Observe playqueue and content areas (not entire body for efficiency)
        var targets = ['cv-playqueue', 'playqueue-list', 'container-playqueue', 'content'];
        targets.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                observer.observe(el, { childList: true, subtree: true });
            }
        });

        // Fallback: observe body if no specific targets found
        if (!document.getElementById('cv-playqueue')) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Handle existing images that may have already failed
        setTimeout(function() {
            var imgs = document.querySelectorAll('img[src*="radio-logos"]');
            imgs.forEach(function(img) {
                if (!img.complete || img.naturalWidth === 0) {
                    applyFallbackIfNeeded(img);
                }
            });
        }, 500);
    }

    /**
     * Main render function - refresh all menu injections
     */
    function renderAll() {
        fetchSettings().then(function(settings) {
            renderLibraryMenu(settings);
            renderMMenu(settings);
            renderHeaderButton(settings);
            renderPlaybarIcon();
        });
    }

    // Debounced version for event handlers (300ms delay)
    var renderAllDebounced = debounce(renderAll, 300);

    /**
     * Initialize and set up observers
     */
    function init() {
        // Initial render (once)
        renderAll();

        // Setup radio logo fallback for missing thumbnails
        setupRadioLogoFallback();

        // Only listen for dropdown toggle clicks - no MutationObserver on body
        document.addEventListener('click', function(e) {
            var toggle = e.target.closest('.dropdown-toggle, #menu-settings, #viewswitch');
            if (toggle) {
                // Debounced render after dropdown opens
                renderAllDebounced();
            }
        });

        // Bootstrap dropdown events (if available)
        document.addEventListener('shown.bs.dropdown', renderAllDebounced);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
