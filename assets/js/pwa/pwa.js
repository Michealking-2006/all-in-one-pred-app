(function () {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  let destroyPullToRefresh = null;
  let ptrIndicator = null;

  /********* standalone detection *********/

  function isStandalonePWA() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true ||
      document.referrer.startsWith("android-app://")
    );
  }

  /********* standalone class *********/

  function syncStandaloneClass() {
    const standalone = isStandalonePWA();

    document.documentElement.classList.toggle(
      "pwa-standalone",
      standalone
    );

    return standalone;
  }

  /********* scroll position *********/

  function getScrollTop() {
    return Math.max(
      window.pageYOffset || 0,
      document.documentElement.scrollTop || 0,
      document.body?.scrollTop || 0
    );
  }

  /********* delay helper *********/

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /********* create pull to refresh svg *********/

  function createPullToRefreshIndicator() {
    if (ptrIndicator && document.body.contains(ptrIndicator)) {
      return ptrIndicator;
    }

    const existing = document.querySelector(".ptr-indicator");

    if (existing) {
      ptrIndicator = existing;
      return ptrIndicator;
    }

    const indicator = document.createElement("div");

    indicator.className = "ptr-indicator";
    indicator.setAttribute("aria-hidden", "true");

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

    document.body.appendChild(indicator);

    ptrIndicator = indicator;

    return indicator;
  }

  /********* remove pull to refresh indicator *********/

  function removePullToRefreshIndicator() {
    if (!ptrIndicator) return;

    ptrIndicator.remove();
    ptrIndicator = null;
  }

  /********* pull to refresh *********/

  function initPullToRefresh(onRefresh, options = {}) {
    const root =
      options.root ||
      document.querySelector("#root") ||
      document.querySelector("#main-page") ||
      document;

    const indicator =
      options.indicator ||
      createPullToRefreshIndicator();

    if (!root || !indicator) return null;

    let startY = 0;
    let currentY = 0;

    let pulling = false;
    let refreshing = false;

    const START_ZONE = 100;
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
      indicator.style.transform =
        `translate3d(-50%, ${y}px, 0)`;
    }

    /********* show pulling state *********/

    function showPulling(pull) {
      indicator.classList.add("active");
      indicator.classList.remove("loading");

      setIndicatorY(
        Math.max(-80, pull - 80)
      );
    }

    /********* show loading state *********/

    function showLoading() {
      indicator.classList.add(
        "active",
        "loading"
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

      indicator.style.transform = "";
    }

    /********* touch start *********/

    function onTouchStart(event) {
      if (refreshing) return;

      if (getScrollTop() > 0) return;

      if (!event.touches?.length) return;

      const y = event.touches[0].clientY;

      if (y > START_ZONE) return;

      startY = y;
      currentY = y;
      pulling = true;
    }

    /********* touch move *********/

    function onTouchMove(event) {
      if (!pulling || refreshing) return;

      if (!event.touches?.length) return;

      currentY = event.touches[0].clientY;

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
          onRefresh && onRefresh()
        );
      } catch (error) {
        console.error(
          "[PWA] Refresh failed:",
          error
        );
      }

      await wait(200);

      refreshing = false;

      reset();
    }

    root.addEventListener(
      "touchstart",
      onTouchStart,
      { passive: true }
    );

    root.addEventListener(
      "touchmove",
      onTouchMove,
      { passive: false }
    );

    root.addEventListener(
      "touchend",
      onTouchEnd,
      { passive: true }
    );

    root.addEventListener(
      "touchcancel",
      onTouchEnd,
      { passive: true }
    );

    return function destroy() {
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

  /********* refresh application *********/

  async function refreshApp() {
    const router =
      window.router ||
      window.appRouter ||
      window.APP_ROUTER;

    try {
      if (
        router &&
        typeof router.refreshCurrentPage === "function"
      ) {
        await router.refreshCurrentPage();
      } else {
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

      /********* refresh skeleton *********/

      if (
        window.APP_SKELETON &&
        typeof window.APP_SKELETON.check ===
          "function"
      ) {
        window.APP_SKELETON.check();
      }

      /********* refresh event *********/

      window.dispatchEvent(
        new CustomEvent(
          "app:page:refreshed",
          {
            detail: {
              url: window.location.href,
            },
          }
        )
      );
    } catch (error) {
      console.error(
        "[PWA] Application refresh failed:",
        error
      );
    }
  }

  /********* boot pwa *********/

  function bootPWA() {
    const standalone =
      syncStandaloneClass();

    /********* destroy previous refresh *********/

    if (destroyPullToRefresh) {
      destroyPullToRefresh();
      destroyPullToRefresh = null;
    }

    /********* remove indicator outside pwa *********/

    if (!standalone) {
      removePullToRefreshIndicator();
      return;
    }

    /********* create indicator *********/

    const indicator =
      createPullToRefreshIndicator();

    if (!indicator) return;

    /********* initialize refresh *********/

    destroyPullToRefresh =
      initPullToRefresh(
        refreshApp,
        {
          root:
            document.querySelector("#root") ||
            document.querySelector("#main-page") ||
            document,
          indicator,
        }
      );
  }

  /********* initialize *********/

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      bootPWA,
      { once: true }
    );
  } else {
    bootPWA();
  }

  /********* handle pageshow *********/

  window.addEventListener(
    "pageshow",
    bootPWA
  );

  /********* standalone display change *********/

  const standaloneQuery =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  const fullscreenQuery =
    window.matchMedia(
      "(display-mode: fullscreen)"
    );

  if (
    standaloneQuery &&
    typeof standaloneQuery.addEventListener ===
      "function"
  ) {
    standaloneQuery.addEventListener(
      "change",
      bootPWA
    );
  }

  if (
    fullscreenQuery &&
    typeof fullscreenQuery.addEventListener ===
      "function"
  ) {
    fullscreenQuery.addEventListener(
      "change",
      bootPWA
    );
  }

  /********* public pwa api *********/

  window.pwaApp = {
    isStandalonePWA,
    refreshApp,
    syncStandaloneClass,
    createPullToRefreshIndicator,
    removePullToRefreshIndicator,
  };
})();