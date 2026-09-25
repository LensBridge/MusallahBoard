import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBoardPayload, isNoContentError, ApiError } from './payloadService.js';

// The payload is a plain same-origin fetch to the agent, not the generated
// client, so its error handling is this module's own.
describe('getBoardPayload', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status, body) =>
    vi.fn(async (_url, _init) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    }));

  it('fetches the agent payload same-origin, with no device id', async () => {
    const fetch = respond(200, { deviceConfig: {}, frames: [] });
    vi.stubGlobal('fetch', fetch);
    await getBoardPayload();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/api/musallah/payload');
  });

  it('reports "no content installed" once, without retrying', async () => {
    const fetch = respond(503, { message: 'no content installed' });
    vi.stubGlobal('fetch', fetch);
    const error = await getBoardPayload().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(isNoContentError(error)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 404', async () => {
    const fetch = respond(404, { message: 'not found' });
    vi.stubGlobal('fetch', fetch);
    const error = await getBoardPayload().catch((e) => e);
    expect(error.status).toBe(404);
    expect(isNoContentError(error)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
