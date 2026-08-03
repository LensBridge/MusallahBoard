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

  normalized.frames.forEach((def, i) => {
    const type = String(def.frameType || '').toLowerCase();
    if (type === 'jummah') return; // consumed by the rail, not a slide
    if (type === 'daily_schedule') return; // folded into the agenda frame
    if (type === 'event_list') return;     // ditto — the agenda frame's week data
    const frame = buildFrame(def, { ...ctx, frameIndex: i });
    if (frame) {
      out.push(frame);
      seenTypes.add(type);
    }
  });

  // Synthesize a next-prayer frame if the backend didn't send one — prayer
  // data is always available client-side and it's the hero of the rotation.
  if (!seenTypes.has('next_prayer')) {
    const f = buildFrame({ frameType: 'next_prayer', durationInSeconds: 12 }, ctx);
    if (f) out.unshift(f);
  }

  const agenda = buildFrame({ frameType: 'agenda', durationInSeconds: 20 }, ctx);
  if (agenda) {
    const npIdx = out.findIndex((f) => f.key === 'next-prayer');
    out.splice(npIdx === -1 ? 0 : npIdx + 1, 0, agenda);
  }

  const posters = out.filter((f) => f.key.startsWith('poster'));
  if (posters.length) {
    const rest = out.filter((f) => !f.key.startsWith('poster'));
    const anchor = rest.findIndex((f) => f.key === 'agenda');
    out.length = 0;
    if (anchor === -1) {
      out.push(...rest, ...posters);
    } else {
      out.push(...rest.slice(0, anchor + 1), ...posters, ...rest.slice(anchor + 1));
    }
  }

  // Instagram/QR is a frontend-only frame. The API does not control it 
  const ig = buildFrame({ frameType: 'instagram', durationInSeconds: 13 }, ctx);
  if (ig) out.push(ig);

  return out.length ? out : [];
}
