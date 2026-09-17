/**
 * TEMPORARY preview harness — delete after visual verification.
 *
 * Renders the real PosterSlide and SocialsSlide against mock data so the QR
 * layouts can be checked without a backend, a device id, or a live payload.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PosterSlide, SocialsSlide } from './components/slides.jsx';
import './styles.css';

const POSTER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100">
      <rect width="850" height="1100" fill="#123a6b"/>
      <text x="425" y="520" font-size="64" fill="#fff" text-anchor="middle"
            font-family="sans-serif">HALAQA</text>
      <text x="425" y="600" font-size="34" fill="#9fc4ff" text-anchor="middle"
            font-family="sans-serif">Every Friday · 6:30 PM</text>
    </svg>`);

// Shaped exactly like frameConfig for a `socials` frame, Markdown and all.
const INSTAGRAM_SOCIAL = {
  socialType: 'instagram',
  url: 'https://instagram.com/utmmsa',
  headerText: 'follow along',
  heroText: 'Catch the community on *Instagram*.',
  handle: '@utmmsa',
  footerText:
    'Follow *your home on campus* on Instagram for event recaps, announcements, and more!',
};

// The handle-less case: WhatsApp entries have none, and the element must not
// leave a gap where it used to be.
const WHATSAPP_SOCIAL = {
  socialType: 'whatsapp',
  url: 'https://chat.whatsapp.com/example-invite',
  headerText: 'join the chat',
  heroText: 'Get the day-of updates on *WhatsApp*.',
  handle: null,
  footerText: 'Room changes, cancellations, and **iqamah** times, straight to your phone.',
};

function Stage({ label, children, poster = false }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ font: '12px monospace', letterSpacing: '0.2em', padding: '8px 4px', color: '#888' }}>
        {label}
      </div>
      <div
        className="board"
        style={{ width: 1280, height: 720, position: 'relative', overflow: 'hidden' }}
      >
        <div className={poster ? 'slide poster-slide' : 'slide'}
             style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{ padding: 24, background: '#0d1117' }}>
      <Stage label="A · POSTER WITH SIGNUP QR (split layout)" poster>
        <PosterSlide
          poster={{
            image: POSTER_IMAGE,
            title: 'Weekly Halaqa',
            signupUrl: 'https://forms.gle/example-signup-link',
          }}
        />
      </Stage>

      <Stage label="B · POSTER WITHOUT QR (full bleed, unchanged)" poster>
        <PosterSlide poster={{ image: POSTER_IMAGE, title: 'Weekly Halaqa', signupUrl: '' }} />
      </Stage>

      <Stage label="C · STAY CONNECTED — INSTAGRAM (real QR from frameConfig.url)">
        <SocialsSlide social={INSTAGRAM_SOCIAL} />
      </Stage>

      <Stage label="D · STAY CONNECTED — WHATSAPP (no handle)">
        <SocialsSlide social={WHATSAPP_SOCIAL} />
      </Stage>
    </div>
  </StrictMode>
);
