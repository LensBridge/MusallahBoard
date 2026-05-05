/**
 * =====================================================
 * Cookie Management Utilities
 * =====================================================
 */

/**
 * Set a cookie
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration (default: 365)
 */
export function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

/**
 * Get a cookie value
 * @param {string} name - Cookie name
 * @returns {string | null} Cookie value or null if not found
 */
export function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Delete a cookie
 * @param {string} name - Cookie name
 */
export function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Check if setup has been completed
 * @returns {boolean}
 */
export function isSetupComplete() {
  const boardLocation = getCookie('boardLocation');
  const weatherApiKey = getCookie('weatherApiKey');
  return !!(boardLocation && weatherApiKey);
}

/**
 * Get all setup configuration
 * @returns {{boardLocation: string | null, weatherApiKey: string | null, hideCursor: boolean}}
 */
export function getSetupConfig() {
  const hideCursorRaw = getCookie('hideCursor');
  return {
    boardLocation: getCookie('boardLocation'),
    weatherApiKey: getCookie('weatherApiKey'),
    // Default to true (cursor hidden) when unset — kiosks are the common case
    hideCursor: hideCursorRaw === null ? true : hideCursorRaw === 'true'
  };
}

/**
 * Save setup configuration
 * @param {{boardLocation: string, weatherApiKey: string, hideCursor?: boolean}} config
 */
export function saveSetupConfig(config) {
  setCookie('boardLocation', config.boardLocation);
  setCookie('weatherApiKey', config.weatherApiKey);
  if (typeof config.hideCursor === 'boolean') {
    setCookie('hideCursor', String(config.hideCursor));
  }
}

/**
 * Apply the saved cursor-visibility preference to <body>.
 * Called on boot and after the setup modal closes.
 */
export function applyCursorPreference() {
  const { hideCursor } = getSetupConfig();
  document.body.classList.toggle('cursor-hidden', hideCursor);
}
