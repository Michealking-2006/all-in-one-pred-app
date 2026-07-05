let countdownInterval;

async function startWorldCupCountdown() {
  clearInterval(countdownInterval);
  
  const container = document.getElementById("countdownResult");
  if (!container) return;
  
  try {
    const response = await fetch("/assets/data/next-world-cups-count-downs.json");
    const worldCups = await response.json();
    
    worldCups.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    function updateCountdown() {
      const now = new Date();
      
      let tournament =
        worldCups.find(wc =>
          now >= new Date(wc.start) &&
          now <= new Date(wc.end)
        ) ||
        worldCups.find(wc =>
          now < new Date(wc.start)
        );
      
      if (!tournament) {
        container.innerHTML = "No World Cup data available.";
        return;
      }
      
      const start = new Date(tournament.start);
      const end = new Date(tournament.end);
      
      // Tournament is LIVE
      if (now >= start && now <= end) {
        
        const diff = end - now;
        
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        container.innerHTML = `
                    <strong>${tournament.year} ${tournament.name}</strong><br>
                    🌍 Host: ${tournament.host}<br><br>

                    <span class="live">🔴 LIVE</span><br>

                    ${days}d ${hours}h ${minutes}m ${seconds}s remaining
                `;
        
        return;
      }
      
      // Tournament is upcoming
      const diff = start - now;
      
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      container.innerHTML = `
                <strong>${tournament.year} ${tournament.name}</strong><br>
                🌍 Host: ${tournament.host}<br><br>

                ${days}d ${hours}h ${minutes}m ${seconds}s<br>

                <small>until kickoff ⚽</small>
            `;
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
    
  } catch (err) {
    console.error(err);
    container.innerHTML = "Unable to load World Cup data.";
  }
}

function stopWorldCupCountdown() {
  clearInterval(countdownInterval);
}

// When navigating to the World Cup page
startWorldCupCountdown();
