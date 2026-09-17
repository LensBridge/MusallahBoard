/**
 * Image prefetch cache. Warms the browser cache so poster frames display
 * instantly when the slideshow cycles to them.
 */

const cache = new Map();

export function prefetchImage(url) {
  if (!url || cache.has(url)) return;
  const img = new Image();
  img.src = url;
  cache.set(url, img);
}

export function prefetchImages(urls) {
  urls.forEach(prefetchImage);
}

export function prefetchPayloadImages(payload) {
  if (!payload?.frames) return;
  const urls = payload.frames
    .filter((f) => f.frameType === 'poster' && f.frameConfig?.posterUrl)
    .map((f) => f.frameConfig.posterUrl);
  prefetchImages(urls);
}
