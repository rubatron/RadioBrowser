<?php

/**
 * RubaTron's Radio Browser Extension for moOde Audio Player
 *
 * Standalone extension that works without modifying moOde system files.
 * Uses moOde's header.php and footer.min.php for consistent look and feel.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.0.0
 */

// Include moOde common functions (required for session, SQL, etc.)
require_once '/var/www/inc/common.php';
require_once '/var/www/inc/session.php';

// Start session
$dbh = sqlConnect();
phpSession('open');

// Extension paths
$extPath = __DIR__;
$extAssetsPath = '/extensions/installed/radio-browser/assets';

// Define variables for template
$_radio_api_options = '<option value="radio-browser-info" selected>radio-browser.info (Default)</option>';

// Load custom APIs from data folder (survives cache flush)
$customApisFile = $extPath . '/data/custom_apis.json';
if (file_exists($customApisFile)) {
    $customApis = json_decode(file_get_contents($customApisFile), true);
    if (is_array($customApis)) {
        foreach ($customApis as $id => $api) {
            $_radio_api_options .= '<option value="' . htmlspecialchars($id) . '">' . htmlspecialchars($api['name']) . ' (Custom)</option>';
        }
    }
}

// Set section to 'index' to load main.min.js instead of config.min.js
// This ensures Bootstrap modals work correctly (Configure modal, etc.)
$section = 'index';

// Set page title in session for header.php
$_SESSION['config_back_link'] = '/index.php';

// Template file path
$tpl = 'radio-browser';

// Custom API options (empty - custom APIs added dynamically via JS)
$_custom_api_options = '';

// Store back link
storeBackLink($section, $tpl);

// Include moOde header (generates <!DOCTYPE html>, <head> with CSS/JS, and header navigation)
include('/var/www/header.php');

// Output extension-specific CSS (after moOde's CSS so we can override)
echo '<link rel="stylesheet" href="' . $extAssetsPath . '/radio-browser.css">' . "\n";

// Output extension-specific JavaScript (deferred loading)
echo '<script src="' . $extAssetsPath . '/radio-browser.js" defer></script>' . "\n";

// NOTE: modal-fix.js removed - Configure modal loads via footer.min.php

// Load and render template
$templateFile = $extPath . '/templates/radio-browser.html';
if (file_exists($templateFile)) {
    $template = file_get_contents($templateFile);
    // Replace PHP variables in template
    $template = str_replace('$_radio_api_options', $_radio_api_options, $template);
    $template = str_replace('$_custom_api_options', $_custom_api_options, $template);
    echo $template;
} else {
    echo '<div class="container"><p class="text-error">Template file not found: ' . htmlspecialchars($templateFile) . '</p></div>';
}

// Include moOde footer (closes <body> and <html>)
include('/var/www/footer.min.php');
