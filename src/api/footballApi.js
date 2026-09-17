// Calls api-sports.io through corsproxy.io, since api-sports.io does not
// send Access-Control-Allow-Origin for browser requests — that blocks the
// browser from reading the response even though the request itself
// succeeds server-side (this is why curl works fine but the browser shows
// nothing: curl doesn't enforce CORS, only browsers do). corsproxy.io
// forwards the x-apisports-key header through to the real destination, so
// this needs zero backend code of any kind — just a different URL.
import { FOOTBALL_API_KEY } from "./config.js";

const BASE_URL = "https://v3.football.api-sports.io";
const CORS_PROXY = "https://corsproxy.io/?url=";

async function fetchFootball(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const targetUrl = `${BASE_URL}/${endpoint}${query ? `?${query}` : ""}`;
  const res = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`, {
    headers: { "x-apisports-key": FOOTBALL_API_KEY },
  });
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
