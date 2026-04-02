# Changelog

All notable changes to Radio Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-04-02

### Added

#### UI Overhaul

- **Dedicated Sections** — Search Stations, Recently Played, Favorites, and Settings each have their own section
- **Station Cards** — Redesigned station cards with logo, country, bitrate, codec, genre, and action buttons
- **Top Stations** — Quick access to popular stations on first load

#### moOde Menu Integration

- **Configure Tile** — Radio Browser tile in moOde's Configuration Settings modal
- **Playbar Icon** — Radio Browser activity indicator in the moOde player bar, acts as shortcut
- **Activity Light** — Visual indicator when a Radio Browser stream is playing

#### Visibility Toggles

- **Library Menu** — Show/hide Radio Browser in Library dropdown
- **M Menu** — Show/hide Radio Browser in hamburger menu
- **Configure Tile** — Show/hide in Configuration Settings
- **Playbar Icon** — Show/hide in player bar
- **Download Button** — Show/hide download button on station cards
- **Max Station Card View** — Limit number of cards for Favorites and Recently Played

#### Troubleshooting

- **Debug Mode** toggle with console logging
- **Uninstall / Reinstall / Repair** buttons in Settings
- **Repair Thumbnail Cache** button
- **Flush Cache** button
- **View / Clear Log** buttons

#### System

- **systemd Health Check** — Timer-based service monitoring (`radio-browser-health.service`)
- **Service Status API** — Real-time health status with detailed checks
- **Cache-busting** — Asset URLs versioned with file modification timestamps

### Changed

- **API Load Balancing** — Now uses radio-browser.info CDN/load balancer instead of single server, with automatic failover
- **API Status** — Added button to view [radio-browser.info server status](https://api.radio-browser.info/net)
- **`hidebroken=true`** — Search results now exclude broken stations by default
- **Stale Cache Fallback** — Returns cached data when API is unavailable instead of failing
- **12h Cache TTL** — Extended cache lifetime for better performance on Pi Zero
- **Parallel Init** — Favorites and recently played load in parallel on startup
- **Installation** — Simplified one-liner installer via `curl` or `wget`
- **Logo Thumbnails** — Passthrough to moOde's playlist if available

### Removed

- **Custom API UI** — Hidden pending redesign (backend endpoints preserved)
- **Dead CSS** — Removed ~140 lines of unused styles
- **Dead JS** — Removed unused `loadFavorites()` function and custom API handlers
- **`default-radio-logo.png`** — Unused asset removed
- **`api_formatted.php`** — Removed duplicate backend file

## [3.2.0] - 2026-03-28

### Added

#### System Backup & Restore

- **moOde File Backup** - Original moOde system files (header.php, moode-locations.conf) are now backed up to `sys/sources/moode/` before patching
- **Source Archive Preservation** - Bootstrap installer saves the extension tarball to `sys/sources/` for future repairs
- **Clean Restore on Uninstall** - moOde files are restored from backups during uninstall

#### Troubleshooting UI Enhancements

- **Service Status Indicators** - Real-time status dots for nginx and PHP-FPM in the Configure modal
- **Repair Installation Button** - One-click fix for symlinks, patches, and permissions
- **Uninstall Extension Button** - UI-based uninstall with double confirmation and redirect to moOde home

#### API Endpoints

- `service_status` - Check nginx and PHP-FPM service status
- `repair` - Repair installation (symlinks, patches, permissions)
- `uninstall` - Uninstall extension and restore moOde files

### Changed

- **Installer now 10 steps** - Added step 8 for backing up moOde system files
- **Symlink Verification** - Bootstrap installer verifies symlink after installation and recreates if broken
- **Dynamic Hostname** - Installer output now shows actual hostname instead of placeholder

### Technical Improvements

- New folder structure: `sys/sources/moode/` for original moOde file backups
- Restore logic uses backups first, falls back to marker-based cleanup
- Service restart after uninstall to apply restored configs

## [3.1.1] - 2026-03-28

### Technical Improvements

- **Nginx Logo Fallback** - Added try_files directive to nginx config that serves moOde's default radio icon for missing station logos (eliminates 404 errors for thumbnails)
- **Improved Installer** - Now includes 9 steps with automatic nginx patching (reversible on uninstall)

## [3.1.0] - 2026-03-28

### Highlights

This release focuses on **moOde integration** and **user experience improvements**.

### Added

#### Menu Visibility Options

- **Flexible Library Menu Integration** - Toggle Radio Browser in Library dropdown
- **Flexible M-Menu Integration** - Toggle Radio Browser in hamburger menu
- **Configure Panel** - Easy visibility management via settings

#### Station Logo Support

- **Station Logo Thumbnails** - Logos display when streaming radio
- **Automatic Thumbnail Creation** - Logos saved automatically for all played stations
- **Fixed Playlist Thumbnails** - Radio Browser playlist thumbnails now display correctly
- **Logo Fallback** - Stations without logos show moOde's radio icon instead of empty placeholder

#### Download Radio Streams

- **Stream Recording** - Download radio streams to local device
- **ffmpeg Integration** - Uses ffmpeg for high-quality recordings (optional)

#### Easier Installation

- **Bootstrap Installer** - One-liner installation via `curl | bash`
- **Automatic Shell Bridge** - No manual header.php patching required
- **imagesw Symlink** - Automatic creation for thumbnail accessibility
- **Clean Uninstall** - Fully reversible, restores original moOde state

### Fixed

- **GD imagecolorallocate Bug** - Fixed color allocation for thumbnail/small images (was reusing destroyed image's color)
- **Modal Backdrop Issue** - Configure modal now properly displays on non-index pages
- **Thumbnail Permissions** - Installer sets correct 777 permissions on radio-logos directories
- **Menu Injection** - Reliable menu item addition without page refresh issues
- **Playlist Thumbnails** - Station logos now appear correctly in moOde playlists

### Changed

- Updated minimum moOde version to 9.0.0
- Updated minimum PHP version to 8.4
- Improved error handling in API endpoints
- Enhanced debug logging for troubleshooting

### Technical

- New files: `rb-shell-bridge.php`, `rb-menu-inject.js`, `radio-browser-modal-fix.js`
- Header.php patch adds single line include for shell bridge
- Settings stored in `/var/www/extensions/installed/radio-browser/data/settings.json`

## [3.0.0] - 2026-01-15

### Added

- Complete rewrite with modern architecture
- Top stations feature
- Popular stations by country
- Extended search with filters (country, genre, tags, codec, bitrate)
- Search by genre dropdown
- Local image caching with thumbnail generation
- Pagination for search results
- Results per page selector (10/20/50/100/200)
- Persistent settings with custom API support
- Debug logging system
- Recently played stations history
- System requirements check in installer
- Backup/restore functionality in installer

### Fixed

- API redundancy with automatic failover
- Image loading reliability
- Favorite management

### Changed

- Moved from simple list to card-based UI
- Enhanced search capabilities
- Improved station information display

## [2.1.0] - 2025-12-xx

### Added

- Automatic redundant API server selection
- API status indicator
- Custom API configuration
- Country code selector
- Top stations endpoint

## [2.0.0] - 2025-11-xx

### Added

- Initial public release
- Radio station search
- Country filtering
- Favorites integration with moOde
- Play stations via MPD
- Basic installer

---

## Upgrade Path

### From 3.0.0 to 3.1.0

Run the one-liner installer to upgrade:

```bash
curl -fsSL https://raw.githubusercontent.com/rubatron/RadioBrowser/develop/bootstrap.sh | sudo bash
```

### From 2.x to 3.x

Full reinstallation recommended:

1. Uninstall old version via installer
2. Run fresh install with bootstrap script

---

## Links

- [GitHub Repository](https://github.com/rubatron/RadioBrowser)
- [Radio Browser API](https://www.radio-browser.info/)
- [moOde Audio Player](https://moodeaudio.org/)
