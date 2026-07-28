import { useEffect, useState } from "react";
import { usePlanTrip } from "./hooks/usePlanTrip.js";
import TripForm from "./components/TripForm.jsx";
import Itinerary from "./components/Itinerary.jsx";
import RecentTrips from "./components/RecentTrips.jsx";
import { LoadingState, ErrorState, EmptyState } from "./components/StatusStates.jsx";
import { listSessions, deleteSession } from "./lib/sessions.js";

export default function App() {
  const { status, error, itinerary, plan, reset, setItinerary, loadSession } = usePlanTrip();
  const [sessions, setSessions] = useState([]);

  function refreshSessions() {
    setSessions(listSessions());
  }

  useEffect(() => {
    refreshSessions();
  }, [status]);

  function handleDeleteSession(id) {
    deleteSession(id);
    refreshSessions();
  }

  return (
    <div className="app">
      <div className="app__hero" aria-hidden="true" />
      <header className="app__header">
        <h1>Trip Planner</h1>
        <p className="app__tagline">Describe a trip. Get a day-by-day itinerary you can edit.</p>
      </header>

      <main className="app__main">
        <TripForm onSubmit={plan} disabled={status === "loading"} />

        <div className="app__result">
          {status === "loading" && <LoadingState />}
          {status === "error" && <ErrorState message={error} onRetry={reset} />}
          {status === "idle" && (
            <>
              <EmptyState />
              <RecentTrips sessions={sessions} onLoad={loadSession} onDelete={handleDeleteSession} />
            </>
          )}
          {status === "success" && itinerary && (
            <div className="itinerary-enter">
              <Itinerary itinerary={itinerary} onChange={setItinerary} />
            </div>
          )}
        </div>
      </main>

      <footer className="app__footer">
        <p>AI-generated itineraries can be wrong — double-check hours, prices, and availability.</p>
      </footer>
    </div>
  );
}
