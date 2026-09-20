import { userTimezone } from "../utils/fixtures.js";

const BASE_URL = "/api/football";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_CACHE_ENTRIES = 300;

// ---------------------------------------------------------------------------
// Cache. Every store change re-renders the app, and screens fetch while they
// build, so without this a single tap can burn several API-Football requests.
// Fresh entries are served instantly, identical in-flight requests are shared,
// and failures are never cached.
// ---------------------------------------------------------------------------
const TTL_MS = {
  fixtures: 30_000,
  "fixtures/events": 30_000,
  "fixtures/lineups": 30_000,
  "fixtures/statistics": 30_000,
  odds: 30_000,
  standings: 5 * 60_000,
};
const DEFAULT_TTL_MS = 10 * 60_000;

const cache = new Map();
const inflight = new Map();

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
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache(key, endpoint, data) {
  cache.set(key, { at: Date.now(), ttl: TTL_MS[endpoint] ?? DEFAULT_TTL_MS, data });
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

// Returns cached data synchronously if it is still fresh, else undefined.
export function peekFootball(endpoint, params = {}) {
  return readCache(keyOf(endpoint, cleanParams(params)));
}

export function clearFootballCache() {
  cache.clear();
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

  const promise = request(endpoint, clean)
    .then((data) => {
      writeCache(key, endpoint, data);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
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
export const searchPlayers = (query, extraParams = {}) => fetchFootball("players", { search: cleanSearch(query), ...extraParams });
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
  fetchFootball("fixtures", { league: leagueId, season, next: count });
export const getTeamFixtures = (teamId, options = {}) => fetchFootball("fixtures", { team: teamId, ...options });
export const getTeamSquad = (teamId) => fetchFootball("players/squads", { team: teamId });
export const getTopScorers = (leagueId, season) => fetchFootball("players/topscorers", { league: leagueId, season });
export const getTopAssists = (leagueId, season) => fetchFootball("players/topassists", { league: leagueId, season });
export const getTopYellowCards = (leagueId, season) => fetchFootball("players/topyellowcards", { league: leagueId, season });
export const getTopRedCards = (leagueId, season) => fetchFootball("players/topredcards", { league: leagueId, season });
// Note: this endpoint answers with a single object, not an array.
export const getTeamStatistics = (team, league, season) => fetchFootball("teams/statistics", { team, league, season });
export const getHeadToHead = (home, away, last = 5) => fetchFootball("fixtures/headtohead", { h2h: home + "-" + away, last });
export const getTeamLeagues = (team) => fetchFootball("leagues", { team, current: "true" });

// Fixtures. Passing the browser timezone makes "date" mean the user's local day.
export const getFixturesByDate = (date) => fetchFootball("fixtures", { date, timezone: userTimezone() });
export const peekFixturesByDate = (date) => peekFootball("fixtures", { date, timezone: userTimezone() });
export const getFixtureById = (id) => fetchFootball("fixtures", { id, timezone: userTimezone() });
export const getFixtureEvents = (fixture) => fetchFootball("fixtures/events", { fixture });
export const getFixtureLineups = (fixture) => fetchFootball("fixtures/lineups", { fixture });
export const getFixtureStatistics = (fixture) => fetchFootball("fixtures/statistics", { fixture });
export const getPrediction = (fixture) => fetchFootball("predictions", { fixture });
export const getFixtureOdds = (fixture) => fetchFootball("odds", { fixture });

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
