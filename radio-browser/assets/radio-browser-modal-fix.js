/**
 * Radio Browser Modal Fix
 *
 * On non-index pages, Bootstrap's data-api modal handlers may not be
 * fully initialized. This script ensures the configure-modal works
 * by manually triggering Bootstrap's modal and forcing visibility.
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
        $modal.modal({ show: false, backdrop: true, keyboard: true });

        // Handle Configure link clicks - trigger Bootstrap's modal
        $(document).on('click.rbModal', 'a[href="#configure-modal"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[RB Modal Fix] Opening modal via Bootstrap');

            // Force modal visibility - Bootstrap 2.x sometimes needs help
            $modal.removeClass('hide').addClass('in').css({
                'display': 'block',
                'opacity': '1',
                'top': '10%',
                'margin-top': '0'
            });

            // Add backdrop if not present
            if (!$('.modal-backdrop').length) {
                $('<div class="modal-backdrop fade in"></div>').appendTo('body');
            }

            // Also trigger Bootstrap's show for proper event handling
            $modal.modal('show');

            // Ensure modal content is visible
            $modal.find('.modal-body').css('display', 'block');
            $modal.find('#configure').css('display', 'block');

            console.log('[RB Modal Fix] Modal forced visible');
            return false;
        });

        // Handle close - clean up backdrop
        $modal.on('hidden', function() {
            $('.modal-backdrop').remove();
            $modal.removeClass('in').addClass('hide').css('display', 'none');
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
