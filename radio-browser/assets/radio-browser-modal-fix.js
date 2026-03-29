/**
 * Radio Browser Modal Fix
 *
 * On non-index pages, the Configure modal content is not initialized.
 * This script intercepts Configure link clicks BEFORE Bootstrap handles them,
 * sets a localStorage flag and redirects to index.php.
 * rb-menu-inject.js (loaded on all pages) will detect this and open the modal.
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

    console.log('[RB Modal Fix] Initializing on Radio Browser page');

    // Use capturing phase to intercept BEFORE Bootstrap's delegated handlers
    document.addEventListener('click', function(e) {
        // Find the closest anchor element
        var link = e.target.closest('a[href="#configure-modal"]');
        if (!link) return;

        // Stop Bootstrap from handling this
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[RB Modal Fix] Intercepted Configure click, redirecting to index.php');

        // Set localStorage flag so rb-menu-inject.js can open the modal
        try {
            localStorage.setItem('rb_open_configure_modal', 'true');
        } catch (err) {
            console.log('[RB Modal Fix] localStorage not available');
        }

        // Redirect to index.php (rb-menu-inject.js will handle opening the modal)
        window.location.href = '/index.php';
    }, true); // true = capturing phase (fires BEFORE bubbling)

    console.log('[RB Modal Fix] Ready - capturing Configure clicks');

})(window, document);
