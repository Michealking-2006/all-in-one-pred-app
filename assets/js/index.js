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
  
  dates.forEach((date, index) => {
    const card = document.createElement("div");
    card.className = "date-card";
    
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
    
    card.addEventListener("click", () => {
      dateScroll.querySelectorAll(".date-card")
        .forEach(c => c.classList.remove("active"));
      
      card.classList.add("active");
      
      const selectedDate = [
        date.getDate(),
        date.getMonth() + 1,
        date.getFullYear()
      ];
      
      console.log(selectedDate);
      
      window.dispatchEvent(new CustomEvent("dateSelected", {
        detail: selectedDate
      }));
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

// Run after each SPA page load
document.addEventListener("pageLoaded", initDateUI);

initDateUI();


/******* cookie  ******/

/**********************
 * SPA INITIALIZER
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
    
    function lockPage() {
      document.body.classList.add("cookie-active");
      document.body.style.overflow = "hidden";
    }
    
    function unlockPage() {
      document.body.classList.remove("cookie-active");
      document.body.style.overflow = "";
    }
    
    function showCookie() {
      cookieBox.classList.add("show");
      cookieOverlay.classList.add("show");
      lockPage();
    }
    
    function hideCookie() {
      cookieBox.classList.remove("show");
      cookieOverlay.classList.remove("show");
      unlockPage();
    }
    
    const status = localStorage.getItem("cookiesAccepted");
    
    if (status !== "true") {
      setTimeout(() => {
        // Ensure we're still on a page containing the cookie banner
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
      header.parentElement.classList.toggle("active");
    });
    
  });
  
}

/**********************
 * SPA BOOT
 **********************/

// Initial page load
initAppUI();

// Run after every SPA navigation
document.addEventListener("pageLoaded", initAppUI);




/**********************
 * SEARCH UI
 **********************/

function initSearchUI() {
  
  /* ==========================
     SEARCH DRAWER
  ========================== */
  
  const openBtn = document.querySelector(".search-app-btn");
  const closeBtn = document.querySelector(".close-index-search-btn");
  const searchBox = document.querySelector(".app-index-search-box");
  const overlay = document.querySelector(".search-overlay");
  
  if (
    openBtn &&
    closeBtn &&
    searchBox &&
    overlay &&
    !searchBox.dataset.initialized
  ) {
    searchBox.dataset.initialized = "true";
    
    function openSearch() {
      searchBox.classList.add("active");
      overlay.classList.add("active");
      
      searchBox.querySelector("input")?.focus();
    }
    
    function closeSearch() {
      searchBox.classList.remove("active");
      overlay.classList.remove("active");
    }
    
    openBtn.addEventListener("click", openSearch);
    closeBtn.addEventListener("click", closeSearch);
    overlay.addEventListener("click", closeSearch);
  }
  
  /* ==========================
     RECENT SEARCHES
  ========================== */
  
  const searchInput = document.getElementById("app-main-search-input");
  const recentBox = document.querySelector(".recent-searches-box");
  
  if (
    !searchInput ||
    !recentBox ||
    searchInput.dataset.initialized
  ) {
    return;
  }
  
  searchInput.dataset.initialized = "true";
  
  const STORAGE_KEY = "recentSearches";
  const MAX_SEARCHES = 15;
  
  let searches =
    JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  
  function saveSearches() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(searches)
    );
  }
  
  function renderSearches() {
    recentBox.innerHTML = "";
    
    searches.forEach((search, index) => {
      
      const item = document.createElement("div");
      item.className = "recent-search-item";
      
      item.innerHTML = `
        <svg class="recent-searches-icon" xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="none">
          <g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <path d="M12 8v4l2 2"/>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
          </g>
        </svg>

        <span class="search-text">${search}</span>

        <button class="remove-search-btn" data-index="${index}" aria-label="Remove search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path fill="currentColor" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
          </svg>
        </button>
      `;
      
      recentBox.appendChild(item);
      
    });
    
  }
  
  function addSearch(value) {
    
    value = value.trim();
    
    if (!value) return;
    
    searches = searches.filter(
      item => item.toLowerCase() !== value.toLowerCase()
    );
    
    searches.unshift(value);
    
    searches = searches.slice(0, MAX_SEARCHES);
    
    saveSearches();
    renderSearches();
  }
  
  searchInput.addEventListener("keydown", e => {
    
    if (e.key === "Enter") {
      addSearch(searchInput.value);
    }
    
  });
  
  recentBox.addEventListener("click", e => {
    
    const btn = e.target.closest(".remove-search-btn");
    
    if (!btn) return;
    
    const index = Number(btn.dataset.index);
    const item = btn.closest(".recent-search-item");
    
    item?.classList.add("removing");
    
    setTimeout(() => {
      
      searches.splice(index, 1);
      
      saveSearches();
      renderSearches();
      
    }, 300);
    
  });
  
  renderSearches();
  
}

/**********************
 * SPA BOOT
 **********************/

// Initial page load
initSearchUI();

// After every SPA navigation
document.addEventListener("pageLoaded", initSearchUI);


/**********************
 * THEME + PREDICTIONS
 **********************/

function initThemeAndPredictions() {
  
  /* ==========================
     DARK THEME
  ========================== */
  
  const themeToggle = document.getElementById("app-theme-toggle");
  
  // Apply saved theme
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    
    if (themeToggle) {
      themeToggle.checked = true;
    }
  } else {
    document.body.classList.remove("dark-theme");
    
    if (themeToggle) {
      themeToggle.checked = false;
    }
  }
  
  // Only bind once
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
      
      document
        .querySelector(".prediction-link.active")
        ?.classList.remove("active");
      
      link.classList.add("active");
      
      const market = link.dataset.market;
      
      console.log(market);
      
      // fetchPredictions(market);
      
    });
    
  });
  
}

/**********************
 * SPA BOOT
 **********************/

// Initial page load
initThemeAndPredictions();

// Run after every SPA page change
document.addEventListener("pageLoaded", initThemeAndPredictions);