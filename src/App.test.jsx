import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';
import expiredPayload from './api/__fixtures__/payload-expired.json';

// The whole board against a fake agent: what an expired payload puts on screen.

const NOTE = /Announcements are out of date\. Plug in an update stick\./;

function fakeAgent(payload, { payloadStatus = 200, status = { deviceId: payload.deviceConfig?.id } } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const json = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    if (url === '/api/musallah/payload') return json(payloadStatus, payload);
    if (url === '/api/local/status') return json(200, status);
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

  it('shows the damaged-content screen, with only the fixes this board accepts', async () => {
    fakeAgent({ message: 'installed content is damaged' }, {
      payloadStatus: 500,
      status: {
        deviceId: expiredPayload.deviceConfig.id,
        usbImport: true,
        servicePort: false,
        sync: { enabled: false },
        error: 'payloads/2026-10-07.json: sha256 mismatch',
      },
    });
    const { container } = render(<App />);

    // At once, not after the transient-error retries.
    expect(await screen.findByText('Content needs replacing')).toBeTruthy();
    expect(container.textContent).toMatch(/USB stick/);
    expect(container.textContent).not.toMatch(/10\.77\.0\.1|LensBridge/);
    expect(container.textContent).toMatch(/sha256 mismatch/);
  });

  it('treats an unreadable content package as damaged, not as a lost connection', async () => {
    fakeAgent({ message: 'payload missing from installed content' }, { payloadStatus: 500 });
    render(<App />);

    expect(await screen.findByText('Content needs replacing')).toBeTruthy();
    expect(screen.queryByText(/Reconnecting/)).toBeNull();
  });
});
