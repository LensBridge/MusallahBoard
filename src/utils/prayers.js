import { toMinutes, zonedMinutes, PRAYER_ORDER } from '../models/index.js';

/**
 * Classify the prayer schedule against `now` into current / next / passed.
 * Mirrors the design prototype's rail logic.
 *
 * @param {object} prayers  { fajr:{adhan}, sunrise, ... }
 * @param {Date} now
 * @param {string} [timezone]  board timezone. Adhan times are computed for
 *   the board's coordinates and formatted in its zone, so they are that zone's wall clock — comparing
 *   them against the browser's clock only works while the two agree.
 */
export function classifyPrayers(prayers, now, timezone) {
  const ordered = PRAYER_ORDER.filter((k) => prayers?.[k]?.adhan);
  const nowM = zonedMinutes(now, timezone);
  const nextIdx = ordered.findIndex((k) => toMinutes(prayers[k].adhan) > nowM);
  const next = nextIdx === -1 ? ordered[0] : ordered[nextIdx];
  let current =
    nextIdx === -1
      ? ordered[ordered.length - 1]
      : nextIdx === 0
      ? null
      : ordered[nextIdx - 1];
  // Sunrise is a timeline marker, not a prayer — between sunrise and Dhuhr
  // nothing is "current"; only Dhuhr is highlighted as next.
  if (current === 'sunrise') current = null;
  return { ordered, next, current };
}

/**
 * Whether `now` falls between Maghrib (sunset) and the next sunrise, read on
 * the board's wall clock: the window the AUTO theme mode paints dark.
 *
 * Both ends come from today's schedule. That is exact at Maghrib and a minute
 * or so off at the small-hours end (tomorrow's sunrise, not today's), which
 * a theme switch can afford. With either time missing the answer is false:
 * a board that cannot place sunset stays on its light theme rather than
 * guessing.
 *
 * @param {object} prayers  { sunrise:{adhan}, maghrib:{adhan}, ... }
 * @param {Date} now
 * @param {string} [timezone]  board timezone, as for classifyPrayers
 * @returns {boolean}
 */
export function isAfterSunset(prayers, now, timezone) {
  const maghrib = prayers?.maghrib?.adhan;
  const sunrise = prayers?.sunrise?.adhan;
  if (!maghrib || !sunrise) return false;
  const nowM = zonedMinutes(now, timezone);
  return nowM >= toMinutes(maghrib) || nowM < toMinutes(sunrise);
}
