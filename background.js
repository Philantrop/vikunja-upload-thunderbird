/**
 * Vikunja Uploader for Thunderbird - Background Script
 * 
 * Copyright (c) 2024 Sebastian Jung (https://github.com/sebastian-xyz/paperless-upload-thunderbird)
 * Copyright (c) 2025 Wulf C. Krueger
 * 
 * Licensed under the MIT License. See LICENSE file for details.
 * 
 * This work is heavily based upon paperless-upload-thunderbird by Sebastian Jung.
 */

let currentAttachments = [];
let currentMessage = null;

// Create context menus for attachments
browser.runtime.onInstalled.addListener(async () => {
  try {
    // Remove all existing menus first to avoid conflicts
    await browser.menus.removeAll();

    // Message list context menus - guard each create call so an exception
    // won't abort background script initialization.
    try {
      browser.menus.create({
        id: "quick-upload-vikunja",
        title: "Quick Upload to Vikunja",
        contexts: ["message_list"],
        icons: {
          "32": "icons/icon-32.png",
          "16": "icons/icon-16.png",
          "64": "icons/icon-64.png",
          "128": "icons/icon-128.png"
        }
      });
    } catch (err) {
      console.error('Failed to create quick upload menu:', err);
    }

    try {
      browser.menus.create({
        id: "advanced-upload-vikunja",
        title: "Upload to Vikunja (with options)...",
        contexts: ["message_list"],
        icons: {
          "32": "icons/icon-32.png",
          "16": "icons/icon-16.png",
          "64": "icons/icon-64.png",
          "128": "icons/icon-128.png"
        }
      });
    } catch (err) {
      console.error('Failed to create advanced upload menu:', err);
    }

    try {
      browser.menus.create({
        id: "separator",
        type: "separator",
        contexts: ["message_list"]
      });
    } catch (err) {
      // Non-fatal: separator failed
      console.warn('Failed to create menu separator:', err);
    }
  } catch (err) {
    console.error('Error during onInstalled initialization:', err);
  }
});

// Handle context menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
  // Message list context menu handlers
  if (info.menuItemId === "quick-upload-vikunja") {
    await handleQuickUpload(info);
  } else if (info.menuItemId === "advanced-upload-vikunja") {
    await handleAdvancedUpload(info);
  }
});

async function handleQuickUpload(info) {
  try {
    const messages = info.selectedMessages.messages;
    if (!messages || messages.length === 0) {
      showNotification("No messages selected", "error");
      return;
    }

    // Process each selected message for attachments
    for (const message of messages) {
      await processQuickUpload(message);
    }
  } catch (error) {
    console.error("Error handling quick upload:", error);
    showNotification("Error processing attachments", "error");
  }
}

async function handleAdvancedUpload(info) {
  try {
    const messages = info.selectedMessages.messages;
    if (!messages || messages.length === 0) {
      showNotification("No messages selected", "error");
      return;
    }

    // For now, just handle the first message (can be extended)
    const message = messages[0];

    // Get all attachments
    const attachments = await browser.messages.listAttachments(message.id);

    // Allow creating tasks even without attachments
    // Store current data for the dialog
    currentMessage = message;
    currentAttachments = attachments;

    // Open the advanced upload dialog
    await openAdvancedUploadDialog(message, attachments);

  } catch (error) {
    console.error("Error handling advanced upload:", error);
    showNotification("Error processing attachments", "error");
  }
}

async function processQuickUpload(message) {
  try {
    const attachments = await browser.messages.listAttachments(message.id);

    // If there are no attachments, create task from email metadata only
    if (attachments.length === 0) {
      await uploadToVikunja(message, null, { mode: 'quick' });
      return;
    }

    // If there's only one attachment, upload directly
    if (attachments.length === 1) {
      await uploadToVikunja(message, attachments[0], { mode: 'quick' });
      return;
    }

    // If there are multiple attachments, show selection dialog
    await openAttachmentSelectionDialog(message, attachments);

  } catch (error) {
    console.error("Error processing attachments:", error);
    showNotification(`Error processing attachments: ${error.message}`, "error");
  }
}

async function openAttachmentSelectionDialog(message, attachments) {
  try {
    // Store data for the dialog to access
    await browser.storage.local.set({
      quickUploadData: {
        message: {
          id: message.id,
          subject: message.subject,
          author: message.author,
          date: message.date
        },
        attachments: attachments.map(att => ({
          name: att.name,
          partName: att.partName,
          size: att.size
        }))
      }
    });

    // Open the selection dialog
    const dialogUrl = browser.runtime.getURL("select-attachments.html");
    browser.windows.create({
      url: dialogUrl,
      type: "popup",
      width: 500,
      height: 600
    });
  } catch (error) {
    console.error("Error opening attachment selection dialog:", error);
    showNotification("Error opening attachment selection dialog", "error");
  }
}

async function openAdvancedUploadDialog(message, attachments) {
  // Create a new window/tab for the upload dialog
  const dialogUrl = browser.runtime.getURL("upload-dialog.html");

  try {
    // Store data for the dialog to access
    await browser.storage.local.set({
      currentUploadData: {
        message: {
          id: message.id,
          subject: message.subject,
          author: message.author,
          date: message.date
        },
        attachments: attachments.map(att => ({
          name: att.name,
          partName: att.partName,
          size: att.size
        }))
      }
    });

    // Open the dialog
    browser.windows.create({
      url: dialogUrl,
      type: "popup",
      width: 550,
      height: 700
    });
  } catch (error) {
    console.error("Error opening dialog:", error);
    showNotification("Error opening upload dialog", "error");
  }
}

async function uploadToVikunja(message, attachment, options = {}) {
  try {
    // Prefer Vikunja if configured; fall back to Paperless-ngx behaviour if not.
    const vikunjaConfig = await getVikunjaConfig();
    if (vikunjaConfig.url && vikunjaConfig.token) {
      // Vikunja flow: create a task, then attach the file(s) to the task
      try {
        const uploadMode = options.mode || 'quick';
        // Handle null attachment (no attachments case)
        const attachments = attachment ? (Array.isArray(attachment) ? attachment : [attachment]) : [];
        
        // Prefill task title with email metadata
        let title;
        if (uploadMode === 'quick') {
          // Quick upload: use subject only (no "From:" prefix)
          title = message.subject || 'Unnamed Task';
        } else {
          // Advanced upload: use provided title or fallback
          title = options.title || message.subject || 'Unnamed Task';
        }
        
        const attachmentCount = attachments.length;
        const attachmentMsg = attachmentCount > 0 ? ` with ${attachmentCount} attachment(s)` : ' (no attachments)';
        showNotification(`Creating Vikunja task "${title}"${attachmentMsg}...`, "info");

        // Get full message to extract HTML body
        const fullMessage = await browser.messages.getFull(message.id);
        let htmlBody = '';
        
        // Extract HTML body from message parts
        function extractHtmlBody(part) {
          if (part.contentType && part.contentType.startsWith('text/html') && part.body) {
            return part.body;
          }
          if (part.parts) {
            for (const subPart of part.parts) {
              const result = extractHtmlBody(subPart);
              if (result) return result;
            }
          }
          return null;
        }
        
        htmlBody = extractHtmlBody(fullMessage) || '';

        // Convert label names to label objects (Vikunja expects {title: "name"} format)
        let labelObjects = [];
        if (options.labels && options.labels.length > 0) {
          labelObjects = options.labels.map(labelName => ({ title: labelName }));
        }

        // Build task payload with title, description, start date, priority, due date, and labels
        // Vikunja API format: projectId in camelCase for v1.0.0-rc2+
        const taskPayload = { 
          title,
          ...(htmlBody && { description: htmlBody }),
          ...(message.date && { start_date: new Date(message.date).toISOString() }),
          ...(options.priority !== undefined && { priority: options.priority }),
          ...(options.dueDate && { due_date: options.dueDate }),
          projectId: parseInt(vikunjaConfig.projectId),
          ...(labelObjects.length > 0 && { labels: labelObjects })
        };

        // For Vikunja RC2+, tasks are created under project endpoint
        const taskUrl = `${vikunjaConfig.url}/api/v1/projects/${vikunjaConfig.projectId}/tasks`;
        
        // Remove projectId from payload since it's in the URL now
        const { projectId, ...taskData } = taskPayload;

        // Create task using PUT to /api/v1/projects/{id}/tasks endpoint (Vikunja RC2+)
        const createResp = await fetch(taskUrl, {
          method: 'PUT',
          mode: 'cors',
          headers: {
            'Authorization': `Bearer ${vikunjaConfig.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        });

        if (!createResp.ok) {
          const errText = await createResp.text();
          console.error('Vikunja API Error Response:', errText);
          throw new Error(`Task creation failed: HTTP ${createResp.status}: ${errText}`);
        }

        const created = await createResp.json();
        const taskId = created.id || created.task?.id || null;
        if (!taskId) throw new Error('No task id returned from Vikunja');

        // Assign labels to the task if any were provided
        if (options.labels && options.labels.length > 0) {
          try {
            // First, get or create labels
            const labelIds = [];
            for (const labelName of options.labels) {
              // Check if label exists
              const labelsResp = await fetch(`${vikunjaConfig.url}/api/v1/labels`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                  'Authorization': `Bearer ${vikunjaConfig.token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (labelsResp.ok) {
                const allLabels = await labelsResp.json();
                let labelId = allLabels.find(l => l.title === labelName)?.id;
                
                // Create label if it doesn't exist
                if (!labelId) {
                  const createLabelResp = await fetch(`${vikunjaConfig.url}/api/v1/labels`, {
                    method: 'PUT',
                    mode: 'cors',
                    headers: {
                      'Authorization': `Bearer ${vikunjaConfig.token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: labelName })
                  });
                  
                  if (createLabelResp.ok) {
                    const newLabel = await createLabelResp.json();
                    labelId = newLabel.id;
                  }
                }
                
                if (labelId) labelIds.push(labelId);
              }
            }
            
            // Assign labels to task
            for (const labelId of labelIds) {
              await fetch(`${vikunjaConfig.url}/api/v1/tasks/${taskId}/labels`, {
                method: 'PUT',
                mode: 'cors',
                headers: {
                  'Authorization': `Bearer ${vikunjaConfig.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ label_id: labelId })
              });
            }
          } catch (labelErr) {
            console.error('Error assigning labels:', labelErr);
            // Don't fail the whole upload if labels fail
          }
        }

        // Upload all attachments to the task (if any)
        const attachmentNames = [];
        for (const att of attachments) {
          try {
            const attachmentData = await browser.messages.getAttachmentFile(
              message.id,
              att.partName
            );

            const formData = new FormData();
            formData.append('files', attachmentData, att.name);

            // Vikunja RC2 uses PUT method for attachments
            const attachResp = await fetch(`${vikunjaConfig.url}/api/v1/tasks/${taskId}/attachments`, {
              method: 'PUT',
              mode: 'cors',
              headers: {
                'Authorization': `Bearer ${vikunjaConfig.token}`
              },
              body: formData
            });

            if (!attachResp.ok) {
              const errText = await attachResp.text();
              console.warn(`Failed to attach ${att.name}: HTTP ${attachResp.status}: ${errText}`);
            } else {
              attachmentNames.push(att.name);
            }
          } catch (attError) {
            console.warn(`Error attaching ${att.name}:`, attError);
          }
        }

        const successCount = attachmentNames.length;
        const resultMsg = attachmentCount > 0 
          ? `✅ Task created with ${successCount}/${attachmentCount} attachment(s)`
          : `✅ Task created successfully`;
        showNotification(resultMsg, "success");
        return { success: true, result: created, attachedCount: successCount };
      } catch (error) {
        console.error('Error uploading to Vikunja:', error);
        showNotification(`❌ Failed to create task: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    }

  } catch (error) {
    console.error("Error uploading:", error);
    showNotification(`❌ Failed to upload: ${error.message}`, "error");
    return { success: false, error: error.message };
  }
}

// Handle messages from the upload dialog
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "quickUploadFromDisplay") {
    await handleQuickUploadFromDisplay(message.messageId);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "advancedUploadFromDisplay") {
    await handleAdvancedUploadFromDisplay(message.messageId);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "quickUploadSelected") {
    try {
      const { messageData, selectedAttachments } = message;

      // Upload all selected attachments to a single task
      const result = await uploadToVikunja(
        messageData,
        selectedAttachments,
        { mode: 'quick' }
      );

      // Show summary notification
      if (result.success) {
            sendResponse({ success: true });
      } else {
            showNotification(`❌ Failed to upload: ${result.error}`, "error");
            sendResponse({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Error in quickUploadSelected:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }

  if (message.action === "uploadWithOptions") {
    (async () => {
      try {
        const { messageData, attachmentData, uploadOptions } = message;
        const isArray = Array.isArray(attachmentData);

        // Reconstruct message and attachment objects
        const messageObj = messageData;
        const attachmentObj = attachmentData;

        const result = await uploadToVikunja(
          messageObj,
          attachmentObj,
          { mode: 'advanced', ...uploadOptions }
        );

        // Ensure we always send a valid response
        if (result && typeof result === 'object' && result.hasOwnProperty('success')) {
          sendResponse(result);
        } else {
          console.error('Background: Invalid result, sending error response:', result);
          sendResponse({ success: false, error: "Invalid response from upload function" });
        }
      } catch (error) {
        console.error("Background: Error in upload with options:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep the message channel open for async response
  }

  if (message.action === "getCorrespondents") {
    try {
      const config = await getPaperlessConfig();
      const response = await fetch(`${config.url}/api/correspondents/`, {
        headers: { 'Authorization': `Token ${config.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        sendResponse({ success: true, correspondents: data.results });
      } else {
        sendResponse({ success: false, error: `HTTP ${response.status}` });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === "getDocumentTypes") {
    try {
      const config = await getPaperlessConfig();
      const response = await fetch(`${config.url}/api/document_types/`, {
        headers: { 'Authorization': `Token ${config.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        sendResponse({ success: true, document_types: data.results });
      } else {
        sendResponse({ success: false, error: `HTTP ${response.status}` });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (message.action === "getTags") {
    try {
      const config = await getPaperlessConfig();
      const response = await fetch(`${config.url}/api/tags/`, {
        headers: { 'Authorization': `Token ${config.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        sendResponse({ success: true, tags: data.results });
      } else {
        sendResponse({ success: false, error: `HTTP ${response.status}` });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

function extractCorrespondentFromEmail(emailString) {
  const match = emailString.match(/^(.+?)\s*<.+>$/);
  return match ? match[1].trim() : emailString.split('@')[0];
}

async function getPaperlessConfig() {
  const result = await browser.storage.sync.get(['paperlessUrl', 'paperlessToken', 'defaultTags']);
  return {
    url: result.paperlessUrl?.replace(/\/$/, ''),
    token: result.paperlessToken,
    defaultTags: result.defaultTags ? result.defaultTags.split(',').map(t => t.trim()) : []
  };
}

async function getVikunjaConfig() {
  const result = await browser.storage.sync.get(['vikunjaUrl', 'vikunjaToken', 'vikunjaProject', 'defaultTags']);
  const token = result.vikunjaToken ? result.vikunjaToken.trim() : '';
  return {
    url: result.vikunjaUrl?.replace(/\/$/, ''),
    token: token,
    projectId: result.vikunjaProject,
    defaultTags: result.defaultTags ? result.defaultTags.split(',').map(t => t.trim()) : []
  };
}

function showNotification(message, type = "info") {
  // const iconUrl = type === "error" ? "icons/error.png" :
  //   type === "success" ? "icons/success.png" : "icons/icon-32.png";
  const iconUrl = "icons/icon-32.png";

  browser.notifications.create({
    type: "basic",
    iconUrl: iconUrl,
    title: "📄 Vikunja Uploader",
    message: message
  });
}

// Handle quick upload from message display popup
async function handleQuickUploadFromDisplay(messageId) {
  try {
    const message = await browser.messages.get(messageId);
    await processQuickUpload(message);
  } catch (error) {
    console.error("Error handling quick upload from display:", error);
    showNotification("Error processing quick upload", "error");
  }
}

// Handle advanced upload from message display popup
async function handleAdvancedUploadFromDisplay(messageId) {
  try {
    const message = await browser.messages.get(messageId);

    // Get all attachments
    const attachments = await browser.messages.listAttachments(message.id);

    // Allow creating tasks even without attachments
    // Store current data for the dialog
    currentMessage = message;
    currentAttachments = attachments;

    // Open the advanced upload dialog
    await openAdvancedUploadDialog(message, attachments);
  } catch (error) {
    console.error("Error handling advanced upload from display:", error);
    showNotification("Error processing advanced upload", "error");
  }
}