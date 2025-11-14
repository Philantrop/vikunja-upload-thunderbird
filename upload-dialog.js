/**
 * Vikunja Uploader for Thunderbird - Advanced Upload Dialog
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
let selectedLabels = [];
let availableLabels = [];
let fuse = null;

document.addEventListener('DOMContentLoaded', async function () {
  await loadUploadData();
  setupEventListeners();
  await loadVikunjaData();
});

async function loadUploadData() {
  try {
    const result = await browser.storage.local.get('currentUploadData');
    const uploadData = result.currentUploadData;

    if (!uploadData) {
      showError("No upload data found. Please try again.");
      return;
    }

    currentMessage = uploadData.message;
    currentAttachments = uploadData.attachments;

    // Populate email info
    document.getElementById('emailFrom').textContent = currentMessage.author;
    document.getElementById('emailSubject').textContent = currentMessage.subject;
    document.getElementById('emailDate').textContent = new Date(currentMessage.date).toLocaleDateString();

    // Populate file list
    const fileList = document.getElementById('fileList');
    if (currentAttachments.length > 0) {
      currentAttachments.forEach(attachment => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.textContent = `📄 ${attachment.name} (${browser.messengerUtilities.formatFileSize(attachment.size)})`;
        fileList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.textContent = 'ℹ️ No attachments (task will be created from email metadata)';
      li.style.fontStyle = 'italic';
      fileList.appendChild(li);
    }

    // Set default title to email subject
    document.getElementById('taskTitle').value = currentMessage.subject || 'Task from email';

    // Show main content
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

  } catch (error) {
    console.error('Error loading upload data:', error);
    showError('Error loading data: ' + error.message);
  }
}

async function loadVikunjaData() {
  try {
    // Load settings
    const settings = await getVikunjaSettings();

    // Fetch labels from Vikunja API if settings are available
    let labels = [];
    if (settings.vikunjaUrl && settings.vikunjaToken) {
      try {
        const response = await makeVikunjaRequest('/api/v1/labels', {}, settings);
        if (response.ok) {
          const data = await response.json();
          // Store labels for autocomplete
          labels = data.map(l => ({ id: l.id, name: l.title, hexColor: l.hex_color }));
        }
      } catch (err) {
        console.error('Failed to fetch labels from Vikunja:', err);
      }
    }

    if (labels.length > 0) {
      availableLabels = labels;
      // Initialize Fuse.js for fuzzy search
      fuse = new Fuse(availableLabels, {
        keys: ['name'],
        threshold: 0.3
      });
    }

  } catch (error) {
    console.error('Error loading Vikunja data:', error);
    // Continue without the data - it's not critical for basic upload
  }
}

function setupEventListeners() {
  // Form submission
  document.getElementById('uploadForm').addEventListener('submit', handleUpload);

  // Cancel button
  document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
  });

  // Labels input
  const labelInput = document.querySelector('.tag-input');
  labelInput.addEventListener('keydown', handleLabelInput);
  labelInput.addEventListener('input', handleLabelAutocomplete);

  // Hide suggestions when clicking outside
  document.addEventListener('click', function (event) {
    const labelsContainer = document.getElementById('labelsInput');
    if (!labelsContainer.contains(event.target)) {
      hideSuggestions();
    }
  });
}

function handleLabelInput(event) {
  if (event.key === 'Enter') {
    event.preventDefault();

    // If a suggestion is selected, use it
    const suggestions = document.querySelectorAll('.suggestion-item');
    if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
      const selectedLabel = suggestions[selectedSuggestionIndex].textContent;
      addLabel(selectedLabel);
      event.target.value = '';
      hideSuggestions();
      return;
    }

    // Otherwise, use the input value to create a new label
    const labelValue = event.target.value.trim();
    if (labelValue && !selectedLabels.find(l => l.name === labelValue)) {
      addLabel(labelValue);
      event.target.value = '';
      hideSuggestions();
    }
  } else if (event.key === 'Backspace' && event.target.value === '') {
    // Remove last label on backspace if input is empty
    if (selectedLabels.length > 0) {
      removeLabel(selectedLabels[selectedLabels.length - 1].name);
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateSuggestions(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateSuggestions(-1);
  } else if (event.key === 'Escape') {
    hideSuggestions();
  }
}

function handleLabelAutocomplete(event) {
  const query = event.target.value.trim();

  if (query.length === 0) {
    hideSuggestions();
    return;
  }

  if (fuse) {
    const results = fuse.search(query);
    showSuggestions(results.map(result => result.item), query);
  }
}

function addLabel(labelName) {
  // Check if label already exists in availableLabels
  const existingLabel = availableLabels.find(l => l.name === labelName);
  
  if (!selectedLabels.find(l => l.name === labelName)) {
    if (existingLabel) {
      selectedLabels.push(existingLabel);
    } else {
      // New label - will be created in Vikunja during upload
      selectedLabels.push({ name: labelName, isNew: true });
    }
    renderLabels();
  }
}

function removeLabel(labelName) {
  selectedLabels = selectedLabels.filter(label => label.name !== labelName);
  renderLabels();
}

function renderLabels() {
  const labelsContainer = document.getElementById('labelsInput');
  const labelInput = labelsContainer.querySelector('.tag-input');

  // Remove existing label elements
  labelsContainer.querySelectorAll('.tag-item').forEach(el => el.remove());

  // Add label elements
  selectedLabels.forEach(label => {
    const labelElement = document.createElement('div');
    labelElement.className = 'tag-item';
    
    // Apply label color if available
    if (label.hexColor) {
      labelElement.style.backgroundColor = label.hexColor;
    } else if (label.isNew) {
      labelElement.style.backgroundColor = '#6c757d'; // Gray for new labels
    }

    const labelText = document.createTextNode(label.name);
    labelElement.appendChild(labelText);

    const removeButton = document.createElement('span');
    removeButton.className = 'tag-remove';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => removeLabel(label.name));

    labelElement.appendChild(removeButton);
    labelsContainer.insertBefore(labelElement, labelInput);
  });
}

let selectedSuggestionIndex = -1;

function showSuggestions(labels, query) {
  hideSuggestions();

  if (labels.length === 0) return;

  const suggestionsContainer = document.getElementById('labelSuggestions');
  selectedSuggestionIndex = -1;

  // Filter out already selected labels
  const filteredLabels = labels.filter(label => !selectedLabels.find(l => l.name === label.name));

  if (filteredLabels.length === 0) return;

  // Show up to 5 suggestions
  const labelsToShow = filteredLabels.slice(0, 5);

  labelsToShow.forEach((label, index) => {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';

    // Create text with highlighted matching text safely
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    const parts = label.name.split(regex);

    parts.forEach(part => {
      if (part.toLowerCase() === query.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.textContent = part;
        suggestionItem.appendChild(mark);
      } else {
        suggestionItem.appendChild(document.createTextNode(part));
      }
    });

    suggestionItem.addEventListener('click', () => {
      addLabel(label.name);
      const labelInput = document.querySelector('.tag-input');
      labelInput.value = '';
      hideSuggestions();
      labelInput.focus();
    });

    suggestionsContainer.appendChild(suggestionItem);
  });

  suggestionsContainer.style.display = 'block';
}

function hideSuggestions() {
  const suggestionsContainer = document.getElementById('labelSuggestions');
  while (suggestionsContainer.firstChild) {
    suggestionsContainer.removeChild(suggestionsContainer.firstChild);
  }
  suggestionsContainer.style.display = 'none';
  selectedSuggestionIndex = -1;
}

function navigateSuggestions(direction) {
  const suggestions = document.querySelectorAll('.suggestion-item');
  if (suggestions.length === 0) return;

  // Remove current selection
  if (selectedSuggestionIndex >= 0) {
    suggestions[selectedSuggestionIndex].classList.remove('selected');
  }

  // Update index
  selectedSuggestionIndex += direction;

  if (selectedSuggestionIndex < 0) {
    selectedSuggestionIndex = suggestions.length - 1;
  } else if (selectedSuggestionIndex >= suggestions.length) {
    selectedSuggestionIndex = 0;
  }

  // Add selection to new item
  suggestions[selectedSuggestionIndex].classList.add('selected');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function handleUpload(event) {
  event.preventDefault();

  const uploadBtn = document.getElementById('uploadBtn');
  const originalText = setButtonLoading(uploadBtn, '⏳ Uploading...');

  try {
    clearMessages();

    // Collect form data
    const formData = new FormData(event.target);

    const uploadOptions = {};

    const title = formData.get('title');
    if (title) uploadOptions.title = title;

    // Add labels (will be created if they don't exist)
    if (selectedLabels.length > 0) {
      uploadOptions.labels = selectedLabels.map(l => l.name);
    }

    // Add priority
    const priority = formData.get('priority');
    if (priority) uploadOptions.priority = parseInt(priority);

    // Add due date
    const dueDate = formData.get('dueDate');
    if (dueDate) uploadOptions.dueDate = new Date(dueDate).toISOString();

    // Upload all attachments using background.js - background will create single task with all files
    try {
      await browser.runtime.sendMessage({
        action: 'uploadWithOptions',
        messageData: currentMessage,
        attachmentData: currentAttachments,
        uploadOptions: uploadOptions
      });
      // Background script handles all success/error notifications
    } catch (error) {
      console.error(`Error sending upload message:`, error);
      showError('Error sending upload request: ' + error.message);
    }

    // Show completion message and close dialog
    const attachmentMsg = currentAttachments.length > 0 
      ? `Upload request sent for ${currentAttachments.length} file(s). Check notifications for results.`
      : 'Upload request sent. Check notifications for results.';
    showSuccess(attachmentMsg);
    closeWindowWithDelay(2000);

  } catch (error) {
    console.error('Upload form error:', error);
    showError('Error processing upload form: ' + error.message);
  } finally {
    resetButtonLoading(uploadBtn, originalText);
  }
}

// Make removeLabel available globally for the label elements
window.removeLabel = removeLabel;