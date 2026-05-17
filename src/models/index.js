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
//   id: uuid, location: Location, posterCycleIntervalMs: int,
//   refreshAfterIshaMinutes: int, darkModeAfterIsha: bool,
//   darkModeAfterMaghribMinutes: int, enableScrollingMessage: bool,
//   scrollingMessages: string[]
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
//   NextPrayerFrameConfig    { type, locationCity, timezone, calculationMethod }
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

/** Day-of-week + numeric day for an ISO instant in a timezone. */
function isoDayParts(iso, timezone) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: timezone || undefined,
  }).formatToParts(d);
  return {
    weekday: fmt.find((p) => p.type === 'weekday')?.value ?? '',
    day: fmt.find((p) => p.type === 'day')?.value ?? '',
    month: fmt.find((p) => p.type === 'month')?.value ?? '',
    epoch: d.getTime(),
  };
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function normalizeQuote(cfg) {
  if (!cfg) return null;
  return {
    arabic: cfg.arabic ?? '',
    translit: cfg.transliteration ?? '',
    translation: cfg.translation ?? '',
    reference: cfg.reference ?? '',
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
    posterCycleIntervalMs: 10000,
    refreshAfterIshaMinutes: 30,
    darkModeAfterIsha: true,
    darkModeAfterMaghribMinutes: 30,
    enableScrollingMessage: false,
    scrollingMessages: [],
  };
}

/**
 * Flatten MusallahBoardPayload into the shape the design components consume.
 * Prayer times + Hijri date are NOT in the payload — they are layered on
 * later in App from the prayer service. Weather is layered similarly.
 *
 * @param {any} payload  raw MusallahBoardPayload
 * @returns {{
 *   deviceConfig: object,
 *   frames: any[],
 *   posters: {title:string,image:string,durationMs:number}[],
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
      durationMs: (f.durationInSeconds ?? 10) * 1000,
    }));

  const eventListFrame = frames.find((f) => ft(f) === 'event_list');
  const dailyFrame = frames.find((f) => ft(f) === 'daily_schedule');
  const jummahFrame = frames.find((f) => ft(f) === 'jummah');

  // Unified event pool drawn ONLY from the /payload frames (event_list is the
  // general events feed; daily_schedule is folded in when present but is not
  // required). The Today view is derived from this pool on the frontend, so
  // it renders whether or not the backend ships a daily_schedule frame.
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

  const weekEvents = eventPool.map((e) => ({
    name: e.name || '',
    room: e.location || '',
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: Boolean(e.allDay),
    ...isoDayParts(e.startTime, tz),
    hm: isoToHM(e.startTime, tz),
  }));

  // Frontend-managed Today view: filter the payload event pool to events that
  // start today (in the board's timezone), ordered by start time.
  const todayKey = isoDateKey(new Date(), tz);
  const todayEvents = eventPool
    .filter((e) => e.startTime && isoDateKey(e.startTime, tz) === todayKey)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
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
 * Bucket week events into 7 day-columns (Sun→Sat) for the Week slide.
 * @param {object[]} weekEvents normalized week events (have weekday/day/epoch)
 * @param {string} [timezone]
 */
export function buildWeekColumns(weekEvents, timezone) {
  const todayParts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric',
    timeZone: timezone || undefined,
  }).formatToParts(new Date());
  const todayWk = todayParts.find((p) => p.type === 'weekday')?.value;

  const byWeekday = new Map(WEEKDAYS.map((d) => [d, []]));
  const dayNum = new Map();
  for (const ev of weekEvents) {
    if (!byWeekday.has(ev.weekday)) continue;
    byWeekday.get(ev.weekday).push({
      t: formatTo12(ev.hm),
      n: ev.name,
      r: ev.room,
    });
    dayNum.set(ev.weekday, ev.day);
  }

  return WEEKDAYS.map((d) => ({
    day: d,
    date: dayNum.get(d) ?? '',
    events: byWeekday.get(d),
    today: d === todayWk,
  }));
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
