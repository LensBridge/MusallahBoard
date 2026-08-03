/**
 * TEMPORARY preview harness — delete after visual verification.
 *
 * Renders the real PosterSlide and IGSlide against mock data so the QR layouts
 * can be checked without a backend, a device id, or a live payload.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PosterSlide, IGSlide } from './components/slides.jsx';
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

const igData = {
  instagram: { handle: '@utmmsa', url: 'https://instagram.com/utmmsa' },
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

      <Stage label="C · STAY CONNECTED (real QR from deviceConfig.socialUrl)">
        <IGSlide data={igData} />
      </Stage>
    </div>
  </StrictMode>
);
