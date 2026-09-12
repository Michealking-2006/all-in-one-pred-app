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

// API-Football's /players endpoint requires `league` or `team` alongside
// `search` (confirmed against their docs) — a bare free-text player search
// across all of football isn't something this API supports. Passing just
// `search` will always return an empty result set, not an error, so this
// stayed silently broken. Leaving the wrapper here for when a league/team
// context is available (e.g. searching within a club's squad), but it's
// deliberately NOT wired into the global multi-entity SearchScreen below.
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

export function getTopScorers(leagueId, season) {
  return fetchFootball("players/topscorers", { league: leagueId, season });
}

export function getTeamSquad(teamId, season = new Date().getFullYear()) {
  return fetchFootball("players", { team: teamId, season });
}

export function getTeamFixtures(teamId, { last, next } = { last: 5 }) {
  const params = { team: teamId };
  if (last) params.last = last;
  if (next) params.next = next;
  return fetchFootball("fixtures", params);
}
