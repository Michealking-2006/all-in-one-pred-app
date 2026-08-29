const API = (() => {
  const BASE_URL = "/api/football";

  async function request(endpoint) {
    try {
      const response = await fetch(`${BASE_URL}?path=${encodeURIComponent(endpoint)}`, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  return {
    getStandings(league, season) {
      return request(`/standings?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getFixtures(league, season) {
      return request(`/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getLiveFixtures() {
      return request("/fixtures?live=all");
    },
    getTeams(league, season) {
      return request(`/teams?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getTopScorers(league, season) {
      return request(`/players/topscorers?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getTopAssists(league, season) {
      return request(`/players/topassists?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getLeague(league, season) {
      return request(`/leagues?id=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
    },
    getFixture(id) {
      return request(`/fixtures?id=${encodeURIComponent(id)}`);
    },
    getStatistics(fixture) {
      return request(`/fixtures/statistics?fixture=${encodeURIComponent(fixture)}`);
    },
    getEvents(fixture) {
      return request(`/fixtures/events?fixture=${encodeURIComponent(fixture)}`);
    },
    getLineups(fixture) {
      return request(`/fixtures/lineups?fixture=${encodeURIComponent(fixture)}`);
    },
  };
})();

window.API = API;
