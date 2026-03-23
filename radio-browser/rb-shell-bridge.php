<?php
/**
 * Radio Browser Shell Bridge
 * 
 * This bridge is included from moOde's header.php and injects
 * the Radio Browser menu injection script on every page.
 * 
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */

// Prevent double loading
if (defined('RB_SHELL_BRIDGE_LOADED')) {
    return;
}
define('RB_SHELL_BRIDGE_LOADED', true);

// Only inject on moOde pages (not API calls or assets)
$isApi = (
    strpos($_SERVER['REQUEST_URI'] ?? '', '/api.php') !== false ||
    strpos($_SERVER['REQUEST_URI'] ?? '', '.json') !== false ||
    strpos($_SERVER['REQUEST_URI'] ?? '', '.css') !== false ||
    strpos($_SERVER['REQUEST_URI'] ?? '', '.js') !== false ||
    strpos($_SERVER['REQUEST_URI'] ?? '', '/command/') !== false
);

if (!$isApi) {
    echo '<script src="/extensions/installed/radio-browser/assets/rb-menu-inject.js" defer></script>' . "\n";
}
