# Radio Browser Extension v3.0.0

Modern web extension for moOde Audio Player that integrates the Radio Browser API.

## Features

-  **Search & Browse** - Search 30,000+ internet radio stations
-  **Favorites** - Save stations directly to moOde's Radio library
-  **Recently Played** - Track your listening history
-  **Modern UI** - Clean, responsive interface with moOde styling
-  **Custom APIs** - Add your own radio directory APIs (Shoutcast, Icecast)
-  **Troubleshooting Tools** - Built-in diagnostics and repair tools

## Installation

### Quick Install (Recommended)

Download and run the installer directly:

```bash
wget -O install.sh 'https://raw.githubusercontent.com/rubatron/RadioBrowser/Nightly-Builds/install.sh'
chmod +x install.sh
sudo ./install.sh
```

Then select option **1** (Auto-install) from the menu.

### Manual Download

If you prefer to download all files first:

```bash
# Create temp folder
mkdir -p /tmp/radio-browser && cd /tmp/radio-browser

# Download extension archive
wget 'https://github.com/rubatron/RadioBrowser/archive/refs/heads/Nightly-Builds.zip' -O radio-browser.zip
unzip radio-browser.zip
cd RadioBrowser-Nightly-Builds

# Run installer
chmod +x install.sh
sudo ./install.sh
```

### What the installer does
- Create folder structure (/var/www/extensions/installed/radio-browser/)
- Copy all extension files
- Set correct permissions
- Verify PHP and cURL requirements

## Folder Structure

```
radio-browser/
 assets/          # CSS, JavaScript, images
 backend/         # API PHP backend
 templates/       # HTML templates
 scripts/         # Maintenance shell scripts
 data/            # Persistent data (custom APIs)
 cache/           # Temporary cache (images, API responses)
```

## Custom API Management

Custom APIs are stored in `data/custom_apis.json` and survive cache flushes.

**Add via UI:**
1. Go to Settings  Custom API
2. Enter Name, URL, and Type
3. Click "Add Custom API"

The API will immediately appear in the "Active API" dropdown and "Saved APIs" list.

## Requirements

- moOde Audio Player  8.0.0
- PHP  7.4 with cURL extension
- nginx web server

## Troubleshooting

Built-in tools available in Settings  Troubleshooting:
- **Flush Cache** - Clear API cache and images
- **Fix Permissions** - Reset file/folder permissions
- **Test API** - Verify Radio Browser API connectivity
- **View/Clear Log** - Debug logging

## License

GPL-3.0-or-later

## Author

Rubatron (2026)