/**
 * =====================================================
 * Board Service
 * =====================================================
 * Service layer for fetching board data (events, posters,
 * config, weather) from the backend API.
 * =====================================================
 */

import { get, isApiConfigured } from './client.js';
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

// =====================================================
// Default configurations (used when API is unavailable)
// =====================================================

/**
 * Get default board configuration
 * @returns {BoardConfig}
 */
function getDefaultBoardConfig() {
  return {
    location: 'brothers',
    darkModeAfterIsha: true,
    enableScrollingMessage: false,
    scrollingMessages: [],
    instagramHandle: '@utmmsa',
  };
}

/**
 * Get empty payload structure
 * @returns {BoardPayload}
 */
function getEmptyPayload() {
  return {
    boardConfig: getDefaultBoardConfig(),
    events: [],
    posters: [],
    jummahPrayers: [],
    frames: buildDefaultFrameDefinitions([]),
    dailyContent: { verse: null, hadith: null },
    weather: null,
  };
}

/**
 * Fetch the complete board payload (config + frames) and flatten it into the
 * frontend's working shape.
 *
 * The `board` query param is case-insensitive on the backend and accepts:
 * `brothers`, `sisters`, `brothers_musallah`, `sisters_musallah`.
 *
 * @param {string} boardLocation - e.g. "BROTHERS_MUSALLAH" or "sisters"
 * @returns {Promise<BoardPayload>}
 */
export async function getBoardPayload(boardLocation = 'BROTHERS_MUSALLAH') {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return getEmptyPayload();
  }

  try {
    const board = encodeURIComponent(String(boardLocation));
    const payload = await get(`/api/musallah/payload?board=${board}`);
    return normalizePayload(payload);
  } catch (error) {
    console.error('Failed to fetch board payload:', error);
    return getEmptyPayload();
  }
}

/**
 * Fetch board configuration
 * @returns {Promise<BoardConfig>}
 */
export async function getBoardConfig() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return getDefaultBoardConfig();
  }

  try {
    return await get('/api/board/config');
  } catch (error) {
    console.error('Failed to fetch board config:', error);
    return getDefaultBoardConfig();
  }
}

/**
 * Fetch events
 * @returns {Promise<Event[]>}
 */
export async function getEvents() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return [];
  }

  try {
    const events = await get('/api/events');
    return events.map(normalizeEvent);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return [];
  }
}

/**
 * Fetch posters
 * @returns {Promise<Poster[]>}
 */
export async function getPosters() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return [];
  }

  try {
    const posters = await get('/api/posters');
    return posters.map(normalizePoster);
  } catch (error) {
    console.error('Failed to fetch posters:', error);
    return [];
  }
}

/**
 * Fetch Jummah prayers
 * @returns {Promise<import('../models/index.js').JummahPrayer[]>}
 */
export async function getJummahPrayers() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return [];
  }

  try {
    const jummahPrayers = await get('/api/jummah-prayers');
    return jummahPrayers.map(normalizeJummahPrayer);
  } catch (error) {
    console.error('Failed to fetch Jummah prayers:', error);
    return [];
  }
}

/**
 * Fetch weather data
 * @returns {Promise<Weather | null>}
 */
export async function getWeather() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return null;
  }

  try {
    const weather = await get('/api/weather');
    return normalizeWeather(weather);
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

/**
 * Fetch daily Islamic content
 * @returns {Promise<DailyContent>}
 */
export async function getDailyContent() {
  if (!isApiConfigured()) {
    console.warn('API not configured. Please configure the backend API.');
    return { verse: null, hadith: null };
  }

  try {
    return await get('/api/content/daily');
  } catch (error) {
    console.error('Failed to fetch daily content:', error);
    return { verse: null, hadith: null };
  }
}

// =====================================================
// Normalization helpers
// =====================================================

/**
 * Normalize the full payload from API.
 *
 * Implements the contract: GET /api/musallah/payload?board=...
 *   { boardConfig, frames: FrameDefinition[] }
 *
 * Each FrameDefinition has { frameType, slot, priority, durationInSeconds,
 * frameConfig } where frameConfig is a discriminated union keyed on
 * frameConfig.type. Frames are absent (not empty) when their source data
 * is missing — always check existence before reading.
 *
 * @param {any} payload
 * @returns {BoardPayload}
 */
function normalizePayload(payload) {
  const config = payload?.boardConfig && payload.boardConfig.location
    ? payload.boardConfig
    : getDefaultBoardConfig();

  const serverFrames = Array.isArray(payload?.frames) ? payload.frames : [];

  const getFrameType = (frame) => {
    const type = frame?.frameType;
    return typeof type === 'string' ? type.toLowerCase() : '';
  };

  const posterFrames = serverFrames.filter((f) => getFrameType(f) === 'poster');
  const eventListFrame = serverFrames.find((f) => getFrameType(f) === 'event_list');
  const dailyScheduleFrame = serverFrames.find((f) => getFrameType(f) === 'daily_schedule');
  const jummahFrame = serverFrames.find((f) => getFrameType(f) === 'jummah');
  const verseFrame = serverFrames.find(
    (f) => getFrameType(f) === 'islamic_quote' && f?.frameConfig?.kind === 'VERSE'
  );
  const hadithFrame = serverFrames.find(
    (f) => getFrameType(f) === 'islamic_quote' && f?.frameConfig?.kind === 'HADITH'
  );

  const posters = posterFrames.map((frame, index) => ({
    id: index + 1,
    title: frame.frameConfig?.title || `Poster ${index + 1}`,
    image: frame.frameConfig?.posterUrl || '',
    duration: (frame.durationInSeconds ?? 10) * 1000,
    startDate: null,
    endDate: null,
    audience: 'both',
  }));

  // Merge events from event_list (week) and daily_schedule (today) into a
  // single pool — the slideshow filters by date client-side, so duplicates
  // across the two frames don't matter as long as ids are stable.
  const rawEvents = [
    ...(eventListFrame?.frameConfig?.events ?? []),
    ...(dailyScheduleFrame?.frameConfig?.events ?? []),
  ];
  const events = rawEvents.map(normalizeEvent);

  const jummahPrayers = (jummahFrame?.frameConfig?.prayers ?? []).map(
    normalizeJummahSlot
  );

  const dailyContent = {
    verse: verseFrame ? normalizeIslamicQuote(verseFrame.frameConfig) : null,
    hadith: hadithFrame ? normalizeIslamicQuote(hadithFrame.frameConfig) : null,
  };

  return {
    boardConfig: config,
    events,
    posters,
    jummahPrayers,
    frames: buildDefaultFrameDefinitions(posters),
    dailyContent,
    weather: null,
  };
}

/**
 * Normalize a JummahSlot (ISO LocalTime) into the frontend's display shape
 * with a 12-hour AM/PM `time` string.
 * @param {{ prayerTime?: string, khatib?: string, location?: string }} prayer
 * @param {number} index
 */
function normalizeJummahSlot(prayer, index) {
  let timeStr = prayer?.prayerTime || '';

  if (timeStr.includes(':')) {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    timeStr = `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;
  }

  return {
    id: index + 1,
    time: timeStr,
    khatib: prayer?.khatib || '',
    location: prayer?.location || '',
    audience: 'both',
  };
}

/**
 * Normalize an IslamicQuoteFrameConfig into the frontend's IslamicQuote.
 * @param {{ arabic?: string, transliteration?: string|null, translation?: string, reference?: string }} cfg
 */
function normalizeIslamicQuote(cfg) {
  return {
    arabic: cfg?.arabic ?? '',
    transliteration: cfg?.transliteration ?? '',
    translation: cfg?.translation ?? '',
    reference: cfg?.reference ?? '',
  };
}

/**
 * Normalize an event from API. Accepts both the new EventView shape and
 * legacy variants from the standalone /api/events endpoint.
 * @param {any} event
 * @returns {Event}
 */
function normalizeEvent(event) {
  const start = event.startTimestamp ?? new Date(event.startTime || event.start).getTime();
  const end = event.endTimestamp ?? new Date(event.endTime || event.end).getTime();

  let startTimestamp = Number.isFinite(start) ? start : null;
  let endTimestamp = Number.isFinite(end) ? end : null;

  // Defensive normalization: some payloads arrive with the window reversed.
  // Swap those so day/week filters still see the event.
  if (
    startTimestamp !== null &&
    endTimestamp !== null &&
    endTimestamp < startTimestamp
  ) {
    [startTimestamp, endTimestamp] = [endTimestamp, startTimestamp];
  }

  const safeStart = startTimestamp ?? endTimestamp ?? Date.now();
  const safeEnd = endTimestamp ?? startTimestamp ?? safeStart;

  return {
    id: event.id ?? `${event.name || 'event'}-${safeStart}`,
    name: event.name || event.title || '',
    startTimestamp: safeStart,
    endTimestamp: safeEnd,
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
