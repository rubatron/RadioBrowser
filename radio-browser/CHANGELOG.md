# Changelog - Radio Browser Extension

## [5.0.0] - 2024

### Added
- **Enhanced Installation Menu**
  - Reboot option with bold RED CAPS "RECOMMENDED AFTER INSTALL RADIO-BROWSER!" message
  - Automatic detection of existing files with y/n confirmation before overwriting
  - Update checker using GitHub API to check for new commits on main branch
  
- **Developer Mode** (requires root)
  - Warning disclaimer: "With great power, comes great responsibility"
  - Custom installation path configuration with automatic permission setting
  - moOde menu integration via `scripts/moodemenu-integration.sh` script
  
- **GitHub Integration**
  - Update checking against GitHub repository commits
  - Instructions for manual updates displayed in terminal
  
- **New Installation Flow**
  - Step 0: Check for existing installation (with user confirmation)
  - Improved user warnings before overwriting files
  
### Changed
- Updated menu structure with organized sections: Installation, Maintenance, Tools, Other
- SCRIPT_VERSION bumped from 3.0 to 5.0
- Install script now requires explicit confirmation if files already exist

### Technical
- Added `check_for_existing_files()` function
- Added `reboot_system()` function with bold messaging
- Added `check_for_updates()` function with GitHub API integration
- Added `developer_menu()` function with submenu loop
- Added `set_custom_install_path()` function
- Added `integrate_moode_menu()` function
- Added GITHUB_REPO and GITHUB_API configuration constants

---

## [4.0.0] - 2024

### Changed
- Cleaned repository structure
- Removed duplicate `backend/api_formatted.php`
- Improved documentation

### Added
- STRUCTURE.md documentation explaining file purposes

### Technical
- Confirmed `assets/coverart-fix.js` is separate from radio-browser.js (fixes moOde's double-encoding bug)

---

## [3.0.0] - 2024

### Added
- Session-based recently played tracking
- Fixed search results display (prevented loadTopStations() from overwriting search)
- Fixed active state synchronization using data-url attributes
- Template loading fixes for search results
- Fixed logo display issues

### Changed
- Recently played now uses session storage instead of database queries
- Active state matching improved with data-url attribute comparison

### Fixed
- Search results no longer overwritten by top stations on page load
- Recently played ordering now reflects actual play sequence
- Type 'rbt' stations (like MANGORADIO) now appear in recently played

---

## [2.0.0] - 2024

### Added
- Initial troubleshooting panel
- API latency handling improvements
- Memory leak fixes

### Fixed
- Template loading issues
- Recently played position bugs

---

## [1.0.0] - 2024

### Added
- Initial Radio Browser extension release
- Basic station browsing
- Search functionality
- Integration with moOde Audio Player
