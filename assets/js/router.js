const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css"
];

const HOME_ROUTE = "/overview";

/* Only these top-level pages should go HOME first when the app
   is opened directly in standalone mode. */
const HOME_BACK_ROUTES = new Set([
  "/notifications",
  "/leagues",
  "/vip-tips",
  "/predictions",
  "/next-world-cup-count-downs",
  "/profile",
  "/favourites"
]);

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
   PWA mode
========================== */

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

/* ==========================
   Wait for required CSS
========================== */

function waitForStylesheets() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];

  const requiredLinks = links.filter(link => {
    try {
      const pathname = new URL(link.href, location.origin).pathname;
      return REQUIRED_CSS.includes(pathname);
    } catch {
      return false;
    }
  });

  return Promise.all(
    requiredLinks.map(link => {
      return new Promise(resolve => {
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
   Route helpers
========================== */

function normalizePath(path) {
  if (!path) return HOME_ROUTE;

  try {
    const url = new URL(path, location.origin);
    const clean = url.pathname.replace(/\/+$/, "") || "/";
    return clean === "/" ? HOME_ROUTE : clean;
  } catch {
    const clean = String(path).split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    return clean === "/" ? HOME_ROUTE : clean;
  }
}

/* Returns the top-level segment of a path, e.g. "/leagues/food" -> "/leagues" */
function topLevelSegment(path) {
  const cleanPath = normalizePath(path);
  const firstSegment = cleanPath.split("/")[1];
  return firstSegment ? `/${firstSegment}` : cleanPath;
}

/* Is this path exactly a registered top-level route (no nested segments)? */
function isTopLevelRoute(path) {
  const cleanPath = normalizePath(path);
  return Object.prototype.hasOwnProperty.call(routes, cleanPath);
}

/* Is this path a nested child of a registered top-level route?
   e.g. "/leagues/food" is nested under "/leagues".
   "/leagues" itself is NOT nested. */
function isNestedRoute(path) {
  const cleanPath = normalizePath(path);
  if (isTopLevelRoute(cleanPath)) return false;

  const top = topLevelSegment(cleanPath);
  return top !== cleanPath && Object.prototype.hasOwnProperty.call(routes, top);
}

function isLeaguePage(path) {
  const cleanPath = normalizePath(path);
  return (
    cleanPath === "/league-page" ||
    cleanPath.startsWith("/league-page/") ||
    cleanPath.startsWith("/league/")
  );
}

function resolveRoute(path) {
  const cleanPath = normalizePath(path);

  if (cleanPath.startsWith("/league-page/") || cleanPath.startsWith("/league/")) {
    return routes["/league-page"];
  }

  if (routes[cleanPath]) return routes[cleanPath];

  /* Generic nested-route fallback: "/leagues/food" -> routes["/leagues"].
     Lets any top-level route own its own sub-paths (client-side sub-routing
     inside that page), the same way league pages already work. */
  const top = topLevelSegment(cleanPath);
  if (routes[top]) return routes[top];

  return routes[404];
}

/* ==========================
   Home-back seeding
========================== */

function shouldSeedHomeBackStack(path) {
  const cleanPath = normalizePath(path);

  if (!isStandalonePWA()) return false;
  if (cleanPath === HOME_ROUTE) return false;
  if (isLeaguePage(cleanPath)) return false;
  if (isNestedRoute(cleanPath)) return false; // never seed on nested paths, e.g. /leagues/food

  return HOME_BACK_ROUTES.has(cleanPath);
}

function seedHomeBackStack(initialPath) {
  const cleanPath = normalizePath(initialPath);

  if (!shouldSeedHomeBackStack(cleanPath)) return;
  if (window.__pwaHomeBackSeeded) return;

  window.__pwaHomeBackSeeded = true;

  /* History becomes:
     [HOME_ROUTE, initialPath]
     so first back goes home, second back exits. */
  history.replaceState(
    { path: HOME_ROUTE, __pwaHomeSeed: true },
    "",
    HOME_ROUTE
  );

  history.pushState(
    { path: cleanPath, __pwaHomeSeed: true },
    "",
    cleanPath
  );
}

/* ==========================
   Bottom Navigation
========================== */

function updateActiveNav() {
  const current = normalizePath(currentPath);

  document.querySelectorAll(".bottom-nav .nav-item[href]").forEach(link => {
    const href = link.getAttribute("href");

    if (!href || href.startsWith("#") || href.startsWith("http")) return;

    const linkPath = normalizePath(new URL(href, location.origin).pathname);

    const active =
      (linkPath === "/league-page" && isLeaguePage(current)) ||
      linkPath === current ||
      linkPath === topLevelSegment(current);

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
   Render
========================== */

async function renderRoute(path, { updateHistory = true, pushHistory = true, forceReload = false } = {}) {
  const targetPath = normalizePath(path);
  const token = ++navigationToken;

  showLoader();

  try {
    const html = await loadPage(targetPath, forceReload);

    if (token !== navigationToken) return;
    if (!mainPage) return;

    mainPage.innerHTML = html;
    currentPath = targetPath;

    if (updateHistory) {
      const state = { path: targetPath };

      if (pushHistory) {
        history.pushState(state, "", targetPath);
      } else {
        history.replaceState(state, "", targetPath);
      }
    }

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
   Public navigation API
========================== */

async function navigate(path, pushHistory = true, forceReload = false) {
  return renderRoute(path, {
    updateHistory: true,
    pushHistory,
    forceReload
  });
}

async function refreshCurrentPage() {
  const path = normalizePath(currentPath);

  await renderRoute(path, {
    updateHistory: false,
    pushHistory: false,
    forceReload: true
  });

  dispatchPageRefreshed(path);
}

function goBack() {
  history.back();
}

/* ==========================
   Link routing
========================== */

document.addEventListener("click", e => {
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

window.addEventListener("popstate", e => {
  const path = normalizePath(e.state?.path || window.location.pathname);

  renderRoute(path, {
    updateHistory: false,
    pushHistory: false,
    forceReload: false
  });
});

/* ==========================
   Global API
========================== */

window.route = function(event) {
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
  goBack,
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

  await renderRoute(currentPath, {
    updateHistory: false,
    pushHistory: false,
    forceReload: false
  });
})();
