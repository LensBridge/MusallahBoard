// MusallahBoard — root orchestrator.
// Served by the device agent at 127.0.0.1:8080: fetch the payload (weather
// rides along) + prayer → compose the design data shape → drive the slideshow
// built from the frame-builder registry.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  getBoardPayload, getPrayerData, getLocalStatus, connectLocalEvents,
  isNoContentError, isValidDeviceId,
} from './api/index.js';
import { prefetchPayloadImages } from './utils/prefetch.js';
import {
  buildAgendaDays, buildTodayEvents, buildHijri, zonedClock, isoDateKey,
} from './models/index.js';
import { classifyPrayers } from './utils/prayers.js';
import { buildSlideshow } from './frames/registry.js';
import { resolveTheme, DEFAULT_THEME } from './themes/registry.js';
import './frames/builders.jsx'; // registers default builders
import { applyCursorPreference } from './utils/cookies.js';
import { updateNotice } from './utils/updates.js';
import { APP_VERSION } from './version.js';
import SetupModal from './components/SetupModal.jsx';
import DebugMenu from './components/DebugMenu.jsx';
import TopBar from './components/TopBar.jsx';
import PrayerRail from './components/PrayerRail.jsx';
import Ticker from './components/Ticker.jsx';
import NoticeBanner from './components/NoticeBanner.jsx';

const PAYLOAD_REFRESH_MS = 10 * 60 * 1000;
const LOCAL_STATUS_REFRESH_MS = 60 * 1000;

// Presentation overrides driven by the debug drawer (Alt+Shift+D). `null` on a
// tri-state field means "don't override, use the board's own logic". Held in
// state only — see DebugMenu.jsx for why none of this is persisted.
const NO_DEBUG = { theme: null, paused: false, timeOffsetMs: 0, jummah: null };

// Scale the fixed 1920×1080 stage to fit any viewport, letterboxed black.
function ScaledStage({ children }) {
  const [s, setS] = useState(1);
  useEffect(() => {
    const calc = () =>
      setS(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  // Geometry lives in `.stage-scaler`; only the ratio comes from here.
  return (
    <div className="stage-scaler" style={{ '--stage-scale': s }}>
      {children}
    </div>
  );
}

// `large` is for screens that someone has to act on from across the room (the
// waiting-for-content screen); `hint` is a second, plainer line under detail.
function Status({ title, detail, error, hint, large = false }) {
  return (
    <div className={large ? 'board-status bs-large' : 'board-status'}>
      <div className="bs-inner">
        <h1>{title}</h1>
        <p>{detail}</p>
        {error && <div className="bs-err">{error}</div>}
        {hint && <div className="bs-hint">{hint}</div>}
      </div>
    </div>
  );
}

const SERVICE_PORT_URL = 'http://10.77.0.1/';

/**
 * Agent up, but no content package installed yet. What an
 * operator can do about it depends on whether the agent is trying to sync:
 *
 *   - sync on and no error yet: it is downloading; nothing to do but wait.
 *   - sync on and failing: say why (sync.lastError), and offer the offline
 *     routes too, since a board with no internet also lands here (its sync
 *     attempts fail fast with no route, section 11 of the architecture doc).
 *   - sync off, or no status at all: only the offline routes can help.
 */
function WaitingForContent({ status }) {
  const sync = status?.sync;
  const offline =
    `Plug in a USB stick with a MusallahBoard update, or connect a laptop or phone ` +
    `to the board's ethernet port and open ${SERVICE_PORT_URL}`;
  if (sync?.enabled && !sync.lastError) {
    return (
      <Status
        large
        title="Waiting for content"
        detail="Downloading content from LensBridge…"
      />
    );
  }
  if (sync?.enabled) {
    return (
      <Status
        large
        title="Waiting for content"
        detail="Could not download content from LensBridge"
        error={sync.lastError}
        hint={offline}
      />
    );
  }
  return (
    <Status
      large
      title="Waiting for content"
      detail="No content is installed on this board"
      hint={offline}
    />
  );
}

/**
 * "Content last updated …" note for a board whose installed content has run
 * out. Past lastDay the agent keeps serving lastDay's payload, so the board
 * still looks alive, and this is the one visible hint that nobody has sent new
 * content. Dated by when the package was made, in the content's zone.
 */
function StaleNote({ status }) {
  if (!(status?.staleDays > 0)) return null;
  const b = status?.content;
  let when = b?.lastDay ?? '';
  const createdAt = b?.createdAt;
  const at = createdAt ? new Date(createdAt) : null;
  if (at && !Number.isNaN(at.getTime())) {
    try {
      when = new Intl.DateTimeFormat('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        timeZone: b.timezone || undefined,
      }).format(at);
    } catch { /* keep lastDay */ }
  }
  return <div className="stale-note">Content last updated {when}</div>;
}

function gregorian(now, timezone) {
  const f = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: timezone || undefined,
  }).formatToParts(now);
  const g = (t) => f.find((p) => p.type === t)?.value ?? '';
  return { weekday: g('weekday'), day: g('day'), month: g('month'), year: g('year') };
}

export default function App() {
  // The agent says who we are in /api/local/status. Until that answers the id
  // is simply unknown; it is for diagnostics only, since the agent serves just
  // its own board and the payload is fetched without it.
  const [deviceId, setDeviceId] = useState(null);
  const [payload, setPayload] = useState(null);
  const [prayerInfo, setPrayerInfo] = useState(null); // { prayers, hijri }
  const [error, setError] = useState(null);
  // The last payload fetch said the agent has no content yet.
  const [noContent, setNoContent] = useState(false);
  const [lastPayloadAt, setLastPayloadAt] = useState(null);
  // The agent's /api/local/status, refreshed with the payload and every
  // minute (see applyLocalStatus below).
  const [localStatus, setLocalStatus] = useState(null);
  const [realNow, setRealNow] = useState(new Date());
  const [slideIdx, setSlideIdx] = useState(0);
  // Diagnostics panel, opened by the operator hotkey. Never a gate.
  const [setupOpen, setSetupOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState(NO_DEBUG);
  // The agent's latest update notice (components/NoticeBanner.jsx). Each
  // gets an id so a banner timing out cannot clear the one that replaced it.
  const [notice, setNotice] = useState(null);
  const noticeSeq = useRef(0);
  const clearNotice = useCallback((id) => setNotice((n) => (n && n.id === id ? null : n)), []);
  const advanceTimer = useRef(null);

  // Everything downstream reads `now`, so time travel is a single shift here.
  // An offset rather than a frozen instant: the board must keep ticking from
  // the mocked time or countdowns and prayer transitions can't be observed.
  const now = useMemo(
    () => (debug.timeOffsetMs ? new Date(realNow.getTime() + debug.timeOffsetMs) : realNow),
    [realNow, debug.timeOffsetMs]
  );

  // Force the cursor visible while either operator panel is open, otherwise
  // an operator on a touchscreen-less board can't aim at its own fields. Both
  // panels share one effect: as two, closing either would re-hide the cursor
  // out from under the other.
  useEffect(() => {
    if (setupOpen || debugOpen) document.body.classList.remove('cursor-hidden');
    else applyCursorPreference();
  }, [setupOpen, debugOpen]);

  // Operator hotkeys: Alt+Shift+F opens setup, Alt+Shift+D the debug drawer.
  // Matched on e.code too because Alt+Shift on some layouts yields a dead key
  // rather than the letter.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || !e.shiftKey) return;
      if (e.key === 'F' || e.key === 'f' || e.code === 'KeyF') {
        e.preventDefault();
        setSetupOpen(true);
      } else if (e.key === 'D' || e.key === 'd' || e.code === 'KeyD') {
        e.preventDefault();
        setDebugOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 1s clock tick (drives countdown + classification).
  useEffect(() => {
    const id = setInterval(() => setRealNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // No device id is needed: the agent serves only its own board. The result
  // is what window.MusallahBoard.refresh() resolves to for the agent.
  const loadPayload = useCallback(async () => {
    // Alongside the payload, not after it: when the agent has no content the
    // payload 503s, and that is exactly when the waiting screen and the
    // diagnostics need the status.
    getLocalStatus().then((s) => applyLocalStatusRef.current(s));
    try {
      const p = await getBoardPayload();
      prefetchPayloadImages(p);
      setPayload(p);
      setError(null);
      setNoContent(false);
      setLastPayloadAt(Date.now());
      // Computed locally (adhan + Intl), recomputed on every payload load —
      // which is also what rolls the times over after midnight.
      try {
        setPrayerInfo(getPrayerData(p.deviceConfig.location));
      } catch (e) {
        console.error('prayer computation failed', e);
      }
      return { ok: true, at: new Date().toISOString() };
    } catch (e) {
      // Not an error on a board that has simply never been given content: it
      // gets its own screen instead of "Reconnecting…".
      const empty = isNoContentError(e);
      if (!empty) console.error('payload fetch failed', e);
      setNoContent(empty);
      setError(e?.message || 'Unknown error');
      return { ok: false, error: e?.message || 'Unknown error' };
    }
  }, []);

  useEffect(() => {
    loadPayload();
    const id = setInterval(loadPayload, PAYLOAD_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadPayload]);

  // ---------------------------------------------------------------------
  // Agent status. Polled every minute (and with every payload load)
  // so the waiting screen, the staleness note and the diagnostics stay current
  // without depending on the event stream. It is also the backstop for events
  // missed while the stream was down:
  //   - content appearing while we sit on the waiting screen loads it at once
  //     rather than at the next 10-minute payload poll;
  //   - a change of installed app version between two polls reloads the page.
  //     Compared poll to poll, never against APP_VERSION: a package whose
  //     signed version differs from the package.json it was built from would
  //     otherwise reload the board forever.
  // Held in a ref so loadPayload (above) and the interval always call the
  // version that sees current state.
  // ---------------------------------------------------------------------
  const seenAppVersion = useRef(undefined);
  //
  // Only the minute poll may trigger the content catch-up. loadPayload fetches
  // the status too, and if it could also call back into loadPayload, an agent
  // whose status and payload disagree would have the two chase each other.
  const applyLocalStatus = (s, { fromPoll = false } = {}) => {
    setLocalStatus(s);
    if (!s) return;
    if (isValidDeviceId(s.deviceId)) setDeviceId(s.deviceId.trim());
    const appVersion = s.app?.version ?? null;
    if (seenAppVersion.current === undefined) seenAppVersion.current = appVersion;
    else if (appVersion && appVersion !== seenAppVersion.current) {
      window.location.reload();
      return;
    }
    if (fromPoll && noContent && s?.content) refreshRef.current();
  };
  const applyLocalStatusRef = useRef(applyLocalStatus);
  useEffect(() => { applyLocalStatusRef.current = applyLocalStatus; });

  useEffect(() => {
    const id = setInterval(
      () => getLocalStatus().then((s) => applyLocalStatusRef.current(s, { fromPoll: true })),
      LOCAL_STATUS_REFRESH_MS
    );
    return () => clearInterval(id);
  }, []);

  const tz = payload?.deviceConfig?.location?.timezone;

  // Compose the design data shape.
  const data = useMemo(() => {
    if (!payload || !prayerInfo) return null;
    return {
      timezone: tz,
      date: {
        gregorian: gregorian(now, tz),
        hijri: buildHijri(prayerInfo.hijri),
      },
      weather: payload.weather,
      prayers: prayerInfo.prayers,
      jummahPrayers: payload.jummahPrayers,
      todayEvents: buildTodayEvents(payload.agendaDays, now, tz),
      agenda: buildAgendaDays(payload.agendaDays, now, tz),
      verse: payload.verse,
      hadith: payload.hadith,
      scrollingMessages: payload.scrollingMessages,
    };
    // now intentionally excluded — gregorian and the agenda window only need
    // day granularity, and recomputing every second would thrash useMemo.
    // Keyed on the date *in the board's zone*, not the Pi's: a box left on UTC
    // would otherwise roll the agenda over at the wrong midnight, which is the
    // same class of bug zonedClock() exists to prevent for prayer times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, prayerInfo, tz, isoDateKey(now, tz)]);

  // Build the slideshow from the registry whenever the payload changes.
  //
  // The ctx carries the composed view data a builder needs to size itself: a
  // frame whose duration is "auto" has to know how much it will end up showing,
  // and the frame definition alone cannot say. `data.agenda` rather than
  // `payload.agendaDays` because the day-rollover layer is what decides which
  // bucket is today — so the deck is also rebuilt when the board's date turns
  // over, with the durations recomputed for the new day.
  const slides = useMemo(() => {
    if (!payload || !data) return [];
    return buildSlideshow(payload, { agendaDays: data.agenda });
  }, [payload, data]);

  // Keep slide index in range when the deck changes.
  useEffect(() => {
    if (slides.length && slideIdx >= slides.length) setSlideIdx(0);
  }, [slides, slideIdx]);

  // Auto-advance using each frame's durationMs. Held still while the debug
  // drawer's pause is on; resuming restarts the current slide's full duration.
  useEffect(() => {
    if (!slides.length || debug.paused) return;
    clearTimeout(advanceTimer.current);
    const dur = slides[slideIdx]?.durationMs || 14000;
    advanceTimer.current = setTimeout(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, dur);
    return () => clearTimeout(advanceTimer.current);
  }, [slideIdx, slides, debug.paused]);

  // ---------------------------------------------------------------------
  // Agent-facing surface.
  //
  // The device agent drives this page over the DevTools Protocol: its
  // config.refresh command calls window.MusallahBoard.refresh(), and its
  // telemetry reads getStatus().
  //
  // The globals must always see current values, but they are registered once
  // so the agent never races a re-render and finds them missing. Hence the
  // latest-value refs: registering them in an effect that closed over the
  // first render would report stale state forever.
  // ---------------------------------------------------------------------
  const refreshRef = useRef(loadPayload);
  const statusRef = useRef(null);

  useEffect(() => { refreshRef.current = loadPayload; });
  useEffect(() => {
    statusRef.current = () => ({
      deviceId: deviceId ?? null,
      paired: isValidDeviceId(deviceId),
      appVersion: APP_VERSION,
      content: localStatus?.content ?? null,
      noContent,
      slideKey: slides[slideIdx]?.key ?? null,
      slideIndex: slides.length ? slideIdx : null,
      slideCount: slides.length,
      lastPayloadAt: lastPayloadAt ? new Date(lastPayloadAt).toISOString() : null,
      error: error ?? null,
    });
  });

  useEffect(() => {
    window.MusallahBoard = {
      /** Re-fetch the payload and repaint in place. No reload. */
      refresh: () => refreshRef.current(),
      /** What this board thinks it is and what is currently on screen. */
      getStatus: () => statusRef.current?.() ?? null,
      openSetup: () => setSetupOpen(true),
      closeSetup: () => setSetupOpen(false),
      openDebug: () => setDebugOpen(true),
      closeDebug: () => setDebugOpen(false),
      /** Apply presentation overrides without the drawer. Partial patch. */
      setDebug: (patch) => setDebug((d) => ({ ...d, ...(patch || {}) })),
      resetDebug: () => setDebug(NO_DEBUG),
    };
    return () => { delete window.MusallahBoard; };
  }, []);

  // The agent listens on the backend's refresh channel itself and turns it
  // into content syncs. The page only hears the outcome, from the agent's event
  // stream: new content re-fetches in place, a new app release reloads into it.
  // Goes through the ref so it always calls the current loader.
  useEffect(() => {
    return connectLocalEvents({
      onContent: () => refreshRef.current(),
      onApp: () => window.location.reload(),
      onUpdates: () => getLocalStatus().then((s) => applyLocalStatusRef.current(s)),
      onNotice: (n) => setNotice({ ...n, id: ++noticeSeq.current }),
    });
  }, []);

  // The drawer is reachable from every render path — a board stuck on the
  // loading screen is exactly when you want to force a theme or hold the deck.
  // The auto-* values only exist past the guards below, hence the parameters.
  const renderDebug = (autoTheme = DEFAULT_THEME, autoJummah = false) =>
    debugOpen && (
      <DebugMenu
        debug={debug}
        setDebug={setDebug}
        onClose={() => setDebugOpen(false)}
        data={data}
        now={now}
        slides={slides}
        slideIdx={slideIdx}
        setSlideIdx={setSlideIdx}
        autoTheme={autoTheme}
        pinnedTheme={payload?.deviceConfig?.theme ?? null}
        autoJummah={autoJummah}
      />
    );

  // Loading / error screen: the operator hotkeys still work, so a stuck board
  // can be diagnosed on the spot.
  if (!data || !slides.length) {
    return (
      <>
        {noContent ? (
          <WaitingForContent status={localStatus} />
        ) : (
          <Status
            title="MusallahBoard"
            detail={error ? 'Reconnecting to the board service…' : 'Version 2027'}
            error={error}
          />
        )}
        {renderDebug()}
        <NoticeBanner notice={notice} onDone={clearNotice} />
        {setupOpen && (
          <SetupModal
            status={statusRef.current?.()}
            localStatus={localStatus}
            onClose={() => setSetupOpen(false)}
          />
        )}
      </>
    );
  }

  // Theme, in precedence order: the operator's drawer override, then whatever
  // the backend pinned on this device, then the board's own time-of-day rule
  // (night after Isha, when the device opts in). resolveTheme skips anything
  // that isn't a real theme, so an unset or misspelled backend value simply
  // falls through to the next choice instead of blanking the stage.
  const { current, next } = classifyPrayers(data.prayers, now, tz);
  const autoTheme =
    payload.deviceConfig.darkModeAfterIsha && (current === 'isha' || next === 'fajr')
      ? 'night'
      : 'day';
  const boardTheme = resolveTheme(payload.deviceConfig.theme, autoTheme);
  const theme = resolveTheme(debug.theme, boardTheme);

  // Software waiting for the night's install window is announced on the
  // ticker, after the board's own messages.
  const updateLine = updateNotice(localStatus?.updates, now, tz);
  const tickerMessages = updateLine ? [...data.scrollingMessages, updateLine] : data.scrollingMessages;
  const showTicker = tickerMessages.length > 0;
  // Show the Jummah card Wed–Fri (matches prior board behaviour). Read in the
  // board's zone: near midnight the browser's day can be the wrong one.
  const dow = zonedClock(now, tz).weekday;
  const autoJummah = data.jummahPrayers.length > 0 && dow >= 3 && dow <= 5;
  const showJummah = debug.jummah ?? autoJummah;

  return (
    <>
    <div className="stage-wrap">
      <ScaledStage>
        <div className="stage" data-theme={theme} data-density="cozy">
          <TopBar data={data} now={now} />
          <PrayerRail
            data={data}
            now={now}
            brothers
            showJummah={showJummah}
          />
          <main className="stage-main">
            <div className="slides">
              {slides.map((slide, i) => {
                const isActive = i === slideIdx;
                const isPoster = slide.key.startsWith('poster');
                const isQuote = slide.key === 'verse' || slide.key === 'hadith';
                const cls = [
                  'slide',
                  isPoster ? 'poster-slide' : '',
                  isQuote ? 'quote-slide' : '',
                  slide.key.startsWith('social-') ? 'social-slide' : '',
                  isActive ? 'is-active' : 'is-hidden',
                ].filter(Boolean).join(' ');
                return (
                  <div key={slide.key} className={cls}>
                    {slide.render({ data, now })}
                  </div>
                );
              })}
            </div>
            <StaleNote status={localStatus} />
          </main>

          {showTicker ? (
            <Ticker messages={tickerMessages} now={now} />
          ) : (
            <div style={{ gridArea: 'ticker', background: 'var(--bg)', borderTop: '1px solid var(--line)' }} />
          )}
        </div>
      </ScaledStage>
    </div>
    {renderDebug(boardTheme, autoJummah)}
    <NoticeBanner notice={notice} onDone={clearNotice} onBoard />
    {setupOpen && (
      <SetupModal
        status={statusRef.current?.()}
        localStatus={localStatus}
        onClose={() => setSetupOpen(false)}
      />
    )}
    </>
  );
}
