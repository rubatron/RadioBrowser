#!/bin/bash
# ============================================================================
# Radio Browser Extension - Interactive Installation Script
# ============================================================================
# Version: 2.0
# Date: January 9, 2026
# Description: Interactive installer with menu for moOde Radio Browser Extension
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
WEB_ROOT="/var/www"

# Source files (relative to script directory)
declare -A SOURCE_FILES=(
    ["manifest.json"]="${SCRIPT_DIR}/manifest.json"
    ["radio-browser.php"]="${SCRIPT_DIR}/radio-browser.php"
    ["backend/api.php"]="${SCRIPT_DIR}/backend/api.php"
    ["assets/radio-browser.js"]="${SCRIPT_DIR}/assets/radio-browser.js"
    ["assets/radio-browser.css"]="${SCRIPT_DIR}/assets/radio-browser.css"
    ["assets/coverart-fix.js"]="${SCRIPT_DIR}/assets/coverart-fix.js"
    ["templates/radio-browser.html"]="${SCRIPT_DIR}/templates/radio-browser.html"
    ["scripts/fix-permissions.sh"]="${SCRIPT_DIR}/scripts/fix-permissions.sh"
    ["scripts/test-api.sh"]="${SCRIPT_DIR}/scripts/test-api.sh"
    ["scripts/flush-cache.sh"]="${SCRIPT_DIR}/scripts/flush-cache.sh"
    ["scripts/clear-recently-played.sh"]="${SCRIPT_DIR}/scripts/clear-recently-played.sh"
    ["info.txt"]="${SCRIPT_DIR}/info.txt"
    ["info.json"]="${SCRIPT_DIR}/info.json"
    ["version.txt"]="${SCRIPT_DIR}/version.txt"
    ["README.md"]="${SCRIPT_DIR}/README.md"
)

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
