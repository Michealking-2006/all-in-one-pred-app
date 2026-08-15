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
  404: {
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
    file: "/pages/profile/coin.html",
    title: "Coins",
  },

  "/favourites": {
    file: "/pages/favourites.html",
    title: "Favourites",
  },
};

const pageRegistry = new Map();

let navigationToken = 0;
let currentPath = normalizePath(
  window.location.pathname
);

let activePageName = null;
let activePageRoot = null;

/********* dom helpers *********/

function getLoader() {
  return document.getElementById(
    "page-loader"
  );
}

function getMainPage() {
  return document.getElementById(
    "main-page"
  );
}

function showLoader() {
  getLoader()?.classList.remove(
    "hidden"
  );
}

function hideLoader() {
  getLoader()?.classList.add(
    "hidden"
  );
}

/********* path helpers *********/

function normalizePath(path) {
  if (!path) {
    return HOME_ROUTE;
  }

  try {
    const url = new URL(
      path,
      location.origin
    );

    const clean =
      url.pathname.replace(
        /\/+$/,
        ""
      ) || "/";

    return clean === "/"
      ? HOME_ROUTE
      : clean;
  } catch {
    const clean =
      String(path)
        .split("?")[0]
        .split("#")[0]
        .replace(
          /\/+$/,
          ""
        ) || "/";

    return clean === "/"
      ? HOME_ROUTE
      : clean;
  }
}

function topLevelSegment(path) {
  const clean =
    normalizePath(path);

  const segment =
    clean.split("/")[1];

  return segment
    ? `/${segment}`
    : clean;
}

function isLeaguePage(path) {
  const clean =
    normalizePath(path);

  return (
    clean === "/league-page" ||
    clean.startsWith(
      "/league-page/"
    ) ||
    clean.startsWith(
      "/league/"
    )
  );
}

function resolveRoutePath(path) {
  const clean =
    normalizePath(path);

  const aliased =
    ROUTE_ALIASES[clean] ||
    clean;

  if (
    aliased.startsWith(
      "/league-page/"
    ) ||
    aliased.startsWith(
      "/league/"
    )
  ) {
    return "/league-page";
  }

  if (routes[aliased]) {
    return aliased;
  }

  const top =
    topLevelSegment(aliased);

  if (routes[top]) {
    return top;
  }

  return "404";
}

function resolveRoute(path) {
  return (
    routes[
      resolveRoutePath(path)
    ] ||
    routes["404"]
  );
}

/********* pwa helpers *********/

function isStandalonePWA() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.matchMedia(
      "(display-mode: fullscreen)"
    ).matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith(
      "android-app://"
    )
  );
}

function shouldSeedHomeBackStack(path) {
  const clean =
    normalizePath(path);

  if (!isStandalonePWA()) {
    return false;
  }

  if (clean === HOME_ROUTE) {
    return false;
  }

  if (isLeaguePage(clean)) {
    return false;
  }

  if (
    routes[clean] === undefined &&
    clean !== "/profile/coins"
  ) {
    return false;
  }

  return HOME_BACK_ROUTES.has(
    clean
  );
}

function seedHomeBackStack(path) {
  const clean =
    normalizePath(path);

  if (
    !shouldSeedHomeBackStack(
      clean
    )
  ) {
    return;
  }

  if (
    window.__pwaHomeBackSeeded
  ) {
    return;
  }

  window.__pwaHomeBackSeeded =
    true;

  history.replaceState(
    {
      path: HOME_ROUTE,
      __pwaHomeSeed: true,
    },
    "",
    HOME_ROUTE
  );

  history.pushState(
    {
      path: clean,
      __pwaHomeSeed: true,
    },
    "",
    clean
  );
}

/********* css *********/

function waitForStylesheets() {
  const links = [
    ...document.querySelectorAll(
      'link[rel="stylesheet"]'
    ),
  ];

  const required =
    links.filter((link) => {
      try {
        return REQUIRED_CSS.includes(
          new URL(
            link.href,
            location.origin
          ).pathname
        );
      } catch {
        return false;
      }
    });

  if (!required.length) {
    return Promise.resolve();
  }

  return Promise.allSettled(
    required.map(
      (link) =>
        new Promise(
          (resolve) => {
            if (link.sheet) {
              resolve();
              return;
            }

            link.addEventListener(
              "load",
              resolve,
              { once: true }
            );

            link.addEventListener(
              "error",
              resolve,
              { once: true }
            );
          }
        )
    )
  );
}

/********* page lifecycle *********/

function registerPage(
  name,
  hooks = {}
) {
  if (!name) {
    return;
  }

  pageRegistry.set(
    name,
    {
      init:
        typeof hooks.init ===
        "function"
          ? hooks.init
          : null,

      destroy:
        typeof hooks.destroy ===
        "function"
          ? hooks.destroy
          : null,
    }
  );
}

async function destroyActivePage() {
  if (!activePageName) {
    return;
  }

  const name =
    activePageName;

  const root =
    activePageRoot ||
    getMainPage();

  const hooks =
    pageRegistry.get(name);

  activePageName = null;
  activePageRoot = null;

  try {
    await hooks?.destroy?.(
      root
    );
  } catch (error) {
    console.error(
      `[Router] Destroy failed for ${name}:`,
      error
    );
  }
}

async function mountPage(
  name,
  root = getMainPage()
) {
  if (!name) {
    return;
  }

  if (
    activePageName === name
  ) {
    return;
  }

  await destroyActivePage();

  const hooks =
    pageRegistry.get(name);

  if (!hooks) {
    return;
  }

  activePageName = name;
  activePageRoot =
    root || getMainPage();

  try {
    await hooks.init?.(
      activePageRoot
    );
  } catch (error) {
    activePageName = null;
    activePageRoot = null;

    console.error(
      `[Router] Init failed for ${name}:`,
      error
    );
  }
}

/********* page lifecycle mapping *********/

function getPageLifecycleName(path) {
  const clean =
    normalizePath(path);

  const lifecycle = {
    "/overview": "OverviewPage",
    "/notifications": "NotificationsPage",
    "/leagues": "LeaguesPage",
    "/league-page": "LeaguePage",
    "/vip-tips": "VipTipsPage",
    "/predictions": "PredictionsPage",
    "/next-world-cup-count-downs":
      "NextWorldCupPage",
    "/profile": "ProfilePage",
    "/profile/coins": "CoinsPage",
    "/favourites": "FavouritesPage",
  };

  return lifecycle[clean] || null;
}

/********* nav *********/

function updateActiveNav() {
  const current =
    normalizePath(
      currentPath
    );

  document
    .querySelectorAll(
      ".bottom-nav .nav-item[href]"
    )
    .forEach((link) => {
      const href =
        link.getAttribute(
          "href"
        );

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http")
      ) {
        return;
      }

      let linkPath;

      try {
        linkPath =
          normalizePath(
            new URL(
              href,
              location.origin
            ).pathname
          );
      } catch {
        return;
      }

      const aliased =
        ROUTE_ALIASES[
          linkPath
        ] || linkPath;

      const active =
        (
          aliased ===
            "/league-page" &&
          isLeaguePage(
            current
          )
        ) ||
        aliased === current;

      link.classList.toggle(
        "active",
        active
      );

      link
        .querySelector("svg")
        ?.classList.toggle(
          "active",
          active
        );
    });
}

/********* page loading *********/

async function loadPage(
  path,
  forceReload = false
) {
  const route =
    resolveRoute(path);

  const response =
    await fetch(
      route.file,
      {
        cache: forceReload
          ? "reload"
          : "default",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Failed to load ${route.file}`
    );
  }

  return {
    html:
      await response.text(),
    file:
      route.file,
    route,
  };
}

/********* app scripts *********/

async function waitForPageScripts(
  root
) {
  if (
    !root ||
    typeof window.loadPageScript !==
      "function"
  ) {
    return;
  }

  const scripts = [
    ...root.querySelectorAll(
      "app-script[src]"
    ),
  ];

  if (!scripts.length) {
    return;
  }

  await Promise.all(
    scripts.map(
      async (element) => {
        const src =
          element.getAttribute(
            "src"
          );

        if (!src) {
          return;
        }

        try {
          await window.loadPageScript(
            src
          );
        } catch (error) {
          console.error(
            `[Router] Script failed: ${src}`,
            error
          );
        }
      }
    )
  );
}

/********* events *********/

function dispatchPageLoaded(
  path,
  details = {}
) {
  document.dispatchEvent(
    new CustomEvent(
      "pageLoaded",
      {
        detail: {
          path:
            normalizePath(path),
          ...details,
        },
      }
    )
  );
}

function dispatchPageRefreshed(
  path
) {
  document.dispatchEvent(
    new CustomEvent(
      "pageRefreshed",
      {
        detail: {
          path:
            normalizePath(path),
        },
      }
    )
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
  const target =
    normalizePath(path);

  const token =
    ++navigationToken;

  showLoader();

  try {
    await destroyActivePage();

    const {
      html,
      file,
      route,
    } =
      await loadPage(
        target,
        forceReload
      );

    if (
      token !==
      navigationToken
    ) {
      return;
    }

    const mainPage =
      getMainPage();

    if (!mainPage) {
      throw new Error(
        "#main-page not found"
      );
    }

    mainPage.innerHTML =
      html;

    await waitForPageScripts(
      mainPage
    );

    if (
      token !==
      navigationToken
    ) {
      return;
    }

    currentPath =
      target;

    if (updateHistory) {
      const state = {
        path: target,
      };

      if (pushHistory) {
        history.pushState(
          state,
          "",
          target
        );
      } else {
        history.replaceState(
          state,
          "",
          target
        );
      }
    }

    if (route.title) {
      document.title =
        `${route.title} | Scoutwave`;
    }

    updateActiveNav();

    dispatchPageLoaded(
      target,
      {
        file,
        route,
      }
    );

    const lifecycle =
      getPageLifecycleName(
        target
      );

    if (lifecycle) {
      await mountPage(
        lifecycle,
        mainPage
      );
    }
  } catch (error) {
    if (
      token !==
      navigationToken
    ) {
      return;
    }

    console.error(
      "[Router] Navigation failed:",
      error
    );

    const mainPage =
      getMainPage();

    if (mainPage) {
      mainPage.innerHTML = `
        <section class="page-error">
          <h1>404</h1>
          <p>Page not found.</p>
        </section>
      `;
    }
  } finally {
    if (
      token ===
      navigationToken
    ) {
      hideLoader();
    }
  }
}

/********* public api *********/

async function navigate(
  path,
  pushHistory = true,
  forceReload = false
) {
  return renderRoute(
    path,
    {
      updateHistory: true,
      pushHistory,
      forceReload,
    }
  );
}

async function refreshCurrentPage() {
  const path =
    normalizePath(
      currentPath
    );

  await renderRoute(
    path,
    {
      updateHistory: false,
      pushHistory: false,
      forceReload: true,
    }
  );

  dispatchPageRefreshed(
    path
  );
}

function goBack() {
  history.back();
}

/********* link routing *********/

document.addEventListener(
  "click",
  (event) => {
    const link =
      event.target.closest(
        "a[href]"
      );

    if (!link) {
      return;
    }

    if (
      link.target === "_blank" ||
      link.hasAttribute(
        "download"
      )
    ) {
      return;
    }

    if (
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
      url = new URL(
        link.href,
        location.origin
      );
    } catch {
      return;
    }

    if (
      url.origin !==
      location.origin
    ) {
      return;
    }

    if (
      url.pathname.startsWith(
        "/assets/"
      )
    ) {
      return;
    }

    if (
      /\.[a-z0-9]+$/i.test(
        url.pathname
      )
    ) {
      return;
    }

    const path =
      normalizePath(
        url.pathname
      );

    if (
      path ===
      normalizePath(
        currentPath
      )
    ) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    navigate(path);
  }
);

/********* browser navigation *********/

window.addEventListener(
  "popstate",
  (event) => {
    const path =
      normalizePath(
        event.state?.path ||
          window.location.pathname
      );

    renderRoute(
      path,
      {
        updateHistory: false,
        pushHistory: false,
        forceReload: false,
      }
    );
  }
);

/********* global api *********/

window.route = function (
  event
) {
  if (event) {
    event.preventDefault();
  }

  const link =
    event?.currentTarget ||
    event?.target?.closest(
      "a[href]"
    );

  if (!link) {
    return;
  }

  let url;

  try {
    url = new URL(
      link.href,
      location.origin
    );
  } catch {
    return;
  }

  if (
    url.origin !==
    location.origin
  ) {
    location.href =
      url.href;

    return;
  }

  navigate(
    url.pathname
  );
};

window.router = {
  navigate,
  refreshCurrentPage,
  goBack,

  getCurrentPath() {
    return normalizePath(
      currentPath
    );
  },

  registerPage,
  mountPage,
  destroyActivePage,
  resolveRoute,
};

/********* startup *********/

(async () => {
  await waitForStylesheets();

  const initialPath =
    normalizePath(
      window.location.pathname
    );

  seedHomeBackStack(
    initialPath
  );

  currentPath =
    initialPath;

  await renderRoute(
    initialPath,
    {
      updateHistory: false,
      pushHistory: false,
      forceReload: false,
    }
  );
})();