# Trip Planner

A small React app that takes a free-form trip description, sends it to an LLM (Groq),
and turns the structured JSON response into an interactive day-by-day itinerary —
expandable days, and stops you can remove or reorder. Not a chatbot: the model is
only ever asked for JSON, and the UI is built entirely from that parsed data.

## Stack

- **Frontend:** React (hooks, functional components) + Vite, plain CSS.
- **Backend:** small Express server that owns the Groq API key and never exposes it
  to the browser.
- **AI:** [Groq](https://console.groq.com) (`llama-3.3-70b-versatile` by default),
  called with `response_format: { type: "json_object" }` for JSON mode. Any
  OpenAI-compatible provider would need only a URL/model swap in `server/index.js`.

## Project structure

```
trip-planner/
  server/        Express API (/api/plan), Groq call, zod validation
  client/        Vite + React app
```

## Setup

This is an npm workspaces monorepo (`client` + `server`), so one install/start
at the root runs both.

```bash
# 1. add your Groq key first
cp server/.env.example server/.env
# edit server/.env and paste your free key from https://console.groq.com/keys

# 2. install everything and run both server + client
npm install
npm start
```

This starts the Express API on `http://localhost:8787` and Vite on
`http://localhost:5173` (which proxies `/api/*` to the backend — see
`client/vite.config.js` — so the API key is never fetched from or visible in the
browser).

Open `http://localhost:5173`, describe a trip, and click "Plan my trip."

To run them separately instead: `npm run start --workspace server` and
`npm run dev --workspace client`.

### Production build

```bash
cd client && npm run build   # outputs client/dist
```

## How the AI integration works

1. The client POSTs `{ description }` to `/api/plan`.
2. The server sends a system prompt to Groq describing the exact JSON shape required
   (`destination`, `summary`, `days[].stops[]` with `time/name/description/type`),
   using JSON mode so the model is constrained to emit an object.
3. The response is parsed and validated against a `zod` schema (`server/schema.js`).
   If parsing fails, or the shape doesn't match (wrong types, missing fields, extra
   text around the JSON), the server automatically asks the model **once** to
   correct itself, quoting the validation error back to it.
4. If it still fails, the server returns a typed error (`MALFORMED_JSON` /
   `SCHEMA_MISMATCH`) instead of forwarding garbage to the client.
5. On success, the server assigns stable `id`s to every day/stop (the model is never
   trusted to invent unique ids) so the frontend can key, remove, and reorder them
   safely.

## Handling bad AI output

This was the main focus of the assignment, so to be explicit about what's covered:

- **Malformed JSON** — markdown code fences are stripped defensively before
  `JSON.parse`; if parsing still fails, one repair attempt is made, then the request
  fails cleanly with a message the UI can show.
- **Wrong shape** — every response is validated with `zod` (types, required fields,
  array bounds, enum values with `.catch()` fallbacks for unrecognized `type`
  values) before it ever reaches React state.
- **Empty input** — rejected server-side (400) and the submit button is disabled
  client-side until there's text.
- **Slow / hanging requests** — the server aborts the upstream call after 25s and
  returns a 504; the client shows this as a normal error with a retry button.
- **Failed requests** — network errors, non-2xx responses, and missing API keys all
  map to a distinct error code and a user-facing message.
- **Stale responses never overwrite fresh ones** — `usePlanTrip` tracks a
  monotonically increasing request id and aborts the previous in-flight request
  whenever a new one starts; a response is only applied to state if it's still the
  latest request. So if you submit twice quickly, only the second (correct) result
  ever lands.
- **No crashes** — the app never renders unvalidated data; every failure path ends
  in the `error` state, not a thrown exception in the render tree.

## AI-usage note

I used an AI coding assistant (Claude) to help scaffold this project — generating
the initial component/file structure, the Express + Groq integration boilerplate,
and CSS. I reviewed, adjusted, and tested everything myself, and understand how
each piece works (the request-id race-condition guard, the zod validation +
one-shot repair loop, and the day/stop state updates in particular). I did not
copy this from an existing repo or tutorial.

## Known limitations

- Only one repair attempt is made on invalid AI output; a persistently broken model
  response will surface as an error rather than retrying indefinitely.
- No persistence — refreshing the page loses the current itinerary (no save/reload
  of sessions; listed as a stretch goal in the assignment).
- No streaming — the full itinerary is returned in one response rather than
  streamed in as it generates.
- Day reordering isn't implemented, only stop reordering within a day (the
  assignment's stated requirement).
- Not deployed; run locally per the setup steps above.

## Time spent

~[FILL IN ACTUAL HOURS] — aim was 8 hours per the assignment brief. Rough
breakdown: backend + Groq integration and validation (~2.5h), frontend
components and state management (~2.5h), error/loading/race-condition handling
(~1.5h), styling/mobile polish (~1h), README (~0.5h).

*(Replace the bracketed estimate above with your real time spent before submitting.)*
