<?php
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright 2014 The moOde audio player project / Tim Curtis
 * moOde Extensions Framework - Radio Browser
 */

require_once __DIR__ . '/inc/common.php';
require_once __DIR__ . '/inc/session.php';

// Radio API config
define('RADIO_API_CONFIG', '/var/local/www/extensions/radio-api-services.json');

function getDefaultRadioApiServices() {
    return array(
        'radio-browser' => array('name' => 'Radio Browser (Official)', 'url' => 'https://all.api.radio-browser.info', 'type' => 'radio-browser', 'builtin' => true),
        'radio-browser-de2' => array('name' => 'Radio Browser DE2', 'url' => 'https://de2.api.radio-browser.info', 'type' => 'radio-browser', 'builtin' => true),
        'radio-browser-fi1' => array('name' => 'Radio Browser FI1', 'url' => 'https://fi1.api.radio-browser.info', 'type' => 'radio-browser', 'builtin' => true)
    );
}

function loadRadioApiServices() {
    $services = getDefaultRadioApiServices();
    if (file_exists(RADIO_API_CONFIG)) {
        $custom = json_decode(file_get_contents(RADIO_API_CONFIG), true);
        if (is_array($custom)) $services = array_merge($services, $custom);
    }
    return $services;
}

function getActiveRadioApiService() {
    $activeFile = '/var/local/www/extensions/radio-api-active.txt';
    return file_exists($activeFile) ? trim(file_get_contents($activeFile)) : 'radio-browser';
}

function setActiveRadioApiService($serviceId) {
    return file_put_contents('/var/local/www/extensions/radio-api-active.txt', $serviceId);
}

phpSession('open');

// Handle POST actions
if (isset($_POST['save_radio_api']) && !empty($_POST['radio_api_service'])) {
    $serviceId = $_POST['radio_api_service'];
    $services = loadRadioApiServices();
    if (isset($services[$serviceId])) {
        setActiveRadioApiService($serviceId);
        $_SESSION['notify']['title'] = NOTIFY_TITLE_INFO;
        $_SESSION['notify']['msg'] = 'API service set to: ' . $services[$serviceId]['name'];
    }
}

if (isset($_POST['add_custom_api'])) {
    $name = trim($_POST['custom_api_name'] ?? '');
    $url = trim($_POST['custom_api_url'] ?? '');
    $type = $_POST['custom_api_type'] ?? 'radio-browser';
    
    if (!empty($name) && !empty($url)) {
        $id = 'custom-' . preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
        $customServices = file_exists(RADIO_API_CONFIG) ? (json_decode(file_get_contents(RADIO_API_CONFIG), true) ?: array()) : array();
        $customServices[$id] = array('name' => $name, 'url' => rtrim($url, '/'), 'type' => $type, 'builtin' => false);
        file_put_contents(RADIO_API_CONFIG, json_encode($customServices, JSON_PRETTY_PRINT));
        $_SESSION['notify']['title'] = NOTIFY_TITLE_INFO;
        $_SESSION['notify']['msg'] = 'Added: ' . $name;
    }
}

if (isset($_POST['remove_custom_api']) && !empty($_POST['custom_api_to_remove'])) {
    $serviceId = $_POST['custom_api_to_remove'];
    $customServices = file_exists(RADIO_API_CONFIG) ? (json_decode(file_get_contents(RADIO_API_CONFIG), true) ?: array()) : array();
    if (isset($customServices[$serviceId])) {
        $removedName = $customServices[$serviceId]['name'];
        unset($customServices[$serviceId]);
        if (getActiveRadioApiService() === $serviceId) setActiveRadioApiService('radio-browser');
        file_put_contents(RADIO_API_CONFIG, json_encode($customServices, JSON_PRETTY_PRINT));
        $_SESSION['notify']['title'] = NOTIFY_TITLE_INFO;
        $_SESSION['notify']['msg'] = 'Removed: ' . $removedName;
    }
}

phpSession('close');

// Build template variables
$services = loadRadioApiServices();
$activeService = getActiveRadioApiService();

$_radio_api_options = '';
foreach ($services as $id => $svc) {
    $selected = ($id === $activeService) ? ' selected' : '';
    $_radio_api_options .= '<option value="' . htmlspecialchars($id) . '"' . $selected . '>' . htmlspecialchars($svc['name']) . '</option>';
}

$_custom_api_options = '<option value="">-- Select --</option>';
foreach ($services as $id => $svc) {
    if (empty($svc['builtin'])) {
        $_custom_api_options .= '<option value="' . htmlspecialchars($id) . '">' . htmlspecialchars($svc['name']) . '</option>';
    }
}

$tpl = "radio-browser.html";
$section = basename(__FILE__, '.php');
storeBackLink($section, $tpl);

include('header.php');
echo '<link href="css/extensions.css?v=' . time() . '" rel="stylesheet">';
eval("echoTemplate(\"" . getTemplate("templates/$tpl") . "\");");
if (file_exists(__DIR__ . '/footer.min.php')) {
    include('footer.min.php');
} else {
    include('footer.php');
}
echo '<script src="js/scripts-radio-browser.js?v=' . time() . '"></script>';
?>
