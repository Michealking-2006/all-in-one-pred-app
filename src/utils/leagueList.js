// The full list of competitions for the Leagues screen: one request for every league that has a season under
// way, trimmed to what the list needs, then searched, filtered and grouped on the device (no request per keystroke).
// Loaded only with the Leagues screen, so it never adds to the startup code.
import { footballRaw } from "../api/footballApi.js";

export const POPULAR_LEAGUE_IDS = [39, 140, 135, 78, 61, 2];
const HOUR = 3_600_000;
const FRESH_MS = 6 * HOUR; // the server keeps this answer for days; no need to ask again within a session this long

// Lower case, no accents: "Bundesliga 2", "Süper Lig" and "super lig" all match what people type.
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// Provider rows -> { league: { id, name, type, logo }, country: { name, flag }, key }. Drops the seasons and coverage
// details (most of the size), rows without an id or name, and repeats of the same league.
export function slimLeagues(rows) {
  const seen = new Set(), out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const l = row?.league;
    if (!l || l.id == null || !String(l.name || "").trim() || seen.has(l.id)) continue;
    seen.add(l.id);
    const name = String(l.name).trim(), country = String(row?.country?.name || "").trim();
    out.push({
      league: { id: l.id, name, type: l.type === "Cup" ? "Cup" : "League", logo: l.logo || "" },
      country: { name: country, flag: row?.country?.flag || "" },
      key: norm(name + " " + country),
    });
  }
  return out;
}

// type: "all" | "League" | "Cup". query: every word must appear in the league's name or country.
// Results that start with the query come first, then the rest in name order.
export function filterLeagues(list, { query = "", type = "all" } = {}) {
  const words = norm(query).split(" ").filter(Boolean);
  const kept = list.filter((e) => (type === "all" || e.league.type === type) && words.every((w) => e.key.includes(w)));
  if (!words.length) return kept;
  const first = words[0];
  const rank = (e) => (norm(e.league.name).startsWith(first) ? 0 : norm(e.country.name).startsWith(first) ? 1 : 2);
  return kept.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e);
}

const byKind = (a, b) => (a.league.type === b.league.type ? 0 : a.league.type === "League" ? -1 : 1);
const byName = (a, b) => a.league.name.localeCompare(b.league.name, "en", { sensitivity: "base" });

// [{ country, flag, items }]: "World" (international competitions) first, then countries A to Z, then anything
// without a country. Inside a country, leagues come before cups, each in name order.
export function groupByCountry(list) {
  const groups = new Map();
  for (const e of list) {
    const name = e.country.name || "Other";
    if (!groups.has(name)) groups.set(name, { country: name, flag: e.country.flag || "", items: [] });
    const g = groups.get(name);
    if (!g.flag && e.country.flag) g.flag = e.country.flag;
    g.items.push(e);
  }
  const rank = (g) => (g.country === "World" ? 0 : g.country === "Other" ? 2 : 1);
  const out = [...groups.values()].sort((a, b) => rank(a) - rank(b) || a.country.localeCompare(b.country, "en", { sensitivity: "base" }));
  out.forEach((g) => g.items.sort((a, b) => byKind(a, b) || byName(a, b)));
  return out;
}

// The popular six, in the order above, taken from the list (no extra requests).
export function popularFrom(list) {
  const byId = new Map(list.map((e) => [e.league.id, e]));
  return POPULAR_LEAGUE_IDS.map((id) => byId.get(id)).filter(Boolean);
}

let memo = null; // { at, list }
let pending = null;
// Every league with a current season. Shared between callers, kept for FRESH_MS, never cached when it fails.
export function loadAllLeagues({ fetcher = footballRaw, now = Date.now } = {}) {
  if (memo && now() - memo.at < FRESH_MS) return Promise.resolve(memo.list);
  if (pending) return pending;
  pending = Promise.resolve(fetcher("leagues", { current: "true" }))
    .then((rows) => {
      const list = slimLeagues(rows);
      if (!list.length) throw new Error("No leagues returned");
      memo = { at: now(), list };
      return list;
    })
    .finally(() => { pending = null; });
  return pending;
}
export const _resetLeagueListForTests = () => { memo = null; pending = null; };
