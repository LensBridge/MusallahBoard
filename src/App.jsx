// MusallahBoard — root orchestrator.
// Setup gate → fetch payload + prayer + weather → compose the design data
// shape → drive the slideshow built from the frame-builder registry.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getBoardPayload, getPrayerData, getWeather } from './api/index.js';
import { buildWeekColumns, buildHijri } from './models/index.js';
import { classifyPrayers } from './utils/prayers.js';
import { buildSlideshow } from './frames/registry.js';
import './frames/builders.jsx'; // registers default builders
import {
  getSetupConfig, isSetupComplete, applyCursorPreference,
  setDeviceId, getDeviceIdFromQuery,
} from './utils/cookies.js';
import SetupModal from './components/SetupModal.jsx';
import TopBar from './components/TopBar.jsx';
import PrayerRail from './components/PrayerRail.jsx';
import Ticker from './components/Ticker.jsx';

const INSTAGRAM = { handle: '@utmmsa', url: 'https://instagram.com/utmmsa' };
const PAYLOAD_REFRESH_MS = 10 * 60 * 1000;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

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
  return (
    <div style={{ transform: `scale(${s})`, transformOrigin: 'center center', width: 1920, height: 1080 }}>
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
  const [needsSetup, setNeedsSetup] = useState(!isSetupComplete());
  const [payload, setPayload] = useState(null);
  const [prayerInfo, setPrayerInfo] = useState(null); // { prayers, hijri }
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [slideIdx, setSlideIdx] = useState(0);
  // Setup modal force-opened by the operator hotkey, independent of whether
  // the board is already provisioned.
  const [setupOpen, setSetupOpen] = useState(false);
  const advanceTimer = useRef(null);

  const setup = getSetupConfig();

  useEffect(() => { applyCursorPreference(); }, [needsSetup]);

  // Headless provisioning + operator entry points.
  //
  // The device agent spawns Chromium and drives it over the DevTools
  // Protocol. It can provision this board without anyone touching the UI by
  // any of these (all equivalent — they set the `deviceId` cookie and reload):
  //   • Runtime.evaluate:  window.MusallahBoard.setDeviceId('<uuid>')
  //   • Network.setCookie: name=deviceId, then Page.reload
  //   • navigate to:       <board-url>?deviceId=<uuid>
  useEffect(() => {
    // Pick up a deviceId passed on the URL (agent navigation path).
    const fromQuery = getDeviceIdFromQuery();
    if (fromQuery && fromQuery !== setup.deviceId) {
      setDeviceId(fromQuery);
      setNeedsSetup(false);
      // Strip the param so it doesn't linger in the address bar / logs.
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('deviceId');
        window.history.replaceState({}, '', u);
      } catch { /* non-fatal */ }
    }

    window.MusallahBoard = {
      /** Provision (or re-point) this board, then reload to apply. */
      setDeviceId(id, { reload = true } = {}) {
        setDeviceId(id);
        if (reload) window.location.reload();
        else setNeedsSetup(!isSetupComplete());
        return getSetupConfig().deviceId;
      },
      /** Open / close the setup modal programmatically. */
      openSetup: () => setSetupOpen(true),
      closeSetup: () => setSetupOpen(false),
      getConfig: () => getSetupConfig(),
    };
    return () => { delete window.MusallahBoard; };
    // setup.deviceId only read for the initial query reconciliation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Operator hotkey: Alt+Shift+F opens the setup modal.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.shiftKey && (e.key === 'F' || e.key === 'f' || e.code === 'KeyF')) {
        e.preventDefault();
        setSetupOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 1s clock tick (drives countdown + classification).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadPayload = useCallback(async () => {
    if (needsSetup) return;
    try {
      const p = await getBoardPayload(setup.deviceId);
      setPayload(p);
      setError(null);
      try {
        const pr = await getPrayerData(p.deviceConfig.location);
        setPrayerInfo(pr);
      } catch (e) {
        console.error('prayer fetch failed', e);
      }
    } catch (e) {
      console.error('payload fetch failed', e);
      setError(e?.message || 'Unknown error');
    }
  }, [needsSetup, setup.deviceId]);

  useEffect(() => {
    loadPayload();
    const id = setInterval(loadPayload, PAYLOAD_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadPayload]);

  // Weather (best-effort, hidden on failure).
  useEffect(() => {
    if (needsSetup || !payload) return;
    let cancelled = false;
    const fetchW = () =>
      getWeather(payload.deviceConfig.location, setup.weatherApiKey).then((w) => {
        if (!cancelled) setWeather(w);
      });
    fetchW();
    const id = setInterval(fetchW, WEATHER_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [needsSetup, payload, setup.weatherApiKey]);

  const tz = payload?.deviceConfig?.location?.timezone;

  // Compose the design data shape.
  const data = useMemo(() => {
    if (!payload || !prayerInfo) return null;
    return {
      date: {
        gregorian: gregorian(now, tz),
        hijri: buildHijri(prayerInfo.hijri),
      },
      weather,
      prayers: prayerInfo.prayers,
      jummahPrayers: payload.jummahPrayers,
      todayEvents: payload.todayEvents,
      week: buildWeekColumns(payload.weekEvents, tz),
      verse: payload.verse,
      hadith: payload.hadith,
      instagram: INSTAGRAM,
      scrollingMessages: payload.scrollingMessages,
    };
    // now intentionally excluded — gregorian only needs day granularity and
    // recomputing every second would thrash useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, prayerInfo, weather, tz, now.toDateString()]);

  // Build the slideshow from the registry whenever the payload changes.
  const slides = useMemo(() => {
    if (!payload) return [];
    return buildSlideshow(payload, {});
  }, [payload]);

  // Keep slide index in range when the deck changes.
  useEffect(() => {
    if (slides.length && slideIdx >= slides.length) setSlideIdx(0);
  }, [slides, slideIdx]);

  // Auto-advance using each frame's durationMs.
  useEffect(() => {
    if (!slides.length) return;
    clearTimeout(advanceTimer.current);
    const dur = slides[slideIdx]?.durationMs || 14000;
    advanceTimer.current = setTimeout(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, dur);
    return () => clearTimeout(advanceTimer.current);
  }, [slideIdx, slides]);

  // Blocking setup: board not yet provisioned (no deviceId at all).
  if (needsSetup) {
    return <SetupModal onComplete={() => { setNeedsSetup(false); setSetupOpen(false); }} />;
  }

  // Loading / error screen — still allow the operator hotkey to summon setup
  // so a mis-provisioned board can be fixed on the spot.
  if (!data || !slides.length) {
    return (
      <>
        <Status
          title="MusallahBoard"
          detail={error ? 'Reconnecting to the board service…' : 'Loading the board…'}
          error={error}
        />
        {setupOpen && (
          <SetupModal
            dismissable
            onCancel={() => setSetupOpen(false)}
            onComplete={() => { setSetupOpen(false); setNeedsSetup(false); }}
          />
        )}
      </>
    );
  }

  // Theme: switch to night after Isha when the device opts in.
  const { current, next } = classifyPrayers(data.prayers, now);
  const theme =
    payload.deviceConfig.darkModeAfterIsha && (current === 'isha' || next === 'fajr')
      ? 'night'
      : 'night';

  const active = slides[slideIdx] || slides[0];
  const isPoster = active.key.startsWith('poster');
  const isQuote = active.key === 'verse' || active.key === 'hadith';
  const activeCls = [
    'slide',
    isPoster ? 'poster-slide' : '',
    isQuote ? 'quote-slide' : '',
    active.key === 'ig' ? 'ig-slide' : '',
  ].filter(Boolean).join(' ');

  const showTicker = data.scrollingMessages.length > 0;
  // Show the Jummah card Wed–Fri (matches prior board behaviour).
  const dow = now.getDay();
  const showJummah = data.jummahPrayers.length > 0 && dow >= 3 && dow <= 5;

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
              <div key={active.key} className={activeCls}>
                {active.render({ data, now })}
              </div>
            </div>

            <div className="slide-indicators">
              {slides.map((s, i) => {
                let cls = 'slide-indicator';
                if (i === slideIdx) cls += ' is-active';
                else if (i < slideIdx) cls += ' is-passed';
                return (
                  <div
                    key={s.key + i}
                    className={cls}
                    onClick={() => setSlideIdx(i)}
                    style={i === slideIdx ? { '--slide-dur': s.durationMs / 1000 + 's' } : undefined}
                  />
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
    {setupOpen && (
      <SetupModal
        dismissable
        onCancel={() => setSetupOpen(false)}
        onComplete={() => { setSetupOpen(false); setNeedsSetup(false); }}
      />
    )}
    </>
  );
}
