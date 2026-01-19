/**
 * =====================================================
 * Setup Screen Manager
 * =====================================================
 * Handles first-time setup and configuration modal
 * =====================================================
 */

import { isSetupComplete, saveSetupConfig, getSetupConfig } from './utils/cookies.js';

let setupModal = null;

/**
 * Initialize setup screen functionality
 */
export function initSetupScreen() {
  // Check if this is first time (no setup complete)
  if (!isSetupComplete()) {
    showSetupModal();
  }

  // Add keyboard shortcut listener (Alt + Shift + F)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      showSetupModal();
    }
  });
}

/**
 * Show the setup modal
 */
export function showSetupModal() {
  if (!setupModal) {
    createSetupModal();
  }

  // Pre-fill with existing values if available
  const config = getSetupConfig();
  if (config.boardLocation) {
    document.getElementById('setupBoardLocation').value = config.boardLocation;
  }
  if (config.weatherApiKey) {
    document.getElementById('setupWeatherApiKey').value = config.weatherApiKey;
  }

  setupModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Hide the setup modal
 */
export function hideSetupModal() {
  if (setupModal) {
    setupModal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Create the setup modal DOM elements
 */
function createSetupModal() {
  setupModal = document.createElement('div');
  setupModal.id = 'setupModal';
  setupModal.className = 'setup-modal';
  
  setupModal.innerHTML = `
    <div class="setup-modal-overlay"></div>
    <div class="setup-modal-content">
      <div class="setup-modal-header">
        <h2 class="setup-modal-title">⚙️ Board Setup</h2>
        <p class="setup-modal-subtitle">Configure your MusallahBoard settings</p>
      </div>
      
      <form class="setup-form" id="setupForm">
        <div class="setup-form-group">
          <label for="setupBoardLocation" class="setup-label">
            Board Location
            <span class="setup-required">*</span>
          </label>
          <select id="setupBoardLocation" name="boardLocation" class="setup-input" required>
            <option value="">Select location...</option>
            <option value="sisters">Sisters</option>
            <option value="brothers">Brothers</option>
          </select>
        </div>

        <div class="setup-form-group">
          <label for="setupWeatherApiKey" class="setup-label">
            Weather API Key
            <span class="setup-required">*</span>
          </label>
          <div class="setup-input-wrapper">
            <input 
              type="password" 
              id="setupWeatherApiKey" 
              name="weatherApiKey" 
              class="setup-input setup-input-with-icon" 
              placeholder="Enter your weather API key"
              required
            />
            <button type="button" class="setup-toggle-visibility" id="toggleApiKeyBtn" aria-label="Toggle API key visibility">
              <svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path class="eye-open" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle class="eye-open" cx="12" cy="12" r="3"></circle>
                <path class="eye-closed" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" style="display:none;"></path>
                <line class="eye-closed" x1="1" y1="1" x2="23" y2="23" style="display:none;"></line>
              </svg>
            </button>
          </div>
          <small class="setup-help-text">
            Get your free API key from <a href="https://openweathermap.org/api" target="_blank">OpenWeatherMap</a>
          </small>
        </div>

        <div class="setup-form-actions">
          <button type="button" class="setup-btn setup-btn-cancel" id="setupCancelBtn">
            Cancel
          </button>
          <button type="submit" class="setup-btn setup-btn-save">
            Save Configuration
          </button>
        </div>
      </form>

      <div class="setup-keyboard-hint">
        <small>💡 Tip: Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> to reopen this setup anytime</small>
      </div>
    </div>
  `;

  document.body.appendChild(setupModal);

  // Add event listeners
  const form = document.getElementById('setupForm');
  const cancelBtn = document.getElementById('setupCancelBtn');
  const overlay = setupModal.querySelector('.setup-modal-overlay');

  form.addEventListener('submit', handleSetupSubmit);
  cancelBtn.addEventListener('click', handleSetupCancel);
  overlay.addEventListener('click', handleSetupCancel);
  
  // Toggle API key visibility
  const toggleBtn = document.getElementById('toggleApiKeyBtn');
  toggleBtn.addEventListener('click', toggleApiKeyVisibility);
}

/**
 * Handle setup form submission
 * @param {Event} e
 */
function handleSetupSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const config = {
    boardLocation: formData.get('boardLocation'),
    weatherApiKey: formData.get('weatherApiKey')
  };

  // Validate
  if (!config.boardLocation || !config.weatherApiKey) {
    alert('Please fill in all required fields');
    return;
  }

  // Save configuration
  saveSetupConfig(config);

  // Close modal
  hideSetupModal();

  // Show success message
  showSuccessToast('Configuration saved successfully! Reloading...');

  // Reload page to apply new configuration
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

/**
 * Handle setup cancel
 */
function handleSetupCancel() {
  // Only allow cancel if setup is already complete
  if (isSetupComplete()) {
    hideSetupModal();
  } else {
    const confirmed = confirm(
      'Setup is required to use the board. Are you sure you want to cancel?'
    );
    if (confirmed) {
      hideSetupModal();
    }
  }
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  const input = document.getElementById('setupWeatherApiKey');
  const btn = document.getElementById('toggleApiKeyBtn');
  const eyeOpen = btn.querySelectorAll('.eye-open');
  const eyeClosed = btn.querySelectorAll('.eye-closed');
  
  if (input.type === 'password') {
    input.type = 'text';
    eyeOpen.forEach(el => el.style.display = 'none');
    eyeClosed.forEach(el => el.style.display = 'block');
  } else {
    input.type = 'password';
    eyeOpen.forEach(el => el.style.display = 'block');
    eyeClosed.forEach(el => el.style.display = 'none');
  }
}

/**
 * Show success toast notification
 * @param {string} message
 */
function showSuccessToast(message) {
  const toast = document.createElement('div');
  toast.className = 'setup-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
