// The match diary: games a person went to or watched, with a rating and a short note. It lives on the device (it is a
// personal log, nothing here is sent anywhere) and only the screens that use it load this file. Every entry keeps a
// small snapshot of the match (teams, score, date) so the diary still reads properly offline or years later.
const KEY = "scoutwave.diary";
const MAX_ENTRIES = 500, MAX_NOTE = 500;
export const KINDS = ["attended", "watched"];

const str = (v, max) => String(v ?? "").slice(0, max);
const https = (v) => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || "")) ? String(v).slice(0, 300) : "");
const team = (t) => ({ id: Number(t?.id) || 0, name: str(t?.name, 60), logo: https(t?.logo) });

// What a diary entry remembers about a match (from an API-Football fixture).
export function snapshotOf(fx) {
  return {
    date: str(fx?.fixture?.date, 40),
    league: str(fx?.league?.name, 60),
    round: str(fx?.league?.round, 40),
    home: team(fx?.teams?.home), away: team(fx?.teams?.away),
    goals: { home: Number.isFinite(fx?.goals?.home) ? fx.goals.home : null, away: Number.isFinite(fx?.goals?.away) ? fx.goals.away : null },
  };
}

// Anything read back from storage (or about to be saved) goes through here.
export function sanitizeEntry(raw) {
  const id = Number(raw?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const m = raw.match || {};
  const rating = Math.round(Number(raw.rating));
  return {
    id,
    kind: KINDS.includes(raw.kind) ? raw.kind : "watched",
    rating: rating >= 1 && rating <= 5 ? rating : 0, // 0 = not rated
    note: str(String(raw.note ?? "").trim(), MAX_NOTE),
    at: Number.isFinite(Number(raw.at)) ? Number(raw.at) : Date.now(),
    match: { date: str(m.date, 40), league: str(m.league, 60), round: str(m.round, 40), home: team(m.home), away: team(m.away), goals: { home: Number.isFinite(m.goals?.home) ? m.goals.home : null, away: Number.isFinite(m.goals?.away) ? m.goals.away : null } },
  };
}

export function loadDiary() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return (Array.isArray(list) ? list : []).map(sanitizeEntry).filter(Boolean).sort(byMatchDate);
  } catch { return []; }
}
const byMatchDate = (a, b) => (Date.parse(b.match.date) || b.at) - (Date.parse(a.match.date) || a.at);

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES))); return true; } catch { return false; }
}
export const entryFor = (id) => loadDiary().find((e) => e.id === Number(id)) || null;

// Adds the match, or replaces its entry. Returns the saved entry, or null if the storage is full/unavailable.
export function saveEntry(raw) {
  const entry = sanitizeEntry({ ...raw, at: raw.at || Date.now() });
  if (!entry) return null;
  const list = loadDiary().filter((e) => e.id !== entry.id);
  list.push(entry);
  list.sort(byMatchDate);
  return save(list) ? entry : null;
}
export function removeEntry(id) {
  return save(loadDiary().filter((e) => e.id !== Number(id)));
}

export function diaryStats(list) {
  const rated = list.filter((e) => e.rating > 0);
  return {
    total: list.length,
    attended: list.filter((e) => e.kind === "attended").length,
    watched: list.filter((e) => e.kind === "watched").length,
    average: rated.length ? Math.round((rated.reduce((s, e) => s + e.rating, 0) / rated.length) * 10) / 10 : null,
    goals: list.reduce((s, e) => s + (e.match.goals.home || 0) + (e.match.goals.away || 0), 0),
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Entries (newest first) grouped by the month the match was played: [{ key: "2026-03", label: "March 2026", entries }].
export function groupByMonth(list) {
  const groups = [];
  for (const entry of list) {
    const d = new Date(entry.match.date || entry.at);
    const key = Number.isNaN(d.getTime()) ? "unknown" : d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: key === "unknown" ? "Undated" : MONTHS[d.getMonth()] + " " + d.getFullYear(), entries: [] }; groups.push(g); }
    g.entries.push(entry);
  }
  return groups;
}
