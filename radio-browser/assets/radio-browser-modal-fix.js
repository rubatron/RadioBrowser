/**
 * Radio Browser Modal Fix
 *
 * The Configure modal is already included via footer.min.php.
 * This script is kept for potential future fixes but does nothing currently.
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

    // The configure-modal is already included via footer.min.php
    // No action needed - Bootstrap handles it natively

    console.log('[RB Modal Fix] Configure modal available via footer.min.php');

})(window, document);
