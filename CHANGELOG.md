# Changelog

All notable changes to Radio Browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-03-28

### Added

- **Standalone Menu Integration** - Radio Browser now appears in Library dropdown and M-menu without requiring ext-mgr
- **Shell Bridge Architecture** - Non-invasive integration via `rb-shell-bridge.php` injected into moOde header
- **Automatic Thumbnail Creation** - Station logos automatically saved for moOde playbar display
- **Bootstrap Installer** - One-liner installation via `curl | bash`
- **Visibility Settings** - Control where Radio Browser appears (Library menu, M-menu)
- **Configure Modal Fix** - Full modal support on all moOde pages, not just index
- **Stream Download Feature** - Download radio streams (requires ffmpeg)
- **imagesw Symlink** - Automatic creation of symlink for thumbnail accessibility

### Fixed

- **GD imagecolorallocate Bug** - Fixed color allocation for thumbnail/small images (was reusing destroyed image's color)
- **Modal Backdrop Issue** - Configure modal now properly displays on non-index pages
- **Thumbnail Permissions** - Installer sets correct 777 permissions on radio-logos directories
- **Menu Injection** - Reliable menu item addition without page refresh issues

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
