/**
 * Vikunja Uploader for Thunderbird - Message Display Popup
 * 
 * Copyright (c) 2024 Sebastian Jung (https://github.com/sebastian-xyz/paperless-upload-thunderbird)
 * Copyright (c) 2025 Wulf C. Krueger
 * 
 * Licensed under the MIT License. See LICENSE file for details.
 * 
 * This work is heavily based upon paperless-upload-thunderbird by Sebastian Jung.
 */

document.addEventListener('DOMContentLoaded', async function () {
  const quickUploadBtn = document.getElementById('quick-upload-btn');
  const advancedUploadBtn = document.getElementById('advanced-upload-btn');
  const errorContainer = document.getElementById('error-container');

  quickUploadBtn.addEventListener('click', async () => {
    await handleQuickUpload(errorContainer);
  });

  advancedUploadBtn.addEventListener('click', async () => {
    await handleAdvancedUpload(errorContainer);
  });
});

async function handleQuickUpload(errorContainer) {
  try {
    clearError(errorContainer);
    
    // Get the displayed message directly
    const message = await getDisplayedMessage();

    if (!message) {
      showError(errorContainer, 'No message is currently displayed');
      return;
    }

    // Send message to background script for quick upload
    await browser.runtime.sendMessage({
      action: 'quickUploadFromDisplay',
      messageId: message.id
    });

    // Close the popup
    window.close();
  } catch (error) {
    console.error('Error in quick upload:', error);
    showError(errorContainer, 'Error initiating quick upload: ' + error.message);
  }
}

async function handleAdvancedUpload(errorContainer) {
  try {
    clearError(errorContainer);
    
    // Get the displayed message directly
    const message = await getDisplayedMessage();

    if (!message) {
      showError(errorContainer, 'No message is currently displayed');
      return;
    }

    // Send message to background script for advanced upload
    await browser.runtime.sendMessage({
      action: 'advancedUploadFromDisplay',
      messageId: message.id
    });

    // Close the popup
    window.close();
  } catch (error) {
    console.error('Error in advanced upload:', error);
    showError(errorContainer, 'Error initiating advanced upload: ' + error.message);
  }
}

async function getDisplayedMessage() {
  try {
    // First try the newer API
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (tabs && tabs.length > 0) {
      const messageList = await browser.messageDisplay.getDisplayedMessages(tabs[0].id);
      
      if (messageList && messageList.messages && messageList.messages.length > 0) {
        return messageList.messages[0];
      }
    }
    
    // Fallback: try getting message from the current tab context
    const currentTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
    
    if (currentTabs && currentTabs.length > 0) {
      const messageList = await browser.messageDisplay.getDisplayedMessage(currentTabs[0].id);
      if (messageList) {
        return messageList;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting displayed message:', error);
    return null;
  }
}

async function getCurrentTab() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

function showError(container, message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  clearError(container);
  container.appendChild(errorDiv);
}

function clearError(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}
