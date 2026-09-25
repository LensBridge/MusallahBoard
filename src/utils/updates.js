/**
 * =====================================================
 * Update notice
 * =====================================================
 * The agent holds board software from the release
 * channels until the board's quiet window (23:00 by
 * default) and lists it under `updates` in
 * /api/local/status (agent/docs/architecture.md,
 * section 9.4):
 *
 *   { available: [{ type, version, description }],
 *     installTime: "23:00",
 *     installAt: "2026-09-30T23:00:00-04:00" | null,
 *     installing: false }
 *
 * While something waits, the ticker says so.
 * =====================================================
 */

import { isoDateKey, zonedClock } from '../models/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "11:00 PM" in the board's zone. */
function clockTime(instant, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: timezone || undefined,
    }).format(instant);
  } catch {
    return instant.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

/** "tonight", "tomorrow", "on Friday": when `at` falls, seen from `now`. */
function dayWords(at, now, timezone) {
  const evening = zonedClock(at, timezone).hours >= 17;
  const day = isoDateKey(at, timezone);
  if (day === isoDateKey(now, timezone)) return evening ? 'tonight' : 'today';
  if (day === isoDateKey(new Date(now.getTime() + DAY_MS), timezone)) {
    return evening ? 'tomorrow night' : 'tomorrow';
  }
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', timeZone: timezone || undefined,
    }).format(at);
    return `on ${weekday}`;
  } catch {
    return `on ${day}`;
  }
}

/**
 * The ticker line for waiting updates, or null when nothing waits.
 * @param {{available?: {description:string}[], installAt?: string|null, installing?: boolean}|null|undefined} updates
 * @param {Date} now
 * @param {string} [timezone] the board's IANA zone
 * @returns {string|null}
 */
export function updateNotice(updates, now, timezone) {
  const available = updates?.available ?? [];
  if (!available.length) return null;
  const what = available.map((u) => u.description).join(' and ');
  if (updates.installing) return `Installing update: ${what}`;
  const at = updates.installAt ? new Date(updates.installAt) : null;
  if (!at || Number.isNaN(at.getTime()) || at.getTime() - now.getTime() < 60 * 1000) {
    return `Update available: ${what} will be installed shortly`;
  }
  return `Update available: ${what} will be installed at ${clockTime(at, timezone)} ${dayWords(at, now, timezone)}`;
}
