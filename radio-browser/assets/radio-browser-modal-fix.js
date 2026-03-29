/**
 * Radio Browser Modal Fix
 *
 * On non-index pages, the Configure modal content is not initialized.
 * This script sets a localStorage flag and redirects to index.php.
 * rb-menu-inject.js (loaded on all pages) will detect this and open the modal.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function (window, document) {
    'use strict';

    function initModalFix($) {
        // Only run on radio-browser page
        if (window.location.pathname.indexOf('radio-browser') === -1) {
            return;
        }

        console.log('[RB Modal Fix] Initializing on Radio Browser page');

        // Handle Configure link clicks - set flag and redirect to index.php
        $(document).on('click.rbModal', 'a[href="#configure-modal"]', function (e) {
            e.preventDefault();
            console.log('[RB Modal Fix] Setting flag and redirecting to index.php');

            // Set localStorage flag so rb-menu-inject.js can open the modal
            try {
                localStorage.setItem('rb_open_configure_modal', 'true');
            } catch (err) {
                console.log('[RB Modal Fix] localStorage not available');
            }

            // Redirect to index.php (rb-menu-inject.js will handle opening the modal)
            window.location.href = '/index.php';
            return false;
        });

        console.log('[RB Modal Fix] Ready');
    }

    // Wait for jQuery
    function waitAndInit() {
        if (window.jQuery) {
            initModalFix(window.jQuery);
        } else {
            setTimeout(waitAndInit, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(waitAndInit, 100);
        });
    } else {
        setTimeout(waitAndInit, 100);
    }
})(window, document);
