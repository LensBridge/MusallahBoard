/**
 * =====================================================
 * API Module
 * =====================================================
 * Exports all API-related functionality.
 * =====================================================
 */

export {
  configureApiClient,
  getApiConfig,
  isApiConfigured,
  request,
  get,
  post,
  put,
  del,
  ApiError,
} from './client.js';

export {
  getBoardPayload,
  getBoardConfig,
  getEvents,
  getPosters,
  getJummahPrayers,
  getWeather,
  getDailyContent,
  buildDefaultFrameDefinitions,
} from './boardService.js';

export {
  getPrayerTimes,
  getTomorrowFajr,
  calculateNextPrayer,
  calculateCountdown,
  formatCountdown,
  formatHijriDate,
} from './prayerService.js';
