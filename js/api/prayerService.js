/**
 * =====================================================
 * Prayer Service
 * =====================================================
 * Service layer for fetching prayer times from Aladhan API.
 * This is fetched directly from the frontend (not via backend).
 * =====================================================
 */

import { parseTimeString } from '../models/index.js';

/**
 * @typedef {import('../models/index.js').Location} Location
 * @typedef {import('../models/index.js').PrayerTimes} PrayerTimes
 * @typedef {import('../models/index.js').HijriDate} HijriDate
 */

const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1';

/**
 * @typedef {Object} PrayerTimesResponse
 * @property {PrayerTimes} timings - Prayer times
 * @property {HijriDate} hijriDate - Hijri date info
 */

/**
 * Format a Date object to Aladhan's expected format (DD-MM-YYYY)
 * @param {Date} date
 * @returns {string}
 */
function formatDateForAladhan(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Build a Date at today's date from a prayer time string.
 * @param {string} timeStr
 * @param {Date} baseDate
 * @returns {Date | null}
 */
function buildPrayerDate(timeStr, baseDate) {
  if (!timeStr) return null;
  const parsed = parseTimeString(timeStr);
  if (!Number.isFinite(parsed.hours) || !Number.isFinite(parsed.minutes)) {
    return null;
  }
  const date = new Date(baseDate);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

/**
 * Compute current/next prayer and countdown in a resilient way.
 * @param {PrayerTimes} prayerTimes
 * @param {Date} [now]
 * @param {import('../models/index.js').ParsedTime | null} [tomorrowFajr]
 * @returns {{
 *   current: string | null,
 *   next: string | null,
 *   nextTime: Date | null,
 *   countdown: { hours: number, minutes: number, seconds: number, totalMs: number } | null,
 *   isAfterIsha: boolean
 * }}
 */
export function getPrayerState(prayerTimes, now = new Date(), tomorrowFajr = null) {
  if (!prayerTimes) {
    return {
      current: null,
      next: null,
      nextTime: null,
      countdown: null,
      isAfterIsha: false,
    };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const prayersInOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const schedule = prayersInOrder
    .map((name) => ({ name, time: buildPrayerDate(prayerTimes[name], today) }))
    .filter((entry) => entry.time instanceof Date);

  const sunriseTime = buildPrayerDate(prayerTimes.Sunrise, today);
  const dhuhrTime = buildPrayerDate(prayerTimes.Dhuhr, today);
  const isBetweenSunriseAndDhuhr =
    sunriseTime && dhuhrTime && now > sunriseTime && now < dhuhrTime;

  let current = null;
  let next = null;

  for (const entry of schedule) {
    if (entry.time <= now) {
      current = entry.name;
    } else if (!next) {
      next = entry.name;
    }
  }

  const fajrEntry = schedule.find((entry) => entry.name === 'Fajr');
  const isBeforeFajr = fajrEntry ? now < fajrEntry.time : false;

  if (isBeforeFajr) {
    current = 'Isha';
  }

  if (isBetweenSunriseAndDhuhr) {
    current = null;
  }

  const isAfterIsha = !next;
  if (!next) {
    next = 'Fajr';
  }

  let nextTime = null;
  if (next === 'Fajr') {
    if (tomorrowFajr) {
      nextTime = new Date(now);
      nextTime.setHours(tomorrowFajr.hours, tomorrowFajr.minutes, 0, 0);
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
    } else if (fajrEntry?.time) {
      nextTime = new Date(fajrEntry.time);
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
    }
  } else {
    nextTime = schedule.find((entry) => entry.name === next)?.time ?? null;
  }

  const countdown = nextTime
    ? calculateCountdownTo(nextTime, now)
    : null;

  return {
    current,
    next,
    nextTime,
    countdown,
    isAfterIsha,
  };
}

/**
 * Calculate countdown to a target Date.
 * @param {Date} targetTime
 * @param {Date} [now]
 * @returns {{ hours: number, minutes: number, seconds: number, totalMs: number }}
 */
function calculateCountdownTo(targetTime, now = new Date()) {
  const diff = Math.max(0, targetTime - now);

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    totalMs: diff,
  };
}

/**
 * Fetch prayer times for a specific date
 * @param {Location} location - Location settings
 * @param {Date} [date] - Date to fetch (defaults to today)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeHanafi] - Include Hanafi Asr time
 * @returns {Promise<PrayerTimesResponse>}
 */
export async function getPrayerTimes(location, date = new Date(), options = {}) {
  const { latitude, longitude, method = 2 } = location;
  const dateStr = formatDateForAladhan(date);
  const { includeHanafi = true } = options;

  const url = `${ALADHAN_BASE_URL}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;

  try {
    const [standardResponse, hanafiResponse] = await Promise.all([
      fetch(url),
      includeHanafi ? fetch(`${url}&school=1`) : Promise.resolve(null),
    ]);

    if (!standardResponse.ok) {
      throw new Error(`Failed to fetch prayer times: ${standardResponse.status}`);
    }

    const standardData = await standardResponse.json();

    if (standardData.code !== 200) {
      throw new Error(standardData.status || 'Failed to fetch prayer times');
    }

    const timings = { ...standardData.data.timings };

    // Add Hanafi Asr if fetched
    if (hanafiResponse) {
      const hanafiData = await hanafiResponse.json();
      if (hanafiData.code === 200) {
        timings.hanafiAsr = hanafiData.data.timings.Asr;
      }
    }

    return {
      timings,
      hijriDate: standardData.data.date.hijri,
    };
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    throw error;
  }
}

/**
 * Fetch tomorrow's Fajr time (useful after Isha)
 * @param {Location} location
 * @returns {Promise<string>} Tomorrow's Fajr time
 */
export async function getTomorrowFajr(location) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { timings } = await getPrayerTimes(location, tomorrow, { includeHanafi: false });
  return timings.Fajr;
}

/**
 * Calculate the next prayer based on current time and prayer times
 * @param {PrayerTimes} prayerTimes
 * @param {Date} [now]
 * @returns {{ current: string | null, next: string, isAfterIsha: boolean }}
 */
export function calculateNextPrayer(prayerTimes, now = new Date(), tomorrowFajr = null) {
  const { current, next, isAfterIsha } = getPrayerState(prayerTimes, now, tomorrowFajr);

  return {
    current,
    next,
    isAfterIsha,
  };
}

/**
 * Calculate countdown to next prayer
 * @param {string} nextPrayer - Name of next prayer
 * @param {PrayerTimes} prayerTimes - Today's prayer times
 * @param {import('../models/index.js').ParsedTime} [tomorrowFajr] - Tomorrow's Fajr (if after Isha)
 * @param {Date} [now]
 * @returns {{ hours: number, minutes: number, seconds: number, totalMs: number }}
 */
export function calculateCountdown(nextPrayer, prayerTimes, tomorrowFajr = null, now = new Date()) {
  const state = getPrayerState(prayerTimes, now, tomorrowFajr);
  const targetTime = state.nextTime;

  if (!targetTime) {
    return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  return calculateCountdownTo(targetTime, now);
}

/**
 * Format countdown as HH:MM:SS string
 * @param {{ hours: number, minutes: number, seconds: number }} countdown
 * @returns {string}
 */
export function formatCountdown(countdown) {
  const { hours, minutes, seconds } = countdown;
  return [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Format Hijri date for display
 * @param {HijriDate} hijriDate
 * @returns {string}
 */
export function formatHijriDate(hijriDate) {
  if (!hijriDate) return '';
  const { day, month, year } = hijriDate;
  return `${day} ${month.en} ${year} AH`;
}
