/**
 * =====================================================
 * Board Service
 * =====================================================
 * Service layer for fetching board data (events, posters,
 * config, weather) from the backend API.
 * 
 * When the backend is not configured, falls back to mock data.
 * =====================================================
 */

import { get, isApiConfigured } from './client.js';
import { getMockBoardPayload, getMockWeather, MOCK_BOARD_CONFIG } from '../mocks/mockData.js';
import { FRAME_TYPES } from '../models/index.js';

/**
 * @typedef {import('../models/index.js').BoardPayload} BoardPayload
 * @typedef {import('../models/index.js').BoardConfig} BoardConfig
 * @typedef {import('../models/index.js').Event} Event
 * @typedef {import('../models/index.js').Poster} Poster
 * @typedef {import('../models/index.js').Weather} Weather
 * @typedef {import('../models/index.js').DailyContent} DailyContent
 * @typedef {import('../models/index.js').FrameDefinition} FrameDefinition
 */

/**
 * Fetch the complete board payload (config, events, posters, frames, content)
 * @param {string} boardLocation - Board location enum (BROTHERS_MUSALLAH or SISTERS_MUSALLAH)
 * @returns {Promise<BoardPayload>}
 */
export async function getBoardPayload(boardLocation = 'BROTHERS_MUSALLAH') {
  if (!isApiConfigured()) {
    console.log('API not configured, using mock data');
    return getMockBoardPayload();
  }

  try {
    const payload = await get(`/api/musallah/payload?board=${boardLocation}`);
    return normalizePayload(payload);
  } catch (error) {
    console.error('Failed to fetch board payload, falling back to mock:', error);
    return getMockBoardPayload();
  }
}

/**
 * Fetch board configuration
 * @returns {Promise<BoardConfig>}
 */
export async function getBoardConfig() {
  if (!isApiConfigured()) {
    const { boardConfig } = getMockBoardPayload();
    return boardConfig;
  }

  try {
    return await get('/api/board/config');
  } catch (error) {
    console.error('Failed to fetch board config:', error);
    const { boardConfig } = getMockBoardPayload();
    return boardConfig;
  }
}

/**
 * Fetch events
 * @returns {Promise<Event[]>}
 */
export async function getEvents() {
  if (!isApiConfigured()) {
    const { events } = getMockBoardPayload();
    return events;
  }

  try {
    const events = await get('/api/events');
    return events.map(normalizeEvent);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    const { events } = getMockBoardPayload();
    return events;
  }
}

/**
 * Fetch posters
 * @returns {Promise<Poster[]>}
 */
export async function getPosters() {
  if (!isApiConfigured()) {
    const { posters } = getMockBoardPayload();
    return posters;
  }

  try {
    const posters = await get('/api/posters');
    return posters.map(normalizePoster);
  } catch (error) {
    console.error('Failed to fetch posters:', error);
    const { posters } = getMockBoardPayload();
    return posters;
  }
}

/**
 * Fetch Jummah prayers
 * @returns {Promise<import('../models/index.js').JummahPrayer[]>}
 */
export async function getJummahPrayers() {
  if (!isApiConfigured()) {
    const { jummahPrayers } = getMockBoardPayload();
    return jummahPrayers;
  }

  try {
    const jummahPrayers = await get('/api/jummah-prayers');
    return jummahPrayers.map(normalizeJummahPrayer);
  } catch (error) {
    console.error('Failed to fetch Jummah prayers:', error);
    const { jummahPrayers } = getMockBoardPayload();
    return jummahPrayers;
  }
}

/**
 * Fetch weather data
 * @returns {Promise<Weather | null>}
 */
export async function getWeather() {
  if (!isApiConfigured()) {
    return getMockWeather();
  }

  try {
    const weather = await get('/api/weather');
    return normalizeWeather(weather);
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return getMockWeather();
  }
}

/**
 * Fetch daily Islamic content
 * @returns {Promise<DailyContent>}
 */
export async function getDailyContent() {
  if (!isApiConfigured()) {
    const { dailyContent } = getMockBoardPayload();
    return dailyContent;
  }

  try {
    return await get('/api/content/daily');
  } catch (error) {
    console.error('Failed to fetch daily content:', error);
    const { dailyContent } = getMockBoardPayload();
    return dailyContent;
  }
}

// =====================================================
// Normalization helpers
// =====================================================

/**
 * Normalize the full payload from API
 * @param {any} payload
 * @returns {BoardPayload}
 */
function normalizePayload(payload) {
  // Backend returns: { boardConfig, posterFrames, upcomingEvents, weeklyContent }
  // If boardConfig is null or missing location, use mock config as fallback
  const config = payload.boardConfig && payload.boardConfig.location 
    ? payload.boardConfig 
    : MOCK_BOARD_CONFIG;
  
  const posterFrames = payload.posterFrames || [];
  const events = payload.upcomingEvents || [];
  const weeklyContent = payload.weeklyContent || {};
  
  // Convert posterFrames to posters array
  const posters = posterFrames.map((frame, index) => ({
    id: index + 1,
    title: frame.frameConfig?.title || `Poster ${index + 1}`,
    image: frame.frameConfig?.posterUrl || '',
    duration: (frame.durationInSeconds || 10) * 1000, // Convert seconds to ms
    startDate: null,
    endDate: null,
    audience: 'both',
  }));
  
  // Extract Jummah prayers from weeklyContent (supports array or single object)
  let jummahPrayers = [];
  if (weeklyContent.jummahPrayer) {
    const prayers = Array.isArray(weeklyContent.jummahPrayer) 
      ? weeklyContent.jummahPrayer 
      : [weeklyContent.jummahPrayer];
    
    jummahPrayers = prayers.map((prayer, index) => {
      // Get time and format it to 12-hour AM/PM without seconds
      let timeStr = prayer.prayerTime || prayer.time || '';
      
      // Remove seconds if present (e.g., "12:30:00" -> "12:30")
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        if (parts.length === 3) {
          timeStr = `${parts[0]}:${parts[1]}`; // Remove seconds
        }
        
        // Convert to 12-hour format with AM/PM
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
      
      return {
        id: index + 1,
        time: timeStr,
        khatib: prayer.khatib || '',
        location: prayer.location || '',
        audience: 'both',
      };
    });
  }
  
  // Extract verse and hadith
  const dailyContent = {
    verse: weeklyContent.verse || null,
    hadith: weeklyContent.hadith || null,
  };
  
  return {
    boardConfig: config,
    events: events.map(normalizeEvent),
    posters: posters,
    jummahPrayers: jummahPrayers,
    frames: buildDefaultFrameDefinitions(posters),
    dailyContent: dailyContent,
    weather: null, // Weather fetched separately
  };
}

/**
 * Normalize an event from API
 * @param {any} event
 * @returns {Event}
 */
function normalizeEvent(event) {
  return {
    id: event.id,
    name: event.name || event.title || '',
    startTimestamp: event.startTimestamp || new Date(event.startTime || event.start).getTime(),
    endTimestamp: event.endTimestamp || new Date(event.endTime || event.end).getTime(),
    location: event.location || '',
    description: event.description || '',
    allDay: Boolean(event.allDay),
    audience: event.audience || 'both',
  };
}

/**
 * Normalize a poster from API
 * @param {any} poster
 * @returns {Poster}
 */
function normalizePoster(poster) {
  return {
    id: poster.id,
    title: poster.title || poster.name || '',
    image: poster.image || poster.imageUrl || '',
    duration: poster.duration || 10000,
    startDate: poster.startDate || null,
    endDate: poster.endDate || null,
    audience: poster.audience || 'both',
  };
}

/**
 * Normalize a Jummah prayer from API
 * @param {any} jummahPrayer
 * @returns {import('../models/index.js').JummahPrayer}
 */
function normalizeJummahPrayer(jummahPrayer) {
  return {
    id: jummahPrayer.id,
    time: jummahPrayer.time,
    khatib: jummahPrayer.khatib || '',
    location: jummahPrayer.location || '',
    audience: jummahPrayer.audience || 'both',
  };
}

/**
 * Normalize weather from API
 * @param {any} weather
 * @returns {Weather}
 */
function normalizeWeather(weather) {
  return {
    current: {
      temp: weather.current?.temp ?? weather.temp ?? 0,
      icon: weather.current?.icon ?? weather.icon ?? '☁️',
      condition: weather.current?.condition ?? weather.condition ?? 'Unknown',
      description: weather.current?.description ?? weather.description ?? '',
    },
    outlook: weather.outlook || null,
  };
}

/**
 * Build default frame definitions based on posters
 * @param {Poster[]} posters
 * @returns {FrameDefinition[]}
 */
export function buildDefaultFrameDefinitions(posters = []) {
  /** @type {FrameDefinition[]} */
  const frames = [
    { id: 'week-at-a-glance', type: FRAME_TYPES.WEEK_AT_GLANCE, duration: 'auto' },
    { id: 'today', type: FRAME_TYPES.TODAY, duration: 'auto' },
    { id: 'next-prayer', type: FRAME_TYPES.NEXT_PRAYER, duration: 12000 },
  ];

  // Add poster frames
  posters.forEach((poster) => {
    frames.push({
      id: `poster-${poster.id}`,
      type: FRAME_TYPES.POSTER,
      posterId: poster.id,
      duration: poster.duration || 10000,
    });
  });

  // Add social media and quotes
  frames.push({
    id: 'social-media-promotion',
    type: FRAME_TYPES.SOCIAL_MEDIA_PROMOTION,
    instagramHandle: '@utmmsa',
    duration: 15000,
  });

  frames.push({
    id: 'quotes',
    type: FRAME_TYPES.QUOTES,
    duration: 20000,
  });

  return frames;
}
