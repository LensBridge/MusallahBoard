// Operator debug drawer — opened by the Alt+Shift+D hotkey or
// `window.MusallahBoard.openDebug()`. Sibling to SetupModal.jsx (Alt+Shift+F),
// but where that panel is about *identity* (what board is this, which backend),
// this one is about *presentation*: force a theme, hold the slideshow still,
// move the clock, force the Jummah card on.
//
// Deliberately a right-hand drawer rather than a centred modal — every control
// here changes what the stage looks like, so the stage has to stay visible
// while you use them.
//
// Every override lives in React state only. Nothing is written to a cookie:
// a board left in debug mode is a bug, and a reload must always return it to
// the live view.
import { useEffect } from 'react';
import { PRAYER_ORDER, toMinutes, zonedClock, zonedSeconds } from '../models/index.js';

const THEMES = [
  { value: null, label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'reverent', label: 'Reverent' },
];

const TRISTATE = [
  { value: null, label: 'Auto' },
  { value: true, label: 'Show' },
  { value: false, label: 'Hide' },
];

const NUDGES = [
  { label: '−1d', ms: -86400000 },
  { label: '−1h', ms: -3600000 },
  { label: '−10m', ms: -600000 },
  { label: '+10m', ms: 600000 },
  { label: '+1h', ms: 3600000 },
  { label: '+1d', ms: 86400000 },
];

const MIN = 60000;

/** Human-readable signed duration: 90061000 -> "+1d 1h 1m 1s". */
function formatOffset(ms) {
  if (!ms) return 'live';
  const sign = ms < 0 ? '−' : '+';
  let rest = Math.abs(Math.round(ms / 1000));
  const d = Math.floor(rest / 86400); rest %= 86400;
  const h = Math.floor(rest / 3600); rest %= 3600;
  const m = Math.floor(rest / 60); rest %= 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (rest || !parts.length) parts.push(`${rest}s`);
  return sign + parts.join(' ');
}

/** A Date as the "YYYY-MM-DDTHH:MM" a datetime-local input wants (browser zone). */
function toLocalInputValue(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Seg({ options, value, onChange, disabled }) {
  return (
    <div className="dbg-seg">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === value ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div className="dbg-section">
      <div className="dbg-section-title">{title}</div>
      {children}
      {note && <div className="dbg-note">{note}</div>}
    </div>
  );
}

export default function DebugMenu({
  debug, setDebug, onClose,
  data, now, slides, slideIdx, setSlideIdx,
  autoTheme, autoJummah,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (p) => setDebug((d) => ({ ...d, ...p }));
  const tz = data?.timezone;
  const boardClock = zonedClock(now, tz);
  const hhmmss = [boardClock.hours, boardClock.minutes, boardClock.seconds]
    .map((n) => String(n).padStart(2, '0')).join(':');

  // Land one minute before the adhān so the countdown, the rail's next/current
  // classification and the after-Isha theme flip are all still watchable.
  function jumpToPrayer(key) {
    const adhan = data?.prayers?.[key]?.adhan;
    if (!adhan) return;
    const targetSec = toMinutes(adhan) * 60 - 60;
    let delta = targetSec - zonedSeconds(now, tz);
    if (delta < 0) delta += 86400; // always travel forward to the next one
    patch({ timeOffsetMs: debug.timeOffsetMs + delta * 1000 });
  }

  function applyDateTime(value) {
    if (!value) return;
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return;
    patch({ timeOffsetMs: target.getTime() - Date.now() });
  }

  // Jumping by hand and then being carried off two seconds later is useless.
  function gotoSlide(i) {
    if (!slides.length) return;
    setSlideIdx((i + slides.length) % slides.length);
    patch({ paused: true });
  }

  const jummahCount = data?.jummahPrayers?.length ?? 0;
  const dirty =
    debug.theme !== null || debug.paused ||
    debug.timeOffsetMs !== 0 || debug.jummah !== null;

  return (
    <div className="dbg-drawer">
      <div className="dbg-head">
        <div>
          <h2>Debug</h2>
          <div className="dbg-sub">Alt+Shift+D · Esc to close</div>
        </div>
        <button type="button" className="dbg-x" onClick={() => onClose?.()}>✕</button>
      </div>

      {dirty && (
        <div className="dbg-banner">
          Overrides active — they are in-memory only and clear on reload.
        </div>
      )}

      <Section
        title="Theme"
        note={`Auto currently resolves to ${autoTheme}.`}
      >
        <Seg
          options={THEMES}
          value={debug.theme}
          onChange={(v) => patch({ theme: v })}
        />
      </Section>

      <Section
        title="Slideshow"
        note={slides.length ? 'Jumping to a slide pauses the rotation.' : 'No slides built yet.'}
      >
        <div className="dbg-btn-row">
          <button
            type="button"
            className={debug.paused ? 'is-on' : ''}
            onClick={() => patch({ paused: !debug.paused })}
          >
            {debug.paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
          <button type="button" disabled={!slides.length} onClick={() => gotoSlide(slideIdx - 1)}>◀ Prev</button>
          <button type="button" disabled={!slides.length} onClick={() => gotoSlide(slideIdx + 1)}>Next ▶</button>
        </div>
        <div className="dbg-slides">
          {slides.map((s, i) => (
            <button
              key={s.key + i}
              type="button"
              className={i === slideIdx ? 'is-on' : ''}
              onClick={() => gotoSlide(i)}
            >
              <span className="dbg-slide-i">{i + 1}</span>
              <span className="dbg-slide-k">{s.key}</span>
              <span className="dbg-slide-d">{Math.round(s.durationMs / 1000)}s</span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Clock"
        note={
          'The offset is applied to the live clock, so the board keeps ticking ' +
          'from the mocked instant. Prayer times, the countdown, the rail and the ' +
          'after-Isha theme follow it. Server-scoped content (this week’s grid, ' +
          'today’s events, the Hijrī date) is fetched for the real date and does not.'
        }
      >
        <div className="dbg-readout">
          <div className="dbg-readout-big">{hhmmss}</div>
          <div className="dbg-readout-sub">
            board time{tz ? ` · ${tz}` : ''} · offset {formatOffset(debug.timeOffsetMs)}
          </div>
        </div>

        <div className="dbg-btn-row dbg-wrap">
          {NUDGES.map((n) => (
            <button
              key={n.label}
              type="button"
              onClick={() => patch({ timeOffsetMs: debug.timeOffsetMs + n.ms })}
            >
              {n.label}
            </button>
          ))}
        </div>

        <label className="dbg-label" htmlFor="dbg-when">Set date &amp; time</label>
        <input
          id="dbg-when"
          className="dbg-input"
          type="datetime-local"
          value={toLocalInputValue(now)}
          onChange={(e) => applyDateTime(e.target.value)}
        />

        <label className="dbg-label">Jump to prayer (−1 min)</label>
        <div className="dbg-btn-row dbg-wrap">
          {PRAYER_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              disabled={!data?.prayers?.[k]?.adhan}
              onClick={() => jumpToPrayer(k)}
            >
              {data?.prayers?.[k]?.english || k}
            </button>
          ))}
        </div>

        <div className="dbg-btn-row">
          <button
            type="button"
            disabled={!debug.timeOffsetMs}
            onClick={() => patch({ timeOffsetMs: 0 })}
          >
            Back to live
          </button>
          <button
            type="button"
            onClick={() => patch({ timeOffsetMs: debug.timeOffsetMs - (debug.timeOffsetMs % MIN) })}
            disabled={!(debug.timeOffsetMs % MIN)}
          >
            Round to minute
          </button>
        </div>
      </Section>

      <Section
        title="Jumuʿah card"
        note={
          jummahCount
            ? `Auto shows it Wed–Fri; today is ${autoJummah ? 'in' : 'outside'} that window.`
            : 'The payload carries no Jumuʿah slots, so the rail renders nothing even when forced on.'
        }
      >
        <Seg
          options={TRISTATE}
          value={debug.jummah}
          onChange={(v) => patch({ jummah: v })}
        />
      </Section>

      <div className="dbg-foot">
        <button
          type="button"
          className="dbg-reset"
          disabled={!dirty}
          onClick={() => setDebug({ theme: null, paused: false, timeOffsetMs: 0, jummah: null })}
        >
          Reset all overrides
        </button>
      </div>
    </div>
  );
}
