import { useState } from "react";
import StopItem from "./StopItem.jsx";

export default function DayCard({ day, onRemoveStop, onMoveStop, onRemoveDay }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="day-card">
      <button
        type="button"
        className="day-card__header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="day-card__badge">Day {day.day}</span>
        <span className="day-card__title">{day.title}</span>
        <span className="day-card__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="day-card__body">
          {day.stops.length === 0 ? (
            <p className="day-card__empty">All stops removed for this day.</p>
          ) : (
            <ul className="stop-list">
              {day.stops.map((stop, i) => (
                <StopItem
                  key={stop.id}
                  stop={stop}
                  isFirst={i === 0}
                  isLast={i === day.stops.length - 1}
                  onRemove={() => onRemoveStop(day.id, stop.id)}
                  onMove={(dir) => onMoveStop(day.id, stop.id, dir)}
                />
              ))}
            </ul>
          )}
          <button type="button" className="link-btn link-btn--danger" onClick={() => onRemoveDay(day.id)}>
            Remove this day
          </button>
        </div>
      )}
    </section>
  );
}
