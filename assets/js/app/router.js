/********* CSS *********/

const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css"
];

async function waitForStylesheets() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];

  const required = REQUIRED_CSS
    .map(path =>
      links.find(link => {
        try {
          return new URL(link.href, location.origin).pathname === path;
        } catch {
          return false;
        }
      })
    )
    .filter(Boolean);

  await Promise.all(
    required.map(link => {
      if (link.sheet) return Promise.resolve();

      return new Promise(resolve => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
      });
    })
  );
}


/********* ROUTES *********/

const HOME_ROUTE = "/overview";

const ROUTE_ALIASES = {
  "/": HOME_ROUTE,
  "/home": HOME_ROUTE
};

const routes = {
  404: {
    file: "/pages/404.html",
    title: "Page Not Found"
  },

  "/overview": {
    file: "/pages/overview.html",
    title: "Overview"
  },

  "/notifications": {
    file: "/pages/notifications.html",
    title: "Notifications"
  },

  "/league-page": {
    file: "/pages/league-page.html",
    title: "League"
  },

  "/leagues": {
    file: "/pages/leagues.html",
    title: "Leagues"
  },

  "/vip-tips": {
    file: "/pages/vip-tips.html",
    title: "VIP Tips"
  },

  "/predictions": {
    file: "/pages/predictions.html",
    title: "Predictions"
  },

  "/next-world-cup-count-downs": {
    file: "/pages/next-world-cup-count-downs.html",
    title: "Next World Cup"
  },

  "/profile": {
    file: "/pages/profile.html",
    title: "Profile"
  },

  "/profile/coins": {
    file: "/pages/profile/coin.html",
    title: "Coins"
  },

  "/favourites": {
    file: "/pages/favourites.html",
    title: "Favourites"
  }
};


/********* STATE *********/

const pageCache = new Map();

let currentPath = HOME_ROUTE;
let navigationToken = 0;


/********* DOM *********/

function getMainPage() {
  return document.getElementById("main-page");
}

function getLoader() {
  return document.getElementById("page-loader");
}

function showLoader() {
  getLoader()?.classList.remove("hidden");
}

function hideLoader() {
  getLoader()?.classList.add("hidden");
}


/********* PATH *********/

function normalizePath(path) {
  if (!path) return HOME_ROUTE;

  try {
    const url = new URL(path, location.origin);

    let pathname = url.pathname
      .replace(/\/+$/, "");

    if (!pathname) pathname = "/";

    return ROUTE_ALIASES[pathname] || pathname;
  } catch {
    return HOME_ROUTE;
  }
}

function resolveRoute(path) {
  const cleanPath = normalizePath(path);

  if (routes[cleanPath]) {
    return {
      path: cleanPath,
      ...routes[cleanPath]
    };
  }

  if (
    cleanPath.startsWith("/league-page/")
  ) {
    return {
      path: "/league-page",
      ...routes["/league-page"]
    };
  }

  if (
    cleanPath.startsWith("/league/")
  ) {
    return {
      path: "/league-page",
      ...routes["/league-page"]
    };
  }

  return {
    path: "404",
    ...routes[404]
  };
}


/********* ACTIVE NAV *********/

function updateActiveNav() {
  const path = normalizePath(currentPath);

  document
    .querySelectorAll(".bottom-nav .nav-item[href]")
    .forEach(link => {
      const href = link.getAttribute("href");

      if (!href || href.startsWith("#")) return;

      let linkPath;

      try {
        linkPath = normalizePath(
          new URL(href, location.origin).pathname
        );
      } catch {
        return;
      }

      const active =
        linkPath === path ||
        (
          linkPath === "/league-page" &&
          path.startsWith("/league-page")
        );

      link.classList.toggle("active", active);
      link.querySelector("svg")
        ?.classList.toggle("active", active);
    });
}


/********* LOAD PAGE *********/

async function loadPage(path) {
  const route = resolveRoute(path);

  if (pageCache.has(route.file)) {
    return {
      ...route,
      html: pageCache.get(route.file)
    };
  }

  const response = await fetch(route.file, {
    cache: "default"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${route.file}`);
  }

  const html = await response.text();

  pageCache.set(route.file, html);

  return {
    ...route,
    html
  };
}


/********* LOAD PAGE SCRIPTS *********/

async function loadPageScripts(root) {
  if (
    !root ||
    typeof window.loadPageScript !== "function"
  ) {
    return;
  }

  const elements = [
    ...root.querySelectorAll("app-script[src]")
  ];

  if (!elements.length) return;

  const scripts = [
    ...new Set(
      elements
        .map(element => element.getAttribute("src"))
        .filter(Boolean)
    )
  ];

  await Promise.all(
    scripts.map(async src => {
      try {
        await window.loadPageScript(src);
      } catch (error) {
        console.error(
          `[Router] Failed to load page script: ${src}`,
          error
        );
      }
    })
  );
}


/********* PAGE EVENT *********/

function dispatchPageLoaded(path, route) {
  document.dispatchEvent(
    new CustomEvent("pageLoaded", {
      detail: {
        path,
        file: route.file,
        title: route.title
      }
    })
  );
}


/********* NAVIGATION *********/

async function navigate(
  path,
  pushHistory = true
) {
  const target = normalizePath(path);
  const token = ++navigationToken;

  if (
    pushHistory &&
    target === normalizePath(location.pathname)
  ) {
    return;
  }

  showLoader();

  try {
    /*
      Load the new page FIRST.
      Do not destroy the current page until
      the new HTML has loaded successfully.
    */
    const page = await loadPage(target);

    if (token !== navigationToken) return;

    const mainPage = getMainPage();

    if (!mainPage) {
      throw new Error("#main-page not found");
    }

    /*
      Replace the page.
    */
    mainPage.innerHTML = page.html;

    /*
      IMPORTANT:
      The complete HTML now exists in the DOM.
      Only now load its app scripts.
    */
    await loadPageScripts(mainPage);

    if (token !== navigationToken) return;

    currentPath = page.path;

    if (pushHistory) {
      history.pushState(
        { path: page.path },
        "",
        page.path
      );
    } else {
      history.replaceState(
        { path: page.path },
        "",
        page.path
      );
    }

    if (page.title) {
      document.title = `${page.title} | Beelooo`;
    }

    updateActiveNav();

    /*
      This event fires EVERY TIME the page is mounted,
      even when its JS file was loaded before.
    */
    dispatchPageLoaded(
      page.path,
      page
    );

  } catch (error) {

    if (token !== navigationToken) return;

    console.error(
      "[Router] Navigation failed:",
      error
    );

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


/********* LINK ROUTING *********/

document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");

  if (!link) return;

  if (
    link.target === "_blank" ||
    link.hasAttribute("download") ||
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

  if (url.origin !== location.origin) return;

  if (
    url.pathname.startsWith("/assets/") ||
    /\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    return;
  }

  const path = normalizePath(url.pathname);

  /*
    Hash links are NOT SPA routes.
    This keeps things like #create-customer working.
  */
  if (url.hash) {
    if (path === normalizePath(location.pathname)) {
      return;
    }
  }

  event.preventDefault();

  navigate(path);
});


/********* BROWSER BACK / FORWARD *********/

window.addEventListener("popstate", event => {
  const path = normalizePath(
    event.state?.path ||
    location.pathname
  );

  navigate(path, false);
});


/********* PUBLIC API *********/

window.navigate = navigate;

window.route = function(event) {
  event?.preventDefault();

  const link =
    event?.currentTarget ||
    event?.target?.closest("a[href]");

  if (!link) return;

  navigate(
    new URL(link.href, location.origin).pathname
  );
};


/********* START APP *********/

(async function boot() {
  try {
    await waitForStylesheets();

    await navigate(
      location.pathname,
      false
    );
  } catch (error) {
    console.error(
      "[Router] Startup failed:",
      error
    );
  }
})();