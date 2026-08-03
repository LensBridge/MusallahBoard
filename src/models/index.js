/**
 * =====================================================
 * MusallahBoard Data Models + Normalizers
 * =====================================================
 * The wire types below mirror the LensBridge OpenAPI spec
 * (GET /api/musallah/*). UI code consumes the *normalized*
 * design shape produced by normalizePayload(), not the raw
 * wire types.
 * =====================================================
 */

// ---------------------------------------------------------------------------
// Wire contract (authoritative — from /v3/api-docs)
// ---------------------------------------------------------------------------
//
// GET /api/musallah/payload?deviceId=<uuid>  -> MusallahBoardPayload
//   { deviceConfig: DeviceConfig, frames: FrameDefinition[] }
//
// DeviceConfig {
//   id: uuid, location: Location, darkModeAfterIsha: bool,
//   enableScrollingMessage: bool, scrollingMessages: string[]
// }
// Location { city, country, latitude, longitude, timezone, method }
//   method ∈ KARACHI|ISNA|MWL|MAKKAH|EGYPT|TEHRAN|GULF|KUWAIT|QATAR|
//            SINGAPORE|FRANCE|TURKEY|RUSSIA|DUBAI
// FrameDefinition {
//   frameType ∈ poster|event_list|daily_schedule|next_prayer|jummah|islamic_quote,
//   durationInSeconds: int, slot ∈ PRIMARY|TICKER|SIDEBAR|OVERLAY,
//   priority: int, frameConfig: <discriminated on .type>
// }
//   PosterFrameConfig        { type, posterUrl, title }
//   EventListFrameConfig     { type, heading, events: EventView[] }
//   DailyScheduleFrameConfig { type, heading, events: EventView[] }
//   JummahFrameConfig        { type, prayers: JummahSlot[] }
//   IslamicQuoteFrameConfig  { type, kind: VERSE|HADITH, arabic,
//                              transliteration, translation, reference }
// EventView { name, description, location, startTime(ISO), endTime(ISO), allDay }
// JummahSlot { prayerTime, khatib, room }
// ---------------------------------------------------------------------------

/** Prayer calculation method enum → Aladhan numeric method id. */
export const ALADHAN_METHOD = {
  KARACHI: 1, ISNA: 2, MWL: 3, MAKKAH: 4, EGYPT: 5, TEHRAN: 7,
  GULF: 8, KUWAIT: 9, QATAR: 10, SINGAPORE: 11, FRANCE: 12,
  TURKEY: 13, RUSSIA: 14, DUBAI: 16,
};

export const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_LABELS = {
  fajr:    { english: 'Fajr',    arabic: 'الْفَجْر' },
  sunrise: { english: 'Sunrise', arabic: 'الشُّرُوق' },
  dhuhr:   { english: 'Dhuhr',   arabic: 'الظُّهْر' },
  asr:     { english: 'Asr',     arabic: 'الْعَصْر' },
  maghrib: { english: 'Maghrib', arabic: 'الْمَغْرِب' },
  isha:    { english: 'Isha',    arabic: 'الْعِشَاء' },
};

const HIJRI_MONTH_AR = {
  Muharram: 'مُحَرَّم', Safar: 'صَفَر',
  'Rabi al-awwal': 'رَبِيع ٱلْأَوَّل', "Rabi' al-awwal": 'رَبِيع ٱلْأَوَّل',
  'Rabi al-thani': 'رَبِيع ٱلثَّانِي', "Rabi' al-thani": 'رَبِيع ٱلثَّانِي',
  'Jumada al-awwal': 'جُمَادَىٰ ٱلْأُولَىٰ', 'Jumada al-thani': 'جُمَادَىٰ ٱلثَّانِيَة',
  Rajab: 'رَجَب', "Sha'ban": 'شَعْبَان', Shaban: 'شَعْبَان',
  Ramadan: 'رَمَضَان', Shawwal: 'شَوَّال',
  "Dhul-Qadah": 'ذُو ٱلْقَعْدَة', 'Dhu al-Qadah': 'ذُو ٱلْقَعْدَة',
  "Dhul-Hijjah": 'ذُو ٱلْحِجَّة', 'Dhu al-Hijjah': 'ذُو ٱلْحِجَّة',
};

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "14:05" | "2:05 PM" -> { hours, minutes } (NaN on parse failure). */
export function parseTimeString(timeStr) {
  if (!timeStr) return { hours: NaN, minutes: NaN };
  const s = String(timeStr).trim();
  const m = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return { hours: NaN, minutes: NaN };
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const period = (s.match(/\b(AM|PM)\b/i) || [])[1];
  if (period) {
    const p = period.toUpperCase();
    if (p === 'PM' && hours !== 12) hours += 12;
    if (p === 'AM' && hours === 12) hours = 0;
  }
  return { hours, minutes };
}

/** "HH:MM" 24h -> "H:MM AM/PM". */
export function formatTo12(time24) {
  const { hours, minutes } = parseTimeString(time24);
  if (!Number.isFinite(hours)) return '--:--';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hh = hours % 12 || 12;
  return `${hh}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/** Minutes-since-midnight for an "HH:MM" string. */
export function toMinutes(time24) {
  const { hours, minutes } = parseTimeString(time24);
  return Number.isFinite(hours) ? hours * 60 + minutes : NaN;
}

/**
 * Format an ISO instant as "HH:MM" (24h) in a given IANA timezone.
 * Falls back to the runtime's local zone when timezone is absent.
 */
export function isoToHM(iso, timezone) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: timezone || undefined,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const mi = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h === '24' ? '00' : h}:${mi}`;
  } catch {
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes().toString().padStart(2, '0')}`;
  }
}

/**
 * Wall-clock parts at `instant` as read in `timezone`.
 *
 * The board's clock, its prayer times and its event times must all be read in
 * the *board's* zone, not the browser's. Aladhan returns timings for the
 * configured lat/long, so comparing them against `Date#getHours()` is only
 * correct while the Pi's OS timezone happens to match `location.timezone` —
 * and it is exactly the "happens to" cases (a reimaged box, a VM left on UTC)
 * where the board then highlights the wrong prayer.
 *
 * @param {Date} instant
 * @param {string} [timezone] IANA zone; falls back to the runtime's own
 * @returns {{hours:number, minutes:number, seconds:number, weekday:number}}
 *   weekday is 0=Sunday … 6=Saturday
 */
export function zonedClock(instant, timezone) {
  const d = instant instanceof Date ? instant : new Date(instant);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'short',
      timeZone: timezone || undefined,
    }).formatToParts(d);
    const num = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const wk = WEEKDAYS.indexOf(parts.find((p) => p.type === 'weekday')?.value);
    // hour12:false still yields "24" for midnight in some ICU versions.
    return {
      hours: num('hour') % 24,
      minutes: num('minute'),
      seconds: num('second'),
      weekday: wk === -1 ? d.getDay() : wk,
    };
  } catch {
    return {
      hours: d.getHours(), minutes: d.getMinutes(),
      seconds: d.getSeconds(), weekday: d.getDay(),
    };
  }
}

/** Minutes since midnight at `instant`, read in `timezone`. */
export function zonedMinutes(instant, timezone) {
  const { hours, minutes } = zonedClock(instant, timezone);
  return hours * 60 + minutes;
}

/** Seconds since midnight at `instant`, read in `timezone`. */
export function zonedSeconds(instant, timezone) {
  const { hours, minutes, seconds } = zonedClock(instant, timezone);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Calendar date ("YYYY-MM-DD") for an instant in a given timezone. Accepts a
 * Date or an ISO string. Used to bucket events onto the right day regardless
 * of the runtime's local zone.
 */
export function isoDateKey(input, timezone) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      timeZone: timezone || undefined,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Payload normalization → design data shape
// ---------------------------------------------------------------------------

/** Indexed to match Date#getDay() — 0 = Sunday. Used for weekday arithmetic. */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Days in the agenda frame's rolling window: today plus the next six. */
export const AGENDA_DAYS = 7;

function normalizeQuote(cfg) {
  if (!cfg) return null;
  return {
    arabic: cfg.arabic ?? '',
    translit: cfg.transliteration ?? '',
    translation: cfg.translation ?? '',
    reference: cfg.reference ?? '',
  };
}

/**
 * Normalize a raw OpenWeatherMap "current weather" response (now shipped
 * inside the board payload as `payload.weather`) into the chip shape the
 * TopBar consumes. Returns null when the field is absent so the chip hides.
 * The backend requests metric units, so `main.temp` is already °C.
 *
 * @param {any} raw   raw OWM response, or null/undefined
 * @param {string} [cityFallback]  deviceConfig location city
 */
function normalizeWeather(raw, cityFallback) {
  if (!raw || typeof raw !== 'object' || raw.main?.temp == null) return null;
  return {
    temp: Math.round(raw.main.temp),
    condition: raw.weather?.[0]?.main || raw.weather?.[0]?.description || 'Clear',
    city: cityFallback || raw.name || '',
  };
}

function normalizeJummah(slot) {
  return {
    time: slot?.prayerTime ? formatTo12(slot.prayerTime) : '',
    khatib: slot?.khatib ?? '',
    room: slot?.room ?? '',
  };
}

/** Default board config when the API is unreachable. */
export function emptyDeviceConfig() {
  return {
    id: null,
    location: { city: '', country: '', latitude: 43.5489, longitude: -79.6624, timezone: 'America/Toronto', method: 'ISNA' },
    darkModeAfterIsha: true,
    enableScrollingMessage: false,
    scrollingMessages: [],
    // Optional per-device destination for the closing slide's QR code. Empty
    // means the board falls back to the app-level Instagram URL.
    socialUrl: '',
  };
}

/**
 * Flatten MusallahBoardPayload into the shape the design components consume.
 * Prayer times + Hijri date are NOT in the payload — they are layered on
 * later in App from the prayer service. Weather, however, now rides along
 * in the payload (`payload.weather`, raw OpenWeatherMap response).
 *
 * @param {any} payload  raw MusallahBoardPayload
 * @returns {{
 *   deviceConfig: object,
 *   frames: any[],
 *   weather: {temp:number,condition:string,city:string}|null,
 *   posters: {title:string,image:string,signupUrl:string,durationMs:number}[],
 *   weekEvents: object[],
 *   todayEvents: object[],
 *   jummahPrayers: object[],
 *   verse: object|null,
 *   hadith: object|null,
 *   scrollingMessages: string[],
 * }}
 */
export function normalizePayload(payload) {
  const deviceConfig = {
    ...emptyDeviceConfig(),
    ...(payload?.deviceConfig || {}),
    location: {
      ...emptyDeviceConfig().location,
      ...(payload?.deviceConfig?.location || {}),
    },
  };

  const rawFrames = Array.isArray(payload?.frames) ? payload.frames : [];

  // Stable slideshow order: by slot, then priority desc, preserving input
  // order as the tiebreaker.
  const SLOT_RANK = { PRIMARY: 0, SIDEBAR: 1, OVERLAY: 2, TICKER: 3 };
  const frames = rawFrames
    .map((f, i) => ({ ...f, _i: i }))
    .sort((a, b) => {
      const sa = SLOT_RANK[a.slot] ?? 9;
      const sb = SLOT_RANK[b.slot] ?? 9;
      if (sa !== sb) return sa - sb;
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return a._i - b._i;
    });

  const tz = deviceConfig.location?.timezone;
  const ft = (f) => String(f?.frameType || '').toLowerCase();

  const posters = frames
    .filter((f) => ft(f) === 'poster')
    .map((f) => ({
      title: f.frameConfig?.title || '',
      image: f.frameConfig?.posterUrl || '',
      // Optional. When set, PosterSlide renders the poster beside a QR code
      // instead of full-bleed.
      signupUrl: f.frameConfig?.signupUrl || '',
      durationMs: (f.durationInSeconds ?? 10) * 1000,
    }));

  const eventListFrame = frames.find((f) => ft(f) === 'event_list');
  const dailyFrame = frames.find((f) => ft(f) === 'daily_schedule');
  const jummahFrame = frames.find((f) => ft(f) === 'jummah');

  // Unified event pool drawn ONLY from the /payload frames. event_list is the
  // week feed; daily_schedule is today's, and is folded in so an all-day event
  // that the week frame happens to miss still reaches the pool.
  const eventSeen = new Set();
  const eventPool = [
    ...(eventListFrame?.frameConfig?.events ?? []),
    ...(dailyFrame?.frameConfig?.events ?? []),
  ].filter((e) => {
    const k = `${e?.name}|${e?.startTime}|${e?.endTime}`;
    if (eventSeen.has(k)) return false;
    eventSeen.add(k);
    return true;
  });
  const verseFrame = frames.find(
    (f) => ft(f) === 'islamic_quote' && f.frameConfig?.kind === 'VERSE'
  );
  const hadithFrame = frames.find(
    (f) => ft(f) === 'islamic_quote' && f.frameConfig?.kind === 'HADITH'
  );

  // The agenda frame buckets these by calendar day, so the day key is resolved
  // here — once, in the board's zone — rather than re-derived per render.
  const weekEvents = eventPool.map((e) => {
    const epoch = e.startTime ? new Date(e.startTime).getTime() : NaN;
    return {
      name: e.name || '',
      room: e.location || '',
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: Boolean(e.allDay),
      dateKey: isoDateKey(e.startTime, tz),
      epoch: Number.isFinite(epoch) ? epoch : 0,
      hm: isoToHM(e.startTime, tz),
    };
  });

  // Today's events. The backend scopes its daily_schedule frame to the device's
  // own day, so prefer it; fall back to filtering the pool ourselves when the
  // frame is absent (it is omitted entirely on a day with nothing on).
  const todayKey = isoDateKey(new Date(), tz);
  const todaySource = dailyFrame
    ? (dailyFrame.frameConfig?.events ?? [])
    : eventPool.filter((e) => e.startTime && isoDateKey(e.startTime, tz) === todayKey);
  const todayEvents = todaySource
    .slice()
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((e, i) => ({
      id: i + 1,
      name: e.name || '',
      room: e.location || '',
      start: isoToHM(e.startTime, tz),
      end: isoToHM(e.endTime, tz),
      allDay: Boolean(e.allDay),
    }));

  const jummahPrayers = (jummahFrame?.frameConfig?.prayers ?? []).map(
    normalizeJummah
  );

  return {
    deviceConfig,
    frames,
    weather: normalizeWeather(payload?.weather, deviceConfig.location?.city),
    posters,
    weekEvents,
    todayEvents,
    jummahPrayers,
    verse: normalizeQuote(verseFrame?.frameConfig),
    hadith: normalizeQuote(hadithFrame?.frameConfig),
    scrollingMessages: deviceConfig.enableScrollingMessage
      ? deviceConfig.scrollingMessages || []
      : [],
  };
}

/**
 * Seven consecutive day buckets starting at `now`, read in the board's zone.
 *
 * Days are generated from the calendar rather than from the events, so an empty
 * day still knows its own date. The previous buildWeekColumns() derived each
 * column's date number from that column's first event, which left quiet days
 * with a blank number — tolerable on a Mon–Sun grid where most days had
 * something, unacceptable on a rolling window where most days often don't.
 *
 * Dates advance through Date.UTC(y, m, d + i) instead of adding 86_400_000ms:
 * across a DST transition the millisecond arithmetic skips or repeats a local
 * calendar date, and these boards run in America/Toronto. Building each day at
 * UTC midnight also makes `toISOString().slice(0, 10)` an exact day key.
 *
 * @param {object[]} weekEvents normalized events (carry dateKey/epoch/hm)
 * @param {Date} now            the board's clock (honours the debug offset)
 * @param {string} [timezone]   IANA zone; falls back to the runtime's own
 * @returns {{key:string, weekday:string, date:string, month:string,
 *            offset:number, isToday:boolean, isTomorrow:boolean,
 *            events:{t:string,n:string,r:string,allDay:boolean}[]}[]}
 */
export function buildAgendaDays(weekEvents, now, timezone) {
  const [y, m, d] = isoDateKey(now, timezone).split('-').map(Number);

  // All-day entries sort ahead of timed ones: they frame the whole day rather
  // than occupying a slot in it, so a 9am talk listed above "Eid Weekend" reads
  // as though the weekend starts at 9.
  const buckets = new Map();
  for (const ev of [...(weekEvents || [])].sort(
    (a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.epoch - b.epoch
  )) {
    if (!ev?.dateKey) continue;
    if (!buckets.has(ev.dateKey)) buckets.set(ev.dateKey, []);
    buckets.get(ev.dateKey).push({
      t: ev.allDay ? 'All Day' : formatTo12(ev.hm),
      n: ev.name,
      r: ev.room,
      allDay: ev.allDay,
    });
  }

  const label = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });

  const out = [];
  for (let i = 0; i < AGENDA_DAYS; i++) {
    const at = new Date(Date.UTC(y, m - 1, d + i));
    const parts = label.formatToParts(at);
    const part = (t) => parts.find((p) => p.type === t)?.value ?? '';
    const key = at.toISOString().slice(0, 10);
    out.push({
      key,
      weekday: part('weekday'),
      date: part('day'),
      month: part('month'),
      offset: i,
      isToday: i === 0,
      isTomorrow: i === 1,
      events: buckets.get(key) ?? [],
    });
  }
  return out;
}

/** Build the design's hijri date block from an Aladhan hijri object. */
export function buildHijri(hijri) {
  if (!hijri) return { day: '', monthEn: '', monthAr: '', year: '' };
  const en = hijri.month?.en || '';
  return {
    day: hijri.day || '',
    monthEn: en,
    monthAr: hijri.month?.ar || HIJRI_MONTH_AR[en] || '',
    year: hijri.year || '',
  };
}
