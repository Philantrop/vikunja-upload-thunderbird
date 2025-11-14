/**
 * Vikunja Uploader for Thunderbird - Popup Window
 * 
 * Copyright (c) 2024 Sebastian Jung (https://github.com/sebastian-xyz/paperless-upload-thunderbird)
 * Copyright (c) 2025 Wulf C. Krueger
 * 
 * Licensed under the MIT License. See LICENSE file for details.
 * 
 * This work is heavily based upon paperless-upload-thunderbird by Sebastian Jung.
 */

document.addEventListener('DOMContentLoaded', async function() {
  await updateStatus();
  
  document.getElementById('test-connection').addEventListener('click', testConnection);
  document.getElementById('open-options').addEventListener('click', openOptions);
});

async function updateStatus() {
  const config = await getVikunjaSettings();
  
  const urlStatus = document.getElementById('url-status');
  const tokenStatus = document.getElementById('token-status');
  
  urlStatus.className = `status-icon ${config.vikunjaUrl ? 'status-configured' : 'status-not-configured'}`;
  tokenStatus.className = `status-icon ${config.vikunjaToken ? 'status-configured' : 'status-not-configured'}`;
  
  const testBtn = document.getElementById('test-connection');
  testBtn.disabled = !config.vikunjaUrl || !config.vikunjaToken;
}

async function testConnection() {
  const config = await getVikunjaSettings();
  const testBtn = document.getElementById('test-connection');
  
  const originalText = setButtonLoading(testBtn, 'Testing...');
  
  try {
    const success = await testVikunjaConnection(config.vikunjaUrl, config.vikunjaToken);
    
    if (success) {
      testBtn.textContent = '✓ Connection Successful';
      testBtn.style.background = '#28a745';
      setTimeout(() => {
        resetButtonLoading(testBtn, originalText);
        testBtn.style.background = '#007bff';
      }, 2000);
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    testBtn.textContent = '✗ Connection Failed';
    testBtn.style.background = '#dc3545';
    console.error('Connection test failed:', error);
    setTimeout(() => {
      resetButtonLoading(testBtn, originalText);
      testBtn.style.background = '#007bff';
    }, 2000);
  }
}

function openOptions() {
  browser.runtime.openOptionsPage();
}