/**
 * =====================================================
 * MusallahBoard Data Models
 * =====================================================
 * Type definitions for all data entities used throughout
 * the application. These serve as the contract between
 * the frontend and backend API.
 * =====================================================
 */

// =====================================================
// Location & Configuration
// =====================================================

/**
 * @typedef {Object} Location
 * @property {string} city - City name
 * @property {string} country - Country name or code
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {string} timezone - IANA timezone string (e.g., "America/Toronto")
 * @property {string} [calculationMethod] - Calculation method identifier from backend
 * @property {number} [method] - Numeric Aladhan method (legacy / fallback)
 */

/**
 * @typedef {Object} JummahPrayer
 * @property {number|string} id - Unique identifier
 * @property {string} time - Display time (e.g., "12:30 PM")
 * @property {string} khatib - Name of the khatib
 * @property {string} location - Location/room
 */

/**
 * Creates a normalized JummahPrayer object
 * @param {Partial<JummahPrayer> & { time: string, khatib: string }} data
 * @returns {JummahPrayer}
 */
export function createJummahPrayer(data) {
  return {
    id: data.id ?? crypto.randomUUID(),
    time: data.time,
    khatib: data.khatib,
    location: data.location ?? '',
  };
}

/**
 * @typedef {Object} BoardConfig
 * @property {Location} location - Location settings
 * @property {'BROTHERS_MUSALLAH' | 'SISTERS_MUSALLAH'} boardLocation - Which musallah this board is located in
 * @property {number} posterCycleInterval - Default poster display duration (ms)
 * @property {number} refreshAfterIshaaMinutes - Minutes after Isha to refresh
 * @property {boolean} darkModeAfterIsha - Enable dark mode after Isha
 * @property {number} darkModeMinutesAfterIsha - Minutes after Isha to enable dark mode
 * @property {boolean} enableScrollingMessage - Show scrolling message bar
 * @property {string[]} scrollingMessages - Scrolling message texts
 */

// =====================================================
// Server-side Frame Contract (GET /api/musallah/payload)
// =====================================================
//
// These mirror the wire types emitted by the backend. The /payload handler
// flattens these into the frontend's working shape (events, posters, etc.)
// in api/boardService.js — UI code below should generally read the flattened
// shape, not these.

/**
 * @typedef {'poster' | 'event_list' | 'daily_schedule' | 'next_prayer' | 'jummah' | 'islamic_quote'} ServerFrameType
 */

/**
 * @typedef {'PRIMARY' | 'TICKER' | 'SIDEBAR' | 'OVERLAY'} FrameSlot
 */

/**
 * @typedef {Object} EventView
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} location
 * @property {number} startTimestamp - epoch ms
 * @property {number} endTimestamp   - epoch ms
 * @property {boolean|null} allDay
 */

/**
 * @typedef {{ type: 'poster', posterUrl: string, title: string }} PosterFrameConfig
 * @typedef {{ type: 'event_list', heading: string, events: EventView[] }} EventListFrameConfig
 * @typedef {{ type: 'daily_schedule', heading: string, events: EventView[] }} DailyScheduleFrameConfig
 * @typedef {{ type: 'next_prayer', locationCity: string, timezone: string, calculationMethod: string }} NextPrayerFrameConfig
 * @typedef {{ prayerTime: string, khatib: string, location: string }} JummahSlot
 * @typedef {{ type: 'jummah', prayers: JummahSlot[] }} JummahFrameConfig
 * @typedef {{ type: 'islamic_quote', kind: 'VERSE'|'HADITH', arabic: string, transliteration: string|null, translation: string, reference: string }} IslamicQuoteFrameConfig
 */

/**
 * @typedef {PosterFrameConfig | EventListFrameConfig | DailyScheduleFrameConfig | NextPrayerFrameConfig | JummahFrameConfig | IslamicQuoteFrameConfig} ServerFrameConfig
 */

/**
 * @typedef {Object} ServerFrameDefinition
 * @property {ServerFrameType} frameType
 * @property {FrameSlot} slot
 * @property {number|null} priority - higher first within a slot; null = neutral
 * @property {number|null} durationInSeconds - null = use slot default
 * @property {ServerFrameConfig} frameConfig
 */

/**
 * @typedef {Object} MusallahBoardPayload
 * @property {BoardConfig} boardConfig
 * @property {ServerFrameDefinition[]} frames
 */

// =====================================================
// Events
// =====================================================

/**
 * @typedef {'brothers' | 'sisters' | 'both'} Audience
 */

/**
 * @typedef {'brothers' | 'sisters'} BoardLocation
 */

/**
 * @typedef {Object} Event
 * @property {number|string} id - Unique identifier
 * @property {string} name - Event name/title
 * @property {number} startTimestamp - Start time (Unix timestamp in ms)
 * @property {number} endTimestamp - End time (Unix timestamp in ms)
 * @property {string} [location] - Event location
 * @property {string} [description] - Event description
 * @property {boolean} [allDay] - Whether this is an all-day event
 * @property {Audience} [audience] - Target audience
 */

/**
 * Creates a normalized Event object
 * @param {Partial<Event> & { name: string, startTimestamp: number, endTimestamp: number }} data
 * @returns {Event}
 */
export function createEvent(data) {
  return {
    id: data.id ?? crypto.randomUUID(),
    name: data.name,
    startTimestamp: data.startTimestamp,
    endTimestamp: data.endTimestamp,
    location: data.location ?? '',
    description: data.description ?? '',
    allDay: data.allDay ?? false,
  };
}

// =====================================================
// Posters
// =====================================================

/**
 * @typedef {Object} Poster
 * @property {number|string} id - Unique identifier
 * @property {string} title - Poster title
 * @property {string} image - Image URL/path
 * @property {number} duration - Display duration (ms)
 * @property {string} [startDate] - Start date (ISO string, e.g., "2025-12-01")
 * @property {string} [endDate] - End date (ISO string)
 * @property {Audience} [audience] - Target audience
 */

/**
 * Creates a normalized Poster object
 * @param {Partial<Poster> & { title: string, image: string }} data
 * @returns {Poster}
 */
export function createPoster(data) {
  return {
    id: data.id ?? crypto.randomUUID(),
    title: data.title,
    image: data.image,
    duration: data.duration ?? 10000,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    audience: data.audience ?? 'both',
  };
}

/**
 * Checks if a poster is currently active based on date range
 * @param {Poster} poster
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isPosterActive(poster, now = new Date()) {
  const today = now.toISOString().split('T')[0];
  if (poster.startDate && today < poster.startDate) return false;
  if (poster.endDate && today > poster.endDate) return false;
  return true;
}

// =====================================================
// Islamic Content
// =====================================================

/**
 * @typedef {Object} IslamicQuote
 * @property {string} arabic - Arabic text
 * @property {string} transliteration - Transliteration
 * @property {string} translation - English translation
 * @property {string} reference - Source reference
 */

/**
 * @typedef {Object} DailyContent
 * @property {IslamicQuote} verse - Verse of the day
 * @property {IslamicQuote} hadith - Hadith of the day
 */

/**
 * Creates a normalized IslamicQuote object
 * @param {Partial<IslamicQuote>} data
 * @returns {IslamicQuote}
 */
export function createIslamicQuote(data) {
  return {
    arabic: data.arabic ?? '',
    transliteration: data.transliteration ?? '',
    translation: data.translation ?? '',
    reference: data.reference ?? '',
  };
}

// =====================================================
// Prayer Times
// =====================================================

/**
 * @typedef {Object} PrayerTimes
 * @property {string} Fajr - Fajr time (24h format)
 * @property {string} Sunrise - Sunrise time
 * @property {string} Dhuhr - Dhuhr time
 * @property {string} Asr - Asr time (Shafi'i)
 * @property {string} [hanafiAsr] - Asr time (Hanafi)
 * @property {string} Maghrib - Maghrib time
 * @property {string} Isha - Isha time
 */

/**
 * @typedef {Object} HijriDate
 * @property {string} day - Day of month
 * @property {{ en: string, ar: string }} month - Month name
 * @property {string} year - Hijri year
 */

/**
 * @typedef {Object} ParsedTime
 * @property {number} hours - Hours (0-23)
 * @property {number} minutes - Minutes (0-59)
 */

/**
 * Parses a time string into hours and minutes
 * @param {string} timeStr - Time string (e.g., "14:30" or "2:30 PM")
 * @returns {ParsedTime}
 */
export function parseTimeString(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (period) {
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }

  return { hours, minutes };
}

/**
 * Converts 24h time to 12h format
 * @param {string} time24 - Time in 24h format (e.g., "14:30")
 * @returns {string} Time in 12h format (e.g., "2:30 PM")
 */
export function formatTo12Hour(time24) {
  let [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// =====================================================
// Weather
// =====================================================

/**
 * @typedef {Object} CurrentWeather
 * @property {number} temp - Temperature in Celsius
 * @property {string} icon - Weather icon/emoji
 * @property {string} condition - Weather condition (e.g., "Clouds")
 * @property {string} description - Location description
 */

/**
 * @typedef {Object} HourlyForecast
 * @property {string} timeLabel - Time label (e.g., "2:00 PM")
 * @property {number} temp - Temperature
 * @property {string} icon - Weather icon
 * @property {boolean} isToday - Whether this hour is today
 */

/**
 * @typedef {Object} DailyForecast
 * @property {string} label - Day label (e.g., "Today", "Tomorrow", or date)
 * @property {number} high - High temperature
 * @property {number} low - Low temperature
 * @property {string} icon - Weather icon
 */

/**
 * @typedef {Object} WeatherOutlook
 * @property {HourlyForecast[]} hourly - Hourly forecast
 * @property {DailyForecast[]} daily - Daily forecast
 */

/**
 * @typedef {Object} Weather
 * @property {CurrentWeather} current - Current weather
 * @property {WeatherOutlook} [outlook] - Forecast data
 */

// =====================================================
// Slideshow Frames
// =====================================================

/**
 * @typedef {'weekAtGlance' | 'today' | 'nextPrayer' | 'poster' | 'quotes' | 'socialMediaPromotion'} FrameType
 */

/**
 * @typedef {Object} FrameDefinition
 * @property {string} id - Unique frame identifier
 * @property {FrameType} type - Frame type
 * @property {number | 'auto'} [duration] - Display duration (ms) or 'auto'
 * @property {number|string} [posterId] - Poster ID (for poster frames)
 * @property {string} [instagramHandle] - Instagram handle (for social media frames)
 */

/**
 * Creates a frame definition
 * @param {Partial<FrameDefinition> & { type: FrameType }} data
 * @returns {FrameDefinition}
 */
export function createFrameDefinition(data) {
  return {
    id: data.id ?? `frame-${crypto.randomUUID()}`,
    type: data.type,
    duration: data.duration ?? 'auto',
    ...data,
  };
}

// =====================================================
// API Response Types
// =====================================================

/**
 * @typedef {Object} BoardPayload
 * @property {BoardConfig} boardConfig - Board configuration
 * @property {Event[]} events - Events list
 * @property {Poster[]} posters - Posters list
 * @property {JummahPrayer[]} jummahPrayers - Jummah prayer schedule
 * @property {FrameDefinition[]} frames - Frame definitions for slideshow
 * @property {DailyContent} dailyContent - Islamic content
 * @property {Weather} [weather] - Weather data (from backend)
 */

// =====================================================
// Constants
// =====================================================

export const PRAYER_NAMES = {
  Fajr: 'fajr',
  Sunrise: 'sunrise',
  Dhuhr: 'dhuhr',
  Asr: 'asr',
  Maghrib: 'maghrib',
  Isha: 'isha',
};

export const PRAYER_DISPLAY_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const WEATHER_ICONS = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️',
  Dust: '🌫️',
  Smoke: '🌫️',
};

export const FRAME_TYPES = {
  WEEK_AT_GLANCE: 'weekAtGlance',
  TODAY: 'today',
  NEXT_PRAYER: 'nextPrayer',
  POSTER: 'poster',
  QUOTES: 'quotes',
  SOCIAL_MEDIA_PROMOTION: 'socialMediaPromotion',
};
