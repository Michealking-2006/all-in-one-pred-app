/********************* APP DATE UI ********************/

function initDateUI() {
  const dateScroll = document.getElementById("dateScroll");
  
  // Exit if this page doesn't contain the date scroller
  if (!dateScroll) return;
  
  // Prevent duplicate initialization
  if (dateScroll.dataset.initialized) return;
  dateScroll.dataset.initialized = "true";
  
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  
  const dates = [];
  
  for (let i = -7; i <= 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  
  dateScroll.innerHTML = "";
  
  dates.forEach((date, index) => {
    const card = document.createElement("div");
    card.className = "date-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    
    if (index === 7) {
      card.classList.add("active");
    }
    
    const dayName = document.createElement("div");
    dayName.className = "day-name";
    dayName.textContent = index === 7 ? "Today" : DAYS[date.getDay()];
    
    const circle = document.createElement("div");
    circle.className = "date-circle";
    circle.textContent = date.getDate();
    
    card.append(dayName, circle);
    
    const emitSelection = () => {
      dateScroll.querySelectorAll(".date-card")
        .forEach(c => c.classList.remove("active"));
      
      card.classList.add("active");
      
      const selectedDate = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        iso: new Date(date).toISOString().slice(0, 10)
      };
      
      window.dispatchEvent(new CustomEvent("dateSelected", {
        detail: selectedDate
      }));
    };
    
    card.addEventListener("click", emitSelection);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        emitSelection();
      }
    });
    
    dateScroll.appendChild(card);
  });
  
  // Center today's card
  requestAnimationFrame(() => {
    const active = dateScroll.querySelector(".date-card.active");
    
    if (active) {
      active.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  });
}

/********************* APP TABS UI ********************/

function initTabsUI() {
  if (window.__tabsUIBound) return;
  window.__tabsUIBound = true;
  
  document.addEventListener("click", e => {
    const tabBtn = e.target.closest(".tab[data-tab]");
    if (!tabBtn) return;
    
    const tabsRoot = tabBtn.closest(".tabs");
    if (!tabsRoot) return;
    
    const pageRoot =
      tabBtn.closest(".league-page") ||
      tabBtn.closest("main") ||
      document;
    
    const targetId = tabBtn.dataset.tab;
    const targetPage = document.getElementById(targetId);
    
    // Remove active state inside the current page group
    pageRoot.querySelector(".tab.active")?.classList.remove("active");
    pageRoot.querySelector(".page.active")?.classList.remove("active");
    
    tabBtn.classList.add("active");
    targetPage?.classList.add("active");
    
    // Small hook for any page-specific tab behavior
    window.dispatchEvent(new CustomEvent("tabChanged", {
      detail: { tab: targetId }
    }));
  });
}

/**********************
 * COOKIE CONSENT
 **********************/

function initAppUI() {
  
  /* ==========================
     COOKIE CONSENT
  ========================== */
  
  const cookieBox = document.getElementById("cookieBox");
  const cookieOverlay = document.getElementById("cookieOverlay");
  const acceptCookies = document.getElementById("acceptCookies");
  const declineCookies = document.getElementById("declineCookies");
  
  if (
    cookieBox &&
    cookieOverlay &&
    acceptCookies &&
    declineCookies &&
    !cookieBox.dataset.initialized
  ) {
    cookieBox.dataset.initialized = "true";
    
    const lockPage = () => {
      document.body.classList.add("cookie-active");
      document.body.style.overflow = "hidden";
    };
    
    const unlockPage = () => {
      document.body.classList.remove("cookie-active");
      document.body.style.overflow = "";
    };
    
    const showCookie = () => {
      cookieBox.classList.add("show");
      cookieOverlay.classList.add("show");
      lockPage();
    };
    
    const hideCookie = () => {
      cookieBox.classList.remove("show");
      cookieOverlay.classList.remove("show");
      unlockPage();
    };
    
    const status = localStorage.getItem("cookiesAccepted");
    
    if (status !== "true") {
      setTimeout(() => {
        if (document.body.contains(cookieBox)) {
          showCookie();
        }
      }, 5000);
    }
    
    acceptCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "true");
      hideCookie();
    });
    
    declineCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "false");
      hideCookie();
    });
  }
  
  /* ==========================
     MORE MENU
  ========================== */
  
  const closeNavBtn = document.querySelector(".close-nav-btn");
  const appMainProfileSec = document.querySelector(".app-main-profile-sec");
  const hamburger = document.querySelector(".app-more-nav-hamburger-menu");
  
  if (
    closeNavBtn &&
    appMainProfileSec &&
    hamburger &&
    !hamburger.dataset.initialized
  ) {
    hamburger.dataset.initialized = "true";
    
    hamburger.addEventListener("click", () => {
      appMainProfileSec.classList.add("active");
    });
    
    closeNavBtn.addEventListener("click", () => {
      appMainProfileSec.classList.remove("active");
    });
  }
  
  /* ==========================
     COLLAPSIBLE MENUS
  ========================== */
  
  document.querySelectorAll(".menu-header").forEach(header => {
    if (header.dataset.initialized) return;
    
    header.dataset.initialized = "true";
    
    header.addEventListener("click", () => {
      header.parentElement?.classList.toggle("active");
    });
  });
}

/*******
   SEARCH DRAWER ******/

function initSearchUI() {  
  
const openBtn = document.querySelector(".search-app-btn");
const closeBtn = document.querySelector(".close-index-search-btn");
const drawer = document.querySelector(".search-drawer");
const backdrop = document.querySelector(".search-backdrop");
const input = document.getElementById("app-main-search-input");

if (
  openBtn &&
  closeBtn &&
  drawer &&
  backdrop &&
  !drawer.dataset.initialized
) {
  drawer.dataset.initialized = "true";
  
  function openSearch() {
    drawer.classList.add("active");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    

  }
  
  function closeSearch() {
    drawer.classList.remove("active");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  }
  
  openBtn.addEventListener("click", openSearch);
  
  closeBtn.addEventListener("click", closeSearch);
  
  backdrop.addEventListener("click", closeSearch);
  
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSearch();
    }
  });
  
}


}

(() => {
  const SEARCH_FILES = {
    leagues: "/assets/data/leagues.json",
    clubs: "/assets/data/football-clubs.json",
    players: "/assets/data/football-players.json",
    matches: "/assets/data/football-matches.json",
    teams: "/assets/data/national-teams.json",
    venues: "/assets/data/football-venues.json",
  };

  const STORAGE_KEYS = {
    recent: "app_recent_searches",
  };

  const state = {
    initialized: false,
    activeType: "all",
    query: "",
    datasets: {
      leagues: [],
      clubs: [],
      players: [],
      matches: [],
      teams: [],
      venues: [],
    },
    loadingPromise: null,
    debounceTimer: null,
  };

  function initSearchUI() {
    const drawer = document.querySelector(".search-drawer");
    const openBtn = document.querySelector(".search-app-btn");
    const closeBtn = document.querySelector(".close-index-search-btn");
    const backdrop = document.querySelector(".search-backdrop");
    const input = document.getElementById("app-main-search-input");
    const carousel = document.querySelector(".search-filter-carousel");
    const body = document.querySelector(".search-body");
    const output = document.querySelector(".app-search-output");

    if (!drawer || !closeBtn || !backdrop || !input || !carousel || !body) return;
    if (drawer.dataset.initialized === "true") return;

    drawer.dataset.initialized = "true";

    const ui = ensureSearchPanels(body);
    const prevBodyOverflow = document.body.style.overflow;

    function openSearch() {
      drawer.classList.add("active");
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";
      window.setTimeout(() => input.focus(), 0);

      if (state.query.trim()) {
        scheduleSearch();
      } else {
        renderIdleState();
      }
    }

    function closeSearch() {
      drawer.classList.remove("active");
      backdrop.classList.remove("active");
      document.body.style.overflow = prevBodyOverflow || "";
    }

    function setActiveType(type) {
      state.activeType = type || "all";

      carousel.querySelectorAll(".search-filter-chip").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.type === state.activeType);
      });

      scheduleSearch();
    }

    function renderIdleState() {
      ui.resultsPanel.hidden = true;
      ui.emptyState.hidden = true;
      ui.resultsBox.innerHTML = "";
      ui.resultsTitle.textContent = "";

      showSection(ui.trendingSection, true);
      showSection(ui.recentSection, true);

      updateOutput("");
      renderRecentSearches(ui.recentBox);
    }

    function scheduleSearch() {
      window.clearTimeout(state.debounceTimer);
      state.debounceTimer = window.setTimeout(() => {
        void runSearch();
      }, 220);
    }

    async function runSearch() {
      const query = normalizeText(input.value);
      state.query = query;

      if (!query) {
        renderIdleState();
        return;
      }

      showSection(ui.trendingSection, false);
      showSection(ui.recentSection, false);
      ui.resultsPanel.hidden = false;
      ui.emptyState.hidden = true;
      ui.resultsTitle.textContent = "Results";

      updateOutput("Searching...");

      await ensureAllDataLoaded();

      const items = getItemsForActiveType(state.activeType);
      const matches = searchItems(items, query, state.activeType);

      if (!matches.length) {
        ui.resultsBox.innerHTML = "";
        ui.emptyState.hidden = false;
        ui.emptyState.textContent = getEmptyMessage(state.activeType, query);
        updateOutput("No results");
        return;
      }

      ui.emptyState.hidden = true;
      ui.resultsBox.innerHTML = matches
        .slice(0, 40)
        .map((item) => renderResultItem(item))
        .join("");

      updateOutput(`${matches.length} result${matches.length === 1 ? "" : "s"}`);
      bindResultClicks(ui.resultsBox);
    }

    function updateOutput(text) {
      if (!output) return;
      output.textContent = text || "";
    }

    openBtn?.addEventListener("click", openSearch);
    closeBtn.addEventListener("click", closeSearch);
    backdrop.addEventListener("click", closeSearch);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("active")) {
        closeSearch();
      }
    });

    input.addEventListener("input", scheduleSearch);

    carousel.addEventListener("click", (e) => {
      const chip = e.target.closest(".search-filter-chip");
      if (!chip) return;
      setActiveType(chip.dataset.type || "all");
    });

    ui.recentBox.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recent-query]");
      if (!btn) return;
      input.value = btn.dataset.recentQuery || "";
      scheduleSearch();
      input.focus();
    });

    // Start with the active chip if one already exists
    const activeChip =
      carousel.querySelector(".search-filter-chip.active") ||
      carousel.querySelector('.search-filter-chip[data-type="all"]');

    if (activeChip) {
      state.activeType = activeChip.dataset.type || "all";
      carousel.querySelectorAll(".search-filter-chip").forEach((chip) => {
        chip.classList.toggle("active", chip === activeChip);
      });
    }

    renderRecentSearches(ui.recentBox);
    renderIdleState();
    void ensureAllDataLoaded();
  }

  function ensureSearchPanels(body) {
    let resultsPanel = body.querySelector(".search-results-panel");

    if (!resultsPanel) {
      resultsPanel = document.createElement("section");
      resultsPanel.className = "search-results-panel";
      resultsPanel.hidden = true;
      resultsPanel.innerHTML = `
        <h3 class="medium-header search-results-title"></h3>
        <div class="search-results-box"></div>
        <div class="search-empty-state" hidden></div>
      `;
      body.prepend(resultsPanel);
    }

    const resultsBox = resultsPanel.querySelector(".search-results-box");
    const emptyState = resultsPanel.querySelector(".search-empty-state");
    const resultsTitle = resultsPanel.querySelector(".search-results-title");

    const trendingSection =
      body.querySelector(".trending-search-wrapper")?.closest("section") ||
      body.querySelector(".trending-search-wrapper");

    const recentBox = body.querySelector(".recent-searches-box");
    const recentSection = recentBox?.closest("section");

    if (recentSection) recentSection.classList.add("search-recent-section");
    if (trendingSection) trendingSection.classList.add("search-trending-section");

    return {
      resultsPanel,
      resultsBox,
      emptyState,
      resultsTitle,
      trendingSection,
      recentSection,
      recentBox,
    };
  }

  function showSection(section, show) {
    if (!section) return;
    section.hidden = !show;
  }

  function getEmptyMessage(type, query) {
    const label = type === "all" ? "results" : `${pluralizeType(type)} data`;
    if (type === "all") return `No results found for “${query}”.`;
    return `No ${label} available for “${query}”.`;
  }

  function pluralizeType(type) {
    const map = {
      leagues: "leagues",
      clubs: "clubs",
      players: "players",
      matches: "matches",
      teams: "national teams",
      venues: "venues",
    };
    return map[type] || type;
  }

  async function ensureAllDataLoaded() {
    if (!state.loadingPromise) {
      state.loadingPromise = (async () => {
        const entries = Object.entries(SEARCH_FILES);
        const loaded = await Promise.all(
          entries.map(async ([type, url]) => {
            const raw = await fetchJsonSafe(url);
            return [type, normalizeDataset(type, raw)];
          })
        );

        for (const [type, items] of loaded) {
          state.datasets[type] = items;
        }
      })();
    }

    return state.loadingPromise;
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function normalizeDataset(type, raw) {
    if (!raw) return [];

    if (type === "leagues") {
      return flattenLeagues(raw);
    }

    if (Array.isArray(raw)) {
      return raw.map((item) => normalizeGenericItem(item, type)).filter(Boolean);
    }

    if (Array.isArray(raw.items)) {
      return raw.items.map((item) => normalizeGenericItem(item, type)).filter(Boolean);
    }

    if (Array.isArray(raw.data)) {
      return raw.data.map((item) => normalizeGenericItem(item, type)).filter(Boolean);
    }

    return [];
  }

  function flattenLeagues(raw) {
    const countries = Array.isArray(raw.countries) ? raw.countries : [];
    const flat = [];

    for (const country of countries) {
      const leagues = Array.isArray(country.leagues) ? country.leagues : [];
      for (const league of leagues) {
        flat.push({
          id: league.id ?? "",
          name: league.name ?? "",
          slug: league.slug ?? "",
          icon: league.icon ?? "",
          type: league.type ?? "league",
          division: league.division ?? "",
          gender: league.gender ?? "",
          active: typeof league.active === "boolean" ? league.active : null,
          featured: typeof league.featured === "boolean" ? league.featured : null,
          country: country.country ?? "",
          code: country.code ?? "",
          flag: country.flag ?? "",
        });
      }
    }

    return flat;
  }

  function normalizeGenericItem(item, fallbackType) {
    if (!item || typeof item !== "object") return null;

    return {
      id: item.id ?? item._id ?? "",
      name: item.name ?? item.title ?? item.label ?? "",
      slug: item.slug ?? item.code ?? "",
      icon: item.icon ?? item.logo ?? item.image ?? "",
      type: item.type ?? fallbackType,
      division: item.division ?? "",
      gender: item.gender ?? "",
      active: typeof item.active === "boolean" ? item.active : null,
      featured: typeof item.featured === "boolean" ? item.featured : null,
      country: item.country ?? item.nation ?? "",
      code: item.code ?? "",
      flag: item.flag ?? "",
    };
  }

  function getItemsForActiveType(type) {
    if (type === "all") {
      return [
        ...state.datasets.leagues,
        ...state.datasets.clubs,
        ...state.datasets.players,
        ...state.datasets.matches,
        ...state.datasets.teams,
        ...state.datasets.venues,
      ];
    }

    return state.datasets[type] || [];
  }

  function searchItems(items, query, activeType) {
    const q = normalizeText(query);
    if (!q) return [];

    const ranked = [];

    for (const item of items) {
      if (!item) continue;

      const haystack = {
        name: normalizeText(item.name),
        slug: normalizeText(item.slug),
        country: normalizeText(item.country),
        code: normalizeText(item.code),
        type: normalizeText(item.type),
        division: normalizeText(String(item.division ?? "")),
        gender: normalizeText(item.gender),
      };

      const combined =
        `${haystack.name} ${haystack.slug} ${haystack.country} ${haystack.code} ${haystack.type} ${haystack.division} ${haystack.gender}`.trim();

      if (!combined.includes(q)) continue;

      let score = 0;

      if (haystack.name === q) score += 1000;
      if (haystack.name.startsWith(q)) score += 900;
      if (haystack.country === q) score += 850;
      if (haystack.country.startsWith(q)) score += 800;
      if (haystack.slug === q) score += 750;
      if (haystack.slug.startsWith(q)) score += 700;
      if (haystack.name.includes(q)) score += 500;
      if (haystack.country.includes(q)) score += 450;
      if (haystack.slug.includes(q)) score += 400;
      if (haystack.code.includes(q)) score += 250;
      if (haystack.type.includes(q)) score += 150;

      if (activeType !== "all") score += 50;

      ranked.push({ item, score });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.item.name).localeCompare(String(b.item.name));
    });

    return ranked.map((entry) => entry.item);
  }

  function renderResultItem(item) {
    const title = escapeHtml(item.name || "");
    const country = escapeHtml(item.country || "");
    const typeLabel = escapeHtml(formatTypeLabel(item.type || "league"));
    const divisionLabel =
      item.division !== "" && item.division !== null && item.division !== undefined
        ? `Division ${escapeHtml(String(item.division))}`
        : "";

    const statusTags = [];
    if (item.gender) statusTags.push(escapeHtml(String(item.gender)));
    if (item.active === true) statusTags.push("Active");
    if (item.featured === true) statusTags.push("Featured");

    const iconSrc = item.icon || item.flag || "";
    const idAttr = escapeHtml(String(item.id ?? ""));
    const slugAttr = escapeHtml(String(item.slug ?? ""));
    const typeAttr = escapeHtml(String(item.type ?? ""));

    return `
      <button
        type="button"
        class="search-result-item"
        data-id="${idAttr}"
        data-slug="${slugAttr}"
        data-type="${typeAttr}"
        data-name="${title}"
        data-country="${country}"
      >
        <div class="search-result-icon-wrap">
          ${
            iconSrc
              ? `<img class="search-result-icon" src="${escapeHtml(iconSrc)}" alt="" loading="lazy">`
              : `<span class="search-result-icon-fallback">⚽</span>`
          }
        </div>

        <div class="search-result-content">
          <div class="search-result-title-row">
            <strong class="search-result-name">${title}</strong>
            <span class="search-result-type">${typeLabel}</span>
          </div>

          <div class="search-result-meta">
            ${country ? `<span>${country}</span>` : ""}
            ${divisionLabel ? `<span>${divisionLabel}</span>` : ""}
            ${statusTags.length ? `<span>${statusTags.join(" • ")}</span>` : ""}
          </div>
        </div>
      </button>
    `;
  }

  function formatTypeLabel(type) {
    const map = {
      league: "League",
      cup: "Cup",
      super_cup: "Super Cup",
      youth: "Youth",
      women: "Women",
      WOMEN: "Women",
      teams: "National Team",
      clubs: "Club",
      players: "Player",
      matches: "Match",
      venues: "Venue",
    };

    return map[type] || String(type)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function bindResultClicks(container) {
    const buttons = container.querySelectorAll(".search-result-item");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = {
          id: btn.dataset.id || "",
          slug: btn.dataset.slug || "",
          type: btn.dataset.type || "",
          name: btn.dataset.name || "",
          country: btn.dataset.country || "",
        };

        saveRecentSearch(item);
        window.dispatchEvent(new CustomEvent("search:select", { detail: item }));
      });
    });
  }

  function saveRecentSearch(item) {
    if (!item?.name) return;

    const current = readRecentSearches();
    const key = `${item.type || ""}:${item.id || item.slug || item.name}`.toLowerCase();

    const next = [
      { ...item, key, ts: Date.now() },
      ...current.filter((x) => x.key !== key),
    ].slice(0, 8);

    localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(next));

    const recentBox = document.querySelector(".recent-searches-box");
    if (recentBox) renderRecentSearches(recentBox);
  }

  function readRecentSearches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.recent);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function renderRecentSearches(container) {
    if (!container) return;

    const recent = readRecentSearches();
    if (!recent.length) {
      container.innerHTML = `
        <div class="recent-search-empty">
          No recent searches yet.
        </div>
      `;
      return;
    }

    container.innerHTML = recent
      .map(
        (item) => `
          <button
            type="button"
            class="recent-search-chip"
            data-recent-query="${escapeHtml(item.name || "")}"
          >
            <span>${escapeHtml(item.name || "")}</span>
            ${item.country ? `<small>${escapeHtml(item.country)}</small>` : ""}
          </button>
        `
      )
      .join("");
  }

  // Expose for SPA mounting
  window.initSearchUI = initSearchUI;

  // Safe auto-init on first page load if the drawer exists
  if (document.querySelector(".search-drawer")) {
    initSearchUI();
  }
})();

/**********************
  **********************/

function initThemeAndPredictions() {
  
  /***** app dark theme mode ********/
  
  const themeToggle = document.getElementById("app-theme-toggle");
  
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    if (themeToggle) themeToggle.checked = true;
  } else {
    document.body.classList.remove("dark-theme");
    if (themeToggle) themeToggle.checked = false;
  }
  
  if (themeToggle && !themeToggle.dataset.initialized) {
    themeToggle.dataset.initialized = "true";
    
    themeToggle.addEventListener("change", function() {
      if (this.checked) {
        document.body.classList.add("dark-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-theme");
        localStorage.setItem("theme", "light");
      }
    });
  }
  
  /***** prediction type select  ******/

  
  document.querySelectorAll(".prediction-link").forEach(link => {
    if (link.dataset.initialized) return;
    
    link.dataset.initialized = "true";
    
    link.addEventListener("click", e => {
      e.preventDefault();
      
      document.querySelector(".prediction-link.active")?.classList.remove("active");
      link.classList.add("active");
      
      const market = link.dataset.market;
      console.log(market);
    });
  });
}

/**********************
 * app boot function **********************/

function bootAppUI() {
  initTabsUI();
  initDateUI();
  initAppUI();
  initSearchUI();
  initThemeAndPredictions();
}

bootAppUI();

document.addEventListener("pageLoaded", bootAppUI);