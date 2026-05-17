// Scrolling announcements ticker — bottom of stage.
export default function Ticker({ messages, now }) {
  const single = messages.map((m, i) => <span key={i}>{m}</span>);
  return (
    <footer className="ticker">
      <div className="ticker-label">
        <span className="pip" />
        <span>Happening Now</span>
      </div>
      <div className="ticker-track">
        <div className="ticker-content">
          {single}
          {single}
        </div>
      </div>
    </footer>
  );
}
