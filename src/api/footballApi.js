const PROXY_BASE = "/api/football";

async function fetchFootball(endpoint, params = {}) {
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`${PROXY_BASE}?${query}`);
  if (!res.ok) throw new Error(`API-Football request failed (${res.status})`);
  const data = await res.json();
  return data.response || [];
}

export function searchLeagues(query) {
  return fetchFootball("leagues", { search: query });
}

export function searchTeams(query) {
  return fetchFootball("teams", { search: query });
}

// API-Football's /players endpoint requires more than free-text search alone
// (typically search + league + season, per their docs) — this is a thin
// wrapper for when that's wired up; passing just `search` may return empty
// until a league/season is added.
export function searchPlayers(query, extraParams = {}) {
  return fetchFootball("players", { search: query, ...extraParams });
}

export function searchVenues(query) {
  return fetchFootball("venues", { search: query });
}

export function getLeagueById(id) {
  return fetchFootball("leagues", { id });
}

export function getTeamById(id) {
  return fetchFootball("teams", { id });
}

export function getVenueById(id) {
  return fetchFootball("venues", { id });
}

export function getPlayerById(id, season = new Date().getFullYear()) {
  return fetchFootball("players", { id, season });
}

export function getStandings(leagueId, season) {
  return fetchFootball("standings", { league: leagueId, season });
}

export function getUpcomingFixtures(leagueId, season, count = 5) {
  return fetchFootball("fixtures", { league: leagueId, season, next: count });
}
