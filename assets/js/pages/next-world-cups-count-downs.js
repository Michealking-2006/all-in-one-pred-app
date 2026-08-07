/*********************
 * WORLD CUP COUNTDOWN PAGE
 *********************/

let WORLD_CUP_DATA = null;

const WORLD_CUP_PAGE = {
  active: false,
  interval: null
};

/*----------------------------------
Helpers
----------------------------------*/
function getCurrentPath() {
  try {
    return window.router?.getCurrentPath?.() || location.pathname;
  } catch {
    return location.pathname;
  }
}

function escapeHTML(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRemaining(diff) {
  const safeDiff = Math.max(0, diff);
  
  const days = Math.floor(safeDiff / 86400000);
  const hours = Math.floor((safeDiff % 86400000) / 3600000);
  const minutes = Math.floor((safeDiff % 3600000) / 60000);
  const seconds = Math.floor((safeDiff % 60000) / 1000);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getCountdownContainer() {
  return document.getElementById("world-cup-countdown");
}

/*----------------------------------
Load JSON once
----------------------------------*/
async function getWorldCupData() {
  if (WORLD_CUP_DATA) return WORLD_CUP_DATA;
  
  const res = await fetch("/assets/data/next-world-cups-count-downs.json");
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  
  const data = await res.json();
  
  WORLD_CUP_DATA = Array.isArray(data) ?
    data.sort((a, b) => new Date(a.start) - new Date(b.start)) :
    [];
  
  return WORLD_CUP_DATA;
}

/*----------------------------------
Render
----------------------------------*/
function renderWorldCupCountdown() {
  const container = getCountdownContainer();
  if (!container) return;
  
  const now = Date.now();
  const tournaments = WORLD_CUP_DATA || [];
  
  let tournament = tournaments.find(t => {
    const start = new Date(t.start).getTime();
    const end = new Date(t.end).getTime();
    return now >= start && now <= end;
  });
  
  if (!tournament) {
    tournament = tournaments.find(t => new Date(t.start).getTime() > now);
  }
  
  if (!tournament) {
    container.innerHTML = `
      <div class="wc-card">
        <h3>No upcoming World Cup.</h3>
      </div>
    `;
    return;
  }
  
  const start = new Date(tournament.start).getTime();
  const end = new Date(tournament.end).getTime();
  const live = now >= start && now <= end;
  
  const diff = live ? end - now : start - now;
  const remaining = formatRemaining(diff);
  
  container.innerHTML = `
    <div class="wc-card">
      <small class="tournament-type">${escapeHTML(tournament.type)}</small>

      <h2>${escapeHTML(tournament.year)}</h2>
      <h3>${escapeHTML(tournament.name)}</h3>

      <p class="tournament-host-countries-wc-c-p">
        <strong>Host:</strong> ${escapeHTML(tournament.host)}
      </p>

      ${
        live
          ? `
            <span class="wc-live">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6.343 4.938a1 1 0 0 1 0 1.415a8.003 8.003 0 0 0 0 11.317a1 1 0 1 1-1.414 1.414c-3.907-3.906-3.907-10.24 0-14.146a1 1 0 0 1 1.414 0Zm12.732 0c3.906 3.907 3.906 10.24 0 14.146a1 1 0 0 1-1.415-1.414a8.003 8.003 0 0 0 0-11.317a1 1 0 0 1 1.415-1.415ZM9.31 7.812a1 1 0 0 1 0 1.414a3.92 3.92 0 0 0 0 5.544a1 1 0 1 1-1.415 1.414a5.92 5.92 0 0 1 0-8.372a1 1 0 0 1 1.415 0Zm6.958 0a5.92 5.92 0 0 1 0 8.372a1 1 0 0 1-1.414-1.414a3.92 3.92 0 0 0 0-5.544a1 1 0 0 1 1.414-1.414Zm-4.186 2.77a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3Z"/>
              </svg>
              LIVE
            </span>

            <h1>${remaining}</h1>
            <small>Remaining until the tournament ends</small>
          `
          : `
            <h1>${remaining}</h1>
            <small>Until kick-off ⚽</small>
          `
      }
    </div>
  `;
}

/*----------------------------------
Start / Stop
----------------------------------*/
async function startWorldCupCountdown() {
  await getWorldCupData();
  
  stopWorldCupCountdown();
  
  const update = () => {
    if (!WORLD_CUP_PAGE.active) return;
    renderWorldCupCountdown();
  };
  
  update();
  WORLD_CUP_PAGE.interval = setInterval(update, 1000);
}

function stopWorldCupCountdown() {
  if (WORLD_CUP_PAGE.interval) {
    clearInterval(WORLD_CUP_PAGE.interval);
    WORLD_CUP_PAGE.interval = null;
  }
}

/*----------------------------------
Page lifecycle
----------------------------------*/
function initWorldCupPage() {
  const path = getCurrentPath();
  
  if (path !== "/next-world-cup-count-downs") {
    destroyWorldCupPage();
    return;
  }
  
  if (WORLD_CUP_PAGE.active) return;
  
  WORLD_CUP_PAGE.active = true;
  startWorldCupCountdown();
}

function destroyWorldCupPage() {
  WORLD_CUP_PAGE.active = false;
  stopWorldCupCountdown();
}

/*----------------------------------
Events
----------------------------------*/
function handleWorldCupRouteChange(e) {
  const path = e?.detail?.path || getCurrentPath();
  
  if (path === "/next-world-cup-count-downs") {
    initWorldCupPage();
  } else {
    destroyWorldCupPage();
  }
}

document.addEventListener("pageLoaded", handleWorldCupRouteChange);
document.addEventListener("pageRefreshed", handleWorldCupRouteChange);

/* Boot immediately if already on page */
if (getCurrentPath() === "/next-world-cup-count-downs") {
  queueMicrotask(initWorldCupPage);
}

/* Optional router registry */
window.router?.registerPage?.("WorldCupCountdownPage", {
  init: initWorldCupPage,
  destroy: destroyWorldCupPage
});