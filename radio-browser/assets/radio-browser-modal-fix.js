/**
 * Radio Browser Modal Fix
 *
 * On the Radio Browser page, the Configure modal is not available.
 * This script hides Configure links in dropdown menus since they only work on index.php.
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
     * Hide Configure links inside dropdown menus only
     */
    function hideConfigureLinks() {
        // Only target Configure links inside dropdown menus
        var dropdownMenus = document.querySelectorAll('.dropdown-menu');
        dropdownMenus.forEach(function(menu) {
            var links = menu.querySelectorAll('a[href="#configure-modal"]');
            links.forEach(function(link) {
                // Hide the parent list item if it exists
                var li = link.closest('li');
                if (li) {
                    li.style.display = 'none';
                } else {
                    link.style.display = 'none';
                }
            });
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
