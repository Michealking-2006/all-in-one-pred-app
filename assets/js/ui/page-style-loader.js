(() => {
  "use strict";

  if (window.__scoutwavePageStyleLoaderInstalled) return;
  window.__scoutwavePageStyleLoaderInstalled = true;

  const STYLE_MAP = {
    "/overview": "/assets/css/pages/overview.css",
    "/notifications": "/assets/css/pages/notifications.css",
    "/leagues": "/assets/css/pages/leagues.css",
    "/vip-tips": "/assets/css/pages/vip-tips.css",
    "/predictions": "/assets/css/pages/predictions.css",
    "/next-world-cup-count-downs": "/assets/css/pages/next-world-cup-count-downs.css",
    "/profile": "/assets/css/pages/profile.css",
    "/profile/coins": "/assets/css/pages/coins.css",
    "/profile/premium": "/assets/css/pages/premium.css",
    "/profile/edit": "/assets/css/pages/edit-profile.css",
    "/security/change-password": "/assets/css/pages/change-password.css",
    "/profile/favourites": "/assets/css/pages/favourites.css",
    "/profile/languages": "/assets/css/pages/languages.css",
    "/news": "/assets/css/pages/news.css",
    "/reports": "/assets/css/pages/reports.css",
  };

  const loaded = new Map();

  function normalizePath(path) {
    try {
      return new URL(path || "/overview", location.origin).pathname.replace(/\/+$/, "") || "/overview";
    } catch {
      return "/overview";
    }
  }

  function ensureStylesheet(href) {
    if (!href) return;

    if (loaded.has(href)) {
      loaded.get(href).disabled = false;
      return;
    }

    const existing = document.querySelector(`link[data-page-style="${href}"]`);
    if (existing) {
      existing.disabled = false;
      loaded.set(href, existing);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.pageStyle = href;
    document.head.appendChild(link);
    loaded.set(href, link);
  }

  function activate(path) {
    const activeHref = STYLE_MAP[normalizePath(path)] || null;

    for (const [href, link] of loaded) {
      link.disabled = href !== activeHref;
    }

    if (activeHref) ensureStylesheet(activeHref);
  }

  document.addEventListener("pageLoaded", event => {
    activate(event.detail?.path || location.pathname);
  });

  activate(location.pathname);
})();
