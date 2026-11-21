/**
 * This build's own version, from package.json via Vite's `define` (see
 * vite.config.js). Embedded rather than read from the agent so the diagnostics
 * can tell "the agent installed 2.1.0" apart from "the page actually running
 * is 2.1.0".
 */
/* global __MB_APP_VERSION__ */
export const APP_VERSION =
  typeof __MB_APP_VERSION__ === 'string' ? __MB_APP_VERSION__ : 'dev';
