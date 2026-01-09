# 📻 Radio Browser Extension for moOde Audio Player

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![moOde](https://img.shields.io/badge/moOde-8.0%2B-green.svg)](https://moodeaudio.org/)
[![Version](https://img.shields.io/badge/version-3.0.0-orange.svg)](https://github.com/rubatron/RadioBrowser/releases)

A modern web extension that brings the power of [Radio Browser](https://www.radio-browser.info/) to your moOde Audio Player. Browse, search, and play over 30,000 internet radio stations directly from the moOde web interface.


---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Smart Search** | Search by station name, country, or genre |
| ⭐ **Top Stations** | Discover popular stations sorted by listener count |
| 📻 **Recently Played** | Quick access to your listening history |
| ❤️ **Add to Favorites** | Save stations directly to moOde's Radio library |
| 🎨 **Native UI** | Seamlessly integrates with moOde's dark theme |
| 🔧 **Custom APIs** | Add your own radio directory APIs (Shoutcast, Icecast) |
| 🛠️ **Troubleshooting** | Built-in diagnostics and repair tools |
| 💾 **Persistent Storage** | Custom APIs survive cache flushes |

---

## 📋 Requirements

- **moOde Audio Player** ≥ 8.0.0
- **PHP** ≥ 7.4 with cURL extension
- **nginx** web server (included with moOde)

---

## 🚀 Installation

### One-Line Install (Recommended)

SSH into your moOde device and run:

```bash
curl -sSL https://raw.githubusercontent.com/rubatron/RadioBrowser/Nightly-Builds/radio-browser/install.sh | sudo bash
```

Or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/rubatron/RadioBrowser/Nightly-Builds/radio-browser/install.sh | sudo bash
```

---

### Install via Git

```bash
# SSH into your moOde device
ssh pi@moode.local

# Clone the repository
git clone -b Nightly-Builds https://github.com/rubatron/RadioBrowser.git

# Run the installer
cd RadioBrowser/radio-browser && sudo ./install.sh

# Optional: Remove the downloaded repo after install
cd ~ && rm -rf RadioBrowser
```

---

### Install via Download (ZIP)

```bash
# SSH into your moOde device
ssh pi@moode.local

# Download and extract ZIP
wget https://github.com/rubatron/RadioBrowser/archive/refs/heads/Nightly-Builds.zip -O /tmp/rb.zip
unzip -q /tmp/rb.zip -d /tmp
cd /tmp/RadioBrowser-Nightly-Builds/radio-browser && sudo ./install.sh

# Cleanup
rm -rf /tmp/rb.zip /tmp/RadioBrowser-Nightly-Builds
```

---

### Install via Download (TAR.GZ)

```bash
# SSH into your moOde device
ssh pi@moode.local

# Download and extract tarball
wget https://github.com/rubatron/RadioBrowser/archive/refs/heads/Nightly-Builds.tar.gz -O /tmp/rb.tar.gz
tar -xzf /tmp/rb.tar.gz -C /tmp
cd /tmp/RadioBrowser-Nightly-Builds/radio-browser && sudo ./install.sh

# Cleanup
rm -rf /tmp/rb.tar.gz /tmp/RadioBrowser-Nightly-Builds
```

---

### Manual Install (Advanced)

If you prefer to install manually without the installer script:

```bash
# SSH into your moOde device
ssh pi@moode.local

# Create extension directory
sudo mkdir -p /var/www/extensions/installed/radio-browser

# Download and extract
wget https://github.com/rubatron/RadioBrowser/archive/refs/heads/Nightly-Builds.tar.gz -O /tmp/rb.tar.gz
sudo tar -xzf /tmp/rb.tar.gz --strip-components=2 -C /var/www/extensions/installed/radio-browser RadioBrowser-Nightly-Builds/radio-browser

# Set permissions
sudo chown -R www-data:www-data /var/www/extensions/installed/radio-browser
sudo chmod 755 /var/www/extensions/installed/radio-browser
sudo chmod 775 /var/www/extensions/installed/radio-browser/cache
sudo chmod 775 /var/www/extensions/installed/radio-browser/data

# Reload nginx
sudo systemctl reload nginx

# Cleanup
rm /tmp/rb.tar.gz
```

---

### Verify Installation

Open your browser and navigate to:

```
http://moode.local/extensions/installed/radio-browser/radio-browser.php
```

Or access via moOde menu: **☰ → Radio Browser**

---

## 📖 How to Use

### Searching for Stations

1. **Access Radio Browser** - Click the menu icon (☰) → Select "Radio Browser"
2. **Search by Name** - Type keywords like "Jazz", "Classical", or station name
3. **Filter by Country** - Type a country name to filter (autocomplete enabled)
4. **Filter by Genre** - Select from the dropdown (Jazz, Classical, Pop, Rock, etc.)
5. **Click Search** - Results appear in a responsive grid

### Playing a Station

1. **Click the ▶️ Play button** on any station card
2. Station starts playing through moOde
3. Button changes to ⏹️ Stop
4. Station appears in **Recently Played** section

### Adding to Favorites

1. **Click the ❤️ Heart button** on a station card
2. Station is imported to moOde's Radio library
3. Heart turns **orange** to indicate it's saved
4. Access from moOde's main Radio section

### Using Top Stations

1. Click the **⭐ Top Stations** button
2. View the most popular stations globally
3. Great for discovering new stations

### Managing Custom APIs

1. Go to **Settings** tab
2. Open **Custom API** accordion
3. Enter Name, URL, and Type
4. Click **Add Custom API**
5. The API appears in "Saved APIs" and the "Active API" dropdown

---

## ⚙️ Settings & Configuration

### API Status
Shows the connection status to Radio Browser API servers with latency information.

### API Service
Select which API server to use for searches. Includes default (radio-browser.info) and any custom APIs you've added.

### Custom API
Add your own radio directory APIs:
- **Shoutcast**: `https://api.shoutcast.com`
- **Icecast**: `https://dir.xiph.org`
- **Radio-browser.info mirrors**

### Extension Info
Displays version, PHP version, and cURL status.

### Troubleshooting Tools

| Tool | Description |
|------|-------------|
| **Flush Cache** | Clear API cache and cached images |
| **Fix Permissions** | Reset file/folder permissions to correct values |
| **Test API** | Verify connectivity to Radio Browser API |
| **View Log** | Display debug log entries |
| **Clear Log** | Empty the debug log file |
| **Reboot System** | Restart the moOde device |

---

## 📁 Folder Structure

```
radio-browser/
├── install.sh              # Installation script
├── manifest.json           # Extension metadata
├── version.txt             # Version number (3.0.0)
├── info.json               # Extension info for moOde
├── README.md               # This file
├── radio-browser.php       # Main entry point
│
├── assets/
│   ├── radio-browser.js    # Frontend JavaScript
│   ├── radio-browser.css   # Extension styles
│   └── coverart-fix.js     # Album art helper
│
├── backend/
│   └── api.php             # Backend API handler
│
├── templates/
│   └── radio-browser.html  # HTML template
│
├── scripts/
│   ├── fix-permissions.sh  # Permission repair script
│   ├── test-api.sh         # API connectivity test
│   ├── flush-cache.sh      # Cache clearing script
│   └── clear-recently-played.sh
│
├── data/                   # Persistent storage
│   └── custom_apis.json    # Saved custom APIs
│
└── cache/                  # Temporary cache (gitignored)
    └── images/             # Cached station logos
```

---

## 🔧 Troubleshooting

### Extension doesn't appear
```bash
# Check if files exist
ls -la /var/www/extensions/installed/radio-browser/

# Check permissions
sudo chown -R www-data:www-data /var/www/extensions/installed/radio-browser/
sudo chmod -R 755 /var/www/extensions/installed/radio-browser/
```

### No search results
1. Check internet connectivity
2. Go to Settings → API Status → Click Refresh
3. Try Settings → Troubleshooting → Test API
4. Check if API servers are online at [radio-browser.info](https://www.radio-browser.info/)

### Stations won't play
1. Check if MPD is running: `sudo systemctl status mpd`
2. Verify the stream URL is accessible
3. Some stations may be geo-blocked or offline

### Can't add to favorites
1. Check database permissions: `ls -la /var/local/www/db/`
2. Run: Settings → Troubleshooting → Fix Permissions

### Clear everything and start fresh
```bash
# SSH into moOde
cd /var/www/extensions/installed/radio-browser

# Clear cache
sudo rm -rf cache/*
sudo mkdir -p cache/images

# Reset permissions
sudo chown -R www-data:www-data .
sudo chmod -R 755 .
sudo chmod -R 644 *.php *.js *.css *.html *.json *.txt *.md
```

---

## 🛠️ Development

### Local Development

```bash
# Clone the repo
git clone https://github.com/rubatron/RadioBrowser.git
cd RadioBrowser

# Make changes to files in radio-browser/

# Deploy to moOde via SSH
scp -r radio-browser/* pi@moode.local:/var/www/extensions/installed/radio-browser/
```

### Debug Logging

Logs are written to: `/var/www/extensions/installed/radio-browser/cache/radio-browser.log`

View logs:
```bash
tail -f /var/www/extensions/installed/radio-browser/cache/radio-browser.log
```

---

## 📄 Technical Documentation

For detailed technical information about the extension architecture, moOde integration points, and API reference, see [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md).

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Rubatron** - [GitHub](https://github.com/rubatron)

# RadioBrowser
RadioBrowser for Moode
Search and play internet radio stations from radio-browser.info

## Files Included

- `var/www/extensions/installed/radio-browser/backend/api.php` - Added favorites API endpoint
- `var/www/js/scripts-radio-browser.js` - Updated to load and display favorites
- `var/www/templates/radio-browser.html` - Fixed logo path

## Installation

1. Extract the zip file
2. Copy the files to your MoodeAudio installation, preserving the directory structure
3. Restart the web interface or clear browser cache

## Testing

Test on a fresh MoodeAudio installation to verify:
1. Radio Browser extension loads
2. Search and play stations work
3. Adding favorites persists across sessions
4. Favorites are visible in Moode's main radio panel
   
<img width="2129" height="1105" alt="image" src="https://github.com/user-attachments/assets/cd29ebda-3824-4445-9d62-42b3de11d70f" />
<img width="2104" height="1141" alt="image" src="https://github.com/user-attachments/assets/f7bb9d88-138b-4b81-a731-32e174248f29" />

<img width="1152" height="981" alt="image" src="https://github.com/user-attachments/assets/6c496c76-2266-40c8-bf8c-01ca1346e7ad" />
<img width="1456" height="658" alt="image" src="https://github.com/user-attachments/assets/0166f68f-108b-43a0-8ced-ae192e389767" />
