/**
 * =====================================================
 * API Client
 * =====================================================
 * Base HTTP client for making API requests. Provides
 * consistent error handling and configuration.
 * =====================================================
 */

/**
 * @typedef {Object} ApiClientConfig
 * @property {string} [baseUrl] - Base URL for API requests
 * @property {number} [timeout] - Request timeout in ms
 * @property {Record<string, string>} [headers] - Default headers
 */

/** @type {ApiClientConfig} */
const defaultConfig = {
  baseUrl: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

let globalConfig = { ...defaultConfig };
let isConfigured = false;

/**
 * Configure the API client globally
 * @param {Partial<ApiClientConfig>} config
 */
export function configureApiClient(config) {
  globalConfig = {
    ...globalConfig,
    ...config,
    headers: {
      ...globalConfig.headers,
      ...config.headers,
    },
  };
  isConfigured = true;
}

/**
 * Get current API client configuration
 * @returns {ApiClientConfig}
 */
export function getApiConfig() {
  return { ...globalConfig };
}

/**
 * Check if the API client is configured
 * @returns {boolean}
 */
export function isApiConfigured() {
  return isConfigured;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {any} [data]
   */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make an HTTP request
 * @param {string} path - API path (appended to baseUrl)
 * @param {RequestInit & { timeout?: number }} [options] - Fetch options
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
      headers: {
        ...globalConfig.headers,
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Read body once — the stream can only be consumed a single time.
      const rawBody = await response.text().catch(() => '');
      let errorData = rawBody;
      if (rawBody) {
        try {
          errorData = JSON.parse(rawBody);
        } catch {
          // Not JSON — keep the raw text.
        }
      }
      throw new ApiError(
        (errorData && typeof errorData === 'object' && errorData.message) ||
          `Request failed with status ${response.status}`,
        response.status,
        errorData
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Try to parse as JSON, fall back to text
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(error.message || 'Network error', 0);
  }
}

/**
 * Make a GET request
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export function get(path, options = {}) {
  return request(path, { ...options, method: 'GET' });
}

/**
 * Make a POST request
 * @param {string} path
 * @param {any} [body]
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export function post(path, body, options = {}) {
  return request(path, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make a PUT request
 * @param {string} path
 * @param {any} [body]
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export function put(path, body, options = {}) {
  return request(path, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make a DELETE request
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export function del(path, options = {}) {
  return request(path, { ...options, method: 'DELETE' });
}
