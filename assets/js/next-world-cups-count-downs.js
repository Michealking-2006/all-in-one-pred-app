let countdownInterval;

async function startWorldCupCountdown() {
  clearInterval(countdownInterval);
  
  const container = document.getElementById("world-cup-countdown");
  if (!container) return;
  
  try {
    const response = await fetch("./assets/data/next-world-cups-count-downs.json");
    
    if (!response.ok) {
      throw new Error("Unable to load World Cup data.");
    }
    
    const tournaments = await response.json();
    
    tournaments.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    function updateCountdown() {
      const now = new Date();
      
      // Live tournament
      let tournament = tournaments.find(t => {
        return now >= new Date(t.start) &&
          now <= new Date(t.end);
      });
      
      // Next tournament
      if (!tournament) {
        tournament = tournaments.find(t => {
          return now < new Date(t.start);
        });
      }
      
      if (!tournament) {
        container.innerHTML = `
                    <div class="wc-card">
                        <h3>No upcoming World Cup</h3>
                    </div>
                `;
        return;
      }
      
      const start = new Date(tournament.start);
      const end = new Date(tournament.end);
      
      const live = now >= start && now <= end;
      const diff = live ? end - now : start - now;
      
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      container.innerHTML = `
                <div class="wc-card">

                    <small>${tournament.type}</small>

                    <h2>${tournament.year}</h2>

                    <h3>${tournament.name}</h3>

                    <p>🌍 <strong>Host:</strong> ${tournament.host}</p>

                    ${
                        live
                        ? `
                            <span class="wc-live">🔴 LIVE</span>

                            <h1>${days}d ${hours}h ${minutes}m ${seconds}s</h1>

                            <small>Remaining until the tournament ends</small>
                        `
                        : `
                            <h1>${days}d ${hours}h ${minutes}m ${seconds}s</h1>

                            <small>Until Kick-off ⚽</small>
                        `
                    }

                </div>
            `;
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
    
  } catch (err) {
    console.error(err);
    
    container.innerHTML = `
            <div class="wc-card">
                Failed to load World Cup data.
            </div>
        `;
  }
}

function stopWorldCupCountdown() {
  clearInterval(countdownInterval);
}