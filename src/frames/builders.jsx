/**
 * Default frame builders. Each maps an API frame type (or a synthetic one)
 * to a React descriptor. Registered into the shared registry on import.
 */
import { registerFrameBuilder } from './registry.js';
import {
  NextPrayerSlide, AgendaSlide,
  PosterSlide, QuoteSlide, IGSlide,
} from '../components/slides.jsx';

const secs = (def, fallback) =>
  (Number.isFinite(def?.durationInSeconds) ? def.durationInSeconds : fallback) * 1000;

registerFrameBuilder('next_prayer', (def) => ({
  key: 'next-prayer',
  durationMs: secs(def, 12),
  render: ({ data, now }) => <NextPrayerSlide data={data} now={now} />,
}));

// Frontend-managed agenda view (synthetic frame type 'agenda'). Replaces the
// former 'today' and 'event_list' slides, which asked overlapping questions
// half a rotation apart. Not driven by any backend frame — it reads the
// payload-derived todayEvents + agenda off `data`, so the backend's event_list
// frame is now a data source only and never becomes a slide of its own
// (see buildSlideshow). Longer than either slide it replaces, shorter than both.
registerFrameBuilder('agenda', (def) => ({
  key: 'agenda',
  durationMs: secs(def, 20),
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

registerFrameBuilder('instagram', (def) => ({
  key: 'ig',
  durationMs: secs(def, 13),
  render: ({ data }) => <IGSlide data={data} />,
}));
