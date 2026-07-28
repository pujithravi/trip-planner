export default function RecentTrips({ sessions, onLoad, onDelete }) {
  if (sessions.length === 0) return null;

  return (
    <div className="recent-trips">
      <h3 className="recent-trips__title">Recent trips</h3>
      <p className="recent-trips__hint">
        Pick up where you left off — these are stored on this device, and reopening one costs nothing.
      </p>
      <ul className="recent-trips__list">
        {sessions.map((s) => {
          const dayCount = s.itinerary?.days?.length || 0;
          const stopCount = (s.itinerary?.days || []).reduce((n, d) => n + d.stops.length, 0);
          return (
            <li key={s.id} className="recent-trip">
              <button type="button" className="recent-trip__main" onClick={() => onLoad(s)}>
                <span className="recent-trip__destination">{s.itinerary?.destination || s.description}</span>
                <span className="recent-trip__meta">
                  {dayCount} day{dayCount === 1 ? "" : "s"} · {stopCount} stop{stopCount === 1 ? "" : "s"}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label="Delete saved trip"
                onClick={() => onDelete(s.id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
