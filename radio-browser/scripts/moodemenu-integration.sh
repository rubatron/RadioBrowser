#!/bin/bash
# ============================================================================
# Radio Browser Extension - moOde Menu Integration
# ============================================================================
# Version: 5.0
# Date: January 10, 2026
# Description: Integrates Radio Browser extension into moOde's navigation menu
# 
# This script will add Radio Browser to moOde's main menu by patching
# header.php or adding navigation items. It creates backups before modifying
# any moOde system files.
#
# Usage: sudo ./moodemenu-integration.sh [install|uninstall]
# ============================================================================

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================
MOODE_HEADER="/var/www/header.php"
BACKUP_DIR="/var/local/www/radio-browser-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/header.php.backup-${TIMESTAMP}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (sudo)"
        exit 1
    fi
}

check_header_exists() {
    if [[ ! -f "${MOODE_HEADER}" ]]; then
        error "moOde header.php not found at: ${MOODE_HEADER}"
        error "Are you sure moOde is installed?"
        exit 1
    fi
}

create_backup() {
    info "Creating backup of header.php..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_DIR}"
    
    # Copy header.php to backup
    if cp "${MOODE_HEADER}" "${BACKUP_FILE}"; then
        success "Backup created: ${BACKUP_FILE}"
        return 0
    else
        error "Failed to create backup"
        return 1
    fi
}

check_already_installed() {
    if grep -q "Radio Browser" "${MOODE_HEADER}"; then
        return 0  # Already installed
    else
        return 1  # Not installed
    fi
}

# ============================================================================
# INSTALLATION
# ============================================================================
install_menu_item() {
    info "Installing Radio Browser menu item..."
    
    # Check if already installed
    if check_already_installed; then
        warning "Radio Browser menu item already exists in header.php"
        echo "Use 'uninstall' command first to reinstall"
        exit 0
    fi
    
    # Create backup first
    create_backup || exit 1
    
    # Find the menu section in header.php
    # We'll add Radio Browser after the Library menu item
    
    # Create temporary file with the new menu item
    local temp_file=$(mktemp)
    
    # Search for the Library menu item and add Radio Browser after it
    # Pattern: Look for the Library <li> block and add our item after it
    
    awk '
    /id="menu-bottom"/ {
        print
        in_menu = 1
        next
    }
    
    # If we find the Library link, insert Radio Browser after the closing </li>
    in_menu && /<a href="library\.php">/ {
        print
        library_found = 1
        next
    }
    
    # When we find the closing </li> after Library and havent added yet
    in_menu && library_found && /<\/li>/ && !added {
        print
        print "                        <li><a href=\"radio-browser.php\"><i class=\"fa-solid fa-sharp fa-tower-broadcast sx\"></i><span class=\"sx\">Radio Browser</span></a></li>"
        added = 1
        in_menu = 0
        library_found = 0
        next
    }
    
    { print }
    ' "${MOODE_HEADER}" > "${temp_file}"
    
    # Check if Radio Browser was added
    if grep -q "radio-browser.php" "${temp_file}"; then
        # Replace original with modified version
        if cp "${temp_file}" "${MOODE_HEADER}"; then
            success "Radio Browser menu item added to header.php"
            info "Backup saved to: ${BACKUP_FILE}"
            
            # Set correct permissions
            chown www-data:www-data "${MOODE_HEADER}"
            chmod 644 "${MOODE_HEADER}"
            
            success "Installation complete!"
            echo
            echo "The Radio Browser menu item has been added to moOde's main menu."
            echo "Refresh your browser to see the changes."
        else
            error "Failed to update header.php"
            rm -f "${temp_file}"
            exit 1
        fi
    else
        error "Failed to add menu item (pattern not found in header.php)"
        error "moOde header.php structure may have changed"
        rm -f "${temp_file}"
        exit 1
    fi
    
    # Clean up
    rm -f "${temp_file}"
}

# ============================================================================
# UNINSTALLATION
# ============================================================================
uninstall_menu_item() {
    info "Removing Radio Browser menu item..."
    
    # Check if installed
    if ! check_already_installed; then
        warning "Radio Browser menu item not found in header.php"
        echo "Nothing to uninstall"
        exit 0
    fi
    
    # Create backup first
    create_backup || exit 1
    
    # Remove the Radio Browser menu item
    local temp_file=$(mktemp)
    
    # Remove the line containing radio-browser.php
    grep -v "radio-browser.php" "${MOODE_HEADER}" > "${temp_file}"
    
    # Replace original with modified version
    if cp "${temp_file}" "${MOODE_HEADER}"; then
        success "Radio Browser menu item removed from header.php"
        info "Backup saved to: ${BACKUP_FILE}"
        
        # Set correct permissions
        chown www-data:www-data "${MOODE_HEADER}"
        chmod 644 "${MOODE_HEADER}"
        
        success "Uninstallation complete!"
    else
        error "Failed to update header.php"
        rm -f "${temp_file}"
        exit 1
    fi
    
    # Clean up
    rm -f "${temp_file}"
}

# ============================================================================
# RESTORE BACKUP
# ============================================================================
restore_backup() {
    info "Available backups:"
    echo
    
    local backups=($(ls -1t "${BACKUP_DIR}"/header.php.backup-* 2>/dev/null))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        warning "No backups found in ${BACKUP_DIR}"
        exit 0
    fi
    
    local i=1
    for backup in "${backups[@]}"; do
        local date=$(basename "$backup" | sed 's/header.php.backup-//')
        echo "  $i) $date"
        ((i++))
    done
    echo
    
    read -p "Select backup to restore [1-${#backups[@]}] or 'q' to quit: " choice
    
    if [[ "$choice" == "q" ]] || [[ "$choice" == "Q" ]]; then
        info "Cancelled"
        exit 0
    fi
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le ${#backups[@]} ]]; then
        local selected_backup="${backups[$((choice-1))]}"
        
        info "Restoring: $(basename "$selected_backup")"
        
        if cp "$selected_backup" "${MOODE_HEADER}"; then
            success "Backup restored successfully"
            
            # Set correct permissions
            chown www-data:www-data "${MOODE_HEADER}"
            chmod 644 "${MOODE_HEADER}"
        else
            error "Failed to restore backup"
            exit 1
        fi
    else
        error "Invalid choice"
        exit 1
    fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    echo
    echo "============================================"
    echo "  Radio Browser - moOde Menu Integration"
    echo "============================================"
    echo
    
    check_root
    check_header_exists
    
    case "${1:-}" in
        install)
            install_menu_item
            ;;
        uninstall)
            uninstall_menu_item
            ;;
        restore)
            restore_backup
            ;;
        status)
            if check_already_installed; then
                success "Radio Browser menu item is installed"
            else
                info "Radio Browser menu item is NOT installed"
            fi
            ;;
        *)
            echo "Usage: $0 {install|uninstall|restore|status}"
            echo
            echo "Commands:"
            echo "  install   - Add Radio Browser to moOde menu"
            echo "  uninstall - Remove Radio Browser from moOde menu"
            echo "  restore   - Restore a previous backup"
            echo "  status    - Check installation status"
            echo
            echo "Examples:"
            echo "  sudo $0 install"
            echo "  sudo $0 uninstall"
            echo "  sudo $0 restore"
            echo
            exit 1
            ;;
    esac
}

main "$@"
