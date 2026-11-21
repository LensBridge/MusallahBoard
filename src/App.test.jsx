import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';
import expiredPayload from './api/__fixtures__/payload-expired.json';

// The whole board against a fake agent: what an expired payload puts on screen.

const NOTE = /Announcements are out of date\. Plug in an update stick\./;

function fakeAgent(payload) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const json = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    if (url === '/api/musallah/payload') return json(200, payload);
    if (url === '/api/local/status') return json(200, { deviceId: payload.deviceConfig.id });
    return json(404, { message: 'not found' });
  }));
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows prayer times and the update note, and no content, when expired', async () => {
    fakeAgent(expiredPayload);
    const { container } = render(<App />);

    expect(await screen.findByText(NOTE)).toBeTruthy();
    // Prayer times, computed locally: the countdown slide and the rail.
    expect(container.querySelector('.np')).not.toBeNull();
    expect(container.querySelector('.slide')).not.toBeNull();
    // Nothing editorial: no poster, agenda, quote or social slide, no ticker text.
    expect(container.querySelector('.poster-slide')).toBeNull();
    expect(container.querySelector('.quote-slide')).toBeNull();
    expect(container.querySelector('.social-slide')).toBeNull();
    expect(container.textContent).not.toMatch(/Eid prayer|hardship|@utmmsa/);
  });

  it('shows no note, and the content, when not expired', async () => {
    fakeAgent({ ...expiredPayload, expired: false });
    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector('.poster-slide')).not.toBeNull());
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(container.textContent).toMatch(/hardship/);
    expect(container.textContent).toMatch(/Eid prayer/);
  });
});
