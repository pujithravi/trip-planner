export function LoadingState() {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>Building your itinerary… this can take up to 20-25 seconds.</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Something went wrong</p>
      <p className="state__message">{message || "The trip planner hit an unexpected error."}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="state state--empty">
      <p>No itinerary yet. Describe a trip above and click "Plan my trip" to get started.</p>
    </div>
  );
}
