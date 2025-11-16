## Purpose
Short, actionable guidance for AI coding agents working on the Vikunja Uploader for Thunderbird.

Keep edits minimal, prefer small PRs, and validate changes by loading the add-on in Thunderbird debug mode.

## Big picture (what to know first)
- This is a Thunderbird WebExtension that streamlines the process of creating tasks in your Vikunja instance directly from emails. With just a few clicks, you can convert emails into tasks with attachments, labels, priorities, and due dates—no manual downloads or copy-pasting required.
- Key orchestrator: `background.js` — it creates menus, listens for clicks, stores transient payloads in `browser.storage.local`, opens popup windows, and performs uploads via fetch to the Vikunja API.

## Key files and responsibilities
- `manifest.json` — extension permissions (messagesRead, menus, notifications, storage) and entry points (background script, popup pages, options page).
- `background.js` — central logic: context menu creation, handlers (quick/advanced), message listeners (`browser.runtime.onMessage`) and upload logic (`uploadToVikunja`). See actions: `quickUploadSelected`, `uploadWithOptions`, `getCorrespondents`, `quickUploadFromDisplay`, `advancedUploadFromDisplay`.
- `upload-dialog.js` — advanced upload UI: pulls `currentUploadData` from `storage.local`, allows selecting correspondent/document type/tags and posts `uploadWithOptions` to background.
- `select-attachments.js` — quick-upload selection dialog: reads `quickUploadData` from `storage.local`, sends `quickUploadSelected` to background.
- `utils.js` — shared helpers (UI messages, `getVikunjaSettings()`, `makeVikunjaRequest()`), exported on `window.*` for pages to use.
- `popup.js`, `options.js`, `message-display-popup.js` — small UI surfaces; use shared helpers.

## Important runtime/data flows & conventions
- Transient data is passed through `browser.storage.local` keys:
  - `currentUploadData` — used by advanced upload dialog (message + attachments list).
  - `quickUploadData` — used by quick attachment selection window.
- UI ↔ background communication patterns:
  - Dialogs/windows send messages with `browser.runtime.sendMessage({ action: '...', ... })` and expect `sendResponse` with `{ success: boolean, ... }`.
  - Background often replies asynchronously and returns `true` from message listener to keep the channel open.
- Upload endpoint used by background: `${config.url}/api/documents/post_document/` (auth via `Authorization: Token <token>` header).
- Helpers use `browser.storage.sync` for persistent settings (`vikunjaUrl`, `vikunjaToken`, `defaultTags`) and throw if missing.

## Developer workflows (explicit)
- Install dependencies for development (Fuse is the only declared dependency):
  - `npm install` — ensures `node_modules` available for editor tooling (no build step required by extension files themselves).
- Test in Thunderbird: open Thunderbird's Developer Tools / Debug Add-ons (Debug Add-ons or about:debugging in browser) and "Load Temporary Add-on" pointing to the extension directory or generated `.xpi`.
  - The README instructs testing in Thunderbird’s debug mode; load `manifest.json` or an `.xpi` built by packaging the folder.
- When changing UI files, reload the add-on in Thunderbird to see updates.

## Patterns & project-specific conventions
- Background-first model: put permission-sensitive operations (reading message attachments) and network requests inside `background.js`. UI pages collect metadata and request background to perform the upload.
- Use `browser.storage.local` to serialize complex objects for dialog windows instead of passing large objects directly through `postMessage`.
- Utilities are attached to `window` in `utils.js` for pages (not via modules). Follow that pattern rather than converting to ES modules without coordinating changes across pages.
- Error & notifications: call `showNotification` / `showError` / `showSuccess` via utilities — check `utils.js` for exact functions and message area IDs.

## Message examples (use exact action names)
- Quick selection -> background:
  - browser.runtime.sendMessage({ action: 'quickUploadSelected', messageData, selectedAttachments })
- Advanced upload -> background:
  - browser.runtime.sendMessage({ action: 'uploadWithOptions', messageData, attachmentData, uploadOptions })
- Background exposes endpoints for UI lists:
  - browser.runtime.sendMessage({ action: 'getCorrespondents' }) // responds with correspondents list

## Small gotchas & verification steps
- Ensure `vikunjaUrl` and `vikunjaToken` are configured in the add-on options (`options.html` / `options.js`) before attempting uploads — background code checks these and will notify if missing.
- Network calls use fetch; background adds `Authorization: Token <token>` header. Confirm host permissions in `manifest.json` for any Vikunja host used during testing.
- When changing inter-window message shapes, update both sender and `background.js` handlers; the listeners rely on specific property names (e.g., `messageData`, `attachmentData`, `uploadOptions`).

## Where to look for examples
- Full upload flow (background + dialog): `background.js` (handlers and `uploadToVikunja`) and `upload-dialog.js` (UI + metadata assembly).
- Quick upload selection flow: `background.js` (processQuickUpload/openAttachmentSelectionDialog) and `select-attachments.js` (selection UI).
- API helpers and storage functions: `utils.js`.

If anything above is unclear or you want additional examples (e.g., fleshed-out message payload shapes or a short unit-test harness suggestion), tell me which part to expand and I will iterate.
