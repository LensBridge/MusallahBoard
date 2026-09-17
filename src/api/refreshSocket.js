/**
 * =====================================================
 * Refresh Socket
 * =====================================================
 * Listens on the backend's board-refresh channel and asks the app to re-fetch
 * in place.
 *
 * The backend (`BoardStreamHandler`) pushes JSON:
 *
 *   { type: "refresh", reason: "posters"|"events"|"weekly-content"|"config"|"manual-refresh",
 *     deviceId: <uuid|null>, at: <ISO> }
 *
 * Content edits fan out to every board; `reason: "config"` is addressed to one.
 * `?deviceId=` is mandatory — the channel carries enrolled devices only and the
 * backend closes a connection that cannot name a known, unrevoked one. Older
 * backends broadcast the bare string "REFRESH", so the matcher still accepts
 * anything containing that word.
 *
 * We deliberately soft-refresh rather than `location.reload()`: a reload on a
 * kiosk means a visible white flash, a lost slide position, and a fresh round
 * of font/image fetches on a screen people are looking at.
 * =====================================================
 */

import { getApiConfig } from './client.js';

const BASE_MS = 1000;
const MAX_MS = 60000;

/** Derive the ws(s):// endpoint from the configured API base. */
function socketUrl(deviceId) {
  const base = getApiConfig().baseUrl || window.location.origin;
  const origin = base.replace(/\/$/, '').replace(/^http/, 'ws');
  return `${origin}/api/refresh-musallahboard?deviceId=${encodeURIComponent(deviceId)}`;
}

/**
 * Decide whether a frame is a refresh for us.
 * @returns {string|null} the reason, or null to ignore the frame
 */
function refreshReason(text) {
  try {
    const msg = JSON.parse(text);
    if (msg?.type !== 'refresh') return null;
    return msg.reason || 'unknown';
  } catch {
    // Legacy bare-string broadcast.
    return text.toUpperCase().includes('REFRESH') ? 'legacy' : null;
  }
}

/**
 * Open the refresh channel.
 *
 * @param {string} deviceId  this board's enrolled device UUID. Required: an
 *   unenrolled board has nothing to refetch, and the backend would reject it.
 * @param {(reason: string) => unknown} onRefresh called when the backend asks
 *   us to re-fetch
 * @returns {() => void} disposer — closes the socket and cancels any pending
 *   reconnect. Safe to call more than once.
 */
export function connectRefreshSocket(deviceId, onRefresh) {
  if (!deviceId) throw new Error('connectRefreshSocket: deviceId is required');

  let socket = null;
  let timer = null;
  let attempts = 0;
  let closed = false;

  const scheduleReconnect = () => {
    if (closed || timer) return;
    // Full jitter over an exponential window: a fleet of boards coming back
    // from a backend restart must not reconnect in lockstep.
    const window_ = Math.min(MAX_MS, BASE_MS * 2 ** attempts);
    const delay = Math.floor(Math.random() * window_);
    attempts += 1;
    timer = setTimeout(() => {
      timer = null;
      open();
    }, delay);
  };

  function open() {
    if (closed) return;
    let ws;
    try {
      ws = new WebSocket(socketUrl(deviceId));
    } catch (e) {
      console.warn('refresh socket: could not open', e);
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => { attempts = 0; };

    ws.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : '';
      const reason = refreshReason(text);
      if (!reason) return;
      try {
        Promise.resolve(onRefresh(reason)).catch((e) =>
          console.error('refresh socket: refresh failed', e)
        );
      } catch (e) {
        console.error('refresh socket: refresh threw', e);
      }
    };

    // No onerror handler beyond logging: an error is always followed by a
    // close, and reconnecting from both would double-schedule.
    ws.onerror = () => { /* close handler owns recovery */ };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      scheduleReconnect();
    };
  }

  open();

  return () => {
    closed = true;
    if (timer) { clearTimeout(timer); timer = null; }
    if (socket) {
      // Drop the handler first so our own close doesn't queue a reconnect.
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  };
}
