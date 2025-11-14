/**
 * Vikunja Uploader for Thunderbird - Options/Settings Page
 * 
 * Copyright (c) 2024 Sebastian Jung (https://github.com/sebastian-xyz/paperless-upload-thunderbird)
 * Copyright (c) 2025 Wulf C. Krueger
 * 
 * Licensed under the MIT License. See LICENSE file for details.
 * 
 * This work is heavily based upon paperless-upload-thunderbird by Sebastian Jung.
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSettings();

    // Attach event listeners after DOM is ready
    const form = document.getElementById('settingsForm');
    if (form) {
      form.addEventListener('submit', saveSettings);
    } else {
      console.warn('options.js: settingsForm not found on DOMContentLoaded');
    }
    
    const fetchBtn = document.getElementById('fetchProjects');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', fetchProjects);
    }
    
    // Auto-fetch projects when token is entered/changed
    const tokenEl = document.getElementById('vikunjaToken');
    const urlEl = document.getElementById('vikunjaUrl');
    if (tokenEl && urlEl) {
      const autoFetch = () => {
        const url = urlEl.value.trim();
        const token = tokenEl.value.trim();
        if (url && token) {
          fetchProjects(true); // Silent mode
        }
      };
      tokenEl.addEventListener('blur', autoFetch);
      urlEl.addEventListener('blur', autoFetch);
    }
  } catch (err) {
    console.error('Error initializing options page:', err);
  }
});

async function loadSettings() {
  const settings = await getVikunjaSettings();

  const urlEl = document.getElementById('vikunjaUrl');
  const tokenEl = document.getElementById('vikunjaToken');
  const projectEl = document.getElementById('vikunjaProject');
  const projectGroup = document.getElementById('projectSelectGroup');
  const tagsEl = document.getElementById('defaultTags');

  if (urlEl) urlEl.value = settings.vikunjaUrl || '';
  if (tokenEl) tokenEl.value = settings.vikunjaToken || '';
  if (tagsEl) tagsEl.value = settings.defaultTags || '';
  
  // If a project is already saved, show the selector and try to fetch projects
  if (settings.vikunjaProject && settings.vikunjaUrl && settings.vikunjaToken) {
    projectGroup.style.display = 'block';
    // Auto-fetch projects to populate the dropdown
    await fetchProjects();
  }
}


async function requestSitePermission(url) {
  // Normalize the origin to ensure it ends with /*
  const origin = url.replace(/\/?\*?$/, '/*');

  const hasPermission = await browser.permissions.contains({
    origins: [origin],
  });

  if (hasPermission) {
    // Permission already granted \u2014 safe to save and use the URL.
    return true;
  }

  const granted = await browser.permissions.request({
    origins: [origin],
  });

  // If not granted, it's not safe to save or use the URL,
  // since the user explicitly denied access.
  return granted;
}


async function saveSettings(event) {

  event.preventDefault();

  const vikunjaUrl = document.getElementById('vikunjaUrl').value.trim();
  const vikunjaToken = document.getElementById('vikunjaToken').value.trim();
  const vikunjaProject = document.getElementById('vikunjaProject').value.trim();
  const defaultTags = document.getElementById('defaultTags').value.trim();

  // Validate URL format
  if (vikunjaUrl && !isValidUrl(vikunjaUrl)) {
    showStatus('Please enter a valid URL (including http:// or https://)', 'error');
    return;
  }

  // Request permission for the URL if it's provided
  if (vikunjaUrl) {
    const permissionGranted = await requestSitePermission(vikunjaUrl);
    if (!permissionGranted) {
      showStatus('Permission to access the specified URL was denied. Please allow access to save the settings.', 'error');
      return;
    }
  }

  try {
    await browser.storage.sync.set({
      vikunjaUrl: vikunjaUrl.replace(/\/$/, ''), // Remove trailing slash
      vikunjaToken: vikunjaToken,
      vikunjaProject: vikunjaProject,
      defaultTags: defaultTags
    });

    showStatus('Settings saved successfully!', 'success');

    // Test connection if both URL and token are provided
    if (vikunjaUrl && vikunjaToken) {
      setTimeout(testConnection, 1000);
    }

  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
    console.error('Error saving settings:', error);
  }
}

async function testConnection() {
  const settings = await getVikunjaSettings();

  const success = await testVikunjaConnection(settings.vikunjaUrl, settings.vikunjaToken);

  if (success) {
    showStatus('Settings saved and connection test successful!', 'success');
  } else {
    showStatus('Settings saved but connection test failed', 'error');
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message status-${type}`;
  statusEl.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

async function fetchProjects(silent = false) {
  const urlEl = document.getElementById('vikunjaUrl');
  const tokenEl = document.getElementById('vikunjaToken');
  const projectSelect = document.getElementById('vikunjaProject');
  const projectGroup = document.getElementById('projectSelectGroup');
  const fetchBtnGroup = document.getElementById('fetchProjectsGroup');
  const fetchBtn = document.getElementById('fetchProjects');
  
  const url = urlEl.value.trim();
  const token = tokenEl.value.trim();
  
  if (!url || !token) {
    if (!silent) {
      showStatus('Please enter Vikunja URL and API Token first', 'error');
    }
    return;
  }
  
  // Disable button and show loading state
  fetchBtn.disabled = true;
  const originalText = fetchBtn.textContent;
  fetchBtn.textContent = 'Fetching...';
  
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/v1/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: HTTP ${response.status}`);
    }
    
    const projects = await response.json();
    
    // Clear existing options except the first one
    projectSelect.innerHTML = '<option value="">Select a project...</option>';
    
    // Add projects to dropdown
    if (projects && projects.length > 0) {
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.title || `Project ${project.id}`;
        projectSelect.appendChild(option);
      });
      
      // Show the project select group and hide fetch button
      projectGroup.style.display = 'block';
      fetchBtnGroup.style.display = 'none';
      
      // If there's a saved project, select it
      const settings = await getVikunjaSettings();
      if (settings.vikunjaProject) {
        projectSelect.value = settings.vikunjaProject;
      }
      
      if (!silent) {
        showStatus(`Loaded ${projects.length} project(s)`, 'success');
      }
    } else {
      if (!silent) {
        showStatus('No projects found', 'error');
      }
    }
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    if (!silent) {
      showStatus('Error fetching projects: ' + error.message, 'error');
    }
  } finally {
    // Re-enable button
    fetchBtn.disabled = false;
    fetchBtn.textContent = originalText;
  }
}