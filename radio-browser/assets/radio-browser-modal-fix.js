/**
 * Radio Browser Modal Fix
 *
 * On the Radio Browser page, the Configure modal is not available.
 * This script hides Configure links since they only work on index.php.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function (window, document) {
    'use strict';

    // Only run on radio-browser page
    if (window.location.pathname.indexOf('radio-browser') === -1) {
        return;
    }

    /**
     * Hide Configure links that don't work on this page
     */
    function hideConfigureLinks() {
        var links = document.querySelectorAll('a[href="#configure-modal"]');
        links.forEach(function(link) {
            // Hide the link or its parent list item
            var li = link.closest('li');
            if (li) {
                li.style.display = 'none';
            } else {
                link.style.display = 'none';
            }
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideConfigureLinks);
    } else {
        hideConfigureLinks();
    }

    // Also run when dropdowns open (for dynamically rendered menus)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.dropdown-toggle, #menu-settings')) {
            setTimeout(hideConfigureLinks, 50);
        }
    });

})(window, document);
