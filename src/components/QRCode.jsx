/**
 * =====================================================
 * QR Code
 * =====================================================
 * Real, scannable QR codes for the board. Replaces the
 * decorative QRPlaceholder that only looked like one.
 *
 * Encoding is done locally by qrcode.react — no network
 * call, no third-party image service. That matters here:
 * the board runs unattended on a wall, and a QR that
 * depends on an external service is a QR that eventually
 * renders as a broken image nobody notices.
 * =====================================================
 */

import { QRCodeSVG } from 'qrcode.react';

/**
 * Error correction level.
 *
 * 'M' (~15% recoverable) rather than the 'L' default: these are photographed
 * from a distance, at an angle, sometimes with glare on the panel. The cost is
 * a slightly denser grid, which is free at the sizes the board renders.
 */
const ERROR_CORRECTION = 'M';

/**
 * @param {object} props
 * @param {string} props.value          URL to encode
 * @param {number} [props.size]         rendered px (square)
 * @param {string} [props.caption]      short line under the code
 * @param {string} [props.className]    extra class on the wrapper
 */
export default function QRCode({ value, size = 300, caption, className = '' }) {
  // Nothing to encode is a normal state, not an error: socialUrl and signupUrl
  // are both optional. Callers use this to decide whether to show a QR panel at
  // all, so returning null keeps that check in one place.
  if (!value || !String(value).trim()) return null;

  return (
    <div className={`qr-panel ${className}`.trim()}>
      <div className="qr-code" style={{ width: size, height: size }}>
        <QRCodeSVG
          value={String(value).trim()}
          size={size}
          level={ERROR_CORRECTION}
          // Explicit colours rather than currentColor: the board's slide themes
          // shift, and a QR that inherits a light foreground stops scanning.
          bgColor="#ffffff"
          fgColor="#0a1b3a"
          // Quiet zone. Without it the code butts against its container and
          // scanners struggle to find the finder patterns.
          marginSize={2}
        />
      </div>
      {caption && <div className="qr-caption">{caption}</div>}
    </div>
  );
}

/**
 * True when a QR would render for this value. Lets a caller pick a layout
 * before rendering, without duplicating the emptiness rule above.
 * @param {string|null|undefined} value
 */
export function hasQR(value) {
  return !!(value && String(value).trim());
}
