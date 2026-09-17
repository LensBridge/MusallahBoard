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
  return isValidDeviceId(getCookie('deviceId'));
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The backend keys every board read on a UUID, so anything else is garbage. */
export function isValidDeviceId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Settle the board's identity and return it, or null if unpaired.
 *
 * Must run BEFORE the first React render. The agent provisions a board by
 * navigating to `<board-url>?deviceId=<uuid>`; if that reconciliation happens
 * in an effect it lands after paint, and the board flashes its unpaired screen
 * on every healthy cold boot.
 *
 * A malformed id is dropped rather than persisted — storing it would leave the
 * board 404ing against the backend forever with no way to tell why.
 */
export function resolveDeviceId() {
  const fromQuery = getDeviceIdFromQuery();

  if (fromQuery !== null) {
    // Strip the param either way: valid ones are now in the cookie, and a bad
    // one shouldn't linger in the address bar or survive a reload.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('deviceId');
      window.history.replaceState({}, '', u);
    } catch { /* non-fatal */ }

    if (isValidDeviceId(fromQuery)) {
      setDeviceId(fromQuery);
      return fromQuery.trim();
    }
    console.warn(`Ignoring malformed deviceId in URL: ${fromQuery}`);
  }

  const stored = getCookie('deviceId');
  return isValidDeviceId(stored) ? stored.trim() : null;
}

export function applyCursorPreference() {
  document.body.classList.toggle('cursor-hidden', getSetupConfig().hideCursor);
}
