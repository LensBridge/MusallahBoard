import { describe, expect, it } from 'vitest';
import { normalizePayload } from './index.js';
import expiredPayload from '../api/__fixtures__/payload-expired.json';

// Content run-out: past the last installed day the agent keeps serving that
// day's payload, marked `expired: true`. The board keeps prayer times and drops
// everything dated or editorial (agent/docs/architecture.md, section 7).

const frameTypes = (n) => n.frames.map((f) => f.frameType);
const active = () => ({ ...structuredClone(expiredPayload), expired: false });

describe('normalizePayload with expired content', () => {
  it('keeps only the prayer frame', () => {
    const n = normalizePayload(expiredPayload);
    expect(n.expired).toBe(true);
    expect(n.lastDay).toBe('2026-10-07');
    expect(frameTypes(n)).toEqual(['next_prayer']);
  });

  it('hides posters, agenda, jummah, quotes and the ticker', () => {
    const n = normalizePayload(expiredPayload);
    expect(n.posters).toEqual([]);
    expect(n.agendaDays).toEqual([]);
    expect(n.jummahPrayers).toEqual([]);
    expect(n.verse).toBeNull();
    expect(n.hadith).toBeNull();
    expect(n.scrollingMessages).toEqual([]);
  });

  it('keeps what is not content: location, weather', () => {
    const n = normalizePayload(expiredPayload);
    expect(n.deviceConfig.location.timezone).toBe('America/Toronto');
    expect(n.weather).toMatchObject({ temp: 11, condition: 'Clouds' });
  });

  it('still has a frame to show when the payload carried no prayer frame', () => {
    const n = normalizePayload({
      ...expiredPayload,
      frames: expiredPayload.frames.filter((f) => f.frameType !== 'next_prayer'),
    });
    expect(frameTypes(n)).toEqual(['next_prayer']);
  });

  it('survives an expired payload with no frames at all', () => {
    const n = normalizePayload({ deviceConfig: {}, expired: true });
    expect(frameTypes(n)).toEqual(['next_prayer']);
  });
});

describe('normalizePayload with current content', () => {
  it('treats expired: false as current', () => {
    const n = normalizePayload(active());
    expect(n.expired).toBe(false);
    expect(frameTypes(n)).toEqual(
      ['next_prayer', 'poster', 'agenda', 'jummah', 'islamic_quote', 'socials']
    );
    expect(n.posters).toHaveLength(1);
    expect(n.agendaDays).toHaveLength(1);
    expect(n.jummahPrayers).toHaveLength(1);
    expect(n.verse).not.toBeNull();
    expect(n.scrollingMessages).toHaveLength(1);
  });

  it('treats a missing expired field (an older agent) as current', () => {
    const old = active();
    delete old.expired;
    delete old.lastDay;
    const n = normalizePayload(old);
    expect(n.expired).toBe(false);
    expect(n.lastDay).toBe('');
    expect(n.frames).toHaveLength(6);
    expect(n.posters).toHaveLength(1);
  });

  it('is only expired for a literal true', () => {
    for (const odd of ['true', 1, null, 'yes']) {
      expect(normalizePayload({ ...active(), expired: odd }).expired).toBe(false);
    }
  });
});
