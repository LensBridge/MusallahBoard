// Operator diagnostics panel. Opened by Alt+Shift+F or `window.MusallahBoard.openSetup()`. Sibling to DebugMenu.jsx (Alt+Shift+D)
import { useState, useEffect } from 'react';
import {
  saveSetupConfig, getSetupConfig, isValidDeviceId,
} from '../utils/cookies.js';
import { getApiConfig, statusContent } from '../api/index.js';
import { RUNTIME, APP_VERSION } from '../runtime.js';

function Row({ label, value }) {
  return (
    <div className="setup-diag-row">
      <span className="setup-diag-label">{label}</span>
      <span className="setup-diag-value">{value ?? '—'}</span>
    </div>
  );
}

/** Local-runtime rows, from the agent's /api/local/status (may be null). */
function LocalRows({ local }) {
  if (!local) return <Row label="Agent" value="status unavailable" />;
  const c = statusContent(local);
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

export default function SetupModal({ onComplete, onCancel, status, localStatus }) {
  const existing = getSetupConfig();
  const [deviceId, setDeviceId] = useState(existing.deviceId || '');
  const [hideCursor, setHideCursor] = useState(existing.hideCursor);

  const trimmed = deviceId.trim();
  const valid = isValidDeviceId(trimmed);
  const idDirty = trimmed !== (existing.deviceId || '');
  const cursorDirty = hideCursor !== existing.hideCursor;
  const canApply = (idDirty ? valid : true) && (idDirty || cursorDirty);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function submit(e) {
    e.preventDefault();
    if (!canApply) return;
    saveSetupConfig({ deviceId: idDirty && valid ? trimmed : null, hideCursor });
    onComplete?.(idDirty && valid ? trimmed : existing.deviceId);
  }

  const backend = getApiConfig().baseUrl || `${window.location.origin} (same-origin)`;
  const local = RUNTIME === 'local';
  // Local: the agent's word on identity, not the cookie (which it never sets).
  const device = local ? localStatus?.deviceId : existing.deviceId;

  return (
    <div className="setup-modal">
      <form className="setup-card" onSubmit={submit}>
        <h2>Board Diagnostics</h2>
        <div className="sub">UTM MSA · MusallahBoard kiosk</div>

        <div className="setup-diag">
          <Row label="Device" value={device || (local ? 'unknown' : 'not enrolled')} />
          <Row label="Runtime" value={RUNTIME} />
          <Row label="App version" value={APP_VERSION} />
          <Row label={local ? 'Served by' : 'Backend'} value={backend} />
          {local && <LocalRows local={localStatus} />}
          <Row label="Last payload" value={status?.lastPayloadAt} />
          <Row label="On screen" value={status?.slideKey} />
          {status?.error && <Row label="Last error" value={status.error} />}
        </div>

        {/* The override writes the cookie, which only the hosted site reads. A
            local board is whoever its agent says it is. */}
        {!local && <div className="setup-field">
          <label htmlFor="deviceId">Device ID override</label>
          <input
            id="deviceId"
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoFocus
          />
          {idDirty && trimmed && !valid && (
            <div className="setup-hint setup-hint-bad">Must be a UUID.</div>
          )}
          <div className="setup-hint">
            Normally set by the device agent. Change this only to re-point a
            board by hand.
          </div>
        </div>}

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
          <button type="button" className="setup-cancel" onClick={() => onCancel?.()}>
            Close
          </button>
          <button type="submit" disabled={!canApply}>Apply</button>
        </div>
      </form>
    </div>
  );
}
