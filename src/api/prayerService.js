/**
 * =====================================================
 * Prayer Service
 * =====================================================
 * Prayer times + Hijri date are computed on the board:
 * times with the `adhan` package, the Hijri date with
 * Intl's Umm al-Qura calendar. The backend supplies only
 * location + calculation method (DeviceConfig.location).
 *
 * This used to call the Aladhan API. It is computed
 * locally now so a board with no internet (served by its agent,
 * see agent/docs/architecture.md) still shows correct times
 * indefinitely — and so an online board has one fewer
 * third party that can blank its prayer rail.
 * =====================================================
 */

import {
  Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule, Rounding,
} from 'adhan';
import { CALCULATION_METHODS, PRAYER_LABELS, isoDateKey } from '../models/index.js';

/** CALCULATION_METHODS entry for a backend method value; unknown → ISNA. */
function methodDef(method) {
  return CALCULATION_METHODS[String(method || '').toUpperCase()] ?? CALCULATION_METHODS.ISNA;
}

/**
 * adhan parameters matching Aladhan's definition of a method.
 *
 * Built from CalculationMethod.Other() for every method, never a named preset:
 * see CALCULATION_METHODS for where adhan's presets and Aladhan disagree.
 * Asr is not taken from these parameters at all — see asrInstant().
 *
 * TwilightAngle is adhan's name for Aladhan's default latitude adjustment
 * (ANGLE_BASED): Fajr/Isha are clamped to angle/60 of the night either side of
 * it. adhan defaults to MiddleOfTheNight, which only bites far enough north in
 * summer that the angle never occurs — not Mississauga, but a board in
 * Edmonton in June.
 *
 * @param {object} def   CALCULATION_METHODS entry
 * @param {{month:number}|null} hijri today's Hijri date, for Ramadan rules
 */
function paramsFor(def, hijri) {
  const params = CalculationMethod.Other();
  params.fajrAngle = def.fajr;
  params.ishaAngle = def.isha ?? 0;
  params.ishaInterval =
    (hijri?.month === 9 && def.ramadanIshaMinutes) || def.ishaMinutes || 0;
  params.maghribAngle = def.maghrib ?? 0;
  params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
  params.rounding = Rounding.Nearest;
  // Asr is overridden below; this only has to be a valid madhab.
  params.madhab = Madhab.Shafi;
  // Per-prayer minute offsets. Sunset is not a separate output here, so
  // Aladhan's Sunset offset (always equal to its Maghrib one) has no target.
  params.adjustments = { ...params.adjustments, ...(def.adjust || {}), asr: 0 };
  return params;
}

/** `instant` plus `minutes`, passing null through. */
function shiftMinutes(instant, minutes) {
  return instant && minutes ? new Date(instant.getTime() + minutes * 60_000) : instant;
}

// ---------------------------------------------------------------------------
// Asr
// ---------------------------------------------------------------------------
//
// Asr is the one prayer computed outside adhan, because Aladhan's Asr is not
// quite astronomical and the board has to agree with Aladhan, not the sky.
//
// Aladhan (islamic-network/prayer-times, a PrayTimes.js port) reads the sun's
// declination for the Asr *shadow angle* at gregoriantojd() — a noon-based day
// number — plus the wall-clock time of the API request, plus the 13:00 first
// guess: roughly a day after the Asr it is computing. The hour angle itself
// uses the ordinary declination. In December/January, when declination moves
// fastest relative to Asr, that shifts its Asr by 1–2 minutes; adhan (which
// reads the declination at 0h UT on the date, too *early*) lands 3 minutes
// the other way.
//
// The request time is not something the board can know, so ASR_DECL_OFFSET
// fixes it: 1.125 days after 0h UT is the value that centres the residual
// against Aladhan's published calendars (±0.63 min over Jan/Jun/Sep/Dec 2026,
// every method, Mississauga and Edmonton; see prayerService.test.js). Anything
// from ~0.25 to 1.5 keeps every day within a minute.

const ASR_DECL_OFFSET = 1.125;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => a - b * Math.floor(a / b);

/** Julian date at 0h UT of a civil date (Meeus). */
function julian(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/** Declination (degrees) and equation of time (hours) at Julian date `jd`. */
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return {
    decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))),
    eqt: q / 15 - ra,
  };
}

/**
 * Asr as an instant, for the civil date y-m-d at (lat, lng).
 * @param {number} shadow 1 = standard (Shafi'i/Maliki/Hanbali), 2 = Hanafi
 */
function asrInstant(y, m, d, lat, lng, shadow) {
  const guess = 13 / 24;
  // Shadow angle: from the day-late declination, as Aladhan does (see above).
  const shadowDecl = sunPosition(julian(y, m, d) + ASR_DECL_OFFSET + guess).decl;
  const altitude = deg(Math.atan(1 / (shadow + Math.tan(rad(Math.abs(lat - shadowDecl))))));
  // Hour angle: the usual local-solar 13:00 evaluation.
  const { decl, eqt } = sunPosition(julian(y, m, d) - lng / (15 * 24) + guess);
  const noon = fix(12 - eqt, 24);
  const cosH =
    (Math.sin(rad(altitude)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) /
    (Math.cos(rad(decl)) * Math.cos(rad(lat)));
  if (!(cosH >= -1 && cosH <= 1)) return null; // sun never reaches that altitude
  const utcHours = noon + deg(Math.acos(cosH)) / 15 - lng / 15;
  // Nearest minute, as Aladhan and the rest of the schedule round.
  const minutes = Math.round(utcHours * 60);
  return new Date(Date.UTC(y, m - 1, d) + minutes * 60_000);
}

/** "HH:MM" (24h) for an instant, read in `timezone`. */
function hm(instant, timezone) {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: timezone || undefined,
  }).formatToParts(instant);
  const part = (t) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
}

/**
 * Umm al-Qura Hijri date for the calendar day `date` falls on in `timezone`.
 *
 * Read as numbers: the month is mapped to a name by buildHijri(), not taken
 * from Intl, whose English spellings differ between ICU versions.
 *
 * @returns {{day:number, month:number, year:number}|null}
 */
export function hijriDate(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      timeZone: timezone || undefined,
    }).formatToParts(date);
    const num = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? '', 10);
    const out = { day: num('day'), month: num('month'), year: num('year') };
    return Object.values(out).every(Number.isFinite) ? out : null;
  } catch {
    return null;
  }
}

/**
 * Today's prayer schedule + Hijri date for a Location.
 *
 * "Today" is the calendar date in `location.timezone`, not the browser's: a Pi
 * left on UTC would otherwise show tomorrow's timings all evening. adhan reads
 * the date through the runtime's *local* getters (getFullYear/getMonth/getDate)
 * and computes everything else in UTC, so handing it a local-midnight Date built
 * from the board's date key pins the day regardless of the OS zone. The
 * resulting instants are then formatted back in the board's zone.
 *
 * Synchronous and cannot fail on the network; kept returning the same
 * `{ prayers, hijri }` shape the Aladhan version did.
 *
 * @param {{latitude:number,longitude:number,method:string,timezone?:string}} location
 * @param {Date} [date]
 * @returns {{ prayers: object, hijri: {day:number,month:number,year:number}|null }}
 */
export function getPrayerData(location, date = new Date()) {
  const { latitude, longitude, method, timezone } = location;
  const [y, m, d] = isoDateKey(date, timezone).split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const coords = new Coordinates(Number(latitude), Number(longitude));
  const def = methodDef(method);
  const hijri = hijriDate(date, timezone);

  const std = new PrayerTimes(coords, day, paramsFor(def, hijri));
  const t = (instant) => hm(instant, timezone);
  const asr = (shadow) =>
    t(shiftMinutes(asrInstant(y, m, d, coords.latitude, coords.longitude, shadow), def.adjust?.asr));

  const prayers = {
    fajr:    { adhan: t(std.fajr),    ...PRAYER_LABELS.fajr },
    sunrise: { adhan: t(std.sunrise), ...PRAYER_LABELS.sunrise },
    dhuhr:   { adhan: t(std.dhuhr),   ...PRAYER_LABELS.dhuhr },
    asr:     { adhan: asr(1),         ...PRAYER_LABELS.asr, hanafiAdhan: asr(2) || undefined },
    maghrib: { adhan: t(std.maghrib), ...PRAYER_LABELS.maghrib },
    isha:    { adhan: t(std.isha),    ...PRAYER_LABELS.isha },
  };

  return { prayers, hijri };
}
