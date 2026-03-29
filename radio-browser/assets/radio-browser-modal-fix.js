/**
 * Radio Browser Modal Fix
 *
 * On the Radio Browser page, the Configure modal content needs to be loaded.
 * This script fetches the modal content from index.php and injects it.
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

    var modalLoaded = false;

    /**
     * Load Configure modal content from index.php
     */
    function loadConfigureModal() {
        if (modalLoaded) return Promise.resolve();

        return fetch('/index.php')
            .then(function(res) { return res.text(); })
            .then(function(html) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                
                // Find the configure-modal in the fetched HTML
                var sourceModal = doc.getElementById('configure-modal');
                if (!sourceModal) {
                    console.log('[RB Modal Fix] Configure modal not found in index.php');
                    return;
                }

                // Check if modal already exists on this page
                var existingModal = document.getElementById('configure-modal');
                if (existingModal) {
                    // Replace the body content
                    var existingBody = existingModal.querySelector('.modal-body');
                    var sourceBody = sourceModal.querySelector('.modal-body');
                    if (existingBody && sourceBody) {
                        existingBody.innerHTML = sourceBody.innerHTML;
                    }
                } else {
                    // Append the entire modal to body
                    document.body.appendChild(sourceModal.cloneNode(true));
                }

                modalLoaded = true;
                console.log('[RB Modal Fix] Configure modal loaded from index.php');
            })
            .catch(function(err) {
                console.log('[RB Modal Fix] Failed to load modal:', err);
            });
    }

    /**
     * Intercept Configure link clicks and ensure modal is loaded
     */
    function setupConfigureInterceptor() {
        // Use capturing phase to intercept before Bootstrap
        document.addEventListener('click', function(e) {
            var link = e.target.closest('a[href="#configure-modal"]');
            if (!link) return;

            // If modal not loaded yet, prevent default and load it first
            if (!modalLoaded) {
                e.preventDefault();
                e.stopPropagation();
                
                loadConfigureModal().then(function() {
                    // Now trigger the modal via Bootstrap
                    if (window.jQuery && window.jQuery.fn.modal) {
                        window.jQuery('#configure-modal').modal('show');
                    }
                });
                return;
            }
        }, true);
    }

    // Initialize
    setupConfigureInterceptor();

    // Preload modal content after page load for faster response
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(loadConfigureModal, 500);
        });
    } else {
        setTimeout(loadConfigureModal, 500);
    }

})(window, document);
