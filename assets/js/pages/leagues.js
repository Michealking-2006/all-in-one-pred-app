/*********************
 * LEAGUES PAGE
 *********************/

(() => {
  "use strict";

  if (window.__scoutwaveLeaguesInstalled) return;
  window.__scoutwaveLeaguesInstalled = true;

  let LEAGUES_DATA = null;
  let LEAGUES_FETCH = null;

  let LEAGUES_PAGE = {
    active: false,
    controller: null,
  };

/*----------------------------------
Helpers
----------------------------------*/
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function escapeHTML(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentPath() {
  try {
    return window.router?.getCurrentPath?.() || location.pathname;
  } catch {
    return location.pathname;
  }
}

/*----------------------------------
Load live league data (once, cached in memory for the session)
----------------------------------*/
async function getLeaguesData({ force = false } = {}) {
  if (LEAGUES_DATA && !force) return LEAGUES_DATA;
  if (LEAGUES_FETCH && !force) return LEAGUES_FETCH;

  LEAGUES_FETCH = (async () => {
    const response = await fetch("/api/leagues/list", {
      headers: { Accept: "application/json" },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Unable to load leagues");
    }

    LEAGUES_DATA = data;
    return data;
  })();

  try {
    return await LEAGUES_FETCH;
  } finally {
    LEAGUES_FETCH = null;
  }
}

/*----------------------------------
Card templates
----------------------------------*/
function favouriteButtonHTML() {
  return `
    <button class="add-league-to-favs" type="button" data-favourite-star aria-label="Add to favourites" aria-pressed="false">
      <svg xmlns="http://www.w3.org/2000/svg"
        width="200"
        height="200"
        viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="m12.495 18.587l4.092 2.15a1.044 1.044 0 0 0 1.514-1.106l-.783-4.552a1.045 1.045 0 0 1 .303-.929l3.31-3.226a1.043 1.043 0 0 0-.575-1.785l-4.572-.657A1.044 1.044 0 0 1 15 7.907l-2.088-4.175a1.044 1.044 0 0 0-1.88 0L8.947 7.907a1.044 1.044 0 0 1-.783.575l-4.51.657a1.044 1.044 0 0 0-.584 1.785l3.309 3.226a1.044 1.044 0 0 1 .303.93l-.783 4.55a1.044 1.044 0 0 0 1.513 1.107l4.093-2.15a1.043 1.044 0 0 1 .991 0"/>
      </svg>
    </button>
  `;
}

function leagueCardHTML(league, countryName) {
  return `
    <div
      class="league-card"
      data-league-id="${escapeHTML(league.id)}"
      data-league-name="${escapeHTML(league.name)}"
      data-league-slug="${escapeHTML(league.slug)}"
      data-league-logo="${escapeHTML(league.logo)}"
      data-league-country="${escapeHTML(countryName)}"
    >
      <a class="league-link" href="/${encodeURIComponent(league.slug)}" data-link>
        <img src="${escapeHTML(league.logo)}" alt="${escapeHTML(league.name)}" loading="lazy">
        <span>${escapeHTML(league.name)}</span>
        ${favouriteButtonHTML()}
      </a>
    </div>
  `;
}

function countryWrapHTML(country) {
  return `
    <div class="league-wrap" data-country="${escapeHTML(country.name)}">
      <button class="league-header-leagues-page" type="button">
        <img class="league-img-head" src="${escapeHTML(country.flag || "")}" alt="" loading="lazy">
        <span class="league-title"><span>${escapeHTML(country.name)}</span></span>
        <svg class="league-chevron" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9l6 6l6-6"/>
        </svg>
      </button>
      <div class="league-list">
        ${country.leagues.map((league) => leagueCardHTML(league, country.name)).join("")}
      </div>
    </div>
  `;
}

function popularCardHTML(league) {
  return `
    <a href="/${encodeURIComponent(league.slug)}" class="leagues-popular-card" data-link>
      <img src="${escapeHTML(league.logo)}" alt="" loading="lazy">
      <span>${escapeHTML(league.name)}</span>
    </a>
  `;
}

/*----------------------------------
Favourites (star buttons on each league card)
----------------------------------*/
async function toggleFavouriteStar(button) {
  if (!window.FavouritesStore) return;

  const card = button.closest(".league-card");
  if (!card) return;

  const id = card.getAttribute("data-league-id");
  const meta = {
    name: card.getAttribute("data-league-name"),
    slug: card.getAttribute("data-league-slug"),
    image: card.getAttribute("data-league-logo"),
    subtitle: card.getAttribute("data-league-country"),
  };

  button.disabled = true;

  try {
    const active = await window.FavouritesStore.toggle("league", id, meta);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  } catch (err) {
    console.error("[Leagues] favourite toggle failed:", err);
    window.toast?.error?.(err.message || "Couldn't update favourites.");
  } finally {
    button.disabled = false;
  }
}

async function syncFavouriteStars() {
  if (!window.FavouritesStore) return;

  const cards = document.querySelectorAll(".league-card[data-league-id]");
  if (!cards.length) return;

  for (const card of cards) {
    const id = card.getAttribute("data-league-id");
    const star = card.querySelector("[data-favourite-star]");
    if (!star) continue;

    const active = await window.FavouritesStore.has("league", id);
    star.classList.toggle("active", active);
    star.setAttribute("aria-pressed", String(active));
  }
}

/*----------------------------------
Render
----------------------------------*/
function renderPopular(popular) {
  const section = document.getElementById("leaguesPopular");
  const scroll = document.getElementById("leaguesPopularScroll");
  if (!section || !scroll) return;

  if (!popular?.length) {
    section.hidden = true;
    return;
  }

  scroll.innerHTML = popular.map(popularCardHTML).join("");
  section.hidden = false;
}

function renderCountries(countries) {
  const list = document.getElementById("leagueCountryList");
  const empty = document.getElementById("leaguesEmpty");
  if (!list) return;

  if (!countries?.length) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = countries
    .filter((c) => Array.isArray(c.leagues) && c.leagues.length)
    .map(countryWrapHTML)
    .join("");
}

async function loadAndRender({ force = false } = {}) {
  const list = document.getElementById("leagueCountryList");
  const errorEl = document.getElementById("leaguesError");
  if (errorEl) errorEl.hidden = true;

  try {
    const data = await getLeaguesData({ force });
    renderPopular(data.popular);
    renderCountries(data.countries);
    applySearchFilter();
    syncFavouriteStars();
  } catch (err) {
    console.error("[Leagues] load failed:", err);
    if (list) list.innerHTML = "";
    if (errorEl) errorEl.hidden = false;
  }
}

/*----------------------------------
Search (operates on the fully-rendered DOM, so it matches every
league regardless of which country row is expanded)
----------------------------------*/
function applySearchFilter() {
  const search = document.querySelector(".js-search");
  const query = normalizeText(search?.value?.trim() || "");

  document.querySelectorAll(".league-wrap").forEach((wrap) => {
    const titleSpan = wrap.querySelector(".league-title span");
    const countryName = normalizeText(titleSpan?.textContent || "");

    const cards = wrap.querySelectorAll(".league-card");
    let hasMatch = query === "" || countryName.includes(query);

    cards.forEach((card) => {
      const leagueName = normalizeText(
        card.querySelector(".league-link span")?.textContent || ""
      );

      const match =
        query === "" ||
        leagueName.includes(query) ||
        countryName.includes(query);

      card.style.display = match ? "" : "none";
      if (match) hasMatch = true;
    });

    wrap.style.display = hasMatch ? "" : "none";

    // auto-expand a country when the query only matches its leagues,
    // so results are actually visible rather than hidden in a collapsed row
    if (query !== "" && hasMatch) {
      wrap.classList.add("active");
    } else if (query === "") {
      wrap.classList.remove("active");
    }
  });
}

/*----------------------------------
Cleanup
----------------------------------*/
function destroyLeaguesPage() {
  if (!LEAGUES_PAGE.active) return;

  LEAGUES_PAGE.controller?.abort();
  LEAGUES_PAGE.controller = null;
  LEAGUES_PAGE.active = false;
}

/*----------------------------------
Init
----------------------------------*/
function initLeaguesPage() {
  if (LEAGUES_PAGE.active) return;

  const search = document.querySelector(".js-search");
  const list = document.getElementById("leagueCountryList");

  if (!search || !list) return;

  destroyLeaguesPage();

  LEAGUES_PAGE.active = true;
  LEAGUES_PAGE.controller = new AbortController();

  const { signal } = LEAGUES_PAGE.controller;

  /*--------------------------
  Expand / collapse (event delegation, works for dynamically
  rendered rows too)
  --------------------------*/
  document.addEventListener(
    "click",
    (e) => {
      const header = e.target.closest(".league-header-leagues-page");
      if (header) {
        const currentWrap = header.closest(".league-wrap");
        if (!currentWrap) return;

        const opening = !currentWrap.classList.contains("active");

        document.querySelectorAll(".league-wrap.active").forEach((wrap) => {
          if (wrap !== currentWrap) wrap.classList.remove("active");
        });

        currentWrap.classList.toggle("active", opening);
        return;
      }

      const retry = e.target.closest("#leaguesRetry");
      if (retry) loadAndRender({ force: true });

      const star = e.target.closest("[data-favourite-star]");
      if (star) {
        e.preventDefault();
        e.stopPropagation();
        toggleFavouriteStar(star);
      }
    },
    { signal }
  );

  /*--------------------------
  Search
  --------------------------*/
  search.addEventListener("input", applySearchFilter, { signal });

  document.addEventListener(
    "scoutwave:favourites-changed",
    syncFavouriteStars,
    { signal }
  );

  loadAndRender();
}

/*----------------------------------
Page lifecycle integration
----------------------------------*/
function handlePageLifecycle(e) {
  if ((e?.detail?.path || getCurrentPath()) === "/leagues") {
    initLeaguesPage();
  } else {
    destroyLeaguesPage();
  }
}

document.addEventListener("pageLoaded", handlePageLifecycle);
document.addEventListener("pageRefreshed", handlePageLifecycle);

/* Boot immediately if this script loads while already on leagues page */
if (getCurrentPath() === "/leagues") {
  queueMicrotask(initLeaguesPage);
}

/* Optional router registry */
window.router?.registerPage?.("LeaguesPage", {
  init: initLeaguesPage,
  destroy: destroyLeaguesPage,
});
})();
