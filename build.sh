#!/bin/bash

# Vikunja Uploader for Thunderbird - Build Script
# Creates a distributable .xpi file

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
OUTPUT_DIR="dist"
OUTPUT_FILE="${OUTPUT_DIR}/vikunja-uploader-${VERSION}.xpi"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Vikunja Uploader Build Script${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Create dist directory if it doesn't exist
if [ ! -d "$OUTPUT_DIR" ]; then
    echo -e "${YELLOW}Creating dist directory...${NC}"
    mkdir -p "$OUTPUT_DIR"
fi

# Clean previous build
if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${YELLOW}Removing previous build: ${OUTPUT_FILE}${NC}"
    rm "$OUTPUT_FILE"
fi

# Files and directories to include
echo -e "${BLUE}Packaging extension files...${NC}"

# Create the XPI (which is just a ZIP file)
zip -r "$OUTPUT_FILE" \
    manifest.json \
    background.js \
    utils.js \
    popup.html \
    popup.js \
    options.html \
    options.js \
    upload-dialog.html \
    upload-dialog.js \
    select-attachments.html \
    select-attachments.js \
    message-display-popup.html \
    message-display-popup.js \
    fuse.min.js \
    icons/ \
    LICENSE \
    -x "*.git*" \
    -x "*node_modules*" \
    -x "*.DS_Store" \
    -x "*package*.json" \
    -x "*.md" \
    -x "*build.sh" \
    -x "*dist/*" \
    -q

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "\n${GREEN}✓ Build successful!${NC}"
    echo -e "${GREEN}  Output: ${OUTPUT_FILE}${NC}"
    echo -e "${GREEN}  Size: ${FILE_SIZE}${NC}\n"
    
    echo -e "${BLUE}Package contents:${NC}"
    unzip -l "$OUTPUT_FILE" | tail -n +4 | head -n -2
    
    echo -e "\n${YELLOW}To install in Thunderbird:${NC}"
    echo -e "  1. Open Thunderbird"
    echo -e "  2. Go to Add-ons and Themes > Extensions"
    echo -e "  3. Click the gear icon > Install Add-on From File..."
    echo -e "  4. Select: ${OUTPUT_FILE}\n"
else
    echo -e "\n${RED}✗ Build failed!${NC}\n"
    exit 1
fi
