/**
 * Radio Browser Extension - Cover Art Fix
 * 
 * This script fixes the double-encoded cover URLs issue in moOde.
 * It intercepts the coverurl and decodes it properly before displaying.
 * 
 * Bug: moOde's mpd.php encodes the entire path including slashes,
 * resulting in URLs like: imagesw%2Fradio-logos%2FStation%20Name.jpg
 * This script decodes %2F back to / so the image loads correctly.
 */

(function() {
    'use strict';
    
    // Only run on main player page
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.php') {
        return;
    }
    
    console.log('[RadioBrowser] Cover art fix loaded');
    
    // Store original jQuery html function
    var originalHtml = $.fn.html;
    
    // Function to fix encoded URLs
    function fixEncodedUrl(url) {
        if (!url || typeof url !== 'string') return url;
        
        // Check if URL contains encoded slashes
        if (url.indexOf('%2F') !== -1 || url.indexOf('%2f') !== -1) {
            // Decode the URL
            var decoded = decodeURIComponent(url);
            console.log('[RadioBrowser] Fixed encoded URL:', url, '->', decoded);
            return decoded;
        }
        return url;
    }
    
    // Override the html function to fix coverart URLs
    $.fn.html = function(content) {
        if (content && typeof content === 'string' && content.indexOf('coverart') !== -1) {
            // Fix encoded URLs in coverart images
            content = content.replace(/src="([^"]*%2[Ff][^"]*)"/g, function(match, url) {
                return 'src="' + fixEncodedUrl(url) + '"';
            });
        }
        return originalHtml.apply(this, arguments);
    };
    
    // Also fix existing images on the page
    function fixExistingImages() {
        $('img.coverart, #playbar-cover img, #ss-coverart-url img, #ss-backdrop img').each(function() {
            var src = $(this).attr('src');
            if (src && (src.indexOf('%2F') !== -1 || src.indexOf('%2f') !== -1)) {
                var fixed = fixEncodedUrl(src);
                $(this).attr('src', fixed);
            }
        });
    }
    
    // Run fix periodically (moOde updates these dynamically)
    setInterval(fixExistingImages, 2000);
    
    // Also run on document ready
    $(document).ready(function() {
        setTimeout(fixExistingImages, 1000);
    });
    
    // Hook into moOde's renderUI if available
    if (typeof window.renderUI === 'function') {
        var originalRenderUI = window.renderUI;
        window.renderUI = function() {
            var result = originalRenderUI.apply(this, arguments);
            setTimeout(fixExistingImages, 100);
            return result;
        };
    }
    
    console.log('[RadioBrowser] Cover art fix initialized');
})();
