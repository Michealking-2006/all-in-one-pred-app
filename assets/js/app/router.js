(() => {
  "use strict";

  if (window.__scoutwaveRouterInstalled) return;
  window.__scoutwaveRouterInstalled = true;

  const HOME_ROUTE = "/overview";
  const STATIC_ROUTES = {
    "/404": { file: "/pages/404.html", title: "Page Not Found" },
    "/overview": { file: "/pages/overview.html", title: "Overview" },
    "/notifications": { file: "/pages/notifications.html", title: "Notifications" },
    "/leagues": { file: "/pages/leagues.html", title: "Leagues" },
    "/vip-tips": { file: "/pages/vip-tips.html", title: "VIP Tips" },
    "/predictions": { file: "/pages/predictions.html", title: "Predictions" },
    "/next-world-cup-count-downs": { file: "/pages/next-world-cup-count-downs.html", title: "Next World Cup" },
    "/profile": { file: "/pages/profile.html", title: "Profile" },
    "/profile/coins": { file: "/pages/profile/coins.html", title: "Coins" },
    "/profile/premium": { file: "/pages/profile/premium.html", title: "Premium" },
    "/profile/edit": { file: "/pages/profile/edit.html", title: "Edit" },
    "/security/change-password": { file: "/pages/security/change-password.html", title: "Change password" },
    "/profile/favourites": { file: "/pages/profile/favourites.html", title: "Favourites" },
    "/news": { file: "/pages/news.html", title: "News" },
    "/profile/languages": { file: "/pages/profile/languages.html", title: "Languages" },
  };

  const ENTITY_PAGES = {
    league: { file: "/pages/entities/league.html" },
    club: { file: "/pages/entities/club.html" },
    player: { file: "/pages/entities/player.html" },
  };

  const ALIASES = { "/": HOME_ROUTE, "/home": HOME_ROUTE };
  let currentPath = normalizePath(location.pathname);
  let navigationToken = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function normalizePath(path) {
    try {
      const pathname = new URL(path || HOME_ROUTE, location.origin).pathname;
      return pathname.replace(/\/+$/, "") || HOME_ROUTE;
    } catch {
      return HOME_ROUTE;
    }
  }

  function showLoader() { $("#page-loader")?.classList.remove("hidden"); }
  function hideLoader() { $("#page-loader")?.classList.add("hidden"); }

  function legacyLeagueSlug(path) {
    const clean = normalizePath(path);
    if (!clean.startsWith("/league-page/")) return "";
    return clean.slice("/league-page/".length).split("/")[0];
  }

  function isLegacyLeaguePath(path) {
    const clean = normalizePath(path);
    return clean === "/league-page" || clean.startsWith("/league-page/") || clean.startsWith("/league/");
  }

  async function resolveEntity(slug) {
    const response = await fetch(`/api/resolve-entity?slug=${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Entity resolver HTTP ${response.status}`);

    const data = await response.json();
    return data?.entity || null;
  }

  async function resolveRoute(path) {
    const requested = normalizePath(path);
    const aliased = ALIASES[requested] || requested;

    if (isLegacyLeaguePath(aliased)) {
      const slug = legacyLeagueSlug(aliased);
      return {
        kind: "redirect",
        canonicalPath: slug ? `/${slug}` : "/leagues",
      };
    }

    const staticRoute = STATIC_ROUTES[aliased];
    if (staticRoute) {
      return { kind: "static", routePath: aliased, route: staticRoute, entity: null };
    }

    const parts = aliased.split("/").filter(Boolean);
    if (parts.length !== 1 || parts[0].length < 3) {
      return { kind: "static", routePath: "/404", route: STATIC_ROUTES["/404"], entity: null };
    }

    const entity = await resolveEntity(parts[0]);
    if (!entity || !ENTITY_PAGES[entity.type]) {
      return { kind: "static", routePath: "/404", route: STATIC_ROUTES["/404"], entity: null };
    }

    return {
      kind: "entity",
      routePath: aliased,
      route: ENTITY_PAGES[entity.type],
      entity,
    };
  }

  async function fetchPage(file, forceReload = false) {
    const target = forceReload ? `${file}?v=${Date.now()}` : file;
    const response = await fetch(target, { cache: forceReload ? "reload" : "default" });
    if (!response.ok) throw new Error(`Failed to load ${file} (${response.status})`);
    return response.text();
  }

  function waitForPageScripts(root) {
    const scripts = $$("app-script[src]", root);
    if (!scripts.length) return Promise.resolve();

    return Promise.all(scripts.map(element => new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      element.addEventListener("appscriptload", finish, { once: true });
      element.addEventListener("appscripterror", finish, { once: true });
      setTimeout(finish, 10000);
    })));
  }

  function updateActiveNav() {
    const current = normalizePath(currentPath);
    $$(".bottom-nav .nav-item[href]").forEach(link => {
      let path;
      try { path = normalizePath(new URL(link.href, location.origin).pathname); }
      catch { return; }
      path = ALIASES[path] || path;
      const active = path === current || path === current.split("/").slice(0, 2).join("/");
      link.classList.toggle("active", active);
      link.querySelector("svg")?.classList.toggle("active", active);
    });
  }

  async function renderRoute(path, options = {}) {
    const requestedPath = normalizePath(path);
    const token = ++navigationToken;
    showLoader();

    try {
      const page = await resolveRoute(requestedPath);
      if (token !== navigationToken) return;

      if (page.kind === "redirect") {
        history.replaceState({ path: page.canonicalPath }, "", page.canonicalPath);
        return renderRoute(page.canonicalPath, { updateHistory: false, pushHistory: false });
      }

      const html = await fetchPage(page.route.file, options.forceReload === true);
      if (token !== navigationToken) return;

      const main = $("#main-page");
      if (!main) throw new Error("#main-page not found");

      main.replaceChildren();
      window.__scoutwaveEntity = page.entity || null;
      main.insertAdjacentHTML("afterbegin", html);

      await waitForPageScripts(main);
      if (token !== navigationToken) return;

      currentPath = requestedPath;
      if (options.updateHistory !== false) {
        const state = { path: requestedPath };
        if (options.pushHistory === false) history.replaceState(state, "", requestedPath);
        else history.pushState(state, "", requestedPath);
      }

      document.title = page.entity?.name
        ? `${page.entity.name} | Scoutwave`
        : `${page.route.title} | Scoutwave`;

      updateActiveNav();
      document.dispatchEvent(new CustomEvent("pageLoaded", {
        detail: { path: currentPath, kind: page.kind, entity: page.entity || null, route: page.route },
      }));
    } catch (error) {
      if (token !== navigationToken) return;
      console.error("[Router] Navigation failed:", error);
      $("#main-page")?.replaceChildren(Object.assign(document.createElement("section"), {
        className: "page-error",
        innerHTML: "<h1>Unable to load page</h1><p>Please try again.</p>",
      }));
    } finally {
      if (token === navigationToken) setTimeout(hideLoader, 250);
    }
  }

  function navigate(path, pushHistory = true, forceReload = false) {
    return renderRoute(path, { updateHistory: true, pushHistory, forceReload });
  }

  function refreshCurrentPage() {
    return renderRoute(currentPath, { updateHistory: false, pushHistory: false, forceReload: true });
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download") || link.dataset.native !== undefined || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    let url;
    try { url = new URL(link.href, location.origin); } catch { return; }
    if (url.origin !== location.origin || url.pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(url.pathname)) return;

    event.preventDefault();
    const path = normalizePath(url.pathname);
    if (path !== currentPath) navigate(path);
  });

  window.addEventListener("popstate", event => {
    renderRoute(event.state?.path || location.pathname, { updateHistory: false, pushHistory: false });
  });

  window.route = function(event) {
    event?.preventDefault();
    const link = event?.currentTarget || event?.target?.closest("a[href]");
    if (!link) return;
    navigate(new URL(link.href, location.origin).pathname);
  };

  window.router = {
    navigate,
    refreshCurrentPage,
    goBack: () => history.back(),
    getCurrentPath: () => currentPath,
    resolveRoute,
  };

  renderRoute(currentPath, { updateHistory: false, pushHistory: false });
})();
