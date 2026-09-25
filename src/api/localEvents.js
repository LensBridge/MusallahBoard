/**
 * =====================================================
 * Local Events
 * =====================================================
 * The agent announces installs on GET /api/local/events,
 * a Server-Sent Events stream (agent/docs/architecture.md,
 * section 7):
 *
 *   event: content   data: {"sequence": n}
 *     new content whose payloads differ from what was
 *     being served: re-fetch the payload in place.
 *   event: app       data: {"version": "..."}
 *     a new board app release is installed: reload, so
 *     the new build is what runs.
 *   event: updates   data: the status's `updates` object
 *     software started or stopped waiting for the night's
 *     install window: re-read the status for the ticker.
 *   : ping           every 25 s, keeps the stream alive.
 *
 * EventSource reconnects on its own after a dropped
 * connection (an agent restart, say), so there is no
 * backoff loop here. An event can still be missed while disconnected; the
 * payload poll (10 min) and status poll (1 min) in
 * App.jsx bound what that costs, and a re-opened stream
 * triggers one catch-up refresh.
 * =====================================================
 */

/**
 * @param {{ onContent: () => unknown, onApp: () => unknown, onUpdates?: () => unknown }} handlers
 * @returns {() => void} disposer: closes the stream. Safe to call twice.
 */
export function connectLocalEvents({ onContent, onApp, onUpdates }) {
  if (typeof EventSource === 'undefined') return () => {};

  const source = new EventSource('/api/local/events');
  let opened = false;

  const run = (fn, what) => {
    try {
      Promise.resolve(fn()).catch((e) => console.error(`local events: ${what} failed`, e));
    } catch (e) {
      console.error(`local events: ${what} threw`, e);
    }
  };

  source.addEventListener('open', () => {
    // The first open is the page starting up, which loads the payload anyway.
    // A later one is a reconnect, and a `content` event may have been missed
    // while the stream was down.
    if (opened) run(onContent, 'catch-up refresh');
    opened = true;
  });
  source.addEventListener('content', () => run(onContent, 'content refresh'));
  source.addEventListener('app', () => run(onApp, 'app reload'));
  if (onUpdates) source.addEventListener('updates', () => run(onUpdates, 'updates refresh'));

  return () => source.close();
}
