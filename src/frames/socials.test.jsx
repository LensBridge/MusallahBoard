/**
 * The socials frame, end to end: a payload-shaped frame definition goes into
 * the registry and a rendered slide comes out. Deliberately not a unit test of
 * SocialsSlide alone — the builder is where the wire contract is read, and a
 * regression there (wrong config key, wrong duration, wrong key collision) is
 * exactly the kind that shows up as a blank wall-mounted screen.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
import { buildSlideshow } from './registry.js';
import './builders.jsx'; // registers the builders under test

const INSTAGRAM_URL = 'https://instagram.com/utmmsa';
const WHATSAPP_URL = 'https://chat.whatsapp.com/example-invite';

/** A socials FrameDefinition exactly as the backend emits it. */
function socialsFrame(config = {}, def = {}) {
  return {
    frameId: 'social:3fa85f64-5717-4562-b3fc-2c963f66afa6',
    frameType: 'socials',
    durationInSeconds: 13,
    frameConfig: {
      type: 'socials',
      socialType: 'instagram',
      url: INSTAGRAM_URL,
      headerText: 'follow along',
      heroText: 'Catch the community on *Instagram*.',
      handle: '@utmmsa',
      footerText:
        'Follow *your home on campus* on Instagram for event recaps, announcements, and more!',
      ...config,
    },
    ...def,
  };
}

/** Build the deck the board would show for these frames. */
const deck = (...frames) => buildSlideshow({ frames }, {});

/** Render one built slide descriptor. */
const renderSlide = (slide) => render(slide.render({ data: {}, now: new Date() }));

describe('socials frame builder', () => {
  it('honours the per-frame duration from the backend', () => {
    const [slide] = deck(socialsFrame({}, { durationInSeconds: 21 }));
    expect(slide.durationMs).toBe(21_000);
  });

  it('builds one slide per socials frame, keyed by frameId', () => {
    const slides = deck(
      socialsFrame({}, { frameId: 'social:aaa' }),
      socialsFrame(
        { socialType: 'whatsapp', url: WHATSAPP_URL, handle: null },
        { frameId: 'social:bbb', durationInSeconds: 9 }
      )
    );

    expect(slides).toHaveLength(2);
    expect(slides.map((s) => s.key)).toEqual(['social-social:aaa', 'social-social:bbb']);
    expect(slides.map((s) => s.durationMs)).toEqual([13_000, 9_000]);

    // Each renders its own account, not a shared singleton.
    const [first, second] = slides.map((s) => renderSlide(s).container);
    expect(first.querySelector('.social-body').dataset.social).toBe('instagram');
    expect(second.querySelector('.social-body').dataset.social).toBe('whatsapp');
    expect(first.textContent).toContain('@utmmsa');
    expect(second.textContent).not.toContain('@utmmsa');
  });

  it('falls back to "other" for a socialType the board does not know', () => {
    const [slide] = deck(socialsFrame({ socialType: 'mastodon' }));
    const { container } = renderSlide(slide);
    expect(container.querySelector('.social-body').dataset.social).toBe('other');
  });

  it('skips a frame with no URL rather than showing an empty QR card', () => {
    expect(deck(socialsFrame({ url: '' }))).toHaveLength(0);
  });

  it('no longer builds anything for the retired instagram frame type', () => {
    expect(deck({ frameId: 'ig', frameType: 'instagram', frameConfig: {} })).toHaveLength(0);
  });
});

describe('socials slide rendering', () => {
  it('renders all four Markdown fields, emphasis included', () => {
    const [slide] = deck(socialsFrame());
    const { container } = renderSlide(slide);

    const q = (sel) => container.querySelector(sel);

    expect(q('.social-eyebrow').textContent).toBe('follow along');
    expect(q('.social-title').textContent).toBe('Catch the community on Instagram.');
    expect(q('.social-handle').textContent).toBe('@utmmsa');
    expect(q('.social-sub').textContent).toBe(
      'Follow your home on campus on Instagram for event recaps, announcements, and more!'
    );

    // The italic runs are why these fields are Markdown at all.
    expect(q('.social-title em').textContent).toBe('Instagram');
    expect(q('.social-sub em').textContent).toBe('your home on campus');
  });

  it('renders emphasis in the eyebrow and handle too', () => {
    const [slide] = deck(socialsFrame({
      headerText: 'follow *along*',
      handle: '**@utmmsa**',
    }));
    const { container } = renderSlide(slide);
    expect(container.querySelector('.social-eyebrow em').textContent).toBe('along');
    expect(container.querySelector('.social-handle strong').textContent).toBe('@utmmsa');
  });

  it('omits the handle element entirely when the handle is null', () => {
    const [slide] = deck(socialsFrame({
      socialType: 'whatsapp',
      url: WHATSAPP_URL,
      handle: null,
      heroText: 'Get day-of updates on *WhatsApp*.',
    }));
    const { container } = renderSlide(slide);

    expect(container.querySelector('.social-handle')).toBeNull();
    expect(container.textContent).not.toContain('@');
    // The remaining copy still renders — a missing handle is not a broken slide.
    expect(container.querySelector('.social-title').textContent)
      .toBe('Get day-of updates on WhatsApp.');
  });

  it('omits the handle element for an absent or blank handle as well', () => {
    for (const handle of [undefined, '', '   ']) {
      const [slide] = deck(socialsFrame({ handle }));
      expect(renderSlide(slide).container.querySelector('.social-handle')).toBeNull();
    }
  });

  it('encodes frameConfig.url in the QR, not a device- or app-level URL', () => {
    const [slide] = deck(socialsFrame({ url: WHATSAPP_URL }));
    const { container } = renderSlide(slide);

    // Compared against a QR built directly from the URL rather than mocking
    // qrcode.react away: this asserts the pixels a phone actually scans.
    const rendered = container.querySelector('.social-qr-wrap .qr-code svg').innerHTML;
    const expected = render(
      <QRCodeSVG value={WHATSAPP_URL} size={300} level="M" bgColor="#ffffff" fgColor="#0a1b3a" marginSize={2} />
    ).container.querySelector('svg').innerHTML;
    const wrongUrl = render(
      <QRCodeSVG value={INSTAGRAM_URL} size={300} level="M" bgColor="#ffffff" fgColor="#0a1b3a" marginSize={2} />
    ).container.querySelector('svg').innerHTML;

    expect(rendered).toBe(expected);
    expect(rendered).not.toBe(wrongUrl);
  });

  it('keeps the shared "Stay Connected" rule on every platform', () => {
    for (const socialType of ['instagram', 'youtube', 'tiktok', 'whatsapp', 'other']) {
      const { container } = renderSlide(deck(socialsFrame({ socialType }))[0]);
      expect(container.querySelector('.slide-eyebrow').textContent).toContain('Stay Connected');
    }
  });
});
