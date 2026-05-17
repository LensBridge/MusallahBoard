/**
 * =====================================================
 * Prayer Service
 * =====================================================
 * Prayer times + Hijri date come from the Aladhan API
 * (fetched directly by the kiosk, not via the backend —
 * the backend only supplies location + calculation method
 * in the next_prayer frame / DeviceConfig.location).
 * =====================================================
 */

import { ALADHAN_METHOD, PRAYER_LABELS } from '../models/index.js';

const ALADHAN_BASE = 'https://api.aladhan.com/v1';

function fmtDate(date) {
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

function methodId(method) {
  return ALADHAN_METHOD[String(method || '').toUpperCase()] ?? ALADHAN_METHOD.ISNA;
}

/** "HH:MM" stripped of any "(EST)"-style suffix Aladhan appends. */
function clean(t) {
  return String(t || '').trim().split(' ')[0];
}

/**
 * Fetch today's prayer schedule + Hijri date for a Location.
 * @param {{latitude:number,longitude:number,method:string}} location
 * @param {Date} [date]
 * @returns {Promise<{ prayers: object, hijri: object|null }>}
 */
export async function getPrayerData(location, date = new Date()) {
  const { latitude, longitude, method } = location;
  const m = methodId(method);
  const url =
    `${ALADHAN_BASE}/timings/${fmtDate(date)}` +
    `?latitude=${latitude}&longitude=${longitude}&method=${m}`;

  const [stdRes, hanafiRes] = await Promise.all([
    fetch(url),
    fetch(`${url}&school=1`).catch(() => null),
  ]);

  if (!stdRes.ok) throw new Error(`Aladhan ${stdRes.status}`);
  const std = await stdRes.json();
  if (std.code !== 200) throw new Error(std.status || 'Aladhan error');

  const t = std.data.timings;
  let hanafiAsr = null;
  if (hanafiRes && hanafiRes.ok) {
    const h = await hanafiRes.json().catch(() => null);
    if (h?.code === 200) hanafiAsr = clean(h.data.timings.Asr);
  }

  const prayers = {
    fajr:    { adhan: clean(t.Fajr),    ...PRAYER_LABELS.fajr },
    sunrise: { adhan: clean(t.Sunrise), ...PRAYER_LABELS.sunrise },
    dhuhr:   { adhan: clean(t.Dhuhr),   ...PRAYER_LABELS.dhuhr },
    asr:     { adhan: clean(t.Asr),     ...PRAYER_LABELS.asr, hanafiAdhan: hanafiAsr || undefined },
    maghrib: { adhan: clean(t.Maghrib), ...PRAYER_LABELS.maghrib },
    isha:    { adhan: clean(t.Isha),    ...PRAYER_LABELS.isha },
  };

  return { prayers, hijri: std.data.date?.hijri ?? null };
}
