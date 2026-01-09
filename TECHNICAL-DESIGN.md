# Radio Browser Extension - Technical Design Document

**Version:** 3.0.0  
**Date:** January 9, 2026  
**Author:** Rubatron

---

## 1. Overview

The Radio Browser extension integrates the [Radio Browser API](https://www.radio-browser.info/) with the moOde Audio Player, enabling users to search, browse, and play internet radio stations directly from the moOde web interface.

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           moOde Web Interface                            │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │ header.php  │  │           Radio Browser Extension               │   │
│  │ footer.php  │  │  ┌─────────────────────────────────────────┐   │   │
│  │  (moOde)    │  │  │         radio-browser.php              │   │   │
│  └──────┬──────┘  │  │  - Includes moOde header/footer        │   │   │
│         │         │  │  - Loads templates & assets            │   │   │
│         │         │  └──────────────────┬──────────────────────┘   │   │
│         │         │                     │                           │   │
│         │         │  ┌──────────────────▼──────────────────────┐   │   │
│         │         │  │      radio-browser.html (Template)      │   │   │
│         │         │  │  - Search form                          │   │   │
│         │         │  │  - Results grid                         │   │   │
│         │         │  │  - Settings panel                       │   │   │
│         │         │  └──────────────────┬──────────────────────┘   │   │
│         │         │                     │                           │   │
│         │         │  ┌──────────────────▼──────────────────────┐   │   │
│         │         │  │    radio-browser.js (Frontend Logic)    │   │   │
│         │         │  │  - AJAX requests                        │   │   │
│         │         │  │  - UI interactions                      │   │   │
│         │         │  │  - State management                     │   │   │
│         │         │  └──────────────────┬──────────────────────┘   │   │
│         │         │                     │ AJAX                      │   │
│         │         │  ┌──────────────────▼──────────────────────┐   │   │
│         │         │  │        api.php (Backend API)            │   │   │
│         │         │  │  - Proxy to Radio Browser API           │   │   │
│         │         │  │  - Station playback control             │   │   │
│         │         │  │  - Favorites management                 │   │   │
│         │         │  └──────────────────┬──────────────────────┘   │   │
│         │         └─────────────────────┼───────────────────────────┘   │
│         │                               │                               │
└─────────┼───────────────────────────────┼───────────────────────────────┘
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌───────────────────────────────────────────┐
│    moOde Core       │       │           External Services               │
│  ┌───────────────┐  │       │  ┌─────────────────────────────────────┐  │
│  │ MPD Daemon    │◄─┼───────┼──┤  Radio Browser API                  │  │
│  │ (Music Play)  │  │       │  │  https://all.api.radio-browser.info │  │
│  └───────────────┘  │       │  └─────────────────────────────────────┘  │
│  ┌───────────────┐  │       │  ┌─────────────────────────────────────┐  │
│  │ SQLite DB     │◄─┼───────┼──┤  Radio Stream URLs                  │  │
│  │ (Stations)    │  │       │  │  (Various streaming servers)        │  │
│  └───────────────┘  │       │  └─────────────────────────────────────┘  │
│  ┌───────────────┐  │       └───────────────────────────────────────────┘
│  │ Radio Logos   │  │
│  │ /imagesw/     │  │
│  └───────────────┘  │
└─────────────────────┘
```

---

## 2. moOde Integration Points

### 2.1 File System Integration

| Extension Path | moOde System Path | Purpose |
|----------------|-------------------|---------|
| `/var/www/extensions/installed/radio-browser/` | - | Extension installation directory |
| `radio-browser.php` → `/var/www/header.php` | Include | moOde header, navigation, session |
| `radio-browser.php` → `/var/www/footer.min.php` | Include | moOde footer, modals, scripts |
| `api.php` → `/var/www/inc/common.php` | Include | Core moOde functions |
| `api.php` → `/var/www/inc/session.php` | Include | Session management |
| `api.php` → `/var/www/inc/sql.php` | Include | SQLite database access |
| Station logos → `/var/local/www/imagesw/radio-logos/` | Write | Permanent logo storage |

### 2.2 Database Integration

The extension interacts with moOde's SQLite database (`/var/local/www/db/moode-sqlite3.db`):

```sql
-- RADIO_STATIONS table (moOde core)
CREATE TABLE cfg_radio (
    id INTEGER PRIMARY KEY,
    station VARCHAR(100),
    name VARCHAR(100),
    type VARCHAR(16),
    logo VARCHAR(256),
    home_page VARCHAR(256),
    bitrate VARCHAR(16),
    format VARCHAR(16),
    genre VARCHAR(256),
    broadcaster VARCHAR(256),
    language VARCHAR(256),
    country VARCHAR(256),
    region VARCHAR(256),
    geo_fenced VARCHAR(16)
);
```

**Station Import Flow:**
```
Radio Browser API → api.php (import cmd) → cfg_radio table → moOde Radio Library
```

### 2.3 MPD Integration

The extension controls playback through moOde's command interface:

```php
// Play station via moOde command endpoint
$url = '/command/?cmd=playitem&path=' . rawurlencode($streamUrl) . '&title=' . rawurlencode($stationName);

// Stop playback
$url = '/command/?cmd=stop';

// Get current song info
$currentSong = file_get_contents('/var/local/www/currentsong.txt');
```

**MPD Command Flow:**
```
Extension → /command/index.php → MPD socket → Audio output
```

### 2.4 Session Integration

```php
// Extension uses moOde session handling
require_once '/var/www/inc/session.php';

phpSession('open');
$_SESSION['config_back_link'] = '/index.php';
storeBackLink($section, $tpl);
```

### 2.5 CSS/JS Integration

The extension loads after moOde's core styles, allowing proper cascading:

```php
// In radio-browser.php
include('/var/www/header.php');  // Loads styles.min.css, jQuery, etc.

// Extension-specific (loaded AFTER moOde CSS/JS)
echo '<link rel="stylesheet" href="css/main.min.css">';  // Modal styling
echo '<link rel="stylesheet" href="assets/radio-browser.css">';
echo '<script src="assets/radio-browser.js" defer></script>';
```

---

## 3. Component Details

### 3.1 Backend API (api.php)

**Endpoint:** `/extensions/installed/radio-browser/backend/api.php`

| Command | Method | Description | moOde Integration |
|---------|--------|-------------|-------------------|
| `search` | POST | Search stations by name/country/tag | None (external API) |
| `top_click` | POST | Get top clicked stations | None (external API) |
| `play` | POST | Play a station | MPD via `/command/` |
| `import` | POST | Save station to Radio library | SQLite `cfg_radio` table |
| `favorites` | GET | List saved radio stations | SQLite `cfg_radio` table |
| `remove` | POST | Remove station from library | SQLite `cfg_radio` table |
| `recently_played` | GET | Get recently played list | Local JSON file |
| `status` | POST | Check API server status | None (external API) |
| `system_info` | GET | Get PHP/cURL info | PHP system |
| `custom_apis_list` | GET | List custom APIs | Local JSON file |
| `custom_api_add` | POST | Add custom API | Local JSON file |
| `custom_api_remove` | POST | Remove custom API | Local JSON file |
| `flush_cache` | POST | Clear cached data | Local cache folder |
| `fix_permissions` | POST | Reset file permissions | Shell commands |
| `reboot` | POST | Reboot system | `sudo /sbin/reboot` |

### 3.2 Frontend JavaScript (radio-browser.js)

**State Management:**
```javascript
var state = {
    offset: 0,           // Pagination offset
    limit: 30,           // Results per page
    loading: false,      // Loading indicator
    currentPlaying: null,// Currently playing URL
    stationData: [],     // Cached station data
    favorites: [],       // Favorite station URLs
    favoritesMap: {},    // Quick lookup map
    recentlyPlayed: [],  // Recently played list
    hasSearched: false,  // Prevents init overwriting search
    initComplete: false  // Initialization flag
};
```

**Key Functions:**
- `searchStations()` - AJAX search with country/genre filters
- `playStation(card)` - Start playback via backend
- `addToRadio(card)` - Import station to moOde Radio library
- `checkCurrentlyPlaying()` - Sync play state with moOde
- `loadCustomApis()` / `addCustomApi()` / `removeCustomApi()` - Custom API CRUD

### 3.3 Data Storage

| File | Location | Purpose | Survives Cache Flush |
|------|----------|---------|---------------------|
| `custom_apis.json` | `data/` | Custom API configurations | ✅ Yes |
| `recently_played.json` | `cache/` | Recently played stations | ❌ No |
| `*.json` (MD5 hash) | `cache/` | API response cache | ❌ No |
| `*.png` | `cache/images/` | Cached station logos | ❌ No |

---

## 4. Request Flow Examples

### 4.1 Search and Play Flow

```
User → [Search "Jazz"]
         ↓
radio-browser.js → searchStations()
         ↓ AJAX POST
api.php?cmd=search → name=Jazz&countrycode=NL
         ↓ cURL
https://de2.api.radio-browser.info/json/stations/search
         ↓ JSON response
api.php → Cache response → Return to JS
         ↓
radio-browser.js → renderStations() → Display cards
         ↓
User → [Click Play ▶️]
         ↓
radio-browser.js → playStation()
         ↓ AJAX POST
api.php?cmd=play → {url, name, logo...}
         ↓
api.php → addRecentlyPlayed() → Save to JSON
         ↓
api.php → file_get_contents('/command/?cmd=playitem&path=...')
         ↓
moOde /command/index.php → MPD → Audio output
         ↓
api.php → Return success
         ↓
radio-browser.js → Update UI (show ⏹️ icon)
```

### 4.2 Import to Radio Library Flow

```
User → [Click ❤️ Add to Favorites]
         ↓
radio-browser.js → addToRadio()
         ↓ AJAX POST
api.php?cmd=import → {station data}
         ↓
api.php → Download logo → Save to /imagesw/radio-logos/
         ↓
api.php → sqlInsert('cfg_radio', $stationData)
         ↓
moOde SQLite → Station saved
         ↓
api.php → Return success
         ↓
radio-browser.js → Update UI (❤️ turns orange)
```

---

## 5. Configuration Files

### 5.1 manifest.json
```json
{
    "id": "radio-browser",
    "name": "Radio Browser",
    "version": "3.0.0",
    "description": "Browse and play internet radio stations",
    "type": "source",
    "author": "Rubatron",
    "requires": {
        "moode": ">=8.0.0",
        "php": ">=7.4"
    },
    "main": "radio-browser.php"
}
```

### 5.2 custom_apis.json (Example)
```json
{
    "custom_shoutcast_03b7c5": {
        "name": "Shoutcast Directory",
        "url": "https://api.shoutcast.com",
        "type": "shoutcast",
        "added": "2026-01-09 18:04:21"
    }
}
```

---

## 6. Security Considerations

| Aspect | Implementation |
|--------|----------------|
| Input Validation | All user inputs sanitized via `htmlspecialchars()`, URL validation |
| SQL Injection | Uses moOde's `sqlQuery()` with parameterized queries |
| XSS Prevention | JavaScript `escapeHtml()` for all rendered content |
| File Permissions | www-data:www-data ownership, 755 folders, 644 files |
| API Rate Limiting | Caching with TTL (1800s for searches, 86400s for static data) |
| Shell Commands | Limited to specific allowed commands, sudo via sudoers.d |

---

## 7. Error Handling

```php
// Backend error response format
$response = [
    'success' => false,
    'message' => 'Error description',
    'error_code' => 'SPECIFIC_ERROR'
];

// Frontend notification
notify('Error', data.message, 'error');
```

**Fallback Mechanisms:**
- Multiple Radio Browser API servers (de2, nl1, fi1, us1, etc.)
- Automatic server discovery via DNS
- Cached responses served when API is unavailable
- Default logo fallback for missing station artwork

---

## 8. Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| API Response Caching | JSON files in `cache/` with 30-minute TTL |
| Image Caching | Station logos cached locally, 1MB limit |
| Lazy Loading | Results loaded on-demand with pagination |
| Debounced Search | Country autocomplete with input debounce |
| Minified Assets | CSS/JS can be minified for production |

---

## 9. Dependencies

### 9.1 moOde Components Used
- `header.php` - Page structure, navigation
- `footer.min.php` - Closing tags, modals
- `/inc/common.php` - Core functions
- `/inc/session.php` - Session handling
- `/inc/sql.php` - Database functions
- `/command/index.php` - MPD control
- jQuery (bundled with moOde)
- Font Awesome (bundled with moOde)

### 9.2 External APIs
- Radio Browser API: `https://all.api.radio-browser.info`
- DNS discovery: `_api._tcp.radio-browser.info`

### 9.3 PHP Extensions
- cURL (required)
- JSON (required)
- GD (optional, for image processing)

---

## 10. Versioning

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial release |
| 2.0.0 | Jan 2026 | Complete rewrite, moOde integration |
| 2.0.3 | Jan 2026 | Search fix, system info, API status colors |
| 3.0.0 | Jan 2026 | Custom API management, data persistence |

---

*Document generated: January 9, 2026*
