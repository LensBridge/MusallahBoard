// First-boot setup — captures the enrolled device id. Weather is now resolved
// server-side per device, so there is no weather key to enter here.
// Also opened on demand by the operator hotkey (Alt+Shift+F); in that case
// it is `dismissable` (Esc / Cancel) so an already-running board isn't forced
// to re-provision.
import { useState, useEffect } from 'react';
import { saveSetupConfig, getSetupConfig } from '../utils/cookies.js';

export default function SetupModal({ onComplete, onCancel, dismissable = false }) {
  const existing = getSetupConfig();
  const [deviceId, setDeviceId] = useState(existing.deviceId || '');
  const [hideCursor, setHideCursor] = useState(existing.hideCursor);

  const valid = deviceId.trim().length > 0;

  // Esc closes the modal when it was opened on a provisioned board.
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissable, onCancel]);

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    saveSetupConfig({
      deviceId: deviceId.trim(),
      hideCursor,
    });
    onComplete();
  }

  return (
    <div className="setup-modal">
      <form className="setup-card" onSubmit={submit}>
        <h2>Board Setup</h2>
        <div className="sub">UTM MSA · MusallahBoard kiosk</div>

        <div className="setup-field">
          <label htmlFor="deviceId">Device ID (from enrollment)</label>
          <input
            id="deviceId"
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoFocus
          />
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
          {dismissable && (
            <button type="button" className="setup-cancel" onClick={() => onCancel?.()}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={!valid}>Save &amp; Launch</button>
        </div>
      </form>
    </div>
  );
}
