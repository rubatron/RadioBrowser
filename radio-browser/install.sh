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
SCRIPT_VERSION="5.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELECTED_BRANCH="main"  # default branch
SRC_BASE="${SCRIPT_DIR}"
LOG_FILE="/tmp/radio-browser-install-$(date +%Y%m%d-%H%M%S).log"
GITHUB_REPO="rubatron/RadioBrowser"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}/commits/main"

# Installation paths (can be overridden in developer mode)
EXT_BASE="/var/www/extensions/installed/radio-browser"
CACHE_DIR="${EXT_BASE}/cache"
DATA_DIR="${EXT_BASE}/data"
IMAGE_CACHE_DIR="${CACHE_DIR}/images"
WEB_ROOT="/var/www"

# Source files (relative to SRC_BASE)
set_source_files() {
    local base="${1:-${SRC_BASE}}"
    SRC_BASE="$base"
    declare -g -A SOURCE_FILES=(
        ["manifest.json"]="${SRC_BASE}/manifest.json"
        ["radio-browser.php"]="${SRC_BASE}/radio-browser.php"
        ["backend/api.php"]="${SRC_BASE}/backend/api.php"
        ["assets/radio-browser.js"]="${SRC_BASE}/assets/radio-browser.js"
        ["assets/radio-browser.css"]="${SRC_BASE}/assets/radio-browser.css"
        ["assets/coverart-fix.js"]="${SRC_BASE}/assets/coverart-fix.js"
        ["templates/radio-browser.html"]="${SRC_BASE}/templates/radio-browser.html"
        ["scripts/fix-permissions.sh"]="${SRC_BASE}/scripts/fix-permissions.sh"
        ["scripts/test-api.sh"]="${SRC_BASE}/scripts/test-api.sh"
        ["scripts/flush-cache.sh"]="${SRC_BASE}/scripts/flush-cache.sh"
        ["scripts/clear-recently-played.sh"]="${SRC_BASE}/scripts/clear-recently-played.sh"
        ["info.json"]="${SRC_BASE}/info.json"
        ["version.txt"]="${SRC_BASE}/version.txt"
        ["README.md"]="${SRC_BASE}/README.md"
    )
}

set_source_files "${SRC_BASE}"

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
    local msg="[✓] $1"
    echo -e "${GREEN}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

warning() {
    local msg="[!] $1"
    echo -e "${YELLOW}${msg}${NC}"
    echo "$msg" >> "$LOG_FILE"
}

error() {
    local msg="[✗] $1"
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
            echo -e "  ${GREEN}✓${NC} $file"
        else
            echo -e "  ${RED}✗${NC} $file (missing: $path)"
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

    echo -e "  Branch: ${GREEN}${SELECTED_BRANCH}${NC} (sources from ${SRC_BASE})"
    
    for file in "${!SOURCE_FILES[@]}"; do
        ((total++))
        local dest="${EXT_BASE}/${file}"
        if [[ -f "$dest" ]]; then
            ((installed++))
            echo -e "  ${GREEN}✓${NC} $dest"
        else
            echo -e "  ${YELLOW}○${NC} $dest (not installed)"
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
    )
    
    for folder in "${folders[@]}"; do
        if [[ ! -d "$folder" ]]; then
            mkdir -p "$folder"
            echo -e "  ${GREEN}+${NC} Created: $folder"
        else
            echo -e "  ${BLUE}○${NC} Exists: $folder"
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
                echo -e "  ${GREEN}✓${NC} Copied: $file"
                ((copied++))
            else
                echo -e "  ${RED}✗${NC} Failed: $file"
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
        echo -e "  ${GREEN}✓${NC} Symlink: /var/www/radio-browser.php -> ${EXT_BASE}/radio-browser.php"
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
        echo -e "  ${GREEN}✓${NC} Restarted php${php_version}-fpm"
    fi
    
    # Restart nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl restart nginx
        echo -e "  ${GREEN}✓${NC} Restarted nginx"
    fi
    
    success "Services restarted"
    return 0
}

# ============================================================================
# UNINSTALL FUNCTION
# ============================================================================
uninstall() {
    echo
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    UNINSTALL RADIO BROWSER                   ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    warning "This will remove all Radio Browser extension files!"
    echo "The following will be deleted:"
    echo "  • ${EXT_BASE}/"
    echo "  • ${WEB_ROOT}/radio-browser.php"
    echo
    
    if ! confirm "Are you sure you want to uninstall?" "n"; then
        info "Uninstall cancelled"
        return 0
    fi
    
    # Create backup first
    if confirm "Create backup before uninstalling?" "y"; then
        create_backup
    fi
    
    log "Removing files..."
    
    # Remove symlink
    if [[ -L "${WEB_ROOT}/radio-browser.php" ]]; then
        rm "${WEB_ROOT}/radio-browser.php"
        echo -e "  ${GREEN}✓${NC} Removed symlink"
    fi
    
    # Remove extension directory
    if [[ -d "${EXT_BASE}" ]]; then
        rm -rf "${EXT_BASE}"
        echo -e "  ${GREEN}✓${NC} Removed extension directory"
    fi
    
    success "Radio Browser extension uninstalled"
    return 0
}

# ============================================================================
# AUTO INSTALL
# ============================================================================
auto_install() {
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║               AUTOMATIC INSTALLATION                         ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    local errors=0
    
    # Step 0: Check for existing files (with confirmation)
    echo -e "${BOLD}Step 0/7: Checking for existing installation...${NC}"
    if ! check_for_existing_files; then
        info "Installation cancelled by user"
        return 1
    fi
    echo
    
    # Step 1: Check root
    echo -e "${BOLD}Step 1/7: Checking permissions...${NC}"
    check_root || { error "Must run as root"; return 1; }
    echo
    
    # Step 2: Check source files
    echo -e "${BOLD}Step 2/7: Checking source files...${NC}"
    check_source_files || { error "Source files missing"; return 1; }
    echo
    
    # Step 3: Install dependencies
    echo -e "${BOLD}Step 3/7: Installing dependencies...${NC}"
    install_curl || warning "cURL installation issue"
    install_php_curl || warning "PHP cURL installation issue"
    echo
    
    # Step 4: Create backup
    echo -e "${BOLD}Step 4/7: Creating backup...${NC}"
    create_backup || warning "Backup creation issue"
    echo
    
    # Step 5: Create folders
    echo -e "${BOLD}Step 5/7: Creating folders...${NC}"
    create_folders || { error "Failed to create folders"; ((errors++)); }
    echo
    
    # Step 6: Copy files
    echo -e "${BOLD}Step 6/7: Copying files...${NC}"
    copy_files || { error "Failed to copy files"; ((errors++)); }
    echo
    
    # Step 7: Set permissions
    echo -e "${BOLD}Step 7/7: Setting permissions...${NC}"
    set_permissions || { error "Failed to set permissions"; ((errors++)); }
    echo
    
    # Summary
    if [[ $errors -eq 0 ]]; then
        echo
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║         ✓ INSTALLATION COMPLETED SUCCESSFULLY               ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo "Access Radio Browser at:"
        echo "  http://moode.local/radio-browser.php"
        echo
        echo "Or via moOde menu: Menu → Extensions → Radio Browser"
        echo
        echo "Log file: $LOG_FILE"
    else
        echo
        echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║         ✗ INSTALLATION COMPLETED WITH ERRORS                ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
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
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    HELP & TROUBLESHOOTING                    ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}About Radio Browser Extension:${NC}"
    echo "  The Radio Browser extension for moOde allows you to search and"
    echo "  play radio stations from the Radio-Browser.info database,"
    echo "  containing over 30,000 stations worldwide."
    echo
    echo -e "${BOLD}Requirements:${NC}"
    echo "  • moOde Audio Player (8.x or higher)"
    echo "  • PHP 8.x with cURL extension"
    echo "  • Root access for installation"
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
# NEW FEATURES FOR V5.0
# ============================================================================

# Check for existing installation and warn
check_for_existing_files() {
    log "Checking for existing installation..."
    
    if [[ -d "${EXT_BASE}" ]] && [[ -f "${EXT_BASE}/radio-browser.php" ]]; then
        warning "Existing Radio Browser installation detected!"
        echo
        echo "Found installation at: ${EXT_BASE}"
        echo
        echo "Continuing will OVERWRITE existing files."
        echo "Your cache and custom APIs in the data folder will be preserved."
        echo
        
        if ! confirm "Do you want to continue with installation?" "n"; then
            info "Installation cancelled by user"
            return 1
        fi
        echo
        success "User confirmed - proceeding with installation"
    else
        info "No existing installation found"
    fi
    
    return 0
}

# Select branch (main/nightly/develop)
select_branch() {
    echo
    echo -e "${BOLD}Select source branch:${NC}"
    echo "  1) main    (stable)"
    echo "  2) nightly (latest)"
    echo "  3) develop (experimental)"
    echo
    read -p "Choose branch [1-3, default main]: " -n 1 branch_choice
    echo

    case ${branch_choice:-1} in
        1) SELECTED_BRANCH="main" ;;
        2) SELECTED_BRANCH="nightly" ;;
        3) SELECTED_BRANCH="develop" ;;
        *) SELECTED_BRANCH="main" ;;
    esac

    success "Branch set to: ${SELECTED_BRANCH}"
    return 0
}

# Download sources for selected branch from GitHub
download_branch_sources() {
    select_branch

    local zip_url="https://github.com/${GITHUB_REPO}/archive/refs/heads/${SELECTED_BRANCH}.zip"
    local tmp_dir=$(mktemp -d /tmp/rb-src-XXXX)
    local zip_file="${tmp_dir}/src.zip"

    log "Downloading ${SELECTED_BRANCH} branch..."

    if ! command -v curl &> /dev/null; then
        error "cURL not installed - cannot download sources"
        return 1
    fi

    if ! command -v unzip &> /dev/null; then
        error "unzip not installed - cannot extract sources"
        return 1
    fi

    if ! curl -L -f -o "${zip_file}" "${zip_url}"; then
        error "Failed to download ${zip_url}"
        return 1
    fi

    if ! unzip -q "${zip_file}" -d "${tmp_dir}"; then
        error "Failed to extract archive"
        return 1
    fi

    local extracted=$(find "${tmp_dir}" -maxdepth 1 -type d -name "RadioBrowser-*" | head -1)
    if [[ -z "${extracted}" ]]; then
        error "Could not locate extracted folder"
        return 1
    fi

    # Assume extension files are at repo root
    set_source_files "${extracted}"

    success "Sources loaded from ${extracted} (branch: ${SELECTED_BRANCH})"
    return 0
}

# Reboot system
reboot_system() {
    echo
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║              ⚠️  SYSTEM REBOOT                               ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}${RED}RECOMMENDED AFTER INSTALL RADIO-BROWSER!${NC}"
    echo
    echo "A reboot ensures all services are properly loaded with the new"
    echo "extension. This is especially important for:"
    echo "  • PHP-FPM service"
    echo "  • nginx configuration"
    echo "  • moOde worker process"
    echo
    
    if confirm "Do you want to reboot the system now?" "n"; then
        log "User initiated system reboot"
        echo
        echo "Rebooting in 3 seconds..."
        sleep 1
        echo "Rebooting in 2 seconds..."
        sleep 1
        echo "Rebooting in 1 second..."
        sleep 1
        
        sudo /sbin/reboot
    else
        info "Reboot cancelled"
        echo "Remember to reboot later for optimal performance!"
    fi
}

# Check for updates from GitHub
check_for_updates() {
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    UPDATE CHECK                              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    log "Checking for updates from GitHub..."
    
    # Get local version
    local local_version="unknown"
    if [[ -f "${EXT_BASE}/version.txt" ]]; then
        local_version=$(cat "${EXT_BASE}/version.txt")
        info "Local version: $local_version"
    else
        warning "Local version file not found"
    fi
    
    # Check GitHub for latest commit
    info "Checking GitHub repository: ${GITHUB_REPO}"
    
    if ! command -v curl &> /dev/null; then
        error "cURL not installed - cannot check for updates"
        return 1
    fi
    
    local github_response=$(curl -s -f "${GITHUB_API}" 2>/dev/null)
    
    if [[ $? -ne 0 ]] || [[ -z "$github_response" ]]; then
        error "Failed to connect to GitHub API"
        echo "Please check your internet connection"
        return 1
    fi
    
    # Extract commit hash (first 7 chars)
    local github_hash=$(echo "$github_response" | grep -o '"sha"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4 | cut -c1-7)
    
    if [[ -z "$github_hash" ]]; then
        error "Could not parse GitHub response"
        return 1
    fi
    
    success "Latest commit on main branch: $github_hash"
    echo
    echo "To update:"
    echo "  1. Download latest version:"
    echo "     wget https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip"
    echo "  2. Extract and run installer again"
    echo
    
    return 0
}

# Developer menu
developer_menu() {
    while true; do
        clear
        echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                    DEVELOPER MODE                            ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo -e "${BOLD}${YELLOW}⚠️  With great power, comes great responsibility.${NC}"
        echo -e "${BOLD}${YELLOW}    Use at own risk.${NC}"
        echo
        echo -e "${BOLD}Developer Options:${NC}"
        echo "  1. Set custom install path"
        echo "  2. Create moOde menu items"
        echo
        echo "  b. Back to main menu"
        echo "  q. Quit"
        echo
        read -p "Select option: " -n 1 dev_choice
        echo
        
        case $dev_choice in
            1)
                set_custom_install_path
                press_any_key
                ;;
            2)
                integrate_moode_menu
                press_any_key
                ;;
            b|B)
                return 0
                ;;
            q|Q)
                exit 0
                ;;
            *)
                warning "Invalid option: $dev_choice"
                sleep 1
                ;;
        esac
    done
}

# Set custom installation path
set_custom_install_path() {
    echo
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║              CUSTOM INSTALLATION PATH                        ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo "Current install path: ${EXT_BASE}"
    echo
    echo "Enter new installation path (or press Enter to cancel):"
    read -e -p "Path: " new_path
    
    if [[ -z "$new_path" ]]; then
        info "Cancelled"
        return 0
    fi
    
    # Validate path
    if [[ ! "$new_path" =~ ^/ ]]; then
        error "Path must be absolute (start with /)"
        return 1
    fi
    
    warning "Changing installation path to: $new_path"
    echo
    echo "This will:"
    echo "  • Update EXT_BASE variable"
    echo "  • Create the directory structure"
    echo "  • Set proper permissions (www-data:www-data)"
    echo
    
    if ! confirm "Continue with this path?" "n"; then
        info "Cancelled"
        return 0
    fi
    
    # Update paths
    EXT_BASE="$new_path"
    CACHE_DIR="${EXT_BASE}/cache"
    DATA_DIR="${EXT_BASE}/data"
    IMAGE_CACHE_DIR="${CACHE_DIR}/images"
    
    log "Updated paths:"
    log "  EXT_BASE: ${EXT_BASE}"
    log "  CACHE_DIR: ${CACHE_DIR}"
    log "  DATA_DIR: ${DATA_DIR}"
    
    # Create directories
    if ! is_root; then
        error "Must run as root to create directories"
        return 1
    fi
    
    mkdir -p "${EXT_BASE}"/{backend,assets,templates,scripts,cache/images,data}
    
    # Set permissions
    chown -R www-data:www-data "${EXT_BASE}"
    chmod -R 755 "${EXT_BASE}"
    chmod -R 775 "${CACHE_DIR}"
    chmod -R 775 "${DATA_DIR}"
    
    success "Custom path configured: ${EXT_BASE}"
    echo
    echo "You can now proceed with installation using option 1 or 6"
}

# Integrate into moOde menu
integrate_moode_menu() {
    echo
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║              MOODE MENU INTEGRATION                          ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    local script_path="${SCRIPT_DIR}/scripts/moodemenu-integration.sh"
    
    if [[ ! -f "$script_path" ]]; then
        error "Integration script not found: $script_path"
        return 1
    fi
    
    warning "This will modify moOde system files!"
    echo
    echo "The script will:"
    echo "  • Backup header.php"
    echo "  • Add Radio Browser to navigation menu"
    echo "  • Can be reverted with uninstall option"
    echo
    
    if ! confirm "Do you want to integrate into moOde menu?" "n"; then
        info "Cancelled"
        return 0
    fi
    
    if ! is_root; then
        error "Must run as root"
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_path"
    
    # Run integration script
    log "Running moOde menu integration script..."
    bash "$script_path" install
    
    if [[ $? -eq 0 ]]; then
        success "moOde menu integration completed"
    else
        error "Integration failed - check log"
        return 1
    fi
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
    echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║       🎵 RADIO BROWSER EXTENSION INSTALLER v${SCRIPT_VERSION}            ║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
    
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
    echo -e "  ${RED}r. REBOOT SYSTEM ${BOLD}(RECOMMENDED AFTER INSTALL!)${NC}"
    echo
    echo -e "${BOLD}Tools:${NC}"
    echo "  u. Check for updates"
    echo "  b. Select branch & download sources"
    echo -e "  ${YELLOW}d. Developer mode${NC}"
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
            r|R)
                if ! is_root; then
                    error "Must run as root"
                else
                    reboot_system
                fi
                # No press_any_key - system will reboot
                ;;
            u|U)
                check_for_updates
                press_any_key
                ;;
            b|B)
                download_branch_sources
                press_any_key
                ;;
            d|D)
                if ! is_root; then
                    error "Must run as root for developer mode"
                    press_any_key
                else
                    developer_menu
                fi
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
