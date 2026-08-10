(function () {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  /********* module state *********/

  let destroyPullToRefresh = null;
  let standaloneMediaQueries = [];

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

    return standalone;
  }

  /********* scroll helpers *********/

  function getScrollTop() {
    return Math.max(
      window.pageYOffset || 0,
      document.documentElement.scrollTop || 0,
      document.body.scrollTop || 0
    );
  }

  /********* timing helpers *********/

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  /********* pull to refresh icon *********/

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

    return icon;
  }

  /********* pull to refresh *********/

  function initPullToRefresh(onRefresh, options = {}) {
    const root =
      options.root ||
      document.querySelector("#root") ||
      document.body;

    const indicator =
      options.indicator ||
      document.querySelector(".ptr-indicator");

    if (!root || !indicator) return null;

    /********* create icon *********/

    const icon = createPTRIcon(indicator);

    if (!icon) return null;

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
      indicator.style.setProperty(
        "--ptr-y",
        `${y}px`
      );
    }

    /********* pulling state *********/

    function showPulling(pull) {
      indicator.classList.add("active");
      indicator.classList.remove("loading");

      setIndicatorY(
        Math.max(-80, pull - 80)
      );

      const progress = Math.min(
        1,
        Math.max(0, pull / TRIGGER)
      );

      indicator.style.setProperty(
        "--ptr-progress",
        progress
      );
    }

    /********* loading state *********/

    function showLoading() {
      indicator.classList.add(
        "active",
        "loading"
      );

      indicator.style.setProperty(
        "--ptr-progress",
        "1"
      );

      setIndicatorY(16);
    }

    /********* reset indicator *********/

    function reset() {
      pulling = false;
      startY = 0;
      currentY = 0;

      indicator.classList.remove(
        "active",
        "loading"
      );

      indicator.style.removeProperty(
        "--ptr-progress"
      );

      indicator.style.removeProperty(
        "--ptr-y"
      );
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
        await Promise.resolve(
          onRefresh?.()
        );
      } catch (error) {
        console.error(
          "[PWA] Refresh failed:",
          error
        );
      }

      await wait(150);

      refreshing = false;

      reset();
    }

    /********* event listeners *********/

    root.addEventListener(
      "touchstart",
      onTouchStart,
      {
        passive: true
      }
    );

    root.addEventListener(
      "touchmove",
      onTouchMove,
      {
        passive: false
      }
    );

    root.addEventListener(
      "touchend",
      onTouchEnd,
      {
        passive: true
      }
    );

    root.addEventListener(
      "touchcancel",
      onTouchEnd,
      {
        passive: true
      }
    );

    /********* destroy *********/

    return function destroyPullToRefreshInstance() {
      root.removeEventListener(
        "touchstart",
        onTouchStart
      );

      root.removeEventListener(
        "touchmove",
        onTouchMove
      );

      root.removeEventListener(
        "touchend",
        onTouchEnd
      );

      root.removeEventListener(
        "touchcancel",
        onTouchEnd
      );

      reset();
    };
  }

  /********* refresh app *********/

  async function refreshApp() {
    const router =
      window.router ||
      window.appRouter ||
      window.APP_ROUTER;

    try {
      /********* use main router refresh *********/

      if (
        router &&
        typeof router.refreshCurrentPage === "function"
      ) {
        await router.refreshCurrentPage();
      }

      /********* fallback router *********/

      else if (
        typeof window.handleLocation === "function"
      ) {
        await window.handleLocation();
      }

      /********* fallback route *********/

      else if (
        typeof window.route === "function"
      ) {
        await window.route({
          type: "refresh",
          url:
            window.location.pathname +
            window.location.search +
            window.location.hash
        });
      }

      /********* final browser fallback *********/

      else {
        window.location.reload();
        return;
      }

      /********* refresh page scripts *********/

      if (
        typeof window.refreshCurrentPageScripts ===
        "function"
      ) {
        await window.refreshCurrentPageScripts();
      }

      /********* refresh app skeleton *********/

      if (
        window.APP_SKELETON &&
        typeof window.APP_SKELETON.check === "function"
      ) {
        window.APP_SKELETON.check();
      }

      /********* notify application *********/

      window.dispatchEvent(
        new CustomEvent(
          "app:page:refreshed",
          {
            detail: {
              url: window.location.href,
              path: window.location.pathname
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "[PWA] Application refresh failed:",
        error
      );

      /********* final recovery *********/

      window.location.reload();
    }
  }

  /********* find current root *********/

  function getAppRoot() {
    return (
      document.querySelector("#root") ||
      document.querySelector("#main-page") ||
      document.body
    );
  }

  /********* find ptr indicator *********/

  function getPTRIndicator() {
    return document.querySelector(
      ".ptr-indicator"
    );
  }

  /********* boot pwa *********/

  function bootPWA() {
    const standalone =
      syncStandaloneClass();

    /********* destroy previous instance *********/

    if (destroyPullToRefresh) {
      destroyPullToRefresh();
      destroyPullToRefresh = null;
    }

    /********* only enable in standalone *********/

    if (!standalone) return;

    /********* find current elements *********/

    const root = getAppRoot();
    const indicator = getPTRIndicator();

    if (!root || !indicator) return;

    /********* initialize pull to refresh *********/

    destroyPullToRefresh =
      initPullToRefresh(
        refreshApp,
        {
          root,
          indicator
        }
      );
  }

  /********* delayed boot *********/

  function scheduleBoot() {
    /*
     * The router may replace #root contents
     * or load HTML through <app-script>.
     * Waiting one animation frame allows the
     * current page DOM to settle first.
     */

    window.requestAnimationFrame(() => {
      bootPWA();
    });
  }

  /********* application page changes *********/

  function handlePageChange() {
    if (!isStandalonePWA()) return;

    scheduleBoot();
  }

  /********* initialize *********/

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleBoot,
      { once: true }
    );
  } else {
    scheduleBoot();
  }

  /********* pageshow *********/

  window.addEventListener(
    "pageshow",
    scheduleBoot
  );

  /********* router events *********/

  document.addEventListener(
    "pageLoaded",
    handlePageChange
  );

  document.addEventListener(
    "pageRefreshed",
    handlePageChange
  );

  window.addEventListener(
    "app:page:refreshed",
    handlePageChange
  );

  /********* standalone changes *********/

  const standaloneQuery =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  const fullscreenQuery =
    window.matchMedia(
      "(display-mode: fullscreen)"
    );

  standaloneMediaQueries = [
    standaloneQuery,
    fullscreenQuery
  ];

  standaloneMediaQueries.forEach(
    (query) => {
      if (
        query &&
        typeof query.addEventListener ===
          "function"
      ) {
        query.addEventListener(
          "change",
          scheduleBoot
        );
      }
    }
  );

  /********* public api *********/

  window.pwaApp = {
    isStandalonePWA,
    refreshApp,
    syncStandaloneClass,
    boot: scheduleBoot
  };
})();