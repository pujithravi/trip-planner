import DayCard from "./DayCard.jsx";

export default function Itinerary({ itinerary, onChange }) {
  function moveStop(dayId, stopId, dir) {
    onChange((prev) => ({
      ...prev,
      days: prev.days.map((day) => {
        if (day.id !== dayId) return day;
        const idx = day.stops.findIndex((s) => s.id === stopId);
        const swapWith = idx + dir;
        if (swapWith < 0 || swapWith >= day.stops.length) return day;
        const stops = [...day.stops];
        [stops[idx], stops[swapWith]] = [stops[swapWith], stops[idx]];
        return { ...day, stops };
      }),
    }));
  }

  function removeStop(dayId, stopId) {
    onChange((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.id === dayId ? { ...day, stops: day.stops.filter((s) => s.id !== stopId) } : day
      ),
    }));
  }

  function removeDay(dayId) {
    onChange((prev) => ({ ...prev, days: prev.days.filter((d) => d.id !== dayId) }));
  }

  if (itinerary.days.length === 0) {
    return <p className="day-card__empty">All days removed. Plan a new trip above.</p>;
  }

  return (
    <div className="itinerary">
      <header className="itinerary__header">
        <h2>{itinerary.destination}</h2>
        <p>{itinerary.summary}</p>
      </header>
      {itinerary.days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          onMoveStop={moveStop}
          onRemoveStop={removeStop}
          onRemoveDay={removeDay}
        />
      ))}
    </div>
  );
}
