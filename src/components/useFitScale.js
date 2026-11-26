// Shrink a block's type until its content fits the box it is given.
//
// The quote slide's text is whatever an admin typed: a three-word verse or a
// hadith with its full isnad. One fixed size cannot serve both (the long ones
// ran off the bottom of the screen), so the slide sets its sizes as multiples
// of `--fit` and this hook finds the largest `--fit` at which the content
// still fits, by binary search on the real layout.
//
// It measures on mount, when the box changes size (the notes band appearing
// under the slides shrinks it), and once the web fonts have loaded, since
// Amiri's metrics are nothing like the fallback's. Hidden slides are still
// laid out (`visibility: hidden`), so a slide is already fitted when it
// comes round.
import { useLayoutEffect } from 'react';

const STEPS = 9; // 1/512 precision over the range: far below a pixel

/**
 * @param {import('react').RefObject<HTMLElement>} ref  the box; it must have a
 *   fixed height and `overflow: hidden`, and its content's sizes must read
 *   `var(--fit)`.
 * @param {unknown[]} deps  what changes the content
 * @param {{ min?: number, max?: number }} [range]
 */
export default function useFitScale(ref, deps, { min = 0.35, max = 1 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const fits = (v) => {
      el.style.setProperty('--fit', String(v));
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
    };
    const fit = () => {
      if (!el.clientHeight) return; // not laid out yet
      if (fits(max)) return;
      let lo = min;
      let hi = max;
      for (let i = 0; i < STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      // Floor at `min` even if that still overflows: the box clips, which
      // beats text too small to read from anywhere.
      el.style.setProperty('--fit', String(lo));
    };

    fit();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) fit(); });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => {
      alive = false;
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
