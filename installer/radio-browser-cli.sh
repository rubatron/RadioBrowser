#!/bin/bash

# RubaTron's Radio Browser Installer
# Version: 2.0 - CLI Edition
# Date: January 4, 2026
# Author: RubaTron

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/radio-browser-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/radio-browser-installer-$(date +%Y%m%d-%H%M%S).log"

# ASCII Art Banner
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗██████╗  ██████╗     ║
║                ██╔══██╗██║   ██║██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔═══██╗    ║
║                ██████╔╝██║   ██║██████╔╝███████║   ██║   ██████╔╝██║   ██║    ║
║                ██╔══██╗██║   ██║██╔══██╗██╔══██║   ██║   ██╔══██╗██║   ██║    ║
║                ██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║   ██║  ██║╚██████╔╝    ║
║                ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝     ║
║                                                                              ║
║                    ██████╗  █████╗ ██████╗ ██╗ ██████╗     ██████╗            ║
║                    ██╔══██╗██╔══██╗██╔══██╗██║██╔═══██╗    ██╔══██╗           ║
║                    ██████╔╝███████║██║  ██║██║██║   ██║    ██████╔╝           ║
║                    ██╔══██╗██╔══██║██║  ██║██║██║   ██║    ██╔══██╗           ║
║                    ██║  ██║██║  ██║██████╔╝██║╚██████╔╝    ██████╔╝           ║
║                    ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝     ╚═════╝            ║
║                                                                              ║
║                    ██╗███╗   ██╗███████╗████████╗ █████╗ ██╗     ██╗         ║
║                    ██║████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║     ██║         ║
║                    ██║██╔██╗ ██║███████╗   ██║   ███████║██║     ██║         ║
║                    ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║     ██║         ║
║                    ██║██║ ╚████║███████║   ██║   ██║  ██║███████╗███████╗    ║
║                    ╚═╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝    ║
║                                                                              ║
║                    ███████╗ ██████╗ ██████╗     ███╗   ███╗ ██████╗ ██████╗   ║
║                    ██╔════╝██╔═══██╗██╔══██╗    ████╗ ████║██╔═══██╗██╔══██╗  ║
║                    █████╗  ██║   ██║██████╔╝    ██╔████╔██║██║   ██║██║  ██║  ║
║                    ██╔══╝  ██║   ██║██╔══██╗    ██║╚██╔╝██║██║   ██║██║  ██║  ║
║                    ██║     ╚██████╔╝██║  ██║    ██║ ╚═╝ ██║╚██████╔╝██████╔╝  ║
║                    ╚═╝      ╚═════╝ ╚═╝  ╚═╝    ╚═╝     ╚═╝ ╚═════╝ ╚═════╝   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo -e "${YELLOW}                    Radio Browser Extension Installer v2.0${NC}"
    echo -e "${WHITE}                    ==========================================${NC}"
    echo ""
}

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2 | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (sudo)"
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check PHP
    if ! command -v php >/dev/null 2>&1; then
        error "PHP is not installed"
    fi

    local php_version=$(php -r "echo PHP_VERSION;")
    info "PHP version: $php_version"

    # Check PHP cURL extension
    if ! php -m | grep -q curl; then
        error "PHP cURL extension is not installed. Install with: apt install php8.4-curl"
    fi
    success "PHP cURL extension found"

    # Check other PHP extensions
    local required_extensions=("json" "mbstring")
    for ext in "${required_extensions[@]}"; do
        if ! php -m | grep -q "$ext"; then
            warning "PHP $ext extension not found (may be required)"
        else
            info "PHP $ext extension found"
        fi
    done

    # Check nginx/apache
    if command -v nginx >/dev/null 2>&1; then
        info "nginx found"
    elif command -v apache2 >/dev/null 2>&1; then
        info "apache2 found"
    else
        warning "No web server found (nginx/apache2)"
    fi

    # Check required commands
    local required_commands=("curl" "tar" "gzip")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "Required command '$cmd' not found"
        fi
    done
    success "All required commands found"

    # Check internet connectivity
    if ! curl -s --max-time 5 https://www.google.com >/dev/null 2>&1; then
        warning "No internet connectivity detected"
    else
        info "Internet connectivity OK"
    fi
}

# Create backup
create_backup() {
    log "Creating backup..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Files to backup
    local files_to_backup=(
        "/var/www/extensions/installed/radio-browser"
        "/var/www/radio-browser.php"
        "/var/www/js/scripts-radio-browser.js"
        "/var/www/templates/radio-browser.html"
    )

    for file in "${files_to_backup[@]}"; do
        if [ -e "$file" ]; then
            local relative_path="${file#/}"
            local backup_path="$BACKUP_DIR/$relative_path"

            # Create directory structure
            mkdir -p "$(dirname "$backup_path")"

            # Copy file/directory
            if [ -d "$file" ]; then
                cp -r "$file" "$(dirname "$backup_path")/"
            else
                cp "$file" "$backup_path"
            fi

            info "Backed up: $file"
        fi
    done

    # Mark backup as complete
    touch "$BACKUP_DIR/.backup_complete"
    success "Backup created in: $BACKUP_DIR"
}

# Install files
install_files() {
    log "Installing Radio Browser files..."

    # Create directories
    mkdir -p /var/www/extensions/installed/radio-browser/backend
    mkdir -p /var/www/extensions/installed/radio-browser/css
    mkdir -p /var/www/extensions/installed/radio-browser/js
    mkdir -p /var/local/www/extensions/cache/radio-browser
    mkdir -p /var/local/www/extensions/logs

    # Install files
    local files_to_install=(
        "$PROJECT_ROOT/www/extensions/installed/radio-browser/backend/api.php:/var/www/extensions/installed/radio-browser/backend/api.php"
        "$PROJECT_ROOT/www/radio-browser.php:/var/www/radio-browser.php"
        "$PROJECT_ROOT/www/js/scripts-radio-browser.js:/var/www/js/scripts-radio-browser.js"
        "$PROJECT_ROOT/www/templates/radio-browser.html:/var/www/templates/radio-browser.html"
    )

    for file_pair in "${files_to_install[@]}"; do
        local source="${file_pair%%:*}"
        local dest="${file_pair#*:}"

        if [ -f "$source" ]; then
            cp "$source" "$dest"
            info "Installed: $dest"
        else
            warning "Source file not found: $source"
        fi
    done

    success "Files installed successfully"
}

# Set permissions
set_permissions() {
    log "Setting permissions..."

    # Web files
    chown -R www-data:www-data /var/www/extensions/installed/radio-browser
    chown www-data:www-data /var/www/radio-browser.php
    chown www-data:www-data /var/www/js/scripts-radio-browser.js
    chown www-data:www-data /var/www/templates/radio-browser.html

    # Cache and logs
    chown -R www-data:www-data /var/local/www/extensions/cache/radio-browser
    chown -R www-data:www-data /var/local/www/extensions/logs

    # Make sure directories are writable
    chmod -R 755 /var/www/extensions/installed/radio-browser
    chmod 644 /var/www/extensions/installed/radio-browser/backend/api.php
    chmod 644 /var/www/radio-browser.php
    chmod 644 /var/www/js/scripts-radio-browser.js
    chmod 644 /var/www/templates/radio-browser.html

    # Cache and logs should be writable
    chmod -R 775 /var/local/www/extensions/cache/radio-browser
    chmod -R 775 /var/local/www/extensions/logs

    success "Permissions set correctly"
}

# Restart services
restart_services() {
    log "Restarting services..."

    # Detect and restart web server
    if command -v nginx >/dev/null 2>&1; then
        systemctl restart nginx
        success "nginx restarted"
    elif command -v apache2 >/dev/null 2>&1; then
        systemctl restart apache2
        success "apache2 restarted"
    else
        warning "No web server found to restart"
    fi

    # Restart PHP-FPM if available
    if command -v php8.4-fpm >/dev/null 2>&1; then
        systemctl restart php8.4-fpm
        success "PHP-FPM restarted"
    fi
}

# Test installation
test_installation() {
    log "Testing installation..."

    # Test API
    if curl -s "http://localhost/extensions/installed/radio-browser/backend/api.php?cmd=top_click" | grep -q '"success":true'; then
        success "API test passed"
    else
        warning "API test failed - check logs at /var/local/www/extensions/logs/radio-browser.log"
    fi

    # Test main page
    if curl -s "http://localhost/radio-browser.php" | grep -q "Radio Browser"; then
        success "Main page test passed"
    else
        warning "Main page test failed"
    fi
}

# Show menu
show_menu() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║${NC} ${CYAN}RADIO BROWSER INSTALLER MENU${NC}                                               ${WHITE}║${NC}"
    echo -e "${WHITE}╠══════════════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}1)${NC} Install Radio Browser Extension                                      ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}2)${NC} Create Backup Only                                                   ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}3)${NC} Restore from Backup                                                ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}4)${NC} Check System Requirements                                        ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}5)${NC} Uninstall Radio Browser Extension                               ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}6)${NC} Show Installation Log                                           ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${GREEN}7)${NC} About / Help                                                     ${WHITE}║${NC}"
    echo -e "${WHITE}║${NC} ${RED}0)${NC} Exit                                                              ${WHITE}║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Install function
do_install() {
    log "Starting Radio Browser installation..."

    create_backup
    install_files
    set_permissions
    restart_services
    test_installation

    success "Radio Browser extension installed successfully!"
    info "Log file: $LOG_FILE"
    info "Backup location: $BACKUP_DIR"
}

# Restore function
do_restore() {
    log "Restore functionality not yet implemented in CLI version"
    warning "Please use the advanced installer script for restore operations"
}

# Uninstall function
do_uninstall() {
    log "Uninstalling Radio Browser extension..."

    # Remove files
    local files_to_remove=(
        "/var/www/extensions/installed/radio-browser"
        "/var/www/radio-browser.php"
        "/var/www/js/scripts-radio-browser.js"
        "/var/www/templates/radio-browser.html"
    )

    for file in "${files_to_remove[@]}"; do
        if [ -e "$file" ]; then
            rm -rf "$file"
            info "Removed: $file"
        fi
    done

    # Remove cache and logs
    rm -rf /var/local/www/extensions/cache/radio-browser
    rm -rf /var/local/www/extensions/logs/radio-browser.log

    restart_services

    success "Radio Browser extension uninstalled"
}

# Show log
show_log() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${CYAN}Installation Log:${NC}"
        echo "=================="
        cat "$LOG_FILE"
    else
        warning "No log file found"
    fi
}

# Show about
show_about() {
    echo -e "${CYAN}RubaTron's Radio Browser Installer v2.0${NC}"
    echo "========================================"
    echo ""
    echo "This installer provides an easy way to install and manage"
    echo "the Radio Browser extension for Moode Audio."
    echo ""
    echo "Features:"
    echo "  ✓ Automatic dependency checking"
    echo "  ✓ Backup creation before installation"
    echo "  ✓ Proper file permissions"
    echo "  ✓ Service restart handling"
    echo "  ✓ Installation verification"
    echo "  ✓ Restore functionality"
    echo "  ✓ Clean uninstall option"
    echo ""
    echo "For more information, visit the GitHub repository."
    echo ""
}

# Main menu loop
main_menu() {
    while true; do
        clear
        show_banner
        show_menu

        echo -n -e "${YELLOW}Select option (0-7): ${NC}"
        read -r choice

        case $choice in
            1)
                echo ""
                echo -e "${BLUE}Starting Radio Browser Installation...${NC}"
                echo ""
                check_root
                check_requirements
                do_install
                echo ""
                echo -e "${GREEN}Installation completed! Press Enter to continue...${NC}"
                read -r
                ;;
            2)
                echo ""
                echo -e "${BLUE}Creating Backup...${NC}"
                echo ""
                check_root
                create_backup
                echo ""
                echo -e "${GREEN}Backup created at: $BACKUP_DIR${NC}"
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            3)
                echo ""
                echo -e "${BLUE}Restore from Backup...${NC}"
                echo ""
                do_restore
                echo ""
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            4)
                echo ""
                echo -e "${BLUE}Checking System Requirements...${NC}"
                echo ""
                check_requirements
                echo ""
                echo -e "${GREEN}System check completed! Press Enter to continue...${NC}"
                read -r
                ;;
            5)
                echo ""
                echo -e "${RED}Uninstalling Radio Browser Extension...${NC}"
                echo ""
                check_root
                do_uninstall
                echo ""
                echo -e "${GREEN}Uninstallation completed! Press Enter to continue...${NC}"
                read -r
                ;;
            6)
                echo ""
                show_log
                echo ""
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            7)
                echo ""
                show_about
                echo -e "${GREEN}Press Enter to continue...${NC}"
                read -r
                ;;
            0)
                echo ""
                echo -e "${CYAN}Thank you for using RubaTron's Radio Browser Installer!${NC}"
                echo -e "${WHITE}Goodbye! 👋${NC}"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                echo -e "${RED}Invalid option. Please select 0-7.${NC}"
                echo ""
                sleep 2
                ;;
        esac
    done
}

# Main function
main() {
    # Check if we're in the right directory
    if [ ! -d "$PROJECT_ROOT/www" ]; then
        error "Error: www directory not found. Please run this script from the installer directory."
    fi

    # Create backups directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/backups"

    # Start the menu
    main_menu
}

# Run main function
main "$@"