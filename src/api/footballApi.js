import { userTimezone } from "../utils/fixtures.js";

const BASE_URL = "/api/football";
const REQUEST_TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// Caching. API-Football requests are the app's scarce resource, so every
// response is cached in three layers:
//   1. memory       - this page load (also shares identical in-flight requests)
//   2. sessionStorage - this browser tab session: reloads / back-forward are free
//   3. localStorage - long-lived data that rarely changes (venues: one year,
//                     players: one day), shared across sessions
// Failures are never cached. Live data (fixtures, events, lineups, stats, odds,
// standings) is never served stale; slow data may be shown stale while it
// refreshes quietly in the background. Finished matches stop being re-fetched.
// ---------------------------------------------------------------------------
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const TTL_MS = {
  // live
  fixtures: 30_000,
  "fixtures/events": 30_000,
  "fixtures/lineups": 30_000,
  "fixtures/statistics": 30_000,
  "fixtures/players": 30_000,
  odds: 30_000,
  standings: 10 * MIN,
  // slow-changing
  "fixtures/headtohead": 6 * HOUR,
  "fixtures/rounds": 6 * HOUR,
  "teams/statistics": HOUR,
  "players/topscorers": HOUR,
  "players/topassists": HOUR,
  "players/topyellowcards": HOUR,
  "players/topredcards": HOUR,
  leagues: DAY,
  teams: DAY,
  "teams/seasons": DAY,
  coachs: DAY,
  // players: one day
  players: DAY,
  "players/squads": DAY,
  "players/seasons": DAY,
  "players/profiles": DAY,
  trophies: DAY,
  transfers: DAY,
  // venues: one year
  venues: 365 * DAY,
};
const DEFAULT_TTL_MS = 10 * MIN;
const MAX_CACHE_ENTRIES = 300;

// Endpoints persisted across sessions (localStorage); everything else uses the
// per-tab session cache.
const LOCAL_ENDPOINTS = new Set(["venues", "players", "players/squads", "players/seasons", "players/profiles", "trophies", "transfers"]);
// Slow endpoints that may be shown (up to 6 h old) while a refresh runs.
const STALE_OK = new Set(["leagues", "teams", "teams/seasons", "coachs", "teams/statistics", "fixtures/headtohead", "fixtures/rounds",
  "players/topscorers", "players/topassists", "players/topyellowcards", "players/topredcards"]);
const STALE_MAX_MS = 6 * HOUR;
const LOCAL_BUDGET_CHARS = 2_000_000;
const MAX_ENTRY_CHARS = 250_000;

const SETTLED = new Set(["FT", "AET", "PEN"]);
const finishedIds = new Set(); // fixtures known to be over: their detail never changes

const cache = new Map();
const inflight = new Map();

const PREFIX = "scoutwave.fb.v2.";

function storageFor(endpoint) {
  try {
    return LOCAL_ENDPOINTS.has(endpoint) ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // blocked (private mode / disabled storage)
  }
}

const endpointOfKey = (key) => key.slice(0, key.indexOf("?"));

function readStored(key) {
  const store = storageFor(endpointOfKey(key));
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.at !== "number" || typeof entry.ttl !== "number" || entry.data === undefined) {
      store.removeItem(PREFIX + key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function ownKeys(store) {
  const out = [];
  for (let i = 0; i < store.length; i++) {
    const name = store.key(i);
    if (name && name.startsWith(PREFIX)) out.push(name);
  }
  return out;
}

// Drop the oldest entries until about `fraction` of ours is gone.
function pruneStore(store, fraction = 0.5) {
  try {
    const rows = ownKeys(store).map((name) => {
      let at = 0;
      try { at = JSON.parse(store.getItem(name))?.at || 0; } catch { /* corrupt: treat as oldest */ }
      return [name, at];
    }).sort((a, b) => a[1] - b[1]);
    rows.slice(0, Math.max(1, Math.ceil(rows.length * fraction))).forEach(([name]) => store.removeItem(name));
  } catch {
    // Nothing more we can do.
  }
}

function storedChars(store) {
  let total = 0;
  try { ownKeys(store).forEach((name) => { total += (store.getItem(name) || "").length; }); } catch { /* ignore */ }
  return total;
}

function writeStored(key, entry) {
  const store = storageFor(endpointOfKey(key));
  if (!store) return;
  let raw;
  try { raw = JSON.stringify(entry); } catch { return; }
  if (raw.length > MAX_ENTRY_CHARS) return;
  try {
    // The long-lived tier gets a size budget so it can never crowd out the site's other storage.
    if (store === window.localStorage && storedChars(store) + raw.length > LOCAL_BUDGET_CHARS) pruneStore(store, 0.4);
    store.setItem(PREFIX + key, raw);
  } catch {
    pruneStore(store, 0.5); // quota: drop the older half, try once more
    try { store.setItem(PREFIX + key, raw); } catch { /* give up quietly */ }
  }
}

function cleanParams(params) {
  const out = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value == null || value === "") continue;
    out[key] = String(value);
  }
  return out;
}

const keyOf = (endpoint, params) => endpoint + "?" + new URLSearchParams(params).toString();

function readCache(key) {
  const hit = cache.get(key);
  if (hit) {
    if (Date.now() - hit.at <= hit.ttl) return hit.data;
    cache.delete(key);
  }
  // Not in memory (e.g. just after a reload): fall back to the stored copy.
  const saved = readStored(key);
  if (saved && Date.now() - saved.at <= saved.ttl) {
    cache.set(key, saved);
    return saved.data;
  }
  return undefined;
}

// An expired copy that is still acceptable to show while a refresh runs.
function staleEntry(key, endpoint) {
  if (!STALE_OK.has(endpoint)) return null;
  const saved = readStored(key);
  return saved && Date.now() - saved.at <= STALE_MAX_MS ? saved : null;
}

// How long a response stays fresh. Mostly per endpoint, but a few answers are
// known to be final, which lets them live much longer.
export function ttlFor(endpoint, params, data) {
  if (endpoint === "fixtures") {
    const rows = Array.isArray(data) ? data : [];
    const statusOf = (fx) => fx?.fixture?.status?.short;
    const startedAt = (fx) => new Date(fx?.fixture?.date).getTime();
    rows.forEach((fx) => {
      if (SETTLED.has(statusOf(fx)) && Date.now() - startedAt(fx) > 3 * HOUR && fx.fixture?.id) finishedIds.add(fx.fixture.id);
    });
    if (rows.length && rows.every((fx) => finishedIds.has(fx?.fixture?.id))) return params.id ? DAY : 6 * HOUR; // all over: final
    if (params.team && (params.last || params.next)) return 15 * MIN; // a team's form only changes when a match ends
    if (params.date && rows.length && rows.every((fx) => statusOf(fx) === "NS")) return 10 * MIN; // nothing started: only kick-off times can move
    if (params.date && rows.length && !rows.some((fx) => ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(statusOf(fx)))) return 2 * MIN; // nothing live right now
    return TTL_MS.fixtures;
  }
  if (["fixtures/events", "fixtures/lineups", "fixtures/statistics", "fixtures/players", "odds"].includes(endpoint) && finishedIds.has(Number(params.fixture))) return DAY;
  return TTL_MS[endpoint] ?? DEFAULT_TTL_MS;
}

function writeCache(key, endpoint, data, params = {}) {
  const entry = { at: Date.now(), ttl: ttlFor(endpoint, params, data), data };
  cache.set(key, entry);
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  writeStored(key, entry);
}

// Returns cached data synchronously if it is still fresh, else undefined.
export function peekFootball(endpoint, params = {}) {
  return readCache(keyOf(endpoint, cleanParams(params)));
}

// Used by pull-to-refresh: forget everything except venues (stadium data is
// effectively static, and is cached for a year on purpose).
export function clearFootballCache({ keepVenues = true } = {}) {
  cache.clear();
  for (const store of [safe(() => window.sessionStorage), safe(() => window.localStorage)]) {
    if (!store) continue;
    try {
      ownKeys(store)
        .filter((name) => !(keepVenues && name.startsWith(PREFIX + "venues?")))
        .forEach((name) => store.removeItem(name));
    } catch {
      // Ignore.
    }
  }
}

function safe(fn) {
  try { return fn(); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------
const FRIENDLY_ERRORS = {
  FOOTBALL_API_RATE_LIMIT: "The football data limit has been reached for now. Please try again later.",
  MISSING_FOOTBALL_API_KEY: "Football data isn't configured yet (missing API key on the server).",
  FOOTBALL_API_NETWORK_ERROR: "Couldn't reach the football data service. Please try again.",
};

async function requestOnce(endpoint, params) {
  const query = new URLSearchParams({ endpoint, ...params });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(BASE_URL + "?" + query.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const error = new Error(
        FRIENDLY_ERRORS[data?.code] ||
          (typeof data?.error === "string" && data.error) ||
          "Football data request failed (" + res.status + ")."
      );
      error.status = res.status;
      error.code = data?.code;
      throw error;
    }
    // Most endpoints return an array; teams/statistics returns a single object.
    if (data == null || typeof data !== "object") {
      throw new Error("Football data service returned an invalid response.");
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Football data request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function request(endpoint, params) {
  try {
    return await requestOnce(endpoint, params);
  } catch (error) {
    // One quiet retry for transient network failures (not for API errors).
    if (error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return requestOnce(endpoint, params);
    }
    throw error;
  }
}

async function fetchFootball(endpoint, params = {}) {
  const clean = cleanParams(params);
  const key = keyOf(endpoint, clean);

  const cached = readCache(key);
  if (cached !== undefined) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const stale = staleEntry(key, endpoint);
  const promise = request(endpoint, clean)
    .then((data) => {
      writeCache(key, endpoint, data, clean);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  if (stale) {
    // Show the saved copy now; the refresh lands in the cache for next time.
    promise.catch(() => {});
    return stale.data;
  }
  return promise;
}

// API-Football's `search` fields accept letters, digits and spaces only.
export function cleanSearch(query) {
  return String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export const searchLeagues = (query) => fetchFootball("leagues", { search: cleanSearch(query) });
export const searchTeams = (query) => fetchFootball("teams", { search: cleanSearch(query) });
// Name search across all players (profiles only: no league needed, unlike the stats endpoint).
export const searchPlayers = (query) => fetchFootball("players/profiles", { search: cleanSearch(query) });
export const searchVenues = (query) => fetchFootball("venues", { search: cleanSearch(query) });

export const getLeagueById = (id) => fetchFootball("leagues", { id });
export const getTeamById = (id) => fetchFootball("teams", { id });
export const getVenueById = (id) => fetchFootball("venues", { id });
export const getPlayerById = (id, season) => fetchFootball("players", { id, season });

// A player may have no record for the newest season yet (start of a season, or
// a calendar-year league in Jan-Jul), so fall back one season.
export async function getPlayerProfile(id) {
  const year = new Date().getFullYear();
  for (const season of [year, year - 1]) {
    const rows = await getPlayerById(id, season);
    if (rows[0]) return rows[0];
  }
  return null;
}

export const getStandings = (leagueId, season, teamId = null) =>
  fetchFootball("standings", { league: leagueId, season, team: teamId });
export const getUpcomingFixtures = (leagueId, season, count = 8) =>
  fetchFootball("fixtures", { league: leagueId, season, next: count, timezone: userTimezone() });
export const getTeamFixtures = (teamId, options = {}) => fetchFootball("fixtures", { team: teamId, timezone: userTimezone(), ...options });
export const getTeamSquad = (teamId) => fetchFootball("players/squads", { team: teamId });
export const getTopScorers = (leagueId, season) => fetchFootball("players/topscorers", { league: leagueId, season });
export const getTopAssists = (leagueId, season) => fetchFootball("players/topassists", { league: leagueId, season });
export const getTopYellowCards = (leagueId, season) => fetchFootball("players/topyellowcards", { league: leagueId, season });
export const getTopRedCards = (leagueId, season) => fetchFootball("players/topredcards", { league: leagueId, season });
// Note: this endpoint answers with a single object, not an array.
export const getTeamStatistics = (team, league, season) => fetchFootball("teams/statistics", { team, league, season });
export const getHeadToHead = (home, away, last = 5) => fetchFootball("fixtures/headtohead", { h2h: home + "-" + away, last });
export const getTeamLeagues = (team) => fetchFootball("leagues", { team, current: "true" });
// Season selection for clubs: the seasons a club has data for, the competitions
// it played in a given season, and that season's full fixture list.
export const getTeamSeasons = (team) => fetchFootball("teams/seasons", { team });
export const getTeamLeaguesForSeason = (team, season) => fetchFootball("leagues", { team, season });
export const getTeamSeasonFixtures = (team, season) => fetchFootball("fixtures", { team, season, timezone: userTimezone() });

// Richer entity pages ------------------------------------------------------
export const getCoach = (team) => fetchFootball("coachs", { team });
// Seasons for which the provider has this player (array of years).
export const getPlayerSeasons = (player) => fetchFootball("players/seasons", { player });
export const getPlayerTrophies = (player) => fetchFootball("trophies", { player });
export const getPlayerTransfers = (player) => fetchFootball("transfers", { player });
export const getVenueTeams = (venue) => fetchFootball("teams", { venue });
export const getVenueFixtures = (venue, options = {}) => fetchFootball("fixtures", { venue, timezone: userTimezone(), ...options });
export const getLeagueTeams = (league, season) => fetchFootball("teams", { league, season });
export const getLeagueFixtures = (league, season, options = {}) =>
  fetchFootball("fixtures", { league, season, timezone: userTimezone(), ...options });

// Fixtures. Passing the browser timezone makes "date" mean the user's local day.
export const getFixturesByDate = (date) => fetchFootball("fixtures", { date, timezone: userTimezone() });
export const peekFixturesByDate = (date) => peekFootball("fixtures", { date, timezone: userTimezone() });
export const getFixtureById = (id) => fetchFootball("fixtures", { id, timezone: userTimezone() });
export const getFixtureEvents = (fixture) => fetchFootball("fixtures/events", { fixture });
export const getFixtureLineups = (fixture) => fetchFootball("fixtures/lineups", { fixture });
export const getFixtureStatistics = (fixture) => fetchFootball("fixtures/statistics", { fixture });
// Per-player match stats; each entry carries games.rating (a string like "7.3", or null).
export const getFixturePlayers = (fixture) => fetchFootball("fixtures/players", { fixture });
export const getFixtureOdds = (fixture) => fetchFootball("odds", { fixture });

// Rounds of a competition, oldest first ("Regular Season - 12", "Round of 16"...).
export const getLeagueRounds = (league, season) => fetchFootball("fixtures/rounds", { league, season });
export const getCurrentRound = (league, season) => fetchFootball("fixtures/rounds", { league, season, current: "true" });

// The API accepts up to 20 ids per call, dash-separated.
export async function getFixturesByIds(ids) {
  const unique = [...new Set(ids)];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 20) chunks.push(unique.slice(i, i + 20));
  const results = await Promise.all(
    chunks.map((chunk) => fetchFootball("fixtures", { ids: chunk.join("-"), timezone: userTimezone() }))
  );
  return results.flat();
}

// Flattens API-Football's odds payload into one row per bookmaker for the
// "Match Winner" market: [{ book, h, d, a }].
export function oddsRows(payload) {
  const rows = [];
  const bookmakers = Array.isArray(payload) ? payload[0]?.bookmakers || [] : [];
  for (const bookmaker of bookmakers) {
    const bet = (bookmaker.bets || []).find((b) => b.id === 1 || /match winner/i.test(b.name || ""));
    if (!bet) continue;
    const pick = (label) => Number((bet.values || []).find((v) => v.value === label)?.odd);
    const row = { book: bookmaker.name, h: pick("Home"), d: pick("Draw"), a: pick("Away") };
    if ([row.h, row.d, row.a].some(Number.isFinite)) rows.push(row);
  }
  return rows;
}
