/*********************
 * LEAGUES PAGE
 *********************/

let LEAGUES_DATA = null;
let LEAGUES_PAGE_BOUND = false;

async function getLeaguesData() {
  if (LEAGUES_DATA) return LEAGUES_DATA;
  
  const res = await fetch("/assets/data/leagues.json");
  if (!res.ok) throw new Error("Unable to load leagues.json");
  
  LEAGUES_DATA = await res.json();
  return LEAGUES_DATA;
}

function leagueCardHTML(league) {
  return `
        <div class="league-card">
            <a class="league-link" href="#">
                <img src="${league.icon}" alt="${league.name}">
                <span>${league.name}</span>
                <button class="add-league-to-favs" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24">
                        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m12.495 18.587l4.092 2.15a1.044 1.044 0 0 0 1.514-1.106l-.783-4.552a1.045 1.045 0 0 1 .303-.929l3.31-3.226a1.043 1.043 0 0 0-.575-1.785l-4.572-.657A1.044 1.044 0 0 1 15 7.907l-2.088-4.175a1.044 1.044 0 0 0-1.88 0L8.947 7.907a1.044 1.044 0 0 1-.783.575l-4.51.657a1.044 1.044 0 0 0-.584 1.785l3.309 3.226a1.044 1.044 0 0 1 .303.93l-.783 4.55a1.044 1.044 0 0 0 1.513 1.107l4.093-2.15a1.043 1.044 0 0 1 .991 0"/>
                    </svg>
                </button>
            </a>
        </div>
    `;
}

async function renderLeagueList(wrap) {
  const list = wrap.querySelector(".league-list");
  if (!list) return;
  
  if (wrap.dataset.loaded === "true") return;
  
  list.innerHTML = `
        <div class="page-loader">
            Loading...
        </div>
    `;
  
  try {
    const data = await getLeaguesData();
    const code = wrap.dataset.country;
    
    const country = data.countries.find(c => c.code === code);
    
    if (!country) {
      list.innerHTML = `<div class="league-card">No leagues found.</div>`;
      return;
    }
    
    list.innerHTML = country.leagues.map(leagueCardHTML).join("");
    wrap.dataset.loaded = "true";
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="league-card">Failed to load leagues.</div>`;
  }
}

function initLeaguesPage() {
  const search = document.querySelector(".js-search");
  const wraps = document.querySelectorAll(".league-wrap");
  
  if (!search || !wraps.length) return;
  
  // Prevent duplicate setup in SPA
  if (LEAGUES_PAGE_BOUND) return;
  LEAGUES_PAGE_BOUND = true;
  
  const normalize = (text) =>
    text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  
  // Delegated click: works even if page HTML is injected later
  document.addEventListener("click", async (e) => {
    const header = e.target.closest(".league-header-leagues-page");
    if (!header) return;
    
    const wrap = header.closest(".league-wrap");
    if (!wrap) return;
    
    wrap.classList.toggle("active");
    
    if (wrap.classList.contains("active")) {
      await renderLeagueList(wrap);
    }
  });
  
  // Search
  search.addEventListener("input", () => {
    const query = normalize(search.value.trim());
    
    document.querySelectorAll(".league-wrap").forEach(wrap => {
      const titleEl = wrap.querySelector(".league-title span");
      const countryName = titleEl ? normalize(titleEl.textContent) : "";
      
      const cards = wrap.querySelectorAll(".league-card");
      let hasMatch = query === "" || countryName.includes(query);
      
      cards.forEach(card => {
        const leagueEl = card.querySelector(".league-link span");
        const leagueName = leagueEl ? normalize(leagueEl.textContent) : "";
        
        const match =
          query === "" ||
          countryName.includes(query) ||
          leagueName.includes(query);
        
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

// Run on first load
initLeaguesPage();

// Run again after SPA page swap
document.addEventListener("pageLoaded", initLeaguesPage);