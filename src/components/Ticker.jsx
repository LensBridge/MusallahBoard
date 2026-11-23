import { useLayoutEffect, useRef, useState } from 'react';

// Scrolling announcements ticker — bottom of stage.
//
// The strip is two identical halves, scrolled left by exactly one half
// (`ticker-scroll`, translateX(-50%)) and then started over: at the restart
// the second half sits where the first one began, so the loop is seamless.
// That only holds while one half is at least as wide as the track. A short
// ticker (one message, or a few short ones) used to scroll the end of the
// strip into view, leaving blank space that grew until the restart, when the
// text jumped back into it. So each half repeats the messages as many times
// as it takes to cover the track, measured, not guessed: the text's width
// depends on the font, the messages and the board's layout.
//
// The duration follows the strip's width, so the text moves at one speed
// however much of it there is, and adding repeats never speeds it up.

/** Scroll speed, in stage pixels per second (the stage is 1920 wide). */
export const TICKER_SPEED_PX_PER_S = 65;

/**
 * How many copies of the messages one half of the strip needs to be at
 * least as wide as the track.
 *
 * @param {number} trackWidth  visible width of the ticker, px
 * @param {number} copyWidth   one copy of the messages with its trailing gap, px
 * @returns {number} at least 1
 */
export function tickerRepeats(trackWidth, copyWidth) {
  if (!(copyWidth > 0) || !(trackWidth > 0)) return 1;
  return Math.max(1, Math.ceil(trackWidth / copyWidth));
}

export default function Ticker({ messages }) {
  const trackRef = useRef(null);
  const contentRef = useRef(null);
  const [repeats, setRepeats] = useState(1);
  const [duration, setDuration] = useState(null);
  // The board re-renders every second with a new array of the same messages;
  // measure again only when the text itself changes.
  const textKey = messages.join('\u0000');

  // Measure before paint, and again whenever the track or the text changes
  // size (fonts arriving, the layout settling, new messages).
  useLayoutEffect(() => {
    const track = trackRef.current;
    const content = contentRef.current;
    if (!track || !content) return undefined;

    const measure = () => {
      // Layout widths (clientWidth/scrollWidth), not getBoundingClientRect:
      // the stage is scaled to the screen, and the animation works in the
      // stage's own pixels. The strip is 2 × repeats copies, each ending in
      // its 80px gap (the last one in the padding), so it divides evenly.
      const copies = 2 * Number(content.dataset.repeats || 1);
      const copyWidth = content.scrollWidth / copies;
      const want = tickerRepeats(track.clientWidth, copyWidth);
      setRepeats((r) => (r === want ? r : want));
      if (copyWidth > 0) {
        const half = copyWidth * want;
        setDuration(half / TICKER_SPEED_PX_PER_S);
      }
    };

    measure();
    let ro;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(measure);
      ro.observe(track);
      ro.observe(content);
    }
    let live = true;
    document.fonts?.ready?.then(() => { if (live) measure(); });
    return () => { live = false; ro?.disconnect(); };
  }, [textKey, repeats]);

  const copies = [];
  for (let c = 0; c < 2 * repeats; c++) {
    messages.forEach((m, i) => {
      // Only the first copy is read out; the rest are the same text again.
      copies.push(<span key={`${c}-${i}`} aria-hidden={c > 0 || undefined}>{m}</span>);
    });
  }

  return (
    <footer className="ticker">
      <div className="ticker-label">
      </div>
      <div className="ticker-track" ref={trackRef}>
        <div
          className="ticker-content"
          ref={contentRef}
          data-repeats={repeats}
          style={duration ? { animationDuration: `${duration.toFixed(2)}s` } : undefined}
        >
          {copies}
        </div>
      </div>
    </footer>
  );
}
