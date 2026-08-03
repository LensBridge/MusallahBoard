// Left rail — prayer timeline (distance hierarchy) + Jummah card.
import { formatTo12, toMinutes, zonedMinutes } from '../models/index.js';
import { classifyPrayers } from '../utils/prayers.js';
import { BrandGlyph } from './icons.jsx';

export default function PrayerRail({ data, now, showJummah, brothers }) {
  const { prayers, jummahPrayers, timezone } = data;
  const { ordered, next, current } = classifyPrayers(prayers, now, timezone);
  const nowM = zonedMinutes(now, timezone);

  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="brand-mark"><BrandGlyph /></div>
        <div className="brand-text">
          {/* <div className="brand-eyebrow">UTM · MSA</div> */}
          <div className="brand-name">MUSALLAHBOARD</div>
        </div>
      </div>

      <div className="prayer-list">
        {ordered.map((key) => {
          const p = prayers[key];
          let cls = 'prayer-row';
          if (key === current) cls += ' active';
          else if (key === next) cls += ' next';
          else if (toMinutes(p.adhan) < nowM) cls += ' passed';
          const hanafi = key === 'asr' && p.hanafiAdhan;
          return (
            <div key={key} className={cls} data-prayer={key}>
              <div className="prayer-pip" />
              <div className="prayer-name">{p.english}</div>
              <div className="prayer-time">{formatTo12(p.adhan)}</div>
              {hanafi && (
                <div className="prayer-sub">Hanafī · {formatTo12(p.hanafiAdhan)}</div>
              )}
            </div>
          );
        })}
      </div>

      {showJummah && jummahPrayers.length > 0 && (
        <div className="jummah-card">
          <div className="jummah-label">Jumuʿah · Friday</div>
          <div className="jummah-slots">
            {jummahPrayers.map((j, i) => (
              <div key={i} className="jummah-slot">
                <div className="jummah-time">{j.time}</div>
                <div className="jummah-meta">
                  <div className="jummah-khatib">{j.khatib}</div>
                  <div className="jummah-room">{j.room}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
