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
ZIP_URL="${REPO_URL}/raw/refs/heads/${BRANCH}/radio-browser.zip"
INSTALL_DIR="/tmp/radio-browser-install"
LOG_FILE="/tmp/radio-browser-bootstrap-$(date +%Y%m%d-%H%M%S).log"

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
EXT_DIR="/var/www/extensions/installed/radio-browser"
SYMLINK="/var/www/radio-browser.php"

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
    wget -q --show-progress -O radio-browser.zip "$ZIP_URL" 2>&1 | tee -a "$LOG_FILE"
elif command -v curl &> /dev/null; then
    curl -fSL -o radio-browser.zip "$ZIP_URL" 2>&1 | tee -a "$LOG_FILE"
else
    echo -e "${RED}[✗] Neither wget nor curl found. Please install one of them.${NC}"
    exit 1
fi

if [[ ! -f "radio-browser.zip" ]]; then
    echo -e "${RED}[✗] Failed to download package${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Package downloaded${NC}"

# Extract
echo -e "${BLUE}[*] Extracting package...${NC}"
unzip -q radio-browser.zip
if [[ ! -d "radio-browser" ]]; then
    echo -e "${RED}[✗] Extraction failed - radio-browser folder not found${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Package extracted${NC}"

# Make installer executable and run it
cd radio-browser
chmod +x install.sh

# Fix line endings (in case zip has CRLF from Windows)
sed -i 's/\r$//' install.sh
sed -i 's/\r$//' scripts/*.sh 2>/dev/null || true

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
    cp "$INSTALL_DIR/radio-browser.zip" "$SYS_SOURCES/radio-browser-${VERSION}.zip" 2>/dev/null || true
    chown www-data:www-data "$SYS_SOURCES/radio-browser-${VERSION}.zip" 2>/dev/null || true
    echo -e "${GREEN}[✓] Source archive saved to sys/sources/${NC}"
fi

# Verify symlink works
echo ""
echo -e "${BLUE}[*] Verifying installation...${NC}"

SYMLINK="/var/www/radio-browser.php"
TARGET="/var/www/extensions/installed/radio-browser/radio-browser.php"

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

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Installation Complete!                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Access Radio Browser at: ${BOLD}http://$(hostname)/radio-browser.php${NC}"
echo -e "${CYAN}Log file: ${LOG_FILE}${NC}"
echo ""
