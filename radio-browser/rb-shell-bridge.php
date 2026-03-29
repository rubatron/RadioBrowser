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
  // Inject minimal CSS - rb-configure-entry is just an identifier
  // Let moOde's native #configure ul li styling handle the tile appearance
  echo '<style>
.rb-mmenu-divider.divider{height:1px!important;background-color:rgba(128,128,128,.25)!important;border:none!important;margin:9px 1px!important;padding:0!important}
</style>' . "\n";
  echo '<script src="/extensions/installed/radio-browser/assets/rb-menu-inject.js" defer></script>' . "\n";
}
