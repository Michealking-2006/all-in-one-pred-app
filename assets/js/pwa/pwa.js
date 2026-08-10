(function () {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  /********* module state *********/

  let destroyPullToRefresh = null;
  let ptrIndicator = null;

  /********* pwa detection *********/

  function isStandalonePWA() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true ||
      document.referrer.startsWith("android-app://")
    );
  }

  function syncStandaloneClass() {
    const standalone = isStandalonePWA();

    document.documentElement.classList.toggle(
      "pwa-standalone",
      standalone
    );

    document.documentElement.classList.toggle(
      "pwa-not-standalone",
      !standalone
    );

    return standalone;
  }

  /********* scroll helpers *********/

  function getScrollTop() {
    return Math.max(
      window.pageYOffset || 0,
      document.documentElement.scrollTop || 0,
      document.body?.scrollTop || 0
    );
  }

  /********* timing helpers *********/

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  /********* pull to refresh indicator *********/

  function createPTRIcon(indicator) {
    if (!indicator) return null;

    let icon = indicator.querySelector(".ptr-icon");
    if (icon) return icon;

    indicator.innerHTML = `
      <svg
        class="ptr-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="4"
        >
          <path d="M42 8V24" />
          <path d="M6 24L6 40" />
          <path d="M42 24C42 14.0589 33.9411 6 24 6C18.9145 6 14.3216 8.10896 11.0481 11.5" />
          <path d="M6 24C6 33.9411 14.0589 42 24 42C28.8556 42 33.2622 40.0774 36.5 36.9519" />
        </g>
      </svg>
    `;

    return indicator.querySelector(".ptr-icon");
  }

  function getPTRIndicator() {
    return document.querySelector(".ptr-indicator");
  }

  function ensurePTRIndicator() {
    if (!isStandalonePWA()) return null;

    const indicator = getPTRIndicator();
    if (!indicator) return null;

    ptrIndicator = indicator;
    createPTRIcon(ptrIndicator);

    return ptrIndicator;
  }

  function removePTRIndicator() {
    if (!ptrIndicator) return;

    ptrIndicator.classList.remove("active", "loading");
    ptrIndicator.style.removeProperty("--ptr-y");
    ptrIndicator.style.removeProperty("--ptr-progress");
  }
  
  /********* pwa native interaction *********/

function disablePwaBrowserInteractions() {
  if (!isStandalonePWA()) return;

  document.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "dragstart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "selectstart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturechange",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gestureend",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
}

  /********* pull to refresh *********/

  function initPullToRefresh(onRefresh, options = {}) {
    const root = options.root || document;
    const indicator = options.indicator || ensurePTRIndicator();

    if (!root || !indicator) return null;

    /********* state *********/

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;

    /********* configuration *********/

    const START_ZONE = 90;
    const TRIGGER = 85;
    const MAX_PULL = 130;

    /********* pull easing *********/

    function easePull(distance) {
      if (distance <= 0) return 0;

      return Math.min(
        MAX_PULL,
        distance * 0.45 + Math.sqrt(distance) * 2
      );
    }

    /********* indicator position *********/

    function setIndicatorY(y) {
      indicator.style.setProperty("--ptr-y", `${y}px`);
    }

    /********* pulling state *********/

    function showPulling(pull) {
      indicator.classList.add("active");
      indicator.classList.remove("loading");

      setIndicatorY(Math.max(-80, pull - 80));

      const progress = Math.min(
        1,
        Math.max(0, pull / TRIGGER)
      );

      indicator.style.setProperty("--ptr-progress", progress);
    }

    /********* loading state *********/

    function showLoading() {
      indicator.classList.add("active", "loading");
      indicator.style.setProperty("--ptr-progress", "1");
      setIndicatorY(16);
    }

    /********* reset indicator *********/

    function reset() {
      pulling = false;
      startY = 0;
      currentY = 0;

      indicator.classList.remove("active", "loading");
      indicator.style.removeProperty("--ptr-y");
      indicator.style.removeProperty("--ptr-progress");
    }

    /********* touch start *********/

    function onTouchStart(event) {
      if (refreshing) return;
      if (getScrollTop() > 0) return;

      const touch = event.touches?.[0];
      if (!touch) return;

      const y = touch.clientY;
      if (y > START_ZONE) return;

      startY = y;
      currentY = y;
      pulling = true;
    }

    /********* touch move *********/

    function onTouchMove(event) {
      if (!pulling || refreshing) return;

      const touch = event.touches?.[0];
      if (!touch) return;

      currentY = touch.clientY;

      const distance = currentY - startY;
      if (distance <= 0) return;

      if (getScrollTop() > 0) {
        reset();
        return;
      }

      event.preventDefault();

      const pull = easePull(distance);
      showPulling(pull);
    }

    /********* touch end *********/

    async function onTouchEnd() {
      if (!pulling) return;

      const distance = currentY - startY;
      pulling = false;

      if (distance < TRIGGER || refreshing) {
        reset();
        return;
      }

      refreshing = true;
      showLoading();

      try {
        await Promise.resolve(onRefresh?.());
      } catch (error) {
        console.error("[PWA] Refresh failed:", error);
      }

      await wait(150);

      refreshing = false;
      reset();
    }

    /********* listeners *********/

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchEnd, { passive: true });

    /********* destroy *********/

    return function destroyPullToRefreshInstance() {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      reset();
    };
  }

  /********* refresh app *********/

  async function refreshApp() {
    const router = window.router || window.appRouter || window.APP_ROUTER;

    try {
      if (router && typeof router.refreshCurrentPage === "function") {
        await router.refreshCurrentPage();
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("[PWA] Application refresh failed:", error);
      window.location.reload();
    }
  }

  /********* pwa boot *********/

function bootPWA() {
  const standalone = syncStandaloneClass();
  
  if (destroyPullToRefresh) {
    destroyPullToRefresh();
    destroyPullToRefresh = null;
  }
  
  if (!standalone) return;
  
  disablePwaBrowserInteractions();
  
  destroyPullToRefresh = initPullToRefresh(refreshApp, {
    root: document.querySelector("#root"),
    indicator: document.querySelector(".ptr-indicator"),
  });
}

  /********* delayed boot *********/

  function scheduleBoot() {
    window.requestAnimationFrame(() => {
      bootPWA();
    });
  }

  /********* lifecycle events *********/

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBoot, {
      once: true,
    });
  } else {
    scheduleBoot();
  }

  window.addEventListener("pageshow", scheduleBoot);

  document.addEventListener("pageLoaded", scheduleBoot);
  document.addEventListener("pageRefreshed", scheduleBoot);

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");

  if (standaloneQuery && typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", scheduleBoot);
  }

  if (fullscreenQuery && typeof fullscreenQuery.addEventListener === "function") {
    fullscreenQuery.addEventListener("change", scheduleBoot);
  }

  /********* public api *********/

  window.pwaApp = {
    isStandalonePWA,
    refreshApp,
    syncStandaloneClass,
    boot: scheduleBoot,
  };
})();