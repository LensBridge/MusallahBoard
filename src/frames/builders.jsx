/**
 * Default frame builders. Each maps an API frame type (or a synthetic one)
 * to a React descriptor. Registered into the shared registry on import.
 */
import { registerFrameBuilder } from './registry.js';
import {
  NextPrayerSlide, TodaySlide, WeekSlide,
  PosterSlide, QuoteSlide, IGSlide,
} from '../components/slides.jsx';

const secs = (def, fallback) =>
  (Number.isFinite(def?.durationInSeconds) ? def.durationInSeconds : fallback) * 1000;

registerFrameBuilder('next_prayer', (def) => ({
  key: 'next-prayer',
  durationMs: secs(def, 12),
  render: ({ data, now }) => <NextPrayerSlide data={data} now={now} />,
}));

// Frontend-managed Today view (synthetic frame type 'today'). Not driven by
// any backend frame — it reads the payload-derived todayEvents off `data`.
registerFrameBuilder('today', (def) => ({
  key: 'today',
  durationMs: secs(def, 16),
  render: ({ data, now }) => <TodaySlide data={data} now={now} />,
}));

registerFrameBuilder('event_list', (def) => ({
  key: 'week',
  durationMs: secs(def, 16),
  render: ({ data }) => <WeekSlide data={data} />,
}));

let posterSeq = 0;
registerFrameBuilder('poster', (def) => {
  const poster = {
    image: def?.frameConfig?.posterUrl || '',
    title: def?.frameConfig?.title || '',
  };
  return {
    key: `poster-${posterSeq++}`,
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

registerFrameBuilder('instagram', (def) => ({
  key: 'ig',
  durationMs: secs(def, 13),
  render: ({ data }) => <IGSlide data={data} />,
}));
