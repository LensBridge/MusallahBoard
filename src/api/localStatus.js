/**
 * =====================================================
 * Local Status (local runtime only)
 * =====================================================
 * On a board the device agent serves this page, and the
 * payload, from 127.0.0.1:8080 off an installed content
 * package. GET /api/local/status says who this board is,
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
 *     update: { active } }
 *
 * v1 agents answered with `bundle` (and `generatedAt`)
 * where v2 has `content` (and `createdAt`); the helpers
 * below read either, so a board whose agent is one step
 * behind its app still shows its staleness note.
 * =====================================================
 */

const TIMEOUT_MS = 5000;

/**
 * @typedef {Object} LocalContent
 * @property {string} firstDay
 * @property {string} lastDay
 * @property {string} [timezone]
 * @property {number} [sequence]
 * @property {string} [createdAt]    v2
 * @property {string} [generatedAt]  v1
 * @property {string} [source]       sync | usb | upload | cli
 * @property {string} [installedAt]
 */

/**
 * @typedef {Object} LocalStatus
 * @property {number} [localApi]
 * @property {string} [agentVersion]
 * @property {string} [deviceId]
 * @property {{version:string}|null} [app]
 * @property {LocalContent|null} [content]  v2
 * @property {LocalContent|null} [bundle]   v1
 * @property {string} [today]
 * @property {string|null} [servingDay]
 * @property {number|null} [daysRemaining]
 * @property {number|null} [staleDays]
 * @property {{enabled:boolean,lastSuccessAt:string|null,lastAttemptAt:string|null,lastError:string|null}} [sync]
 * @property {{active:boolean}} [update]
 * @property {string} [error]  installed content could not be read
 */

/**
 * Fetch the agent's status. Never throws: the status feeds the device id, the
 * waiting screen, the staleness note and the diagnostics panel, and a board
 * must keep showing its payload even if the agent is too old to answer this.
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

/**
 * The installed content, whichever agent generation described it.
 * @param {LocalStatus|null|undefined} status
 * @returns {LocalContent|null}
 */
export function statusContent(status) {
  return status?.content ?? status?.bundle ?? null;
}

/**
 * When the installed content was made: v2 `createdAt`, v1 `generatedAt`.
 * @param {LocalContent|null|undefined} content
 * @returns {string|null}
 */
export function contentCreatedAt(content) {
  return content?.createdAt ?? content?.generatedAt ?? null;
}
