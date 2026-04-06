# Radio Browser — Parking Lot

> **Local workspace file** — not tracked in git, not published to GitHub.
> Use GitHub Issues format for easy promotion when ready.

---

## Code Audit — Completed Fixes (April 2026)

### ✅ CSRF Protection

**Priority:** HIGH | **Status:** Fixed
Token in `$_SESSION` → `<meta>` tag → JS `X-CSRF-Token` header → PHP `rb_verify_csrf()`. Validated at gateway level (line 672) for all non-exempt commands.

### ✅ Prepared Statements (rb_sql)

**Priority:** HIGH | **Status:** Fixed
Replaced all 25 `SQLite3::escapeString()` calls with `rb_sql()` helper using PDO `prepare()/execute()`.

### ✅ Path Traversal Protection

**Priority:** HIGH | **Status:** Fixed
`realpath()` + whitelist on `/extensions/` and `/imagesw/` prefixes.

### ✅ exec() Escaping

**Priority:** HIGH | **Status:** Fixed
`escapeshellarg()` on all variable paths in repair function. `$phpVer` validated with `preg_match('/^\d+\.\d+$/')`.

### ✅ Auth on System Commands

**Priority:** HIGH | **Status:** Fixed
`rb_require_auth()` on restart, reboot, reinstall, uninstall. CSRF gateway covers all commands.

### ✅ recently_played.json Race Condition

**Priority:** MEDIUM | **Status:** Fixed
Rewrote `rb_get_recently_played()` with `LOCK_SH`, `rb_add_recently_played()` with atomic read-modify-write entirely under `LOCK_EX` (single flock scope, no TOCTOU).

### ✅ cfg_radio INSERT Race Condition

**Priority:** MEDIUM | **Status:** Fixed
Play case: `INSERT OR IGNORE`. Import case: `INSERT OR IGNORE` + `UPDATE` (upsert, auto-upgrades type `u` → `f`).

### ✅ Hardcoded Limits → Settings

**Priority:** MEDIUM | **Status:** Fixed
Added `search` limit (default 30) to settings. Search, top_click, recently_played all use settings fallback. Cap raised from 30 to 100 via `set_limit`.

### ✅ sleep() Blocking

**Priority:** MEDIUM | **Status:** Fixed
Replaced `sleep(2)` in import favicon fallback and `sleep(3)` in `putStationCover()` with polling loops (300ms intervals, early exit on file_exists). Post-`fastcgi_finish_request` sleeps kept (non-blocking).

### ✅ Content-Type Headers

**Priority:** LOW | **Status:** Fixed
JSON responses always send `Content-Type: application/json; charset=UTF-8`.

### ✅ Systemd Service (www-data)

**Priority:** MEDIUM | **Status:** Fixed
Health check service runs as www-data with `ProtectSystem=strict`.

### ✅ Permission Hardening

**Priority:** MEDIUM | **Status:** Fixed
`chmod 777` → `chmod 775` on cache directories.

---

## Code Audit — Remaining Items (LOW)

### 🔲 Search Race Condition (AbortController)

**Priority:** Low | **Effort:** Low

Rapid searches can show stale results because previous AJAX requests aren't aborted. Fix: store the `XMLHttpRequest` / `fetch` AbortController and cancel it before launching a new search.

**Location:** `radio-browser.js` — search handler.

---

### 🔲 playStation() Debounce

**Priority:** Low | **Effort:** Low

Rapid click on Play sends multiple `play` requests. Fix: disable the button immediately on click, re-enable after response (or use a simple boolean guard).

**Location:** `radio-browser.js` — `playStation()`.

---

### 🔲 Missing Error Handlers (JS)

**Priority:** Low | **Effort:** Low

`checkCurrentlyPlaying()` and `loadSettings()` have no `.catch()` / error callback. A network blip silently swallows errors. Fix: add `.catch()` with console.warn or retry logic.

**Location:** `radio-browser.js`.

---

### 🔲 DOM Thrashing in checkCurrentlyPlaying()

**Priority:** Low | **Effort:** Medium

Currently does 3 full DOM traversals over 500+ station cards every poll cycle. Fix: maintain a Map of station URLs → card elements and do direct lookup instead of `querySelectorAll` each time.

**Location:** `radio-browser.js` — `checkCurrentlyPlaying()`.

---

### 🔲 Accessibility / ARIA

**Priority:** Low | **Effort:** Medium

- Country autocomplete dropdown is not keyboard-accessible (no arrow-key navigation, no `role="listbox"`)
- No ARIA live regions for search results count or playback status changes
- Station cards lack `role="button"` and keyboard event handlers

**Location:** `radio-browser.js` + `radio-browser.html`.

---

## Parked Features

### 🔲 Custom API Service

**Priority:** Low | **Effort:** Medium

Allow users to add custom radio API endpoints (Icecast, Shoutcast, custom Radio Browser mirrors).

- UI: Sub-accordion with Add New / Remove Existing
- HTML template exists (commented out in radio-browser.html)
- Backend handlers partially implemented (`set_active_api`, dropdown options)
- JS handler removed (was `#rb-save-api`)
- Needs: proper UX design, validation, per-API search routing

**Blocked by:** No clear user demand yet. Revisit if users request custom API support.

---

### 🔲 ETag Caching (API Best Practice P2)

**Priority:** Low | **Effort:** Low

Add ETag/If-None-Match headers to radio-browser.info API requests for bandwidth savings.

- Current approach: TTL file cache (30min default) works well enough
- radio-browser.info mirrors rotate via DNS, ETags not consistent cross-server
- Benefit marginal given our caching strategy

**Blocked by:** No practical benefit over current TTL cache.

---

### 🔲 Station Metadata Enrichment

**Priority:** Medium | **Effort:** Medium

Show richer station metadata: language, homepage link, voting stats, last check time.

- Data available from radio-browser.info API (`votes`, `lastcheckok`, `homepage`, `language`)
- Could add expandable detail panel per card
- Homepage link useful for station verification

---

### 🔲 Playlist / Queue Management

**Priority:** Medium | **Effort:** High

Allow users to queue multiple stations, create named playlists.

- Currently: play replaces current stream (addid + playid)
- Could integrate with moOde's playlist system
- Need to handle MPD queue interaction carefully

---

### 🔲 Station Health Monitoring

**Priority:** Low | **Effort:** Medium

Background checks on favorite stations, alert when stations go offline.

- radio-browser.info provides `lastcheckok` field
- Could add status indicator on favorite cards
- `radio-browser-health.sh` script exists but basic

---

### 🔲 Total Logger Framework

**Priority:** Low | **Effort:** High | **Source:** Gemini advisory (April 2026)

Cross-layer logging orchestrator that correlates Application, OS, and Hardware events.

**What we have now:**

- Debug Mode toggle in Settings → console logging (`[RB DEBUG]`)
- View Log / Clear Log buttons → `radio-browser.log`
- `radio-browser-health.sh` (systemd timer, every 5 min)
- moOde's `moodeutl` for system-level logs

**What the framework would add:**

- **3-layer correlation**: App (PHP/JS/Nginx/MPD) ↔ OS (journald/NetworkManager) ↔ Hardware (vcgencmd throttling, dmesg)
- **Leveled logging**: Critical (always) → Warning (default) → Verbose (toggle) → Debug (explicit) → Full Bundle (system dump)
- **SD-card protection**: RAM-buffered writes, `journald.conf` tuning (`SystemMaxUse=50M`, `Storage=volatile`)
- **UI exports**: One-click "Full Debug Bundle", "RadioBrowser & MPD Only", "Current Session" downloads
- **One-Click Health Check**: vcgencmd (power/thermal) + systemctl status mpd before diving into logs
- **Disk space slider**: Reserved logging space to protect Pi Zero SD card

**Key design principles:**

- No extra packages — native bash/PHP/JS only
- On-demand activation (verbose/debug levels off by default)
- Log rotation via logrotate, single retained file
- Privacy-aware: sanitize network/MAC data before user shares logs

**Open questions:**

- Can we read `vcgencmd` from PHP without sudo? (sudoers entry needed?)
- journald retention vs micro-SD write cycles on Pi Zero 2W
- Which layer causes most support issues? (need user data first)
- Privacy vs completeness tradeoff for Full Debug Bundle

**Blocked by:** Current logging is sufficient for v4.x. Revisit for v5.0 or when support volume justifies the investment.

---

## Suggestions for moOde Developer

> These are security best-practice improvements that apply to moOde's core codebase.
> Radio Browser follows moOde's existing patterns for consistency.
> If moOde adopts these, we should follow suit.

### SQLite Prepared Statements

moOde's `sqlQuery()` helper uses `SQLite3::escapeString()` for all queries. Modern PHP security practice recommends prepared statements with parameter binding (`$stmt->bindValue()`). This eliminates SQL injection risk structurally rather than relying on escaping.

**Impact:** All extensions and core PHP files using `sqlQuery()`.

### CSRF Token Validation

moOde has no CSRF token validation on any endpoint. A malicious page loaded in the same browser could trigger POST requests to moOde's API (e.g., reboot, config changes). While localhost-only access reduces risk, CSRF tokens are a low-effort defense-in-depth measure.

**Implementation:** Generate token in session, validate on all state-changing POST requests.

### Error Suppression (@) Convention

moOde's codebase uses `@` operator extensively to suppress PHP warnings. This hides failures and makes debugging harder. Consider explicit error checking with logging instead of silent suppression.

**Example:** `@file_put_contents(...)` → check return value, log on failure.

---

## Notes

- Features move from here to GitHub Issues when development starts
- Use labels: `enhancement`, `parked`, `needs-design`
