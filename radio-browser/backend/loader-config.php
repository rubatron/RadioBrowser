<?php

/**
 * Radio Browser Extension - Loader Configuration
 *
 * Central manifest defining all paths managed by the extension.
 * Used by: radio-browser-loader.php, health.sh, api.php (repair), install.sh
 *
 * The 'webroot_files' array defines files that must exist in /var/www/.
 * moOde's worker.php deletes all symlinks there during maintenance,
 * so we deploy physical loader files that survive the cleanup.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 */

return [
  // Extension identity
  'id' => 'radio-browser',

  // Base paths (absolute, auto-resolved)
  'ext_base' => dirname(__DIR__),
  'web_root' => '/var/www',

  // Files that must exist in /var/www/ (key = target filename, source = file in ext_base)
  // The loader/health/repair scripts use this to deploy and auto-repair
  'webroot_files' => [
    'radio-browser.php' => [
      'source' => 'radio-browser-loader.php',
    ],
  ],

  // Extension subdirectories (relative to ext_base)
  'dirs' => [
    'backend' => 'backend',
    'assets'  => 'assets',
    'cache'   => 'cache',
    'data'    => 'data',
    'templates' => 'templates',
    'systemd' => 'systemd',
    'scripts' => 'scripts',
  ],
];
