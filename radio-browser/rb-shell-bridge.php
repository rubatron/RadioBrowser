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
  // Inject CSS for menu styling and Configure modal tiles
  // These styles are needed on all pages where Radio Browser integrates
  echo '<style>
.rb-mmenu-divider.divider{height:1px!important;background-color:rgba(128,128,128,.25)!important;border:none!important;margin:9px 1px!important;padding:0!important}
.rb-configure-entry{display:block!important;visibility:visible!important}
.rb-configure-entry a.btn.btn-large{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;width:100px!important;height:100px!important;padding:10px!important;text-align:center!important;background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:4px!important;color:#ddd!important;text-decoration:none!important;font-size:0.85em!important}
.rb-configure-entry a.btn.btn-large:hover{background:rgba(197,90,17,.15)!important;border-color:rgba(197,90,17,.4)!important;color:#fff!important}
.rb-configure-entry a.btn.btn-large i{font-size:2em!important;margin-bottom:8px!important;color:#c55a11!important}
</style>' . "\n";
  echo '<script src="/extensions/installed/radio-browser/assets/rb-menu-inject.js" defer></script>' . "\n";
}
