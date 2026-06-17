/**
 * Cookie helpers + kiosk setup persistence.
 * The board identifies itself to the backend by `deviceId`
 * (replaces the old per-location `boardLocation`).
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

/** @returns {{deviceId:string|null, hideCursor:boolean}} */
export function getSetupConfig() {
  const hideRaw = getCookie('hideCursor');
  return {
    deviceId: getCookie('deviceId'),
    // Kiosks are the common case → default to a hidden cursor.
    hideCursor: hideRaw === null ? true : hideRaw === 'true',
  };
}

export function saveSetupConfig({ deviceId, hideCursor }) {
  if (deviceId) setCookie('deviceId', deviceId);
  if (typeof hideCursor === 'boolean') setCookie('hideCursor', String(hideCursor));
}

export function isSetupComplete() {
  return !!getCookie('deviceId');
}

/**
 * Persist just the device id. Used by the headless provisioning path: the
 * device agent drives Chromium over the DevTools Protocol and calls
 * `window.MusallahBoard.setDeviceId(...)` (or sets the `deviceId` cookie /
 * `?deviceId=` query param) so the kiosk boots without any human touching
 * the setup screen.
 * @param {string} deviceId
 */
export function setDeviceId(deviceId) {
  if (deviceId) setCookie('deviceId', String(deviceId).trim());
}

/** Read a deviceId provided via the URL (`?deviceId=...`), if any. */
export function getDeviceIdFromQuery() {
  try {
    const v = new URLSearchParams(window.location.search).get('deviceId');
    return v ? v.trim() : null;
  } catch {
    return null;
  }
}

export function applyCursorPreference() {
  document.body.classList.toggle('cursor-hidden', getSetupConfig().hideCursor);
}
