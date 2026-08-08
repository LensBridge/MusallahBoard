// MusallahBoard — root orchestrator.
// Setup gate → fetch payload (weather rides along) + prayer → compose the
// design data shape → drive the slideshow built from the frame-builder registry.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getBoardPayload, getPrayerData, connectRefreshSocket } from './api/index.js';
import { prefetchPayloadImages } from './utils/prefetch.js';
import { buildAgendaDays, buildHijri, zonedClock, isoDateKey } from './models/index.js';
import { classifyPrayers } from './utils/prayers.js';
import { buildSlideshow } from './frames/registry.js';
import { resolveTheme, DEFAULT_THEME } from './themes/registry.js';
import './frames/builders.jsx'; // registers default builders
import {
  getSetupConfig, applyCursorPreference, isValidDeviceId,
  setDeviceId as saveDeviceId,
} from './utils/cookies.js';
import SetupModal from './components/SetupModal.jsx';
import DebugMenu from './components/DebugMenu.jsx';
import TopBar from './components/TopBar.jsx';
import PrayerRail from './components/PrayerRail.jsx';
import Ticker from './components/Ticker.jsx';

// Fallback for the closing "Stay Connected" slide. A device that sets
// deviceConfig.socialUrl overrides the URL, so two boards can point at
// different destinations; the handle stays the org's since it is displayed
// as text rather than encoded.
const INSTAGRAM = { handle: '@utmmsa', url: 'https://instagram.com/utmmsa' };
const PAYLOAD_REFRESH_MS = 10 * 60 * 1000;

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

function Status({ title, detail, error }) {
  return (
    <div className="board-status">
      <div className="bs-inner">
        <h1>{title}</h1>
        <p>{detail}</p>
        {error && <div className="bs-err">{error}</div>}
      </div>
    </div>
  );
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
  // Identity is settled by resolveDeviceId() in main.jsx before the first
  // render, so the cookie is already authoritative here — no reconciliation
  // effect, and no unpaired flash on a board the agent provisioned.
  const [deviceId, setDeviceIdState] = useState(() => getSetupConfig().deviceId);
  const [payload, setPayload] = useState(null);
  const [prayerInfo, setPrayerInfo] = useState(null); // { prayers, hijri }
  const [error, setError] = useState(null);
  const [lastPayloadAt, setLastPayloadAt] = useState(null);
  const [realNow, setRealNow] = useState(new Date());
  const [slideIdx, setSlideIdx] = useState(0);
  // Setup modal force-opened by the operator hotkey. It is a diagnostics
  // panel now — never a gate. An unpaired board waits, it does not prompt.
  const [setupOpen, setSetupOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState(NO_DEBUG);
  const advanceTimer = useRef(null);

  // Everything downstream reads `now`, so time travel is a single shift here.
  // An offset rather than a frozen instant: the board must keep ticking from
  // the mocked time or countdowns and prayer transitions can't be observed.
  const now = useMemo(
    () => (debug.timeOffsetMs ? new Date(realNow.getTime() + debug.timeOffsetMs) : realNow),
    [realNow, debug.timeOffsetMs]
  );

  const needsSetup = !isValidDeviceId(deviceId);

  // Force the cursor visible while either operator panel is open, otherwise
  // an operator on a touchscreen-less board can't aim at its own fields. Both
  // panels share one effect: as two, closing either would re-hide the cursor
  // out from under the other.
  useEffect(() => {
    if (setupOpen || debugOpen) document.body.classList.remove('cursor-hidden');
    else applyCursorPreference();
  }, [needsSetup, setupOpen, debugOpen]);

  // While unpaired, watch for the cookie appearing. The agent's normal path is
  // to rewrite /etc/musallahboard/kiosk-url and let the systemd .path watcher
  // bounce the kiosk, but it can also provision in-place over CDP — this is
  // what makes that land without a reload.
  useEffect(() => {
    if (!needsSetup) return;
    const id = setInterval(() => {
      const current = getSetupConfig().deviceId;
      if (isValidDeviceId(current)) setDeviceIdState(current);
    }, 2000);
    return () => clearInterval(id);
  }, [needsSetup]);

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

  // Reads identity from the cookie at call time rather than from the closure:
  // the agent provisions and refreshes in a single evaluated expression, so
  // setDeviceId() and refresh() run in the same tick — before React has
  // re-rendered with the new id. Closing over `deviceId` would refetch with
  // the old one (or refuse as unpaired) on exactly the call that matters.
  const loadPayload = useCallback(async () => {
    const id = getSetupConfig().deviceId;
    if (!isValidDeviceId(id)) return { ok: false, reason: 'unpaired' };
    try {
      const p = await getBoardPayload(id);
      prefetchPayloadImages(p);
      setPayload(p);
      setError(null);
      setLastPayloadAt(Date.now());
      try {
        const pr = await getPrayerData(p.deviceConfig.location);
        setPrayerInfo(pr);
      } catch (e) {
        console.error('prayer fetch failed', e);
      }
      return { ok: true, deviceId: id, at: new Date().toISOString() };
    } catch (e) {
      console.error('payload fetch failed', e);
      setError(e?.message || 'Unknown error');
      return { ok: false, deviceId: id, error: e?.message || 'Unknown error' };
    }
    // deviceId is not read here, but a change to it must restart the polling
    // effect below so a freshly-paired board fetches immediately.
  }, [deviceId]);

  useEffect(() => {
    loadPayload();
    const id = setInterval(loadPayload, PAYLOAD_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadPayload]);

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
      todayEvents: payload.todayEvents,
      agenda: buildAgendaDays(payload.weekEvents, now, tz),
      verse: payload.verse,
      hadith: payload.hadith,
      instagram: {
        ...INSTAGRAM,
        url: payload.deviceConfig?.socialUrl?.trim() || INSTAGRAM.url,
      },
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
  const slides = useMemo(() => {
    if (!payload) return [];
    return buildSlideshow(payload, {});
  }, [payload]);

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
  // The device agent drives this page over the DevTools Protocol. Two paths
  // provision a board, both implemented:
  //   • navigate to <board-url>?deviceId=<uuid>   (kiosk-url + .path watcher)
  //   • Runtime.evaluate: window.MusallahBoard.setDeviceId('<uuid>')
  //
  // The globals must always see current values, but they are registered once
  // so the agent never races a re-render and finds them missing. Hence the
  // latest-value refs: registering them in an effect that closed over the
  // first render would refetch with a stale deviceId forever.
  // ---------------------------------------------------------------------
  const refreshRef = useRef(loadPayload);
  const statusRef = useRef(null);

  useEffect(() => { refreshRef.current = loadPayload; });
  useEffect(() => {
    statusRef.current = () => ({
      deviceId: deviceId ?? null,
      paired: !needsSetup,
      slideKey: slides[slideIdx]?.key ?? null,
      slideIndex: slides.length ? slideIdx : null,
      slideCount: slides.length,
      lastPayloadAt: lastPayloadAt ? new Date(lastPayloadAt).toISOString() : null,
      error: error ?? null,
    });
  });

  useEffect(() => {
    window.MusallahBoard = {
      /** Provision (or re-point) this board. Rejects anything but a UUID. */
      setDeviceId(id, { reload = true } = {}) {
        const next = String(id ?? '').trim();
        if (!isValidDeviceId(next)) {
          throw new Error(`setDeviceId: not a UUID: ${JSON.stringify(id)}`);
        }
        saveDeviceId(next);
        if (reload) window.location.reload();
        else setDeviceIdState(next);
        return next;
      },
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
      getConfig: () => getSetupConfig(),
    };
    // Alias for agent builds that predate MusallahBoard.refresh().
    window.__refreshBoard = () => window.MusallahBoard.refresh();
    return () => {
      delete window.MusallahBoard;
      delete window.__refreshBoard;
    };
  }, []);

  // Live content push. Only opened once this board is enrolled: the channel
  // carries enrolled devices only, and the backend closes anything that cannot
  // name a known device. The cookie poll above re-runs this on enrollment.
  // Goes through the ref so it always calls the current loader.
  useEffect(() => {
    if (!isValidDeviceId(deviceId)) return undefined;
    return connectRefreshSocket(deviceId, () => refreshRef.current());
  }, [deviceId]);

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

  // Unpaired: wait, never prompt. This is a wall-mounted screen with no
  // keyboard and a hidden cursor — a form here is a dead end. The agent
  // provisions us on its own schedule and the poll above picks it up.
  if (needsSetup) {
    return (
      <>
        <Status
          title="Waiting for device enrollment"
          detail="This board has not been paired with a device yet."
        />
        {renderDebug()}
        {setupOpen && (
          <SetupModal
            status={statusRef.current?.()}
            onCancel={() => setSetupOpen(false)}
            onComplete={(id) => { setSetupOpen(false); setDeviceIdState(id); }}
          />
        )}
      </>
    );
  }

  // Loading / error screen — still allow the operator hotkey to summon setup
  // so a mis-provisioned board can be fixed on the spot.
  if (!data || !slides.length) {
    return (
      <>
        <Status
          title="MusallahBoard"
          detail={error ? 'Reconnecting to the board service…' : 'Version 2027'}
          error={error}
        />
        {renderDebug()}
        {setupOpen && (
          <SetupModal
            status={statusRef.current?.()}
            onCancel={() => setSetupOpen(false)}
            onComplete={(id) => { setSetupOpen(false); setDeviceIdState(id); }}
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

  const showTicker = data.scrollingMessages.length > 0;
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
                  slide.key === 'ig' ? 'ig-slide' : '',
                  isActive ? 'is-active' : 'is-hidden',
                ].filter(Boolean).join(' ');
                return (
                  <div key={slide.key} className={cls}>
                    {slide.render({ data, now })}
                  </div>
                );
              })}
            </div>
          </main>

          {showTicker ? (
            <Ticker messages={data.scrollingMessages} now={now} />
          ) : (
            <div style={{ gridArea: 'ticker', background: 'var(--bg)', borderTop: '1px solid var(--line)' }} />
          )}
        </div>
      </ScaledStage>
    </div>
    {renderDebug(boardTheme, autoJummah)}
    {setupOpen && (
      <SetupModal
        status={statusRef.current?.()}
        onCancel={() => setSetupOpen(false)}
        onComplete={(id) => { setSetupOpen(false); setDeviceIdState(id); }}
      />
    )}
    </>
  );
}
