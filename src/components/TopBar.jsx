// Top bar: date strip, clock, weather chip. Brand mark lives in the rail.
import { zonedClock } from '../models/index.js';
import { weatherIcon } from './icons.jsx';
import Digits from './Digits.jsx';

export default function TopBar({ data, now }) {
  const { date, weather, timezone } = data;
  const { hours, minutes, seconds } = zonedClock(now, timezone);
  const displayHours = hours % 12 || 12;
  const period = hours >= 12 ? 'PM' : 'AM';
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}`;

  return (
    <header className="topbar">
      <div className="date-strip">
        <div className="date-block">
          <div className="date-eyebrow">Today · {date.gregorian.weekday}</div>
          <div className="date-value">
            {date.gregorian.month} {date.gregorian.day}, {date.gregorian.year}
          </div>
        </div>
        <div className="date-divider" />
        <div className="date-block">
          <div className="date-eyebrow">Hijrī · {date.hijri.monthAr}</div>
          <div className="date-value hijri">
            {date.hijri.day} {date.hijri.monthEn} {date.hijri.year} AH
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="clock">
          <div className="clock-time">
            <Digits>{timeStr}</Digits>
            <span style={{ opacity: seconds % 2 ? 0.3 : 1, transition: 'opacity 0.3s' }}>:</span>
            <Digits>{seconds.toString().padStart(2, '0')}</Digits>
          </div>
          <div className="clock-period">{period}</div>
        </div>
        {weather && (
          <div className="weather-chip">
            {weatherIcon(weather.condition)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1 }}>
              <div className="weather-temp">{weather.temp}°C</div>
              <div className="weather-loc">{weather.city}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
