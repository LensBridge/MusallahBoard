// Slideshow frames — Next Prayer, Agenda, Poster, Verse, Hadith, Socials
import { formatTo12, toMinutes, zonedMinutes, zonedSeconds } from '../models/index.js';
import { classifyPrayers } from '../utils/prayers.js';
import QRCode, { hasQR } from './QRCode.jsx';
import Markdown from './Markdown.jsx';
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

// ---------- Agenda: today in focus, the next six days beneath ----------

/**
 * Rows the "up next" column can hold before it starts counting overflow.
 * Exported because the agenda frame's auto-duration is a function of how many
 * rows actually land on screen, and that ceiling is decided here.
 */
export const QUEUE_LIMIT = 4;
/** Events a ribbon day shows by name before collapsing into "+N more". */
const RIBBON_LIMIT = 2;

/** Minutes as the board says them: "45 min", "2h 10m", "3h". */
function relTime(mins) {
  if (mins <= 0) return 'now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "Tomorrow" / "Thu 7" — how a ribbon day is named in prose. */
function dayLabel(d) {
  return d.isTomorrow ? 'Tomorrow' : `${d.weekday} ${d.date}`;
}

/**
 * Today's live state plus the next six days.
 *
 * Replaces the old TodaySlide + WeekSlide pair. They asked overlapping
 * questions half a rotation apart, so a passer-by reliably saw one and missed
 * the other; and the week grid gave a Monday that had already happened the same
 * weight as the Friday that hadn't.
 */
export function AgendaSlide({ data, now }) {
  const events = data?.todayEvents ?? [];
  const days = data?.agenda ?? [];
  const nowMin = zonedMinutes(now, data?.timezone);

  // All-day events carry start === end === "00:00", so they can never satisfy
  // the minute comparisons below — and feeding one to the progress maths
  // divides by zero and puts `--progress: NaN%` into the stylesheet. Splitting
  // them out first is what makes the rest of this function safe.
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);

  const live = timed.find(
    (e) => nowMin >= toMinutes(e.start) && nowMin < toMinutes(e.end)
  );
  const later = timed.filter((e) => toMinutes(e.start) > nowMin);

  const todayRows = (list) =>
    list.map((e, i) => ({
      key: `t${e.id ?? i}`,
      time: e.allDay ? 'All Day' : formatTo12(e.start),
      name: e.name,
      room: e.room,
      note: e.allDay ? '' : `in ${relTime(toMinutes(e.start) - nowMin)}`,
    }));

  const dayRows = (list) =>
    list.map((e, i) => ({ key: `d${i}`, time: e.t, name: e.n, room: e.r, note: '' }));

  // Four hero states, tried in order of what a passer-by most wants to know.
  // The old slide had two, and its second one spent the frame's largest element
  // on the sentence "Between sessions — see what's coming up." The hero now
  // always names something real: what is running, else what is next today, else
  // what is on today at all, else the next day that has anything.
  let hero;
  let rows;
  let queueTitle;

  if (live) {
    const s = toMinutes(live.start);
    const e = toMinutes(live.end);
    hero = {
      state: 'live',
      tag: 'Happening Now',
      title: live.name,
      room: live.room,
      when: `${formatTo12(live.start)} — ${formatTo12(live.end)}`,
      footLabel: 'Ends in',
      footValue: relTime(e - nowMin),
      // Clamped: a payload that outlives its own event would otherwise push the
      // bar past the card's edge.
      progress: e > s ? Math.min(100, Math.max(0, Math.round(((nowMin - s) / (e - s)) * 100))) : null,
    };
    rows = todayRows(later);
    queueTitle = 'Up Next Today';
  } else if (later.length) {
    const next = later[0];
    hero = {
      state: 'next',
      tag: 'Up Next',
      title: next.name,
      room: next.room,
      when: `${formatTo12(next.start)} — ${formatTo12(next.end)}`,
      footLabel: 'Starts in',
      footValue: relTime(toMinutes(next.start) - nowMin),
      progress: null,
    };
    rows = todayRows(later.slice(1));
    queueTitle = 'Later Today';
  } else if (allDay.length) {
    hero = {
      state: 'allday',
      tag: 'On Today',
      title: allDay[0].name,
      room: allDay[0].room,
      when: 'All day',
      footLabel: 'Today',
      footValue: plural(events.length, 'event'),
      progress: null,
    };
    rows = todayRows(allDay.slice(1));
    queueTitle = 'Also Today';
  } else {
    const nextDay = days.slice(1).find((d) => d.events.length);
    hero = nextDay
      ? {
          state: 'clear',
          tag: `Next · ${dayLabel(nextDay)}`,
          title: nextDay.events[0].n,
          room: nextDay.events[0].r,
          when: nextDay.events[0].t,
          footLabel: `${dayLabel(nextDay)} in total`,
          footValue: plural(nextDay.events.length, 'event'),
          progress: null,
        }
      : {
          state: 'clear',
          tag: 'Nothing Scheduled',
          title: 'No events on the calendar this week.',
          room: '',
          when: '',
          footLabel: '',
          footValue: '',
          progress: null,
        };
    rows = nextDay ? dayRows(nextDay.events.slice(1)) : [];
    queueTitle = nextDay ? `Rest of ${dayLabel(nextDay)}` : 'Nothing Upcoming';
  }

  const shownRows = rows.slice(0, QUEUE_LIMIT);
  const rowOverflow = rows.length - shownRows.length;

  const heroStyle = hero.progress == null ? undefined : { '--progress': `${hero.progress}%` };

  return (
    <div className="agenda-slide">
      <div className="slide-eyebrow">
        <span className="pip" />
        <span className="rule" />
        <span>Your Week at a Glance</span>
      </div>

      <div className="agenda-hero">
        <div className={`now-card is-${hero.state}`} style={heroStyle}>
          <div className="now-tag">
            <span className="dot" /> {hero.tag}
          </div>
          <div className="now-title">{hero.title}</div>
          {(hero.room || hero.when) && (
            <div className="now-meta">
              {hero.room && (
                <div className="now-meta-row">
                  <div className="k">Location</div>
                  <div className="v">{hero.room}</div>
                </div>
              )}
              {hero.when && (
                <div className="now-meta-row">
                  <div className="k">When</div>
                  <div className="v">{hero.when}</div>
                </div>
              )}
            </div>
          )}
          {hero.footValue && (
            <div className="now-countdown">
              <span className="label">{hero.footLabel}</span>
              <span className="v">{hero.footValue}</span>
            </div>
          )}
        </div>

        <div className="upnext">
          <div className="upnext-head">
            <div className="upnext-title">{queueTitle}</div>
            {rows.length > 0 && (
              <div className="upnext-count">{rows.length} to come</div>
            )}
          </div>
          <div className="upnext-list">
            {shownRows.length === 0 ? (
              <div className="upnext-empty">
                {hero.state === 'clear'
                  ? 'Check back tomorrow'
                  : "That's all, folks!"}
              </div>
            ) : (
              shownRows.map((r) => (
                <div key={r.key} className="upnext-item">
                  <div className="upnext-time">{r.time}</div>
                  <div className="upnext-body">
                    <div className="upnext-name">{r.name}</div>
                    {r.room && <div className="upnext-room">{r.room}</div>}
                  </div>
                  {r.note && <div className="upnext-in">{r.note}</div>}
                </div>
              ))
            )}
            {/* The old slide capped this list at four silently while the eyebrow
                still reported the full count. */}
            {rowOverflow > 0 && (
              <div className="upnext-more">+{rowOverflow} more</div>
            )}
          </div>
        </div>
      </div>

      <div className="agenda-ribbon-label">
        <span>Next Six Days</span>
        <span className="rule" />
      </div>

      <div className="agenda-ribbon">
        {days.slice(1).map((d) => {
          const shown = d.events.slice(0, RIBBON_LIMIT);
          const overflow = d.events.length - shown.length;
          // The rail only surfaces Jummah Wed–Fri; the ribbon can flag it a week out.
          const jummah = d.weekday === 'Fri' && (data?.jummahPrayers?.length ?? 0) > 0;
          const cls = [
            'agenda-day',
            d.events.length ? '' : 'is-quiet',
            d.isTomorrow ? 'is-tomorrow' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={d.key} className={cls}>
              <div className="agenda-day-head">
                <div className="agenda-day-name">{d.isTomorrow ? 'Tomorrow' : d.weekday}</div>
                <div className="agenda-day-num">{d.date}</div>
              </div>
              {jummah && <div className="agenda-day-jummah">◆ Jumu'ah</div>}
              <div className="agenda-day-events">
                {shown.length === 0 ? (
                  <div className="agenda-day-empty">—</div>
                ) : (
                  shown.map((e, i) => (
                    <div key={i} className="agenda-day-event">
                      <div className="t">{e.t}</div>
                      <div className="n">{e.n}</div>
                    </div>
                  ))
                )}
                {overflow > 0 && <div className="agenda-day-more">+{overflow} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

// ---------- Socials QR ----------
//
// One promoted social account. Every string on this slide is backend data now
// — this used to be a single hardcoded Instagram frame whose QR destination
// came from deviceConfig.socialUrl. A board can carry several of these
// (Instagram and a WhatsApp group, say), so nothing here may assume Instagram.
//
// The four copy fields are stored as Markdown so an operator can italicize a
// phrase ("Follow *your home on campus* ...") without a deploy. They render
// through <Markdown>, which emits React nodes rather than HTML — see
// components/Markdown.jsx.
export function SocialsSlide({ social }) {
  // WhatsApp entries have no handle. Drop the element rather than rendering an
  // empty div: .social-text is a flex column with a gap, so an empty child
  // would leave a visible hole between the headline and the paragraph.
  const handle = (social?.handle ?? '').trim();

  return (
    <>
      <div className="slide-eyebrow">
        <span className="pip" />
        <span className="rule" />
        <span>Stay Connected</span>
      </div>
      <div className="social-body" data-social={social?.socialType || 'other'}>
        <div className="social-text">
          <div className="social-eyebrow"><Markdown text={social?.headerText} /></div>
          <div className="social-title"><Markdown text={social?.heroText} /></div>
          {handle && <div className="social-handle"><Markdown text={handle} /></div>}
          <div className="social-sub"><Markdown text={social?.footerText} /></div>
        </div>
        <div className="social-qr-wrap">
          {/* frameConfig.url — the account this frame promotes, not a
              board-wide setting. */}
          <QRCode
            value={social?.url}
            size={300}
            caption="Scan with your camera"
            className="qr-panel--social"
          />
        </div>
      </div>
    </>
  );
}
