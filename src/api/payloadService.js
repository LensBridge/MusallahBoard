/**
 * =====================================================
 * Payload Service
 * =====================================================
 * Fetches GET /api/musallah/payload?deviceId=<uuid> and
 * flattens it into the design data shape. Retries with
 * jittered backoff on transient failures so a fleet of
 * boards doesn't reconnect in lockstep.
 * =====================================================
 */

import { get, ApiError } from './client.js';
import { normalizePayload } from '../models/index.js';

const RETRY_DELAYS_MS = [2000, 5000, 12000, 30000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 429 / 5xx / network errors are worth retrying; other 4xx are not. */
function isTransient(error) {
  if (!(error instanceof ApiError)) return false;
  const { status } = error;
  return status === 429 || status === 0 || status >= 500;
}

/**
 * Fetch and normalize the board payload for a device.
 * @param {string} deviceId  device UUID (from enrollment / setup)
 * @returns {Promise<ReturnType<typeof normalizePayload>>}
 */
export async function getBoardPayload(deviceId) {
  if (!deviceId) throw new ApiError('Missing deviceId', 400);

  const path = `/api/musallah/payload?deviceId=${encodeURIComponent(deviceId)}`;
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const payload = await get(path);
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
