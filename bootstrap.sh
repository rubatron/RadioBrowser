#!/bin/bash
# ============================================================================
# RubaTron's Radio Browser - Bootstrap Installer
# ============================================================================
# SPDX-License-Identifier: GPL-3.0-or-later
# 2026 RubaTron
#
# One-liner installation for moOde Audio Player:
#   curl -fsSL https://raw.githubusercontent.com/rubatron/RadioBrowser/main/bootstrap.sh | sudo bash
#   wget -qO- https://raw.githubusercontent.com/rubatron/RadioBrowser/main/bootstrap.sh | sudo bash
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/rubatron/RadioBrowser"
BRANCH="develop"  # UAT: test from develop, change to main for production
ARCHIVE_URL="${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz"
INSTALL_DIR="/tmp/radio-browser-install"
LOG_FILE="/tmp/radio-browser-bootstrap-$(date +%Y%m%d-%H%M%S).log"
EXT_DIR="/var/www/extensions/installed/radio-browser"
SYMLINK="/var/www/radio-browser.php"
TARGET="${EXT_DIR}/radio-browser.php"

# ============================================================================
# UNINSTALL FUNCTION
# ============================================================================
do_uninstall() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║     RubaTron's Radio Browser - Uninstaller                   ║"
    echo "║                    for moOde Audio Player                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Check root
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}[✗] This script must be run as root (use sudo)${NC}"
        exit 1
    fi

    # Check if installed
    if [[ ! -d "$EXT_DIR" ]] && [[ ! -L "$SYMLINK" ]]; then
        echo -e "${YELLOW}[!] Radio Browser is not installed.${NC}"
        exit 0
    fi

    if [[ -d "$EXT_DIR" ]]; then
        CURRENT_VERSION=$(cat "$EXT_DIR/version.txt" 2>/dev/null || echo "unknown")
        echo -e "  Current version: ${BOLD}${CURRENT_VERSION}${NC}"
    fi

    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠  WARNING: This will completely remove Radio Browser!      ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  The following will be removed:"
    echo -e "    • Extension files in ${EXT_DIR}"
    echo -e "    • Symlink ${SYMLINK}"
    echo -e "    • Menu patches (will be restored to original)"
    echo ""
    echo -e "  ${GREEN}Your moOde Radio favorites will NOT be affected.${NC}"
    echo ""
    
    read -p "  Are you sure you want to uninstall? [y/N] " -n 1 -r </dev/tty
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[*] Uninstall cancelled.${NC}"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}[*] Removing symlink...${NC}"
    rm -f "$SYMLINK" 2>/dev/null || true
    echo -e "${GREEN}[✓] Symlink removed${NC}"

    echo -e "${BLUE}[*] Removing extension files...${NC}"
    rm -rf "$EXT_DIR" 2>/dev/null || true
    echo -e "${GREEN}[✓] Extension files removed${NC}"

    # Restore original files if backups exist
    BACKUP_DIR="/var/www/extensions/installed/radio-browser/sys/backups"
    if [[ -d "$BACKUP_DIR" ]]; then
        echo -e "${BLUE}[*] Restoring original moOde files from backups...${NC}"
        for backup in "$BACKUP_DIR"/*.bak; do
            if [[ -f "$backup" ]]; then
                original=$(basename "$backup" .bak)
                # Try to find the original location
                if [[ "$original" == "footer.min.php" ]]; then
                    cp "$backup" "/var/www/footer.min.php" 2>/dev/null || true
                fi
            fi
        done
        echo -e "${GREEN}[✓] Original files restored${NC}"
    fi

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Uninstall Complete!                             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Radio Browser has been removed from your system.${NC}"
    echo -e "${CYAN}Your moOde Radio favorites are still available.${NC}"
    echo ""
    exit 0
}

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================
case "${1:-}" in
    --uninstall|-u|uninstall)
        do_uninstall
        ;;
    --help|-h|help)
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  (none)        Install or upgrade Radio Browser"
        echo "  --uninstall   Remove Radio Browser completely"
        echo "  --help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  curl -fsSL .../bootstrap.sh | sudo bash           # Install"
        echo "  curl -fsSL .../bootstrap.sh | sudo bash -s -- -u  # Uninstall"
        exit 0
        ;;
esac

# ============================================================================
# INSTALL / UPGRADE
# ============================================================================
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     RubaTron's Radio Browser - Bootstrap Installer           ║"
echo "║                    for moOde Audio Player                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[✗] This script must be run as root (use sudo)${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Running as root${NC}"

# Check if Radio Browser is already installed
if [[ -d "$EXT_DIR" ]] || [[ -L "$SYMLINK" ]]; then
    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠  Radio Browser is already installed!                      ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if [[ -d "$EXT_DIR" ]]; then
        CURRENT_VERSION=$(cat "$EXT_DIR/version.txt" 2>/dev/null || echo "unknown")
        echo -e "  Current version: ${BOLD}${CURRENT_VERSION}${NC}"
    fi
    echo ""
    echo -e "  Continuing will ${BOLD}reinstall/upgrade${NC} the extension."
    echo -e "  Your settings and favorites will be preserved."
    echo ""
    read -p "  Do you want to proceed? [y/N] " -n 1 -r </dev/tty
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}[*] Installation cancelled.${NC}"
        exit 0
    fi
    echo -e "${GREEN}[✓] Proceeding with reinstall/upgrade...${NC}"
fi

# Clean up any previous install attempt
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download the package
echo -e "${BLUE}[*] Downloading Radio Browser package...${NC}"
if command -v wget &> /dev/null; then
    wget -q --show-progress -O radio-browser.tar.gz "$ARCHIVE_URL" 2>&1 | tee -a "$LOG_FILE"
elif command -v curl &> /dev/null; then
    curl -fSL -o radio-browser.tar.gz "$ARCHIVE_URL" 2>&1 | tee -a "$LOG_FILE"
else
    echo -e "${RED}[✗] Neither wget nor curl found. Please install one of them.${NC}"
    exit 1
fi

if [[ ! -f "radio-browser.tar.gz" ]]; then
    echo -e "${RED}[✗] Failed to download package${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Package downloaded${NC}"

# Extract
echo -e "${BLUE}[*] Extracting package...${NC}"
tar -xzf radio-browser.tar.gz
# GitHub archives extract to RadioBrowser-{branch}/ folder
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "RadioBrowser-*" | head -1)
if [[ ! -d "$EXTRACTED_DIR/radio-browser" ]]; then
    echo -e "${RED}[✗] Extraction failed - radio-browser folder not found${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Package extracted${NC}"

# Make installer executable and run it
cd "$EXTRACTED_DIR/radio-browser"
chmod +x install.sh scripts/*.sh 2>/dev/null || true

echo -e "${BLUE}[*] Running installer in auto mode...${NC}"
echo ""

# Run auto-install (non-interactive)
bash install.sh --auto 2>&1 | tee -a "$LOG_FILE"

# Copy source archive to sys/sources for future repairs
echo ""
echo -e "${BLUE}[*] Preserving source archive...${NC}"
SYS_SOURCES="/var/www/extensions/installed/radio-browser/sys/sources"
if [[ -d "$SYS_SOURCES" ]]; then
    VERSION=$(cat version.txt 2>/dev/null || echo "unknown")
    cp "$INSTALL_DIR/radio-browser.tar.gz" "$SYS_SOURCES/radio-browser-${VERSION}.tar.gz" 2>/dev/null || true
    chown www-data:www-data "$SYS_SOURCES/radio-browser-${VERSION}.tar.gz" 2>/dev/null || true
    echo -e "${GREEN}[✓] Source archive saved to sys/sources/${NC}"
fi

# Verify symlink works
echo ""
echo -e "${BLUE}[*] Verifying installation...${NC}"

if [[ ! -L "$SYMLINK" ]] || [[ ! -e "$SYMLINK" ]]; then
    echo -e "${YELLOW}[!] Symlink missing or broken, recreating...${NC}"
    rm -f "$SYMLINK" 2>/dev/null
    ln -sf "$TARGET" "$SYMLINK"
    chown -h www-data:www-data "$SYMLINK" 2>/dev/null || true
fi

# Final verification
if [[ -L "$SYMLINK" ]] && [[ -e "$SYMLINK" ]]; then
    echo -e "${GREEN}[✓] Symlink verified: $SYMLINK${NC}"
else
    echo -e "${RED}[✗] Symlink verification failed!${NC}"
    echo -e "${RED}    Please run manually: sudo ln -sf $TARGET $SYMLINK${NC}"
    exit 1
fi

# Clean up
echo ""
echo -e "${BLUE}[*] Cleaning up temporary files...${NC}"
cd /
rm -rf "$INSTALL_DIR"

# Service Status Report
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Service Status                            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check nginx
if systemctl is-active --quiet nginx; then
    echo -e "  nginx            ${GREEN}● running${NC}"
else
    echo -e "  nginx            ${RED}● stopped${NC}"
fi

# Check PHP-FPM (detect version)
PHP_FPM=$(systemctl list-units --type=service --state=running | grep -o 'php[0-9.]*-fpm' | head -1)
if [[ -n "$PHP_FPM" ]]; then
    echo -e "  $PHP_FPM        ${GREEN}● running${NC}"
else
    echo -e "  php-fpm          ${RED}● stopped${NC}"
fi

# Check Radio Browser accessibility
RB_URL="http://localhost/radio-browser.php"
if curl -s -o /dev/null -w "%{http_code}" "$RB_URL" | grep -q "200"; then
    echo -e "  Radio Browser    ${GREEN}● accessible${NC}"
else
    echo -e "  Radio Browser    ${YELLOW}● check manually${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Installation Complete!                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Access Radio Browser at: ${BOLD}http://$(hostname)/radio-browser.php${NC}"
echo -e "${CYAN}Log file: ${LOG_FILE}${NC}"
echo ""
