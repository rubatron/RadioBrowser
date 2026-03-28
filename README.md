# RubaTron's Radio Browser Extension for moOde Audio

<p align="center">
  <img src="https://img.shields.io/badge/Version-3.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/moOde-9.0+-orange?style=for-the-badge" alt="moOde">
  <img src="https://img.shields.io/badge/PHP-8.4+-purple?style=for-the-badge" alt="PHP">
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/github/last-commit/rubatron/RadioBrowser?style=for-the-badge" alt="Last Commit">
</p>

<p align="center">
  <strong>Browse and play 30,000+ internet radio stations directly from your moOde Audio player</strong>
</p>

<p align="center">
  <img src="https://i.postimg.cc/3rbVZCrF/image.png" alt="Radio Browser Screenshot" width="800">
</p>

---

## Features

### Core Features

- **Search 30,000+ Stations** - Access the radio-browser.info database
- **Filter by Country, Genre, Name** - Find exactly what you want
- **Recently Played History** - Quick access to your listening history
- **Favorites Integration** - Save stations to moOde's Radio library
- **Logo Display** - Station logos in search results and playbar
- **One-Click Play** - Instant streaming with MPD integration

### v3.1.0 New Features

- **Standalone Menu Integration** - Radio Browser appears in Library and M-menu without ext-mgr
- **Configure Modal Fix** - Full modal support on all pages
- **Automatic Thumbnail Creation** - Logos saved for moOde playbar display
- **Visibility Settings** - Control where Radio Browser appears in menus
- **Shell Bridge Architecture** - Non-invasive moOde integration

### Technical Features

- **Redundant API Servers** - Automatic failover for reliability
- **Image Caching** - Local cache for faster loading
- **Debug Logging** - Troubleshooting tools built-in
- **Custom API Support** - Add your own radio-browser servers

---

## Installation

### Quick Install (Recommended)

Run this one-liner on your moOde system:

```bash
curl -fsSL https://raw.githubusercontent.com/rubatron/RadioBrowser/develop/bootstrap.sh | sudo bash
```

Or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/rubatron/RadioBrowser/develop/bootstrap.sh | sudo bash
```

### Manual Installation

```bash
# Download the package
wget https://github.com/rubatron/RadioBrowser/raw/refs/heads/develop/radio-browser.zip

# Extract and install
unzip radio-browser.zip
cd radio-browser/
chmod +x install.sh
sudo bash install.sh
```

Select option **1** (Auto-install) from the menu.

### Post-Installation

After installation:

1. Radio Browser will appear in the **Library dropdown** menu
2. Radio Browser will appear in the **M-menu** (hamburger menu)
3. Access directly at `http://your-moode-ip/radio-browser.php`

---

## Requirements

| Requirement | Version |
|-------------|---------|
| moOde Audio | 9.0.0+ |
| PHP | 8.4+ |
| PHP Extensions | curl, gd, json |

---

## Usage

### Playing Stations

1. Open Radio Browser from the Library or M-menu
2. Search or browse stations by country/genre
3. Click **Play** on any station card
4. The station plays immediately via MPD

### Favorites

- Click the **heart icon** on any station to add to moOde Favorites
- Favorites are saved to `/var/lib/mpd/music/RADIO/`
- Access favorites from moOde's standard Radio section

### Settings

- **Visibility** - Control menu appearance (Library, M-menu)
- **Custom API** - Add alternative radio-browser servers
- **Troubleshooting** - View API status and logs

---

## Architecture

```
/var/www/extensions/installed/radio-browser/
├── assets/
│   ├── radio-browser.css      # Extension styles
│   ├── radio-browser.js       # Main JavaScript
│   ├── rb-menu-inject.js      # Menu integration
│   └── radio-browser-modal-fix.js
├── backend/
│   └── api.php                # API endpoints
├── templates/
│   └── radio-browser.html     # UI template
├── cache/                     # Image and API cache
├── data/                      # Persistent settings
└── rb-shell-bridge.php        # moOde integration
```

### Menu Integration

Radio Browser uses a **shell bridge** that injects into moOde's header:

- Non-invasive: only adds one line to `header.php`
- Removable: clean uninstall restores original state
- Configurable: visibility controlled via settings

---

## Development

### Branches

- `main` - Stable release
- `develop` - Latest features (UAT testing)

### Testing from Develop

```bash
curl -fsSL https://raw.githubusercontent.com/rubatron/RadioBrowser/develop/bootstrap.sh | sudo bash
```

### Debug Logging

Logs are written to:

```
/var/www/extensions/installed/radio-browser/cache/radio-browser.log
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

### v3.1.0 (2026-03-28)

- Standalone menu injection (no ext-mgr dependency)
- Configure modal fix for non-index pages
- Thumbnail auto-creation for playbar
- Shell bridge architecture
- GD image processing fixes

---

## Troubleshooting

### Station logos not showing in playbar

The installer sets permissions on `/var/local/www/imagesw/radio-logos/`. If logos still don't appear:

```bash
sudo chmod 777 /var/local/www/imagesw/radio-logos/
sudo chmod 777 /var/local/www/imagesw/radio-logos/thumbs/
```

### Menu items not appearing

Run the installer again to re-apply the shell bridge:

```bash
cd /var/www/extensions/installed/radio-browser
sudo bash install.sh
```

Select option **8** (Patch header).

### Configure modal shows backdrop only

Clear browser cache with `Ctrl+Shift+R` after updating.

---

## Uninstall

```bash
cd /var/www/extensions/installed/radio-browser
sudo bash install.sh
```

Select option **9** (Uninstall).

This removes:

- All extension files
- Shell bridge from header.php
- Symlink from /var/www/

Favorites and cached logos are preserved.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **GPL-3.0-or-later** License - see the [LICENSE](LICENSE) file for details.

---

## Credits

- **RubaTron** - Current maintainer
- **radio-browser.info** - Radio station database API
- **moOde Audio** - Audio player platform

---

<p align="center">
  Made with ❤️ for the moOde community
</p>
