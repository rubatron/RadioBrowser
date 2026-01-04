#!/bin/bash

# Radio Browser Extension Advanced Installation Script
# Version: 2.0
# Date: January 4, 2026
# Description: Advanced installer with dependency checks, backups, and uninstall options

set -e  # Exit on any error, but we'll handle cleanup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$0")"
BACKUP_DIR="${SCRIPT_DIR}/backups/radio-browser-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/radio-browser-install-$(date +%Y%m%d-%H%M%S).log"

# Default options
AUTO_BACKUP=true
AUTO_RESTART=true
FORCE_INSTALL=false
UNINSTALL_MODE=false
MANUAL_BACKUP=false
SKIP_CHECKS=false

# Trap for cleanup on exit
trap cleanup EXIT

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

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        warning "Script exited with error code $exit_code. Check $LOG_FILE for details."
        if [ -d "$BACKUP_DIR" ] && [ ! -f "$BACKUP_DIR/.backup_complete" ]; then
            warning "Backup may be incomplete. Check $BACKUP_DIR"
        fi
    fi
    # Clean up temp files
    rm -f /tmp/radio-browser-*.tmp 2>/dev/null || true
}

# Show usage
usage() {
    cat << EOF
Radio Browser Extension Advanced Installer v2.0

USAGE:
    $SCRIPT_NAME [OPTIONS] [COMMAND]

COMMANDS:
    install     Install Radio Browser extension (default)
    uninstall   Remove Radio Browser extension
    backup      Create manual backup only
    restore     Restore from backup
    check       Check system requirements only

OPTIONS:
    -h, --help              Show this help message
    -f, --force             Force installation (skip some checks)
    -s, --skip-checks       Skip dependency checks
    --no-backup             Skip automatic backup
    --no-restart            Skip automatic service restart
    --manual-backup         Create manual backup and exit

EXAMPLES:
    $SCRIPT_NAME                    # Install with all defaults
    $SCRIPT_NAME --no-backup        # Install without backup
    $SCRIPT_NAME uninstall          # Uninstall extension
    $SCRIPT_NAME backup             # Create backup only
    $SCRIPT_NAME restore            # Restore from backup
    $SCRIPT_NAME check              # Check requirements only

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -f|--force)
                FORCE_INSTALL=true
                shift
                ;;
            -s|--skip-checks)
                SKIP_CHECKS=true
                shift
                ;;
            --no-backup)
                AUTO_BACKUP=false
                shift
                ;;
            --no-restart)
                AUTO_RESTART=false
                shift
                ;;
            --manual-backup)
                MANUAL_BACKUP=true
                shift
                ;;
            install|uninstall|backup|restore|check)
                COMMAND="$1"
                shift
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Default command
    COMMAND="${COMMAND:-install}"

    # Validate options
    if [ "$COMMAND" = "backup" ]; then
        MANUAL_BACKUP=true
    fi

    if [ "$COMMAND" = "uninstall" ]; then
        UNINSTALL_MODE=true
    fi
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

# Check if backup files exist
check_backup_files() {
    log "Checking backup files..."

    local backup_files=(
        "${SCRIPT_DIR}/api.php"
        "${SCRIPT_DIR}/radio-browser.php"
        "${SCRIPT_DIR}/scripts-radio-browser.js"
    )

    for file in "${backup_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Backup file not found: $file"
        fi
    done

    success "All backup files found"
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
        "api.php:/var/www/extensions/installed/radio-browser/backend/api.php"
        "radio-browser.php:/var/www/radio-browser.php"
        "scripts-radio-browser.js:/var/www/js/scripts-radio-browser.js"
    )

    for file_pair in "${files_to_install[@]}"; do
        local source="${SCRIPT_DIR}/${file_pair%%:*}"
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

    # Cache and logs
    chown -R www-data:www-data /var/local/www/extensions/cache/radio-browser
    chown -R www-data:www-data /var/local/www/extensions/logs

    # Make sure directories are writable
    chmod -R 755 /var/www/extensions/installed/radio-browser
    chmod 644 /var/www/extensions/installed/radio-browser/backend/api.php
    chmod 644 /var/www/radio-browser.php
    chmod 644 /var/www/js/scripts-radio-browser.js

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

# Manual service restart
manual_restart() {
    echo
    echo -e "${YELLOW}Manual Service Restart${NC}"
    echo "========================"
    echo
    echo "Run these commands manually if needed:"
    echo
    if command -v nginx >/dev/null 2>&1; then
        echo "sudo systemctl restart nginx"
    fi
    if command -v apache2 >/dev/null 2>&1; then
        echo "sudo systemctl restart apache2"
    fi
    if command -v php8.4-fpm >/dev/null 2>&1; then
        echo "sudo systemctl restart php8.4-fpm"
    fi
    echo
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

# Uninstall
uninstall() {
    log "Uninstalling Radio Browser extension..."

    # Remove files
    local files_to_remove=(
        "/var/www/extensions/installed/radio-browser"
        "/var/www/radio-browser.php"
        "/var/www/js/scripts-radio-browser.js"
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

    # Restart services
    if [ "$AUTO_RESTART" = true ]; then
        restart_services
    else
        manual_restart
    fi

    success "Radio Browser extension uninstalled"
}

# Restore from backup
restore() {
    log "Restoring Radio Browser extension from backup..."

    # Find available backups
    local backup_base_dir="${SCRIPT_DIR}/backups"
    local available_backups=()

    if [ ! -d "$backup_base_dir" ]; then
        error "No backup directory found at: $backup_base_dir"
    fi

    # Find all radio-browser backup directories
    while IFS= read -r -d '' backup_dir; do
        if [ -f "$backup_dir/.backup_complete" ]; then
            available_backups+=("$backup_dir")
        fi
    done < <(find "$backup_base_dir" -name "radio-browser-*" -type d -print0 | sort -zr)

    if [ ${#available_backups[@]} -eq 0 ]; then
        error "No valid backups found in: $backup_base_dir"
    fi

    # Show available backups
    echo
    echo -e "${CYAN}Available backups:${NC}"
    echo "=================="
    for i in "${!available_backups[@]}"; do
        local backup_name=$(basename "${available_backups[$i]}")
        local backup_date=$(echo "$backup_name" | sed 's/radio-browser-//')
        echo "$((i+1)). $backup_name (${backup_date//-/ })"
    done
    echo

    # Ask user to select backup
    local selection
    while true; do
        read -p "Select backup to restore (1-${#available_backups[@]}): " selection
        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#available_backups[@]} ]; then
            break
        fi
        echo -e "${RED}Invalid selection. Please enter a number between 1 and ${#available_backups[@]}${NC}"
    done

    local selected_backup="${available_backups[$((selection-1))]}"
    info "Selected backup: $(basename "$selected_backup")"

    # Confirm restore
    echo
    echo -e "${YELLOW}WARNING: This will overwrite existing Radio Browser files!${NC}"
    read -p "Are you sure you want to restore from this backup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Restore cancelled by user"
        exit 0
    fi

    # Create backup of current state before restore
    log "Creating backup of current state..."
    local pre_restore_backup="${SCRIPT_DIR}/backups/pre-restore-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$pre_restore_backup"

    local current_files=(
        "/var/www/extensions/installed/radio-browser"
        "/var/www/radio-browser.php"
        "/var/www/js/scripts-radio-browser.js"
    )

    for file in "${current_files[@]}"; do
        if [ -e "$file" ]; then
            local relative_path="${file#/}"
            local backup_path="$pre_restore_backup/$relative_path"
            mkdir -p "$(dirname "$backup_path")"
            if [ -d "$file" ]; then
                cp -r "$file" "$(dirname "$backup_path")/"
            else
                cp "$file" "$backup_path"
            fi
            info "Backed up current: $file"
        fi
    done

    touch "$pre_restore_backup/.backup_complete"
    info "Pre-restore backup created: $pre_restore_backup"

    # Restore files
    log "Restoring files from backup..."

    local files_to_restore=(
        "var/www/extensions/installed/radio-browser:/var/www/extensions/installed/radio-browser"
        "var/www/radio-browser.php:/var/www/radio-browser.php"
        "var/www/js/scripts-radio-browser.js:/var/www/js/scripts-radio-browser.js"
    )

    for file_pair in "${files_to_restore[@]}"; do
        local backup_file="$selected_backup/${file_pair%%:*}"
        local target_file="${file_pair#*:}"

        if [ -e "$backup_file" ]; then
            # Create target directory
            mkdir -p "$(dirname "$target_file")"

            # Restore file/directory
            if [ -d "$backup_file" ]; then
                cp -r "$backup_file" "$(dirname "$target_file")/"
            else
                cp "$backup_file" "$target_file"
            fi
            info "Restored: $target_file"
        else
            warning "Backup file not found: $backup_file"
        fi
    done

    # Set permissions
    set_permissions

    # Restart services
    if [ "$AUTO_RESTART" = true ]; then
        restart_services
    else
        manual_restart
    fi

    # Test restoration
    test_installation

    success "Radio Browser extension restored successfully!"
    info "Original files backed up to: $pre_restore_backup"
    info "Restored from: $selected_backup"
}

# Main install function
do_install() {
    log "Starting Radio Browser installation..."

    if [ "$AUTO_BACKUP" = true ]; then
        create_backup
    fi

    check_backup_files
    install_files
    set_permissions

    if [ "$AUTO_RESTART" = true ]; then
        restart_services
    else
        manual_restart
    fi

    test_installation

    success "Radio Browser extension installed successfully!"
    info "Log file: $LOG_FILE"
    if [ "$AUTO_BACKUP" = true ]; then
        info "Backup location: $BACKUP_DIR"
    fi
}

# Main function
main() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║     Radio Browser Extension Installer v2.0   ║"
    echo "║              Advanced Edition                ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"

    parse_args "$@"

    case "$COMMAND" in
        install)
            check_root
            if [ "$SKIP_CHECKS" = false ]; then
                check_requirements
            fi
            do_install
            ;;
        uninstall)
            check_root
            uninstall
            ;;
        backup)
            check_root
            create_backup
            ;;
        restore)
            check_root
            restore
            ;;
        check)
            check_requirements
            ;;
        *)
            error "Unknown command: $COMMAND"
            ;;
    esac
}

# Run main function
main "$@"