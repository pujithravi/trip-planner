import { z } from "zod";

const stopSchema = z.object({
  time: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  type: z.enum(["food", "sight", "activity", "transport", "other"]).catch("other"),
});

const daySchema = z.object({
  day: z.number().int().positive(),
  title: z.string().min(1).max(120),
  stops: z.array(stopSchema).min(1).max(12),
});

const itinerarySchema = z.object({
  destination: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  days: z.array(daySchema).min(1).max(30),
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 25000;

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
    const err = new Error("Server is missing GROQ_API_KEY. Set it in Vercel project env vars.");
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const instruction = (req.body?.instruction || "").trim();
  const currentItinerary = req.body?.itinerary;

  if (!instruction) {
    res.status(400).json({ error: "A refinement instruction is required.", code: "EMPTY_INPUT" });
    return;
  }
  if (instruction.length > 500) {
    res.status(400).json({ error: "Instruction is too long (max 500 characters).", code: "TOO_LONG" });
    return;
  }
  if (!currentItinerary || !Array.isArray(currentItinerary.days)) {
    res.status(400).json({ error: "A current itinerary is required to refine.", code: "MISSING_ITINERARY" });
    return;
  }

  try {
    let raw = await callGroqRefine(currentItinerary, instruction);
    let parsed = tryParseJson(raw);
    let validated = parsed.ok ? itinerarySchema.safeParse(parsed.value) : null;

    if (!parsed.ok || !validated.success) {
      const priorError = parsed.ok ? JSON.stringify(validated.error.issues.slice(0, 3)) : parsed.error;
      raw = await callGroqRefine(currentItinerary, instruction, { repairAttempt: true, priorError });
      parsed = tryParseJson(raw);
      validated = parsed.ok ? itinerarySchema.safeParse(parsed.value) : null;
    }

    if (!parsed.ok) {
      res.status(502).json({
        error: "The model's refinement wasn't valid JSON, even after a retry.",
        code: "MALFORMED_JSON",
      });
      return;
    }
    if (!validated.success) {
      res.status(502).json({
        error: "The model's refined JSON didn't match the expected shape, even after a retry.",
        code: "SCHEMA_MISMATCH",
        details: validated.error.issues.slice(0, 5),
      });
      return;
    }

    const itinerary = validated.data;
    itinerary.days = itinerary.days.map((day, di) => ({
      ...day,
      id: `day-${di}`,
      stops: day.stops.map((stop, si) => ({ ...stop, id: `day-${di}-stop-${si}` })),
    }));

    res.status(200).json({ itinerary });
  } catch (e) {
    const code = e.code || "UNKNOWN";
    const statusByCode = {
      NO_API_KEY: 500,
      TIMEOUT: 504,
      UPSTREAM_ERROR: 502,
      EMPTY_RESPONSE: 502,
    };
    res.status(statusByCode[code] || 500).json({ error: e.message, code });
  }
}
