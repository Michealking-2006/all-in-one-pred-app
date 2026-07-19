const API = (() => {
  
 // const API_KEY = "16ae25cfd4ac9abb516a105cd100ed76";
 
 const API_KEY = "accfd80c147e2ea554ec477ba2ae880a";
 
  const BASE_URL = "https://v3.football.api-sports.io";
  
  async function request(endpoint) {
    
    try {
      
      const response = await fetch(BASE_URL + endpoint, {
        method: "GET",
        headers: {
          "x-apisports-key": API_KEY
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(data);
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      return data;
      
    } catch (err) {
      console.error("API Error:", err);
      throw err;
    }
  }
  
  return {
    
    getStandings(league, season) {
      return request(`/standings?league=${league}&season=${season}`);
    },
    
    getFixtures(league, season) {
      return request(`/fixtures?league=${league}&season=${season}`);
    },
    
    getLiveFixtures() {
      return request(`/fixtures?live=all`);
    },
    
    getTeams(league, season) {
      return request(`/teams?league=${league}&season=${season}`);
    },
    
    getTopScorers(league, season) {
      return request(`/players/topscorers?league=${league}&season=${season}`);
    },
    
    getTopAssists(league, season) {
      return request(`/players/topassists?league=${league}&season=${season}`);
    },
    
    getLeague(league, season) {
      return request(`/leagues?id=${league}&season=${season}`);
    },
    
    getFixture(id) {
      return request(`/fixtures?id=${id}`);
    },
    
    getStatistics(fixture) {
      return request(`/fixtures/statistics?fixture=${fixture}`);
    },
    
    getEvents(fixture) {
      return request(`/fixtures/events?fixture=${fixture}`);
    },
    
    getLineups(fixture) {
      return request(`/fixtures/lineups?fixture=${fixture}`);
    }
    
  };
  
})();

window.API = API;