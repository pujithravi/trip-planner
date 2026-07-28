import { useState } from "react";

const SUGGESTIONS = ["Make it more relaxed", "Add more food stops", "Make it more budget-friendly"];

export default function RefineBar({ onRefine, status, error }) {
  const [text, setText] = useState("");
  const loading = status === "loading";

  function submit(value) {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onRefine(trimmed);
    setText("");
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      submit(text);
    }
  }

  return (
    <div className="refine-bar">
      <div className="refine-bar__row">
        <input
          type="text"
          className="refine-bar__input"
          placeholder="Refine this trip, e.g. 'make day 2 more relaxed' (⌘/Ctrl+Enter)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          maxLength={500}
          aria-label="Refinement instruction"
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => submit(text)}
          disabled={loading || !text.trim()}
        >
          {loading ? "Updating…" : "Refine"}
        </button>
      </div>
      <div className="refine-bar__chips">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            disabled={loading}
            onClick={() => submit(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {status === "error" && (
        <p className="refine-bar__error" role="alert">
          {error || "Couldn't refine the itinerary. Your current plan is unchanged -- try again."}
        </p>
      )}
    </div>
  );
}
