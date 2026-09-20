const BASE_URL = "/api/football";
const REQUEST_TIMEOUT_MS = 12000;

async function fetchFootball(endpoint, params = {}) {
  const query = new URLSearchParams({ endpoint });
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    query.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error || data?.details || `Football data request failed (${res.status})`;
      throw new Error(typeof message === "string" ? message : "Football data request failed.");
    }
    if (!Array.isArray(data)) throw new Error(data?.error || "Football data service returned an invalid response.");
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Football data request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const searchLeagues = (query) => fetchFootball("leagues", { search: query });
export const searchTeams = (query) => fetchFootball("teams", { search: query });
export const searchPlayers = (query, extraParams = {}) => fetchFootball("players", { search: query, ...extraParams });
export const searchVenues = (query) => fetchFootball("venues", { search: query });
export const getLeagueById = (id) => fetchFootball("leagues", { id });
export const getTeamById = (id) => fetchFootball("teams", { id });
export const getVenueById = (id) => fetchFootball("venues", { id });
export const getPlayerById = (id, season = new Date().getFullYear()) => fetchFootball("players", { id, season });
export const getStandings = (leagueId, season, teamId = null) => fetchFootball("standings", { league: leagueId, season, ...(teamId ? { team: teamId } : {}) });
export const getUpcomingFixtures = (leagueId, season, count = 8) => fetchFootball("fixtures", { league: leagueId, season, next: count });
export const getTeamFixtures = (teamId, options = {}) => fetchFootball("fixtures", { team: teamId, ...options });
export const getTopScorers = (leagueId, season) => fetchFootball("players/topscorers", { league: leagueId, season });
export const getTopAssists = (leagueId, season) => fetchFootball("players/topassists", { league: leagueId, season });
export const getTopYellowCards = (leagueId, season) => fetchFootball("players/topyellowcards", { league: leagueId, season });
export const getTopRedCards = (leagueId, season) => fetchFootball("players/topredcards", { league: leagueId, season });
export const getTeamStatistics = (team, league, season) => fetchFootball("teams/statistics", { team, league, season });
export const getHeadToHead = (home, away, last = 5) => fetchFootball("fixtures/headtohead", { h2h: `${home}-${away}`, last });
export const getPrediction = (fixture) => fetchFootball("predictions", { fixture });
export const getTeamLeagues = (team) => fetchFootball("leagues", { team, current: true });

export function getFixturesByDate(date) { return fetchFootball("fixtures", { date }); }
