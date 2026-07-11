document.addEventListener("click", e => {
  const link = e.target.closest("a[href]");
  
  if (!link) return;
  
  const url = new URL(link.href);
  
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
  "/next-world-cup-count-downs": "/pages/next-world-cup-count-downs.html"
};

const loader = document.getElementById("page-loader");
const mainPage = document.getElementById("main-page");

const pageCache = new Map();

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
   Bottom Navigation
========================== */

function updateActiveNav() {
  const current = window.location.pathname;
  
  document.querySelectorAll(".bottom-nav .nav-item[href]").forEach(link => {
    
    const href = link.getAttribute("href");
    
    if (!href || href.startsWith("#") || href.startsWith("http")) return;
    
    const active = href === current;
    
    link.classList.toggle("active", active);
    link.querySelector("svg")?.classList.toggle("active", active);
    
  });
}

/* ==========================
   Load HTML
========================== */

async function loadPage(path) {
  
  const page = routes[path] || routes[404];
  
  if (pageCache.has(page)) {
    return pageCache.get(page);
  }
  
  const response = await fetch(page, {
    cache: "force-cache"
  });
  
  if (!response.ok) {
    throw new Error(`Failed to load ${page}`);
  }
  
  const html = await response.text();
  
  pageCache.set(page, html);
  
  return html;
  
}

/* ==========================
   Navigate
========================== */

async function navigate(path, pushHistory = true) {
  
  if (path === "/") {
    path = "/overview";
  }
  
  const page = routes[path] || routes[404];
  const cached = pageCache.has(page);
  
  const token = ++navigationToken;
  
  if (!cached) {
    showLoader();
  }
  
  try {
    
    const html = await loadPage(path);
    
    // Ignore old navigation requests
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
  
}

/* ==========================
   Link Routing
========================== */

window.route = function(event) {
  
  event = event || window.event;
  
  if (event) {
    event.preventDefault();
  }
  
  const link =
    event?.currentTarget ||
    event?.target?.closest("a");
  
  if (!link) return;
  
  const url = new URL(link.href, location.origin);
  
  // External link
  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }
  
  const path = url.pathname;
  
  if (path === window.location.pathname) return;
  
  navigate(path);
  
};

/* ==========================
   Browser Back/Forward
========================== */

window.addEventListener("popstate", () => {
  navigate(window.location.pathname, false);
});

/* ==========================
   Initial Page
========================== */

(async () => {
  await waitForStylesheets();
  navigate(window.location.pathname, false);
})();