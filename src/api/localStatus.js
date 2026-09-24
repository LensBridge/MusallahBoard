/**
 * =====================================================
 * Local Status (offline mode only)
 * =====================================================
 * In offline mode the device agent serves this page, and
 * the payload, from 127.0.0.1 off an installed content
 * bundle. GET /api/local/status says which bundle and how
 * fresh it is (agent/docs/offline.md, "Local HTTP
 * server"). It is the agent's, not LensBridge's, so it is
 * not in the OpenAPI schema: a plain same-origin fetch.
 *
 *   { mode, deviceId,
 *     bundle: { firstDay, lastDay, generatedAt, timezone } | null,
 *     today, servingDay, daysRemaining, staleDays }
 * =====================================================
 */

const TIMEOUT_MS = 5000;

/**
 * @typedef {Object} LocalStatus
 * @property {string} mode
 * @property {string} [deviceId]
 * @property {{firstDay:string,lastDay:string,generatedAt:string,timezone:string}|null} bundle
 * @property {string} [today]
 * @property {string} [servingDay]
 * @property {number} [daysRemaining]
 * @property {number} [staleDays]
 */

/**
 * Fetch the agent's bundle status. Never throws: the status only feeds the
 * staleness note and the diagnostics panel, and a board must keep showing its
 * payload even if the agent is too old to answer this.
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
