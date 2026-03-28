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

## What's New in v3.1.0

### Menu Visibility Options

Fully customizable integration into moOde's interface:

- **Radio Icon in Player Bar** - Quick shortcut to Radio Browser from the moOde playbar
- **Library Menu Integration** - Access Radio Browser from the Library dropdown
- **M-Menu Integration** - Access from the hamburger menu (M-menu)
- **Flexible Visibility** - Enable/disable each menu location independently via Configure

### Radio Browser Player Bar

- Station logos display in the moOde playbar when playing radio stations
- Automatic thumbnail creation for all played stations
- Fixed Radio Browser playlist thumbnails now show correctly
- **Fallback for missing logos** - Shows moOde radio icon when station has no logo

### Download Radio Streams

- Download radio streams directly to your local device
- Requires ffmpeg (optional)
- Save recordings from your favorite stations

### Easier Installation

- **One-liner bootstrap installer** - Single command installation
- **Automatic shell bridge** - No manual moOde patching required
- **Clean uninstall** - Fully reversible installation

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **30,000+ Stations** | Access the complete radio-browser.info database |
| **Smart Search** | Filter by country, genre, name, codec, bitrate |
| **Recently Played** | Quick access to your listening history |
| **Favorites** | Save stations to moOde's Radio library |
| **Station Logos** | Display in search results and moOde playbar |
| **One-Click Play** | Instant streaming via MPD |

### v3.1.0 Features

| Feature | Description |
|---------|-------------|
| **Player Bar Icon** | Radio shortcut in moOde's playbar |
| **Playbar Thumbnails** | Station logos in moOde's Now Playing |
| **Stream Download** | Record streams to local device |
| **Menu Visibility** | Configurable Library & M-menu presence |
| **Bootstrap Install** | One-command installation |

### Technical Features

- **Redundant API Servers** - Automatic failover for reliability
- **Image Caching** - Local cache for faster loading
- **Debug Logging** - Built-in troubleshooting tools
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

The installer will:

1. Download the latest version
2. Install all files to `/var/www/extensions/installed/radio-browser/`
3. Set correct permissions
4. Patch moOde's header for menu integration
5. Create symlinks for playbar thumbnails

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

Select option **1** (Auto-install) from the interactive menu.

### Post-Installation

After installation, Radio Browser is accessible via:

| Location | Description |
|----------|-------------|
| **Library Menu** | Click Library → Radio Browser |
| **M-Menu** | Click hamburger menu → Radio Browser |
| **Player Bar** | Radio icon shortcut (if enabled) |
| **Direct URL** | `http://your-moode-ip/radio-browser.php` |

---

## Configuration

Access **Configure** from within Radio Browser to customize:

### Visibility Settings

| Option | Description |
|--------|-------------|
| **Show in Library** | Toggle Radio Browser in Library dropdown |
| **Show in M-Menu** | Toggle Radio Browser in hamburger menu |
| **Player Bar Icon** | Toggle radio shortcut in moOde playbar |

### Other Settings

- **Custom API** - Add alternative radio-browser.info servers
- **Results per page** - 10 / 20 / 50 / 100 / 200
- **Debug logging** - Enable for troubleshooting

---

## Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| moOde Audio | 9.0.0+ | Required |
| PHP | 8.4+ | With extensions |
| PHP curl | - | Required |
| PHP gd | - | Required for thumbnails |
| PHP json | - | Required |
| ffmpeg | - | Optional, for stream download |

---

## Usage

### Playing Stations

1. Open Radio Browser from Library, M-menu, or playbar icon
2. Search or browse stations by country/genre
3. Click **Play** on any station card
4. The station plays immediately via MPD
5. Station logo appears in moOde's playbar

### Adding to Favorites

- Click the **heart icon** on any station card
- Station is saved to moOde's Radio library (`/var/lib/mpd/music/RADIO/`)
- Access favorites from moOde's standard Radio section

### Downloading Streams

1. Click the **download icon** on a station card
2. Select duration and format
3. Stream is recorded and saved locally

---

## Troubleshooting

### Station logos not showing in playbar

The installer sets permissions automatically. If logos still don't appear:

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
