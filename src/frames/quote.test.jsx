/**
 * The islamic_quote frame, end to end: a payload-shaped frame definition goes
 * into the registry and a rendered slide comes out. The interesting part is the
 * duration — an admin can now time an individual quote, and null still means
 * "auto" — so a regression here is a verse that flashes past unread or a hadith
 * that stalls the rotation behind it, neither of which shows up as an error.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildSlideshow } from './registry.js';
import './builders.jsx'; // registers the builders under test

/** The dwell time the builder gives an untimed quote. */
const AUTO_MS = 18_000;

/** An islamic_quote FrameDefinition exactly as the backend emits it. */
function quoteFrame(config = {}, def = {}) {
  return {
    frameId: 'quote:3fa85f64-5717-4562-b3fc-2c963f66afa6',
    frameType: 'islamic_quote',
    durationInSeconds: null,
    frameConfig: {
      type: 'islamic_quote',
      kind: 'VERSE',
      arabic: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
      transliteration: 'Inna maʿa al-ʿusri yusrā',
      translation: 'Indeed, with hardship comes ease.',
      reference: 'Qur’an 94:6',
      ...config,
    },
    ...def,
  };
}

/** Build the deck the board would show for these frames. */
const deck = (...frames) => buildSlideshow({ frames }, {});

/** Render one built slide descriptor. */
const renderSlide = (slide) => render(slide.render({ data: {}, now: new Date() }));

describe('islamic quote frame builder', () => {
  it('honours the per-frame duration from the backend', () => {
    const [slide] = deck(quoteFrame({}, { durationInSeconds: 45 }));
    expect(slide.durationMs).toBe(45_000);
  });

  it('honours both ends of the admin-settable range', () => {
    const durations = [5, 120].map(
      (durationInSeconds) => deck(quoteFrame({}, { durationInSeconds }))[0].durationMs
    );
    expect(durations).toEqual([5_000, 120_000]);
  });

  it('falls back to the auto dwell time when the quote was never timed', () => {
    // null is the wire value for "auto" — the board picks the dwell time.
    expect(deck(quoteFrame({}, { durationInSeconds: null }))[0].durationMs).toBe(AUTO_MS);
    // A payload that omits the field entirely is the same case, not a zero.
    expect(deck(quoteFrame({}, { durationInSeconds: undefined }))[0].durationMs).toBe(AUTO_MS);
  });

  it('times a hadith the same way it times a verse', () => {
    const slides = deck(
      quoteFrame({ kind: 'VERSE' }, { durationInSeconds: 30 }),
      quoteFrame({ kind: 'HADITH', arabic: 'إِنَّمَا ٱلْأَعْمَالُ بِٱلنِّيَّاتِ', translation: 'Actions are but by intention.' })
    );

    expect(slides.map((s) => s.durationMs)).toEqual([30_000, AUTO_MS]);
    expect(slides.map((s) => s.key)).toEqual(['verse', 'hadith']);
  });

  it('skips a quote with no text rather than dwelling on an empty slide', () => {
    expect(deck(quoteFrame({ arabic: '', translation: '' }))).toHaveLength(0);
  });
});

describe('islamic quote slide rendering', () => {
  it('renders the Arabic, transliteration, translation and reference', () => {
    const { container } = renderSlide(deck(quoteFrame())[0]);
    const q = (sel) => container.querySelector(sel).textContent;

    expect(q('.slide-eyebrow')).toContain('Verse of the Week');
    expect(q('.quote-arabic')).toBe('إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا');
    expect(q('.quote-translit')).toBe('Inna maʿa al-ʿusri yusrā');
    expect(q('.quote-translation')).toBe('Indeed, with hardship comes ease.');
    expect(q('.quote-ref')).toBe('Qur’an 94:6');
  });

  it('labels a HADITH frame as the hadith of the week', () => {
    const { container } = renderSlide(deck(quoteFrame({ kind: 'HADITH' }))[0]);
    expect(container.querySelector('.slide-eyebrow').textContent).toContain('Hadith of the Week');
  });

  it('omits the transliteration line when the quote has none', () => {
    const { container } = renderSlide(deck(quoteFrame({ transliteration: '' }))[0]);
    expect(container.querySelector('.quote-translit')).toBeNull();
    expect(container.querySelector('.quote-translation').textContent)
      .toBe('Indeed, with hardship comes ease.');
  });
});
