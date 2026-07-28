import "dotenv/config";
import express from "express";
import cors from "cors";
import { validateItinerary } from "./schema.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50kb" }));

const PORT = process.env.PORT || 8787;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const REQUEST_TIMEOUT_MS = 25000;

const SYSTEM_PROMPT = `You are a trip planning assistant. Given a free-form trip description from a user, return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:

{
  "destination": string,
  "summary": string (1-2 sentences),
  "days": [
    {
      "day": number (starting at 1),
      "title": string (short theme for the day),
      "stops": [
        {
          "time": string (e.g. "9:00 AM"),
          "name": string (name of the place/activity),
          "description": string (1-2 sentences),
          "type": one of "food" | "sight" | "activity" | "transport" | "other"
        }
      ]
    }
  ]
}

Rules:
- Infer a sensible number of days from the user's description (default to 3 if unclear).
- Each day should have 3-6 stops.
- Output must be valid JSON and nothing else.`;

async function callGroq(userText, { repairAttempt = false, priorError = "" } = {}) {
  if (!GROQ_API_KEY) {
    const err = new Error("Server is missing GROQ_API_KEY. Add it to server/.env (see .env.example).");
    err.code = "NO_API_KEY";
    throw err;
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userText },
  ];

  if (repairAttempt) {
    messages.push({
      role: "user",
      content: `Your previous response did not match the required JSON shape (error: ${priorError}). Return ONLY the corrected JSON object, matching the shape exactly. No prose, no markdown fences.`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
      err.code = "UPSTREAM_ERROR";
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const err = new Error("Groq response had no content.");
      err.code = "EMPTY_RESPONSE";
      throw err;
    }
    return content;
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("Groq request timed out.");
      err.code = "TIMEOUT";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

function tryParseJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

app.post("/api/plan", async (req, res) => {
  const description = (req.body?.description || "").trim();

  if (!description) {
    return res.status(400).json({ error: "Trip description is required.", code: "EMPTY_INPUT" });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: "Description is too long (max 2000 characters).", code: "TOO_LONG" });
  }

  try {
    let raw = await callGroq(description);
    let parsed = tryParseJson(raw);
    let validated = parsed.ok ? validateItinerary(parsed.value) : null;

    if (!parsed.ok || !validated.success) {
      const priorError = parsed.ok ? JSON.stringify(validated.error.issues.slice(0, 3)) : parsed.error;
      raw = await callGroq(description, { repairAttempt: true, priorError });
      parsed = tryParseJson(raw);
      validated = parsed.ok ? validateItinerary(parsed.value) : null;
    }

    if (!parsed.ok) {
      return res.status(502).json({
        error: "The model returned output that wasn't valid JSON, even after a retry.",
        code: "MALFORMED_JSON",
      });
    }
    if (!validated.success) {
      return res.status(502).json({
        error: "The model's JSON didn't match the expected itinerary shape, even after a retry.",
        code: "SCHEMA_MISMATCH",
        details: validated.error.issues.slice(0, 5),
      });
    }

    const itinerary = validated.data;
    itinerary.days = itinerary.days.map((day, di) => ({
      ...day,
      id: `day-${di}`,
      stops: day.stops.map((stop, si) => ({ ...stop, id: `day-${di}-stop-${si}` })),
    }));

    return res.json({ itinerary });
  } catch (e) {
    const code = e.code || "UNKNOWN";
    const statusByCode = {
      NO_API_KEY: 500,
      TIMEOUT: 504,
      UPSTREAM_ERROR: 502,
      EMPTY_RESPONSE: 502,
    };
    return res.status(statusByCode[code] || 500).json({ error: e.message, code });
  }
});

const REFINE_SYSTEM_PROMPT = `You refine an existing trip itinerary based on a user's follow-up instruction.
You will be given the CURRENT itinerary as JSON and an INSTRUCTION describing what to change.
Return ONLY the complete UPDATED itinerary as a single JSON object, in this exact shape:

{
  "destination": string,
  "summary": string (1-2 sentences),
  "days": [
    {
      "day": number,
      "title": string,
      "stops": [
        { "time": string, "name": string, "description": string, "type": "food"|"sight"|"activity"|"transport"|"other" }
      ]
    }
  ]
}

Rules:
- Apply the instruction (e.g. "make day 2 more relaxed", "add a museum on day 1", "remove day 3").
- Keep every day/stop NOT affected by the instruction unchanged.
- Output must be valid JSON and nothing else -- no prose, no markdown fences.`;

async function callGroqRefine(currentItinerary, instruction, { repairAttempt = false, priorError = "" } = {}) {
  if (!GROQ_API_KEY) {
    const err = new Error("Server is missing GROQ_API_KEY. Add it to server/.env (see .env.example).");
    err.code = "NO_API_KEY";
    throw err;
  }

  const userContent = `CURRENT ITINERARY:\n${JSON.stringify(currentItinerary)}\n\nINSTRUCTION:\n${instruction}`;

  const messages = [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  if (repairAttempt) {
    messages.push({
      role: "user",
      content: `Your previous response did not match the required JSON shape (error: ${priorError}). Return ONLY the corrected JSON object, matching the shape exactly. No prose, no markdown fences.`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
      err.code = "UPSTREAM_ERROR";
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const err = new Error("Groq response had no content.");
      err.code = "EMPTY_RESPONSE";
      throw err;
    }
    return content;
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("Groq request timed out.");
      err.code = "TIMEOUT";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

app.post("/api/refine", async (req, res) => {
  const instruction = (req.body?.instruction || "").trim();
  const currentItinerary = req.body?.itinerary;

  if (!instruction) {
    return res.status(400).json({ error: "A refinement instruction is required.", code: "EMPTY_INPUT" });
  }
  if (instruction.length > 500) {
    return res.status(400).json({ error: "Instruction is too long (max 500 characters).", code: "TOO_LONG" });
  }
  if (!currentItinerary || !Array.isArray(currentItinerary.days)) {
    return res.status(400).json({ error: "A current itinerary is required to refine.", code: "MISSING_ITINERARY" });
  }

  try {
    let raw = await callGroqRefine(currentItinerary, instruction);
    let parsed = tryParseJson(raw);
    let validated = parsed.ok ? validateItinerary(parsed.value) : null;

    if (!parsed.ok || !validated.success) {
      const priorError = parsed.ok ? JSON.stringify(validated.error.issues.slice(0, 3)) : parsed.error;
      raw = await callGroqRefine(currentItinerary, instruction, { repairAttempt: true, priorError });
      parsed = tryParseJson(raw);
      validated = parsed.ok ? validateItinerary(parsed.value) : null;
    }

    if (!parsed.ok) {
      return res.status(502).json({
        error: "The model's refinement wasn't valid JSON, even after a retry.",
        code: "MALFORMED_JSON",
      });
    }
    if (!validated.success) {
      return res.status(502).json({
        error: "The model's refined JSON didn't match the expected shape, even after a retry.",
        code: "SCHEMA_MISMATCH",
        details: validated.error.issues.slice(0, 5),
      });
    }

    const itinerary = validated.data;
    itinerary.days = itinerary.days.map((day, di) => ({
      ...day,
      id: `day-${di}`,
      stops: day.stops.map((stop, si) => ({ ...stop, id: `day-${di}-stop-${si}` })),
    }));

    return res.json({ itinerary });
  } catch (e) {
    const code = e.code || "UNKNOWN";
    const statusByCode = {
      NO_API_KEY: 500,
      TIMEOUT: 504,
      UPSTREAM_ERROR: 502,
      EMPTY_RESPONSE: 502,
    };
    return res.status(statusByCode[code] || 500).json({ error: e.message, code });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Trip planner server listening on http://localhost:${PORT}`);
  if (!GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY is not set. Copy server/.env.example to server/.env and add your key.");
  }
});
