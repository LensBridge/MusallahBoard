/**
 * =====================================================
 * Local Status
 * =====================================================
 * The device agent serves this page, and the payload,
 * from 127.0.0.1:8080 off an installed content package. GET /api/local/status says who this board is,
 * what is installed and how fresh it is
 * (agent/docs/architecture.md, section 7). It is the
 * agent's, not LensBridge's, so it is not in the OpenAPI
 * schema: a plain same-origin fetch.
 *
 *   { localApi, agentVersion, deviceId,
 *     app: { version } | null,
 *     content: { sequence, createdAt, firstDay, lastDay,
 *                timezone, source, installedAt } | null,
 *     today, servingDay, daysRemaining, staleDays,
 *     sync: { enabled, lastSuccessAt, lastAttemptAt,
 *             lastError },
 *     update: { active },
 *     updates: { available: [{ type, version,
 *                description }], installTime,
 *                installAt, installing } }
 * =====================================================
 */

const TIMEOUT_MS = 5000;

/**
 * @typedef {Object} LocalContent
 * @property {string} firstDay
 * @property {string} lastDay
 * @property {string} [timezone]
 * @property {number} [sequence]
 * @property {string} [createdAt]
 * @property {string} [source]       sync | usb | upload | cli
 * @property {string} [installedAt]
 */

/**
 * @typedef {Object} LocalStatus
 * @property {number} [localApi]
 * @property {string} [agentVersion]
 * @property {string} [deviceId]
 * @property {{version:string}|null} [app]
 * @property {LocalContent|null} [content]
 * @property {string} [today]
 * @property {string|null} [servingDay]
 * @property {number|null} [daysRemaining]
 * @property {number|null} [staleDays]
 * @property {{enabled:boolean,lastSuccessAt:string|null,lastAttemptAt:string|null,lastError:string|null}} [sync]
 * @property {{active:boolean}} [update]
 * @property {boolean} [servicePort]  the ethernet upload page is on
 * @property {boolean} [usbImport]    USB sticks are read
 * @property {{source:string,trusted:boolean}} [clock]
 *   where the clock's time comes from (ntp, rtc, uploader, starting,
 *   unverified); trusted false means the board should say it may be wrong
 * @property {{available:{type:string,version:string,description:string}[],installTime:string,installAt:string|null,installing:boolean}} [updates]
 *   software waiting for the install window (utils/updates.js)
 * @property {string} [error]  installed content could not be read
 */

/**
 * Fetch the agent's status. Never throws: the status feeds the device id, the
 * waiting screen, the staleness note and the diagnostics panel, and a board
 * must keep showing its payload even if the agent cannot answer right now.
 * @returns {Promise<LocalStatus|null>}
 */
export async function getLocalStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/local/status', {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body && typeof body === 'object' ? body : null;
  } catch (e) {
    console.warn('local status fetch failed', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether the agent's `deviceId` is a real device id (a UUID). An agent that
 * is not enrolled yet has none, and the board then reports itself unpaired.
 * @param {unknown} value
 */
export function isValidDeviceId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}
