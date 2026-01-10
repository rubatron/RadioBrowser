#!/bin/bash
# RubaTron's Radio Browser Extension for moOde Audio Player
# SPDX-License-Identifier: GPL-3.0-or-later
# 2026 RubaTron
# Version: 3.0.0
#
# Fix Permissions Script

# Extension base path
EXT_PATH="/var/www/extensions/installed/radio-browser"

echo "Radio Browser: Fixing permissions..."

# Fix ownership
sudo chown -R www-data:www-data "$EXT_PATH"

# Fix directory permissions (755)
sudo find "$EXT_PATH" -type d -exec chmod 755 {} \;

# Fix file permissions (644 for regular files)
sudo find "$EXT_PATH" -type f -exec chmod 644 {} \;

# Make scripts executable (755)
sudo chmod 755 "$EXT_PATH/scripts/"*.sh 2>/dev/null

# Fix cache directory permissions (writable)
sudo chmod 775 "$EXT_PATH/cache"
sudo chmod 775 "$EXT_PATH/cache/images" 2>/dev/null

# Fix data directory permissions (writable)
sudo chmod 775 "$EXT_PATH/data" 2>/dev/null
if [ -f "$EXT_PATH/data/custom-apis.json" ]; then
    sudo chmod 664 "$EXT_PATH/data/custom-apis.json"
fi

# Fix recently played file
if [ -f "$EXT_PATH/cache/recently_played.json" ]; then
    sudo chmod 664 "$EXT_PATH/cache/recently_played.json"
fi

# Fix log file
if [ -f "$EXT_PATH/cache/radio-browser.log" ]; then
    sudo chmod 664 "$EXT_PATH/cache/radio-browser.log"
fi

echo "Radio Browser: Permissions fixed successfully!"
echo "  - Ownership: www-data:www-data"
echo "  - Directories: 755"
echo "  - Files: 644"
echo "  - Cache: 775 (writable)"
echo "  - Data: 775 (writable)"
echo "  - Scripts: 755 (executable)"
