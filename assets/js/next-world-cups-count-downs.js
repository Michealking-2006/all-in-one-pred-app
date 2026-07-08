let worldCupCountdownInterval = null;
let worldCupData = null;

async function startWorldCupCountdown() {
  
  // Stop previous countdown
  if (worldCupCountdownInterval) {
    clearInterval(worldCupCountdownInterval);
    worldCupCountdownInterval = null;
  }
  
  // Load JSON once
  if (!worldCupData) {
    try {
      const res = await fetch("/assets/data/next-world-cups-count-downs.json");
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      worldCupData = await res.json();
      
      worldCupData.sort((a, b) => (
        new Date(a.start) - new Date(b.start)
      ));
      
    } catch (err) {
      console.error("World Cup JSON:", err);
      return;
    }
  }
  
  function update() {
    
    const container = document.getElementById("world-cup-countdown");
    
    // Page not mounted yet
    if (!container) return;
    
    const now = Date.now();
    
    // Find live tournament
    let tournament = worldCupData.find(t => {
      const start = new Date(t.start).getTime();
      const end = new Date(t.end).getTime();
      
      return now >= start && now <= end;
    });
    
    // Otherwise find next tournament
    if (!tournament) {
      tournament = worldCupData.find(t =>
        new Date(t.start).getTime() > now
      );
    }
    
    if (!tournament) {
      container.innerHTML = `
                <div class="wc-card">
                    <h3>No upcoming World Cup.</h3>
                </div>
            `;
      return;
    }
    
    const start = new Date(tournament.start).getTime();
    const end = new Date(tournament.end).getTime();
    
    const live = now >= start && now <= end;
    
    const diff = live ?
      end - now :
      start - now;
    
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff % 86400000 / 3600000);
    const minutes = Math.floor(diff % 3600000 / 60000);
    const seconds = Math.floor(diff % 60000 / 1000);
    
    container.innerHTML = `
            <div class="wc-card">

                <small class="tournament-type">${tournament.type}</small>

                <h2>${tournament.year}</h2>

                <h3>${tournament.name}</h3>

                <p class="tournament-host-countries-wc-c-p"><strong>Host:</strong> ${tournament.host}</p>

                ${
                    live
                    ? `
                        <span class="wc-live"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
    <path fill="currentColor" d="M6.343 4.938a1 1 0 0 1 0 1.415a8.003 8.003 0 0 0 0 11.317a1 1 0 1 1-1.414 1.414c-3.907-3.906-3.907-10.24 0-14.146a1 1 0 0 1 1.414 0Zm12.732 0c3.906 3.907 3.906 10.24 0 14.146a1 1 0 0 1-1.415-1.414a8.003 8.003 0 0 0 0-11.317a1 1 0 0 1 1.415-1.415ZM9.31 7.812a1 1 0 0 1 0 1.414a3.92 3.92 0 0 0 0 5.544a1 1 0 1 1-1.415 1.414a5.92 5.92 0 0 1 0-8.372a1 1 0 0 1 1.415 0Zm6.958 0a5.92 5.92 0 0 1 0 8.372a1 1 0 0 1-1.414-1.414a3.92 3.92 0 0 0 0-5.544a1 1 0 0 1 1.414-1.414Zm-4.186 2.77a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z"/>
</svg> LIVE</span>

                        <h1>${days}d ${hours}h ${minutes}m ${seconds}s</h1>

                        <small>Remaining until the tournament ends</small>
                    `
                    : `
                        <h1>${days}d ${hours}h ${minutes}m ${seconds}s</h1>

                        <small>Until kick-off ⚽</small>
                    `
                }

            </div>
        `;
  }
  
  update();
  
  worldCupCountdownInterval = setInterval(update, 1000);
}

function stopWorldCupCountdown() {
  clearInterval(worldCupCountdownInterval);
  worldCupCountdownInterval = null;
}

/* Auto start */
startWorldCupCountdown();