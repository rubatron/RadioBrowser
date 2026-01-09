<?php
// SPDX-License-Identifier: GPL-3.0-or-later// Copyright 2014 The moOde audio player project / Tim Curtis// moOde Extensions Framework - Radio Browser Extension// SPDX-License-Identifier: GPL-3.0-or-later// Copyright 2026 The moOde audio player project / Tim Curtis// Radio Browser Extension - Modern API backend// --- EXTENSIEVE BACKEND LOGGING ---
function rb_debug_log($msg) {    @file_put_contents(RB_LOG, '[DEBUG '.date('c').'] '.$msg."\n", FILE_APPEND);}

require_once '/var/www/inc/common.php';
require_once '/var/www/inc/session.php';
require_once '/var/www/inc/sql.php';// --- CONFIG ---
define('RB_DISCOVERY', 'https://all.api.radio-browser.info/json/servers');
define('RB_FALLBACK', [    'de2.api.radio-browser.info',    'fi1.api.radio-browser.info',    'nl1.api.radio-browser.info',    'us1.api.radio-browser.info',    'at1.api.radio-browser.info',    'ru1.api.radio-browser.info',    'gb1.api.radio-browser.info']);
define('RB_CACHE', __DIR__ . '/../cache');
define('RB_IMAGE_CACHE', __DIR__ . '/../cache/images');
define('RB_LOG', __DIR__ . '/../cache/radio-browser.log');
define('RB_UA', 'moode-radio-browser/1.0');
define('RB_CACHE_TTL', 1800);
define('RB_CACHE_TTL_STATIC', 86400);
define('RB_SERVERS_TTL', 3600);
define('RB_IMAGE_CACHE_SIZE_MB', 1); // 1MB cache size limit// Define moOde constants if not already defined (for logo handling)
if (!defined('RADIO_LOGOS_ROOT')) {    
define('RADIO_LOGOS_ROOT', '/var/local/www/imagesw/radio-logos/');}

if (!defined('TMP_IMAGE_PREFIX')) {    
define('TMP_IMAGE_PREFIX', '__tmp__');}

if (!defined('DEFAULT_NOTFOUND_COVER')) {    
define('DEFAULT_NOTFOUND_COVER', '/var/www/images/radio-logo.png');}
// File-based recently played (persistent, ordered by play time)
define('RB_RECENTLY_PLAYED_FILE', RB_CACHE . '/recently_played.json');// File-based custom API storage (in data folder, NOT cache - survives cache flush)
define('RB_DATA_DIR', __DIR__ . '/../data');
define('RB_CUSTOM_APIS_FILE', RB_DATA_DIR . '/custom_apis.json');
function rb_get_custom_apis() {    
if (file_exists(RB_CUSTOM_APIS_FILE)) {        $data = @json_decode(file_get_contents(RB_CUSTOM_APIS_FILE), true);        return is_array($data) ? $data : [];    }
    return [];}

function rb_save_custom_apis($apis) {    
if (!is_dir(RB_DATA_DIR)) @mkdir(RB_DATA_DIR, 0775, true);    return @file_put_contents(RB_CUSTOM_APIS_FILE, json_encode($apis, JSON_PRETTY_PRINT)) !== false;}

function rb_add_custom_api($name, $url, $type) {    $apis = rb_get_custom_apis();        // Generate unique ID    $id = 'custom_' . preg_replace('/[^a-z0-9]/', '_', strtolower($name)) . '_' . substr(md5($url), 0, 6);        // Check for duplicate URL    foreach ($apis as $api) {        
if ($api['url'] === $url) {            return ['success' => false, 'message' => 'API with this URL already exists'];        }
    }
        $apis[$id] = [        'name' => $name,        'url' => $url,        'type' => $type,        'added' => date('Y-m-d H:i:s')    ];        
if (rb_save_custom_apis($apis)) {        rb_debug_log('Custom API added: ' . $name . ' (' . $url . ')');        return ['success' => true, 'message' => 'Custom API added', 'id' => $id, 'apis' => $apis];    }
    return ['success' => false, 'message' => 'Failed to save custom API'];}

function rb_remove_custom_api($id) {    $apis = rb_get_custom_apis();        
if (!isset($apis[$id])) {        return ['success' => false, 'message' => 'Custom API not found'];    }
        $name = $apis[$id]['name'];    unset($apis[$id]);        
if (rb_save_custom_apis($apis)) {        rb_debug_log('Custom API removed: ' . $name);        return ['success' => true, 'message' => 'Custom API removed', 'apis' => $apis];    }
    return ['success' => false, 'message' => 'Failed to remove custom API'];}

function rb_get_recently_played() {    
if (file_exists(RB_RECENTLY_PLAYED_FILE)) {        $data = @json_decode(file_get_contents(RB_RECENTLY_PLAYED_FILE), true);        return is_array($data) ? $data : [];    }
    return [];}

function rb_add_recently_played($station) {    $list = rb_get_recently_played();        // Remove existing entry with same URL (to move it to top)    $url = trim($station['url']);    $list = array_filter($list, function($item) use ($url) {        return $item['url'] !== $url;    }
);    $list = array_values($list); // Re-index        // Add to beginning (most recent first)    array_unshift($list, [        'url' => $url,        'name' => $station['name'] ?? 'Radio Browser Station',        'logo' => $station['logo'] ?? 'local',        'played_at' => time()    ]);        // Keep only last 6 (to match UI display)    $list = array_slice($list, 0, 6);        // Save to file    @file_put_contents(RB_RECENTLY_PLAYED_FILE, json_encode($list, JSON_PRETTY_PRINT));    rb_debug_log('Recently played updated: ' . ($station['name'] ?? 'Unknown') . ' now first, total: ' . count($list));        return $list;}
// Log elke inkomende request$cmd = $_GET['cmd'] ?? $_POST['cmd'] ?? '';rb_debug_log('IN: cmd='.$cmd.', params='.json_encode($_REQUEST).', IP='.$_SERVER['REMOTE_ADDR']);
function rb_log($msg) {    @file_put_contents(RB_LOG, '['.date('c').'] '.$msg."\n", FILE_APPEND);}

function rb_cache_get($key, $ttl) {    $file = RB_CACHE . '/' . md5($key) . '.json';    
if (file_exists($file) && (time() - filemtime($file) < $ttl)) {        $data = @file_get_contents($file);        
if ($data !== false) return json_decode($data, true);    }
    return false;}

function rb_cache_set($key, $data) {    
if (!is_dir(RB_CACHE)) @mkdir(RB_CACHE, 0777, true);    $file = RB_CACHE . '/' . md5($key) . '.json';    @file_put_contents($file, json_encode($data));}
// Image caching functions
function rb_cache_image($url) {    
if (empty($url)) return false;        $url_hash = md5($url);    $cache_file = RB_IMAGE_CACHE . '/' . $url_hash . '.png';        // Check if image is already cached    
if (file_exists($cache_file) && (time() - filemtime($cache_file) < RB_CACHE_TTL_STATIC)) {        return '/extensions/installed/radio-browser/cache/images/' . $url_hash . '.png';    }
        // Download and cache the image    $ch = curl_init($url);    curl_setopt_array($ch, [        CURLOPT_RETURNTRANSFER => true,        CURLOPT_TIMEOUT => 5,        CURLOPT_USERAGENT => RB_UA,        CURLOPT_FOLLOWLOCATION => true,        CURLOPT_MAXREDIRS => 3    ]);        $image_data = curl_exec($ch);    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);    curl_close($ch);        
if ($image_data && $http_code == 200 && strlen($image_data) < 50000) { // Max 50KB per image        
if (!is_dir(RB_IMAGE_CACHE)) @mkdir(RB_IMAGE_CACHE, 0777, true);                // Check cache size before adding new image        rb_cleanup_image_cache();                
if (@file_put_contents($cache_file, $image_data)) {            return '/extensions/installed/radio-browser/cache/images/' . $url_hash . '.png';        }
    }
        return false;}
/** * Save station logo permanently as JPG to moOde radio-logos folder * Converts any image format (PNG, GIF, WEBP) to JPG * @param string $stationName Station name (used as filename) * @param string $imageData Raw image binary data * @return bool Success */
function rb_save_permanent_logo($stationName, $imageData) {    
if (empty($stationName) || empty($imageData)) {        rb_debug_log('rb_save_permanent_logo: Empty station name or image data');        return false;    }
        // Clean station name for filename    $safeName = preg_replace('/[^a-zA-Z0-9\-_\s]/', '', $stationName);    $safeName = trim($safeName);    
if (empty($safeName)) {        $safeName = 'station_' . md5($stationName);    }
        $logoPath = RADIO_LOGOS_ROOT . $safeName . '.jpg';    $thumbPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '.jpg';    $thumbSmPath = RADIO_LOGOS_ROOT . 'thumbs/' . $safeName . '_sm.jpg';        rb_debug_log('rb_save_permanent_logo: Saving logo for ' . $stationName . ' to ' . $logoPath);        // Create image from data (auto-detect format)    $srcImage = @imagecreatefromstring($imageData);    
if (!$srcImage) {        rb_debug_log('rb_save_permanent_logo: Failed to create image from data');        return false;    }
        // Get original dimensions    $srcWidth = imagesx($srcImage);    $srcHeight = imagesy($srcImage);        // Create directories if needed    
if (!is_dir(RADIO_LOGOS_ROOT)) {        @mkdir(RADIO_LOGOS_ROOT, 0755, true);    }
    
if (!is_dir(RADIO_LOGOS_ROOT . 'thumbs/')) {        @mkdir(RADIO_LOGOS_ROOT . 'thumbs/', 0755, true);    }
        // Save main logo (resize to 400x400 max)    $mainSize = 400;    $mainImage = imagecreatetruecolor($mainSize, $mainSize);    $white = imagecolorallocate($mainImage, 255, 255, 255);    imagefill($mainImage, 0, 0, $white);        // Calculate scaling to fit in square    $scale = min($mainSize / $srcWidth, $mainSize / $srcHeight);    $newWidth = (int)($srcWidth * $scale);    $newHeight = (int)($srcHeight * $scale);    $x = (int)(($mainSize - $newWidth) / 2);    $y = (int)(($mainSize - $newHeight) / 2);        imagecopyresampled($mainImage, $srcImage, $x, $y, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);    imagejpeg($mainImage, $logoPath, 85);    imagedestroy($mainImage);        // Save thumbnail (200x200)    $thumbSize = 200;    $thumbImage = imagecreatetruecolor($thumbSize, $thumbSize);    imagefill($thumbImage, 0, 0, $white);    $scale = min($thumbSize / $srcWidth, $thumbSize / $srcHeight);    $newWidth = (int)($srcWidth * $scale);    $newHeight = (int)($srcHeight * $scale);    $x = (int)(($thumbSize - $newWidth) / 2);    $y = (int)(($thumbSize - $newHeight) / 2);    imagecopyresampled($thumbImage, $srcImage, $x, $y, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);    imagejpeg($thumbImage, $thumbPath, 85);    imagedestroy($thumbImage);        // Save small thumbnail (80x80)    $smallSize = 80;    $smallImage = imagecreatetruecolor($smallSize, $smallSize);    imagefill($smallImage, 0, 0, $white);    $scale = min($smallSize / $srcWidth, $smallSize / $srcHeight);    $newWidth = (int)($srcWidth * $scale);    $newHeight = (int)($srcHeight * $scale);    $x = (int)(($smallSize - $newWidth) / 2);    $y = (int)(($smallSize - $newHeight) / 2);    imagecopyresampled($smallImage, $srcImage, $x, $y, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);    imagejpeg($smallImage, $thumbSmPath, 85);    imagedestroy($smallImage);        imagedestroy($srcImage);        // Verify files were created    
if (file_exists($logoPath) && file_exists($thumbPath)) {        rb_debug_log('rb_save_permanent_logo: Successfully saved logo and thumbnails');        return true;    }
        rb_debug_log('rb_save_permanent_logo: Failed to save logo files');    return false;}

function rb_cleanup_image_cache() {    
if (!is_dir(RB_IMAGE_CACHE)) return;        $files = glob(RB_IMAGE_CACHE . '/*.png');    $total_size = 0;    
$file_info = [];        foreach ($files as $file) {        $size = filesize($file);        $total_size += $size;        $file_info[] = [            'file' => $file,            'size' => $size,            'mtime' => filemtime($file)        ];    }
        $max_size = RB_IMAGE_CACHE_SIZE_MB * 1024 * 1024; // Convert MB to bytes        
if ($total_size > $max_size) {        // Sort by modification time (oldest first)        usort($file_info, function($a, $b) {            return $a['mtime'] <=> $b['mtime'];        }
);                // Remove oldest files until we're under the limit        foreach ($file_info as $info) {            
if ($total_size <= $max_size) break;
            @unlink($info['file']);            $total_size -= $info['size'];        }
    }
}

function rb_get_servers() {    $cache = rb_cache_get('servers', RB_SERVERS_TTL);    
if ($cache && is_array($cache)) return $cache;    
$servers = [];    $ch = curl_init(RB_DISCOVERY);    curl_setopt_array($ch, [        CURLOPT_RETURNTRANSFER => true,        CURLOPT_TIMEOUT => 5,        CURLOPT_USERAGENT => RB_UA    ]);    $resp = curl_exec($ch);    curl_close($ch);    
if ($resp) {        $arr = json_decode($resp, true);        
if (is_array($arr)) {            foreach ($arr as $srv) {                
if (!empty($srv['name'])) $servers[] = $srv['name'];            }
        }
    }
    
if (empty($servers)) $servers = RB_FALLBACK;    shuffle($servers);    rb_cache_set('servers', $servers);    return $servers;}

function rb_api($endpoint, 
$params = [], $timeout = 10) {    $servers = rb_get_servers();    $query = http_build_query($params);    foreach ($servers as $srv) {        $url = 'https://' . $srv . $endpoint . ($query ? '?' . $query : '');        $ch = curl_init($url);        curl_setopt_array($ch, [            CURLOPT_RETURNTRANSFER => true,            CURLOPT_TIMEOUT => $timeout,            CURLOPT_CONNECTTIMEOUT => 5,            CURLOPT_USERAGENT => RB_UA,            CURLOPT_HTTPHEADER => ['Accept: application/json']        ]);        $resp = curl_exec($ch);        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);        $err = curl_error($ch);        curl_close($ch);        rb_log("API $url [$code] $err");        
if ($code === 200 && $resp) {            $data = json_decode($resp, true);            
if ($data !== null) return $data;            rb_log("Invalid JSON: $resp");        }
    }
    return false;}

$response = ['success' => false, 'message' => 'Unknown command'];
switch ($cmd) {    // === Custom API Management ===    
    case 'custom_apis_list':        $apis = rb_get_custom_apis();        
$response = ['success' => true, 'apis' => $apis];        break;
        
    case 'custom_api_add':        $name = trim($_POST['name'] ?? $_GET['name'] ?? '');        $url = trim($_POST['url'] ?? $_GET['url'] ?? '');        $type = trim($_POST['type'] ?? $_GET['type'] ?? 'radio-browser');                
if (empty($name)) {            
$response = ['success' => false, 'message' => 'Name is required'];        }
 else
if (empty($url)) {            
$response = ['success' => false, 'message' => 'URL is required'];        }
 else
if (!filter_var($url, FILTER_VALIDATE_URL)) {            
$response = ['success' => false, 'message' => 'Invalid URL format'];        }
 else {
            $response = rb_add_custom_api($name, $url, $type);        }
        break;
        
    case 'custom_api_remove':        $id = trim($_POST['id'] ?? $_GET['id'] ?? '');                
if (empty($id)) {            
$response = ['success' => false, 'message' => 'API ID is required'];        }
 else {
            $response = rb_remove_custom_api($id);        }
        break;
        
    case 'test':        
$response = ['success' => true, 'message' => 'Radio Browser API is working', 'timestamp' => time(), 'version' => '1.1.0'];        break;
    
    case 'test_search':        // Return mock data for testing        
$response = [            'success' => true,            'stations' => [                [                    'name' => 'Test Station 1',                    'url' => 'http://test1.com/stream',                    'country' => 'Netherlands',                    'favicon' => '/images/radio-logo.png',                    'tags' => 'test,jazz'                ],                [                    'name' => 'Test Station 2',                    'url' => 'http://test2.com/stream',                    'country' => 'Germany',                    'favicon' => '/images/radio-logo.png',                    'tags' => 'test,rock'                ]            ]        ];        break;
        
    case 'system_info':        // Get system information for extension info panel        $moodeVersion = 'Unknown';        
if (file_exists('/var/www/footer.php')) {            $footer = @file_get_contents('/var/www/footer.php');            
if (preg_match('/moode\s+(\d+\.\d+\.\d+)/i', $footer, $matches)) {                $moodeVersion = $matches[1];            }
        }
        // Fallback: check /etc/moode-release        
if ($moodeVersion === 'Unknown' && file_exists('/etc/moode-release')) {            $moodeVersion = trim(@file_get_contents('/etc/moode-release'));        }
                
$response = [            'success' => true,            'php_version' => phpversion(),            'moode_version' => $moodeVersion,            'curl_enabled' => function_exists('curl_init')        ];        break;
        
    case 'status':        $servers = rb_get_servers();        
$results = [];        foreach ($servers as $srv) {            $url = 'https://' . $srv . '/json/stats';            $ch = curl_init($url);            curl_setopt_array($ch, [                CURLOPT_RETURNTRANSFER => true,                CURLOPT_TIMEOUT => 5,                CURLOPT_USERAGENT => RB_UA            ]);            $start_time = microtime(true);            $resp = curl_exec($ch);            $end_time = microtime(true);            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);            curl_close($ch);                        // Calculate latency in milliseconds            $latency = ($code === 200) ? round(($end_time - $start_time) * 1000) : 0;                        $results[] = [                'name' => $srv,                'online' => ($code === 200),                'latency' => $latency,                'url' => $url            ];        }
        
$response = ['success' => true, 'servers' => $results];        break;
    
    case 'get_logo':        $url = $_GET['url'] ?? '';        
if (empty($url)) {            
$response = ['success' => false, 'message' => 'No URL provided'];            break;
        }
                try {            // Query database for station logo            $dbh = sqlConnect();            $sql = "SELECT logo FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' AND type='rb'";            $result = sqlQuery($sql, $dbh);                        
if ($result && count($result) > 0 && isset($result[0]['logo']) && !empty($result[0]['logo'])) {                $logo = $result[0]['logo'];                // If logo is a relative path, make it absolute                
if (!preg_match('/^https?:\/\//', $logo)) {                    $logo = '/images/radio-logos/' . $logo;                }
                
$response = ['success' => true, 'logo' => $logo];            }
 else {
                
$response = ['success' => false, 'message' => 'No logo found for this station'];            }
        }
 catch (Exception $e) {            
$response = ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];        }
        break;
    
    case 'countries':        $data = rb_cache_get('countries', RB_CACHE_TTL_STATIC);        
if ($data === false) {            $data = rb_api('/json/countries');            
if ($data !== false) {                rb_cache_set('countries', $data);            }
        }
        
if ($data !== false) {            
$response = ['success' => true, 'countries' => $data];        }
 else {
            
$response = ['success' => false, 'message' => 'No results or API error'];        }
        break;
    
    case 'genres':        $data = rb_cache_get('genres', RB_CACHE_TTL_STATIC);        
if ($data === false) {            $data = rb_api('/json/tags');            
if ($data !== false) {                rb_cache_set('genres', $data);            }
        }
        
if ($data !== false) {            
$response = ['success' => true, 'genres' => $data];        }
 else {
            
$response = ['success' => false, 'message' => 'No results or API error'];        }
        break;
    
    case 'search':        
$params = [            'name' => $_POST['name'] ?? '',            'countrycode' => $_POST['countrycode'] ?? '',            'tag' => $_POST['tag'] ?? '',            'offset' => $_POST['offset'] ?? 0,            'limit' => $_POST['limit'] ?? 30,            'order' => $_POST['order'] ?? 'clickcount',            'reverse' => $_POST['reverse'] ?? 'true',        ];        $params = array_filter($params, function($v) { return $v !== '' && $v !== null; }
);        $cache_key = 'search_' . md5(json_encode($params));        $data = rb_cache_get($cache_key, RB_CACHE_TTL);        
if ($data === false) {            $data = rb_api('/json/stations/search', $params);            
if ($data !== false) {                rb_cache_set($cache_key, $data);            }
        }
        
if ($data !== false) {            // Process favicons for caching            foreach ($data as &$station) {                
if (!empty($station['favicon']) && !str_contains($station['favicon'], 'encrypted-tbn0.gstatic.com')) {                    $cached_image = rb_cache_image($station['favicon']);                    
if ($cached_image) {                        $station['favicon'] = $cached_image;                    }
                }
            }
            
$response = ['success' => true, 'stations' => $data];        }
 else {
            
$response = ['success' => false, 'message' => 'No results or API error'];        }
        break;
    
    case 'top_click':        $limit = $_POST['limit'] ?? 30;        $cache_key = 'top_click_' . $limit;        $data = rb_cache_get($cache_key, RB_CACHE_TTL_STATIC);        
if ($data === false) {            $data = rb_api('/json/stations/topclick/'.$limit);            
if ($data !== false) {                rb_cache_set($cache_key, $data);            }
 else {
                // Try to get cached data even if expired as fallback                $data = rb_cache_get($cache_key, 0);            }
        }
        
if ($data !== false) {            // Process favicons for caching            foreach ($data as &$station) {                
if (!empty($station['favicon']) && !str_contains($station['favicon'], 'encrypted-tbn0.gstatic.com')) {                    $cached_image = rb_cache_image($station['favicon']);                    
if ($cached_image) {                        $station['favicon'] = $cached_image;                    }
                }
            }
            
$response = ['success' => true, 'stations' => $data];        }
 else {
            
$response = ['success' => false, 'message' => 'No results or API error'];        }
        break;
    
    case 'play':        $station = json_decode(file_get_contents('php://input'), true);        
if (!$station || empty($station['url'])) {            
$response = ['success' => false, 'message' => 'No station data'];            break;
        }
        
require_once '/var/www/inc/mpd.php';                // Set session data for currentsong.txt compatibility        // This allows moOde's worker.php/enhanceMetadata() to show correct station info        phpSession('open');        $_SESSION[$station['url']] = [            'name' => $station['name'] ?? 'Radio Browser Station',            'type' => 'rb',            'logo' => !empty($station['favicon']) ? $station['favicon'] : 'local',            'bitrate' => isset($station['bitrate']) && $station['bitrate'] > 0 ? $station['bitrate'] : '',            'format' => $station['codec'] ?? '',            'home_page' => $station['homepage'] ?? '',            'monitor' => 'No'        ];        phpSession('close');                // Track recently played using file-based storage (persistent, ordered by play time)        rb_add_recently_played([            'url' => $station['url'],            'name' => $station['name'] ?? 'Radio Browser Station',            'logo' => !empty($station['favicon']) ? $station['favicon'] : 'local'        ]);                rb_debug_log('Set session data for station: ' . $station['name'] . ', URL: ' . $station['url']);                $sock = openMpdSock('localhost', 6600);        
if (!$sock) {            
$response = ['success' => false, 'message' => 'Cannot connect to MPD'];            break;
        }
        sendMpdCmd($sock, 'clear');        $resp = readMpdResp($sock);        
if (strpos($resp, 'OK') === false) {            
$response = ['success' => false, 'message' => 'MPD clear failed'];            break;
        }
        sendMpdCmd($sock, 'add "' . $station['url'] . '"');        $resp = readMpdResp($sock);        
if (strpos($resp, 'OK') === false) {            
$response = ['success' => false, 'message' => 'MPD add failed'];            break;
        }
        sendMpdCmd($sock, 'play');        $resp = readMpdResp($sock);        
if (strpos($resp, 'OK') === false) {            
$response = ['success' => false, 'message' => 'MPD play failed'];            break;
        }
        closeMpdSock($sock);        
$response = ['success' => true, 'message' => 'Playing: ' . $station['name']];        break;
    
    case 'import':        $station = json_decode(file_get_contents('php://input'), true);        
if (!$station || empty($station['url'])) {            // Try to get station data from POST parameters            $station = $_POST;            
if (!$station || empty($station['url'])) {                
$response = ['success' => false, 'message' => 'No station data'];                break;
            }
        }
        $dbh = sqlConnect();        $name = !empty($station['name']) ? trim($station['name']) : 'Unknown Station';        $url = trim($station['url']);        $favicon = !empty($station['favicon']) ? trim($station['favicon']) : '';                // Check if station already exists        $checkSql = "SELECT 1 FROM cfg_radio WHERE name = '" . SQLite3::escapeString($name) . "' AND type='rb' LIMIT 1";        $checkResult = sqlQuery($checkSql, $dbh);        
if (is_array($checkResult) && count($checkResult) > 0) {            
$response = ['success' => false, 'message' => 'Station already in favorites'];            break;
        }
                // Process favicon if available - download and convert to JPG        $logo = 'local'; // Default to local logo        $logoSaved = false;        
if (!empty($favicon) && !str_contains($favicon, 'encrypted-tbn0.gstatic.com')) {            rb_debug_log('Processing favicon for station: ' . $name . ', URL: ' . $favicon);                        // Download favicon            $ch = curl_init($favicon);            curl_setopt_array($ch, [                CURLOPT_RETURNTRANSFER => true,                CURLOPT_TIMEOUT => 10,                CURLOPT_USERAGENT => RB_UA,                CURLOPT_FOLLOWLOCATION => true,                CURLOPT_MAXREDIRS => 3            ]);            $imageData = curl_exec($ch);            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);            curl_close($ch);                        
if ($imageData !== false && $httpCode == 200 && strlen($imageData) > 100) {                rb_debug_log('Downloaded favicon, size: ' . strlen($imageData) . ' bytes');                                // Use our own PNG->JPG conversion and save directly                
if (rb_save_permanent_logo($name, $imageData)) {                    rb_debug_log('Logo saved permanently using rb_save_permanent_logo');                    $logoSaved = true;                }
 else {
                    // Fallback to moOde job system                    rb_debug_log('Falling back to moOde job system');                    $base64Data = base64_encode($imageData);                    
if (submitJob('set_ralogo_image', $name . ',' . $base64Data, '', '')) {                        rb_debug_log('Job submitted for station: ' . $name);                        sleep(2);                    }
                }
            }
 else {
                rb_debug_log('Failed to download favicon for station: ' . $name . ', HTTP: ' . $httpCode);            }
        }
 else {
            rb_debug_log('No favicon processing for station: ' . $name . ', favicon: ' . ($favicon ?: 'empty'));        }
                $sql = "INSERT INTO cfg_radio (station, name, type, logo, genre, broadcaster, language, country, region, bitrate, format, geo_fenced, home_page, monitor) VALUES ('" . SQLite3::escapeString($url) . "', '" . SQLite3::escapeString($name) . "', 'rb', '" . SQLite3::escapeString($logo) . "', '', '', '', '', '', '', '', 'No', '', '')";        $result = sqlQuery($sql, $dbh);        
if ($result !== true) {            
$response = ['success' => false, 'message' => 'Failed to add station to database'];            break;
        }
                // Move processed thumbnails to final location (only if we used the job system)        
if ($logo == 'local' && !$logoSaved) {            putStationCover($name);        }
                
$response = ['success' => true, 'message' => 'Station added to Radio'];        break;
    
    case 'current_status':        
require_once '/var/www/inc/mpd.php';        $sock = openMpdSock('localhost', 6600);        
if (!$sock) {            
$response = ['success' => false, 'message' => 'Cannot connect to MPD'];            break;
        }
        $status = getMpdStatus($sock);        $current = getCurrentSong($sock);        $is_playing = isset($status['state']) && $status['state'] == 'play';        $current_url = isset($current['file']) ? $current['file'] : null;        closeMpdSock($sock);        
$response = ['success' => true, 'is_playing' => $is_playing, 'current_url' => $current_url];        break;
    
    case 'favorites':        $dbh = sqlConnect();        
if (!$dbh) {            
$response = ['success' => false, 'message' => 'Database connection failed'];            break;
        }
        $result = sqlQuery("SELECT station, name, logo FROM cfg_radio WHERE type='rb'", $dbh);        
$favorites = [];        
if (is_array($result)) {            foreach ($result as $row) {                $favorites[] = [                    'url' => trim($row['station']),                    'name' => trim($row['name']),                    'logo' => trim($row['logo'])                ];            }
        }
        
$response = ['success' => true, 'favorites' => $favorites];        break;
    
    case 'remove':        $station = json_decode(file_get_contents('php://input'), true);        
if (!$station || empty($station['url'])) {            // Try to get station data from POST parameters            $station = $_POST;            
if (!$station || empty($station['url'])) {                
$response = ['success' => false, 'message' => 'No station data'];                break;
            }
        }
        $dbh = sqlConnect();        $url = trim($station['url']);                // Remove from database        $sql = "DELETE FROM cfg_radio WHERE station = '" . SQLite3::escapeString($url) . "' AND type='rb'";        $result = sqlQuery($sql, $dbh);        
if ($result !== true) {            
$response = ['success' => false, 'message' => 'Failed to remove station from database'];            break;
        }
                
$response = ['success' => true, 'message' => 'Station removed from Radio'];        break;
    
    case 'recently_played':        // Recently played: Get from file-based storage (tracks play order) with fallback to database        
$stations = [];                // First try file-based recently played (ordered by play time)        $fileBasedList = rb_get_recently_played();                
if (!empty($fileBasedList)) {            foreach ($fileBasedList as $entry) {                $stations[] = [                    'url' => $entry['url'],                    'name' => $entry['name'],                    'logo' => $entry['logo'] ?? 'local'                ];            }
            rb_debug_log('Recently played from file: ' . count($stations) . ' stations');        }
 else {
            // Fallback to database for first-time users            $dbh = sqlConnect();            
if ($dbh) {                $result = sqlQuery("SELECT station, name, logo FROM cfg_radio WHERE type='rb' ORDER BY id DESC LIMIT 10", $dbh);                
if (is_array($result)) {                    foreach ($result as $row) {                        $stations[] = [                            'url' => trim($row['station']),                            'name' => trim($row['name']),                            'logo' => trim($row['logo'])                        ];                    }
                }
                rb_debug_log('Recently played from database (fallback): ' . count($stations) . ' stations');            }
        }
                
$response = ['success' => true, 'stations' => $stations];        break;
    
    case 'flush_cache':        // Flush all cached data        $cache_files = glob(RB_CACHE . '/*.json');        $image_files = glob(RB_IMAGE_CACHE . '/*');        $deleted = 0;        foreach ($cache_files as $file) {            
if (@unlink($file)) $deleted++;        }
        foreach ($image_files as $file) {            
if (is_file($file) && @unlink($file)) $deleted++;        }
        rb_debug_log('Cache flushed: ' . $deleted . ' files deleted');        
$response = ['success' => true, 'message' => 'Cache flushed (' . $deleted . ' files deleted)'];        break;
    
    case 'restart_services':        // Restart nginx and PHP-FPM using background process        // We need to send response first, then restart in background so connection doesn't die        rb_debug_log('Services restart requested');                // Send success response immediately before restarting        header('Content-Type: application/json');        echo json_encode(['success' => true, 'message' => 'Services restart initiated...']);                // Flush output to client        
if (function_exists('fastcgi_finish_request')) {            fastcgi_finish_request();        }
 else {
            ob_end_flush();            flush();        }
                // Small delay to ensure response is sent        usleep(100000); // 100ms                // Now restart services (connection already closed)        exec('sudo /usr/bin/systemctl restart nginx 2>&1');        sleep(1);        exec('sudo /usr/bin/systemctl restart php8.4-fpm 2>&1');                rb_debug_log('Services restart completed');        exit; // Already sent response, don't continue        break;
    
    case 'view_log':        // Read last 100 lines of log file        $log_content = '';        
if (file_exists(RB_LOG)) {            $lines = file(RB_LOG);            $lines = array_slice($lines, -100);            $log_content = implode('', $lines);        }
        
$response = ['success' => true, 'log' => $log_content ?: 'Log is empty'];        break;
    
    case 'clear_log':        // Clear log file        
if (@file_put_contents(RB_LOG, '') !== false) {            
$response = ['success' => true, 'message' => 'Log file cleared'];        }
 else {
            
$response = ['success' => false, 'message' => 'Failed to clear log file'];        }
        break;
        
    case 'fix_permissions':        // Fix permissions on extension files using shell script        $script = __DIR__ . '/../scripts/fix-permissions.sh';        
if (file_exists($script)) {            $output = shell_exec('sudo bash ' . escapeshellarg($script) . ' 2>&1');            rb_debug_log('fix_permissions output: ' . $output);            
$response = ['success' => true, 'message' => 'Permissions fixed', 'details' => $output];        }
 else {
            
$response = ['success' => false, 'message' => 'Fix permissions script not found'];        }
        break;
        
    case 'test_api':        // Test API connections using shell script        $script = __DIR__ . '/../scripts/test-api.sh';        
if (file_exists($script)) {            $output = shell_exec('bash ' . escapeshellarg($script) . ' 2>&1');            
$response = ['success' => true, 'message' => 'API test completed', 'details' => $output];        }
 else {
            
$response = ['success' => false, 'message' => 'Test API script not found'];        }
        break;
        
    case 'reboot':        // Reboot the system        rb_debug_log('System reboot requested');                // Send success response immediately before rebooting        header('Content-Type: application/json');        echo json_encode(['success' => true, 'message' => 'System is rebooting...']);                // Flush output to client        
if (function_exists('fastcgi_finish_request')) {            fastcgi_finish_request();        }
 else {
            ob_end_flush();            flush();        }
                // Small delay to ensure response is sent        usleep(500000); // 500ms                // Execute reboot command        exec('sudo /sbin/reboot');                rb_debug_log('Reboot command executed');        exit;        break;
    default:        
$response = ['success' => false, 'message' => 'Unknown command'];}

function putStationCover($stName) {	$stTmpImage = RADIO_LOGOS_ROOT . TMP_IMAGE_PREFIX . $stName . '.jpg';	$stTmpImageThm = RADIO_LOGOS_ROOT . 'thumbs/' . TMP_IMAGE_PREFIX . $stName . '.jpg';	$stTmpImageThmSm = RADIO_LOGOS_ROOT . 'thumbs/' . TMP_IMAGE_PREFIX . $stName . '_sm.jpg';	$stCoverImage = RADIO_LOGOS_ROOT . $stName . '.jpg';	$stCoverImageThm = RADIO_LOGOS_ROOT . 'thumbs/' .  $stName . '.jpg';	$stCoverImageThmSm = RADIO_LOGOS_ROOT . 'thumbs/' .  $stName . '_sm.jpg';	$defaultImage = DEFAULT_NOTFOUND_COVER;	sendFECmd('set_cover_image1'); // Show spinner	sleep(3); // Allow time for set_ralogo_image job to create __tmp__ image file	
if (file_exists($stTmpImage)) {		sysCmd('mv "' . $stTmpImage . '" "' . $stCoverImage . '"');		sysCmd('mv "' . $stTmpImageThm . '" "' . $stCoverImageThm . '"');		sysCmd('mv "' . $stTmpImageThmSm . '" "' . $stCoverImageThmSm . '"');	}
 else 
if (!file_exists($stCoverImage)) {		sysCmd('cp "' . $defaultImage . '" "' . $stCoverImage . '"');		sysCmd('cp "' . $defaultImage . '" "' . $stCoverImageThm . '"');		sysCmd('cp "' . $defaultImage . '" "' . $stCoverImageThmSm . '"');	}
	sendFECmd('set_cover_image0'); // Hide spinner}
rb_debug_log('OUT: '.json_encode($response));echo json_encode($response);
