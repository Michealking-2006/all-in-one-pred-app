/************** FAVOURITES PAGE **************/

function initFavouritePage() {
  
  const favouritesBtn = document.getElementById("appProfileFavouritesBtn");
  const wrapper = document.getElementById("favouritesContainer");
  
  /* Profile button */
  
  if (favouritesBtn && !favouritesBtn.dataset.initialized) {
    
    favouritesBtn.dataset.initialized = "true";
    
    favouritesBtn.addEventListener("click", () => {
      
      if (typeof navigate === "function") {
        navigate("/favourites");
      } else {
        location.href = "/favourites";
      }
      
    });
    
  }
  
  if (!wrapper) return;
  
  const favourites = getLeagueFavourites();
  
  if (!favourites.length) {
    
    wrapper.innerHTML = `
            <div class="empty-state">
                No favourite leagues yet.
            </div>
        `;
    
    return;
    
  }
  
  wrapper.innerHTML = favourites.map(item => `
        <button
            class="favourite-league-card"
            data-id="${item.id}"
            data-slug="${item.slug}"
            data-name="${item.name}"
            data-country="${item.country}"
            data-logo="${item.logo}">

            <img
                src="${item.logo}"
                alt="${item.name}"
                loading="lazy">

            <div class="favourite-league-info">
                <strong>${item.name}</strong>
                <small>${item.country}</small>
            </div>

        </button>
    `).join("");
  
}


/************** FAVOURITES NAVIGATION **************/

function initFavouriteNavigation() {
  
  if (document.body.dataset.favouriteNavigationBound) return;
  
  document.body.dataset.favouriteNavigationBound = "true";
  
  document.addEventListener("click", e => {
    
    const card = e.target.closest(".favourite-league-card");
    
    if (!card) return;
    
    const league = {
      id: Number(card.dataset.id),
      slug: card.dataset.slug,
      name: card.dataset.name,
      country: {
        name: card.dataset.country
      },
      league: {
        id: Number(card.dataset.id),
        name: card.dataset.name,
        logo: card.dataset.logo
      },
      icon: card.dataset.logo
    };
    
    sessionStorage.setItem(
      "selectedLeaguePage",
      JSON.stringify(league)
    );
    
    sessionStorage.setItem(
      "selectedLeague",
      JSON.stringify(league)
    );
    
    window.__leaguePageData = league;
    
    if (typeof navigate === "function") {
      
      navigate(`/league-page/${league.slug}`);
      
    } else {
      
      location.href = `/league-page/${league.slug}`;
      
    }
    
  });
  
}


/************** AUTO REFRESH **************/

window.addEventListener(
  "leagueFavouriteChanged",
  initFavouritePage
);


/************** SPA BOOT **************/

function initFavouritesUI() {
  
  initFavouritePage();
  initFavouriteNavigation();
  
}

document.addEventListener(
  "pageLoaded",
  initFavouritesUI
);

initFavouritesUI();