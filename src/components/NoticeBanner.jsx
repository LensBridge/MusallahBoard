import { useEffect, useState } from 'react';

/**
 * =====================================================
 * Notice banner
 * =====================================================
 * What the agent tells the people in front of the board
 * about an update when there is nothing to install, so
 * the full update screen would be too much: "Reading USB
 * stick", "Already up to date", "Can't read this USB
 * stick" (agent/docs/architecture.md, section 8). It
 * arrives as the `notice` event on /api/local/events:
 *
 *   { tone: "progress" | "ok" | "neutral" | "problem",
 *     headline, lines: [..], seconds }
 *
 * `seconds` 0 means it stays until the next notice
 * replaces it (a progress banner is always followed by
 * its outcome). Sized in vmin, above the ticker, so it
 * reads from across a room on any screen.
 * =====================================================
 */

/** A progress banner nobody replaces still goes, eventually. */
const PROGRESS_MAX_MS = 3 * 60 * 1000;
const EXIT_MS = 400;

function Mark({ tone }) {
  if (tone === 'progress') {
    return (
      <svg className="nb-mark nb-spin" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="nb-track" cx="24" cy="24" r="18" />
        <circle className="nb-arc" cx="24" cy="24" r="18" />
      </svg>
    );
  }
  if (tone === 'ok') {
    return (
      <svg className="nb-mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="18" />
        <path d="M16 24.5l5.5 5.5L32.5 19" />
      </svg>
    );
  }
  if (tone === 'problem') {
    return (
      <svg className="nb-mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="18" />
        <path d="M24 14.5v12" />
        <circle className="nb-dot" cx="24" cy="32.5" r="1.9" />
      </svg>
    );
  }
  return (
    <svg className="nb-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="18" />
      <circle className="nb-dot" cx="24" cy="15.5" r="1.9" />
      <path d="M24 21.5v12" />
    </svg>
  );
}

/**
 * @param {{ notice: null | { id:number, tone:string, headline:string, lines?:string[], seconds?:number },
 *           onDone: (id:number) => void, onBoard?: boolean }} props
 *   onBoard centres the banner on the board's main area, right of the
 *   prayer rail, instead of on the whole screen.
 */
export default function NoticeBanner({ notice, onDone, onBoard = false }) {
  // Kept after `notice` clears, so the banner can fade out with its text.
  const [shown, setShown] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (notice) {
      setShown(notice);
      setLeaving(false);
      const ms = notice.seconds > 0 ? notice.seconds * 1000 : PROGRESS_MAX_MS;
      const id = setTimeout(() => onDone(notice.id), ms);
      return () => clearTimeout(id);
    }
    setLeaving(true);
    const id = setTimeout(() => setShown(null), EXIT_MS);
    return () => clearTimeout(id);
  }, [notice, onDone]);

  if (!shown) return null;
  const lines = shown.lines ?? [];
  return (
    <div
      className={`notice-banner nb-${shown.tone}${onBoard ? ' nb-on-board' : ''}${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      key={shown.id}
    >
      <Mark tone={shown.tone} />
      <div className="nb-text">
        <div className="nb-headline">{shown.headline}</div>
        {lines.map((line, i) => (
          <div className="nb-line" key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
