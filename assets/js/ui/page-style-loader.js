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
    "/league-page": "/assets/css/pages/league-page.css"
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
    if (loaded.has(href)) return loaded.get(href);

    const existing = document.querySelector(`link[data-page-style="${href}"]`);
    if (existing) {
      loaded.set(href, existing);
      return existing;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.pageStyle = href;
    document.head.appendChild(link);
    loaded.set(href, link);
    return link;
  }

  function activate(path) {
    const activeHref = STYLE_MAP[normalizePath(path)] || null;

    if (activeHref) ensureStylesheet(activeHref);

    for (const [href, link] of loaded) {
      link.disabled = href !== activeHref;
    }
  }

  document.addEventListener("pageLoaded", event => {
    activate(event.detail?.path || location.pathname);
  });

  activate(location.pathname);
})();
