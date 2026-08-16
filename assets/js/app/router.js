/********* router *********/

const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css",
];

const HOME_ROUTE = "/overview";

const ROUTE_ALIASES = {
  "/": HOME_ROUTE,
  "/home": HOME_ROUTE,
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
  "/404": {
    file: "/pages/404.html",
    title: "Page Not Found",
  },

  "/overview": {
    file: "/pages/overview.html",
    title: "Overview",
  },

  "/notifications": {
    file: "/pages/notifications.html",
    title: "Notifications",
  },

  "/league-page": {
    file: "/pages/league-page.html",
    title: "League",
  },

  "/leagues": {
    file: "/pages/leagues.html",
    title: "Leagues",
  },

  "/vip-tips": {
    file: "/pages/vip-tips.html",
    title: "VIP Tips",
  },

  "/predictions": {
    file: "/pages/predictions.html",
    title: "Predictions",
  },

  "/next-world-cup-count-downs": {
    file: "/pages/next-world-cup-count-downs.html",
    title: "Next World Cup",
  },

  "/profile": {
    file: "/pages/profile.html",
    title: "Profile",
  },
  
  "/profile/coins": {
  file: "/pages/profile/coins.html",
  title: "Coins",
},

  "/favourites": {
    file: "/pages/favourites.html",
    title: "Favourites",
  },
};

let navigationToken = 0;
let currentPath = normalizePath(location.pathname);

const pageRegistry = new Map();
let activePageName = null;
let activePageRoot = null;

/********* helpers *********/

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const getMainPage = () => $("#main-page");
const getLoader = () => $("#page-loader");

const showLoader = () =>
  getLoader()?.classList.remove("hidden");

const hideLoader = () =>
  getLoader()?.classList.add("hidden");

function normalizePath(path) {
  try {
    const pathname = new URL(
      path || HOME_ROUTE,
      location.origin
    ).pathname.replace(/\/+$/, "");

    return pathname || HOME_ROUTE;
  } catch {
    return HOME_ROUTE;
  }
}

function topLevelSegment(path) {
  const clean = normalizePath(path);
  const segment = clean.split("/")[1];
  return segment ? `/${segment}` : HOME_ROUTE;
}

function isLeaguePage(path) {
  const clean = normalizePath(path);
  return (
    clean === "/league-page" ||
    clean.startsWith("/league-page/") ||
    clean.startsWith("/league/")
  );
}

function resolveRoutePath(path) {
  const clean = normalizePath(path);
  const alias = ROUTE_ALIASES[clean] || clean;

  if (isLeaguePage(alias)) {
    return "/league-page";
  }

  if (routes[alias]) {
    return alias;
  }

  const top = topLevelSegment(alias);
  return routes[top] ? top : "/404";
}

function resolveRoute(path) {
  return routes[resolveRoutePath(path)] || routes["/404"];
}

/********* pwa *********/

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function shouldSeedHomeBackStack(path) {
  const clean = normalizePath(path);

  return (
    isStandalonePWA() &&
    clean !== HOME_ROUTE &&
    !isLeaguePage(clean) &&
    !routes[clean] &&
    HOME_BACK_ROUTES.has(clean)
  );
}

function seedHomeBackStack(path) {
  const clean = normalizePath(path);

  if (
    !shouldSeedHomeBackStack(clean) ||
    window.__pwaHomeBackSeeded
  ) {
    return;
  }

  window.__pwaHomeBackSeeded = true;

  history.replaceState(
    { path: HOME_ROUTE, __pwaHomeSeed: true },
    "",
    HOME_ROUTE
  );

  history.pushState(
    { path: clean, __pwaHomeSeed: true },
    "",
    clean
  );
}

/********* folder navigation *********/

function getPageCandidates(path) {
  const clean = normalizePath(path);
  const resolved = resolveRoutePath(clean);
  const route = routes[resolved];

  return [
    ...(route?.file ? [route.file] : []),
    `/pages${clean}/index.html`,
    `/pages${clean}.html`,
  ].filter(
    (file, index, list) =>
      list.indexOf(file) === index
  );
}

/********* css *********/

function waitForStylesheets() {
  const links = $$('link[rel="stylesheet"]').filter(link => {
    try {
      return REQUIRED_CSS.includes(
        new URL(link.href, location.origin).pathname
      );
    } catch {
      return false;
    }
  });

  if (!links.length) {
    return Promise.resolve();
  }

  return Promise.all(
    links.map(
      link =>
        link.sheet
          ? Promise.resolve()
          : new Promise(resolve => {
              link.addEventListener("load", resolve, {
                once: true,
              });

              link.addEventListener("error", resolve, {
                once: true,
              });
            })
    )
  );
}

/********* page lifecycle *********/

function registerPage(name, hooks = {}) {
  if (!name) return;

  pageRegistry.set(name, {
    init:
      typeof hooks.init === "function"
        ? hooks.init
        : null,

    destroy:
      typeof hooks.destroy === "function"
        ? hooks.destroy
        : null,
  });
}

function destroyActivePage() {
  if (!activePageName) return;

  try {
    pageRegistry
      .get(activePageName)
      ?.destroy?.(
        activePageRoot || getMainPage()
      );
  } catch (error) {
    console.error(
      `[Router] Destroy failed for "${activePageName}"`,
      error
    );
  }

  activePageName = null;
  activePageRoot = null;
}

function mountPage(name, root = getMainPage()) {
  if (!name) return;

  if (
    activePageName &&
    activePageName !== name
  ) {
    destroyActivePage();
  }

  activePageName = name;
  activePageRoot = root;

  try {
    pageRegistry.get(name)?.init?.(root);
  } catch (error) {
    console.error(
      `[Router] Init failed for "${name}"`,
      error
    );
  }
}

/********* navigation ui *********/

function updateActiveNav() {
  const current = normalizePath(currentPath);

  $$(".bottom-nav .nav-item[href]").forEach(link => {
    const href = link.getAttribute("href");

    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http")
    ) {
      return;
    }

    let linkPath;

    try {
      linkPath = normalizePath(
        new URL(href, location.origin).pathname
      );
    } catch {
      return;
    }

    linkPath =
      ROUTE_ALIASES[linkPath] || linkPath;

    const active =
      linkPath === current ||
      (
        linkPath === "/league-page" &&
        isLeaguePage(current)
      ) ||
      linkPath === topLevelSegment(current);

    link.classList.toggle("active", active);
    link.querySelector("svg")?.classList.toggle(
      "active",
      active
    );
  });
}

/********* page loading *********/

async function fetchPage(file, forceReload = false) {
  const response = await fetch(file, {
    cache: forceReload ? "reload" : "default",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load ${file} (${response.status})`
    );
  }

  return response.text();
}

async function loadPage(path, forceReload = false) {
  const clean = normalizePath(path);
  const resolvedPath = resolveRoutePath(clean);
  const route = routes[resolvedPath];

  for (const file of getPageCandidates(clean)) {
    try {
      return {
        html: await fetchPage(file, forceReload),
        file,
        route,
        resolvedPath,
      };
    } catch {}
  }

  return {
    html: await fetchPage(
      routes["/404"].file,
      forceReload
    ),
    file: routes["/404"].file,
    route: routes["/404"],
    resolvedPath: "/404",
  };
}

/********* page scripts *********/

async function waitForPageScripts(
  root = getMainPage()
) {
  if (
    !root ||
    typeof window.loadPageScript !== "function"
  ) {
    return;
  }

  const elements = $$(
    "app-script[src]",
    root
  );

  if (!elements.length) return;

  await Promise.allSettled(
    elements.map(element => {
      const src = element.getAttribute("src");
      return src
        ? window.loadPageScript(src)
        : Promise.resolve();
    })
  );
}

/********* events *********/

function dispatch(name, path, meta = {}) {
  document.dispatchEvent(
    new CustomEvent(name, {
      detail: {
        path: normalizePath(path),
        ...meta,
      },
    })
  );
}

/********* render *********/

async function renderRoute(
  path,
  {
    updateHistory = true,
    pushHistory = true,
    forceReload = false,
  } = {}
) {
  const requestedPath = normalizePath(path);
  const token = ++navigationToken;

  showLoader();

  try {
    destroyActivePage();

    const page = await loadPage(
      requestedPath,
      forceReload
    );

    if (token !== navigationToken) return;

    const main = getMainPage();

    if (!main) {
      throw new Error("#main-page not found");
    }

    main.replaceChildren();
    main.insertAdjacentHTML(
      "afterbegin",
      page.html
    );

    await waitForPageScripts(main);

    if (token !== navigationToken) return;

    currentPath = requestedPath;

    if (updateHistory) {
      const state = { path: requestedPath };

      pushHistory
        ? history.pushState(
            state,
            "",
            requestedPath
          )
        : history.replaceState(
            state,
            "",
            requestedPath
          );
    }

    if (page.route?.title) {
      document.title =
        `${page.route.title} | Scoutwave`;
    }

    updateActiveNav();

    dispatch("pageLoaded", requestedPath, {
      file: page.file,
      resolvedPath: page.resolvedPath,
      route: page.route,
    });
  } catch (error) {
    if (token !== navigationToken) return;

    console.error("[Router] Navigation failed:", error);

    getMainPage()?.replaceChildren(
      Object.assign(
        document.createElement("section"),
        {
          className: "page-error",
          innerHTML: `
            <h1>404</h1>
            <p>Page not found.</p>
          `,
        }
      )
    );
  } finally {
    if (token === navigationToken) {
      setTimeout(() => {hideLoader()},1000);
    }
  }
}

/********* public api *********/

async function navigate(
  path,
  pushHistory = true,
  forceReload = false
) {
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
    forceReload: true,
  });

  dispatch("pageRefreshed", path);
}

function goBack() {
  history.back();
}

/********* link handling *********/

document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  if (
    link.target === "_blank" ||
    link.hasAttribute("download") ||
    link.dataset.native !== undefined ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }

  let url;

  try {
    url = new URL(link.href, location.origin);
  } catch {
    return;
  }

  if (
    url.origin !== location.origin ||
    url.pathname.startsWith("/assets/") ||
    /\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    return;
  }

  const path = normalizePath(url.pathname);

  event.preventDefault();

  if (path !== normalizePath(currentPath)) {
    navigate(path);
  }
});

/********* browser navigation *********/

window.addEventListener("popstate", event => {
  renderRoute(
    event.state?.path ||
      location.pathname,
    {
      updateHistory: false,
      forceReload: false,
    }
  );
});

/********* global api *********/

window.route = function(event) {
  event?.preventDefault();

  const link =
    event?.currentTarget ||
    event?.target?.closest("a[href]");

  if (!link) return;

  let url;

  try {
    url = new URL(link.href, location.origin);
  } catch {
    return;
  }

  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }

  navigate(url.pathname);
};

window.router = {
  navigate,
  refreshCurrentPage,
  goBack,
  getCurrentPath: () =>
    normalizePath(currentPath),
  resolveRoute,
  registerPage,
  mountPage,
  destroyActivePage,
};

/********* startup *********/

(async () => {
  await waitForStylesheets();

  const initialPath = normalizePath(
    location.pathname
  );

  seedHomeBackStack(initialPath);

  currentPath = normalizePath(
    location.pathname
  );

  await renderRoute(currentPath, {
    updateHistory: false,
    forceReload: false,
  });
})();