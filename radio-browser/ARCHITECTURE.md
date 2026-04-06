# Radio Browser Extension — Architecture

> Technical design document for RubaTron's Radio Browser Extension for moOde Audio Player.
> Version 4.1.0 — April 2026

---

## Overview

Radio Browser is a standalone extension for [moOde audio player](https://moodeaudio.org/) that adds internet radio station browsing via the [radio-browser.info](https://www.radio-browser.info/) API. It integrates into moOde's UI without modifying core system files (except a single hook in `header.php`).

**Stack:** PHP 8.x backend, vanilla JS + jQuery frontend, systemd health monitoring, bash installer.

---

## File Layout

### Extension Directory

```
/var/www/extensions/installed/radio-browser/
├── radio-browser.php           # Main entry point (page view)
├── radio-browser-loader.php    # Loader template (copied to web root)
├── rb-shell-bridge.php         # Header.php hook → injects menu JS
├── manifest.json               # Extension metadata
├── info.json                   # Extended metadata, changelog, features
├── install.sh                  # Interactive menu-driven installer
├── version.txt                 # Version string
├── backend/
│   ├── api.php                 # All API endpoints (32 actions)
│   └── loader-config.php       # Central path manifest
├── assets/
│   ├── radio-browser.js        # Frontend logic (~1700 lines)
│   ├── radio-browser.css       # All styling (~970 lines)
│   └── rb-menu-inject.js       # Injects Radio Browser into moOde menus
├── templates/
│   └── radio-browser.html      # HTML template with PHP variable substitution
├── scripts/
│   ├── clear-recently-played.sh
│   ├── fix-permissions.sh
│   ├── flush-cache.sh
│   └── test-api.sh
├── systemd/
│   ├── radio-browser-health.sh      # Health check script
│   ├── radio-browser-health.service # Oneshot unit
│   └── radio-browser-health.timer   # Runs every 5 minutes
├── cache/                      # API response cache + image cache
│   └── images/                 # Cached station logos (PNG)
└── data/                       # Persistent user data
    ├── settings.json           # Visibility toggles, active API
    ├── custom_apis.json        # User-added API servers
    └── recently_played.json    # Station history
```

### Web Root

```
/var/www/
├── radio-browser.php           # Physical loader file (not a symlink)
└── header.php                  # moOde header (patched: requires rb-shell-bridge.php)
```

> **Why a physical file?** moOde's `worker.php` periodically deletes all symlinks in `/var/www/`. The loader is a real PHP file that survives this cleanup.

---

## Loader Pattern

The extension uses a two-stage loader to serve pages from the extension directory while keeping a stable URL at `/radio-browser.php`:

```
Browser → /var/www/radio-browser.php (loader)
           ├── require loader-config.php → returns path config array
           └── require radio-browser.php → real entry point
                ├── require moOde common.php, session.php
                ├── include header.php (renders moOde chrome)
                ├── load settings.json → populate template variables
                ├── include templates/radio-browser.html
                └── include footer.min.php
```

**`loader-config.php`** is the single source of truth for all paths:

```php
return [
    'id'            => 'radio-browser',
    'ext_base'      => dirname(__DIR__),      // auto-resolves
    'web_root'      => '/var/www',
    'webroot_files' => ['radio-browser.php' => 'radio-browser-loader.php'],
    'dirs'          => ['backend', 'assets', 'cache', 'data', 'templates', 'systemd', 'scripts'],
];
```

---

## Menu Integration

A one-line hook in moOde's `/var/www/header.php` loads `rb-shell-bridge.php`, which injects `rb-menu-inject.js` on every page. This script adds Radio Browser entries to:

- **Library dropdown** — Player → Library → Radio Browser
- **m menu** (gear icon) — Radio Browser item
- **Configure modal** — Quick-access settings tile

Each injection point is controlled by per-area visibility toggles stored in `settings.json`.

---

## API Backend

All API calls go through `backend/api.php` via POST with a `cmd` parameter.

### Endpoints (32)

| Category | Endpoints |
|----------|-----------|
| **Playback** | `play`, `current_status`, `get_stream_url` |
| **Search** | `search`, `test_search`*, `countries`, `genres`, `top_click` |
| **Library** | `import`, `favorites`, `remove`, `recently_played`, `download_m3u` |
| **Settings** | `get_settings`, `set_visibility`, `set_limit` |
| **Status** | `test`, `service_status`, `status` |
| **Maintenance** | `flush_cache`, `repair_thumbnails`, `restart_services`, `repair`, `reinstall`, `reboot` |
| **Logging** | `view_log`, `clear_log` |
| **Lifecycle** | `uninstall` |

*\* `test_search` — debug only, returns raw API response.*

### Key Helper Functions

| Function | Purpose |
|----------|---------|
| `rb_sanitize_station_name()` | Safe filename from station name |
| `rb_fetch_image()` | Curl download with timeout and validation |
| `rb_resize_and_save()` | GD resize to square with white background |
| `rb_cache_get/set()` | File-based JSON cache with TTL |
| `rb_cache_image()` | Download + cache station logo |
| `rb_save_permanent_logo()` | Save logo to moOde's radio image library |
| `rb_get_active_api_host()` | Resolve which API server to query |
| `rb_api()` | Central HTTP client for radio-browser.info API |
| `putStationCover()` | Write cover art for moOde's playback display |

### Caching Strategy

- **API responses**: JSON files in `cache/` with configurable TTL (default 1 hour)
- **Station logos**: PNG files in `cache/images/` keyed by MD5 of URL
- **Permanent logos**: Saved to moOde's `/var/local/www/imagesw/radio-logos/` on import
- Cache key: MD5 of request URL

### Station Metadata Mapping

Radio-browser.info station fields are mapped to moOde's `cfg_radio` columns on both play and import:

| radio-browser.info | cfg_radio | Notes |
|---|---|---|
| `name` | `name` | Station display name |
| `url` / `url_resolved` | `station` | Stream URL (primary key) |
| `homepage` | `home_page` | Set to `'radio-browser'` as origin marker |
| `favicon` | `logo` | Downloaded, converted to JPG, cached locally |
| `tags` | `genre` | Comma-separated genre tags |
| `country` | `country` | Full country name |
| `state` | `region` | Sub-country region |
| `language` | `language` | Spoken language(s) |
| `codec` | `format` | Audio codec (MP3, AAC, etc.) |
| `bitrate` | `bitrate` | Stream bitrate in kbps |
| — | `broadcaster` | No RB equivalent (empty) |
| `stationuuid` | — | No cfg_radio column (tracked in JS/API only) |

---

## Frontend Architecture

`radio-browser.js` (~1700 lines) is a jQuery-based single-page app within moOde's chrome.

### Tab Sections

| Tab | Render Function | Data Source |
|-----|-----------------|-------------|
| Search Stations | `renderStations()` | API `search` / `top_click` |
| Recently Played | `renderRecentlyPlayed()` | API `recently_played` |
| Favorites | `renderFavorites()` | API `favorites` |
| Settings | (static HTML + `loadSettings()`) | API `get_settings` |

### Key Patterns

- **`buildStationCard()`** — Single function builds all station cards (search, recent, favorites). Eliminates 3x duplication.
- **`resolveLogoUrl()`** — Centralized logo URL resolution with cache-busting.
- **`escapeHtml()`** — XSS prevention for all user-facing station data.
- **`notify()`** — Toast notifications (success/error/info).
- **Pagination** — Client-side with configurable page size.

### moOde Integration Points

- `$.post('/command/?cmd=playitem')` — Play station via MPD
- `$.post('/command/?cmd=stop')` — Stop playback
- Reads `currentsong.txt` for now-playing detection
- Activity glow on playbar icon when playing a Radio Browser stream

---

## Health Monitoring

Systemd timer runs `radio-browser-health.sh` every 5 minutes:

1. Checks `/var/www/radio-browser.php` exists (auto-repairs from loader template)
2. Validates PHP files are readable
3. Checks cache directory permissions
4. Pings nginx and php-fpm
5. Tests API endpoint reachability
6. Verifies MPD is running

Logs to journald: `journalctl -u radio-browser-health`

---

## Install Flow

`install.sh` is a menu-driven interactive installer:

1. **Download** — Fetches `files.txt` manifest from GitHub, downloads all files to `/tmp/`
2. **Deploy** — Copies files to `/var/www/extensions/installed/radio-browser/`
3. **Web root** — Copies loader to `/var/www/radio-browser.php` (physical file)
4. **Header patch** — Adds `require_once` for `rb-shell-bridge.php` to moOde's `header.php`
5. **Systemd** — Installs and enables health timer
6. **Permissions** — Sets ownership to `www-data:www-data`
7. **Cache dirs** — Creates `cache/`, `cache/images/`, `data/`

One-liner bootstrap:

```bash
curl -sL https://raw.githubusercontent.com/rubatron/RadioBrowser/develop/radio-browser/install.sh | bash
```

---

## Data Flow

```
User clicks "Search" → radio-browser.js
  → POST /extensions/installed/radio-browser/backend/api.php?cmd=search
    → rb_api() → https://{active_api_host}/json/stations/search
    → rb_cache_set() (store response)
    → Return JSON to browser
  → renderStations() → buildStationCard() × N
  → User clicks "Play"
    → POST api.php?cmd=play
      → rb_add_recently_played()
      → putStationCover() → write thumbnail
      → $.post('/command/?cmd=playitem') → MPD starts stream
```

---

## Security

- All station names sanitized via `rb_sanitize_station_name()` before filesystem use
- HTML output escaped via `escapeHtml()` in JS
- API input validated per-endpoint in PHP
- Shell commands use `escapeshellarg()` where applicable
- Maintenance actions (`reboot`, `restart_services`) require www-data permissions via sudoers
- No direct SQL — uses moOde's `sqlConnect()` wrapper

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| moOde | ≥ 9.0.0 | Host audio player |
| PHP | ≥ 8.0 | Backend API |
| php-curl | — | API HTTP client |
| php-gd | — | Image resize/convert |
| php-json | — | JSON encode/decode |
| jQuery | (moOde bundled) | Frontend DOM/AJAX |
| nginx | (moOde bundled) | Web server |
| MPD | (moOde bundled) | Audio playback |

---

## CSS Theme Variables

All colors are defined as CSS custom properties in `:root` (~50 variables) in `radio-browser.css`. This enables theming without touching individual rules.

### Variable Groups

| Group | Examples | Purpose |
|-------|----------|---------|
| `--rb-accent-*` | `--rb-accent`, `--rb-accent-hover` | Brand orange tones |
| `--rb-bg-*` | `--rb-bg-dark`, `--rb-bg-card` | Background layers |
| `--rb-text-*` | `--rb-text-primary`, `--rb-text-muted` | Text hierarchy |
| `--rb-status-*` | `--rb-status-ok`, `--rb-status-error` | Health indicators |
| `--rb-danger-*` | `--rb-danger-bg`, `--rb-danger-text` | Destructive actions |
| `--rb-badge-*` | `--rb-badge-bg`, `--rb-badge-text` | HiRes badge colors |

---

## moOde Station Detection

Radio Browser shares moOde's native favorites system (`cfg_radio` table, `type='f'`). To distinguish moOde core stations from Radio Browser imports:

### Marker Strategy

- **Radio Browser imports**: `home_page='radio-browser'` set on INSERT, all metadata fields empty
- **moOde core stations**: Have populated metadata (broadcaster, country, region)
- **Legacy imports** (pre-marker): Empty `home_page` AND empty metadata — correctly detected as non-moOde

### Detection Logic

```php
$is_moode = ($hp !== 'radio-browser') && ($bc !== '' || $co !== '' || $rg !== '');
```

A station is moOde core only when:

1. `home_page` is NOT `'radio-browser'` (not an RB import), AND
2. At least one metadata field (`broadcaster`, `country`, or `region`) is populated

This handles all edge cases:

- moOde core (broadcaster='Radio France', home_page='') → **true**
- New RB import (home_page='radio-browser', broadcaster='') → **false**
- Legacy RB import (home_page='', broadcaster='') → **false**

### Detection in API Responses

| Endpoint | Detection | Field |
|----------|-----------|-------|
| `favorites` | Query broadcaster/country/region from cfg_radio | `is_moode: bool` |
| `recently_played` | Stored at play time via DB lookup | `is_moode: bool` |
| `search` | Cross-reference results against cfg_radio metadata | `is_moode: bool` |
| `top_click` | Cross-reference results against cfg_radio metadata | `is_moode: bool` |

### M Badge

Station cards display an `m` badge (bottom-right of thumbnail) for moOde core stations. Badge rendering is in `buildStationCard()` using `.rb-logo-wrapper` + `.rb-moode-badge` CSS classes.

### Filter Toggles

Settings panel has three ON/OFF toggles to show/hide moOde stations:

- `moode_search` — Filter moOde stations in Search results
- `moode_favorites` — Filter moOde stations in Favorites tab
- `moode_recently` — Filter moOde stations in Recently Played tab

State saved via `set_visibility` API, same mechanism as other toggles.

---

## Click Tracking (radio-browser.info Best Practice)

On successful play, the backend sends a fire-and-forget POST to `https://all.api.radio-browser.info/json/url/{stationuuid}`. This increments the station's click counter on radio-browser.info.

- UUID validated with regex before sending
- 3-second timeout, errors silently ignored
- `stationuuid` tracked through full data flow: API response → JS → card attribute → play request → backend

---

## Version Management

`version.txt` is the single source of truth for the runtime version, read by `api.php` and `radio-browser-health.sh`.

### bump-version.sh

Helper script at `scripts/bump-version.sh` synchronizes version across all files:

```bash
./scripts/bump-version.sh 4.1.0           # Update version only
./scripts/bump-version.sh 4.1.0 --branch main  # Also update branch references
```

Updates: `version.txt`, `manifest.json`, `info.json`, header comments in all source files, `ARCHITECTURE.md`, `README.md` badge, `install.sh` branch variable, README install URLs.
