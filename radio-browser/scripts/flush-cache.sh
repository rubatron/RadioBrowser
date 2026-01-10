#!/bin/bash
# RubaTron's Radio Browser Extension for moOde Audio Player
# SPDX-License-Identifier: GPL-3.0-or-later
# 2026 RubaTron
# Version: 3.0.0
#
# Flush Cache Script

# Extension base path
EXT_PATH="/var/www/extensions/installed/radio-browser"
CACHE_PATH="$EXT_PATH/cache"

echo "Radio Browser: Flushing cache..."

# Count files before
CACHE_COUNT=$(find "$CACHE_PATH" -maxdepth 1 -name "*.json" -type f 2>/dev/null | wc -l)
IMAGE_COUNT=$(find "$CACHE_PATH/images" -type f 2>/dev/null | wc -l)

# Remove cached API responses (but not recently_played.json)
find "$CACHE_PATH" -maxdepth 1 -name "*.json" ! -name "recently_played.json" -type f -delete 2>/dev/null

# Remove cached images
rm -rf "$CACHE_PATH/images/"* 2>/dev/null

# Clear log file (but keep it)
if [ -f "$CACHE_PATH/radio-browser.log" ]; then
    echo "[$(date -Iseconds)] Cache flushed" > "$CACHE_PATH/radio-browser.log"
fi

echo "Radio Browser: Cache flushed successfully!"
echo "  - Removed $CACHE_COUNT cached API responses"
echo "  - Removed $IMAGE_COUNT cached images"
echo "  - Log file cleared"
