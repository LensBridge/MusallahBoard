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
// GET /api/musallah/payload (served by the agent)  -> MusallahBoardPayload
//   { deviceConfig: DeviceConfig, frames: FrameDefinition[] }
//
// DeviceConfig {
//   id: uuid, location: Location, darkModeAfterIsha: bool,
//   enableScrollingMessage: bool, scrollingMessages: string[],
//   theme?: string
// }
//   `theme` is not in the OpenAPI schema yet — it is read forward so a board
//   already in the field picks the field up the day the backend starts
//   sending it, with no frontend release. Unknown names are ignored rather
//   than applied; see themes/registry.js.
// Location { city, country, latitude, longitude, timezone, method }
//   method ∈ KARACHI|ISNA|MWL|MAKKAH|EGYPT|TEHRAN|GULF|KUWAIT|QATAR|
//            SINGAPORE|FRANCE|TURKEY|RUSSIA|DUBAI
// FrameDefinition {
//   frameId: string, frameType ∈ poster|next_prayer|agenda|socials|jummah|
//   islamic_quote, durationInSeconds: int|null,
//   frameConfig: <discriminated on .type>
// }
//   Array order is display order — the backend composes the sequence.
//   `durationInSeconds` means the same thing for every frame type, quotes
//   included: a number is the dwell time in seconds and is honoured as sent,
//   null means "auto" and leaves the dwell time to the frame's builder (see
//   frames/builders.jsx). No frame type is exempt from either case.
//   PosterFrameConfig        { type, posterUrl, title, signupUrl }
//   AgendaFrameConfig        { type, heading, days: DayBucket[] }
//   JummahFrameConfig        { type, prayers: JummahSlot[] }
//   IslamicQuoteFrameConfig  { type, kind: VERSE|HADITH, arabic,
//                              transliteration, translation, reference }
//     The quote's own duration lives on the frame, not in this config: an
//     admin may time a single quote (5–120s) and the board honours it; an
//     untimed quote arrives as null and gets the builder's auto dwell time.
//   NextPrayerFrameConfig    { type }  — marker only; countdown computed client-side
//   PromotableSocialMediaFrameConfig
//                            { type: "socials", socialType, url, headerText,
//                              heroText, handle, footerText }
//     socialType ∈ instagram|youtube|tiktok|whatsapp|other (lowercase).
//     handle is nullable — WhatsApp entries have none.
//     headerText/heroText/handle/footerText are Markdown; see utils/markdown.js.
//     Zero or more per payload, one per social account promoted to the board's
//     audience. This replaced a single hardcoded `instagram` frame whose QR
//     target the board read from deviceConfig.socialUrl; both are gone.
// DayBucket { date("YYYY-MM-DD" in the board's zone), events: EventView[] }
// EventView { name, description, location, startTime(ISO), endTime(ISO), allDay }
// JummahSlot { prayerTime, khatib, room }
//
// The agenda frame replaced the former event_list + daily_schedule pair, which
// queried the same events over a 7-day and a 1-day window and differed only in
// layout. Today's events are now just the bucket whose date is today's — and
// *which* bucket that is has to be decided here rather than server-side, because
// a board can run for days on one payload and the answer changes at midnight.
// For the same reason DayBucket carries no isToday flag.
// ---------------------------------------------------------------------------

/**
 * Prayer calculation method enum → the parameters the board computes with.
 *
 * Transcribed from Aladhan's own method table (GET api.aladhan.com/v1/methods,
 * aladhan.com/calculation-methods). The board used to fetch its timings from
 * Aladhan, and every method a mosque has picked in LensBridge was picked while
 * looking at those times, so they are the reference — not adhan's presets.
 * Several of adhan's presets differ from Aladhan's definitions (a +1 min Dhuhr
 * on ISNA/MWL/Egypt/Karachi/Singapore, a different set of offsets on Dubai,
 * round-up on Singapore), which is why prayerService builds every method from
 * these raw numbers rather than from a named preset.
 *
 * `fajr`/`isha` are degrees below the horizon; `ishaMinutes` replaces the Isha
 * angle with a fixed interval after Maghrib, and `ramadanIshaMinutes` replaces
 * that during Ramadan (Umm al-Qura's 120 min — Aladhan applies it, and it is not
 * in its method table, only in the offsets it reports); `maghrib` is Tehran's
 * Maghrib angle (Maghrib otherwise = sunset); `adjust` is minutes added per
 * prayer, as Aladhan reports them in `meta.offset`.
 */
export const CALCULATION_METHODS = {
  KARACHI:   { fajr: 18,   isha: 18 },
  ISNA:      { fajr: 15,   isha: 15 },
  MWL:       { fajr: 18,   isha: 17 },
  MAKKAH:    { fajr: 18.5, ishaMinutes: 90, ramadanIshaMinutes: 120 },
  EGYPT:     { fajr: 19.5, isha: 17.5 },
  TEHRAN:    { fajr: 17.7, isha: 14, maghrib: 4.5 },
  GULF:      { fajr: 19.5, ishaMinutes: 90 },
  KUWAIT:    { fajr: 18,   isha: 17.5 },
  QATAR:     { fajr: 18,   ishaMinutes: 90 },
  SINGAPORE: { fajr: 20,   isha: 18 },
  FRANCE:    { fajr: 12,   isha: 12 },
  TURKEY:    { fajr: 18,   isha: 17, adjust: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } },
  RUSSIA:    { fajr: 16,   isha: 15 },
  DUBAI:     { fajr: 18.2, isha: 18.2, adjust: { dhuhr: 3, maghrib: 3 } },
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

/**
 * Hijri months by number (index 0 = month 1). The board resolves the Hijri date
 * with Intl's Umm al-Qura calendar and takes only the month *number* from it:
 * Intl's English month names vary across ICU versions ("Rabiʻ I", "Rabi I"…),
 * and a spelling change would silently blank the Arabic line.
 */
const HIJRI_MONTHS = [
  { en: 'Muharram',        ar: 'مُحَرَّم' },
  { en: 'Safar',           ar: 'صَفَر' },
  { en: "Rabi' al-awwal",  ar: 'رَبِيع ٱلْأَوَّل' },
  { en: "Rabi' al-thani",  ar: 'رَبِيع ٱلثَّانِي' },
  { en: 'Jumada al-awwal', ar: 'جُمَادَىٰ ٱلْأُولَىٰ' },
  { en: 'Jumada al-thani', ar: 'جُمَادَىٰ ٱلثَّانِيَة' },
  { en: 'Rajab',           ar: 'رَجَب' },
  { en: "Sha'ban",         ar: 'شَعْبَان' },
  { en: 'Ramadan',         ar: 'رَمَضَان' },
  { en: 'Shawwal',         ar: 'شَوَّال' },
  { en: 'Dhul-Qadah',      ar: 'ذُو ٱلْقَعْدَة' },
  { en: 'Dhul-Hijjah',     ar: 'ذُو ٱلْحِجَّة' },
];

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
 * the *board's* zone, not the browser's. Prayer times are computed for the
 * configured lat/long and formatted in its zone, so comparing them against `Date#getHours()` is only
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
    // Board-wide theme name, pinned by the backend. Null means "decide
    // locally" — the time-of-day logic in App. Validated against the theme
    // registry before it reaches the stage, so a bad value costs nothing.
    theme: null,
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
 *   agendaDays: {dateKey:string, events:object[]}[],
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

  // Payload order is slideshow order. The board does not re-sort: composing the
  // sequence is the backend's job, and a client-side sort could only ever fight
  // it. The frames previously carried `slot` and `priority` for a reordering
  // that was never built; both are gone from the contract.
  const frames = Array.isArray(payload?.frames) ? payload.frames : [];

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

  const agendaFrame = frames.find((f) => ft(f) === 'agenda');
  const jummahFrame = frames.find((f) => ft(f) === 'jummah');
  const verseFrame = frames.find(
    (f) => ft(f) === 'islamic_quote' && f.frameConfig?.kind === 'VERSE'
  );
  const hadithFrame = frames.find(
    (f) => ft(f) === 'islamic_quote' && f.frameConfig?.kind === 'HADITH'
  );

  // The backend already bucketed the window by calendar day in the board's own
  // zone, so this only converts each event into the shape the slide renders.
  // Nothing here depends on the current time — buildAgendaDays() and
  // buildTodayEvents() add everything that does, so they can be recomputed at
  // midnight without refetching.
  const agendaDays = (agendaFrame?.frameConfig?.days ?? []).map((bucket) => ({
    dateKey: bucket?.date ?? '',
    events: (bucket?.events ?? []).map((e) => {
      const epoch = e?.startTime ? new Date(e.startTime).getTime() : NaN;
      return {
        name: e?.name || '',
        room: e?.location || '',
        allDay: Boolean(e?.allDay),
        epoch: Number.isFinite(epoch) ? epoch : 0,
        start: isoToHM(e?.startTime, tz),
        end: isoToHM(e?.endTime, tz),
      };
    }),
  }));

  const jummahPrayers = (jummahFrame?.frameConfig?.prayers ?? []).map(
    normalizeJummah
  );

  return {
    deviceConfig,
    frames,
    weather: normalizeWeather(payload?.weather, deviceConfig.location?.city),
    posters,
    agendaDays,
    jummahPrayers,
    verse: normalizeQuote(verseFrame?.frameConfig),
    hadith: normalizeQuote(hadithFrame?.frameConfig),
    scrollingMessages: deviceConfig.enableScrollingMessage
      ? deviceConfig.scrollingMessages || []
      : [],
  };
}

/**
 * Whole days from `fromKey` to `toKey`, both "YYYY-MM-DD".
 *
 * Compared at UTC midnight rather than by adding 86_400_000ms: across a DST
 * transition the millisecond arithmetic skips or repeats a local calendar date,
 * and these boards run in America/Toronto.
 */
function dayOffset(fromKey, toKey) {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

/**
 * Add the display layer to the backend's day buckets: labels, and which bucket
 * is today.
 *
 * The backend fixes the *content* of the window and deliberately ships no
 * isToday marker, because a board can run for days on one payload and any such
 * marker is wrong after the first midnight. So "today" is resolved here against
 * the board's clock, and buckets whose date has already passed are dropped —
 * a payload that outlived its own first day degrades to a shorter agenda
 * instead of labelling yesterday as today.
 *
 * A bucket for today is synthesized when the payload has none, so days[0] is
 * always today; AgendaSlide's "next day with anything" search relies on that.
 *
 * @param {object[]} agendaDays normalized buckets from normalizePayload()
 * @param {Date} now            the board's clock (honours the debug offset)
 * @param {string} [timezone]   IANA zone; falls back to the runtime's own
 * @returns {{key:string, weekday:string, date:string, month:string,
 *            offset:number, isToday:boolean, isTomorrow:boolean,
 *            events:{t:string,n:string,r:string,allDay:boolean}[]}[]}
 */
export function buildAgendaDays(agendaDays, now, timezone) {
  const todayKey = isoDateKey(now, timezone);

  const upcoming = (agendaDays || []).filter(
    (d) => d?.dateKey && d.dateKey >= todayKey
  );
  if (!upcoming.some((d) => d.dateKey === todayKey)) {
    upcoming.unshift({ dateKey: todayKey, events: [] });
  }

  const label = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });

  return upcoming
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((day) => {
      const [y, m, d] = day.dateKey.split('-').map(Number);
      const parts = label.formatToParts(new Date(Date.UTC(y, m - 1, d)));
      const part = (t) => parts.find((p) => p.type === t)?.value ?? '';
      const offset = dayOffset(todayKey, day.dateKey);

      // All-day entries sort ahead of timed ones: they frame the whole day
      // rather than occupying a slot in it, so a 9am talk listed above "Eid
      // Weekend" reads as though the weekend starts at 9.
      const events = [...(day.events || [])]
        .sort((a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.epoch - b.epoch)
        .map((e) => ({
          t: e.allDay ? 'All Day' : formatTo12(e.start),
          n: e.name,
          r: e.room,
          allDay: e.allDay,
        }));

      return {
        key: day.dateKey,
        weekday: part('weekday'),
        date: part('day'),
        month: part('month'),
        offset,
        isToday: offset === 0,
        isTomorrow: offset === 1,
        events,
      };
    });
}

/**
 * Today's events in the shape AgendaSlide's hero card consumes.
 *
 * Split out of normalizePayload() because it depends on the current date: the
 * old version resolved "today" once, when the payload arrived, and a board that
 * ran past midnight kept showing the previous day's schedule until the next
 * fetch. Recomputed alongside buildAgendaDays() on each day rollover instead.
 *
 * @param {object[]} agendaDays normalized buckets from normalizePayload()
 * @param {Date} now            the board's clock (honours the debug offset)
 * @param {string} [timezone]   IANA zone; falls back to the runtime's own
 */
export function buildTodayEvents(agendaDays, now, timezone) {
  const todayKey = isoDateKey(now, timezone);
  const today = (agendaDays || []).find((d) => d?.dateKey === todayKey);

  return [...(today?.events || [])]
    .sort((a, b) => a.epoch - b.epoch)
    .map((e, i) => ({
      id: i + 1,
      name: e.name,
      room: e.room,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
    }));
}

/**
 * Build the design's hijri date block.
 * @param {{day:number, month:number, year:number}|null} hijri numeric Umm
 *   al-Qura date, as returned by getPrayerData()
 */
export function buildHijri(hijri) {
  const month = HIJRI_MONTHS[(hijri?.month ?? 0) - 1];
  if (!hijri || !month) return { day: '', monthEn: '', monthAr: '', year: '' };
  return {
    day: String(hijri.day),
    monthEn: month.en,
    monthAr: month.ar,
    year: String(hijri.year),
  };
}
