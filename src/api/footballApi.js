import { FOOTBALL_API_KEY } from "./config.js";

const BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 12000;

async function fetchFootball(endpoint, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    query.set(key, String(value));
  }

  const url = `${BASE_URL}/${endpoint}${query.toString() ? `?${query.toString()}` : ""}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": FOOTBALL_API_KEY,
      },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const providerErrors = data?.errors;
      const providerMessage =
        typeof providerErrors === "string"
          ? providerErrors
          : providerErrors && typeof providerErrors === "object"
            ? Object.values(providerErrors).flat().join("; ")
            : "";

      throw new Error(
        providerMessage ||
        data?.message ||
        `Football data request failed (${res.status})`
      );
    }

    if (data?.errors && Object.keys(data.errors).length) {
      const message = Object.values(data.errors).flat().join("; ");
      throw new Error(message || "Football API returned an error.");
    }

    if (!Array.isArray(data?.response)) {
      throw new Error("Football API returned an invalid response.");
    }

    return data.response;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Football data request timed out. Please try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function searchLeagues(query) {
  return fetchFootball("leagues", { search: query });
}

export function searchTeams(query) {
  return fetchFootball("teams", { search: query });
}

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
