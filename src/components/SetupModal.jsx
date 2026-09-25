// Operator diagnostics panel. Opened by Alt+Shift+F or `window.MusallahBoard.openSetup()`. Sibling to DebugMenu.jsx (Alt+Shift+D)
import { useState, useEffect } from 'react';
import { getHideCursor, setHideCursor as saveHideCursor } from '../utils/cookies.js';
import { APP_VERSION } from '../version.js';

function Row({ label, value }) {
  return (
    <div className="setup-diag-row">
      <span className="setup-diag-label">{label}</span>
      <span className="setup-diag-value">{value ?? '—'}</span>
    </div>
  );
}

/** Rows from the agent's /api/local/status (may be null). */
function LocalRows({ local }) {
  if (!local) return <Row label="Agent" value="status unavailable" />;
  const c = local?.content;
  const sync = local.sync;
  let remaining = null;
  if (c) {
    remaining = local.staleDays > 0
      ? `0 — content ran out ${local.staleDays} day${local.staleDays === 1 ? '' : 's'} ago`
      : String(local.daysRemaining ?? '—');
  }
  // The version the agent installed, next to the one actually running: they
  // differ for the moment between an app install and the reload it triggers,
  // and a board stuck in that state is worth seeing.
  const installed = local.app?.version;
  return (
    <>
      <Row label="Agent" value={local.agentVersion} />
      <Row label="App installed" value={
        !installed ? 'none'
          : installed === APP_VERSION ? installed : `${installed} (running ${APP_VERSION})`
      } />
      <Row label="Content" value={
        c ? `${c.firstDay} → ${c.lastDay}` : local.error ? `unreadable: ${local.error}` : 'none installed'
      } />
      {c && <Row label="Source" value={c.source} />}
      {c && <Row label="Installed" value={c.installedAt} />}
      <Row label="Days remaining" value={remaining} />
      <Row label="Sync" value={
        !sync ? null
          : !sync.enabled ? 'off'
            : sync.lastSuccessAt ? `last success ${sync.lastSuccessAt}` : 'no success yet'
      } />
      {sync?.lastError && <Row label="Sync error" value={sync.lastError} />}
    </>
  );
}

export default function SetupModal({ onClose, status, localStatus }) {
  const savedHideCursor = getHideCursor();
  const [hideCursor, setHideCursor] = useState(savedHideCursor);
  const canApply = hideCursor !== savedHideCursor;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    if (!canApply) return;
    saveHideCursor(hideCursor);
    onClose?.();
  }

  return (
    <div className="setup-modal">
      <form className="setup-card" onSubmit={submit}>
        <h2>Board Diagnostics</h2>
        <div className="sub">UTM MSA · MusallahBoard kiosk</div>

        <div className="setup-diag">
          <Row label="Device" value={localStatus?.deviceId || 'unknown'} />
          <Row label="App version" value={APP_VERSION} />
          <Row label="Served by" value={window.location.origin} />
          <LocalRows local={localStatus} />
          <Row label="Last payload" value={status?.lastPayloadAt} />
          <Row label="On screen" value={status?.slideKey} />
          {status?.error && <Row label="Last error" value={status.error} />}
        </div>

        <div className="setup-row">
          <input
            id="hideCursor"
            type="checkbox"
            checked={hideCursor}
            onChange={(e) => setHideCursor(e.target.checked)}
          />
          <label htmlFor="hideCursor">Hide mouse cursor (kiosk mode)</label>
        </div>

        <div className="setup-actions">
          <button type="button" className="setup-cancel" onClick={() => onClose?.()}>
            Close
          </button>
          <button type="submit" disabled={!canApply}>Apply</button>
        </div>
      </form>
    </div>
  );
}
