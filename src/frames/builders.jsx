/**
 * Default frame builders. Each maps an API frame type (or a synthetic one)
 * to a React descriptor. Registered into the shared registry on import.
 */
import { registerFrameBuilder } from './registry.js';
import {
  NextPrayerSlide, AgendaSlide,
  PosterSlide, QuoteSlide, SocialsSlide, QUEUE_LIMIT,
} from '../components/slides.jsx';

const secs = (def, fallback) =>
  (Number.isFinite(def?.durationInSeconds) ? def.durationInSeconds : fallback) * 1000;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Dwell time for the agenda slide when the backend sends no fixed duration
 * (`durationInSeconds: null` — the per-device "auto" setting). Tunable: these
 * are reading-speed guesses about a wall-mounted screen, not invariants.
 *
 *   BASE    covers the hero card and the day ribbon, which are on screen no
 *           matter how empty the week is.
 *   PER_ROW is roughly how long a passer-by needs to take in one
 *           time / name / room line at kiosk distance.
 *   MIN     stops an empty week from flashing past before anyone looks up.
 *   MAX     stops a busy one from stalling the rotation behind it.
 */
const AGENDA_AUTO = { BASE: 10, PER_ROW: 2.5, MIN: 12, MAX: 30 };

/**
 * Seconds the agenda needs for the amount of information it is actually
 * showing. Counts today's events; if today is empty the slide leads with the
 * next day that has anything, so that day's count is what gets read instead.
 *
 * @param {{events?:any[]}[]} [days]  ctx.agendaDays — buildAgendaDays() output,
 *   whose [0] is always today.
 */
function agendaAutoSeconds(days) {
  const list = Array.isArray(days) ? days : [];
  const today = list[0]?.events?.length ?? 0;
  const rowSource = today > 0
    ? today
    : (list.find((d) => d?.events?.length)?.events?.length ?? 0);
  // Hero card plus the queue rows beneath it — anything past that is collapsed
  // into a "+N more" count, which costs no extra reading time.
  const rows = Math.min(rowSource, QUEUE_LIMIT + 1);
  const { BASE, PER_ROW, MIN, MAX } = AGENDA_AUTO;
  return clamp(BASE + PER_ROW * rows, MIN, MAX);
}

registerFrameBuilder('next_prayer', (def) => ({
  key: 'next-prayer',
  durationMs: secs(def, 12),
  render: ({ data, now }) => <NextPrayerSlide data={data} now={now} />,
}));

// The agenda view. Replaces the former 'today' and 'event_list' slides, which
// asked overlapping questions half a rotation apart.
//
// The frame now carries its own day-bucketed events from the backend. What
// stays here is only what the payload cannot know: which bucket is today, which
// event is live, and how long until the next one — all of which change by the
// minute, and none of which survive a payload that outlives its own day. That
// work happens in buildAgendaDays()/buildTodayEvents(), whose output reaches the
// slide as `data.agenda` / `data.todayEvents`.
//
// Duration is per-device: a number is honoured as-is, and null means "auto" —
// scale the dwell time to how full the agenda is. The day buckets reach the
// builder through ctx.agendaDays because the frame definition alone cannot say
// how many rows will land on screen.
registerFrameBuilder('agenda', (def, ctx) => ({
  key: 'agenda',
  durationMs: secs(def, agendaAutoSeconds(ctx?.agendaDays)),
  render: ({ data, now }) => <AgendaSlide data={data} now={now} />,
}));

registerFrameBuilder('poster', (def, ctx) => {
  const poster = {
    image: def?.frameConfig?.posterUrl || '',
    title: def?.frameConfig?.title || '',
    // Optional; its presence switches PosterSlide to the poster-plus-QR layout.
    signupUrl: def?.frameConfig?.signupUrl || '',
  };
  return {
    key: `poster-${ctx?.frameIndex ?? 0}`,
    durationMs: secs(def, 12),
    render: () => <PosterSlide poster={poster} />,
  };
});

registerFrameBuilder('islamic_quote', (def) => {
  const c = def?.frameConfig || {};
  const isVerse = c.kind === 'VERSE';
  const quote = {
    arabic: c.arabic || '',
    translit: c.transliteration || '',
    translation: c.translation || '',
    reference: c.reference || '',
  };
  if (!quote.arabic && !quote.translation) return null; // nothing to show
  return {
    key: isVerse ? 'verse' : 'hadith',
    durationMs: secs(def, 18),
    render: () => <QuoteSlide kind={isVerse ? 'verse' : 'hadith'} quote={quote} />,
  };
});

/** Platforms the board knows how to label. Anything else renders as 'other'. */
const SOCIAL_TYPES = ['instagram', 'youtube', 'tiktok', 'whatsapp', 'other'];

/**
 * One promoted social account.
 *
 * The backend emits zero or more of these — one per account promoted to this
 * board's audience — so nothing here is a singleton and nothing is
 * Instagram-specific. Everything the slide shows arrives as data: platform,
 * QR destination, all four copy fields (Markdown), and the duration.
 *
 * `durationInSeconds` is always sent (the column behind it is a non-null int),
 * so the 12 below is a malformed-payload guard, not a policy — it matches the
 * poster fallback so a socials frame with a missing duration behaves like any
 * other content slide instead of vanishing.
 */
registerFrameBuilder('socials', (def, ctx) => {
  const c = def?.frameConfig || {};
  if (!c.url) return null; // nothing to scan — the slide is only a QR and copy

  const socialType = String(c.socialType || '').toLowerCase();
  const social = {
    socialType: SOCIAL_TYPES.includes(socialType) ? socialType : 'other',
    url: c.url,
    headerText: c.headerText || '',
    heroText: c.heroText || '',
    // Nullable on the wire: WhatsApp has no handle.
    handle: c.handle ?? '',
    footerText: c.footerText || '',
  };

  // Keyed by frameId so several socials frames coexist in one deck; the index
  // is only a fallback for a payload that omitted the id.
  return {
    key: def?.frameId ? `social-${def.frameId}` : `social-${ctx?.frameIndex ?? 0}`,
    durationMs: secs(def, 12),
    render: () => <SocialsSlide social={social} />,
  };
});
