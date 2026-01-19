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
export function calculateNextPrayer(prayerTimes, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Prayers to check (excluding Sunrise which is not a prayer)
  const prayersToCheck = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Check if we're between Sunrise and Dhuhr (Fajr time has passed but it's not Dhuhr yet)
  const sunriseTime = parseTimeString(prayerTimes.Sunrise);
  const dhuhrTime = parseTimeString(prayerTimes.Dhuhr);
  const sunriseMinutes = sunriseTime.hours * 60 + sunriseTime.minutes;
  const dhuhrMinutes = dhuhrTime.hours * 60 + dhuhrTime.minutes;
  const isBetweenSunriseAndDhuhr = currentMinutes > sunriseMinutes && currentMinutes < dhuhrMinutes;

  let currentPrayer = null;
  let currentPrayerMinutes = -Infinity;
  let nextPrayer = null;
  let nextPrayerMinutes = Infinity;

  for (const prayer of prayersToCheck) {
    const time = parseTimeString(prayerTimes[prayer]);
    const prayerMinutes = time.hours * 60 + time.minutes;

    // Determine current prayer
    if (prayerMinutes <= currentMinutes && prayerMinutes > currentPrayerMinutes) {
      // Don't count Fajr as current if we're between Sunrise and Dhuhr
      if (!(isBetweenSunriseAndDhuhr && prayer === 'Fajr')) {
        currentPrayer = prayer;
        currentPrayerMinutes = prayerMinutes;
      }
    }

    // Determine next prayer
    if (prayerMinutes > currentMinutes && prayerMinutes < nextPrayerMinutes) {
      nextPrayer = prayer;
      nextPrayerMinutes = prayerMinutes;
    }
  }

  // If no next prayer found, it's Fajr tomorrow
  const isAfterIsha = !nextPrayer;
  if (!nextPrayer) {
    nextPrayer = 'Fajr';
  }

  return {
    current: isBetweenSunriseAndDhuhr ? null : currentPrayer,
    next: nextPrayer,
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
  let targetTime;

  if (nextPrayer === 'Fajr' && tomorrowFajr) {
    targetTime = new Date();
    targetTime.setHours(tomorrowFajr.hours, tomorrowFajr.minutes, 0, 0);
    
    // If target is in the past, it means we need tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
  } else {
    const time = parseTimeString(prayerTimes[nextPrayer]);
    targetTime = new Date();
    targetTime.setHours(time.hours, time.minutes, 0, 0);

    // Handle case where next prayer is Fajr but we don't have tomorrow's time
    if (nextPrayer === 'Fajr' && targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
  }

  const diff = Math.max(0, targetTime - now);

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    totalMs: diff,
  };
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
