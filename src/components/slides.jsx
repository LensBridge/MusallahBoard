// Slideshow frames — Next Prayer, Today, Week, Poster, Verse, Hadith, Instagram
import { formatTo12, toMinutes, zonedMinutes, zonedSeconds } from '../models/index.js';
import { classifyPrayers } from '../utils/prayers.js';
import QRCode, { hasQR } from './QRCode.jsx';
import Digits from './Digits.jsx';

// ---------- Next Prayer ----------
export function NextPrayerSlide({ data, now }) {
  const { prayers, timezone } = data;
  const { ordered, next, current } = classifyPrayers(prayers, now, timezone);
  const nextP = prayers[next];

  // Aladhan can hand back blank timings (polar latitudes, a bad method id, a
  // partial response). Rendering an empty schedule beats a white screen: this
  // used to dereference prayers[undefined] and take the whole board down.
  if (!nextP) {
    return (
      <div className="slide-eyebrow">
        <span className="pip" />
        <span>Prayer times unavailable</span>
      </div>
    );
  }

  const targetMin = toMinutes(nextP.adhan);
  const nowSec = zonedSeconds(now, timezone);
  let diff = targetMin * 60 - nowSec;
  if (diff < 0) diff += 24 * 3600;
  const hh = Math.floor(diff / 3600);
  const mm = Math.floor((diff % 3600) / 60);
  const ss = diff % 60;
  const pad = (n) => n.toString().padStart(2, '0');

  return (
    <>
      <div className="slide-eyebrow">
        <span className="pip" />
        {/* <span>Up Next</span> */}
        <span className="rule" />
        <span>Prayer Countdown</span>
      </div>

      <div className="np">
        <div className="np-head">
          {current && (
            <div className="np-current">
            </div>
          )}
        </div>

        <div className="np-body">
          <div className="np-left">
            <div className="np-arabic">{nextP.arabic}</div>
            <div className="np-english">{nextP.english}</div>
            <div className="np-meta">
              {next === 'asr' && nextP.hanafiAdhan && (
                <>
                  <span className="dot">◆</span>
                  <span>Hanafī · {formatTo12(nextP.hanafiAdhan)}</span>
                </>
              )}
            </div>
          </div>

          <div className="np-right">
            <div className="np-right-label">Time Remaining</div>
            <div className="np-countdown">
              <div className="np-unit">
                <Digits className="np-num">{pad(hh)}</Digits>
                <span className="np-unit-label">Hours</span>
              </div>
              <span className="sep">:</span>
              <div className="np-unit">
                <Digits className="np-num">{pad(mm)}</Digits>
                <span className="np-unit-label">Minutes</span>
              </div>
              <span className="sep">:</span>
              <div className="np-unit">
                <Digits className="np-num">{pad(ss)}</Digits>
                <span className="np-unit-label">Seconds</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Today (Happening Now + Up Next) ----------
export function TodaySlide({ data, now }) {
  const events = data.todayEvents;
  const nowMin = zonedMinutes(now, data.timezone);

  const happening = events.filter((e) => {
    const s = toMinutes(e.start);
    const en = toMinutes(e.end);
    return nowMin >= s && nowMin < en;
  });
  const upcoming = events.filter((e) => toMinutes(e.start) > nowMin).slice(0, 4);
  const now_ev = happening[0];

  let progress = 35;
  let endsIn = '';
  if (now_ev) {
    const s = toMinutes(now_ev.start);
    const en = toMinutes(now_ev.end);
    progress = Math.round(((nowMin - s) / (en - s)) * 100);
    const left = en - nowMin;
    endsIn = left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left} min`;
  }

  return (
    <div className="today-slide" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="slide-eyebrow">
        <span className="pip" />
        <span className="rule" />
        <span>{events.length} events</span>
      </div>

      <div className="today-grid">
        {now_ev ? (
          <div className="now-card" style={{ '--progress': progress + '%' }}>
            <div className="now-tag">
              <span className="dot" /> Happening Now
            </div>
            <div className="now-title">{now_ev.name}</div>
            <div className="now-meta">
              <div className="now-meta-row">
                <div className="k">Location</div>
                <div className="v">{now_ev.room}</div>
              </div>
              <div className="now-meta-row">
                <div className="k">When</div>
                <div className="v">
                  {formatTo12(now_ev.start)} — {formatTo12(now_ev.end)}
                </div>
              </div>
            </div>
            <div className="now-countdown">
              <span className="label">Ends in</span>
              <span className="v">{endsIn}</span>
            </div>
          </div>
        ) : (
          <div className="now-card">
            <div className="now-tag">
              <span className="dot" style={{ background: 'var(--fg-3)', boxShadow: 'none' }} />
              Nothing Right Now
            </div>
            <div className="now-title">Between sessions — see what's coming up.</div>
            <div className="now-countdown">
              <span className="label">Next event in</span>
              <span className="v" style={{ color: 'var(--accent)' }}>
                {upcoming[0] ? `${toMinutes(upcoming[0].start) - nowMin} min` : '—'}
              </span>
            </div>
          </div>
        )}

        <div className="upnext">
          <div className="upnext-head">
            <div className="upnext-title">Up Next Today</div>
            <div className="upnext-count">{upcoming.length} upcoming</div>
          </div>
          <div className="upnext-list">
            {upcoming.length === 0 ? (
              <div style={{
                paddingTop: 24, fontFamily: 'var(--f-mono)', fontSize: 12,
                letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--fg-3)',
              }}>
                No more events scheduled today
              </div>
            ) : (
              upcoming.map((e) => {
                const inMin = toMinutes(e.start) - nowMin;
                const inStr = inMin >= 60
                  ? `in ${Math.floor(inMin / 60)}h ${inMin % 60}m`
                  : `in ${inMin} min`;
                return (
                  <div key={e.id} className="upnext-item">
                    <div className="upnext-time">{formatTo12(e.start)}</div>
                    <div className="upnext-body">
                      <div className="upnext-name">{e.name}</div>
                      <div className="upnext-room">{e.room}</div>
                    </div>
                    <div className="upnext-in">{inStr}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Week at a Glance ----------
export function WeekSlide({ data }) {
  const week = data.week || [];
  const withDates = week.filter((d) => d.date !== '');
  const span =
    withDates.length > 0
      ? `${withDates[0].day} ${withDates[0].date} — ${withDates[withDates.length - 1].day} ${withDates[withDates.length - 1].date}`
      : 'This Week';
  return (
    <>
      <div className="slide-eyebrow">
        <span className="pip" />
        <span>This Week</span>
        <span className="rule" />
        <span>{span}</span>
      </div>
      <div className="week-grid">
        {week.map((d) => (
          <div key={d.day} className={'day-col' + (d.today ? ' today' : '')}>
            <div className="day-head">
              <div className="day-name">{d.day}</div>
              <div className="day-num">{d.date}</div>
            </div>
            <div className="day-events">
              {d.events.length === 0 ? (
                <div className="day-empty">No events</div>
              ) : (
                d.events.map((e, i) => (
                  <div key={i} className="day-event">
                    <div className="t">{e.t}</div>
                    <div className="n">{e.n}</div>
                    <div className="r">{e.r}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Poster ----------
// Full-bleed by default. When the poster carries a signup link it becomes a
// two-column layout instead — poster on the left, QR on the right — so someone
// walking past can register without typing a URL off a wall.
export function PosterSlide({ poster }) {
  const signupUrl = poster?.signupUrl;

  if (poster?.image && hasQR(signupUrl)) {
    return (
      <div className="poster-frame poster-frame--with-qr">
        <div className="poster-image">
          <img src={poster.image} alt={poster.title || 'Poster'} />
        </div>
        <div className="poster-qr">
          <div className="poster-qr-eyebrow">Sign Up</div>
          {poster.title && <div className="poster-qr-title">{poster.title}</div>}
          <QRCode value={signupUrl} size={320} caption="Scan to register" />
        </div>
      </div>
    );
  }

  if (poster?.image) {
    return (
      <div className="poster-frame">
        <img src={poster.image} alt={poster.title || 'Poster'} />
      </div>
    );
  }
  return (
    <div className="poster-frame">
      <div className="poster-placeholder">
        <div>
          <div style={{ fontSize: 32, fontFamily: 'var(--f-display)', letterSpacing: '0.2em', marginBottom: 12, color: 'var(--accent)' }}>◆</div>
          {poster?.title || 'POSTER'}
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7, letterSpacing: '0.2em' }}>
            Full-bleed event flyer uploaded via Admin Portal
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Quote (verse or hadith) ----------
export function QuoteSlide({ kind, quote }) {
  const label = kind === 'verse' ? 'Verse of the Week' : 'Hadith of the Week';
  return (
    <div className="quote-slide" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="slide-eyebrow">
        <span className="pip" />
        <span className="rule" />
        <span>{label}</span>
      </div>
      <div className="quote-body">
        <div className="quote-arabic">{quote.arabic}</div>
        {quote.translit && <div className="quote-translit">{quote.translit}</div>}
        <div className="quote-translation">{quote.translation}</div>
        <div className="quote-ref">{quote.reference}</div>
      </div>
    </div>
  );
}

// ---------- Instagram QR ----------
export function IGSlide({ data }) {
  return (
    <>
      <div className="slide-eyebrow">
        <span className="pip" />
        <span className="rule" />
        <span>Stay Connected</span>
      </div>
      <div className="ig-body">
        <div className="ig-text">
          <div className="ig-eyebrow">Follow Along</div>
          <div className="ig-title">
            Catch the<br />community on<br />Instagram.
          </div>
          <div className="ig-handle">{data.instagram.handle}</div>
          <div className="ig-sub">
            Follow <i>your home on campus</i> on Instagram for event recaps, announcements, and more!
          </div>
        </div>
        <div className="ig-qr-wrap">
          {/* Encodes the board's own socialUrl, so two boards can point at
              different destinations. Falls back to the app-level Instagram URL
              when a device has no socialUrl configured. */}
          <QRCode
            value={data.instagram.url}
            size={300}
            caption="Scan with your camera"
            className="qr-panel--ig"
          />
        </div>
      </div>
    </>
  );
}
