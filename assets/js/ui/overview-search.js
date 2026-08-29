(() => {
  "use strict";

  const STATE = {
    initialized: false,
    controller: null,
    timer: null,
    request: 0,
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function label(type) {
    return ({
      league: "League",
      clubs: "Club",
      players: "Player",
      teams: "National Team",
      venues: "Venue",
      matches: "Match",
    })[type] || String(type || "Result").replace(/_/g, " ");
  }

  function resultHref(item) {
    const slug = encodeURIComponent(item.slug || "");
    if (!slug) return "#";
    if (item.type === "matches") return `/match/${encodeURIComponent(item.id)}`;
    if (item.type === "venues") return `/${slug}`;
    return `/${slug}`;
  }

  function render(items, query) {
    const box = document.querySelector(".search-results-box");
    const empty = document.querySelector(".search-empty-state");
    if (!box || !empty) return;

    if (!items.length) {
      box.replaceChildren();
      empty.hidden = false;
      empty.textContent = `No results found for “${query}”.`;
      return;
    }

    empty.hidden = true;
    box.innerHTML = items.map(item => {
      const icon = item.icon
        ? `<img class="search-result-icon" src="${escapeHtml(item.icon)}" alt="" loading="lazy">`
        : `<span class="search-result-icon-fallback">⚽</span>`;

      const meta = [item.country, item.city, item.venue]
        .filter(Boolean)
        .map(value => `<span>${escapeHtml(value)}</span>`)
        .join("");

      return `
        <a href="${escapeHtml(resultHref(item))}"
           class="search-result-item"
           data-search-id="${escapeHtml(item.id || "")}"
           data-search-slug="${escapeHtml(item.slug || "")}"
           data-search-type="${escapeHtml(item.type || "")}">
          <div class="search-result-icon-wrap">${icon}</div>
          <div class="search-result-content">
            <div class="search-result-title-row">
              <strong class="search-result-name">${highlight(item.name, query)}</strong>
              <span class="search-result-type">${escapeHtml(label(item.type))}</span>
            </div>
            <div class="search-result-meta">${meta}</div>
          </div>
        </a>`;
    }).join("");
  }

  function highlight(text, query) {
    const source = escapeHtml(text || "");
    const q = escapeHtml(query || "");
    if (!q) return source;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source.replace(new RegExp(`(${escaped})`, "ig"), '<span class="search-highlight">$1</span>');
  }

  function ensurePanels(body) {
    let panel = body.querySelector(".search-results-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "search-results-panel";
      panel.hidden = true;
      panel.innerHTML = `
        <h3 class="medium-header search-results-title">Results</h3>
        <div class="search-results-box"></div>
        <div class="search-empty-state" hidden></div>`;
      body.prepend(panel);
    }
    return panel;
  }

  function replaceOldSearchHandlers() {
    const drawer = document.querySelector(".search-drawer");
    const backdrop = document.querySelector(".search-backdrop");
    if (!drawer || !backdrop) return null;

    const drawerClone = drawer.cloneNode(true);
    const backdropClone = backdrop.cloneNode(true);
    drawer.replaceWith(drawerClone);
    backdrop.replaceWith(backdropClone);

    return {
      drawer: drawerClone,
      backdrop: backdropClone,
      open: document.querySelector(".search-app-btn"),
    };
  }

  async function search(query, type) {
    const requestId = ++STATE.request;
    const params = new URLSearchParams({ q: query, type });

    try {
      const response = await fetch(`/api/search?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const data = await response.json();
      if (requestId !== STATE.request) return;
      render(Array.isArray(data.results) ? data.results : [], query);
    } catch (error) {
      if (requestId !== STATE.request) return;
      const box = document.querySelector(".search-results-box");
      const empty = document.querySelector(".search-empty-state");
      if (box) box.replaceChildren();
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Search is temporarily unavailable. Please try again.";
      }
      console.error("[Scoutwave] Overview search failed:", error);
    }
  }

  function init() {
    const parts = replaceOldSearchHandlers();
    if (!parts) return;

    const { drawer, backdrop, open } = parts;
    const close = drawer.querySelector(".close-index-search-btn");
    const input = drawer.querySelector("#app-main-search-input");
    const carousel = drawer.querySelector(".search-filter-carousel");
    const body = drawer.querySelector(".search-body");

    if (!close || !input || !carousel || !body) return;

    const panel = ensurePanels(body);
    const resultsTitle = panel.querySelector(".search-results-title");
    const trending = body.querySelector(".trending-search-wrapper");
    const recent = body.querySelector(".search-recent-section") || body.querySelector(".recent-searches-box")?.closest("section");

    let activeType = "all";

    const closeSearch = () => {
      drawer.classList.remove("active");
      backdrop.classList.remove("active");
      document.body.style.overflow = "";
    };

    const openSearch = () => {
      drawer.classList.add("active");
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";
      setTimeout(() => input.focus(), 0);
    };

    const run = () => {
      clearTimeout(STATE.timer);
      const query = input.value.trim();
      if (!query) {
        panel.hidden = true;
        if (trending) trending.hidden = false;
        if (recent) recent.hidden = false;
        return;
      }

      panel.hidden = false;
      resultsTitle.textContent = "Results";
      if (trending) trending.hidden = true;
      if (recent) recent.hidden = true;

      const box = panel.querySelector(".search-results-box");
      const empty = panel.querySelector(".search-empty-state");
      if (box) box.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Searching...";
      }

      STATE.timer = setTimeout(() => search(query, activeType), 250);
    };

    open?.addEventListener("click", openSearch);
    close.addEventListener("click", closeSearch);
    backdrop.addEventListener("click", closeSearch);
    input.addEventListener("input", run);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && drawer.classList.contains("active")) closeSearch();
    }, { signal: STATE.controller?.signal });

    carousel.addEventListener("click", event => {
      const chip = event.target.closest(".search-filter-chip");
      if (!chip) return;
      activeType = chip.dataset.type || "all";
      carousel.querySelectorAll(".search-filter-chip").forEach(item => {
        item.classList.toggle("active", item === chip);
      });
      if (input.value.trim()) run();
    });

    panel.addEventListener("click", event => {
      const link = event.target.closest(".search-result-item");
      if (!link) return;
      const name = link.querySelector(".search-result-name")?.textContent?.trim();
      if (name) {
        try { localStorage.setItem("app_recent_searches", JSON.stringify([{ name, ts: Date.now() }])); } catch {}
      }
    });

    STATE.initialized = true;
  }

  function boot() {
    if (STATE.controller) STATE.controller.abort();
    STATE.controller = new AbortController();
    STATE.initialized = false;
    clearTimeout(STATE.timer);
    if (document.querySelector(".search-drawer")) init();
  }

  boot();
  document.addEventListener("pageLoaded", boot);
  document.addEventListener("pageRefreshed", boot);
})();
