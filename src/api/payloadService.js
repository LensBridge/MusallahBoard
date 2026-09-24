/**
 * =====================================================
 * Payload Service
 * =====================================================
 * Fetches GET /api/musallah/payload?deviceId=<uuid> and
 * flattens it into the design data shape. Retries with
 * jittered backoff on transient failures so a fleet of
 * boards doesn't reconnect in lockstep.
 *
 * In the local runtime the same path is answered by the
 * device agent, for which `deviceId` is optional (it only
 * ever serves its own board), and a 503 "no content
 * installed" is a state, not an outage: see
 * isNoContentError().
 * =====================================================
 */

import { getClient, unwrap, ApiError } from './client.js';
import { normalizePayload } from '../models/index.js';

const RETRY_DELAYS_MS = [2000, 5000, 12000, 30000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The local agent's answer when no content package is installed yet
 * (agent/docs/architecture.md, section 7). Retrying it a few seconds later only
 * delays the "Waiting for content" screen: content arrives by sync, USB stick
 * or upload, and the agent announces it on /api/local/events.
 * @param {unknown} error
 */
export function isNoContentError(error) {
  return (
    error instanceof ApiError &&
    error.status === 503 &&
    /no content/i.test(error.message || '')
  );
}

/** 429 / 5xx / network errors are worth retrying; other 4xx are not. */
function isTransient(error) {
  if (!(error instanceof ApiError)) return false;
  if (isNoContentError(error)) return false;
  const { status } = error;
  return status === 429 || status === 0 || status >= 500;
}

/**
 * Fetch and normalize the board payload for a device.
 * @param {string|null} deviceId  device UUID (from enrollment / setup). May be
 *   null only with `local`, when the agent on this board answers.
 * @param {{ local?: boolean }} [options]
 * @returns {Promise<ReturnType<typeof normalizePayload>>}
 */
export async function getBoardPayload(deviceId, { local = false } = {}) {
  if (!deviceId && !local) throw new ApiError('Missing deviceId', 400);
  // The schema marks deviceId required because the backend needs it; the
  // agent does not, so the local runtime may send no query at all.
  const query = deviceId ? { deviceId } : /** @type {{deviceId: string}} */ ({});

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const payload = unwrap(
        await getClient().GET('/api/musallah/payload', {
          params: { query },
        })
      );
      return normalizePayload(payload);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === RETRY_DELAYS_MS.length) break;
      const base = RETRY_DELAYS_MS[attempt];
      const delay = Math.floor(Math.random() * base); // full jitter
      console.warn(
        `payload fetch failed (status ${error?.status ?? 'n/a'}); retry ` +
          `${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Failed to fetch board payload');
}
