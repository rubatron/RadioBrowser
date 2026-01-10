# Radio Browser Extension v4.0 - File Structure Analysis

## ✅ Core Files (Required)

### Main Files
- `radio-browser.php` - Main entry point, loads template
- `manifest.json` - Extension metadata
- `info.json` - Version and feature information
- `version.txt` - Version number (3.0.0)
- `README.md` - Documentation
- `install.sh` - Installation script

### Assets
- `assets/radio-browser.js` - Main JavaScript (34KB)
- `assets/radio-browser.css` - Styling (13KB)
- **`assets/coverart-fix.js` - REQUIRED: Fixes moOde's double-encoded coverurl issue**
  - Runs on main player page (/index.php)
  - Decodes %2F back to / in cover art URLs
  - Independent fix for moOde bug, NOT integrated in radio-browser.js

### Backend
- `backend/api.php` - Main API endpoint (31KB)
  - Handles: search, play, recently_played, status, favorites
  - Includes: reboot, restart_services, flush_cache

### Templates
- `templates/radio-browser.html` - Main UI template (18KB)

### Scripts (Maintenance)
- `scripts/clear-recently-played.sh` - Clear recently played cache
- `scripts/fix-permissions.sh` - Fix file permissions
- `scripts/flush-cache.sh` - Clear API cache
- `scripts/test-api.sh` - Test API connectivity

### Data & Cache
- `data/.gitkeep` - Placeholder for custom APIs (survives cache flush)
- `cache/.gitignore` - Ignore cache files in git

## ❌ Removed Files

- `backend/api_formatted.php` - Duplicate/backup, removed from 4.0

## 📝 Key Features

### Recently Played
- File-based tracking in `/var/local/www/rb_recently_played.json`
- Ordered by play time (most recent first)
- Survives system restarts

### Logo Handling
- Cached in `/var/www/extensions/installed/radio-browser/cache/images/`
- moOde logos in `/var/local/www/imagesw/radio-logos/thumbs/`
- Automatic PNG→JPG conversion

### Active State
- Uses `data-url` attribute on cards
- Matches against currentsong.txt file URL
- Shows playing state in both Recently Played and Search Results

### Troubleshooting Tools
- Flush Cache
- Restart Services (nginx + PHP-FPM)
- Reboot System
- View/Clear Debug Log

## 🔧 Integration Points

### moOde Integration
- Uses moOde's `header.php` and `footer.min.php`
- Stores stations in `cfg_radio` table with type='rb'
- Saves metadata in session for worker.php
- Compatible with currentsong.txt workflow

### coverart-fix.js Purpose
This file is **essential** and **not replaceable** by radio-browser.js because:
1. It runs globally on the main player page
2. Fixes moOde's mpd.php double-encoding bug
3. Intercepts jQuery .html() calls
4. Patches existing img elements every 2 seconds
5. Specifically targets coverart display issues

**DO NOT REMOVE THIS FILE** - it solves a moOde core issue that affects radio station logo display.

## 📊 File Sizes
- Total: ~150KB (excluding cache)
- Largest: backend/api.php (31KB), assets/radio-browser.js (34KB)
