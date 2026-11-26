import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Ticker, { tickerRepeats } from './Ticker.jsx';

// The ticker scrolls one half of a strip of two identical halves, so each
// half must be at least as wide as the track or blank space scrolls into
// view (the bug with one short message). tickerRepeats sizes the half.

describe('tickerRepeats', () => {
  it('repeats a short ticker until one half covers the track', () => {
    expect(tickerRepeats(1272, 467)).toBe(3);   // one short message
    expect(tickerRepeats(1272, 1272)).toBe(1);  // exactly the track
    expect(tickerRepeats(1272, 1273)).toBe(1);
    expect(tickerRepeats(1272, 40)).toBe(32);   // a very short one
  });

  it('never covers less than the track', () => {
    for (const track of [300, 1272, 1920]) {
      for (const copy of [1, 37, 466.5, 800, 2580]) {
        expect(tickerRepeats(track, copy) * copy).toBeGreaterThanOrEqual(track);
      }
    }
  });

  it('falls back to one copy before anything is measured', () => {
    expect(tickerRepeats(0, 0)).toBe(1);
    expect(tickerRepeats(1272, 0)).toBe(1);
    expect(tickerRepeats(NaN, 300)).toBe(1);
  });
});

describe('Ticker', () => {
  it('renders two halves, and reads the messages out once', () => {
    const { container } = render(<Ticker messages={['One', 'Two']} />);
    const spans = [...container.querySelectorAll('.ticker-content span')];
    expect(spans.map((s) => s.textContent)).toEqual(['One', 'Two', 'One', 'Two']);
    expect(spans.filter((s) => !s.hasAttribute('aria-hidden')).map((s) => s.textContent))
      .toEqual(['One', 'Two']);
  });
});
