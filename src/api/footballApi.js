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
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        data?.error ||
        data?.details ||
        `Football data request failed (${res.status})`;

      throw new Error(
        typeof message === "string"
          ? message
          : "Football data request failed."
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        data?.error ||
        "Football data service returned an invalid response."
      );
    }

    return data;
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
