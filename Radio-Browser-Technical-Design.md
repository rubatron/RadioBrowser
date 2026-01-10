# Radio Browser Extension - Technical Design Document

## Overview

The Radio Browser extension for Moode Audio is a web-based interface that allows users to search, play, and save internet radio stations as favorites. The extension fully integrates with the Moode Audio system and uses the existing MPD (Music Player Daemon) for audio playback.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │────│  Nginx Web      │────│  PHP Backend    │
│   (Frontend)    │    │  Server         │    │  (Extensions)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Radio Browser   │    │ Moode SQLite    │    │   MPD Socket    │
│   Templates     │    │   Database      │    │   Interface     │
│   JavaScript    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Frontend Components

#### HTML Template (`radio-browser.html`)
- **Location**: `/var/www/templates/radio-browser.html`
- **Functionality**:
  - Tab-based interface (Search, Settings)
  - Search form with filters (name, country, genre)
  - Results list with station cards
  - Play/stop controls per station
  - Favorite toggle buttons
- **Dependencies**: Bootstrap CSS, FontAwesome icons

#### JavaScript Module (`scripts-radio-browser.js`)
- **Location**: `/var/www/js/scripts-radio-browser.js`
- **Functionality**:
  - AJAX communication with backend API
  - Station search and results display
  - Audio playback controls
  - Favorites management (add/remove)
  - UI state management
- **Key Functions**:
  - `loadTopStations()`: Loads popular stations on startup
  - `searchStations()`: Searches stations via API
  - `playStation()`: Start/stop playback via MPD
  - `addToRadio()`: Adds station to favorites
  - `loadExistingFavorites()`: Loads existing favorites on startup

### 2. Backend Components

#### PHP API (`api.php`)
- **Location**: `/var/www/extensions/installed/radio-browser/backend/api.php`
- **Functionality**: RESTful API endpoints for all Radio Browser operations
- **Endpoints**:
  - `GET /api.php?cmd=status`: Checks API server status
  - `GET /api.php?cmd=countries`: Retrieves countries list
  - `GET /api.php?cmd=genres`: Retrieves genres list
  - `POST /api.php?cmd=search`: Searches stations with filters
  - `POST /api.php?cmd=play`: Start/stop station playback
  - `POST /api.php?cmd=import`: Adds station to favorites
  - `GET /api.php?cmd=favorites`: Retrieves list of favorite stations
  - `GET /api.php?cmd=current_status`: Checks current playback status

#### Radio Browser API Client
- **Functionality**: Communicates with external radio-browser.info API
- **Caching**: Uses file-based caching for performance
- **Fallback Servers**: Automatic failover to backup servers

### 3. Database Components

#### SQLite Database (`moode-sqlite3.db`)
- **Location**: `/var/local/www/db/moode-sqlite3.db`
- **Tables**:
  - `cfg_radio`: Main radio stations table
    ```sql
    CREATE TABLE cfg_radio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station TEXT,      -- Stream URL
        name TEXT,         -- Station name
        type TEXT,         -- 'r' for radio stations
        logo TEXT,         -- Station logo URL
        genre TEXT,        -- Music genre
        broadcaster TEXT,  -- Broadcaster name
        language TEXT,     -- Language
        country TEXT,      -- Country
        region TEXT,       -- Region
        bitrate TEXT,      -- Bitrate
        codec TEXT,        -- Audio codec (MP3, AAC, etc.)
        hls TEXT,          -- HLS support
        homepage TEXT,     -- Website URL
        monitor TEXT       -- Monitoring status
    );
    ```

### 4. External Integrations

#### Music Player Daemon (MPD)
- **Socket**: `localhost:6600`
- **Protocol**: MPD protocol for audio control
- **Commands**:
  - `load`: Load stream URL
  - `play`: Start playback
  - `stop`: Stop playback
  - `status`: Check playback status
  - `currentsong`: Get current track info

#### Radio-Browser.info API
- **Base URL**: `https://all.api.radio-browser.info/json/`
- **Rate Limiting**: Implemented via caching
- **Endpoints**:
  - `/json/servers`: Retrieves list of API servers
  - `/json/countries`: Countries list
  - `/json/tags`: Genres list
  - `/json/stations/search`: Station search
  - `/json/stations/topclick/{limit}`: Popular stations

## Data Flow

### Station Search Flow

```
1. User → HTML Form → JavaScript searchStations()
2. JavaScript → AJAX POST → PHP API (cmd=search)
3. PHP API → Radio Browser API Client → External API
4. External API → JSON Response → API Client
5. API Client → Cached Response → PHP API
6. PHP API → JSON Response → JavaScript
7. JavaScript → HTML Rendering → User Interface
```

### Add Favorites Flow

```
1. User → Heart Icon Click → JavaScript addToRadio()
2. JavaScript → AJAX POST → PHP API (cmd=import)
3. PHP API → Station Data → SQLite INSERT → cfg_radio
4. SQLite → Success Response → PHP API
5. PHP API → JSON Response → JavaScript
6. JavaScript → UI Update (filled heart) → User
```

### Playback Flow

```
1. User → Play Button → JavaScript playStation()
2. JavaScript → AJAX POST → PHP API (cmd=play)
3. PHP API → MPD Socket → load command
4. MPD → Stream Loading → PHP API
5. PHP API → MPD Socket → play command
6. MPD → Audio Playback → System Audio
7. PHP API → Success Response → JavaScript
8. JavaScript → UI Update → User
```

## API Specifications

### Request/Response Format

#### Search Request
```json
POST /extensions/installed/radio-browser/backend/api.php?cmd=search
Content-Type: application/json

{
  "name": "jazz",
  "countrycode": "NL",
  "tag": "jazz",
  "offset": 0,
  "limit": 30
}
```

#### Search Response
```json
{
  "success": true,
  "stations": [
    {
      "name": "Jazz FM",
      "url": "http://stream.jazzfm.nl/jazzfm.mp3",
      "country": "Netherlands",
      "tags": "jazz,smooth jazz",
      "bitrate": 128,
      "codec": "MP3"
    }
  ]
}
```

#### Import Request
```json
POST /extensions/installed/radio-browser/backend/api.php?cmd=import
Content-Type: application/json

{
  "name": "Jazz FM",
  "url": "http://stream.jazzfm.nl/jazzfm.mp3",
  "country": "Netherlands",
  "tags": "jazz",
  "bitrate": 128,
  "codec": "MP3"
}
```

#### Favorites Response
```json
{
  "success": true,
  "favorites": [
    "http://stream.jazzfm.nl/jazzfm.mp3",
    "http://stream.classic.nl/classic.mp3"
  ]
}
```

## Security Considerations

### Input Validation
- All user input is validated in PHP backend
- SQL injection prevention via prepared statements
- XSS prevention via HTML escaping in JavaScript

### API Security
- Rate limiting via caching layer
- Timeout configuration for external API calls
- Error handling without leaking sensitive information

### File System Security
- Correct file permissions set
- Cache directory protected from web access
- Log files controlled

## Performance Optimizations

### Caching Strategy
- **File-based Caching**: External API responses cached for 5-60 minutes
- **Client-side Caching**: Favorites list cached in JavaScript
- **Database Indexing**: cfg_radio table indexed on relevant columns

### Lazy Loading
- Stations loaded in batches of 30
- Infinite scroll implementation for large results
- On-demand loading of station details

### Network Optimization
- AJAX requests use gzip compression
- Timeout configuration prevents hanging requests
- Connection pooling for MPD communication

## Monitoring & Debugging

### Logging
- PHP error logging to `/var/log/php_errors.log`
- Extension-specific logging to `/var/local/www/extensions/logs/radio-browser.log`
- JavaScript console logging for frontend debugging

### Health Checks
- API server status monitoring
- MPD connectivity checks
- Database connection validation

## Deployment & Maintenance

### Installation Process
1. Copy extension files to `/var/www/extensions/installed/radio-browser/`
2. Copy JavaScript to `/var/www/js/`
3. Copy HTML template to `/var/www/templates/`
4. Check database schema
5. Set permissions

### Update Strategy
- Rolling updates with backup of existing configuration
- Database migrations for schema changes
- Cache invalidation after updates

### Troubleshooting
- Cache clearing: `rm -rf /var/local/www/extensions/cache/radio-browser/*`
- Log analysis: `tail -f /var/log/php_errors.log`
- Database integrity: `sqlite3 /var/local/www/db/moode-sqlite3.db .integrity`

## Future Enhancements

### Potential Improvements
- **Advanced Search**: Full-text search in local database
- **Playlist Integration**: Direct integration with Moode playlists
- **Station Metadata**: Extended station information caching
- **User Profiles**: Personal favorites per user
- **Social Features**: Station sharing and ratings

### Scalability Considerations
- Database sharding for large favorites collections
- CDN integration for logo images
- Background processing for bulk imports

---
</content>
