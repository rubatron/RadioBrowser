/*!
 * RubaTron's Radio Browser Extension for moOde Audio Player
 * Settings Module - Visibility, API status, troubleshooting
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 2026 RubaTron
 * Version: 3.4.0
 */

(function() {
    'use strict';

    var RB = window.RadioBrowser;
    var utils = RB.utils;

    // ========================================================================
    // VISIBILITY STATE
    // ========================================================================

    var visibilityState = {
        header: true,
        library: true,
        m: true,
        system: true
    };

    function visibilityAreaName(area) {
        return area === 'header' ? 'Header menu'
            : area === 'library' ? 'Library menu'
            : area === 'm' ? 'M Menu'
            : 'M Configuration Tile';
    }

    function applyToggleState(toggleEl, visible) {
        if (!toggleEl || !toggleEl.length) return;
        if (visible) {
            toggleEl.removeClass('toggle-off').addClass('toggle-on');
        } else {
            toggleEl.removeClass('toggle-on').addClass('toggle-off');
        }
        toggleEl.find('input[value="On"]').prop('checked', visible);
        toggleEl.find('input[value="Off"]').prop('checked', !visible);
    }

    function applyVisibilityButtonState(toggleEl, stateEl, area, visible) {
        if (!toggleEl || !toggleEl.length) return;
        applyToggleState(toggleEl, visible);
        toggleEl.attr('title', visibilityAreaName(area) + ': ' + (visible ? 'Visible' : 'Hidden'));
        if (stateEl && stateEl.length) {
            stateEl.text(visible ? 'Visible' : 'Hidden');
        }
    }

    function renderVisibility(visibility) {
        var v = visibility || {};
        visibilityState.header = v.header !== false;
        visibilityState.library = v.library !== false;
        visibilityState.m = v.m !== false;
        visibilityState.system = v.system !== false;

        applyVisibilityButtonState($('#rb-visibility-header-btn'), $('#rb-visibility-header-state'), 'header', visibilityState.header);
        applyVisibilityButtonState($('#rb-visibility-library-btn'), $('#rb-visibility-library-state'), 'library', visibilityState.library);
        applyVisibilityButtonState($('#rb-visibility-m-btn'), $('#rb-visibility-m-state'), 'm', visibilityState.m);
        applyVisibilityButtonState($('#rb-visibility-system-btn'), $('#rb-visibility-system-state'), 'system', visibilityState.system);
    }

    function setVisibility(area, visible, toggleEl) {
        if (!toggleEl || !toggleEl.length) return;

        var radios = toggleEl.find('input[type="radio"]');
        radios.prop('disabled', true);
        toggleEl.css('pointer-events', 'none');

        $.ajax({
            url: RB.API_URL + '?cmd=set_visibility',
            type: 'POST',
            data: { area: area, value: visible ? '1' : '0' },
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                radios.prop('disabled', false);
                toggleEl.css('pointer-events', '');

                if (data.success && data.data && data.data.visibility) {
                    renderVisibility(data.data.visibility);
                    $('#rb-visibility-note').text('Visibility updated for ' + visibilityAreaName(area) + '.')
                        .removeClass('error').addClass('ok');
                    utils.notify('Updated', visibilityAreaName(area) + ' visibility updated', 'success');
                } else {
                    $('#rb-visibility-note').text(data.message || 'Failed to update visibility')
                        .removeClass('ok').addClass('error');
                    utils.notify('Error', data.message || 'Failed to update visibility', 'error');
                }
            },
            error: function() {
                radios.prop('disabled', false);
                toggleEl.css('pointer-events', '');
                $('#rb-visibility-note').text('Failed to update visibility').removeClass('ok').addClass('error');
                utils.notify('Error', 'Failed to update visibility', 'error');
            }
        });
    }

    function loadSettings() {
        $.ajax({
            url: RB.API_URL + '?cmd=get_settings',
            type: 'GET',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data.success && data.settings) {
                    if (data.settings.visibility) {
                        renderVisibility(data.settings.visibility);
                    }
                }
            }
        });
    }

    function bindVisibilityEvents() {
        var areas = [
            ['rb-visibility-header-btn', 'header'],
            ['rb-visibility-library-btn', 'library'],
            ['rb-visibility-m-btn', 'm'],
            ['rb-visibility-system-btn', 'system']
        ];

        areas.forEach(function(e) {
            var toggleEl = $('#' + e[0]);
            var area = e[1];
            if (!toggleEl.length) return;

            toggleEl.find('input[type="radio"]').on('change', function() {
                if ($(this).prop('checked')) {
                    setVisibility(area, $(this).val() === 'On', toggleEl);
                }
            });
        });
    }

    // ========================================================================
    // LOCAL DISPLAY SETTINGS (localStorage)
    // ========================================================================

    var localSettings = {
        playbar: true,
        logo: true
    };

    function loadLocalSettings() {
        try {
            var stored = localStorage.getItem('rb-local-settings');
            if (stored) {
                var parsed = JSON.parse(stored);
                localSettings.playbar = parsed.playbar !== false;
                localSettings.logo = parsed.logo !== false;
            }
        } catch (e) {
            console.log('Radio Browser: Error loading local settings', e);
        }
        applyLocalSettings();
        renderLocalToggles();
    }

    function saveLocalSettings() {
        try {
            localStorage.setItem('rb-local-settings', JSON.stringify(localSettings));
        } catch (e) {
            console.log('Radio Browser: Error saving local settings', e);
        }
    }

    function applyLocalSettings() {
        var $playbar = $('#rb-playbar');
        if ($playbar.length) {
            if (localSettings.playbar) {
                $playbar.removeClass('rb-hidden');
                $('#container').css('padding-bottom', '70px');
            } else {
                $playbar.addClass('rb-hidden');
                $('#container').css('padding-bottom', '0');
            }
        }

        var $playbarCover = $('#playbar-cover');
        if ($playbarCover.length) {
            $playbarCover.css('display', localSettings.logo ? '' : 'none');
        }
    }

    function renderLocalToggles() {
        applyLocalToggleState($('#rb-local-playbar-btn'), $('#rb-local-playbar-state'), localSettings.playbar);
        applyLocalToggleState($('#rb-local-logo-btn'), $('#rb-local-logo-state'), localSettings.logo);
    }

    function applyLocalToggleState($toggle, $stateEl, visible) {
        if (!$toggle.length) return;
        $toggle.toggleClass('toggle-on', visible).toggleClass('toggle-off', !visible);
        $toggle.find('input[value="On"]').prop('checked', visible);
        $toggle.find('input[value="Off"]').prop('checked', !visible);
        if ($stateEl.length) {
            $stateEl.text(visible ? 'Visible' : 'Hidden');
        }
    }

    function bindLocalToggleEvents() {
        $('#rb-local-playbar-btn input[type="radio"]').on('change', function() {
            if ($(this).prop('checked')) {
                localSettings.playbar = $(this).val() === 'On';
                saveLocalSettings();
                applyLocalSettings();
                renderLocalToggles();
                utils.notify('Updated', 'Mini playbar ' + (localSettings.playbar ? 'visible' : 'hidden'), 'success');
            }
        });

        $('#rb-local-logo-btn input[type="radio"]').on('change', function() {
            if ($(this).prop('checked')) {
                localSettings.logo = $(this).val() === 'On';
                saveLocalSettings();
                applyLocalSettings();
                renderLocalToggles();
                utils.notify('Updated', 'Playbar logo ' + (localSettings.logo ? 'visible' : 'hidden'), 'success');
            }
        });
    }

    // ========================================================================
    // API STATUS
    // ========================================================================

    function checkApiStatus() {
        var statusContainer = $('#rb-api-status');
        var refreshBtn = $('#rb-refresh-status');

        refreshBtn.find('i').addClass('fa-spin');
        statusContainer.html('<div class="rb-status-loading"><i class="fa-solid fa-sharp fa-spinner fa-spin"></i> Checking API status...</div>');

        $.ajax({
            url: RB.API_URL + '?cmd=status',
            type: 'POST',
            dataType: 'json',
            timeout: 15000,
            success: function(data) {
                refreshBtn.find('i').removeClass('fa-spin');
                if (data.success && data.servers) {
                    var html = '';
                    data.servers.forEach(function(server) {
                        var statusClass = server.online ? 'online' : 'offline';
                        var latencyClass = server.latency < 500 ? 'fast' : 'slow';
                        var latencyText = server.online ? server.latency + 'ms' : 'offline';

                        html += '<div class="rb-status-item">' +
                            '<div class="rb-status-indicator ' + statusClass + '"></div>' +
                            '<span class="rb-status-name">' + utils.escapeHtml(server.name) + '</span>' +
                            '<span class="rb-status-latency ' + latencyClass + '">' + latencyText + '</span>' +
                        '</div>';
                    });
                    statusContainer.html(html);
                } else {
                    statusContainer.html('<div class="rb-status-item"><span class="rb-status-name">Could not check API status</span></div>');
                }
            },
            error: function() {
                refreshBtn.find('i').removeClass('fa-spin');
                statusContainer.html('<div class="rb-status-item"><span class="rb-status-name">Failed to check API status</span></div>');
            }
        });
    }

    // ========================================================================
    // SERVICE STATUS
    // ========================================================================

    function refreshServiceStatus() {
        var btn = $('#rb-refresh-status');
        btn.prop('disabled', true).find('i').addClass('fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=service_status',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spin');
                if (data.success && data.services) {
                    var nginxDot = $('#rb-nginx-status');
                    nginxDot.css('background', data.services.nginx.active ? '#2ecc71' : '#e74c3c');

                    var phpfpmDot = $('#rb-phpfpm-status');
                    phpfpmDot.css('background', data.services.php_fpm.active ? '#2ecc71' : '#e74c3c');
                } else {
                    utils.notify('Error', data.message || 'Failed to get service status', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spin');
                utils.notify('Error', 'Failed to get service status', 'error');
            }
        });
    }

    // ========================================================================
    // TROUBLESHOOTING FUNCTIONS
    // ========================================================================

    function flushCache() {
        var btn = $('#rb-flush-cache');
        btn.prop('disabled', true).find('i').removeClass('fa-trash-can').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=flush_cache',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-trash-can');
                if (data.success) {
                    utils.notify('Cache Flushed', data.message || 'Cache cleared successfully', 'success');
                } else {
                    utils.notify('Error', data.message || 'Failed to flush cache', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-trash-can');
                utils.notify('Error', 'Failed to flush cache', 'error');
            }
        });
    }

    function restartServices() {
        var btn = $('#rb-restart-services');
        btn.prop('disabled', true).find('i').removeClass('fa-rotate').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=restart_services',
            type: 'POST',
            dataType: 'json',
            timeout: 30000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-rotate');
                if (data.success) {
                    utils.notify('Services Restarted', data.message || 'nginx and PHP-FPM restarted', 'success');
                } else {
                    utils.notify('Error', data.message || 'Failed to restart services', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-rotate');
                utils.notify('Error', 'Failed to restart services', 'error');
            }
        });
    }

    function viewLog() {
        var btn = $('#rb-view-log');
        var output = $('#rb-log-output');
        btn.prop('disabled', true).find('i').removeClass('fa-file-lines').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=view_log',
            type: 'GET',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-file-lines');
                if (data.success) {
                    output.removeClass('hide').find('pre').text(data.log || 'Log is empty');
                } else {
                    utils.notify('Error', data.message || 'Failed to read log', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-file-lines');
                utils.notify('Error', 'Failed to read log', 'error');
            }
        });
    }

    function clearLog() {
        var btn = $('#rb-clear-log');
        btn.prop('disabled', true).find('i').removeClass('fa-eraser').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=clear_log',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-eraser');
                if (data.success) {
                    $('#rb-log-output').addClass('hide').find('pre').text('');
                    utils.notify('Log Cleared', data.message || 'Log file cleared', 'success');
                } else {
                    utils.notify('Error', data.message || 'Failed to clear log', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-eraser');
                utils.notify('Error', 'Failed to clear log', 'error');
            }
        });
    }

    function rebootSystem() {
        if (!confirm('Are you sure you want to reboot the system?')) {
            return;
        }

        var btn = $('#rb-reboot-system');
        btn.prop('disabled', true).find('i').removeClass('fa-power-off').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=reboot',
            type: 'POST',
            dataType: 'json',
            timeout: 10000,
            success: function(data) {
                if (data.success) {
                    utils.notify('Rebooting', data.message || 'System is rebooting...', 'success');
                } else {
                    btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-power-off');
                    utils.notify('Error', data.message || 'Failed to reboot', 'error');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-power-off');
                utils.notify('Error', 'Failed to reboot system', 'error');
            }
        });
    }

    function repairInstallation() {
        if (!confirm('This will repair the Radio Browser installation by fixing symlinks, patches and permissions. Continue?')) {
            return;
        }

        var btn = $('#rb-repair');
        btn.prop('disabled', true).find('i').removeClass('fa-screwdriver-wrench').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=repair',
            type: 'POST',
            dataType: 'json',
            timeout: 30000,
            success: function(data) {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-screwdriver-wrench');
                if (data.success) {
                    var message = 'Repair completed successfully';
                    if (data.fixed && data.fixed.length > 0) {
                        message += ':\n• ' + data.fixed.join('\n• ');
                    }
                    utils.notify('Repair Complete', message, 'success');
                    refreshServiceStatus();
                } else {
                    var errorMsg = data.message || 'Repair completed with errors';
                    if (data.errors && data.errors.length > 0) {
                        errorMsg += ':\n• ' + data.errors.join('\n• ');
                    }
                    utils.notify('Repair Issues', errorMsg, 'warning');
                }
            },
            error: function() {
                btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-screwdriver-wrench');
                utils.notify('Error', 'Failed to repair installation', 'error');
            }
        });
    }

    function uninstallExtension() {
        if (!confirm('WARNING: This will completely remove the Radio Browser extension and restore moOde to its original state.\n\nThis action cannot be undone!\n\nAre you sure you want to uninstall?')) {
            return;
        }

        if (!confirm('FINAL CONFIRMATION: Press OK to uninstall Radio Browser now.')) {
            return;
        }

        var btn = $('#rb-uninstall');
        btn.prop('disabled', true).find('i').removeClass('fa-trash').addClass('fa-spinner fa-spin');

        $.ajax({
            url: RB.API_URL + '?cmd=uninstall',
            type: 'POST',
            dataType: 'json',
            timeout: 60000,
            success: function(data) {
                if (data.success) {
                    utils.notify('Uninstalling', data.message || 'Uninstall initiated, redirecting...', 'success');
                    setTimeout(function() {
                        window.location.href = data.redirect || '/index.php';
                    }, 2000);
                } else {
                    btn.prop('disabled', false).find('i').removeClass('fa-spinner fa-spin').addClass('fa-trash');
                    utils.notify('Error', data.message || 'Failed to uninstall', 'error');
                }
            },
            error: function() {
                utils.notify('Uninstalling', 'Uninstall in progress, redirecting...', 'success');
                setTimeout(function() {
                    window.location.href = '/index.php';
                }, 2000);
            }
        });
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    RB.settings = {
        loadSettings: loadSettings,
        loadLocalSettings: loadLocalSettings,
        bindVisibilityEvents: bindVisibilityEvents,
        bindLocalToggleEvents: bindLocalToggleEvents,
        checkApiStatus: checkApiStatus,
        refreshServiceStatus: refreshServiceStatus,
        flushCache: flushCache,
        restartServices: restartServices,
        viewLog: viewLog,
        clearLog: clearLog,
        rebootSystem: rebootSystem,
        repairInstallation: repairInstallation,
        uninstallExtension: uninstallExtension
    };

    console.log('Radio Browser: Settings module loaded');
})();
