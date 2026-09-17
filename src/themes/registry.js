// Theme registry — the only place in the app that knows a theme's name.
//
// Themes themselves are CSS (see ./_contract.css). This file is the manifest:
// which names are real, what to call them in operator UI, and what to do with
// a name that isn't in the list.
//
// That last part is the point. The board is meant to take its theme from the
// backend eventually, and a kiosk running unattended in a prayer room cannot
// be allowed to render unstyled because someone typed `nigth` into an admin
// form. Every path into the stage runs through resolveTheme(), which drops
// unknown names on the floor and falls back to the board's own logic.

/**
 * @typedef {object} ThemeDef
 * @property {string} name        value of the `data-theme` attribute
 * @property {string} label       operator-facing name
 * @property {'light'|'dark'} appearance  ground the theme paints on
 * @property {string} note        one line, shown in the debug drawer
 */

/** @type {ThemeDef[]} */
export const THEMES = [
  {
    name: 'day',
    label: 'Day',
    appearance: 'light',
    note: 'Navy on Chambray light blue.',
  },
  {
    name: 'night',
    label: 'Night',
    appearance: 'dark',
    note: 'Deep navy, Energy Yellow. Auto after Isha.',
  },
  {
    name: 'reverent',
    label: 'Reverent',
    appearance: 'light',
    note: 'Muted paper, cool accent.',
  },
];

/** Fallback when nothing else resolves. Also what `:root` paints. */
export const DEFAULT_THEME = 'day';

const BY_NAME = new Map(THEMES.map((t) => [t.name, t]));

/** @param {unknown} name @returns {boolean} */
export function isKnownTheme(name) {
  return typeof name === 'string' && BY_NAME.has(name);
}

/** @param {unknown} name @returns {ThemeDef|null} */
export function getTheme(name) {
  return isKnownTheme(name) ? BY_NAME.get(/** @type {string} */ (name)) : null;
}

/**
 * Pick the first name that is actually a theme.
 *
 * Callers pass their preference order — typically operator override, then the
 * backend's configured theme, then whatever the time of day implies. Anything
 * unrecognised (null, undefined, a typo, a theme this build doesn't ship yet)
 * is skipped rather than applied, so a stale or malformed backend value
 * degrades to the next choice down instead of breaking the board.
 *
 * @param {...unknown} candidates
 * @returns {string} a name guaranteed to exist in THEMES
 */
export function resolveTheme(...candidates) {
  for (const c of candidates) if (isKnownTheme(c)) return /** @type {string} */ (c);
  return DEFAULT_THEME;
}
