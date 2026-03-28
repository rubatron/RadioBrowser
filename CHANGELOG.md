# Changelog

All notable changes to Radio Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-03-28

### Highlights
This release focuses on **moOde integration** and **user experience improvements**.

### Added

#### Menu Visibility Options
- **Radio Icon in Player Bar** - Quick shortcut to Radio Browser from moOde's playbar
- **Flexible Library Menu Integration** - Toggle Radio Browser in Library dropdown
- **Flexible M-Menu Integration** - Toggle Radio Browser in hamburger menu
- **Configure Panel** - Easy visibility management via settings

#### Radio Browser Player Bar Integration
- **Station Logo Thumbnails** - Logos display in moOde's Now Playing when streaming radio
- **Automatic Thumbnail Creation** - Logos saved automatically for all played stations
- **Fixed Playlist Thumbnails** - Radio Browser playlist thumbnails now display correctly

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
