#!/bin/bash
# ============================================================================
# RubaTron's Radio Browser Extension for moOde Audio Player
# ============================================================================
# File:        scripts/clear-recently-played.sh
# Function:    Clears the recently-played history JSON used by the extension.
# Created:     2026-01-09
# Modified:    2026-05-14
# Version:     see /radio-browser/version.txt (single source of truth)
#
# SPDX-License-Identifier: GPL-3.0-or-later
# © 2026 RubaTron

# Extension base path
EXT_PATH="/var/www/extensions/installed/radio-browser"
RECENT_FILE="$EXT_PATH/cache/recently_played.json"

echo "Radio Browser: Clearing recently played..."

if [ -f "$RECENT_FILE" ]; then
    # Backup first
    cp "$RECENT_FILE" "$RECENT_FILE.bak" 2>/dev/null

    # Clear the file
    echo "[]" > "$RECENT_FILE"

    # Fix permissions
    chown www-data:www-data "$RECENT_FILE"
    chmod 664 "$RECENT_FILE"

    echo "Radio Browser: Recently played cleared!"
    echo "  - Backup saved to: $RECENT_FILE.bak"
else
    echo "Radio Browser: No recently played file found."
fi
