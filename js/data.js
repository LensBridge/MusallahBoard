/**
 * =====================================================
 * MusallahBoard Data Module
 * =====================================================
 * This is the main data module that re-exports from the
 * new modular structure for backward compatibility.
 * 
 * New code should import directly from:
 *   - js/models/index.js - Data types and constants
 *   - js/api/boardService.js - Board data fetching
 *   - js/api/prayerService.js - Prayer times
 *   - js/mocks/mockData.js - Mock data (if needed)
 * =====================================================
 */

// Re-export models
export {
  // Type creators
  createEvent,
  createPoster,
  createIslamicQuote,
  createFrameDefinition,
  isPosterActive,
  
  // Time utilities
  parseTimeString,
  formatTo12Hour,
  
  // Constants
  PRAYER_NAMES,
  PRAYER_DISPLAY_ORDER,
  WEATHER_ICONS,
  FRAME_TYPES,
} from './models/index.js';

// Re-export mock data (for backward compatibility)
export {
  MOCK_BOARD_CONFIG as BOARD_CONFIG,
  MOCK_EVENTS as EVENTS,
  MOCK_POSTERS as POSTERS,
  MOCK_JUMMAH_PRAYERS as JUMMAH_PRAYERS,
  MOCK_VERSES as VERSES_OF_DAY,
  MOCK_HADITHS as HADITHS_OF_DAY,
  getDailyContent,
  getMockBoardPayload as buildMockPayload,
  buildDefaultFrameDefinitions,
} from './mocks/mockData.js';

// Re-export API services
export {
  getBoardPayload,
  getBoardConfig,
  getEvents,
  getPosters,
  getJummahPrayers,
  getWeather,
  getDailyContent as fetchDailyContent,
} from './api/boardService.js';

export {
  getPrayerTimes,
  getTomorrowFajr,
  calculateNextPrayer,
  calculateCountdown,
  formatCountdown,
  formatHijriDate,
} from './api/prayerService.js';

// Re-export API client configuration
export {
  configureApiClient,
  getApiConfig,
  isApiConfigured,
} from './api/client.js';
