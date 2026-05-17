import { toMinutes, PRAYER_ORDER } from '../models/index.js';

/**
 * Classify the prayer schedule against `now` into current / next / passed.
 * Mirrors the design prototype's rail logic.
 * @param {object} prayers  { fajr:{adhan}, sunrise, ... }
 * @param {Date} now
 */
export function classifyPrayers(prayers, now) {
  const ordered = PRAYER_ORDER.filter((k) => prayers?.[k]?.adhan);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const nextIdx = ordered.findIndex((k) => toMinutes(prayers[k].adhan) > nowM);
  const next = nextIdx === -1 ? ordered[0] : ordered[nextIdx];
  const current =
    nextIdx === -1
      ? ordered[ordered.length - 1]
      : nextIdx === 0
      ? null
      : ordered[nextIdx - 1];
  return { ordered, next, current };
}
