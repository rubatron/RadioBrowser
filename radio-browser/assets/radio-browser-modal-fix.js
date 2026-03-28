/**
 * Radio Browser Modal Fix
 *
 * On non-index pages, Bootstrap's data-api modal handlers may not be
 * fully initialized. This script ensures the configure-modal works
 * by manually triggering Bootstrap's modal.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */
(function (window, document) {
    'use strict';

    function initModalFix($) {
        var $modal = $('#configure-modal');
        if (!$modal.length) {
            console.log('[RB Modal Fix] configure-modal not found');
            return;
        }

        // Check if Bootstrap modal is available
        if (!$.fn.modal) {
            console.log('[RB Modal Fix] Bootstrap modal not available');
            return;
        }

        console.log('[RB Modal Fix] Initializing Bootstrap modal support');

        // Initialize the modal with Bootstrap (ensures it's ready)
        $modal.modal({ show: false });

        // Handle Configure link clicks - trigger Bootstrap's modal
        $(document).on('click.rbModal', 'a[href="#configure-modal"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[RB Modal Fix] Opening modal via Bootstrap');
            $modal.modal('show');
            return false;
        });

        console.log('[RB Modal Fix] Ready');
    }

    // Wait for jQuery and Bootstrap
    function waitAndInit() {
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
            initModalFix(window.jQuery);
        } else {
            setTimeout(waitAndInit, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(waitAndInit, 200);
        });
    } else {
        setTimeout(waitAndInit, 200);
    }
})(window, document);
