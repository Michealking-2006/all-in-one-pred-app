const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css"
];

const routes = {
  404: "/pages/404.html",
  "/overview": "/pages/overview.html",
  "/notifications": "/pages/notifications.html",
  "/league-page": "/pages/league-page.html",
  "/leagues": "/pages/leagues.html",
  "/vip-tips": "/pages/vip-tips.html",
  "/predictions": "/pages/predictions.html",
  "/next-world-cup-count-downs": "/pages/next-world-cup-count-downs.html",
  "/profile": "/pages/profile.html",
  "/favourites": "/pages/favourites.html"
};

const loader = document.getElementById("page-loader");
const mainPage = document.getElementById("main-page");

let navigationToken = 0;
let currentPath = normalizePath(window.location.pathname);

const HOME_ROUTE = "/overview";

/* routes that should fall back to HOME on first back in standalone mode */
const HOME_FALLBACK_ROUTES = new Set([
  "/notifications",
  "/leagues",
  "/vip-tips",
  "/predictions",
  "/next-world-cup-count-downs",
  "/profile",
  "/favourites"
]);

/* ==========================
   Loader
========================== */

function showLoader() {
  loader?.classList.remove("hidden");
}

function hideLoader() {
  loader?.classList.add("hidden");
}

/* ==========================
   CSS readiness
========================== */

function waitForStylesheets() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];

  const requiredLinks = links.filter((link) => {
    try {
      const pathname = new URL(link.href, location.origin).pathname;
      return REQUIRED_CSS.includes(pathname);
    } catch {
      return false;
    }
  });

  return Promise.all(
    requiredLinks.map((link) => {
      return new Promise((resolve) => {
        if (link.sheet) {
          resolve();
          return;
        }

        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

/* ==========================
   PWA helpers
========================== */

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function shouldSeedHomeBackStack(path) {
  const cleanPath = normalizePath(path);

  if (!isStandalonePWA()) return false;
  if (cleanPath === HOME_ROUTE) return false;
  if (cleanPath.startsWith("/league-page/")) return false;

  return HOME_FALLBACK_ROUTES.has(cleanPath);
}

function seedHomeBackStack(path) {
  const cleanPath = normalizePath(path);

  if (!shouldSeedHomeBackStack(cleanPath)) return;

  const state = history.state || {};

  if (state.__homeSeeded) return;

  /* Put HOME behind the current page in history */
  history.replaceState(
    { path: HOME_ROUTE, __homeSeeded: true },
    "",
    HOME_ROUTE
  );

  history.pushState(
    { path: cleanPath, __homeSeeded: true },
    "",
    cleanPath
  );
}

/* ==========================
   Path helpers
========================== */

function normalizePath(path) {
  if (!path) return HOME_ROUTE;

  try {
    const url = new URL(path, location.origin);
    let clean = url.pathname.replace(/\/+$/, "") || "/";

    if (clean === "/") return HOME_ROUTE;
    return clean;
  } catch {
    const clean = String(path).split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    return clean === "/" ? HOME_ROUTE : clean;
  }
}

function resolveRoute(path) {
  const cleanPath = normalizePath(path);

  if (cleanPath.startsWith("/league-page/")) {
    return routes["/league-page"];
  }

  return routes[cleanPath] || routes[404];
}

function isLeaguePage(path) {
  const cleanPath = normalizePath(path);
  return cleanPath === "/league-page" || cleanPath.startsWith("/league-page/");
}

/* ==========================
   Bottom Navigation
========================== */

function updateActiveNav() {
  const current = normalizePath(currentPath);

  document.querySelectorAll(".bottom-nav .nav-item[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http")) return;

    const linkPath = normalizePath(new URL(href, location.origin).pathname);

    const active =
      (linkPath === "/league-page" && isLeaguePage(current)) ||
      linkPath === current;

    link.classList.toggle("active", active);
    link.querySelector("svg")?.classList.toggle("active", active);
  });
}

/* ==========================
   Load HTML
========================== */

async function loadPage(path, forceReload = false) {
  const page = resolveRoute(path);

  const response = await fetch(page, {
    cache: forceReload ? "reload" : "default"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${page}`);
  }

  return await response.text();
}

/* ==========================
   Events
========================== */

function dispatchPageLoaded(path) {
  document.dispatchEvent(
    new CustomEvent("pageLoaded", {
      detail: { path: normalizePath(path) }
    })
  );
}

function dispatchPageRefreshed(path) {
  document.dispatchEvent(
    new CustomEvent("pageRefreshed", {
      detail: { path: normalizePath(path) }
    })
  );
}

/* ==========================
   Navigate
========================== */

async function navigate(path, pushHistory = true, forceReload = false) {
  const targetPath = normalizePath(path);
  const token = ++navigationToken;

  showLoader();

  try {
    const html = await loadPage(targetPath, forceReload);

    if (token !== navigationToken) return;
    if (!mainPage) return;

    mainPage.innerHTML = html;

    if (pushHistory) {
      history.pushState({ path: targetPath }, "", targetPath);
    } else {
      history.replaceState({ path: targetPath }, "", targetPath);
    }

    currentPath = targetPath;
    updateActiveNav();
    dispatchPageLoaded(targetPath);
  } catch (err) {
    console.error(err);

    if (mainPage) {
      mainPage.innerHTML = `
        <section class="page-error">
          <h1>404</h1>
          <p>Page not found.</p>
        </section>
      `;
    }
  } finally {
    if (token === navigationToken) {
      hideLoader();
    }
  }
}

/* ==========================
   Refresh current page
========================== */

async function refreshCurrentPage() {
  const path = normalizePath(currentPath);
  await navigate(path, false, true);
  dispatchPageRefreshed(path);
}

/* ==========================
   Link Routing
========================== */

document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");

  if (!link) return;
  if (link.target === "_blank" || link.hasAttribute("download")) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;

  const path = normalizePath(url.pathname);

  if (path === normalizePath(currentPath)) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  navigate(path);
});

/* ==========================
   Browser Back/Forward
========================== */

window.addEventListener("popstate", (e) => {
  const path = normalizePath(e.state?.path || window.location.pathname);
  navigate(path, false, false);
});

/* ==========================
   Public API
========================== */

window.route = function (event) {
  event = event || window.event;

  if (event) {
    event.preventDefault();
  }

  const link = event?.currentTarget || event?.target?.closest("a");
  if (!link) return;

  const url = new URL(link.href, location.origin);

  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }

  const path = normalizePath(url.pathname);

  if (path === normalizePath(currentPath)) return;

  navigate(path);
};

window.router = {
  navigate,
  refreshCurrentPage,
  getCurrentPath: () => normalizePath(currentPath)
};

/* ==========================
   Initial Page
========================== */

(async () => {
  await waitForStylesheets();

  const initialPath = normalizePath(window.location.pathname);

  seedHomeBackStack(initialPath);

  currentPath = normalizePath(window.location.pathname);
  await navigate(currentPath, false, false);
})();

The important part is "seedHomeBackStack()". That is what gives you the native-feeling PWA back behavior without breaking nested routes like league detail pages.

In "pwa.js", keep calling:

initPullToRefresh(async () => {
  await window.router.refreshCurrentPage();
});