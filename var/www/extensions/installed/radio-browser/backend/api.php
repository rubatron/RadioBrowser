<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2014 The moOde audio player project / Tim Curtis
// moOde Extensions Framework - Radio Browser Extension

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 The moOde audio player project / Tim Curtis
// Radio Browser Extension - Modern API backend

// --- EXTENSIEVE BACKEND LOGGING ---
function rb_debug_log($msg) {
    @file_put_contents(RB_LOG, '[DEBUG '.date('c').'] '.$msg."\n", FILE_APPEND);
}

require_once '/var/www/inc/common.php';
require_once '/var/www/inc/session.php';
require_once '/var/www/inc/sql.php';

// --- CONFIG ---
define('RB_DISCOVERY', 'https://all.api.radio-browser.info/json/servers');
define('RB_FALLBACK', [
    'de2.api.radio-browser.info',
    'fi1.api.radio-browser.info',
    'nl1.api.radio-browser.info',
    'us1.api.radio-browser.info',
    'at1.api.radio-browser.info',
    'ru1.api.radio-browser.info',
    'gb1.api.radio-browser.info'
]);
define('RB_CACHE', '/var/local/www/extensions/cache/radio-browser');
define('RB_LOG', '/var/local/www/extensions/logs/radio-browser.log');
define('RB_UA', 'moode-radio-browser/1.0');
define('RB_CACHE_TTL', 1800);
define('RB_CACHE_TTL_STATIC', 86400);
define('RB_SERVERS_TTL', 3600);

// Log elke inkomende request
rb_debug_log('IN: cmd='.(isset($cmd)?$cmd:'').', params='.json_encode($_REQUEST).', IP='.$_SERVER['REMOTE_ADDR']);
define('RB_CACHE_TTL', 1800);
define('RB_CACHE_TTL_STATIC', 86400);
define('RB_SERVERS_TTL', 3600);

function rb_log($msg) {
    @file_put_contents(RB_LOG, '['.date('c').'] '.$msg."\n", FILE_APPEND);
}

function rb_cache_get($key, $ttl) {
    $file = RB_CACHE . '/' . md5($key) . '.json';
    if (file_exists($file) && (time() - filemtime($file) < $ttl)) {
        $data = @file_get_contents($file);
        if ($data !== false) return json_decode($data, true);
    }
    return false;
}
function rb_cache_set($key, $data) {
    if (!is_dir(RB_CACHE)) @mkdir(RB_CACHE, 0777, true);
    $file = RB_CACHE . '/' . md5($key) . '.json';
    @file_put_contents($file, json_encode($data));
}

function rb_get_servers() {
    $cache = rb_cache_get('servers', RB_SERVERS_TTL);
    if ($cache && is_array($cache)) return $cache;
    $servers = [];
    $ch = curl_init(RB_DISCOVERY);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_USERAGENT => RB_UA
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if ($resp) {
        $arr = json_decode($resp, true);
        if (is_array($arr)) {
            foreach ($arr as $srv) {
                if (!empty($srv['name'])) $servers[] = $srv['name'];
            }
        }
    }
    if (empty($servers)) $servers = RB_FALLBACK;
    shuffle($servers);
    rb_cache_set('servers', $servers);
    return $servers;
}

function rb_api($endpoint, $params = [], $timeout = 10) {
    $servers = rb_get_servers();
    $query = http_build_query($params);
    foreach ($servers as $srv) {
        $url = 'https://' . $srv . $endpoint . ($query ? '?' . $query : '');
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => RB_UA,
            CURLOPT_HTTPHEADER => ['Accept: application/json']
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        rb_log("API $url [$code] $err");
        if ($code === 200 && $resp) {
            $data = json_decode($resp, true);
            if ($data !== null) return $data;
            rb_log("Invalid JSON: $resp");
        }
    }
    return false;
}

rb_debug_log('OUT: '.json_encode($response));
$cmd = $_GET['cmd'] ?? $_POST['cmd'] ?? '';
$response = ['success' => false, 'message' => 'Unknown command'];

switch ($cmd) {
    case 'status':
        $servers = rb_get_servers();
        $results = [];
        foreach ($servers as $srv) {
            $url = 'https://' . $srv . '/json/stats';
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_USERAGENT => RB_UA
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $results[] = [
                'name' => $srv,
                'online' => ($code === 200),
                'latency' => 0,
                'url' => $url
            ];
        }
        $response = ['success' => true, 'servers' => $results];
        break;
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
        $params = [
            'name' => $_POST['name'] ?? '',
            'countrycode' => $_POST['countrycode'] ?? '',
            'tag' => $_POST['tag'] ?? '',
            'offset' => $_POST['offset'] ?? 0,
            'limit' => $_POST['limit'] ?? 30,
            'order' => $_POST['order'] ?? 'clickcount',
            'reverse' => $_POST['reverse'] ?? 'true',
        ];
        $params = array_filter($params, function($v) { return $v !== '' && $v !== null; });
        $cache_key = 'search_' . md5(json_encode($params));
        $data = rb_cache_get($cache_key, RB_CACHE_TTL);
        if ($data === false) {
            $data = rb_api('/json/stations/search', $params);
            if ($data !== false) {
                rb_cache_set($cache_key, $data);
            }
        }
        if ($data !== false) {
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
            $data = rb_api('/json/stations/topclick/'.$limit);
            if ($data !== false) {
                rb_cache_set($cache_key, $data);
            } else {
                // Try to get cached data even if expired as fallback
                $data = rb_cache_get($cache_key, 0);
            }
        }
        if ($data !== false) {
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
        $sock = openMpdSock('localhost', 6600);
        if (!$sock) {
            $response = ['success' => false, 'message' => 'Cannot connect to MPD'];
            break;
        }
        sendMpdCmd($sock, 'clear');
        $resp = readMpdResp($sock);
        if (strpos($resp, 'OK') === false) {
            $response = ['success' => false, 'message' => 'MPD clear failed'];
            break;
        }
        sendMpdCmd($sock, 'add "' . $station['url'] . '"');
        $resp = readMpdResp($sock);
        if (strpos($resp, 'OK') === false) {
            $response = ['success' => false, 'message' => 'MPD add failed'];
            break;
        }
        sendMpdCmd($sock, 'play');
        $resp = readMpdResp($sock);
        if (strpos($resp, 'OK') === false) {
            $response = ['success' => false, 'message' => 'MPD play failed'];
            break;
        }
        closeMpdSock($sock);
        $response = ['success' => true, 'message' => 'Playing: ' . $station['name']];
        break;
    case 'import':
        $station = json_decode(file_get_contents('php://input'), true);
        if (!$station || empty($station['url'])) {
            $response = ['success' => false, 'message' => 'No station data'];
            break;
        }
        $dbh = sqlConnect();
        $name = !empty($station['name']) ? trim($station['name']) : 'Unknown Station';
        $url = $station['url'];
        $sql = "INSERT INTO cfg_radio (station, name, type, logo, genre, broadcaster, language, country, region, bitrate, format, geo_fenced, home_page, monitor) VALUES ('" . SQLite3::escapeString($url) . "', '" . SQLite3::escapeString($name) . "', 'r', '', '', '', '', '', '', '', '', 'No', '', '')";
        $result = sqlQuery($sql, $dbh);
        if ($result !== true) {
            $response = ['success' => false, 'message' => 'Failed to add station to database'];
            break;
        }
        $response = ['success' => true, 'message' => 'Station added to Radio'];
        break;
    case 'current_status':
        require_once '/var/www/inc/mpd.php';
        $sock = openMpdSock('localhost', 6600);
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
        $dbh = sqlConnect();
        if (!$dbh) {
            $response = ['success' => false, 'message' => 'Database connection failed'];
            break;
        }
        $result = sqlQuery("SELECT station FROM cfg_radio WHERE type='r'", $dbh);
        $favorites = [];
        if (is_array($result)) {
            foreach ($result as $row) {
                $favorites[] = $row['station'];
            }
        }
        $response = ['success' => true, 'favorites' => $favorites];
        break;
    default:
        $response = ['success' => false, 'message' => 'Unknown command'];
}
echo json_encode($response);
