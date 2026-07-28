import { useCallback, useRef, useState } from "react";

/**
 * Encapsulates the request lifecycle for generating a trip itinerary:
 * loading/error/data state, an AbortController per request, and a
 * request-id guard so a slow, stale response can never clobber a
 * newer one that already resolved.
 */
export function usePlanTrip() {
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [error, setError] = useState(null);
  const [itinerary, setItinerary] = useState(null);

  const latestRequestId = useRef(0);
  const abortRef = useRef(null);

  const plan = useCallback(async (description) => {
    const requestId = ++latestRequestId.current;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
        signal: controller.signal,
      });

      const body = await res.json().catch(() => null);

      // A newer request has since been kicked off -- discard this result.
      if (requestId !== latestRequestId.current) return;

      if (!res.ok || !body?.itinerary) {
        setStatus("error");
        setError(body?.error || `Request failed (${res.status}).`);
        return;
      }

      setItinerary(body.itinerary);
      setStatus("success");
    } catch (e) {
      if (requestId !== latestRequestId.current) return;
      if (e.name === "AbortError") return; // superseded by a newer request
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

  return { status, error, itinerary, plan, reset, setItinerary };
}
