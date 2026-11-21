import { describe, expect, it } from 'vitest';
import { getPrayerData, hijriDate } from './prayerService.js';
import { buildHijri } from '../models/index.js';
import fixture from './__fixtures__/aladhan-utm-2026.json';

// The board computed its times from Aladhan until it went offline-capable, and
// every mosque picked its method while looking at Aladhan's output — so that
// output is the reference. The fixture is Aladhan's published calendar for UTM
// Mississauga: June, January and December 2026 for ISNA (standard and Hanafi
// Asr), January for every other method, and March for Makkah (Ramadan Isha).

const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Noon UTC on the fixture's date — the Toronto date either way. */
const dayOf = (iso) => new Date(`${iso}T16:00:00Z`);

describe('getPrayerData against Aladhan', () => {
  for (const set of fixture.sets) {
    const month = set.days[0].date.slice(0, 7);
    it(`${set.method} ${set.school} ${month} is within a minute every day`, () => {
      const location = { ...fixture.location, method: set.method };
      const misses = [];
      for (const day of set.days) {
        const { prayers } = getPrayerData(location, dayOf(day.date));
        KEYS.forEach((key, i) => {
          if (set.school === 'HANAFI' && key !== 'asr') return;
          const ours = set.school === 'HANAFI' ? prayers.asr.hanafiAdhan : prayers[key].adhan;
          const diff = toMinutes(ours) - toMinutes(day.times[i]);
          if (Math.abs(diff) > 1) misses.push(`${day.date} ${key}: ${ours} vs ${day.times[i]}`);
        });
      }
      expect(misses).toEqual([]);
    });
  }

  it('returns 24h HH:MM in the board zone with Hanafi Asr alongside', () => {
    const { prayers } = getPrayerData(
      { ...fixture.location, method: 'ISNA' },
      dayOf('2026-06-21'),
    );
    for (const key of KEYS) expect(prayers[key].adhan).toMatch(/^\d{2}:\d{2}$/);
    expect(prayers.asr.hanafiAdhan).toMatch(/^\d{2}:\d{2}$/);
    expect(toMinutes(prayers.asr.hanafiAdhan)).toBeGreaterThan(toMinutes(prayers.asr.adhan));
    expect(prayers.fajr.english).toBe('Fajr');
  });

  it("uses the board's date, not the runtime's, near midnight", () => {
    // 02:30 UTC on 21 June is still 20 June in Toronto.
    const late = getPrayerData(
      { ...fixture.location, method: 'ISNA' },
      new Date('2026-06-21T02:30:00Z'),
    );
    const day = getPrayerData(
      { ...fixture.location, method: 'ISNA' },
      dayOf('2026-06-20'),
    );
    expect(late.prayers).toEqual(day.prayers);
    expect(late.hijri).toEqual(day.hijri);
  });

  it('falls back to ISNA for an unknown method', () => {
    const date = dayOf('2026-01-15');
    expect(getPrayerData({ ...fixture.location, method: 'NOPE' }, date))
      .toEqual(getPrayerData({ ...fixture.location, method: 'ISNA' }, date));
  });
});

describe('hijriDate', () => {
  it("matches Aladhan's Hijri date on every fixture day", () => {
    const misses = [];
    for (const set of fixture.sets) {
      /** @type {{date:string, hijri?:number[]}[]} */
      const days = set.days;
      for (const day of days) {
        if (!day.hijri) continue;
        const [d, m, y] = day.hijri;
        const ours = hijriDate(dayOf(day.date), fixture.location.timezone);
        if (ours?.day !== d || ours?.month !== m || ours?.year !== y) {
          misses.push(`${day.date}: ${JSON.stringify(ours)} vs ${day.hijri}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('maps into the design shape by month number', () => {
    expect(buildHijri({ day: 12, month: 4, year: 1448 })).toEqual({
      day: '12', monthEn: "Rabi' al-thani", monthAr: 'رَبِيع ٱلثَّانِي', year: '1448',
    });
    expect(buildHijri(null)).toEqual({ day: '', monthEn: '', monthAr: '', year: '' });
  });
});
