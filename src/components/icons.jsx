// Iconography — line-drawn SVG only. No figurative elements, no faces/eyes,
// no emoji (the board hangs in a musallah).

export const Icon = {
  Crescent: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  ),
  Cloud: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 12a3 3 0 0 1 0 6H7z" />
    </svg>
  ),
  PartlyCloudy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="9" r="3" />
      <path d="M3 9h1M8 3v1M3.6 4.6l.7.7M12.5 9h.8M11.4 4.6l-.7.7M8 14v.5" />
      <path d="M10 18a4 4 0 1 1 .6-7.96A5 5 0 0 1 20 12.5a3 3 0 0 1 0 5.5H10z" />
    </svg>
  ),
  Rain: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 9a3 3 0 0 1 0 6H7z" />
      <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </svg>
  ),
  Snow: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 9a3 3 0 0 1 0 6H7z" />
      <path d="M9 19v1M12 19v2M15 19v1" />
    </svg>
  ),
  Storm: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15a4 4 0 1 1 .5-7.97A6 6 0 0 1 19 9a3 3 0 0 1 0 6H7z" />
      <path d="m13 16-3 4h3l-2 3" />
    </svg>
  ),
  Mist: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12M6 14h14M4 18h16" />
    </svg>
  ),
};

export function weatherIcon(condition) {
  const c = (condition || '').toLowerCase();
  if (c.includes('clear')) return <Icon.Sun />;
  if (c.includes('partly')) return <Icon.PartlyCloudy />;
  if (c.includes('cloud')) return <Icon.Cloud />;
  if (c.includes('rain') || c.includes('drizzle')) return <Icon.Rain />;
  if (c.includes('snow')) return <Icon.Snow />;
  if (c.includes('storm') || c.includes('thunder')) return <Icon.Storm />;
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return <Icon.Mist />;
  return <Icon.Cloud />;
}

export function BrandGlyph() {
  return (
    <>
      <img src="/images/msa_logo.png" alt="UTM MSA" className="brand-img brand-img-dark" />
      <img src="/images/msa_logo_white.png" alt="" aria-hidden="true" className="brand-img brand-img-light" />
    </>
  );
}
