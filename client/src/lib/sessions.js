const STORAGE_KEY = "tripPlanner.sessions.v1";
const MAX_SESSIONS = 10;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable -- fail silently.
  }
}

export function listSessions() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveSession(description, itinerary) {
  const sessions = readAll();
  const entry = {
    id: `session-${Date.now()}`,
    description,
    itinerary,
    savedAt: Date.now(),
  };
  const next = [entry, ...sessions].slice(0, MAX_SESSIONS);
  writeAll(next);
  return entry;
}

export function deleteSession(id) {
  writeAll(readAll().filter((s) => s.id !== id));
}
