# Build System

This document describes the build process for the Vikunja Uploader Thunderbird extension.

## Quick Start

Build the extension:
```bash
npm run build
```

The built `.xpi` file will be available at: `dist/vikunja-uploader-{version}.xpi`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the extension `.xpi` file |
| `npm run clean` | Remove all built `.xpi` files |
| `npm run package` | Alias for `npm run build` |

## Build Process

The build script (`build.sh`) performs the following steps:

1. **Extract version** - Reads version from `manifest.json`
2. **Create dist directory** - Creates `dist/` if it doesn't exist
3. **Clean previous builds** - Removes old `.xpi` files with the same version
4. **Package files** - Creates a ZIP archive (`.xpi`) containing:
   - All JavaScript files (`*.js`)
   - All HTML files (`*.html`)
   - `manifest.json`
   - `icons/` directory
   - `LICENSE` file
   - Excludes: `.git*`, `node_modules/`, `*.md`, `package*.json`, `dist/`, build scripts

5. **Verify build** - Shows package size and contents

## Output

Build output is placed in the `dist/` directory with the naming format:
```
vikunja-uploader-{version}.xpi
```

Example: `vikunja-uploader-0.8.2.xpi`

## Manual Build

If you need to build manually without npm:

```bash
./build.sh
```

Or with zip directly:
```bash
zip -r vikunja-uploader.xpi \
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
    -x "*.git*" -x "*node_modules*" -x "*.DS_Store"
```

## Versioning

The version number is automatically read from `manifest.json`:

```json
{
  "version": "0.8.2"
}
```

To release a new version:
1. Update the version in `manifest.json`
2. Run `npm run build`
3. The new `.xpi` will have the updated version in its filename

## Distribution

The built `.xpi` file can be:
- Uploaded to Thunderbird Add-ons (ATN) for public distribution
- Distributed directly to users for manual installation
- Used for local testing in Thunderbird

### Manual Installation
1. Open Thunderbird
2. Go to **Add-ons and Themes** > **Extensions**
3. Click the gear icon > **Install Add-on From File...**
4. Select the `.xpi` file from `dist/`

## Continuous Integration

For automated builds, the build script can be integrated into CI/CD pipelines (GitHub Actions, GitLab CI, etc.):

```yaml
# Example GitHub Actions snippet
- name: Build extension
  run: npm run build

- name: Upload artifact
  uses: actions/upload-artifact@v3
  with:
    name: extension
    path: dist/*.xpi
```

## Troubleshooting

### Permission denied when running build.sh
Make the script executable:
```bash
chmod +x build.sh
```

### Build fails with "zip command not found"
Install zip utility:
- Ubuntu/Debian: `sudo apt-get install zip`
- macOS: `brew install zip` (usually pre-installed)
- Windows: Use WSL or install zip for Windows

### Old .xpi file still present
Run clean before building:
```bash
npm run clean && npm run build
```
