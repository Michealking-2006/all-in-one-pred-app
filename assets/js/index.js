/********************* APP DATE UI ********************/

function initDateUI() {
  const dateScroll = document.getElementById("dateScroll");
  
  // Exit if this page doesn't contain the date scroller
  if (!dateScroll) return;
  
  // Prevent duplicate initialization
  if (dateScroll.dataset.initialized) return;
  dateScroll.dataset.initialized = "true";
  
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  
  const dates = [];
  
  for (let i = -7; i <= 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  
  dateScroll.innerHTML = "";
  
  dates.forEach((date, index) => {
    const card = document.createElement("div");
    card.className = "date-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    
    if (index === 7) {
      card.classList.add("active");
    }
    
    const dayName = document.createElement("div");
    dayName.className = "day-name";
    dayName.textContent = index === 7 ? "Today" : DAYS[date.getDay()];
    
    const circle = document.createElement("div");
    circle.className = "date-circle";
    circle.textContent = date.getDate();
    
    card.append(dayName, circle);
    
    const emitSelection = () => {
      dateScroll.querySelectorAll(".date-card")
        .forEach(c => c.classList.remove("active"));
      
      card.classList.add("active");
      
      const selectedDate = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        iso: new Date(date).toISOString().slice(0, 10)
      };
      
      window.dispatchEvent(new CustomEvent("dateSelected", {
        detail: selectedDate
      }));
    };
    
    card.addEventListener("click", emitSelection);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        emitSelection();
      }
    });
    
    dateScroll.appendChild(card);
  });
  
  // Center today's card
  requestAnimationFrame(() => {
    const active = dateScroll.querySelector(".date-card.active");
    
    if (active) {
      active.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  });
}

/********************* APP TABS UI ********************/

function initTabsUI() {
  if (window.__tabsUIBound) return;
  window.__tabsUIBound = true;
  
  document.addEventListener("click", e => {
    const tabBtn = e.target.closest(".tab[data-tab]");
    if (!tabBtn) return;
    
    const tabsRoot = tabBtn.closest(".tabs");
    if (!tabsRoot) return;
    
    const pageRoot =
      tabBtn.closest(".league-page") ||
      tabBtn.closest("main") ||
      document;
    
    const targetId = tabBtn.dataset.tab;
    const targetPage = document.getElementById(targetId);
    
    // Remove active state inside the current page group
    pageRoot.querySelector(".tab.active")?.classList.remove("active");
    pageRoot.querySelector(".page.active")?.classList.remove("active");
    
    tabBtn.classList.add("active");
    targetPage?.classList.add("active");
    
    // Small hook for any page-specific tab behavior
    window.dispatchEvent(new CustomEvent("tabChanged", {
      detail: { tab: targetId }
    }));
  });
}

/**********************
 * COOKIE CONSENT
 **********************/

function initAppUI() {
  
  /* ==========================
     COOKIE CONSENT
  ========================== */
  
  const cookieBox = document.getElementById("cookieBox");
  const cookieOverlay = document.getElementById("cookieOverlay");
  const acceptCookies = document.getElementById("acceptCookies");
  const declineCookies = document.getElementById("declineCookies");
  
  if (
    cookieBox &&
    cookieOverlay &&
    acceptCookies &&
    declineCookies &&
    !cookieBox.dataset.initialized
  ) {
    cookieBox.dataset.initialized = "true";
    
    const lockPage = () => {
      document.body.classList.add("cookie-active");
      document.body.style.overflow = "hidden";
    };
    
    const unlockPage = () => {
      document.body.classList.remove("cookie-active");
      document.body.style.overflow = "";
    };
    
    const showCookie = () => {
      cookieBox.classList.add("show");
      cookieOverlay.classList.add("show");
      lockPage();
    };
    
    const hideCookie = () => {
      cookieBox.classList.remove("show");
      cookieOverlay.classList.remove("show");
      unlockPage();
    };
    
    const status = localStorage.getItem("cookiesAccepted");
    
    if (status !== "true") {
      setTimeout(() => {
        if (document.body.contains(cookieBox)) {
          showCookie();
        }
      }, 5000);
    }
    
    acceptCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "true");
      hideCookie();
    });
    
    declineCookies.addEventListener("click", () => {
      localStorage.setItem("cookiesAccepted", "false");
      hideCookie();
    });
  }
  
  /* ==========================
     MORE MENU
  ========================== */
  
  const closeNavBtn = document.querySelector(".close-nav-btn");
  const appMainProfileSec = document.querySelector(".app-main-profile-sec");
  const hamburger = document.querySelector(".app-more-nav-hamburger-menu");
  
  if (
    closeNavBtn &&
    appMainProfileSec &&
    hamburger &&
    !hamburger.dataset.initialized
  ) {
    hamburger.dataset.initialized = "true";
    
    hamburger.addEventListener("click", () => {
      appMainProfileSec.classList.add("active");
    });
    
    closeNavBtn.addEventListener("click", () => {
      appMainProfileSec.classList.remove("active");
    });
  }
  
  /* ==========================
     COLLAPSIBLE MENUS
  ========================== */
  
  document.querySelectorAll(".menu-header").forEach(header => {
    if (header.dataset.initialized) return;
    
    header.dataset.initialized = "true";
    
    header.addEventListener("click", () => {
      header.parentElement?.classList.toggle("active");
    });
  });
}

/* ==========================
   SEARCH DRAWER
========================== */

function initSearchUI() {  
  
const openBtn = document.querySelector(".search-app-btn");
const closeBtn = document.querySelector(".close-index-search-btn");
const drawer = document.querySelector(".search-drawer");
const backdrop = document.querySelector(".search-backdrop");
const input = document.getElementById("app-main-search-input");

if (
  openBtn &&
  closeBtn &&
  drawer &&
  backdrop &&
  !drawer.dataset.initialized
) {
  drawer.dataset.initialized = "true";
  
  function openSearch() {
    drawer.classList.add("active");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    

  }
  
  function closeSearch() {
    drawer.classList.remove("active");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  }
  
  openBtn.addEventListener("click", openSearch);
  
  closeBtn.addEventListener("click", closeSearch);
  
  backdrop.addEventListener("click", closeSearch);
  
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeSearch();
    }
  });
  
}


}

/**********************
 * THEME + PREDICTIONS
 **********************/

function initThemeAndPredictions() {
  
  /* ==========================
     DARK THEME
  ========================== */
  
  const themeToggle = document.getElementById("app-theme-toggle");
  
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    if (themeToggle) themeToggle.checked = true;
  } else {
    document.body.classList.remove("dark-theme");
    if (themeToggle) themeToggle.checked = false;
  }
  
  if (themeToggle && !themeToggle.dataset.initialized) {
    themeToggle.dataset.initialized = "true";
    
    themeToggle.addEventListener("change", function() {
      if (this.checked) {
        document.body.classList.add("dark-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-theme");
        localStorage.setItem("theme", "light");
      }
    });
  }
  

  /* ==========================
     PREDICTION MARKET TABS
  ========================== */
  
  document.querySelectorAll(".prediction-link").forEach(link => {
    if (link.dataset.initialized) return;
    
    link.dataset.initialized = "true";
    
    link.addEventListener("click", e => {
      e.preventDefault();
      
      document.querySelector(".prediction-link.active")?.classList.remove("active");
      link.classList.add("active");
      
      const market = link.dataset.market;
      console.log(market);
    });
  });
}

/**********************
 * APP BOOT
 **********************/

function bootAppUI() {
  initTabsUI();
  initDateUI();
  initAppUI();
  initSearchUI();
  initThemeAndPredictions();
}

bootAppUI();

document.addEventListener("pageLoaded", bootAppUI);