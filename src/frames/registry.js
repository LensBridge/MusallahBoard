/**
 * =====================================================
 * Frame Builder Registry  (preserved design pattern)
 * =====================================================
 * Same shape as the original vanilla slideshow module:
 * `registerFrameBuilder(type, fn)` populates a Map, and
 * `buildFrame(definition, ctx)` looks a builder up by the
 * frame's type. Builders now return a React descriptor
 *   { key, durationMs, render(now) -> ReactNode }
 * instead of a DOM element, but the registry contract is
 * unchanged so new frame types plug in the same way.
 * =====================================================
 */

/** @type {Map<string, Function>} */
const frameBuilders = new Map();

/**
 * Register a builder for a frame type.
 * @param {string} type  frameType (poster|event_list|… or synthetic)
 * @param {(definition:object, ctx:object)=>object|null} builder
 */
export function registerFrameBuilder(type, builder) {
  frameBuilders.set(String(type).toLowerCase(), builder);
}

/**
 * Build one frame descriptor from its definition.
 * @returns {{key:string,durationMs:number,render:Function}|null}
 */
export function buildFrame(definition, ctx) {
  const builder = frameBuilders.get(String(definition?.frameType || definition?.type || '').toLowerCase());
  if (!builder) {
    console.warn(`No frame builder for type: ${definition?.frameType}`);
    return null;
  }
  return builder(definition, ctx) || null;
}

/**
 * Build the ordered slideshow from normalized API frames + synthetic frames.
 * Frames the API omits are synthesized so the board is never blank, and the
 * Instagram/QR frame (not an API frame type) is always appended.
 *
 * @param {object} normalized  output of normalizePayload()
 * @param {object} ctx         shared context for builders
 * @returns {{key:string,durationMs:number,render:Function}[]}
 */
export function buildSlideshow(normalized, ctx) {
  const out = [];
  const seenTypes = new Set();

  for (const def of normalized.frames) {
    const type = String(def.frameType || '').toLowerCase();
    if (type === 'jummah') continue; // consumed by the rail, not a slide
    // The Today view is frontend-managed: it's derived from the payload's
    // event pool below, never from a backend daily_schedule frame.
    if (type === 'daily_schedule') continue;
    const frame = buildFrame(def, ctx);
    if (frame) {
      out.push(frame);
      seenTypes.add(type);
    }
  }

  // Synthesize a next-prayer frame if the backend didn't send one — prayer
  // data is always available client-side and it's the hero of the rotation.
  if (!seenTypes.has('next_prayer')) {
    const f = buildFrame({ frameType: 'next_prayer', durationInSeconds: 12 }, ctx);
    if (f) out.unshift(f);
  }

  // Frontend-managed Today view — always present, built from payload events,
  // placed right after the next-prayer hero (design rotation order).
  const today = buildFrame({ frameType: 'today', durationInSeconds: 16 }, ctx);
  if (today) {
    const npIdx = out.findIndex((f) => f.key === 'next-prayer');
    out.splice(npIdx === -1 ? 0 : npIdx + 1, 0, today);
  }

  // Posters render *after* the "This Week" view. Pull every poster slide out
  // and re-insert the group immediately after the week slide (falling back to
  // after Today, then the end, when there is no week slide).
  const posters = out.filter((f) => f.key.startsWith('poster'));
  if (posters.length) {
    const rest = out.filter((f) => !f.key.startsWith('poster'));
    let anchor = rest.findIndex((f) => f.key === 'week');
    if (anchor === -1) anchor = rest.findIndex((f) => f.key === 'today');
    out.length = 0;
    if (anchor === -1) {
      out.push(...rest, ...posters);
    } else {
      out.push(...rest.slice(0, anchor + 1), ...posters, ...rest.slice(anchor + 1));
    }
  }

  // Instagram/QR is a frontend-only frame (no API frame type for it).
  const ig = buildFrame({ frameType: 'instagram', durationInSeconds: 13 }, ctx);
  if (ig) out.push(ig);

  return out.length ? out : [];
}
