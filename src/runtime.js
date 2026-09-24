/**
 * =====================================================
 * Runtime
 * =====================================================
 * One build serves two very different hosts, and this
 * module decides, once, which one loaded the page
 * (agent/docs/architecture.md, section 15):
 *
 *   local   the device agent serves the page from the
 *           board's own disk at 127.0.0.1:8080. Payload,
 *           status and events are same-origin; the device
 *           id comes from /api/local/status; new content
 *           and new app releases are announced over SSE.
 *
 *   hosted  the Cloudflare deployment. Cross-origin
 *           backend (VITE_API_BASE_URL), device id from
 *           the cookie or `?deviceId=`, live refresh over
 *           the backend's WebSocket.
 *
 * Decided at module load and never again: the runtime is
 * fixed for the life of the page, and a later
 * history.replaceState() (resolveDeviceId strips its
 * query param) must not flip it. Deliberately not a
 * cookie either, so nothing a board once did can pin it
 * to the wrong runtime after its kiosk URL changes.
 * =====================================================
 */

/** Hosts the agent's local server answers on (loopback only). */
const LOCAL_HOSTS = new Set(['127.0.0.1:8080', 'localhost:8080']);

/**
 * @param {{ host: string, search: string }} loc  a Location, or anything shaped
 *   like one (the tests pass plain objects)
 * @returns {'local'|'hosted'}
 */
export function detectRuntime(loc) {
  try {
    if (LOCAL_HOSTS.has(String(loc.host).toLowerCase())) return 'local';
    const q = new URLSearchParams(loc.search);
    if ((q.get('runtime') || '').trim().toLowerCase() === 'local') return 'local';
    // v1 agents pointed the kiosk at `?mode=offline`. Such a board is by
    // definition served by its agent, so it is the local runtime too.
    if ((q.get('mode') || '').trim().toLowerCase() === 'offline') return 'local';
  } catch { /* fall through: a page we cannot inspect is the hosted site */ }
  return 'hosted';
}

/** @type {'local'|'hosted'} */
export const RUNTIME =
  typeof window === 'undefined' ? 'hosted' : detectRuntime(window.location);

/** True when the device agent serves this page. */
export const isLocalRuntime = () => RUNTIME === 'local';

/**
 * This build's own version, from package.json via Vite's `define` (see
 * vite.config.js). Embedded rather than read from the agent so the hosted site
 * can show it too, and so the diagnostics can tell "the agent installed 2.1.0"
 * apart from "the page actually running is 2.1.0".
 */
/* global __MB_APP_VERSION__ */
export const APP_VERSION =
  typeof __MB_APP_VERSION__ === 'string' ? __MB_APP_VERSION__ : 'dev';
