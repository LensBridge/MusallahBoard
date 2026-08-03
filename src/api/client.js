/**
 * =====================================================
 * API Client
 * =====================================================
 * Typed client for the LensBridge backend.
 *
 * Paths, parameters and response shapes come from
 * src/api/schema.d.ts, generated from
 * LensBridgeBackend/openapi.yaml. Regenerate with
 * `npm run api:generate`; never edit the schema by hand.
 *
 * What OpenAPI does not provide, and so is kept here:
 * per-request timeouts, and ApiError carrying the HTTP
 * status so payloadService can decide what to retry.
 * =====================================================
 */

import createClient from 'openapi-fetch';

/**
 * @typedef {Object} ApiClientConfig
 * @property {string} baseUrl - Base URL prefixed to every request path
 * @property {number} timeout - Request timeout in ms
 * @property {Record<string,string>} headers - Default headers
 */

/** @type {ApiClientConfig} */
const defaultConfig = {
  // Empty => same-origin (dev proxy / reverse proxy in prod). Overridden by
  // VITE_API_BASE_URL when the kiosk talks to the backend cross-origin.
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
};

let globalConfig = { ...defaultConfig };

/** Custom API error carrying the HTTP status. */
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
 * Applies the configured timeout to every request.
 *
 * A kiosk left on a dead network will otherwise hang on a fetch forever and
 * never reach the retry logic in payloadService.
 * @param {Request} request
 */
async function timeoutFetch(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), globalConfig.timeout);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError('Request timeout', 408);
    throw new ApiError(error?.message || 'Network error', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** @type {ReturnType<typeof createClient<import('./schema').paths>>} */
let client = createClient({ baseUrl: globalConfig.baseUrl, fetch: timeoutFetch });

/** @param {Partial<ApiClientConfig>} config */
export function configureApiClient(config) {
  globalConfig = {
    ...globalConfig,
    ...config,
    headers: { ...globalConfig.headers, ...config.headers },
  };
  // baseUrl is fixed at construction, so rebuild when it changes.
  client = createClient({ baseUrl: globalConfig.baseUrl, fetch: timeoutFetch });
}

/** @returns {ApiClientConfig} */
export function getApiConfig() {
  return { ...globalConfig };
}

/** The generated, type-checked client. */
export function getClient() {
  return client;
}

/**
 * Turn an openapi-fetch result into a value or an ApiError.
 *
 * openapi-fetch reports failures as a value; the retry logic in payloadService
 * is built around exceptions carrying a status, so convert here rather than
 * reshaping every caller.
 *
 * @template T
 * @param {{ data?: T, error?: any, response: Response }} result
 * @returns {T}
 */
export function unwrap({ data, error, response }) {
  if (error !== undefined || !response.ok) {
    throw new ApiError(
      error?.message || `Request failed with status ${response.status}`,
      response.status,
      error ?? null
    );
  }
  return data;
}
