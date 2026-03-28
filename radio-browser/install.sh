#!/bin/bash
# ============================================================================
# RubaTron's Radio Browser Extension for moOde Audio Player
# ============================================================================
# SPDX-License-Identifier: GPL-3.0-or-later
# 2026 RubaTron
# Version: 3.0.0
# Date: January 2026
#
# Interactive installer with menu for moOde Radio Browser Extension
#
# This script provides a menu-driven installation process with options to:
# - Fully automatic installation
# - Individual installation steps
# - Uninstall
# - Help and troubleshooting
# ============================================================================

set -e  # Exit on any error (disabled for menu mode)

# ============================================================================
# CONFIGURATION
# ============================================================================
SCRIPT_VERSION="3.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/radio-browser-install-$(date +%Y%m%d-%H%M%S).log"

# Installation paths
EXT_BASE="/var/www/extensions/installed/radio-browser"
CACHE_DIR="${EXT_BASE}/cache"
DATA_DIR="${EXT_BASE}/data"
IMAGE_CACHE_DIR="${CACHE_DIR}/images"
SYS_DIR="${EXT_BASE}/sys"
SYS_SOURCES_DIR="${SYS_DIR}/sources"
SYS_MOODE_DIR="${SYS_DIR}/sources/moode"
WEB_ROOT="/var/www"

# Source files (relative to script directory)
declare -A SOURCE_FILES=(
    ["manifest.json"]="${SCRIPT_DIR}/manifest.json"
    ["radio-browser.php"]="${SCRIPT_DIR}/radio-browser.php"
    ["backend/api.php"]="${SCRIPT_DIR}/backend/api.php"
    ["assets/radio-browser.js"]="${SCRIPT_DIR}/assets/radio-browser.js"
    ["assets/radio-browser.css"]="${SCRIPT_DIR}/assets/radio-browser.css"
    ["assets/coverart-fix.js"]="${SCRIPT_DIR}/assets/coverart-fix.js"
    ["assets/rb-menu-inject.js"]="${SCRIPT_DIR}/assets/rb-menu-inject.js"
    ["rb-shell-bridge.php"]="${SCRIPT_DIR}/rb-shell-bridge.php"
    ["templates/radio-browser.html"]="${SCRIPT_DIR}/templates/radio-browser.html"
    ["scripts/fix-permissions.sh"]="${SCRIPT_DIR}/scripts/fix-permissions.sh"
    ["scripts/test-api.sh"]="${SCRIPT_DIR}/scripts/test-api.sh"
    ["scripts/flush-cache.sh"]="${SCRIPT_DIR}/scripts/flush-cache.sh"
    ["scripts/clear-recently-played.sh"]="${SCRIPT_DIR}/scripts/clear-recently-played.sh"
    ["info.json"]="${SCRIPT_DIR}/info.json"
    ["version.txt"]="${SCRIPT_DIR}/version.txt"
    ["README.md"]="${SCRIPT_DIR}/README.md"
)

# moOde integration paths
HEADER_FILE="/var/www/header.php"
NGINX_CONF="/etc/nginx/moode-locations.conf"

# ============================================================================
# COLORS AND FORMATTING
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================
log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

info() {
    local msg="[INFO] $1"
    echo -e "${CYAN}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

success() {
    local msg="[Γ£ô] $1"
    echo -e "${GREEN}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

warning() {
    local msg="[!] $1"
    echo -e "${YELLOW}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

error() {
    local msg="[Γ£ù] $1"
    echo -e "${RED}${msg}${NC}" >&2
    echo "$msg" >> "$LOG_FILE"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================
press_any_key() {
    echo
    read -n 1 -s -r -p "Press any key to continue..."
    echo
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local yn

    if [[ "$default" == "y" ]]; then
        read -p "$prompt [Y/n]: " -n 1 -r yn
    else
        read -p "$prompt [y/N]: " -n 1 -r yn
    fi
    echo

    if [[ -z "$yn" ]]; then
        yn="$default"
    fi

    [[ "$yn" =~ ^[Yy]$ ]]
}

is_root() {
    [[ $EUID -eq 0 ]]
}

# ============================================================================
# CHECK FUNCTIONS
# ============================================================================
check_root() {
    if ! is_root; then
        error "This script must be run as root (sudo)"
        echo "Usage: sudo $0"
        return 1
    fi
    success "Running as root"
    return 0
}

check_source_files() {
    log "Checking source files..."
    local missing=0

    for file in "${!SOURCE_FILES[@]}"; do
        local path="${SOURCE_FILES[$file]}"
        if [[ -f "$path" ]]; then
            echo -e "  ${GREEN}Γ£ô${NC} $file"
        else
            echo -e "  ${RED}Γ£ù${NC} $file (missing: $path)"
            ((missing++))
        fi
    done

    if [[ $missing -gt 0 ]]; then
        warning "$missing file(s) missing!"
        return 1
    fi

    success "All source files found"
    return 0
}

check_curl() {
    log "Checking cURL..."

    if command -v curl &> /dev/null; then
        local version=$(curl --version | head -1)
        success "cURL is installed: $version"
        return 0
    else
        warning "cURL is NOT installed"
        return 1
    fi
}

check_php_curl() {
    log "Checking PHP cURL extension..."

    # Find PHP version
    local php_version=$(php -v 2>/dev/null | head -1 | cut -d' ' -f2 | cut -d'.' -f1,2)

    if php -m 2>/dev/null | grep -qi "^curl$"; then
        success "PHP cURL extension is installed (PHP $php_version)"
        return 0
    else
        warning "PHP cURL extension is NOT installed"
        echo "The Radio Browser extension requires php${php_version}-curl"
        return 1
    fi
}

check_installation() {
    log "Checking current installation status..."
    local installed=0
    local total=0

    for file in "${!SOURCE_FILES[@]}"; do
        ((total++))
        local dest="${EXT_BASE}/${file}"
        if [[ -f "$dest" ]]; then
            ((installed++))
            echo -e "  ${GREEN}Γ£ô${NC} $dest"
        else
            echo -e "  ${YELLOW}Γùï${NC} $dest (not installed)"
        fi
    done

    echo
    if [[ $installed -eq $total ]]; then
        success "Extension is fully installed ($installed/$total files)"
        return 0
    elif [[ $installed -gt 0 ]]; then
        warning "Extension is partially installed ($installed/$total files)"
        return 1
    else
        info "Extension is not installed"
        return 2
    fi
}

# ============================================================================
# INSTALLATION FUNCTIONS
# ============================================================================
install_curl() {
    log "Installing cURL..."

    if command -v curl &> /dev/null; then
        success "cURL is already installed"
        return 0
    fi

    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y curl
    elif command -v yum &> /dev/null; then
        yum install -y curl
    elif command -v dnf &> /dev/null; then
        dnf install -y curl
    else
        error "Could not determine package manager"
        return 1
    fi

    if command -v curl &> /dev/null; then
        success "cURL installed successfully"
        return 0
    else
        error "Failed to install cURL"
        return 1
    fi
}

install_php_curl() {
    log "Installing PHP cURL extension..."

    # Find PHP version
    local php_version=$(php -v 2>/dev/null | head -1 | cut -d' ' -f2 | cut -d'.' -f1,2)

    if php -m 2>/dev/null | grep -qi "^curl$"; then
        success "PHP cURL extension is already installed"
        return 0
    fi

    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y "php${php_version}-curl"

        # Restart PHP-FPM if running
        if systemctl is-active --quiet "php${php_version}-fpm" 2>/dev/null; then
            log "Restarting PHP-FPM..."
            systemctl restart "php${php_version}-fpm"
        fi
    else
        error "Could not determine package manager"
        return 1
    fi

    if php -m 2>/dev/null | grep -qi "^curl$"; then
        success "PHP cURL extension installed successfully"
        return 0
    else
        error "Failed to install PHP cURL extension"
        return 1
    fi
}

create_folders() {
    log "Creating folder structure..."

    local folders=(
        "${EXT_BASE}"
        "${EXT_BASE}/backend"
        "${EXT_BASE}/assets"
        "${EXT_BASE}/templates"
        "${EXT_BASE}/scripts"
        "${CACHE_DIR}"
        "${IMAGE_CACHE_DIR}"
        "${DATA_DIR}"
        "${SYS_DIR}"
        "${SYS_SOURCES_DIR}"
        "${SYS_MOODE_DIR}"
    )

    for folder in "${folders[@]}"; do
        if [[ ! -d "$folder" ]]; then
            mkdir -p "$folder"
            echo -e "  ${GREEN}+${NC} Created: $folder"
        else
            echo -e "  ${BLUE}Γùï${NC} Exists: $folder"
        fi
    done

    success "Folder structure ready"
    return 0
}

copy_files() {
    log "Copying extension files..."

    local copied=0
    local failed=0

    for file in "${!SOURCE_FILES[@]}"; do
        local src="${SOURCE_FILES[$file]}"
        local dest="${EXT_BASE}/${file}"

        if [[ -f "$src" ]]; then
            # Create parent directory if needed
            mkdir -p "$(dirname "$dest")"

            if cp "$src" "$dest"; then
                echo -e "  ${GREEN}Γ£ô${NC} Copied: $file"
                ((copied++))
            else
                echo -e "  ${RED}Γ£ù${NC} Failed: $file"
                ((failed++))
            fi
        else
            echo -e "  ${YELLOW}!${NC} Source not found: $src"
            ((failed++))
        fi
    done

    # Create symlink for main PHP file
    log "Creating symlink..."
    ln -sf "${EXT_BASE}/radio-browser.php" "${WEB_ROOT}/radio-browser.php"
    if [[ -L "${WEB_ROOT}/radio-browser.php" ]]; then
        echo -e "  ${GREEN}Γ£ô${NC} Symlink: /var/www/radio-browser.php -> ${EXT_BASE}/radio-browser.php"
    fi

    if [[ $failed -eq 0 ]]; then
        success "All files copied successfully ($copied files)"
        return 0
    else
        error "Some files failed to copy ($failed failures)"
        return 1
    fi
}

set_permissions() {
    log "Setting file permissions..."

    # Set ownership
    chown -R www-data:www-data "${EXT_BASE}"
    chown -h www-data:www-data "${WEB_ROOT}/radio-browser.php" 2>/dev/null || true

    # Set directory permissions (755)
    find "${EXT_BASE}" -type d -exec chmod 755 {} \;

    # Set file permissions (644)
    find "${EXT_BASE}" -type f -exec chmod 644 {} \;

    # Make cache writable
    chmod 777 "${CACHE_DIR}"
    chmod 777 "${IMAGE_CACHE_DIR}"

    # Create symlink for imagesw (moOde stores images in /var/local/www/imagesw)
    if [[ ! -L "/var/www/imagesw" ]]; then
        ln -sf /var/local/www/imagesw /var/www/imagesw 2>/dev/null || true
        echo -e "  ${GREEN}Γ£ô${NC} Symlink: /var/www/imagesw -> /var/local/www/imagesw"
    fi

    # Make moOde radio-logos directory writable for thumbnail creation
    chmod 777 /var/local/www/imagesw/radio-logos 2>/dev/null || true
    chmod 777 /var/local/www/imagesw/radio-logos/thumbs 2>/dev/null || true

    success "Permissions set correctly"
    return 0
}

create_backup() {
    log "Creating backup of current installation..."

    if [[ ! -d "${EXT_BASE}" ]]; then
        info "No existing installation to backup"
        return 0
    fi

    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="/tmp/radio-browser-backup-${timestamp}.tar.gz"

    if tar -czf "$backup_file" -C "$(dirname ${EXT_BASE})" "$(basename ${EXT_BASE})" 2>/dev/null; then
        success "Backup created: $backup_file"
        return 0
    else
        warning "Could not create backup"
        return 1
    fi
}

restart_services() {
    log "Restarting services..."

    # Find PHP version
    local php_version=$(php -v 2>/dev/null | head -1 | cut -d' ' -f2 | cut -d'.' -f1,2)

    # Restart PHP-FPM
    if systemctl is-active --quiet "php${php_version}-fpm" 2>/dev/null; then
        systemctl restart "php${php_version}-fpm"
        echo -e "  ${GREEN}Γ£ô${NC} Restarted php${php_version}-fpm"
    fi

    # Restart nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl restart nginx
        echo -e "  ${GREEN}Γ£ô${NC} Restarted nginx"
    fi

    success "Services restarted"
    return 0
}

# ============================================================================
# BACKUP MOODE FILES (Before patching)
# ============================================================================
# Saves original moOde files to sys/sources/moode/ for restoration during uninstall

backup_moode_files() {
    log "Backing up original moOde files..."

    # Backup header.php if not already backed up
    if [[ -f "$HEADER_FILE" ]] && [[ ! -f "${SYS_MOODE_DIR}/header.php.orig" ]]; then
        cp "$HEADER_FILE" "${SYS_MOODE_DIR}/header.php.orig"
        echo -e "  ${GREEN}Γ£ô${NC} Backed up: header.php"
    elif [[ -f "${SYS_MOODE_DIR}/header.php.orig" ]]; then
        echo -e "  ${BLUE}Γùï${NC} Already backed up: header.php"
    fi

    # Backup nginx config if not already backed up
    if [[ -f "$NGINX_CONF" ]] && [[ ! -f "${SYS_MOODE_DIR}/moode-locations.conf.orig" ]]; then
        cp "$NGINX_CONF" "${SYS_MOODE_DIR}/moode-locations.conf.orig"
        echo -e "  ${GREEN}Γ£ô${NC} Backed up: moode-locations.conf"
    elif [[ -f "${SYS_MOODE_DIR}/moode-locations.conf.orig" ]]; then
        echo -e "  ${BLUE}Γùï${NC} Already backed up: moode-locations.conf"
    fi

    success "moOde files backed up to ${SYS_MOODE_DIR}/"
    return 0
}

# ============================================================================
# SHELL-BRIDGE INTEGRATION (Menu Injection)
# ============================================================================
# Injects a PHP include into moOde's header.php to load our menu injection script
# Uses markers to safely add/remove without breaking the header

patch_moode_header() {
    log "Patching moOde header for menu integration..."

    # Check if header.php exists
    if [[ ! -f "$HEADER_FILE" ]]; then
        warning "header.php not found at $HEADER_FILE"
        warning "Menu integration skipped - you can add Radio Browser manually"
        return 0
    fi

    # Check if already patched
    if grep -q "RB_SHELL_BRIDGE_START" "$HEADER_FILE" 2>/dev/null; then
        info "Shell bridge already installed in header.php"
        return 0
    fi

    # Create backup
    local backup_file="${HEADER_FILE}.rb-backup-$(date +%Y%m%d-%H%M%S)"
    cp "$HEADER_FILE" "$backup_file"
    echo -e "  ${GREEN}Γ£ô${NC} Backup created: $backup_file"

    # The include code to inject (before </head>)
    local bridge_include='<?php /* RB_SHELL_BRIDGE_START */ if (file_exists("/var/www/extensions/installed/radio-browser/rb-shell-bridge.php")) { include_once("/var/www/extensions/installed/radio-browser/rb-shell-bridge.php"); } /* RB_SHELL_BRIDGE_END */ ?>'

    # Use sed to insert before </head>
    # First, check if </head> exists
    if ! grep -q "</head>" "$HEADER_FILE"; then
        warning "Could not find </head> in header.php"
        warning "Menu integration skipped"
        return 1
    fi

    # Insert the bridge include before </head>
    sed -i "s|</head>|${bridge_include}\n</head>|" "$HEADER_FILE"

    # Verify the patch was applied
    if grep -q "RB_SHELL_BRIDGE_START" "$HEADER_FILE"; then
        success "Shell bridge installed in header.php"
        echo -e "  ${CYAN}ΓåÆ${NC} Radio Browser will appear in menus based on visibility settings"
        return 0
    else
        error "Failed to patch header.php"
        # Restore backup
        cp "$backup_file" "$HEADER_FILE"
        echo -e "  ${YELLOW}!${NC} Backup restored"
        return 1
    fi
}

cleanup_shell_bridge() {
    log "Removing shell bridge from header.php..."

    if [[ ! -f "$HEADER_FILE" ]]; then
        info "header.php not found, nothing to clean"
        return 0
    fi

    # Check if our bridge is installed
    if ! grep -q "RB_SHELL_BRIDGE_START" "$HEADER_FILE" 2>/dev/null; then
        info "Shell bridge not found in header.php"
        return 0
    fi

    # Create backup before removal
    local backup_file="${HEADER_FILE}.rb-cleanup-$(date +%Y%m%d-%H%M%S)"
    cp "$HEADER_FILE" "$backup_file"

    # Remove the bridge line (everything between markers on same line)
    sed -i '/RB_SHELL_BRIDGE_START.*RB_SHELL_BRIDGE_END/d' "$HEADER_FILE"

    # Verify removal
    if ! grep -q "RB_SHELL_BRIDGE_START" "$HEADER_FILE"; then
        success "Shell bridge removed from header.php"
        return 0
    else
        warning "Could not fully remove shell bridge"
        return 1
    fi
}

# ============================================================================
# NGINX LOGO FALLBACK (Handles missing radio logos gracefully)
# ============================================================================
# Patches nginx to serve a fallback image when radio logos are not found
# This prevents 404 errors and shows moOde's default radio icon

patch_nginx_logos() {
    log "Patching nginx for logo fallback..."

    # Check if nginx config exists
    if [[ ! -f "$NGINX_CONF" ]]; then
        warning "nginx config not found at $NGINX_CONF"
        warning "Logo fallback skipped - you may see 404s for missing logos"
        return 0
    fi

    # Check if already patched
    if grep -q "RB_NGINX_LOGO_FALLBACK_START" "$NGINX_CONF" 2>/dev/null; then
        info "Logo fallback already installed in nginx config"
        return 0
    fi

    # Create backup
    local backup_file="${NGINX_CONF}.rb-backup-$(date +%Y%m%d-%H%M%S)"
    cp "$NGINX_CONF" "$backup_file"
    echo -e "  ${GREEN}Γ£ô${NC} Backup created: $backup_file"

    # The nginx location block to add
    local logo_block="
# RB_NGINX_LOGO_FALLBACK_START
# Radio logos with fallback to moOde default radio icon
# Added by Radio Browser extension
location /imagesw/radio-logos/ {
    alias /var/local/www/imagesw/radio-logos/;
    try_files \$uri /images/radio.png;
}
# RB_NGINX_LOGO_FALLBACK_END"

    # Append to the nginx config
    echo "$logo_block" >> "$NGINX_CONF"

    # Verify the patch was applied
    if grep -q "RB_NGINX_LOGO_FALLBACK_START" "$NGINX_CONF"; then
        success "Logo fallback installed in nginx"
        echo -e "  ${CYAN}ΓåÆ${NC} Missing radio logos will show default icon instead of 404"
        return 0
    else
        error "Failed to patch nginx config"
        # Restore backup
        cp "$backup_file" "$NGINX_CONF"
        echo -e "  ${YELLOW}!${NC} Backup restored"
        return 1
    fi
}

cleanup_nginx_logos() {
    log "Removing logo fallback from nginx..."

    if [[ ! -f "$NGINX_CONF" ]]; then
        info "nginx config not found, nothing to clean"
        return 0
    fi

    # Check if our patch is installed
    if ! grep -q "RB_NGINX_LOGO_FALLBACK_START" "$NGINX_CONF" 2>/dev/null; then
        info "Logo fallback not found in nginx config"
        return 0
    fi

    # Create backup before removal
    local backup_file="${NGINX_CONF}.rb-cleanup-$(date +%Y%m%d-%H%M%S)"
    cp "$NGINX_CONF" "$backup_file"

    # Remove the logo fallback block (from START to END marker, inclusive)
    sed -i '/RB_NGINX_LOGO_FALLBACK_START/,/RB_NGINX_LOGO_FALLBACK_END/d' "$NGINX_CONF"

    # Verify removal
    if ! grep -q "RB_NGINX_LOGO_FALLBACK_START" "$NGINX_CONF"; then
        success "Logo fallback removed from nginx"
        return 0
    else
        warning "Could not fully remove logo fallback"
        return 1
    fi
}

# ============================================================================
# RESTORE MOODE FILES (From backup)
# ============================================================================
# Restores original moOde files from sys/sources/moode/ during uninstall

restore_moode_files() {
    log "Restoring original moOde files..."

    local restored=0

    # Restore header.php if backup exists
    if [[ -f "${SYS_MOODE_DIR}/header.php.orig" ]]; then
        cp "${SYS_MOODE_DIR}/header.php.orig" "$HEADER_FILE"
        chown www-data:www-data "$HEADER_FILE"
        echo -e "  ${GREEN}Γ£ô${NC} Restored: header.php"
        ((restored++))
    else
        # Fallback to marker-based cleanup
        cleanup_shell_bridge
    fi

    # Restore nginx config if backup exists
    if [[ -f "${SYS_MOODE_DIR}/moode-locations.conf.orig" ]]; then
        cp "${SYS_MOODE_DIR}/moode-locations.conf.orig" "$NGINX_CONF"
        echo -e "  ${GREEN}Γ£ô${NC} Restored: moode-locations.conf"
        ((restored++))
    else
        # Fallback to marker-based cleanup
        cleanup_nginx_logos
    fi

    if [[ $restored -gt 0 ]]; then
        success "Restored $restored moOde file(s) from backup"
    fi

    return 0
}

# ============================================================================
# UNINSTALL FUNCTION
# ============================================================================
uninstall() {
    echo
    echo -e "${RED}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
    echo -e "${RED}Γòæ                    UNINSTALL RADIO BROWSER                   Γòæ${NC}"
    echo -e "${RED}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"
    echo

    warning "This will remove all Radio Browser extension files!"
    echo "The following will be removed:"
    echo "  ΓÇó ${EXT_BASE}/"
    echo "  ΓÇó ${WEB_ROOT}/radio-browser.php"
    echo "  ΓÇó Menu integration from header.php"
    echo

    if ! confirm "Are you sure you want to uninstall?" "n"; then
        info "Uninstall cancelled"
        return 0
    fi

    # Create backup first
    if confirm "Create backup before uninstalling?" "y"; then
        create_backup
    fi

    # Restore original moOde files from backup
    restore_moode_files

    # Restart services to apply changes
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl restart nginx
        echo -e "  ${GREEN}Γ£ô${NC} Restarted nginx"
    fi

    local php_version=$(php -v 2>/dev/null | head -1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if systemctl is-active --quiet "php${php_version}-fpm" 2>/dev/null; then
        systemctl restart "php${php_version}-fpm"
        echo -e "  ${GREEN}Γ£ô${NC} Restarted php${php_version}-fpm"
    fi

    log "Removing files..."

    # Remove symlink
    if [[ -L "${WEB_ROOT}/radio-browser.php" ]]; then
        rm "${WEB_ROOT}/radio-browser.php"
        echo -e "  ${GREEN}Γ£ô${NC} Removed symlink"
    fi

    # Remove extension directory
    if [[ -d "${EXT_BASE}" ]]; then
        rm -rf "${EXT_BASE}"
        echo -e "  ${GREEN}Γ£ô${NC} Removed extension directory"
    fi

    success "Radio Browser extension uninstalled"
    echo -e "  ${CYAN}ΓåÆ${NC} moOde has been restored to its original state"
    return 0
}

# ============================================================================
# AUTO INSTALL
# ============================================================================
auto_install() {
    echo
    echo -e "${GREEN}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
    echo -e "${GREEN}Γòæ               AUTOMATIC INSTALLATION                         Γòæ${NC}"
    echo -e "${GREEN}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"
    echo

    local errors=0

    # Step 1: Check root
    echo -e "${BOLD}Step 1/10: Checking permissions...${NC}"
    check_root || { error "Must run as root"; return 1; }
    echo

    # Step 2: Check source files
    echo -e "${BOLD}Step 2/10: Checking source files...${NC}"
    check_source_files || { error "Source files missing"; return 1; }
    echo

    # Step 3: Install dependencies
    echo -e "${BOLD}Step 3/10: Installing dependencies...${NC}"
    install_curl || warning "cURL installation issue"
    install_php_curl || warning "PHP cURL installation issue"
    echo

    # Step 4: Create backup
    echo -e "${BOLD}Step 4/10: Creating backup...${NC}"
    create_backup || warning "Backup creation issue"
    echo

    # Step 5: Create folders
    echo -e "${BOLD}Step 5/10: Creating folders...${NC}"
    create_folders || { error "Failed to create folders"; ((errors++)); }
    echo

    # Step 6: Copy files
    echo -e "${BOLD}Step 6/10: Copying files...${NC}"
    copy_files || { error "Failed to copy files"; ((errors++)); }
    echo

    # Step 7: Set permissions
    echo -e "${BOLD}Step 7/10: Setting permissions...${NC}"
    set_permissions || { error "Failed to set permissions"; ((errors++)); }
    echo

    # Step 8: Backup original moOde files
    echo -e "${BOLD}Step 8/10: Backing up moOde system files...${NC}"
    backup_moode_files || warning "moOde backup issue"
    echo

    # Step 9: Install menu integration
    echo -e "${BOLD}Step 9/10: Installing menu integration...${NC}"
    patch_moode_header || warning "Menu integration issue"
    echo

    # Step 10: Patch nginx for logo fallback
    echo -e "${BOLD}Step 10/10: Patching nginx for logo fallback...${NC}"
    patch_nginx_logos || warning "Nginx logo fallback issue"
    # Restart nginx to apply the config change
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl restart nginx
        echo -e "  ${GREEN}Γ£ô${NC} Restarted nginx"
    fi
    echo

    # Summary
    if [[ $errors -eq 0 ]]; then
        echo
        echo -e "${GREEN}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
        echo -e "${GREEN}Γòæ         Γ£ô INSTALLATION COMPLETED SUCCESSFULLY               Γòæ${NC}"
        echo -e "${GREEN}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"
        echo
        echo "Access Radio Browser at:"
        echo "  http://$(hostname)/radio-browser.php"
        echo
        echo "Or via moOde menu: Menu ΓåÆ Extensions ΓåÆ Radio Browser"
        echo
        echo "Log file: $LOG_FILE"
    else
        echo
        echo -e "${RED}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
        echo -e "${RED}Γòæ         Γ£ù INSTALLATION COMPLETED WITH ERRORS                Γòæ${NC}"
        echo -e "${RED}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"
        echo
        echo "$errors error(s) occurred. Check log file: $LOG_FILE"
    fi

    return $errors
}

# ============================================================================
# HELP FUNCTION
# ============================================================================
show_help() {
    echo
    echo -e "${CYAN}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
    echo -e "${CYAN}Γòæ                    HELP & TROUBLESHOOTING                    Γòæ${NC}"
    echo -e "${CYAN}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"
    echo
    echo -e "${BOLD}About Radio Browser Extension:${NC}"
    echo "  The Radio Browser extension for moOde allows you to search and"
    echo "  play radio stations from the Radio-Browser.info database,"
    echo "  containing over 30,000 stations worldwide."
    echo
    echo -e "${BOLD}Requirements:${NC}"
    echo "  ΓÇó moOde Audio Player (8.x or higher)"
    echo "  ΓÇó PHP 8.x with cURL extension"
    echo "  ΓÇó Root access for installation"
    echo
    echo -e "${BOLD}Installation:${NC}"
    echo "  1. Copy the extension files to your moOde device"
    echo "  2. Run: sudo ./install.sh"
    echo "  3. Select option 1 for automatic installation"
    echo
    echo -e "${BOLD}File Locations:${NC}"
    echo "  Extension:  ${EXT_BASE}/"
    echo "  Cache:      ${CACHE_DIR}/"
    echo "  Symlink:    ${WEB_ROOT}/radio-browser.php"
    echo
    echo -e "${BOLD}Troubleshooting:${NC}"
    echo
    echo "  ${YELLOW}Problem:${NC} API returns 500 error"
    echo "  ${GREEN}Solution:${NC} Install PHP cURL: sudo apt install php8.4-curl"
    echo
    echo "  ${YELLOW}Problem:${NC} Logos not showing"
    echo "  ${GREEN}Solution:${NC} Check cache permissions: ls -la ${CACHE_DIR}/"
    echo "            Should be owned by www-data"
    echo
    echo "  ${YELLOW}Problem:${NC} Page shows blank"
    echo "  ${GREEN}Solution:${NC} Check PHP logs: sudo tail -f /var/log/php*.log"
    echo
    echo "  ${YELLOW}Problem:${NC} Can't connect to Radio Browser API"
    echo "  ${GREEN}Solution:${NC} Check internet: curl -I https://api.radio-browser.info"
    echo
    echo -e "${BOLD}Log Files:${NC}"
    echo "  Installation: $LOG_FILE"
    echo "  Extension:    ${CACHE_DIR}/radio-browser.log"
    echo "  PHP:          /var/log/php*.log"
    echo "  Nginx:        /var/log/nginx/error.log"
    echo
}

# ============================================================================
# MENU
# ============================================================================
show_status() {
    echo
    echo -e "${BOLD}Current Status:${NC}"

    # Check installation
    if [[ -d "${EXT_BASE}" ]] && [[ -f "${EXT_BASE}/radio-browser.php" ]]; then
        echo -e "  Extension: ${GREEN}Installed${NC}"
    else
        echo -e "  Extension: ${YELLOW}Not installed${NC}"
    fi

    # Check cURL
    if command -v curl &> /dev/null; then
        echo -e "  cURL:      ${GREEN}Installed${NC}"
    else
        echo -e "  cURL:      ${RED}Not installed${NC}"
    fi

    # Check PHP cURL
    if php -m 2>/dev/null | grep -qi "^curl$"; then
        echo -e "  PHP cURL:  ${GREEN}Installed${NC}"
    else
        echo -e "  PHP cURL:  ${RED}Not installed${NC}"
    fi
}

show_menu() {
    clear
    echo -e "${MAGENTA}ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù${NC}"
    echo -e "${MAGENTA}Γòæ       ≡ƒÄ╡ RADIO BROWSER EXTENSION INSTALLER v${SCRIPT_VERSION}            Γòæ${NC}"
    echo -e "${MAGENTA}ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥${NC}"

    show_status

    echo
    echo -e "${BOLD}Installation Options:${NC}"
    echo "  1. Auto-install (recommended)"
    echo "  2. Check source files"
    echo "  3. Install cURL"
    echo "  4. Install PHP cURL extension"
    echo "  5. Create folders"
    echo "  6. Copy files"
    echo "  7. Set permissions"
    echo
    echo -e "${BOLD}Maintenance:${NC}"
    echo "  8. Restart services (PHP-FPM, nginx)"
    echo "  9. Uninstall extension"
    echo
    echo -e "${BOLD}Other:${NC}"
    echo "  h. Help & troubleshooting"
    echo "  s. Show full installation status"
    echo "  q. Quit"
    echo
}

main_menu() {
    while true; do
        show_menu
        read -p "Select option: " -n 1 choice
        echo

        case $choice in
            1)
                auto_install
                press_any_key
                ;;
            2)
                check_source_files
                press_any_key
                ;;
            3)
                if ! is_root; then
                    error "Must run as root"
                else
                    install_curl
                fi
                press_any_key
                ;;
            4)
                if ! is_root; then
                    error "Must run as root"
                else
                    install_php_curl
                fi
                press_any_key
                ;;
            5)
                if ! is_root; then
                    error "Must run as root"
                else
                    create_folders
                fi
                press_any_key
                ;;
            6)
                if ! is_root; then
                    error "Must run as root"
                else
                    copy_files
                fi
                press_any_key
                ;;
            7)
                if ! is_root; then
                    error "Must run as root"
                else
                    set_permissions
                fi
                press_any_key
                ;;
            8)
                if ! is_root; then
                    error "Must run as root"
                else
                    restart_services
                fi
                press_any_key
                ;;
            9)
                if ! is_root; then
                    error "Must run as root"
                else
                    uninstall
                fi
                press_any_key
                ;;
            h|H)
                show_help
                press_any_key
                ;;
            s|S)
                check_installation
                press_any_key
                ;;
            q|Q)
                echo
                echo "Goodbye!"
                exit 0
                ;;
            *)
                warning "Invalid option: $choice"
                sleep 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
main() {
    # Create log file
    touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/dev/null"

    # Check for command line arguments
    case "${1:-}" in
        --auto|-a)
            check_root || exit 1
            auto_install
            exit $?
            ;;
        --uninstall|-u)
            check_root || exit 1
            uninstall
            exit $?
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        --status|-s)
            check_installation
            exit $?
            ;;
        "")
            main_menu
            ;;
        *)
            echo "Usage: $0 [--auto|-a] [--uninstall|-u] [--help|-h] [--status|-s]"
            echo
            echo "Options:"
            echo "  --auto, -a       Run automatic installation"
            echo "  --uninstall, -u  Uninstall the extension"
            echo "  --help, -h       Show help"
            echo "  --status, -s     Show installation status"
            echo "  (no option)      Start interactive menu"
            exit 1
            ;;
    esac
}

# Run main
main "$@"
