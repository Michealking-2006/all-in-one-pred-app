(() => {
  "use strict";

  const root = document.querySelector('[data-page="leagues"]');
  if (!root) return;

  const searchInput = root.querySelector("#leagues-search-input");
  const featuredRoot = root.querySelector("#featured-leagues");
  const countriesRoot = root.querySelector("#league-countries");
  const FEATURED_NAMES = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"];
  let leagues = [];
  let destroyed = false;

  function slugify(value) {
    const slug = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug === "la-liga" ? "laliga" : slug;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderFeatured(items) {
    if (!items.length) {
      featuredRoot.innerHTML = "";
      return;
    }
    featuredRoot.innerHTML = items.map(league => `
      <a class="league-card" href="/${slugify(league.name)}">
        <span class="league-card-logo">${league.logo ? `<img src="${escapeHtml(league.logo)}" alt="" loading="lazy">` : ""}</span>
        <span class="league-card-copy"><strong>${escapeHtml(league.name)}</strong><small>${escapeHtml(league.country)}</small></span>
      </a>
    `).join("");
  }

  function renderCountries(items, query) {
    const grouped = new Map();
    const normalizedQuery = query.trim().toLowerCase();
    items.forEach(league => {
      const haystack = `${league.name} ${league.country}`.toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) return;
      if (!grouped.has(league.country)) grouped.set(league.country, []);
      grouped.get(league.country).push(league);
    });

    if (!grouped.size) {
      countriesRoot.innerHTML = '<div class="leagues-empty">No leagues found.</div>';
      return;
    }

    countriesRoot.innerHTML = [...grouped.entries()].map(([country, countryLeagues]) => `
      <details class="country-group" open>
        <summary class="country-group-summary">
          <span class="country-identity">${countryLeagues[0]?.flag ? `<img src="${escapeHtml(countryLeagues[0].flag)}" alt="" loading="lazy">` : ""}<strong>${escapeHtml(country)}</strong></span>
          <span class="country-count">${countryLeagues.length}</span>
        </summary>
        <div class="country-leagues">
          ${countryLeagues.map(league => `
            <a class="league-row" href="/${slugify(league.name)}">
              <span class="league-row-logo">${league.logo ? `<img src="${escapeHtml(league.logo)}" alt="" loading="lazy">` : ""}</span>
              <span class="league-row-name">${escapeHtml(league.name)}</span>
              <span class="league-row-arrow" aria-hidden="true">›</span>
            </a>
          `).join("")}
        </div>
      </details>
    `).join("");
  }

  function render() {
    if (destroyed) return;
    const query = searchInput?.value || "";
    renderFeatured(query.trim() ? [] : leagues.filter(league => FEATURED_NAMES.includes(league.name)));
    renderCountries(leagues, query);
  }

  async function load() {
    featuredRoot.innerHTML = '<div class="leagues-loading">Loading leagues…</div>';
    countriesRoot.innerHTML = "";
    try {
      const response = await fetch("/api/leagues", { headers: { accept: "application/json" }, cache: "default" });
      if (!response.ok) throw new Error(`Leagues HTTP ${response.status}`);
      const data = await response.json();
      leagues = Array.isArray(data?.leagues) ? data.leagues : [];
      render();
    } catch (error) {
      console.error("[Scoutwave] leagues load failed", error);
      featuredRoot.innerHTML = "";
      countriesRoot.innerHTML = '<div class="leagues-empty">Unable to load leagues right now.</div>';
    }
  }

  function onSearch() { render(); }
  searchInput?.addEventListener("input", onSearch);
  load();

  window.__scoutwaveLeaguesPageCleanup = () => {
    destroyed = true;
    searchInput?.removeEventListener("input", onSearch);
    window.__scoutwaveLeaguesPageCleanup = null;
  };
})();
