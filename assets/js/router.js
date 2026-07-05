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

function showLoader() {
  loader?.classList.remove("hidden");
}

function hideLoader() {
  loader?.classList.add("hidden");
}

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

async function loadPage(path) {
  
  const page = routes[path] || routes[404];
  
  if (pageCache.has(page)) {
    return pageCache.get(page);
  }
  
  const response = await fetch(page, {
    cache: "force-cache"
  });
  
  if (!response.ok) {
    throw new Error("Page not found");
  }
  
  const html = await response.text();
  
  pageCache.set(page, html);
  
  return html;
}

async function navigate(path, addHistory = true) {
  
  showLoader();
  
  if (path === "/") {
    path = "/overview";
  }
  
  try {
    
    // Load FIRST
    const html = await loadPage(path);
    
    // Render
    mainPage.innerHTML = html;
    
    // Change URL AFTER rendering
    if (addHistory) {
      history.pushState({}, "", path);
    } else {
      history.replaceState({}, "", path);
    }
    
    updateActiveNav();
    
    document.dispatchEvent(new Event("pageLoaded"));
    
  } catch (err) {
    
    mainPage.innerHTML = "<h1>404 - Page Not Found</h1>";
    console.error(err);
    
  } finally {
    
    hideLoader();
    
  }
}

window.route = function(event) {
  
  event.preventDefault();
  
  const link = event.currentTarget || event.target.closest("a");
  
  if (!link) return;
  
  const path = new URL(link.href).pathname;
  
  if (path === window.location.pathname) return;
  
  navigate(path);
  
};

window.addEventListener("popstate", () => {
  navigate(window.location.pathname, false);
});

// Initial load
navigate(window.location.pathname, false);