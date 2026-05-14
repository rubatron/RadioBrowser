<?php

/**
 * RubaTron's Radio Browser Extension for moOde Audio Player
 *
 * File:        backend/loader-config.php
 * Function:    Central manifest defining all paths managed by the extension.
 *              Used by radio-browser-loader.php, health.sh, api.php (repair)
 *              and install.sh. The 'webroot_files' array lists files that
 *              must exist in /var/www/ — deployed as physical loader files
 *              so they survive moOde's periodic symlink cleanup.
 * Created:     2026-04-06
 * Modified:    2026-05-14
 * Version:     see /radio-browser/version.txt (single source of truth)
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * © 2026 RubaTron
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
