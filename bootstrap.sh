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
ZIP_URL="${REPO_URL}/raw/refs/heads/main/radio-browser.zip"
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

echo -e "${BLUE}[*] Running installer in auto mode...${NC}"
echo ""

# Run auto-install (non-interactive)
./install.sh --auto 2>&1 | tee -a "$LOG_FILE"

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
echo -e "${CYAN}Access Radio Browser at: ${BOLD}http://<your-moode-ip>/radio-browser.php${NC}"
echo -e "${CYAN}Log file: ${LOG_FILE}${NC}"
echo ""
