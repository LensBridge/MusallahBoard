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
 * @param {string} type  frameType (poster|agenda|next_prayer|…)
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
 * Build the ordered slideshow from normalized API frames.
 *
 * Every slide is a backend-declared frame now, arriving already positioned and
 * durationed in `normalized.frames`; nothing is synthesized or hand-placed here.
 * next_prayer still carries a marker config with no data — the countdown is
 * necessarily client-side — but it is a real frame in the sequence rather than
 * something this function appends. Everything else, socials included, arrives
 * fully described.
 *
 * @param {object} normalized  output of normalizePayload()
 * @param {object} ctx         shared context for builders
 * @returns {{key:string,durationMs:number,render:Function}[]}
 */
export function buildSlideshow(normalized, ctx) {
  const out = [];

  normalized.frames.forEach((def, i) => {
    const type = String(def.frameType || '').toLowerCase();
    if (type === 'jummah') return; // consumed by the rail, not a slide
    const frame = buildFrame(def, { ...ctx, frameIndex: i });
    if (frame) out.push(frame);
  });

  return out;
}
