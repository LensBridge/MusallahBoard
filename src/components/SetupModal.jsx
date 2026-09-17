// Operator diagnostics panel. Opened by Alt+Shift+F or `window.MusallahBoard.openSetup()`. Sibling to DebugMenu.jsx (Alt+Shift+D)
import { useState, useEffect } from 'react';
import { saveSetupConfig, getSetupConfig, isValidDeviceId } from '../utils/cookies.js';
import { getApiConfig } from '../api/index.js';

function Row({ label, value }) {
  return (
    <div className="setup-diag-row">
      <span className="setup-diag-label">{label}</span>
      <span className="setup-diag-value">{value ?? '—'}</span>
    </div>
  );
}

export default function SetupModal({ onComplete, onCancel, status }) {
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

  return (
    <div className="setup-modal">
      <form className="setup-card" onSubmit={submit}>
        <h2>Board Diagnostics</h2>
        <div className="sub">UTM MSA · MusallahBoard kiosk</div>

        <div className="setup-diag">
          <Row label="Device" value={existing.deviceId || 'not enrolled'} />
          <Row label="Backend" value={backend} />
          <Row label="Last payload" value={status?.lastPayloadAt} />
          <Row label="On screen" value={status?.slideKey} />
          {status?.error && <Row label="Last error" value={status.error} />}
        </div>

        <div className="setup-field">
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
          <button type="button" className="setup-cancel" onClick={() => onCancel?.()}>
            Close
          </button>
          <button type="submit" disabled={!canApply}>Apply</button>
        </div>
      </form>
    </div>
  );
}
