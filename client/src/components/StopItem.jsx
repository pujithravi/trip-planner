const TYPE_ICON = {
  food: "🍽️",
  sight: "🏛️",
  activity: "🎟️",
  transport: "🚗",
  other: "📍",
};

export default function StopItem({ stop, isFirst, isLast, onRemove, onMove }) {
  return (
    <li className="stop">
      <div className="stop__icon" aria-hidden="true">
        {TYPE_ICON[stop.type] || TYPE_ICON.other}
      </div>
      <div className="stop__body">
        <div className="stop__meta">
          <span className="stop__time">{stop.time}</span>
          <span className="stop__name">{stop.name}</span>
        </div>
        <p className="stop__description">{stop.description}</p>
      </div>
      <div className="stop__actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Move stop up"
          disabled={isFirst}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Move stop down"
          disabled={isLast}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          aria-label="Remove stop"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
