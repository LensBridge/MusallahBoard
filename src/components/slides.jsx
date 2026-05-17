// Slideshow frames — Next Prayer, Today, Week, Poster, Verse, Hadith, Instagram
import { formatTo12, toMinutes } from '../models/index.js';
import { classifyPrayers } from '../utils/prayers.js';
import { QRPlaceholder } from './icons.jsx';

// ---------- Next Prayer ----------
export function NextPrayerSlide({ data, now }) {
  const { prayers } = data;
  const { ordered, next, current } = classifyPrayers(prayers, now);
  const nextP = prayers[next];

  const targetMin = toMinutes(nextP.adhan);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
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
        <span>Up Next</span>
        <span className="rule" />
        <span>Prayer Countdown</span>
      </div>

      <div className="np">
        <div className="np-head">
          {current && (
            <div className="np-current">
              Currently · {prayers[current].english} · Adhān {formatTo12(prayers[current].adhan)}
            </div>
          )}
        </div>

        <div className="np-body">
          <div className="np-left">
            <div className="np-arabic">{nextP.arabic}</div>
            <div className="np-english">{nextP.english}</div>
            <div className="np-meta">
              <span>Adhān · {formatTo12(nextP.adhan)}</span>
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
              <span>{pad(hh)}</span>
              <span className="sep">:</span>
              <span>{pad(mm)}</span>
              <span className="sep">:</span>
              <span>{pad(ss)}</span>
            </div>
            <div className="np-countdown-units">
              <span>Hours</span>
              <span>Minutes</span>
              <span>Seconds</span>
            </div>
          </div>
        </div>

        <div className="np-foot">
          {ordered.map((k) => (
            <div key={k} className={'np-foot-cell' + (k === next ? ' active' : '')}>
              <div className="name">{prayers[k].english}</div>
              <div className="time">{formatTo12(prayers[k].adhan)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------- Today (Happening Now + Up Next) ----------
export function TodaySlide({ data, now }) {
  const events = data.todayEvents;
  const nowMin = now.getHours() * 60 + now.getMinutes();

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
        <span>Today on Campus</span>
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

// ---------- Poster (full bleed) ----------
export function PosterSlide({ poster }) {
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
        <span>{label}</span>
        <span className="rule" />
        <span>{(quote.reference || '').split('·')[0]}</span>
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
        <span>Stay Connected</span>
        <span className="rule" />
        <span>UTM MSA · Online</span>
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
          <div className="ig-qr"><QRPlaceholder seed={data.instagram.handle} /></div>
          <div className="ig-qr-cap">Scan with your camera</div>
        </div>
      </div>
    </>
  );
}
