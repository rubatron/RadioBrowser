<?php

/**
 * RubaTron's Radio Browser Extension for moOde Audio Player
 *
 * File:        radio-browser-loader.php
 * Function:    Web Root Loader — lightweight stub deployed in /var/www/ that
 *              includes the actual extension entry point. Physical file (not
 *              a symlink) so it survives moOde's periodic worker.php cleanup
 *              that deletes all symlinks in /var/www/. Paths come from
 *              backend/loader-config.php (single source of truth).
 * Created:     2026-04-06
 * Modified:    2026-05-14
 * Version:     see /radio-browser/version.txt (single source of truth)
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */

// Load config (single source of truth for all paths)
$configPath = '/var/www/extensions/installed/radio-browser/backend/loader-config.php';
if (!file_exists($configPath)) {
    http_response_code(503);
    echo '<!DOCTYPE html><html><head><title>Radio Browser</title></head><body>';
    echo '<h2>Radio Browser Extension</h2>';
    echo '<p>Extension not installed or config missing.</p>';
    echo '</body></html>';
    exit;
}

$config = require $configPath;
$extensionEntry = $config['ext_base'] . '/radio-browser.php';

if (file_exists($extensionEntry)) {
    require $extensionEntry;
} else {
    http_response_code(503);
    echo '<!DOCTYPE html><html><head><title>Radio Browser</title></head><body>';
    echo '<h2>Radio Browser Extension</h2>';
    echo '<p>Extension entry point missing: ' . htmlspecialchars($extensionEntry) . '</p>';
    echo '</body></html>';
}
