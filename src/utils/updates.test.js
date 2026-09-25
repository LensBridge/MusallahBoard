import { describe, expect, it } from 'vitest';
import { updateNotice } from './updates.js';

const TZ = 'America/Toronto';
const app = { type: 'app', version: '2.1.0', description: 'board app 2.1.0' };
const agent = { type: 'agent', version: '0.3.0', description: 'agent 0.3.0' };

describe('updateNotice', () => {
  const now = new Date('2026-09-25T14:00:00-04:00');

  it('is null when nothing waits', () => {
    expect(updateNotice(null, now, TZ)).toBeNull();
    expect(updateNotice({ available: [], installAt: null }, now, TZ)).toBeNull();
  });

  it('says tonight for this evening', () => {
    expect(updateNotice({ available: [app], installAt: '2026-09-25T23:00:00-04:00' }, now, TZ))
      .toBe('Update available: board app 2.1.0 will be installed at 11:00 PM tonight');
  });

  it('names every waiting update', () => {
    expect(updateNotice({ available: [agent, app], installAt: '2026-09-25T23:00:00-04:00' }, now, TZ))
      .toBe('Update available: agent 0.3.0 and board app 2.1.0 will be installed at 11:00 PM tonight');
  });

  it('says tomorrow night after the window has passed', () => {
    const morning = new Date('2026-09-26T08:00:00-04:00');
    expect(updateNotice({ available: [app], installAt: '2026-09-26T23:00:00-04:00' }, morning, TZ))
      .toContain('at 11:00 PM tonight');
    expect(updateNotice({ available: [app], installAt: '2026-09-26T23:00:00-04:00' }, now, TZ))
      .toContain('at 11:00 PM tomorrow night');
  });

  it('reads the time in the board zone, not the runtime zone', () => {
    expect(updateNotice({ available: [app], installAt: '2026-09-26T03:00:00Z' }, now, TZ))
      .toContain('at 11:00 PM tonight');
  });

  it('says shortly when the window is open', () => {
    expect(updateNotice({ available: [app], installAt: now.toISOString() }, now, TZ))
      .toBe('Update available: board app 2.1.0 will be installed shortly');
  });

  it('says installing while it installs', () => {
    expect(updateNotice({ available: [app], installAt: now.toISOString(), installing: true }, now, TZ))
      .toBe('Installing update: board app 2.1.0');
  });
});
