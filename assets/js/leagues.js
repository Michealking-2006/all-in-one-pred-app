/*********************
 * LEAGUES PAGE
 *********************/

function initLeaguesPage() {
  const wraps = document.querySelectorAll(".league-wrap");
  const search = document.querySelector(".js-search");
  
  // Not on the leagues page
  if (!wraps.length || !search) return;
  
  // Prevent duplicate initialization
  if (search.dataset.initialized) return;
  search.dataset.initialized = "true";
  
  // Accordion
  wraps.forEach(wrap => {
    const header = wrap.querySelector(".league-header-leagues-page");
    
    if (!header) return;
    
    header.addEventListener("click", () => {
      wrap.classList.toggle("active");
    });
  });
  
  // Normalize text for searching
  const normalize = (text) =>
    text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  
  // Search
  search.addEventListener("input", () => {
    const query = normalize(search.value.trim());
    
    wraps.forEach(wrap => {
      const title = wrap.querySelector(".league-title span");
      
      if (!title) return;
      
      const country = normalize(title.textContent);
      const cards = wrap.querySelectorAll(".league-card");
      
      let hasMatch = query === "" || country.includes(query);
      
      cards.forEach(card => {
        const leagueName = card.querySelector(".league-link span");
        
        if (!leagueName) return;
        
        const league = normalize(leagueName.textContent);
        
        const match =
          query === "" ||
          league.includes(query) ||
          country.includes(query);
        
        card.style.display = match ? "" : "none";
        
        if (match) hasMatch = true;
      });
      
      wrap.style.display = hasMatch ? "" : "none";
      
      if (query) {
        wrap.classList.toggle("active", hasMatch);
      } else {
        wrap.classList.remove("active");
      }
    });
  });
}

// Initial page load
initLeaguesPage();

// Run every time your SPA loads a page
document.addEventListener("pageLoaded", initLeaguesPage);