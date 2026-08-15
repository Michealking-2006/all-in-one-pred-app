const APP_UI = {
  controller: null,
  cleanups: []
};

function addCleanup(fn) {
  if (typeof fn === "function") {
    APP_UI.cleanups.push(fn);
  }
}

function destroyAppUI() {
  APP_UI.controller?.abort();
  APP_UI.controller = null;

  for (const cleanup of APP_UI.cleanups) {
    try {
      cleanup();
    } catch (err) {
      console.error("App UI cleanup failed:", err);
    }
  }

  APP_UI.cleanups = [];

  window.__tabsUIBound = false;

  if (window.__searchUIState) {
    window.__searchUIState.initialized = false;
    window.clearTimeout(window.__searchUIState.debounceTimer);
    window.__searchUIState.debounceTimer = null;
  }
}

/*********************
 * APP DATE UI
 *********************/

function initDateUI() {
  const dateScroll = document.getElementById("dateScroll");
  if (!dateScroll) return;

  if (dateScroll.dataset.initialized) return;
  dateScroll.dataset.initialized = "true";

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const dates = [];

  for (let i = -7; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }

  dateScroll.innerHTML = "";

  dates.forEach((date, index) => {
    const card = document.createElement("div");
    card.className = "date-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    if (index === 7) card.classList.add("active");

    const dayName = document.createElement("div");
    dayName.className = "day-name";
    dayName.textContent = index === 7 ? "Today" : DAYS[date.getDay()];

    const circle = document.createElement("div");
    circle.className = "date-circle";
    circle.textContent = date.getDate();

    card.append(dayName, circle);

    const emitSelection = () => {
      dateScroll.querySelectorAll(".date-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      const selectedDate = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        iso: new Date(date).toISOString().slice(0, 10)
      };

      window.dispatchEvent(new CustomEvent("dateSelected", { detail: selectedDate }));
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

function initTabsUI(signal) {
  if (window.__tabsUIBound) return;
  window.__tabsUIBound = true;

  const onClick = e => {
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

    pageRoot.querySelector(".tab.active")?.classList.remove("active");
    pageRoot.querySelector(".page.active")?.classList.remove("active");

    tabBtn.classList.add("active");
    targetPage?.classList.add("active");

    window.dispatchEvent(new CustomEvent("tabChanged", {
      detail: { tab: targetId }
    }));
  };

  document.addEventListener("click", onClick, { signal });

  addCleanup(() => {
    window.__tabsUIBound = false;
  });
}

/**********************
 * COOKIE CONSENT
 **********************/

function initAppUI(signal) {
  const cookieBox = document.getElementById("cookieBox");
  const cookieOverlay = document.getElementById("cookieOverlay");
  const acceptCookies = document.getElementById("acceptCookies");
  const declineCookies = document.getElementById("declineCookies");
  
  let cookieTimeout = null;
  
  if (cookieBox && cookieOverlay && acceptCookies && declineCookies && !cookieBox.dataset.initialized) {
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
      cookieTimeout = setTimeout(() => {
        if (document.body.contains(cookieBox)) {
          showCookie();
        }
      }, 5000);
    }
    
    acceptCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "true");
      hideCookie();
    }, { signal });
    
    declineCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "false");
      hideCookie();
    }, { signal });
    
    addCleanup(() => {
      if (cookieTimeout) clearTimeout(cookieTimeout);
    });
  }

  const closeNavBtn = document.querySelector(".close-nav-btn");
  const appMainProfileSec = document.querySelector(".app-main-profile-sec");
  const hamburger = document.querySelector(".app-more-nav-hamburger-menu");

  if (closeNavBtn && appMainProfileSec && hamburger && !hamburger.dataset.initialized) {
    hamburger.dataset.initialized = "true";

    hamburger.addEventListener("click", () => {
      appMainProfileSec.classList.add("active");
    }, { signal });

    closeNavBtn.addEventListener("click", () => {
      appMainProfileSec.classList.remove("active");
    }, { signal });
  }

  document.querySelectorAll(".menu-header").forEach(header => {
    if (header.dataset.initialized) return;
    header.dataset.initialized = "true";

    header.addEventListener("click", () => {
      header.parentElement?.classList.toggle("active");
    }, { signal });
  });
}

/*******
   SEARCH DRAWER
******/

function initSearchUI(signal) {
  const CONFIG = {
    resultBasePath: "/league-page/",
    debounceMs: 220,
    maxResults: 40,
    recentLimit: 8,
    searchFiles: {
      leagues: "/assets/data/leagues.json",
      clubs: "/assets/data/football-clubs.json",
      players: "/assets/data/football-players.json",
      matches: "/assets/data/football-matches.json",
      teams: "/assets/data/national-teams.json",
      venues: "/assets/data/football-venues.json"
    },
    storageKeys: {
      recent: "app_recent_searches"
    }
  };

  const state = window.__searchUIState || {
    initialized: false,
    activeType: "all",
    rawQuery: "",
    normalizedQuery: "",
    datasets: {
      leagues: [],
      clubs: [],
      players: [],
      matches: [],
      teams: [],
      venues: []
    },
    loadingPromise: null,
    debounceTimer: null
  };

  window.__searchUIState = state;

  const drawer = document.querySelector(".search-drawer");
  const openBtn = document.querySelector(".search-app-btn");
  const closeBtn = document.querySelector(".close-index-search-btn");
  const backdrop = document.querySelector(".search-backdrop");
  const input = document.getElementById("app-main-search-input");
  const carousel = document.querySelector(".search-filter-carousel");
  const body = document.querySelector(".search-body");

  if (!drawer || !closeBtn || !backdrop || !input || !carousel || !body) return;
  if (drawer.dataset.initialized === "true" || state.initialized) return;

  drawer.dataset.initialized = "true";
  state.initialized = true;

  const ui = ensureSearchPanels(body);

  const previousBodyOverflow = document.body.style.overflow;

  const openSearch = () => {
    drawer.classList.add("active");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";

    window.setTimeout(() => input.focus(), 0);

    if (state.normalizedQuery) {
      scheduleSearch();
    } else {
      renderIdleState();
    }
  };

  const closeSearch = () => {
    drawer.classList.remove("active");
    backdrop.classList.remove("active");
    document.body.style.overflow = previousBodyOverflow || "";
  };

  const setActiveType = type => {
    state.activeType = type || "all";

    carousel.querySelectorAll(".search-filter-chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.type === state.activeType);
    });

    scheduleSearch();
  };

  const updateOutput = text => {
    if (!ui.output) return;
    ui.output.textContent = text || "";
  };

  const renderIdleState = () => {
    ui.resultsPanel.hidden = true;
    ui.emptyState.hidden = true;
    ui.resultsBox.innerHTML = "";
    ui.resultsTitle.textContent = "";

    setSectionVisible(ui.trendingSection, true);
    setSectionVisible(ui.recentSection, true);

    updateOutput("");
    renderRecentSearches(ui.recentBox);
  };

  const scheduleSearch = () => {
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(() => {
      void runSearch();
    }, CONFIG.debounceMs);
  };

  async function runSearch() {
    const rawQuery = input.value.trim();
    const normalizedQuery = normalizeText(rawQuery);

    state.rawQuery = rawQuery;
    state.normalizedQuery = normalizedQuery;

    if (!normalizedQuery) {
      renderIdleState();
      return;
    }

    setSectionVisible(ui.trendingSection, false);
    setSectionVisible(ui.recentSection, false);

    ui.resultsPanel.hidden = false;
    ui.emptyState.hidden = true;
    ui.resultsTitle.textContent = "Results";

    updateOutput("Searching...");

    await ensureAllDataLoaded();

    const items = getItemsForActiveType(state.activeType);
    const matches = searchItems(items, normalizedQuery, state.activeType);

    if (!matches.length) {
      ui.resultsBox.innerHTML = "";
      ui.emptyState.hidden = false;
      ui.emptyState.textContent = getEmptyMessage(state.activeType, rawQuery);
      updateOutput("No results");
      return;
    }

    ui.emptyState.hidden = true;
    ui.resultsBox.innerHTML = matches
      .slice(0, CONFIG.maxResults)
      .map(item => renderResultItem(item))
      .join("");

    updateOutput(`${matches.length} result${matches.length === 1 ? "" : "s"}`);
    bindResultClicks(ui.resultsBox);
  }

  if (openBtn) openBtn.addEventListener("click", openSearch, { signal });
  closeBtn.addEventListener("click", closeSearch, { signal });
  backdrop.addEventListener("click", closeSearch, { signal });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && drawer.classList.contains("active")) {
      closeSearch();
    }
  }, { signal });

  input.addEventListener("input", scheduleSearch, { signal });

  carousel.addEventListener("click", e => {
    const chip = e.target.closest(".search-filter-chip");
    if (!chip) return;
    setActiveType(chip.dataset.type || "all");
  }, { signal });

  ui.recentBox?.addEventListener("click", e => {
    const btn = e.target.closest("[data-recent-query]");
    if (!btn) return;

    input.value = btn.dataset.recentQuery || "";
    scheduleSearch();
    input.focus();
  }, { signal });

  const activeChip =
    carousel.querySelector(".search-filter-chip.active") ||
    carousel.querySelector('.search-filter-chip[data-type="all"]');

  if (activeChip) {
    state.activeType = activeChip.dataset.type || "all";
    carousel.querySelectorAll(".search-filter-chip").forEach(chip => {
      chip.classList.toggle("active", chip === activeChip);
    });
  }

  renderRecentSearches(ui.recentBox);
  renderIdleState();
  void ensureAllDataLoaded();

  addCleanup(() => {
    state.initialized = false;
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  });

  function ensureSearchPanels(bodyEl) {
    let resultsPanel = bodyEl.querySelector(".search-results-panel");

    if (!resultsPanel) {
      resultsPanel = document.createElement("section");
      resultsPanel.className = "search-results-panel";
      resultsPanel.hidden = true;
      resultsPanel.innerHTML = `
        <h3 class="medium-header search-results-title"></h3>
        <div class="search-results-box"></div>
        <div class="search-empty-state" hidden></div>
      `;
      bodyEl.prepend(resultsPanel);
    }

    const resultsBox = resultsPanel.querySelector(".search-results-box");
    const emptyState = resultsPanel.querySelector(".search-empty-state");
    const resultsTitle = resultsPanel.querySelector(".search-results-title");

    const trendingSection =
      bodyEl.querySelector(".trending-search-wrapper")?.closest("section") ||
      bodyEl.querySelector(".trending-search-wrapper");

    const recentBox = bodyEl.querySelector(".recent-searches-box");
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
      output: bodyEl.querySelector(".app-search-output")
    };
  }

  function setSectionVisible(section, visible) {
    if (!section) return;
    section.hidden = !visible;
  }

  function getEmptyMessage(type, query) {
    if (type === "all") {
      return `No results found for “${query}”.`;
    }

    const label = {
      leagues: "league",
      clubs: "club",
      players: "player",
      matches: "match",
      teams: "national team",
      venues: "venue"
    }[type] || type;

    return `No ${label} data available for “${query}”.`;
  }

  async function ensureAllDataLoaded() {
    if (!state.loadingPromise) {
      state.loadingPromise = (async () => {
        const entries = Object.entries(CONFIG.searchFiles);

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
      return raw.map(item => normalizeGenericItem(item, type)).filter(Boolean);
    }

    if (Array.isArray(raw.items)) {
      return raw.items.map(item => normalizeGenericItem(item, type)).filter(Boolean);
    }

    if (Array.isArray(raw.data)) {
      return raw.data.map(item => normalizeGenericItem(item, type)).filter(Boolean);
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
          flag: country.flag ?? ""
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
      flag: item.flag ?? ""
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
        ...state.datasets.venues
      ];
    }

    return state.datasets[type] || [];
  }

  function searchItems(items, query, activeType) {
    const ranked = [];

    for (const item of items) {
      if (!item) continue;

      const normalizedName = normalizeText(item.name);
      const normalizedSlug = normalizeText(item.slug);
      const normalizedCountry = normalizeText(item.country);
      const normalizedCode = normalizeText(item.code);
      const normalizedType = normalizeText(item.type);
      const normalizedDivision = normalizeText(String(item.division ?? ""));
      const normalizedGender = normalizeText(item.gender);

      const combined = [
        normalizedName,
        normalizedSlug,
        normalizedCountry,
        normalizedCode,
        normalizedType,
        normalizedDivision,
        normalizedGender
      ].filter(Boolean).join(" ");

      if (!combined.includes(query)) continue;

      let score = 0;

      if (normalizedName === query) score += 1000;
      if (normalizedName.startsWith(query)) score += 900;
      if (normalizedCountry === query) score += 850;
      if (normalizedCountry.startsWith(query)) score += 800;
      if (normalizedSlug === query) score += 750;
      if (normalizedSlug.startsWith(query)) score += 700;
      if (normalizedName.includes(query)) score += 500;
      if (normalizedCountry.includes(query)) score += 450;
      if (normalizedSlug.includes(query)) score += 400;
      if (normalizedCode.includes(query)) score += 250;
      if (normalizedType.includes(query)) score += 150;
      if (activeType !== "all") score += 50;

      ranked.push({ item, score });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.item.name).localeCompare(String(b.item.name));
    });

    return ranked.map(entry => entry.item);
  }

  function renderResultItem(item) {
    const rawQuery = state.rawQuery || "";
    const idAttr = escapeHtml(String(item.id ?? ""));
    const slugAttr = escapeHtml(String(item.slug ?? ""));
    const typeAttr = escapeHtml(String(item.type ?? ""));
    const typeLabel = escapeHtml(formatTypeLabel(item.type || "league"));

    const titleHtml = highlightText(item.name || "", rawQuery);
    const countryHtml = item.country ? highlightText(item.country, rawQuery) : "";
    const divisionText =
      item.division !== "" && item.division !== null && item.division !== undefined
        ? `Division ${String(item.division)}`
        : "";
    const divisionHtml = divisionText ? highlightText(divisionText, rawQuery) : "";

    const statusTags = [];
    if (item.gender) statusTags.push(escapeHtml(String(item.gender)));
    if (item.active === true) statusTags.push("Active");
    if (item.featured === true) statusTags.push("Featured");

    const iconSrc = item.icon || item.flag || "";

    return `
      <a
        href="${CONFIG.resultBasePath}${encodeURIComponent(item.slug || "")}"
        class="search-result-item"
        data-id="${idAttr}"
        data-slug="${slugAttr}"
        data-type="${typeAttr}"
        data-name="${escapeHtml(item.name || "")}"
        data-country="${escapeHtml(item.country || "")}"
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
            <strong class="search-result-name">${titleHtml}</strong>
            <span class="search-result-type">${typeLabel}</span>
          </div>

          <div class="search-result-meta">
            ${countryHtml ? `<span>${countryHtml}</span>` : ""}
            ${divisionHtml ? `<span>${divisionHtml}</span>` : ""}
            ${statusTags.length ? `<span>${statusTags.join(" • ")}</span>` : ""}
          </div>
        </div>
      </a>
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
      venues: "Venue"
    };

    return map[type] || String(type).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  }

  function highlightText(text, query) {
    const source = String(text ?? "");
    const q = normalizeText(query);

    if (!source || !q) return escapeHtml(source);

    const { normalized, map } = buildNormalizedMap(source);
    let result = "";
    let lastSourceIndex = 0;
    let searchFrom = 0;

    while (true) {
      const matchIndex = normalized.indexOf(q, searchFrom);
      if (matchIndex === -1) break;

      const start = map[matchIndex];
      const end =
        matchIndex + q.length < map.length ? map[matchIndex + q.length] : source.length;

      result += escapeHtml(source.slice(lastSourceIndex, start));
      result += `<span class="search-highlight" style="color: var(--app-primary-color); font-weight: 700;">${escapeHtml(source.slice(start, end))}</span>`;

      lastSourceIndex = end;
      searchFrom = matchIndex + q.length;
    }

    result += escapeHtml(source.slice(lastSourceIndex));
    return result;
  }

  function buildNormalizedMap(str) {
    const source = String(str ?? "");
    let normalized = "";
    const map = [];

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!base) continue;

      for (let j = 0; j < base.length; j++) {
        normalized += base[j].toLowerCase();
        map.push(i);
      }
    }

    return { source, normalized, map };
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
    const links = container.querySelectorAll(".search-result-item");

    links.forEach(link => {
      link.addEventListener("click", () => {
        saveRecentSearch({
          id: link.dataset.id || "",
          slug: link.dataset.slug || "",
          type: link.dataset.type || "",
          name: link.dataset.name || "",
          country: link.dataset.country || ""
        });
      }, { signal });
    });
  }

  function saveRecentSearch(item) {
    if (!item?.name) return;

    const current = readRecentSearches();
    const key = `${item.type || ""}:${item.id || item.slug || item.name}`.toLowerCase();

    const next = [
      { ...item, key, ts: Date.now() },
      ...current.filter(x => x.key !== key)
    ].slice(0, CONFIG.recentLimit);

    try {
      localStorage.setItem(CONFIG.storageKeys.recent, JSON.stringify(next));
    } catch {
      return;
    }

    const recentBox = document.querySelector(".recent-searches-box");
    if (recentBox) renderRecentSearches(recentBox);
  }

  function readRecentSearches() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKeys.recent);
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
      .map(item => `
        <button
          type="button"
          class="recent-search-chip"
          data-recent-query="${escapeHtml(item.name || "")}"
        >
          <span>${escapeHtml(item.name || "")}</span>
          ${item.country ? `<small>${escapeHtml(item.country)}</small>` : ""}
        </button>
      `)
      .join("");
  }

  renderRecentSearches(ui.recentBox);
  window.initSearchUI = initSearchUI;
  window.destroySearchUI = () => {
    state.initialized = false;
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  };
}

/**********************
 * THEME + PREDICTIONS
 **********************/

function initThemeAndPredictions(signal) {
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

    themeToggle.addEventListener("change", function () {
      if (this.checked) {
        document.body.classList.add("dark-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-theme");
        localStorage.setItem("theme", "light");
      }
    }, { signal });
  }

  document.querySelectorAll(".prediction-link").forEach(link => {
    if (link.dataset.initialized) return;

    link.dataset.initialized = "true";

    link.addEventListener("click", e => {
      e.preventDefault();

      document.querySelector(".prediction-link.active")?.classList.remove("active");
      link.classList.add("active");

      const market = link.dataset.market;
      console.log(market);
    }, { signal });
  });
}

/**********************
 * app boot function
 **********************/

function bootAppUI() {
  destroyAppUI();

  const controller = new AbortController();
  APP_UI.controller = controller;

  initDateUI();
  initTabsUI(controller.signal);
  initAppUI(controller.signal);
  initSearchUI(controller.signal);
  initThemeAndPredictions(controller.signal);
}

bootAppUI();

document.addEventListener("pageLoaded", bootAppUI);
document.addEventListener("pageRefreshed", bootAppUI);
window.addEventListener("beforeunload", destroyAppUI);