import { useState } from "react";

const EXAMPLES = [
  "5 days in Lisbon, mid-range budget, love food and old neighborhoods",
  "Long weekend in Tokyo, first time visiting, interested in anime and ramen",
  "7-day road trip through Iceland, into hiking and hot springs",
];

export default function TripForm({ onSubmit, disabled }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <label htmlFor="trip-description" className="trip-form__label">
        Describe your trip
      </label>
      <textarea
        id="trip-description"
        className="trip-form__textarea"
        placeholder="e.g. 4 days in Kyoto, love temples and quiet cafes, traveling with a partner"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={4}
        disabled={disabled}
      />
      <div className="trip-form__row">
        <span className="trip-form__hint">{text.length}/2000</span>
        <button type="submit" className="btn btn--primary" disabled={disabled || !text.trim()}>
          {disabled ? "Planning…" : "Plan my trip"}
        </button>
      </div>
      <div className="trip-form__examples">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip"
            disabled={disabled}
            onClick={() => setText(ex)}
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
