#!/bin/bash
# ============================================================================
# Radio Browser Extension - Health Check Script
# ============================================================================
# SPDX-License-Identifier: GPL-3.0-or-later
# 2026 RubaTron
# Version: 4.0.0
#
# Called by systemd timer every 5 minutes
# Checks: symlink, PHP files, cache, nginx, php-fpm, API, MPD
# Results logged to journald: journalctl -u radio-browser-health
# ============================================================================

EXT_BASE="/var/www/extensions/installed/radio-browser"
SYMLINK="/var/www/radio-browser.php"
STATUS="running"
ERRORS=0

check() {
    local name="$1" result="$2" detail="$3"
    if [[ "$result" == "ok" ]]; then
        echo "[✓] $name: $detail"
    else
        echo "[✗] $name: $detail"
        ERRORS=$((ERRORS + 1))
    fi
}

# 1. Symlink
if [[ -L "$SYMLINK" ]] && [[ -e "$SYMLINK" ]]; then
    check "symlink" "ok" "$(readlink -f $SYMLINK)"
else
    check "symlink" "fail" "Missing or broken"
    STATUS="error"
fi

# 2. Required files
REQUIRED=("radio-browser.php" "backend/api.php" "assets/radio-browser.js" "assets/rb-menu-inject.js")
MISSING=()
for f in "${REQUIRED[@]}"; do
    [[ ! -f "$EXT_BASE/$f" ]] && MISSING+=("$f")
done
if [[ ${#MISSING[@]} -eq 0 ]]; then
    check "files" "ok" "All ${#REQUIRED[@]} required files present"
else
    check "files" "fail" "Missing: ${MISSING[*]}"
    STATUS="error"
fi

# 3. Cache writable
if [[ -d "$EXT_BASE/cache" ]] && [[ -w "$EXT_BASE/cache" ]]; then
    check "cache" "ok" "Writable"
else
    check "cache" "fail" "Not writable"
    [[ "$STATUS" != "error" ]] && STATUS="warning"
fi

# 4. nginx running
if systemctl is-active --quiet nginx 2>/dev/null; then
    check "nginx" "ok" "Running"
else
    check "nginx" "fail" "Not running"
    STATUS="error"
fi

# 5. PHP-FPM running
PHP_FPM=$(systemctl list-units --type=service --state=running 2>/dev/null | grep -o 'php[0-9.]*-fpm' | head -1)
if [[ -n "$PHP_FPM" ]]; then
    check "php-fpm" "ok" "$PHP_FPM running"
else
    check "php-fpm" "fail" "Not running"
    STATUS="error"
fi

# 6. Radio Browser API endpoint reachable
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost/extensions/installed/radio-browser/backend/api.php?cmd=test" 2>/dev/null)
if [[ "$HTTP_CODE" == "200" ]]; then
    check "local-api" "ok" "HTTP $HTTP_CODE"
else
    check "local-api" "fail" "HTTP $HTTP_CODE"
    STATUS="error"
fi

# 7. MPD connection
if timeout 2 bash -c 'echo "close" | nc -q1 localhost 6600' &>/dev/null; then
    check "mpd" "ok" "Connected on port 6600"
else
    check "mpd" "fail" "Not reachable on port 6600"
    [[ "$STATUS" != "error" ]] && STATUS="warning"
fi

# 8. radio-browser.info API
REMOTE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://all.api.radio-browser.info/json/stats" 2>/dev/null)
if [[ "$REMOTE_CODE" == "200" ]]; then
    check "remote-api" "ok" "radio-browser.info reachable"
else
    check "remote-api" "fail" "radio-browser.info unreachable (HTTP $REMOTE_CODE)"
    [[ "$STATUS" != "error" ]] && STATUS="warning"
fi

# Summary
echo "---"
echo "Status: $STATUS ($ERRORS error(s))"
echo "Version: $(cat $EXT_BASE/version.txt 2>/dev/null || echo 'unknown')"

# Exit code signals status to systemd
if [[ "$STATUS" == "error" ]]; then
    exit 1
elif [[ "$STATUS" == "warning" ]]; then
    exit 0  # Warnings don't fail the service
else
    exit 0
fi
