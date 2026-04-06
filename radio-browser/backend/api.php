<?php

/**
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Backend API
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 4.0.0
 */

// --- EXTENSIEVE BACKEND LOGGING ---
function rb_debug_log($msg)
{
    @file_put_contents(RB_LOG, '[DEBUG ' . date('c') . '] ' . $msg . "\n", FILE_APPEND);
}

require_once '/var/www/inc/common.php';
require_once '/var/www/inc/session.php';
require_once '/var/www/inc/sql.php';

/**
 * Sanitize station name for use as a safe filename.
 * Strips characters invalid on Linux filesystems (/ and null byte) and trims whitespace.
 * Falls back to md5 hash if result is empty.
 */
function rb_sanitize_station_name($name)
{
    $safe = trim(str_replace(['/', '\0'], '', $name));
    return $safe !== '' ? $safe : 'station_' . md5($name);
}

/**
 * Download an image from URL via curl.
 * Returns raw image data on success, false on failure.
 */
function rb_fetch_image($url, $timeout = 10)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_USERAGENT => RB_UA,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3
    ]);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($data !== false && $httpCode == 200 && strlen($data) > 100) {
        return $data;
    }
    rb_debug_log("rb_fetch_image: Failed to fetch $url (HTTP $httpCode)");
    return false;
}

/**
 * Resize a source GD image to a square with white background, save as JPG.
 * Returns true on success, false on failure.
 */
function rb_resize_and_save($srcImage, $srcWidth, $srcHeight, $size, $outputPath, $quality = 85)
{
    $canvas = imagecreatetruecolor($size, $size);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefill($canvas, 0, 0, $white);

    $scale = min($size / $srcWidth, $size / $srcHeight);
    $newWidth = (int)($srcWidth * $scale);
    $newHeight = (int)($srcHeight * $scale);
    $x = (int)(($size - $newWidth) / 2);
    $y = (int)(($size - $newHeight) / 2);

    imagecopyresampled($canvas, $srcImage, $x, $y, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);
    $saved = @imagejpeg($canvas, $outputPath, $quality);
    imagedestroy($canvas);
    return $saved;
}

// --- CONFIG ---
// Primary API: DNS load-balanced (auto-routes to nearest mirror: de1, nl1, etc.)
define('RB_API_PRIMARY', 'all.api.radio-browser.info');
// Fallback servers if DNS fails (rare but possible)
define('RB_FALLBACK', [
    'de2.api.radio-browser.info',   // Germany
    'nl1.api.radio-browser.info',   // Netherlands
    'fi1.api.radio-browser.info',   // Finland
    'at1.api.radio-browser.info',   // Austria
]);
define('RB_CACHE', __DIR__ . '/../cache');
define('RB_IMAGE_CACHE', __DIR__ . '/../cache/images');
define('RB_LOG', __DIR__ . '/../cache/radio-browser.log');
define('RB_UA', 'moode-radio-browser/1.0');
define('RB_CACHE_TTL', 1800);
define('RB_CACHE_TTL_STATIC', 43200);
define('RB_IMAGE_CACHE_SIZE_MB', 1); // 1MB cache size limit

// Define moOde constants if not already defined (for logo handling)
if (!defined('RADIO_LOGOS_ROOT')) {
    define('RADIO_LOGOS_ROOT', '/var/local/www/imagesw/radio-logos/');
}
if (!defined('TMP_IMAGE_PREFIX')) {
    define('TMP_IMAGE_PREFIX', '__tmp__');
}
if (!defined('DEFAULT_NOTFOUND_COVER')) {
    define('DEFAULT_NOTFOUND_COVER', '/var/www/images/radio-logo.png');
}

// Radio Browser's own default logo (used instead of moOde's generic cover)
define('RB_DEFAULT_LOGO', __DIR__ . '/../assets/rb-default-logo.jpg');

// File-based recently played (persistent, ordered by play time)
define('RB_RECENTLY_PLAYED_FILE', RB_CACHE . '/recently_played.json');

// File-based custom API storage (in data folder, NOT cache - survives cache flush)
define('RB_DATA_DIR', __DIR__ . '/../data');
define('RB_CUSTOM_APIS_FILE', RB_DATA_DIR . '/custom_apis.json');
define('RB_SETTINGS_FILE', RB_DATA_DIR . '/settings.json');
// NOTE: Favorites use moOde's native system (type='f' in cfg_radio)
// This integrates with moOde's Favorites playlist

// --- PATH CONSTANTS ---
define('RB_EXT_BASE', dirname(__DIR__));
define('RB_HEADER_FILE', '/var/www/header.php');
define('RB_MPD_HOST', 'localhost');
define('RB_MPD_PORT', 6600);

function rb_get_custom_apis()
{
    if (file_exists(RB_CUSTOM_APIS_FILE)) {
        $data = @json_decode(file_get_contents(RB_CUSTOM_APIS_FILE), true);
        return is_array($data) ? $data : [];
    }
    return [];
}

function rb_save_custom_apis($apis)
{
    if (!is_dir(RB_DATA_DIR)) @mkdir(RB_DATA_DIR, 0775, true);
    return @file_put_contents(RB_CUSTOM_APIS_FILE, json_encode($apis, JSON_PRETTY_PRINT)) !== false;
}

function rb_add_custom_api($name, $url, $type)
{
    $apis = rb_get_custom_apis();

    // Generate unique ID
    $id = 'custom_' . preg_replace('/[^a-z0-9]/', '_', strtolower($name)) . '_' . substr(md5($url), 0, 6);

    // Check for duplicate URL
    foreach ($apis as $api) {
        if ($api['url'] === $url) {
            return ['success' => false, 'message' => 'API with this URL already exists'];
        }
    }

    $apis[$id] = [
        'name' => $name,
        'url' => $url,
        'type' => $type,
        'added' => date('Y-m-d H:i:s')
    ];

    if (rb_save_custom_apis($apis)) {
        rb_debug_log('Custom API added: ' . $name . ' (' . $url . ')');
        return ['success' => true, 'message' => 'Custom API added', 'id' => $id, 'apis' => $apis];
    }
    return ['success' => false, 'message' => 'Failed to save custom API'];
}

function rb_remove_custom_api($id)
{
    $apis = rb_get_custom_apis();

    if (!isset($apis[$id])) {
        return ['success' => false, 'message' => 'Custom API not found'];
    }

    $name = $apis[$id]['name'];
    unset($apis[$id]);

    if (rb_save_custom_apis($apis)) {
        rb_debug_log('Custom API removed: ' . $name);
        return ['success' => true, 'message' => 'Custom API removed', 'apis' => $apis];
    }
    return ['success' => false, 'message' => 'Failed to remove custom API'];
}

// ============================================================================
// SETTINGS / VISIBILITY FUNCTIONS
// ============================================================================

function rb_get_default_settings()
{
    return [
        'visibility' => [
            'library' => true,
            'm' => true,
            'system' => true,
            'playbar' => true,
            'download' => true,
            'activityglow' => true,
            'moode_favorites' => true,
            'moode_recently' => true,
            'moode_search' => true
        ],
        'limits' => [
            'recentlyPlayed' => 0,  // 0 = no limit (show all)
            'favorites' => 0        // 0 = no limit (show all)
        ],
        'active_api' => 'radio-browser-info',  // default or custom_* ID
        'version' => '4.0.0',
        'updated' => date('Y-m-d H:i:s')
    ];
}

function rb_get_settings()
{
    $settings = rb_get_default_settings();

    // Load from local settings file
    if (file_exists(RB_SETTINGS_FILE)) {
        $data = @json_decode(file_get_contents(RB_SETTINGS_FILE), true);
        if (is_array($data)) {
            $settings = array_replace_recursive($settings, $data);
        }
    }

    return $settings;
}

function rb_save_settings($settings)
{
    if (!is_dir(RB_DATA_DIR)) @mkdir(RB_DATA_DIR, 0775, true);
    $settings['updated'] = date('Y-m-d H:i:s');
    return @file_put_contents(RB_SETTINGS_FILE, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) !== false;
}

function rb_set_visibility($area, $visible)
{
    $allowed = ['library', 'm', 'system', 'playbar', 'download', 'activityglow', 'moode_favorites', 'moode_recently', 'moode_search'];
    if (!in_array($area, $allowed, true)) {
        return ['success' => false, 'error' => 'Invalid area.'];
    }

    $settings = rb_get_settings();
    if (!isset($settings['visibility']) || !is_array($settings['visibility'])) {
        $settings['visibility'] = rb_get_default_settings()['visibility'];
    }

    $settings['visibility'][$area] = (bool)$visible;

    // Ensure all visibility keys exist
    foreach ($allowed as $key) {
        if (!array_key_exists($key, $settings['visibility'])) {
            // All visibility defaults to true
            $settings['visibility'][$key] = true;
        }
    }

    if (rb_save_settings($settings)) {
        rb_debug_log('Visibility updated: ' . $area . ' = ' . ($visible ? 'visible' : 'hidden'));
        return [
            'success' => true,
            'area' => $area,
            'visible' => $visible,
            'visibility' => $settings['visibility']
        ];
    }
    return ['success' => false, 'error' => 'Failed to save settings'];
}

function rb_get_recently_played()
{
    if (file_exists(RB_RECENTLY_PLAYED_FILE)) {
        $data = @json_decode(file_get_contents(RB_RECENTLY_PLAYED_FILE), true);
        return is_array($data) ? $data : [];
    }
    return [];
}

function rb_add_recently_played($station)
{
    $list = rb_get_recently_played();

    // Remove existing entry with same URL (to move it to top)
    $url = trim($station['url']);
    $list = array_filter($list, function ($item) use ($url) {
        return $item['url'] !== $url;
    });
    $list = array_values($list); // Re-index

    // Check if this is a moOde core station (has metadata like broadcaster/country/region, not an RB import)
    $is_moode = false;
    $dbh = sqlConnect();
    if ($dbh) {
        $result = sqlQuery("SELECT home_page, broadcaster, country, region FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' LIMIT 1", $dbh);
        if (is_array($result) && count($result) > 0) {
            $hp = trim($result[0]['home_page'] ?? '');
            $bc = trim($result[0]['broadcaster'] ?? '');
            $co = trim($result[0]['country'] ?? '');
            $rg = trim($result[0]['region'] ?? '');
            $is_moode = ($hp !== 'radio-browser') && ($bc !== '' || $co !== '' || $rg !== '');
        }
    }

    // Add to beginning (most recent first)
    array_unshift($list, [
        'url' => $url,
        'name' => $station['name'] ?? 'Radio Browser Station',
        'logo' => $station['logo'] ?? 'local',
        'country' => $station['country'] ?? '',
        'tags' => $station['tags'] ?? '',
        'bitrate' => $station['bitrate'] ?? 0,
        'codec' => $station['codec'] ?? '',
        'is_moode' => $is_moode,
        'played_at' => time()
    ]);

    // Keep only last 30 (enough for display limits)
    $list = array_slice($list, 0, 30);

    // Save to file
    @file_put_contents(RB_RECENTLY_PLAYED_FILE, json_encode($list, JSON_PRETTY_PRINT));
    rb_debug_log('Recently played updated: ' . ($station['name'] ?? 'Unknown') . ' now first, total: ' . count($list));

    return $list;
}

// Log elke inkomende request
$cmd = $_GET['cmd'] ?? $_POST['cmd'] ?? '';
rb_debug_log('IN: cmd=' . $cmd . ', params=' . json_encode($_REQUEST) . ', IP=' . $_SERVER['REMOTE_ADDR']);

// rb_log() removed — use rb_debug_log() for all logging

function rb_cache_get($key, $ttl)
{
    $file = RB_CACHE . '/' . md5($key) . '.json';
    if (file_exists($file) && (time() - filemtime($file) < $ttl)) {
        $data = @file_get_contents($file);
        if ($data !== false) return json_decode($data, true);
    }
    return false;
}
function rb_cache_set($key, $data)
{
    if (!is_dir(RB_CACHE)) @mkdir(RB_CACHE, 0777, true);
    $file = RB_CACHE . '/' . md5($key) . '.json';
    @file_put_contents($file, json_encode($data));
}

// Image caching functions
function rb_cache_image($url)
{
    if (empty($url)) return false;

    $url_hash = md5($url);
    $cache_file = RB_IMAGE_CACHE . '/' . $url_hash . '.png';

    // Check if image is already cached
    if (file_exists($cache_file) && (time() - filemtime($cache_file) < RB_CACHE_TTL_STATIC)) {
        return '/extensions/installed/radio-browser/cache/images/' . $url_hash . '.png';
    }

    // Download and cache the image
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_USERAGENT => RB_UA,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3
    ]);

    $image_data = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($image_data && $http_code == 200 && strlen($image_data) < 50000) { // Max 50KB per image
        if (!is_dir(RB_IMAGE_CACHE)) @mkdir(RB_IMAGE_CACHE, 0777, true);

        // Check cache size before adding new image
        rb_cleanup_image_cache();

        if (@file_put_contents($cache_file, $image_data)) {
            return '/extensions/installed/radio-browser/cache/images/' . $url_hash . '.png';
        }
    }

    return false;
}

/**
 * Save station logo permanently as JPG to moOde radio-logos folder
 * Converts any image format (PNG, GIF, WEBP) to JPG
 * @param string $stationName Station name (used as filename) - must match cfg_radio name exactly
 * @param string $imageData Raw image binary data
 * @return bool Success
 */
function rb_save_permanent_logo($stationName, $imageData)
{
    if (empty($stationName) || empty($imageData)) {
        rb_debug_log('rb_save_permanent_logo: Empty station name or image data');
        return false;
    }

    $safeName = rb_sanitize_station_name($stationName);

    $logoPath = RADIO_LOGOS_ROOT . $safeName . '.jpg';
    $thumbPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '.jpg';
    $thumbSmPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '_sm.jpg';

    rb_debug_log('rb_save_permanent_logo: Station "' . $stationName . '" -> files: ' . $safeName . '.jpg');
    rb_debug_log('rb_save_permanent_logo: Logo path: ' . $logoPath);
    rb_debug_log('rb_save_permanent_logo: Thumb path: ' . $thumbPath);
    rb_debug_log('rb_save_permanent_logo: ThumbSm path: ' . $thumbSmPath);

    // Create image from data (auto-detect format)
    $srcImage = @imagecreatefromstring($imageData);
    if (!$srcImage) {
        rb_debug_log('rb_save_permanent_logo: Failed to create image from data');
        return false;
    }

    // Get original dimensions
    $srcWidth = imagesx($srcImage);
    $srcHeight = imagesy($srcImage);

    // Create directories if needed
    if (!is_dir(RADIO_LOGOS_ROOT)) {
        @mkdir(RADIO_LOGOS_ROOT, 0755, true);
    }
    if (!is_dir(RADIO_LOGOS_ROOT . 'thumbs/')) {
        @mkdir(RADIO_LOGOS_ROOT . 'thumbs/', 0755, true);
    }

    // Save main logo (400x400), thumbnail (200x200), small thumbnail (80x80 - required by moOde playbar)
    $mainSaved = rb_resize_and_save($srcImage, $srcWidth, $srcHeight, 400, $logoPath);
    rb_debug_log('rb_save_permanent_logo: Main logo saved: ' . ($mainSaved ? 'YES' : 'NO'));

    $thumbSaved = rb_resize_and_save($srcImage, $srcWidth, $srcHeight, 200, $thumbPath);
    rb_debug_log('rb_save_permanent_logo: Thumbnail saved: ' . ($thumbSaved ? 'YES' : 'NO'));

    $smallSaved = rb_resize_and_save($srcImage, $srcWidth, $srcHeight, 80, $thumbSmPath);
    rb_debug_log('rb_save_permanent_logo: Small thumb (_sm) saved: ' . ($smallSaved ? 'YES' : 'NO'));

    imagedestroy($srcImage);

    // Verify ALL THREE files were created (including _sm.jpg for moOde playbar)
    $logoExists = file_exists($logoPath);
    $thumbExists = file_exists($thumbPath);
    $thumbSmExists = file_exists($thumbSmPath);

    rb_debug_log('rb_save_permanent_logo: File check - logo:' . ($logoExists ? 'Y' : 'N') .
        ' thumb:' . ($thumbExists ? 'Y' : 'N') .
        ' thumbSm:' . ($thumbSmExists ? 'Y' : 'N'));

    if ($logoExists && $thumbExists && $thumbSmExists) {
        rb_debug_log('rb_save_permanent_logo: Successfully saved all logo files');
        return true;
    }

    rb_debug_log('rb_save_permanent_logo: Failed to save some logo files');
    return false;
}

function rb_cleanup_image_cache()
{
    if (!is_dir(RB_IMAGE_CACHE)) return;

    $files = glob(RB_IMAGE_CACHE . '/*.png');
    $total_size = 0;
    $file_info = [];

    foreach ($files as $file) {
        $size = filesize($file);
        $total_size += $size;
        $file_info[] = [
            'file' => $file,
            'size' => $size,
            'mtime' => filemtime($file)
        ];
    }

    $max_size = RB_IMAGE_CACHE_SIZE_MB * 1024 * 1024; // Convert MB to bytes

    if ($total_size > $max_size) {
        // Sort by modification time (oldest first)
        usort($file_info, function ($a, $b) {
            return $a['mtime'] <=> $b['mtime'];
        });

        // Remove oldest files until we're under the limit
        foreach ($file_info as $info) {
            if ($total_size <= $max_size) break;
            @unlink($info['file']);
            $total_size -= $info['size'];
        }
    }
}

/**
 * Get the active API host based on settings
 * Returns the hostname (without https://) of the currently selected API
 */
function rb_get_active_api_host()
{
    $settings = rb_get_settings();
    $activeId = $settings['active_api'] ?? 'radio-browser-info';

    if ($activeId === 'radio-browser-info') {
        return RB_API_PRIMARY;
    }

    // Check custom APIs
    $customApis = rb_get_custom_apis();
    if (isset($customApis[$activeId]) && !empty($customApis[$activeId]['url'])) {
        // Extract hostname from URL (custom APIs store full URLs like https://api.example.com)
        $parsed = parse_url($customApis[$activeId]['url']);
        return $parsed['host'] ?? RB_API_PRIMARY;
    }

    // Fallback to default
    return RB_API_PRIMARY;
}

/**
 * Get list of API servers for status checking
 */
function rb_get_servers()
{
    return array_merge([RB_API_PRIMARY], RB_FALLBACK);
}

/**
 * Make API request with automatic failover
 * Uses the active API setting, falls back to default mirrors
 */
function rb_api($endpoint, $params = [], $timeout = 10)
{
    $query = http_build_query($params);

    // Use active API as primary, then default fallbacks
    $activeHost = rb_get_active_api_host();
    $servers = array_unique(array_merge([$activeHost], [RB_API_PRIMARY], RB_FALLBACK));

    foreach ($servers as $srv) {
        $url = 'https://' . $srv . $endpoint . ($query ? '?' . $query : '');
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => RB_UA,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        rb_debug_log("API $url [$code] " . ($err ?: 'OK'));

        if ($code === 200 && $resp) {
            $data = json_decode($resp, true);
            if ($data !== null) return $data;
            rb_debug_log("Invalid JSON from $srv");
        }
        // Continue to next server on failure
    }
    return false;
}

$response = ['success' => false, 'message' => 'Unknown command'];

switch ($cmd) {
    // === Download M3U File ===
    case 'download_m3u':
        $url = trim($_POST['url'] ?? $_GET['url'] ?? '');
        $name = trim($_POST['name'] ?? $_GET['name'] ?? 'radio_stream');

        if (empty($url)) {
            $response = ['success' => false, 'message' => 'URL is required'];
            break;
        }

        // Sanitize filename
        $safeName = preg_replace('/[^a-zA-Z0-9\-_\s]/', '', $name);
        $safeName = trim($safeName) ?: 'radio_stream';
        $filename = $safeName . '.m3u';

        // Build M3U content
        $m3uContent = "#EXTM3U\r\n#EXTINF:-1," . $name . "\r\n" . $url . "\r\n";

        // Send file download headers
        header('Content-Type: audio/x-mpegurl');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($m3uContent));
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');

        echo $m3uContent;
        exit;

        // === Custom API Management ===
    case 'custom_apis_list':
        $apis = rb_get_custom_apis();
        $response = ['success' => true, 'apis' => $apis];
        break;

    case 'custom_api_add':
        $name = trim($_POST['name'] ?? $_GET['name'] ?? '');
        $url = trim($_POST['url'] ?? $_GET['url'] ?? '');
        $type = trim($_POST['type'] ?? $_GET['type'] ?? 'radio-browser');

        if (empty($name)) {
            $response = ['success' => false, 'message' => 'Name is required'];
        } elseif (empty($url)) {
            $response = ['success' => false, 'message' => 'URL is required'];
        } elseif (!filter_var($url, FILTER_VALIDATE_URL)) {
            $response = ['success' => false, 'message' => 'Invalid URL format'];
        } else {
            $response = rb_add_custom_api($name, $url, $type);
        }
        break;

    case 'custom_api_remove':
        $id = trim($_POST['id'] ?? $_GET['id'] ?? '');

        if (empty($id)) {
            $response = ['success' => false, 'message' => 'API ID is required'];
        } else {
            $response = rb_remove_custom_api($id);
        }
        break;

    case 'set_active_api':
        $apiId = trim($_POST['id'] ?? '');
        if (empty($apiId)) {
            $response = ['success' => false, 'message' => 'API ID is required'];
        } else {
            // Validate: must be 'radio-browser-info' or an existing custom API
            if ($apiId !== 'radio-browser-info') {
                $customApis = rb_get_custom_apis();
                if (!isset($customApis[$apiId])) {
                    $response = ['success' => false, 'message' => 'Unknown API ID'];
                    break;
                }
            }
            $settings = rb_get_settings();
            $settings['active_api'] = $apiId;
            if (rb_save_settings($settings)) {
                rb_debug_log('Active API changed to: ' . $apiId);
                $response = ['success' => true, 'message' => 'Active API updated', 'active_api' => $apiId];
            } else {
                $response = ['success' => false, 'message' => 'Failed to save setting'];
            }
        }
        break;

    case 'test':
        $response = ['success' => true, 'message' => 'Radio Browser API is working', 'timestamp' => time(), 'version' => '4.0.0'];
        break;

    case 'service_status':
        // Comprehensive health check for UI status badge
        $checks = [];
        $overall = 'running'; // running, warning, error, inactive

        // Load config for webroot file checks
        $loaderConfig = require __DIR__ . '/loader-config.php';

        // 1. Check web root files (from config manifest)
        foreach ($loaderConfig['webroot_files'] as $targetName => $entry) {
            $targetPath = $loaderConfig['web_root'] . '/' . $targetName;
            $ok = file_exists($targetPath);
            $checks['webroot_' . $targetName] = ['ok' => $ok, 'detail' => $ok ? 'OK' : 'Missing'];
            if (!$ok) $overall = 'error';
        }

        // 2. Check PHP files exist
        $extBase = RB_EXT_BASE;
        $requiredFiles = ['radio-browser.php', 'backend/api.php', 'assets/radio-browser.js', 'assets/rb-menu-inject.js'];
        $missingFiles = [];
        foreach ($requiredFiles as $f) {
            if (!file_exists($extBase . '/' . $f)) $missingFiles[] = $f;
        }
        $filesOk = empty($missingFiles);
        $checks['files'] = ['ok' => $filesOk, 'detail' => $filesOk ? 'All present' : 'Missing: ' . implode(', ', $missingFiles)];
        if (!$filesOk) $overall = 'error';

        // 3. Check cache writable
        $cacheDir = $extBase . '/cache';
        $cacheOk = is_dir($cacheDir) && is_writable($cacheDir);
        $checks['cache'] = ['ok' => $cacheOk, 'detail' => $cacheOk ? 'Writable' : 'Not writable'];
        if (!$cacheOk && $overall !== 'error') $overall = 'warning';

        // 4. Check data dir writable
        $dataDir = $extBase . '/data';
        $dataOk = is_dir($dataDir) && is_writable($dataDir);
        $checks['data'] = ['ok' => $dataOk, 'detail' => $dataOk ? 'Writable' : 'Not writable'];
        if (!$dataOk && $overall !== 'error') $overall = 'warning';

        // 5. Check header.php patch
        $headerOk = file_exists(RB_HEADER_FILE) && strpos(file_get_contents(RB_HEADER_FILE), 'RB_SHELL_BRIDGE_START') !== false;
        $checks['header_patch'] = ['ok' => $headerOk, 'detail' => $headerOk ? 'Installed' : 'Missing'];
        if (!$headerOk && $overall !== 'error') $overall = 'warning';

        // 6. Check radio-browser.info API reachability (quick test)
        $apiTestUrl = 'https://' . RB_API_PRIMARY . '/json/stats';
        $ch = curl_init($apiTestUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_USERAGENT => RB_UA,
        ]);
        curl_exec($ch);
        $apiCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $apiTime = round(curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000);
        curl_close($ch);
        $apiOk = $apiCode === 200;
        $checks['api_remote'] = ['ok' => $apiOk, 'detail' => $apiOk ? "Reachable ({$apiTime}ms)" : "Unreachable (HTTP {$apiCode})", 'latency_ms' => $apiTime];
        if (!$apiOk && $overall !== 'error') $overall = 'warning';

        // 7. Check MPD connection
        $mpdOk = false;
        $sock = @stream_socket_client('tcp://' . RB_MPD_HOST . ':' . RB_MPD_PORT, $errno, $errstr, 2);
        if ($sock) {
            $banner = fgets($sock, 256);
            $mpdOk = strpos($banner, 'OK MPD') === 0;
            fclose($sock);
        }
        $checks['mpd'] = ['ok' => $mpdOk, 'detail' => $mpdOk ? 'Connected' : 'Not reachable'];
        if (!$mpdOk && $overall !== 'error') $overall = 'warning';

        // Read version
        $versionFile = $extBase . '/version.txt';
        $version = file_exists($versionFile) ? trim(file_get_contents($versionFile)) : 'unknown';

        $response = [
            'success' => true,
            'status' => $overall,
            'version' => $version,
            'checks' => $checks,
            'timestamp' => time()
        ];
        break;

    case 'test_search':
        // DEBUG ONLY: Return mock data for testing (not called by frontend)
        $response = [
            'success' => true,
            'stations' => [
                [
                    'name' => 'Test Station 1',
                    'url' => 'http://test1.com/stream',
                    'country' => 'Netherlands',
                    'favicon' => '/images/radio-logo.png',
                    'tags' => 'test,jazz'
                ],
                [
                    'name' => 'Test Station 2',
                    'url' => 'http://test2.com/stream',
                    'country' => 'Germany',
                    'favicon' => '/images/radio-logo.png',
                    'tags' => 'test,rock'
                ]
            ]
        ];
        break;
    case 'status':
        $servers = rb_get_servers();
        $results = [];
        foreach ($servers as $srv) {
            $url = 'https://' . $srv . '/json/stats';
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_USERAGENT => RB_UA,
                CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4  // Force IPv4 for better compatibility
            ]);
            $start_time = microtime(true);
            $resp = curl_exec($ch);
            $end_time = microtime(true);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            // Calculate latency in milliseconds
            $latency = ($code === 200) ? round(($end_time - $start_time) * 1000) : 0;

            $results[] = [
                'name' => $srv,
                'online' => ($code === 200),
                'latency' => $latency,
                'url' => $url
            ];
        }
        $response = ['success' => true, 'servers' => $results];
        break;
    // get_logo case removed — no frontend calls it (dead code)
    case 'countries':
        $data = rb_cache_get('countries', RB_CACHE_TTL_STATIC);
        if ($data === false) {
            $data = rb_api('/json/countries');
            if ($data !== false) {
                rb_cache_set('countries', $data);
            }
        }
        if ($data !== false) {
            $response = ['success' => true, 'countries' => $data];
        } else {
            $response = ['success' => false, 'message' => 'No results or API error'];
        }
        break;
    case 'genres':
        $data = rb_cache_get('genres', RB_CACHE_TTL_STATIC);
        if ($data === false) {
            $data = rb_api('/json/tags');
            if ($data !== false) {
                rb_cache_set('genres', $data);
            }
        }
        if ($data !== false) {
            $response = ['success' => true, 'genres' => $data];
        } else {
            $response = ['success' => false, 'message' => 'No results or API error'];
        }
        break;
    case 'search':
        // Use $_REQUEST to support both GET and POST requests
        $params = [
            'name' => $_REQUEST['name'] ?? '',
            'countrycode' => $_REQUEST['countrycode'] ?? '',
            'tag' => $_REQUEST['tag'] ?? '',
            'offset' => $_REQUEST['offset'] ?? 0,
            'limit' => $_REQUEST['limit'] ?? 30,
            'order' => $_REQUEST['order'] ?? 'clickcount',
            'reverse' => $_REQUEST['reverse'] ?? 'true',
            'hidebroken' => 'true',
        ];
        $params = array_filter($params, function ($v) {
            return $v !== '' && $v !== null;
        });
        $cache_key = 'search_' . md5(json_encode($params));
        $data = rb_cache_get($cache_key, RB_CACHE_TTL);
        if ($data === false) {
            $data = rb_api('/json/stations/search', $params);
            if ($data !== false) {
                rb_cache_set($cache_key, $data);
            } else {
                // Stale cache fallback: serve expired cache if API is down
                $data = rb_cache_get($cache_key, 0);
            }
        }
        if ($data !== false) {
            // Load moOde station URLs for is_moode marking
            $moodeUrls = [];
            $dbh = sqlConnect();
            if ($dbh) {
                $rows = sqlQuery("SELECT station, home_page, broadcaster, country, region FROM cfg_radio", $dbh);
                if (is_array($rows)) {
                    foreach ($rows as $r) {
                        $hp = trim($r['home_page'] ?? '');
                        $bc = trim($r['broadcaster'] ?? '');
                        $co = trim($r['country'] ?? '');
                        $rg = trim($r['region'] ?? '');
                        if (($hp !== 'radio-browser') && ($bc !== '' || $co !== '' || $rg !== '')) {
                            $moodeUrls[trim($r['station'])] = true;
                        }
                    }
                }
            }
            // Process favicons for caching
            foreach ($data as &$station) {
                if (!empty($station['favicon']) && !str_contains($station['favicon'], 'encrypted-tbn0.gstatic.com')) {
                    $cached_image = rb_cache_image($station['favicon']);
                    if ($cached_image) {
                        $station['favicon'] = $cached_image;
                    }
                }
                // Mark moOde core stations
                $stUrl = trim($station['url_resolved'] ?? $station['url'] ?? '');
                $station['is_moode'] = isset($moodeUrls[$stUrl]);
            }
            $response = ['success' => true, 'stations' => $data];
        } else {
            $response = ['success' => false, 'message' => 'No results or API error'];
        }
        break;
    case 'top_click':
        $limit = $_POST['limit'] ?? 30;
        $cache_key = 'top_click_' . $limit;
        $data = rb_cache_get($cache_key, RB_CACHE_TTL_STATIC);
        if ($data === false) {
            $data = rb_api('/json/stations/topclick/' . $limit, ['hidebroken' => 'true']);
            if ($data !== false) {
                rb_cache_set($cache_key, $data);
            } else {
                // Try to get cached data even if expired as fallback
                $data = rb_cache_get($cache_key, 0);
            }
        }
        if ($data !== false) {
            // Load moOde station URLs for is_moode marking
            $moodeUrls = [];
            $dbh = sqlConnect();
            if ($dbh) {
                $rows = sqlQuery("SELECT station, home_page, broadcaster, country, region FROM cfg_radio", $dbh);
                if (is_array($rows)) {
                    foreach ($rows as $r) {
                        $hp = trim($r['home_page'] ?? '');
                        $bc = trim($r['broadcaster'] ?? '');
                        $co = trim($r['country'] ?? '');
                        $rg = trim($r['region'] ?? '');
                        if (($hp !== 'radio-browser') && ($bc !== '' || $co !== '' || $rg !== '')) {
                            $moodeUrls[trim($r['station'])] = true;
                        }
                    }
                }
            }
            // Process favicons for caching
            foreach ($data as &$station) {
                if (!empty($station['favicon']) && !str_contains($station['favicon'], 'encrypted-tbn0.gstatic.com')) {
                    $cached_image = rb_cache_image($station['favicon']);
                    if ($cached_image) {
                        $station['favicon'] = $cached_image;
                    }
                }
                // Mark moOde core stations
                $stUrl = trim($station['url_resolved'] ?? $station['url'] ?? '');
                $station['is_moode'] = isset($moodeUrls[$stUrl]);
            }
            $response = ['success' => true, 'stations' => $data];
        } else {
            $response = ['success' => false, 'message' => 'No results or API error'];
        }
        break;
    case 'play':
        $station = json_decode(file_get_contents('php://input'), true);
        if (!$station || empty($station['url'])) {
            $response = ['success' => false, 'message' => 'No station data'];
            break;
        }
        require_once '/var/www/inc/mpd.php';

        $name = $station['name'] ?? 'Radio Browser Station';
        $url = trim($station['url']);
        $favicon = !empty($station['favicon']) ? $station['favicon'] : '';
        $logo = 'local'; // Use 'local' to indicate we save logos locally
        $bitrate = isset($station['bitrate']) && $station['bitrate'] > 0 ? (string)$station['bitrate'] : '';
        $format = $station['codec'] ?? '';
        // Map radio-browser.info fields to cfg_radio columns
        $genre = trim($station['tags'] ?? '');
        $language = trim($station['language'] ?? '');
        $country = trim($station['country'] ?? '');
        $region = trim($station['state'] ?? '');

        // Check if logo files exist for this station, if not download them
        $safeName = rb_sanitize_station_name($name);
        $logoPath = RADIO_LOGOS_ROOT . $safeName . '.jpg';
        $thumbPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '.jpg';
        $thumbSmPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '_sm.jpg';

        if (!file_exists($thumbSmPath) && !empty($favicon) && !str_contains($favicon, 'encrypted-tbn0.gstatic.com')) {
            rb_debug_log('Play: Getting logo for ' . $name . ' from ' . $favicon);
            $imageData = false;

            // Resolve local paths to filesystem paths
            if (str_starts_with($favicon, '/') && !str_starts_with($favicon, 'http')) {
                if (str_starts_with($favicon, '/extensions/')) {
                    $localPath = '/var/www' . $favicon;
                } elseif (str_starts_with($favicon, '/imagesw/')) {
                    $localPath = '/var/local/www' . $favicon;
                } else {
                    $localPath = '/var/www' . $favicon;
                }
                if (file_exists($localPath)) {
                    $imageData = file_get_contents($localPath);
                    rb_debug_log('Play: Read local file: ' . $localPath);
                }
            } else {
                // External URL
                $imageData = rb_fetch_image($favicon, 5);
            }

            if ($imageData !== false && strlen($imageData) > 100) {
                if (rb_save_permanent_logo($name, $imageData)) {
                    rb_debug_log('Play: Logo saved for ' . $name);
                }
            }
        }

        // If logo still doesn't exist after download attempt, use Radio Browser default logo
        if (!file_exists($thumbSmPath)) {
            $defaultCover = RB_DEFAULT_LOGO;
            @copy($defaultCover, $logoPath);
            @copy($defaultCover, $thumbPath);
            @copy($defaultCover, $thumbSmPath);
            rb_debug_log('Play: No favicon available, copied RB default logo for ' . $name);
        }

        // Insert station into cfg_radio for currentsong.txt compatibility
        // This allows moOde's worker.php/enhanceMetadata() to find station info via load_radio
        $dbh = sqlConnect();
        $checkSql = "SELECT 1 FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' LIMIT 1";
        $exists = sqlQuery($checkSql, $dbh);
        if (!is_array($exists) || count($exists) == 0) {
            // Station not in database, insert with mapped radio-browser.info metadata
            $sql = "INSERT INTO cfg_radio (station, name, type, logo, genre, broadcaster, language, country, region, bitrate, format, geo_fenced, home_page, monitor) VALUES ('" .
                SQLite3::escapeString($url) . "', '" .
                SQLite3::escapeString($name) . "', 'u', '" .
                SQLite3::escapeString($logo) . "', '" .
                SQLite3::escapeString($genre) . "', '', '" .
                SQLite3::escapeString($language) . "', '" .
                SQLite3::escapeString($country) . "', '" .
                SQLite3::escapeString($region) . "', '" .
                SQLite3::escapeString($bitrate) . "', '" .
                SQLite3::escapeString($format) . "', 'No', 'radio-browser', 'No')";
            sqlQuery($sql, $dbh);
            rb_debug_log('Inserted station into cfg_radio: ' . $name . ', URL: ' . $url);
        }

        // Add station to shared session file so worker.php's enhanceMetadata() can find it
        // worker.php periodically opens/closes the session, so it will pick up this data
        phpSession('open');
        $_SESSION[$url] = [
            'name' => $name,
            'type' => 'u',
            'logo' => $logo,
            'bitrate' => $bitrate,
            'format' => $format,
            'home_page' => $station['homepage'] ?? '',
            'monitor' => 'No'
        ];
        phpSession('close');
        rb_debug_log('Added station to session: ' . $name . ', URL: ' . $url);

        // Track recently played using file-based storage (persistent, ordered by play time)
        rb_add_recently_played([
            'url' => $url,
            'name' => $name,
            'logo' => $favicon ?: $logo,
            'country' => $station['country'] ?? '',
            'tags' => $station['tags'] ?? '',
            'bitrate' => $bitrate,
            'codec' => $format,
            'stationuuid' => $station['stationuuid'] ?? ''
        ]);

        $sock = openMpdSock(RB_MPD_HOST, RB_MPD_PORT);
        if (!$sock) {
            $response = ['success' => false, 'message' => 'Cannot connect to MPD'];
            break;
        }
        // Use addid to get the song ID, then playid to play without clearing queue
        sendMpdCmd($sock, 'addid "' . $url . '"');
        $resp = readMpdResp($sock);
        // Parse song ID from response (format: "Id: 123\nOK\n")
        if (preg_match('/Id:\s*(\d+)/', $resp, $matches)) {
            $songId = $matches[1];
            sendMpdCmd($sock, 'playid ' . $songId);
            $resp = readMpdResp($sock);
            if (strpos($resp, 'OK') === false) {
                $response = ['success' => false, 'message' => 'MPD playid failed'];
                closeMpdSock($sock);
                break;
            }
        } else {
            $response = ['success' => false, 'message' => 'MPD addid failed: ' . $resp];
            closeMpdSock($sock);
            break;
        }
        closeMpdSock($sock);

        // Click tracking: notify radio-browser.info that this station was played
        // This keeps global statistics accurate (fire-and-forget, non-blocking)
        $stationUuid = $station['stationuuid'] ?? '';
        if (!empty($stationUuid) && preg_match('/^[0-9a-f\-]{36}$/i', $stationUuid)) {
            $ch = curl_init('https://all.api.radio-browser.info/json/url/' . $stationUuid);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_USERAGENT => RB_UA,
                CURLOPT_TIMEOUT => 3,
                CURLOPT_CONNECTTIMEOUT => 2,
            ]);
            curl_exec($ch);
            curl_close($ch);
            rb_debug_log('Click tracking: notified radio-browser.info for ' . $name . ' (UUID: ' . $stationUuid . ')');
        }

        $response = ['success' => true, 'message' => 'Playing: ' . $name];
        break;
    case 'import':
        $station = json_decode(file_get_contents('php://input'), true);
        if (!$station || empty($station['url'])) {
            // Try to get station data from POST parameters
            $station = $_POST;
            if (!$station || empty($station['url'])) {
                $response = ['success' => false, 'message' => 'No station data'];
                break;
            }
        }
        $dbh = sqlConnect();
        $name = !empty($station['name']) ? trim($station['name']) : 'Unknown Station';
        $url = trim($station['url']);
        $favicon = !empty($station['favicon']) ? trim($station['favicon']) : '';

        // Check if station already exists in moOde (by URL, any type)
        $checkSql = "SELECT station, name, type FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' LIMIT 1";
        $checkResult = sqlQuery($checkSql, $dbh);
        $stationExists = is_array($checkResult) && count($checkResult) > 0;

        if ($stationExists) {
            $existingType = $checkResult[0]['type'];
            $existingName = $checkResult[0]['name'];

            if ($existingType == 'f') {
                rb_debug_log('Station already in favorites: ' . $existingName . ' (URL: ' . $url . ')');
                $response = ['success' => false, 'message' => 'Station already in favorites'];
                break;
            }

            // Station exists with type 'r' or 'u' - promote to favorite
            rb_debug_log('Promoting existing station to favorite: ' . $existingName . ' (type: ' . $existingType . ' -> f)');
            $updateSql = "UPDATE cfg_radio SET type='f' WHERE station = '" . SQLite3::escapeString($url) . "'";
            $result = sqlQuery($updateSql, $dbh);
            if ($result === true) {
                $response = ['success' => true, 'message' => 'Station added to favorites'];
            } else {
                $response = ['success' => false, 'message' => 'Failed to update station'];
            }
            break;
        }

        // Station doesn't exist - will be inserted below
        // Process favicon if available - download and convert to JPG
        $logo = 'local'; // Default to local logo
        $logoSaved = false;
        if (!empty($favicon) && !str_contains($favicon, 'encrypted-tbn0.gstatic.com')) {
            rb_debug_log('Processing favicon for station: ' . $name . ', URL: ' . $favicon);

            $imageData = rb_fetch_image($favicon);

            if ($imageData !== false) {
                rb_debug_log('Downloaded favicon, size: ' . strlen($imageData) . ' bytes');

                // Use our own PNG->JPG conversion and save directly
                if (rb_save_permanent_logo($name, $imageData)) {
                    rb_debug_log('Logo saved permanently using rb_save_permanent_logo');
                    $logoSaved = true;
                } else {
                    // Fallback to moOde job system
                    rb_debug_log('Falling back to moOde job system');
                    $base64Data = base64_encode($imageData);
                    if (submitJob('set_ralogo_image', $name . ',' . $base64Data, '', '')) {
                        rb_debug_log('Job submitted for station: ' . $name);
                        sleep(2);
                    }
                }
            } else {
                rb_debug_log('Failed to download favicon for station: ' . $name);
            }
        } else {
            rb_debug_log('No favicon processing for station: ' . $name . ', favicon: ' . ($favicon ?: 'empty'));
        }

        // If logo still doesn't exist after download attempt, use Radio Browser default logo
        $safeName = rb_sanitize_station_name($name);
        $thumbSmPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '_sm.jpg';
        if (!file_exists($thumbSmPath)) {
            $defaultCover = RB_DEFAULT_LOGO;
            @copy($defaultCover, RADIO_LOGOS_ROOT . $safeName . '.jpg');
            @copy($defaultCover, RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '.jpg');
            @copy($defaultCover, $thumbSmPath);
            rb_debug_log('Import: No favicon available, copied RB default logo for ' . $name);
        }

        // Use type='f' (favorite) - integrates with moOde's native favorites system
        // home_page='radio-browser' marks this as imported by Radio Browser (vs moOde core stations)
        // Map radio-browser.info fields to cfg_radio columns
        $genre = trim($station['tags'] ?? '');
        $language = trim($station['language'] ?? '');
        $country = trim($station['country'] ?? '');
        $region = trim($station['state'] ?? '');
        $bitrate = isset($station['bitrate']) && $station['bitrate'] > 0 ? (string)$station['bitrate'] : '';
        $format = trim($station['codec'] ?? '');
        $sql = "INSERT INTO cfg_radio (station, name, type, logo, genre, broadcaster, language, country, region, bitrate, format, geo_fenced, home_page, monitor) VALUES ('" .
            SQLite3::escapeString($url) . "', '" .
            SQLite3::escapeString($name) . "', 'f', '" .
            SQLite3::escapeString($logo) . "', '" .
            SQLite3::escapeString($genre) . "', '', '" .
            SQLite3::escapeString($language) . "', '" .
            SQLite3::escapeString($country) . "', '" .
            SQLite3::escapeString($region) . "', '" .
            SQLite3::escapeString($bitrate) . "', '" .
            SQLite3::escapeString($format) . "', 'No', 'radio-browser', '')";
        $result = sqlQuery($sql, $dbh);
        if ($result !== true) {
            $response = ['success' => false, 'message' => 'Failed to add station to database'];
            break;
        }

        // Create .pls file for MPD (required for moOde Radio Stations browser)
        $plsFile = '/var/lib/mpd/music/RADIO/' . $name . '.pls';
        $plsContent = "[playlist]\n";
        $plsContent .= "File1=" . $url . "\n";
        $plsContent .= "Title1=" . $name . "\n";
        $plsContent .= "Length1=-1\n";
        $plsContent .= "NumberOfEntries=1\n";
        $plsContent .= "Version=2\n";

        if (@file_put_contents($plsFile, $plsContent) !== false) {
            @chmod($plsFile, 0777);
            rb_debug_log('Created .pls file: ' . $plsFile);

            // Update MPD database to pick up the new station
            require_once '/var/www/inc/mpd.php';
            $sock = openMpdSock(RB_MPD_HOST, RB_MPD_PORT);
            if ($sock) {
                sendMpdCmd($sock, 'update RADIO');
                readMpdResp($sock);
                closeMpdSock($sock);
                rb_debug_log('MPD database update triggered for RADIO folder');
            }
        } else {
            rb_debug_log('Warning: Could not create .pls file: ' . $plsFile);
        }

        // Move processed thumbnails to final location (only if we used the job system)
        if ($logo == 'local' && !$logoSaved) {
            putStationCover($name);
        }

        $response = ['success' => true, 'message' => 'Station added to favorites'];
        break;
    case 'current_status':
        require_once '/var/www/inc/mpd.php';
        $sock = openMpdSock(RB_MPD_HOST, RB_MPD_PORT);
        if (!$sock) {
            $response = ['success' => false, 'message' => 'Cannot connect to MPD'];
            break;
        }
        $status = getMpdStatus($sock);
        $current = getCurrentSong($sock);
        $is_playing = isset($status['state']) && $status['state'] == 'play';
        $current_url = isset($current['file']) ? $current['file'] : null;
        closeMpdSock($sock);
        $response = ['success' => true, 'is_playing' => $is_playing, 'current_url' => $current_url];
        break;
    case 'favorites':
        // Use moOde's native favorites system (type='f' in cfg_radio)
        $dbh = sqlConnect();
        if (!$dbh) {
            $response = ['success' => false, 'message' => 'Database connection failed'];
            break;
        }
        $result = sqlQuery("SELECT station, name, logo, home_page, broadcaster, country, region FROM cfg_radio WHERE type='f'", $dbh);
        $favorites = [];
        if (is_array($result)) {
            foreach ($result as $row) {
                $hp = trim($row['home_page'] ?? '');
                $bc = trim($row['broadcaster'] ?? '');
                $co = trim($row['country'] ?? '');
                $rg = trim($row['region'] ?? '');
                $favorites[] = [
                    'url' => trim($row['station']),
                    'name' => trim($row['name']),
                    'logo' => trim($row['logo']),
                    'is_moode' => ($hp !== 'radio-browser') && ($bc !== '' || $co !== '' || $rg !== '')
                ];
            }
        }
        $response = ['success' => true, 'favorites' => $favorites];
        break;
    case 'remove':
        $station = json_decode(file_get_contents('php://input'), true);
        if (!$station || empty($station['url'])) {
            // Try to get station data from POST parameters
            $station = $_POST;
            if (!$station || empty($station['url'])) {
                rb_debug_log('Remove failed: No station data provided');
                $response = ['success' => false, 'message' => 'No station data'];
                break;
            }
        }
        $dbh = sqlConnect();
        $url = trim($station['url']);
        rb_debug_log('Remove station request for URL: ' . $url);

        // Check if station exists before removing (type='f' = favorite)
        $checkSql = "SELECT name, type FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' LIMIT 1";
        $checkResult = sqlQuery($checkSql, $dbh);
        if (!is_array($checkResult) || count($checkResult) === 0) {
            rb_debug_log('Remove failed: Station not found: ' . $url);
            $response = ['success' => false, 'message' => 'Station not found'];
            break;
        }
        $stationName = $checkResult[0]['name'];
        $stationType = $checkResult[0]['type'];

        if ($stationType != 'f') {
            rb_debug_log('Remove failed: Station is not a favorite (type=' . $stationType . '): ' . $url);
            $response = ['success' => false, 'message' => 'Station is not in favorites'];
            break;
        }

        // Downgrade from favorite to regular (keeps station in moOde Radio but removes favorite status)
        $sql = "UPDATE cfg_radio SET type='r' WHERE station = '" . SQLite3::escapeString($url) . "'";
        $result = sqlQuery($sql, $dbh);
        if ($result !== true) {
            rb_debug_log('Remove failed: Database update error for: ' . $url);
            $response = ['success' => false, 'message' => 'Failed to update station'];
            break;
        }

        rb_debug_log('Station removed from favorites (downgraded to regular): ' . $stationName . ', URL: ' . $url);
        $response = ['success' => true, 'message' => 'Station removed from favorites'];
        break;
    case 'recently_played':
        // Recently played: Get from file-based storage (tracks play order) with fallback to database
        $stations = [];
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 30;  // Default to 30 if no limit

        // First try file-based recently played (ordered by play time)
        $fileBasedList = rb_get_recently_played();

        if (!empty($fileBasedList)) {
            $count = 0;
            foreach ($fileBasedList as $entry) {
                if ($limit > 0 && $count >= $limit) break;
                $stations[] = [
                    'url' => $entry['url'],
                    'name' => $entry['name'],
                    'logo' => $entry['logo'] ?? 'local',
                    'country' => $entry['country'] ?? '',
                    'tags' => $entry['tags'] ?? '',
                    'bitrate' => $entry['bitrate'] ?? 0,
                    'codec' => $entry['codec'] ?? '',
                    'is_moode' => $entry['is_moode'] ?? false
                ];
                $count++;
            }
            rb_debug_log('Recently played from file: ' . count($stations) . ' stations (limit: ' . $limit . ')');
        } else {
            // Fallback to database for first-time users
            $dbh = sqlConnect();
            if ($dbh) {
                $result = sqlQuery("SELECT station, name, logo FROM cfg_radio WHERE type='u' ORDER BY id DESC LIMIT 10", $dbh);
                if (is_array($result)) {
                    foreach ($result as $row) {
                        $stations[] = [
                            'url' => trim($row['station']),
                            'name' => trim($row['name']),
                            'logo' => trim($row['logo'])
                        ];
                    }
                }
                rb_debug_log('Recently played from database (fallback): ' . count($stations) . ' stations');
            }
        }

        $response = ['success' => true, 'stations' => $stations];
        break;
    case 'flush_cache':
        // Flush all cached data
        $cache_files = glob(RB_CACHE . '/*.json');
        $image_files = glob(RB_IMAGE_CACHE . '/*');
        $deleted = 0;
        foreach ($cache_files as $file) {
            if (@unlink($file)) $deleted++;
        }
        foreach ($image_files as $file) {
            if (is_file($file) && @unlink($file)) $deleted++;
        }
        rb_debug_log('Cache flushed: ' . $deleted . ' files deleted');
        $response = ['success' => true, 'message' => 'Cache flushed (' . $deleted . ' files deleted)'];
        break;
    case 'repair_thumbnails':
        // Repair missing thumbnails for favorites
        rb_debug_log('Repair thumbnails started');
        $dbh = sqlConnect();
        if (!$dbh) {
            $response = ['success' => false, 'message' => 'Database connection failed'];
            break;
        }
        // Get all favorites with logo URLs
        $result = sqlQuery("SELECT station, name, logo FROM cfg_radio WHERE type='f' AND logo != '' AND logo IS NOT NULL", $dbh);
        $repaired = 0;
        $skipped = 0;
        $failed = 0;
        if (is_array($result)) {
            foreach ($result as $row) {
                $name = trim($row['name']);
                $logoUrl = trim($row['logo']);
                if (empty($name) || empty($logoUrl)) {
                    $skipped++;
                    continue;
                }
                $safeName = rb_sanitize_station_name($name);
                $thumbPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '.jpg';
                $thumbSmPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '_sm.jpg';
                // Skip if thumbnails already exist
                if (file_exists($thumbPath) && file_exists($thumbSmPath)) {
                    $skipped++;
                    continue;
                }
                // Fetch logo and save
                rb_debug_log('Repair: Fetching logo for "' . $name . '" from ' . $logoUrl);
                $imageData = rb_fetch_image($logoUrl);
                if ($imageData) {
                    if (rb_save_permanent_logo($name, $imageData)) {
                        $repaired++;
                        rb_debug_log('Repair: Saved thumbnails for "' . $name . '"');
                    } else {
                        $failed++;
                        rb_debug_log('Repair: Failed to save thumbnails for "' . $name . '"');
                    }
                } else {
                    $failed++;
                    rb_debug_log('Repair: Failed to fetch logo for "' . $name . '"');
                }
            }
        }
        rb_debug_log('Repair thumbnails complete: repaired=' . $repaired . ', skipped=' . $skipped . ', failed=' . $failed);
        $response = ['success' => true, 'message' => 'Repaired ' . $repaired . ' thumbnails, skipped ' . $skipped . ', failed ' . $failed];
        break;
    case 'restart_services':
        // Restart nginx and PHP-FPM using background process
        // We need to send response first, then restart in background so connection doesn't die
        rb_debug_log('Services restart requested');

        // Send success response immediately before restarting
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'Services restart initiated...']);

        // Flush output to client
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            ob_end_flush();
            flush();
        }

        // Small delay to ensure response is sent
        usleep(100000); // 100ms

        // Now restart services (connection already closed)
        exec('sudo /usr/bin/systemctl restart nginx 2>&1');
        sleep(1);
        $phpVer = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
        exec("sudo /usr/bin/systemctl restart php{$phpVer}-fpm 2>&1");

        rb_debug_log('Services restart completed');
        exit; // Already sent response, don't continue
        break;
    case 'view_log':
        // Read last 100 lines of log file
        $log_content = '';
        if (file_exists(RB_LOG)) {
            $lines = file(RB_LOG);
            $lines = array_slice($lines, -100);
            $log_content = implode('', $lines);
        }
        $response = ['success' => true, 'log' => $log_content ?: 'Log is empty'];
        break;
    case 'clear_log':
        // Clear log file
        if (@file_put_contents(RB_LOG, '') !== false) {
            $response = ['success' => true, 'message' => 'Log file cleared'];
        } else {
            $response = ['success' => false, 'message' => 'Failed to clear log file'];
        }
        break;
    case 'reboot':
        // Reboot the system
        rb_debug_log('System reboot requested');

        // Send success response immediately before rebooting
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'System is rebooting...']);

        // Flush output to client
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            ob_end_flush();
            flush();
        }

        // Small delay to ensure response is sent
        usleep(500000); // 500ms

        // Execute reboot command
        exec('sudo /sbin/reboot');

        rb_debug_log('Reboot command executed');
        exit;
        break;

    case 'reinstall':
        // Re-run install.sh
        rb_debug_log('Reinstall requested');
        $extDir = RB_EXT_BASE;
        $installScript = $extDir . '/install.sh';

        if (!file_exists($installScript)) {
            $response = ['success' => false, 'message' => 'install.sh not found'];
            break;
        }

        $output = [];
        $returnVar = 0;
        exec("cd " . escapeshellarg($extDir) . " && sudo bash install.sh 2>&1", $output, $returnVar);

        if ($returnVar === 0) {
            $response = ['success' => true, 'message' => 'Reinstall completed successfully'];
            rb_debug_log('Reinstall completed: ' . implode("\n", $output));
        } else {
            $response = ['success' => false, 'message' => 'Reinstall failed: ' . implode("\n", array_slice($output, -5))];
            rb_debug_log('Reinstall failed: ' . implode("\n", $output));
        }
        break;

    // ============================================================================
    // SETTINGS / VISIBILITY API
    // ============================================================================
    case 'get_settings':
        $settings = rb_get_settings();
        $response = ['success' => true, 'settings' => $settings];
        break;

    case 'set_visibility':
        $area = strtolower(trim($_POST['area'] ?? $_GET['area'] ?? ''));
        $value = $_POST['value'] ?? $_GET['value'] ?? '1';
        $visible = ($value === '1' || strtolower($value) === 'true' || $value === true);

        $result = rb_set_visibility($area, $visible);
        if (isset($result['success']) && $result['success']) {
            $response = ['success' => true, 'data' => $result];
        } else {
            $response = ['success' => false, 'message' => $result['error'] ?? 'Unknown error'];
        }
        break;

    case 'set_limit':
        $type = strtolower(trim($_POST['type'] ?? $_GET['type'] ?? ''));
        $value = (int)($_POST['value'] ?? $_GET['value'] ?? 0);

        $allowed = ['recentlyPlayed', 'favorites'];
        if (!in_array($type, $allowed, true)) {
            $response = ['success' => false, 'message' => 'Invalid type'];
            break;
        }

        $settings = rb_get_settings();
        if (!isset($settings['limits'])) {
            $settings['limits'] = ['recentlyPlayed' => 0, 'favorites' => 0];
        }
        $settings['limits'][$type] = max(0, min(30, $value));  // 0-30 range

        if (rb_save_settings($settings)) {
            rb_debug_log('Limit updated: ' . $type . ' = ' . $value);
            $response = ['success' => true, 'type' => $type, 'value' => $settings['limits'][$type]];
        } else {
            $response = ['success' => false, 'message' => 'Failed to save settings'];
        }
        break;

    // ============================================================================
    // STREAM DOWNLOAD API (Simple - return URL info)
    // ============================================================================
    case 'get_stream_url':
        // Get current playing stream URL - client-side handles m3u creation
        require_once '/var/www/inc/mpd.php';
        $sock = openMpdSock(RB_MPD_HOST, RB_MPD_PORT);
        if (!$sock) {
            $response = ['success' => false, 'message' => 'Cannot connect to MPD'];
            break;
        }
        $current = getCurrentSong($sock);
        closeMpdSock($sock);

        if (isset($current['file']) && !empty($current['file'])) {
            // Try to get station name from database
            $dbh = sqlConnect();
            $url = $current['file'];
            $sql = "SELECT name FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' LIMIT 1";
            $result = sqlQuery($sql, $dbh);
            $name = (is_array($result) && count($result) > 0) ? $result[0]['name'] : 'Radio Stream';

            $response = [
                'success' => true,
                'url' => $url,
                'name' => $name
            ];
        } else {
            $response = ['success' => false, 'message' => 'No station currently playing'];
        }
        break;

    // ============================================================================
    // SYSTEM MANAGEMENT API
    // ============================================================================

    case 'uninstall':
        // Uninstall Radio Browser extension
        rb_debug_log('Uninstall requested');

        $installScript = RB_EXT_BASE . '/install.sh';

        if (!file_exists($installScript)) {
            $response = ['success' => false, 'message' => 'Install script not found'];
            break;
        }

        // Send response before uninstall (connection will be lost)
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'message' => 'Uninstall initiated, redirecting...', 'redirect' => '/index.php']);

        // Flush output to client
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            ob_end_flush();
            flush();
        }

        // Small delay to ensure response is sent
        usleep(200000); // 200ms

        // Run uninstall with auto-confirm (non-interactive)
        // Use 'yes' piped to handle any confirmation prompts
        exec("yes | sudo /bin/bash {$installScript} --uninstall 2>&1", $output, $exitCode);

        rb_debug_log('Uninstall completed, exit code: ' . $exitCode);
        exit;
        break;

    case 'repair':
        // Repair Radio Browser installation
        rb_debug_log('Repair requested');

        $errors = [];
        $fixed = [];

        $extBase = RB_EXT_BASE;
        $sysSourcesDir = $extBase . '/sys/sources';
        $sysMoodeDir = $sysSourcesDir . '/moode';

        // 1. Fix web root files (from config manifest)
        // moOde's worker.php deletes all symlinks in /var/www/ during maintenance
        // The loader is a physical file so it survives that cleanup
        $loaderConfig = require __DIR__ . '/loader-config.php';

        foreach ($loaderConfig['webroot_files'] as $targetName => $entry) {
            $targetPath = $loaderConfig['web_root'] . '/' . $targetName;
            $sourcePath = $extBase . '/' . $entry['source'];

            if (!file_exists($targetPath)) {
                exec("sudo cp " . escapeshellarg($sourcePath) . " " . escapeshellarg($targetPath) . " 2>&1", $cpOut, $cpRc);
                if ($cpRc === 0) {
                    exec("sudo chown www-data:www-data " . escapeshellarg($targetPath) . " 2>&1");
                    $fixed[] = "Web root restored: $targetName";
                } else {
                    $errors[] = "Failed to deploy $targetName: " . implode(' ', $cpOut);
                }
            } else {
                $fixed[] = "Web root OK: $targetName";
            }
        }

        // 2. Check/repair header.php patch
        if (file_exists(RB_HEADER_FILE)) {
            $headerContent = file_get_contents(RB_HEADER_FILE);
            if (strpos($headerContent, 'RB_SHELL_BRIDGE_START') === false) {
                // Patch missing, re-apply
                $bridgeInclude = '<?php /* RB_SHELL_BRIDGE_START */ if (file_exists("/var/www/extensions/installed/radio-browser/rb-shell-bridge.php")) { include_once("/var/www/extensions/installed/radio-browser/rb-shell-bridge.php"); } /* RB_SHELL_BRIDGE_END */ ?>';
                $newContent = str_replace('</head>', $bridgeInclude . "\n</head>", $headerContent);
                if (file_put_contents(RB_HEADER_FILE, $newContent)) {
                    $fixed[] = 'Shell bridge patch re-applied';
                } else {
                    $errors[] = 'Failed to patch header.php';
                }
            } else {
                $fixed[] = 'Shell bridge patch OK';
            }
        }

        // 3. Check/repair nginx logo fallback
        $nginxConf = '/etc/nginx/moode-locations.conf';
        if (file_exists($nginxConf)) {
            $nginxContent = file_get_contents($nginxConf);
            if (strpos($nginxContent, 'RB_NGINX_LOGO_FALLBACK_START') === false) {
                // Patch missing, re-apply
                $logoBlock = "\n# RB_NGINX_LOGO_FALLBACK_START\nlocation /imagesw/radio-logos/ {\n    alias /var/local/www/imagesw/radio-logos/;\n    try_files \$uri /images/radio.png;\n}\n# RB_NGINX_LOGO_FALLBACK_END\n";
                if (file_put_contents($nginxConf, $nginxContent . $logoBlock)) {
                    $fixed[] = 'Nginx logo fallback patch re-applied';
                    // Restart nginx to apply
                    exec('sudo /usr/bin/systemctl restart nginx 2>&1');
                } else {
                    $errors[] = 'Failed to patch nginx config';
                }
            } else {
                $fixed[] = 'Nginx logo fallback OK';
            }
        }

        // 4. Fix permissions
        exec("sudo chown -R www-data:www-data {$extBase} 2>&1");
        exec("sudo chmod 777 {$extBase}/cache 2>&1");
        exec("sudo chmod 777 {$extBase}/cache/images 2>&1");
        $fixed[] = 'Permissions fixed';

        // 5. Restart services
        exec('sudo /usr/bin/systemctl restart nginx 2>&1');
        $phpVersion = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
        exec("sudo /usr/bin/systemctl restart php{$phpVersion}-fpm 2>&1");
        $fixed[] = 'Services restarted';

        if (empty($errors)) {
            $response = ['success' => true, 'message' => 'Repair completed successfully', 'fixed' => $fixed];
        } else {
            $response = ['success' => false, 'message' => 'Repair completed with errors', 'fixed' => $fixed, 'errors' => $errors];
        }

        rb_debug_log('Repair completed: ' . json_encode($response));
        break;

    default:
        $response = ['success' => false, 'message' => 'Unknown command'];
}

function putStationCover($stName)
{
    $stTmpImage = RADIO_LOGOS_ROOT . TMP_IMAGE_PREFIX . $stName . '.jpg';
    $stTmpImageThm = RADIO_LOGOS_ROOT . 'thumbs/' . TMP_IMAGE_PREFIX . $stName . '.jpg';
    $stTmpImageThmSm = RADIO_LOGOS_ROOT . 'thumbs/' . TMP_IMAGE_PREFIX . $stName . '_sm.jpg';

    $stCoverImage = RADIO_LOGOS_ROOT . $stName . '.jpg';
    $stCoverImageThm = RADIO_LOGOS_ROOT . 'thumbs/' .  $stName . '.jpg';
    $stCoverImageThmSm = RADIO_LOGOS_ROOT . 'thumbs/' .  $stName . '_sm.jpg';

    $defaultImage = RB_DEFAULT_LOGO;
    sendFECmd('set_cover_image1'); // Show spinner
    sleep(3); // Allow time for set_ralogo_image job to create __tmp__ image file

    if (file_exists($stTmpImage)) {
        sysCmd('mv "' . $stTmpImage . '" "' . $stCoverImage . '"');
        sysCmd('mv "' . $stTmpImageThm . '" "' . $stCoverImageThm . '"');
        sysCmd('mv "' . $stTmpImageThmSm . '" "' . $stCoverImageThmSm . '"');
    } else if (!file_exists($stCoverImage)) {
        sysCmd('cp "' . $defaultImage . '" "' . $stCoverImage . '"');
        sysCmd('cp "' . $defaultImage . '" "' . $stCoverImageThm . '"');
        sysCmd('cp "' . $defaultImage . '" "' . $stCoverImageThmSm . '"');
    }

    sendFECmd('set_cover_image0'); // Hide spinner
}

rb_debug_log('OUT: ' . json_encode($response));
echo json_encode($response);
