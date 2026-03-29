/**
 * Radio Browser Modal Fix
 *
 * On non-index pages, the Configure modal content is not initialized.
 * This script redirects to index.php to open the configure modal there.
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

        // Handle Configure link clicks - redirect to index.php with hash
        $(document).on('click.rbModal', 'a[href="#configure-modal"]', function (e) {
            e.preventDefault();
            console.log('[RB Modal Fix] Redirecting to index.php for Configure');
            
            // Redirect to index.php - moOde will open the configure modal via hash
            window.location.href = '/index.php#configure-modal';
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
