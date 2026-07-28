import { useCallback, useRef, useState } from "react";
import { saveSession } from "../lib/sessions.js";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function usePlanTrip() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [lastDescription, setLastDescription] = useState("");

  const latestRequestId = useRef(0);
  const abortRef = useRef(null);

  const plan = useCallback(async (description) => {
    const requestId = ++latestRequestId.current;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setLastDescription(description);

    try {
      const res = await fetch(`${API_BASE}/api/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
        signal: controller.signal,
      });

      const body = await res.json().catch(() => null);

      if (requestId !== latestRequestId.current) return;

      if (!res.ok || !body?.itinerary) {
        setStatus("error");
        setError(body?.error || `Request failed (${res.status}).`);
        return;
      }

      setItinerary(body.itinerary);
      setStatus("success");
      saveSession(description, body.itinerary);
    } catch (e) {
      if (requestId !== latestRequestId.current) return;
      if (e.name === "AbortError") return;
      setStatus("error");
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }, []);

  const reset = useCallback(() => {
    latestRequestId.current++;
    setStatus("idle");
    setError(null);
    setItinerary(null);
  }, []);

  const loadSession = useCallback((session) => {
    latestRequestId.current++;
    if (abortRef.current) abortRef.current.abort();
    setStatus("success");
    setError(null);
    setLastDescription(session.description);
    setItinerary(session.itinerary);
  }, []);

  return { status, error, itinerary, lastDescription, plan, reset, setItinerary, loadSession };
}
