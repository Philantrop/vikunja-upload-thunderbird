# Vikunja Uploader for Thunderbird

<p align="center">
  <img src="icons/icon-512.png" alt="Vikunja Uploader Icon" width="256" height="256">
</p>

**Vikunja Uploader** is a Thunderbird add-on that streamlines the process of creating tasks in your [Vikunja](https://vikunja.io) instance directly from emails. With just a few clicks, you can convert emails into tasks with attachments, labels, priorities, and due dates—no manual downloads or copy-pasting required.


## Features

- ✉️ **Quick Upload**: Right-click any email to instantly create a task from it
- 📎 **Attachment Support**: Automatically attach email attachments to tasks
- 🏷️ **Smart Labels**: Auto-complete labels from your Vikunja instance or create new ones on the fly
- 📊 **Priority Levels**: Set task priority (Low, Medium, High, Urgent, Critical)
- 📅 **Due Dates**: Add deadlines directly from the upload dialog
- 📧 **Email Metadata**: Task title uses email subject, description includes email body (HTML), and start date is set to email timestamp
- 🎨 **Dark Mode**: Full dark theme support for all dialogs
- 🔒 **Secure**: Local processing—no third-party servers, direct communication with your Vikunja instance
- 🔔 **Notifications**: Get notified on upload success or failure
- 🧩 **Seamless Integration**: Context menus and toolbar buttons for quick access

---

## Installation

### From Thunderbird Add-ons (Recommended)
- Search for "Vikunja Uploader" in Thunderbird's Add-ons Manager and install it directly.

### Manual Installation
1. Download the latest release (`.xpi` file) from the [Releases](https://github.com/Philantrop/paperless-upload-thunderbird/releases) page or build from source.
2. In Thunderbird, go to **Add-ons and Themes** > **Extensions** > **Install Add-on From File...**
3. Select the downloaded `.xpi` file and follow the prompts.

---

## Configuration

Before using the add-on, you need to configure your Vikunja instance:

1. Go to **Add-ons and Themes** > **Extensions** > **Vikunja Uploader** > **Preferences**
2. Set the following:
   - **Vikunja URL**: The base URL of your Vikunja instance (e.g., `https://vikunja.example.com`)
   - **API Token**: Your personal API token for authentication (get it from Vikunja Settings > API Tokens)
   - **Default Project**: Select which Vikunja project to create tasks in
3. Click **Test Connection** to verify your settings
4. Click **Save**

> **Note**: The add-on requires Vikunja API access. Make sure your Vikunja instance is accessible from Thunderbird and CORS is properly configured if needed (add `origins: ["moz-extension://*"]` to your Vikunja config).

---

## Usage

### Quick Upload
1. Right-click any email in your inbox
2. Select **Upload to Vikunja (Quick)** from the context menu
3. The task is created instantly with:
   - **Title**: Email subject (without "From:" prefix)
   - **Description**: Email body (HTML preserved)
   - **Start Date**: Email timestamp
   - **Attachments**: All email attachments

### Advanced Upload
1. Right-click any email in your inbox
2. Select **Upload to Vikunja (Advanced)** from the context menu
3. In the upload dialog, customize:
   - **Task Title**: Defaults to email subject (editable)
   - **Labels**: Type to search existing labels or create new ones
   - **Priority**: Choose from Unset, Low, Medium, High, Urgent, or Critical
   - **Due Date**: Set a deadline for the task
4. Click **Upload** to create the task

### Toolbar Button
- Click the **Vikunja Uploader** icon in the message display toolbar for quick access to upload options

---

## Development

### Setup
1. Clone this repository:
   ```bash
   git clone https://github.com/Philantrop/paperless-upload-thunderbird.git
   cd paperless-upload-thunderbird
   ```
2. Install dependencies (optional, only for development tools):
   ```bash
   npm install
   ```

### Testing
1. Open Thunderbird and navigate to **Add-ons and Themes** > **Debug Add-ons** (or `about:debugging`)
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from this repository
4. The add-on will be loaded for testing
5. Make changes to the code and click **Reload** to see updates

### Building
To create a distributable `.xpi` file:

#### Using npm (recommended)
```bash
npm run build
```

This will create `dist/vikunja-uploader-{version}.xpi` ready for distribution.

#### Using the build script directly
```bash
./build.sh
```

#### Manual build
```bash
zip -r vikunja-uploader.xpi * -x "*.git*" -x "*node_modules*" -x "*.md" -x "package*.json" -x "*dist/*"
```

#### Other npm scripts
- `npm run clean` - Remove all built `.xpi` files from dist/
- `npm run package` - Alias for `npm run build`

### Key Files
- `manifest.json`: Add-on metadata and permissions
- `background.js`: Core task creation and API communication logic
- `upload-dialog.html/js`: Advanced upload interface with labels, priority, and due date
- `select-attachments.html/js`: Attachment selection dialog for quick uploads
- `options.html/js`: Settings page for Vikunja configuration
- `utils.js`: Shared utility functions for UI and API calls

---

## API Compatibility

This add-on is designed for **Vikunja API v1** and has been tested with:
- Vikunja v0.24.x and later
- Vikunja API v1.0.0-rc2 (unstable builds)

### Known Issues
- Attachment uploads use the `PUT /api/v1/tasks/{taskId}/attachments` endpoint with FormData field name `files`
- Labels must be created separately and then assigned to tasks (Vikunja API limitation)
- CORS configuration may be required for browser extension access (add `origins: ["moz-extension://*"]` to Vikunja config)

---

## Troubleshooting

### "Failed to connect to Vikunja"
- Verify your Vikunja URL is correct and accessible
- Check that your API token is valid (test it in Vikunja's web interface)
- Ensure CORS is configured properly in your Vikunja instance

### "401 Unauthorized"
- Your API token may be expired or invalid
- Generate a new token in Vikunja Settings > API Tokens and update it in the add-on preferences

### "No attachments found"
- The add-on supports all email attachment types
- Inline images in HTML emails may not be detected as attachments

### Labels not appearing
- Make sure you have created at least one label in your Vikunja project
- The label autocomplete will only show labels from your configured Vikunja instance

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for bug fixes, features, or documentation improvements.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
