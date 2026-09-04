(() => {
  "use strict";

  if (window.__scoutwaveFavouritesInstalled) return;
  window.__scoutwaveFavouritesInstalled = true;

  const SELECTORS = {
    page: "#favouritesPage",
    tabs: "[data-favourite-tab]",
    list: "#favouritesList",
    empty: "#favouritesEmpty",
  };

  // maps the plural tab/UI vocabulary to the singular entity_type
  // stored in the favourites table (and used by the entity system)
  const TAB_TO_TYPE = {
    matches: "match",
    players: "player",
    leagues: "league",
    teams: "club",
  };

  const state = {
    page: null,
    activeTab: "all",
    items: [],
  };

  let cleanup = null;

  const getPage = () => document.querySelector(SELECTORS.page);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[c]));
  }

  /* -----------------------------------------------------------
   * card markup — mirrors the original static example markup
   * so the existing favourites CSS applies unchanged
   * --------------------------------------------------------- */

  function href(row) {
    if (row.entity_type === "match") return "#";
    return `/${encodeURIComponent(row.entity_slug || row.entity_id)}`;
  }

  function iconOrAvatar(row) {
    if (row.entity_type === "player" && row.entity_image) {
      return `
        <div class="favourite-item-avatar">
          <img src="${escapeHTML(row.entity_image)}" alt="${escapeHTML(row.entity_name)}">
        </div>
      `;
    }

    const iconClass =
      row.entity_type === "match"
        ? "favourite-match-icon"
        : row.entity_type === "club"
          ? "favourite-team-icon"
          : "favourite-league-icon";

    if (row.entity_image) {
      return `
        <div class="favourite-item-avatar">
          <img src="${escapeHTML(row.entity_image)}" alt="${escapeHTML(row.entity_name)}">
        </div>
      `;
    }

    return `
      <div class="favourite-item-icon ${iconClass}">
        <span aria-hidden="true"></span>
      </div>
    `;
  }

  function cardHTML(row) {
    return `
      <article
        class="favourite-item"
        data-favourite-type="${escapeHTML(row.entity_type)}"
        data-favourite-id="${escapeHTML(row.entity_id)}"
      >
        <a href="${href(row)}" class="favourite-item-link">
          ${iconOrAvatar(row)}
          <div class="favourite-item-info">
            <strong>${escapeHTML(row.entity_name)}</strong>
            ${row.entity_subtitle ? `<span>${escapeHTML(row.entity_subtitle)}</span>` : ""}
          </div>
        </a>
        <button
          class="favourite-remove-btn"
          type="button"
          aria-label="Remove ${escapeHTML(row.entity_name)} from favourites"
          data-remove-favourite
        ></button>
      </article>
    `;
  }

  /* -----------------------------------------------------------
   * render
   * --------------------------------------------------------- */

  function render() {
    const page = state.page;
    if (!page) return;

    const list = page.querySelector(SELECTORS.list);
    const empty = page.querySelector(SELECTORS.empty);

    const filtered =
      state.activeTab === "all"
        ? state.items
        : state.items.filter(
            (row) => row.entity_type === TAB_TO_TYPE[state.activeTab]
          );

    if (list) list.innerHTML = filtered.map(cardHTML).join("");
    if (empty) empty.hidden = filtered.length > 0;
  }

  async function loadFavourites() {
    if (!window.FavouritesStore) return [];
    try {
      return await window.FavouritesStore.list();
    } catch (err) {
      console.error("[Favourites] load failed:", err);
      return [];
    }
  }

  /* -----------------------------------------------------------
   * events
   * --------------------------------------------------------- */

  function bindEvents(page) {
    const onTabClick = (event) => {
      const btn = event.target.closest("[data-favourite-tab]");
      if (!btn) return;

      state.activeTab = btn.getAttribute("data-favourite-tab");

      page.querySelectorAll("[data-favourite-tab]").forEach((tab) => {
        const active = tab === btn;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });

      render();
    };

    const tabsWrap = page.querySelector(".favourites-tabs");
    tabsWrap?.addEventListener("click", onTabClick);

    const onListClick = async (event) => {
      const removeBtn = event.target.closest("[data-remove-favourite]");
      if (!removeBtn) return;

      const card = removeBtn.closest(".favourite-item");
      const type = card?.getAttribute("data-favourite-type");
      const id = card?.getAttribute("data-favourite-id");
      if (!type || !id) return;

      card.style.opacity = ".4";
      removeBtn.disabled = true;

      try {
        await window.FavouritesStore?.remove(type, id);
        state.items = state.items.filter(
          (row) => !(row.entity_type === type && row.entity_id === id)
        );
        render();
      } catch (err) {
        console.error("[Favourites] remove failed:", err);
        card.style.opacity = "";
        removeBtn.disabled = false;
      }
    };

    const list = page.querySelector(SELECTORS.list);
    list?.addEventListener("click", onListClick);

    const onFavouritesChanged = () => mount();
    document.addEventListener("scoutwave:favourites-changed", onFavouritesChanged);

    return () => {
      tabsWrap?.removeEventListener("click", onTabClick);
      list?.removeEventListener("click", onListClick);
      document.removeEventListener("scoutwave:favourites-changed", onFavouritesChanged);
    };
  }

  /* -----------------------------------------------------------
   * lifecycle
   * --------------------------------------------------------- */

  async function mount() {
    const page = getPage();
    if (!page) return;

    state.page = page;
    state.items = await loadFavourites();
    render();

    cleanup?.();
    cleanup = bindEvents(page);
  }

  function destroy() {
    cleanup?.();
    cleanup = null;
    state.page = null;
    state.items = [];
    state.activeTab = "all";
  }

  document.addEventListener("pageLoaded", (event) => {
    if (event.detail?.path === "/profile/favourites") mount();
    else destroy();
  });

  document.addEventListener("pageRefreshed", (event) => {
    if (event.detail?.path === "/profile/favourites") mount();
  });

  if (getPage()) mount();
})();
