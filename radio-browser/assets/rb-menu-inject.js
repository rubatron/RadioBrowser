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
     * Storage key for Radio Browser played URLs
     */
    var RB_PLAYED_KEY = 'rb_played_urls';
    var rbPlayedUrls = [];

    /**
     * Load Radio Browser played URLs from localStorage
     */
    function loadRbPlayedUrls() {
        try {
            var stored = localStorage.getItem(RB_PLAYED_KEY);
            if (stored) {
                rbPlayedUrls = JSON.parse(stored);
                // Keep only last 100 URLs to prevent unlimited growth
                if (rbPlayedUrls.length > 100) {
                    rbPlayedUrls = rbPlayedUrls.slice(-100);
                }
            }
        } catch (e) {
            rbPlayedUrls = [];
        }
    }

    /**
     * Check if a URL was played via Radio Browser
     */
    function isRadioBrowserStream(url) {
        if (!url) return false;
        var normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
        for (var i = 0; i < rbPlayedUrls.length; i++) {
            var stored = rbPlayedUrls[i].toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
            if (stored === normalizedUrl) {
                return true;
            }
        }
        return false;
    }

    /**
     * Update glow state on playbar icon based on current stream
     */
    function updatePlaybarGlow() {
        var btn = document.getElementById('rb-playbar-btn');
        if (!btn) return;

        // Fetch current song via moOde API
        fetch('/engine-mpd.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'cmd=get_currentsong'
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.file && data.file.indexOf('http') === 0) {
                // It's a stream - check if from Radio Browser
                if (isRadioBrowserStream(data.file)) {
                    btn.classList.add('rb-active');
                    // Remove inline styles to let CSS handle it
                    btn.style.color = '';
                    btn.style.opacity = '';
                } else {
                    btn.classList.remove('rb-active');
                }
            } else {
                // Not a stream
                btn.classList.remove('rb-active');
            }
        })
        .catch(function() {
            btn.classList.remove('rb-active');
        });
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

        // Initial style (will be overridden by CSS when .rb-active)
        btn.style.cssText = 'color: var(--adapttext); opacity: 0.7; transition: all 0.3s ease;';

        // Hover effect (only when not active)
        btn.addEventListener('mouseenter', function() {
            if (!this.classList.contains('rb-active')) {
                this.style.opacity = '1';
                this.style.color = '#c55a11';
            }
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

        // Initial glow check
        updatePlaybarGlow();
    }

    /**
     * Radio logo fallback - replace missing logos with moOde default
     *
     * Strategy: Block by STATION PREFIX, not exact URL.
     * When "SLAM!.jpg" 404s, block all "SLAM!*.jpg" variations.
     * This handles dynamic titles like "SLAM! Housuh In De Pauzuh"
     */
    var FALLBACK_IMAGE = '/images/radio.png';
    var STORAGE_KEY = 'rb_blocked_prefixes';
    var blockedPrefixes = [];  // Array of lowercase prefixes
    var patchApplied = false;

    // Extract filename from path (without extension)
    function extractFilename(src) {
        if (!src) return '';
        try {
            var url = new URL(src, window.location.origin);
            var path = decodeURIComponent(url.pathname).toLowerCase();
            // Get filename from path
            var filename = path.split('/').pop() || '';
            // Remove extension
            return filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
        } catch (e) {
            return '';
        }
    }

    // Extract station prefix from filename
    // E.g., "slam! housuh in de pauzuh_sm" -> "slam!"
    function extractStationPrefix(filename) {
        if (!filename) return '';
        // Remove _sm suffix
        filename = filename.replace(/_sm$/, '');
        // Try to find separator and take first part
        var separators = [' - ', ' – ', ' — ', ': '];
        for (var i = 0; i < separators.length; i++) {
            var idx = filename.indexOf(separators[i]);
            if (idx > 2) {
                return filename.substring(0, idx).trim();
            }
        }
        // No separator found - use first 20 chars or until space after 10 chars
        if (filename.length > 20) {
            // Find a natural break point
            var spaceIdx = filename.indexOf(' ', 10);
            if (spaceIdx > 0 && spaceIdx < 30) {
                return filename.substring(0, spaceIdx).trim();
            }
            return filename.substring(0, 20).trim();
        }
        return filename.trim();
    }

    // Check if filename matches any blocked prefix
    function isBlockedByPrefix(src) {
        if (!src || src.indexOf('radio-logos') === -1) return false;
        var filename = extractFilename(src);
        if (!filename) return false;

        for (var i = 0; i < blockedPrefixes.length; i++) {
            if (filename.indexOf(blockedPrefixes[i]) === 0 ||
                filename === blockedPrefixes[i]) {
                return true;
            }
        }
        return false;
    }

    // Add prefix to blocklist
    function blockPrefix(src) {
        var filename = extractFilename(src);
        var prefix = extractStationPrefix(filename);
        if (prefix && blockedPrefixes.indexOf(prefix) === -1) {
            blockedPrefixes.push(prefix);
            saveBlocklist();
            console.log('[RB Logo] Blocked prefix:', prefix, '(from:', filename, ')');
        }
    }

    // Load blocklist from sessionStorage
    function loadBlocklist() {
        try {
            var stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                blockedPrefixes = JSON.parse(stored);
            }
        } catch (e) { blockedPrefixes = []; }
        if (blockedPrefixes.length > 0) {
            console.log('[RB Logo] Loaded', blockedPrefixes.length, 'blocked prefixes:', blockedPrefixes.join(', '));
        }
    }

    // Save blocklist to sessionStorage
    function saveBlocklist() {
        try {
            // Limit to 50 prefixes
            if (blockedPrefixes.length > 50) {
                blockedPrefixes = blockedPrefixes.slice(-50);
            }
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blockedPrefixes));
        } catch (e) { /* ignore */ }
    }

    // Monkey-patch img.src setter to intercept blocked URLs
    function patchImageSrc() {
        if (patchApplied) return;
        patchApplied = true;

        var originalDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (!originalDescriptor) return;

        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: function() {
                return originalDescriptor.get.call(this);
            },
            set: function(value) {
                // Check if this URL matches a blocked prefix
                if (value && value.indexOf('radio-logos') !== -1 && isBlockedByPrefix(value)) {
                    // Use fallback instead - no network request!
                    originalDescriptor.set.call(this, FALLBACK_IMAGE);
                    return;
                }
                // Normal behavior
                originalDescriptor.set.call(this, value);
            },
            enumerable: originalDescriptor.enumerable,
            configurable: true
        });

        console.log('[RB Logo] Patched img.src setter (prefix-based)');
    }

    function setupRadioLogoFallback() {
        // Load blocklist first
        loadBlocklist();

        // Apply the src patch to intercept future requests
        patchImageSrc();

        // Handle 404 errors - add prefix to blocklist
        document.addEventListener('error', function(e) {
            var img = e.target;
            if (img.tagName !== 'IMG') return;

            var src = img.src || '';
            if (src.indexOf('radio-logos') === -1) return;
            if (src.indexOf(FALLBACK_IMAGE) !== -1) return;

            // Block this prefix for future requests
            blockPrefix(src);

            // Set fallback on this img
            img.src = FALLBACK_IMAGE;
        }, true);

        // Handle existing broken images on page
        setTimeout(function() {
            document.querySelectorAll('img[src*="radio-logos"]').forEach(function(img) {
                if (!img.complete || img.naturalWidth === 0) {
                    if (isBlockedByPrefix(img.src)) {
                        img.src = FALLBACK_IMAGE;
                    }
                }
            });
        }, 300);
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
        // Load Radio Browser played URLs
        loadRbPlayedUrls();

        // Initial render (once)
        renderAll();

        // Setup radio logo fallback for missing thumbnails
        setupRadioLogoFallback();

        // Start polling for playbar glow state (every 3 seconds)
        setInterval(updatePlaybarGlow, 3000);

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

        // Listen for storage changes (from Radio Browser page)
        window.addEventListener('storage', function(e) {
            if (e.key === RB_PLAYED_KEY) {
                loadRbPlayedUrls();
                updatePlaybarGlow();
            }
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
