import { describe, expect, it } from 'vitest';
import { normalizePayload, normalizeThemeMode } from '../models/index.js';
import { isAfterSunset } from '../utils/prayers.js';
import { parseThemeMode, themeForMode } from './registry.js';

// Theme mode: LIGHT, DARK, or AUTO (night from Maghrib until sunrise). The
// board decides on its own clock, so these pin the window's edges and the
// reading of content built before theme modes existed.

const TZ = 'America/Toronto';
const PRAYERS = {
  fajr: { adhan: '05:40' },
  sunrise: { adhan: '07:10' },
  dhuhr: { adhan: '12:15' },
  asr: { adhan: '14:40' },
  maghrib: { adhan: '16:50' },
  isha: { adhan: '18:20' },
};
// 22 Nov 2026 is EST (UTC-5), so local HH:MM is UTC minus five hours.
const at = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 10, 22, h + 5, m));
};

describe('isAfterSunset', () => {
  it.each([
    ['16:49', false], // a minute before Maghrib
    ['16:50', true],  // Maghrib itself: the switch is at the adhan
    ['18:00', true],  // between Maghrib and Isha, which used to be day
    ['18:20', true],  // Isha
    ['23:59', true],
    ['00:30', true],  // after midnight, before Fajr
    ['05:40', true],  // Fajr: still dark, the window runs to sunrise
    ['07:09', true],
    ['07:10', false], // sunrise
    ['12:00', false],
  ])('at %s is %s', (hhmm, expected) => {
    expect(isAfterSunset(PRAYERS, at(hhmm), TZ)).toBe(expected);
  });

  it('stays light when it cannot place sunset or sunrise', () => {
    expect(isAfterSunset({ ...PRAYERS, maghrib: undefined }, at('20:00'), TZ)).toBe(false);
    expect(isAfterSunset({ ...PRAYERS, sunrise: {} }, at('20:00'), TZ)).toBe(false);
    expect(isAfterSunset(null, at('20:00'), TZ)).toBe(false);
  });
});

describe('themeForMode', () => {
  it('LIGHT is day and DARK is night, whatever the time', () => {
    for (const afterSunset of [true, false]) {
      expect(themeForMode('LIGHT', afterSunset)).toBe('day');
      expect(themeForMode('DARK', afterSunset)).toBe('night');
    }
  });

  it('AUTO follows the sunset window', () => {
    expect(themeForMode('AUTO', true)).toBe('night');
    expect(themeForMode('AUTO', false)).toBe('day');
  });

  it('treats an unknown or missing mode as AUTO', () => {
    expect(themeForMode('PURPLE', true)).toBe('night');
    expect(themeForMode(undefined, false)).toBe('day');
  });

  it('reads a mode case-insensitively', () => {
    expect(parseThemeMode(' dark ')).toBe('DARK');
    expect(parseThemeMode('nope')).toBeNull();
    expect(parseThemeMode(1)).toBeNull();
  });
});

describe('normalizeThemeMode', () => {
  it('takes themeMode when the backend sends one', () => {
    expect(normalizeThemeMode({ themeMode: 'LIGHT' })).toBe('LIGHT');
    expect(normalizeThemeMode({ themeMode: 'DARK', darkModeAfterIsha: true })).toBe('DARK');
  });

  it('reads content from before theme modes: on is AUTO, off is LIGHT', () => {
    expect(normalizeThemeMode({ darkModeAfterIsha: true })).toBe('AUTO');
    expect(normalizeThemeMode({ darkModeAfterIsha: false })).toBe('LIGHT');
  });

  it('defaults to AUTO', () => {
    expect(normalizeThemeMode({})).toBe('AUTO');
    expect(normalizeThemeMode(undefined)).toBe('AUTO');
    expect(normalizeThemeMode({ themeMode: 'PURPLE' })).toBe('AUTO');
  });

  it('is what normalizePayload puts on the device config', () => {
    const legacy = normalizePayload({ deviceConfig: { darkModeAfterIsha: false } });
    expect(legacy.deviceConfig.themeMode).toBe('LIGHT');
    expect(legacy.deviceConfig).not.toHaveProperty('darkModeAfterIsha');

    const current = normalizePayload({ deviceConfig: { themeMode: 'DARK' } });
    expect(current.deviceConfig.themeMode).toBe('DARK');

    expect(normalizePayload({}).deviceConfig.themeMode).toBe('AUTO');
  });
});
