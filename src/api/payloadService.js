/**
 * =====================================================
 * Payload Service
 * =====================================================
 * Fetches today's payload from the device agent that
 * serves this page (same-origin GET /api/musallah/payload,
 * agent/docs/architecture.md, section 7) and flattens it
 * into the design data shape. Retries with jittered
 * backoff on transient failures.
 *
 * The agent serves only its own board, so no deviceId is
 * sent, and a 503 "no content installed" is a state, not
 * an outage: see isNoContentError().
 *
 * The body is the backend's payload, served verbatim by
 * the agent from its content package, plus the agent's own
 * `expired` and `lastDay` (see types.d.ts).
 * =====================================================
 */

import { normalizePayload } from '../models/index.js';

/** @typedef {import('./types').MusallahBoardPayload} MusallahBoardPayload */

const PAYLOAD_URL = '/api/musallah/payload';
const TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [2000, 5000, 12000, 30000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Error carrying the HTTP status (0 for a network failure). */
export class ApiError extends Error {
  /** @param {string} message @param {number} status @param {any} [data] */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * GET the raw payload once. Times out rather than hanging: a fetch that never
 * settles would never reach the retry loop below.
 * @returns {Promise<MusallahBoardPayload>}
 */
async function fetchPayload() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(PAYLOAD_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError('Request timeout', 408);
    throw new ApiError(error?.message || 'Network error', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  // The agent's errors are all {"message": "..."} (section 7).
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.message || `Request failed with status ${res.status}`,
      res.status,
      body
    );
  }
  return /** @type {MusallahBoardPayload} */ (body);
}

/**
 * The agent's answer when no content package is installed yet
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

/**
 * The agent's answer when the installed content package is there but cannot be
 * used: its manifest is unreadable, today's payload file is missing, or (with
 * an agent that re-checks the package when it loads it) a file no longer
 * matches its signed hash. Usually a failing SD card. Every such message names
 * "installed content" (agent/internal/core/localserver/server.go). Retrying
 * cannot help: only a fresh copy of the content can.
 * @param {unknown} error
 */
export function isDamagedContentError(error) {
  return (
    error instanceof ApiError &&
    error.status === 500 &&
    /installed content/i.test(error.message || '')
  );
}

/** 429 / 5xx / network errors are worth retrying; other 4xx are not. */
function isTransient(error) {
  if (!(error instanceof ApiError)) return false;
  if (isNoContentError(error) || isDamagedContentError(error)) return false;
  const { status } = error;
  return status === 429 || status === 0 || status >= 500;
}

/**
 * Fetch and normalize this board's payload.
 * @returns {Promise<ReturnType<typeof normalizePayload>>}
 */
export async function getBoardPayload() {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return normalizePayload(await fetchPayload());
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
