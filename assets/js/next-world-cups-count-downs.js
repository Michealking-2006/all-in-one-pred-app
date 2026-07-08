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

                <small>${tournament.type}</small>

                <h2>${tournament.year}</h2>

                <h3>${tournament.name}</h3>

                <p><strong>Host:</strong> ${tournament.host}</p>

                ${
                    live
                    ? `
                        <span class="wc-live">LIVE</span>

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