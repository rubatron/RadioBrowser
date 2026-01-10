# RubaTron's Radio Browser Installer

![Radio Browser](https://img.shields.io/badge/Radio-Browser-blue?style=for-the-badge&logo=radio)
![Moode Audio](https://img.shields.io/badge/Moode-Audio-red?style=for-the-badge)
![PHP](https://img.shields.io/badge/PHP-8.4+-purple?style=for-the-badge)
![Bash](https://img.shields.io/badge/Bash-Script-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

## 🎵 About

**RubaTron's Radio Browser Installer** is an installation package for the Radio Browser extension in Moode Audio. This extension allows you to browse and play thousands of internet radio stations directly from your Moode Audio interface built on the radio-info API.
![RadioBrowser screenshot](https://i.postimg.cc/3rbVZCrF/image.png "RadioBrowser")


### Radio Browser Interface
*The Radio Browser interface provides an intuitive way to browse and play thousands of internet radio stations with advanced search and filtering capabilities.*

## 🎵 About

**RubaTron's Radio Browser Installer** is an installation package for the Radio Browser extension in Moode Audio. This extension allows you to browse and play thousands of internet radio stations directly from your Moode Audio interface.

## ✨ Features

- 🔄 **Automatic Backup** before installation
- ✅ **System Requirements Check** with detailed reporting
- 🛠️ **One-Click Installation** with proper permissions
- 🔄 **Restore Functionality** from backups
- 🧹 **Clean Uninstall** option
- 📊 **Installation Logging** for troubleshooting
- 🌐 **Redundant API Integration** with Radio-Browser.info
- 🎯 **Country Selection** including custom ISO codes
- ⭐ **Top Stations** and search functionality

## Experimental Features/ Work in progress
 - **Custom API** not working flawlessly 

## 📋 Requirements

- **Moode Audio** (Raspberry Pi based music player)
- **PHP 8.4+** with cURL extension
## Installation

### Quick Install (Recommended)

Download and run the installer directly:

```bash
wget https://github.com/rubatron/RadioBrowser/raw/refs/heads/main/radio-browser.zip
unzip radio-browser.zip
cd radio-browser/
chmod +x install.sh
sudo bash install.sh
```

Then select option **1** (Auto-install) from the menu.

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

## Custom API Management (IN DEVELOPMENT!!)

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
- ** Restart NginX webservice and remove server caching**
- **Fix Permissions** - Reset file/folder permissions
- **Test API** - Verify Radio Browser API connectivity
- **View/Clear Log** - Debug logging

## License

GPL-3.0-or-later

## Author

Rubatron (2026)
