/**
 * =====================================================
 * API Client
 * =====================================================
 * Base HTTP client. Conforms to the LensBridge backend
 * (see http://localhost:8080/swagger-ui.html). Provides
 * consistent error handling, timeouts, and a configurable
 * base URL.
 * =====================================================
 */

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
  baseUrl: import.meta.env?.VITE_API_BASE_URL ?? '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
};

let globalConfig = { ...defaultConfig };

/** @param {Partial<ApiClientConfig>} config */
export function configureApiClient(config) {
  globalConfig = {
    ...globalConfig,
    ...config,
    headers: { ...globalConfig.headers, ...config.headers },
  };
}

/** @returns {ApiClientConfig} */
export function getApiConfig() {
  return { ...globalConfig };
}

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
 * Perform an HTTP request against the backend.
 * @param {string} path
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<any>}
 */
export async function request(path, options = {}) {
  const { timeout = globalConfig.timeout, ...fetchOptions } = options;
  const url = globalConfig.baseUrl
    ? `${globalConfig.baseUrl.replace(/\/$/, '')}${path}`
    : path;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: { ...globalConfig.headers, ...fetchOptions.headers },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const rawBody = await response.text().catch(() => '');
      let errorData = rawBody;
      if (rawBody) {
        try { errorData = JSON.parse(rawBody); } catch { /* keep raw text */ }
      }
      throw new ApiError(
        (errorData && typeof errorData === 'object' && errorData.message) ||
          `Request failed with status ${response.status}`,
        response.status,
        errorData
      );
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) return response.json();
    return response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new ApiError('Request timeout', 408);
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || 'Network error', 0);
  }
}

/** @param {string} path @param {RequestInit} [options] */
export function get(path, options = {}) {
  return request(path, { ...options, method: 'GET' });
}
