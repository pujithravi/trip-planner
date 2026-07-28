import { usePlanTrip } from "./hooks/usePlanTrip.js";
import TripForm from "./components/TripForm.jsx";
import Itinerary from "./components/Itinerary.jsx";
import { LoadingState, ErrorState, EmptyState } from "./components/StatusStates.jsx";

export default function App() {
  const { status, error, itinerary, plan, reset, setItinerary } = usePlanTrip();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Trip Planner</h1>
        <p className="app__tagline">Describe a trip. Get a day-by-day itinerary you can edit.</p>
      </header>

      <main className="app__main">
        <TripForm onSubmit={plan} disabled={status === "loading"} />

        <div className="app__result">
          {status === "loading" && <LoadingState />}
          {status === "error" && <ErrorState message={error} onRetry={reset} />}
          {status === "idle" && <EmptyState />}
          {status === "success" && itinerary && (
            <Itinerary itinerary={itinerary} onChange={setItinerary} />
          )}
        </div>
      </main>

      <footer className="app__footer">
        <p>AI-generated itineraries can be wrong — double-check hours, prices, and availability.</p>
      </footer>
    </div>
  );
}
