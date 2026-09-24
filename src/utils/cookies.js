/**
 * Kiosk preferences, kept in a cookie on the agent's origin (127.0.0.1:8080).
 * Only the cursor preference lives here: who the board is comes from the
 * agent's /api/local/status, not from anything the page stores.
 */

export function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 864e5);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/`;
}

export function getCookie(name) {
  const nameEQ = `${name}=`;
  for (let c of document.cookie.split(';')) {
    c = c.trim();
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }
  return null;
}

/** @returns {boolean} */
export function getHideCursor() {
  const raw = getCookie('hideCursor');
  // Kiosks are the common case → default to a hidden cursor.
  return raw === null ? true : raw === 'true';
}

/** @param {boolean} hideCursor */
export function setHideCursor(hideCursor) {
  setCookie('hideCursor', String(Boolean(hideCursor)));
}

export function applyCursorPreference() {
  document.body.classList.toggle('cursor-hidden', getHideCursor());
}
