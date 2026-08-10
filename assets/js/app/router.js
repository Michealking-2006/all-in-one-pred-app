/********* router *********/

const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css",
];

const HOME_ROUTE = "/overview";

const ROUTE_ALIASES = {
  "/": "/overview",
  "/home": "/overview",
};

const HOME_BACK_ROUTES = new Set([
  "/notifications",
  "/leagues",
  "/vip-tips",
  "/predictions",
  "/next-world-cup-count-downs",
  "/profile",
  "/favourites",
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
  "/favourites": "/pages/favourites.html",
};

let navigationToken = 0;
let currentPath = normalizePath(window.location.pathname);

const pageRegistry = new Map();
let activePageName = null;
let activePageRoot = null;

/********* dom helpers *********/

function getLoader() {
  return document.getElementById("page-loader");
}

function getMainPage() {
  return document.getElementById("main-page");
}

function showLoader() {
  getLoader()?.classList.remove("hidden");
}

function hideLoader() {
  setTimeout(() => {
    getLoader()?.classList.add("hidden");
  },1000)
}

/********* pwa helpers *********/

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
  if (isLeaguePage(cleanPath)) return false;
  if (isNestedRoute(cleanPath)) return false;

  return HOME_BACK_ROUTES.has(cleanPath);
}

function seedHomeBackStack(initialPath) {
  const cleanPath = normalizePath(initialPath);

  if (!shouldSeedHomeBackStack(cleanPath)) return;
  if (window.__pwaHomeBackSeeded) return;

  window.__pwaHomeBackSeeded = true;

  history.replaceState({ path: HOME_ROUTE, __pwaHomeSeed: true }, "", HOME_ROUTE);
  history.pushState({ path: cleanPath, __pwaHomeSeed: true }, "", cleanPath);
}

/********* path helpers *********/

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

function topLevelSegment(path) {
  const cleanPath = normalizePath(path);
  const firstSegment = cleanPath.split("/")[1];
  return firstSegment ? `/${firstSegment}` : cleanPath;
}

function isTopLevelRoute(path) {
  const cleanPath = normalizePath(path);
  return Object.prototype.hasOwnProperty.call(routes, cleanPath);
}

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
  const aliasedPath = ROUTE_ALIASES[cleanPath] || cleanPath;

  if (aliasedPath.startsWith("/league-page/") || aliasedPath.startsWith("/league/")) {
    return routes["/league-page"];
  }

  if (routes[aliasedPath]) return routes[aliasedPath];

  const top = topLevelSegment(aliasedPath);
  if (routes[top]) return routes[top];

  return routes[404];
}

/********* css loading *********/

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

  if (!requiredLinks.length) return Promise.resolve();

  return Promise.allSettled(
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

/********* page lifecycle *********/

function registerPage(name, hooks = {}) {
  if (!name) return;

  pageRegistry.set(name, {
    init: typeof hooks.init === "function" ? hooks.init : null,
    destroy: typeof hooks.destroy === "function" ? hooks.destroy : null,
  });
}

function destroyActivePage() {
  if (!activePageName) return;

  const hooks = pageRegistry.get(activePageName);

  try {
    hooks?.destroy?.(activePageRoot || getMainPage());
  } catch (err) {
    console.error(`Error while destroying page "${activePageName}"`, err);
  }

  activePageName = null;
  activePageRoot = null;
}

function mountPage(name, root = getMainPage()) {
  if (!name) return;

  if (activePageName && activePageName !== name) {
    destroyActivePage();
  }

  activePageName = name;
  activePageRoot = root || getMainPage();

  const hooks = pageRegistry.get(name);

  try {
    hooks?.init?.(activePageRoot);
  } catch (err) {
    console.error(`Error while initializing page "${name}"`, err);
  }
}

/********* nav *********/

function updateActiveNav() {
  const current = normalizePath(currentPath);

  document.querySelectorAll(".bottom-nav .nav-item[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http")) return;

    const linkPath = normalizePath(new URL(href, location.origin).pathname);
    const aliasedLinkPath = ROUTE_ALIASES[linkPath] || linkPath;

    const active =
      (aliasedLinkPath === "/league-page" && isLeaguePage(current)) ||
      aliasedLinkPath === current ||
      aliasedLinkPath === topLevelSegment(current);

    link.classList.toggle("active", active);
    link.querySelector("svg")?.classList.toggle("active", active);
  });
}

/********* page loading *********/

async function loadPage(path, forceReload = false) {
  const page = resolveRoute(path);

  const response = await fetch(page, {
    cache: forceReload ? "reload" : "default",
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${page}`);
  }

  return response.text();
}

/********* app-script loading *********/

async function waitForPageScripts(root = getMainPage()) {
  if (!root || typeof window.loadPageScript !== "function") return;

  const scripts = [...root.querySelectorAll("app-script[src]")];
  if (!scripts.length) return;

  const results = await Promise.allSettled(
    scripts.map((el) => {
      const src = el.getAttribute("src");
      if (!src) return Promise.resolve();
      return window.loadPageScript(src);
    })
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  });
}

/********* events *********/

function dispatchPageLoaded(path) {
  document.dispatchEvent(
    new CustomEvent("pageLoaded", {
      detail: { path: normalizePath(path) },
    })
  );
}

function dispatchPageRefreshed(path) {
  document.dispatchEvent(
    new CustomEvent("pageRefreshed", {
      detail: { path: normalizePath(path) },
    })
  );
}

/********* render *********/

async function renderRoute(
  path,
  { updateHistory = true, pushHistory = true, forceReload = false } = {}
) {
  const targetPath = normalizePath(path);
  const token = ++navigationToken;

  showLoader();

  try {
    destroyActivePage();

    const html = await loadPage(targetPath, forceReload);

    if (token !== navigationToken) return;

    const mainPage = getMainPage();
    if (!mainPage) {
      throw new Error("main page container not found");
    }

    mainPage.innerHTML = html;

    await waitForPageScripts(mainPage);

    if (token !== navigationToken) return;

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

    const mainPage = getMainPage();
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

/********* public api *********/

async function navigate(path, pushHistory = true, forceReload = false) {
  return renderRoute(path, {
    updateHistory: true,
    pushHistory,
    forceReload,
  });
}

async function refreshCurrentPage() {
  const path = normalizePath(currentPath);

  await renderRoute(path, {
    updateHistory: false,
    pushHistory: false,
    forceReload: true,
  });

  dispatchPageRefreshed(path);
}

function goBack() {
  history.back();
}

/********* link routing *********/

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

/********* browser navigation *********/

window.addEventListener("popstate", (e) => {
  const path = normalizePath(e.state?.path || window.location.pathname);

  renderRoute(path, {
    updateHistory: false,
    pushHistory: false,
    forceReload: false,
  });
});

/********* global api *********/

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
  goBack,
  getCurrentPath: () => normalizePath(currentPath),
  registerPage,
  mountPage,
  destroyActivePage,
};

/********* boot *********/

(async () => {
  await waitForStylesheets();

  const initialPath = normalizePath(window.location.pathname);

  seedHomeBackStack(initialPath);

  currentPath = normalizePath(window.location.pathname);

  await renderRoute(currentPath, {
    updateHistory: false,
    pushHistory: false,
    forceReload: false,
  });
})();