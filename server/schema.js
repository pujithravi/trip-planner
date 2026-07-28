import { z } from "zod";

// Schema the model's JSON output must satisfy. Kept intentionally strict:
// if the model drifts from this shape, we catch it here instead of letting
// broken data reach the React tree.
export const stopSchema = z.object({
  time: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  type: z.enum(["food", "sight", "activity", "transport", "other"]).catch("other"),
});

export const daySchema = z.object({
  day: z.number().int().positive(),
  title: z.string().min(1).max(120),
  stops: z.array(stopSchema).min(1).max(12),
});

export const itinerarySchema = z.object({
  destination: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  days: z.array(daySchema).min(1).max(30),
});

export function validateItinerary(raw) {
  return itinerarySchema.safeParse(raw);
}
