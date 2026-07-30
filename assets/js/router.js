document.addEventListener("click", e => {
  const link = e.target.closest("a[href]");
  
  if (!link) return;
  
  const url = new URL(link.href, location.origin);
  
  if (url.origin !== location.origin) return;
  
  e.preventDefault();
  navigate(url.pathname);
});

/* ==========================
   Wait for required CSS
========================== */

const REQUIRED_CSS = [
  "/assets/css/components.css",
  "/assets/css/index.css"
];

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
   Route helpers
========================== */

function normalizePath(path) {
  if (!path) return "/overview";
  
  if (path === "/") return "/overview";
  
  return path.replace(/\/+$/, "") || "/";
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
  const current = normalizePath(window.location.pathname);
  
  document.querySelectorAll(".bottom-nav .nav-item[href]").forEach(link => {
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

async function loadPage(path) {
  const page = resolveRoute(path);
  
  const response = await fetch(page);
  
  if (!response.ok) {
    throw new Error(`Failed to load ${page}`);
  }
  
  return await response.text();
}

/* ==========================
   Navigate
========================== */

async function navigate(path, pushHistory = true) {
  path = normalizePath(path);
  
  const token = ++navigationToken;
  
  showLoader();
  
  try {
    const html = await loadPage(path);
    
    if (token !== navigationToken) return;
    if (!mainPage) return;
    
    mainPage.replaceChildren();
    mainPage.insertAdjacentHTML("afterbegin", html);
    
    if (pushHistory) {
      history.pushState({}, "", path);
    } else {
      history.replaceState({}, "", path);
    }
    
    updateActiveNav();
    document.dispatchEvent(new Event("pageLoaded"));
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
  
  console.log("PATH:", path);
  console.log("PAGE:", resolveRoute(path));
}

/* ==========================
   Link Routing
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
  
  if (path === normalizePath(window.location.pathname)) return;
  
  navigate(path);
};

/* ==========================
   Browser Back/Forward
========================== */

window.addEventListener("popstate", () => {
  navigate(window.location.pathname, false);
});


async function refreshCurrentPage() {
  return navigate(window.location.pathname, false);
}

/* ==========================
   Initial Page
========================== */

(async () => {
  await waitForStylesheets();
  navigate(window.location.pathname, false);
})();