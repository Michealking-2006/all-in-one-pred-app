(() => {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  /********* state *********/

  let ptrIndicator = null;
  let destroyPullToRefresh = null;
  let interactionHandlersInstalled = false;
  let refreshInProgress = false;

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

  /********* dom helpers *********/

  function getRoot() {
    return (
      document.querySelector("#root") ||
      document.querySelector("#main-page") ||
      document.body
    );
  }

  function getIndicator() {
    return document.querySelector(".ptr-indicator");
  }

  /********* scroll helpers *********/

  function getScrollTop() {
    return Math.max(
      window.scrollY || 0,
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

  function nextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }

  /********* indicator *********/

  function ensureIndicator() {
    const indicator = getIndicator();

    if (!indicator) {
      ptrIndicator = null;
      return null;
    }

    ptrIndicator = indicator;

    if (!indicator.querySelector(".ptr-icon")) {
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
    }

    return indicator;
  }

  function setIndicatorPosition(y) {
    if (!ptrIndicator) return;

    ptrIndicator.style.transform =
      `translate3d(-50%, ${y}px, 0)`;
  }

  function setIndicatorProgress(progress) {
    if (!ptrIndicator) return;

    ptrIndicator.style.setProperty(
      "--ptr-progress",
      Math.max(0, Math.min(1, progress))
    );
  }

  function showPullState(distance, trigger) {
    if (!ptrIndicator) return;

    const resistance = 0.58;
    const pull = Math.min(120, distance * resistance);

    const y = -54 + pull;

    ptrIndicator.classList.add("active", "pulling");
    ptrIndicator.classList.remove("loading");

    setIndicatorPosition(y);
    setIndicatorProgress(distance / trigger);
  }

  function showLoadingState() {
    if (!ptrIndicator) return;

    ptrIndicator.classList.add("active", "loading");
    ptrIndicator.classList.remove("pulling");

    setIndicatorProgress(1);
    setIndicatorPosition(16);
  }

  function resetIndicator() {
    if (!ptrIndicator) return;

    ptrIndicator.classList.remove(
      "active",
      "loading",
      "pulling"
    );

    ptrIndicator.style.removeProperty("--ptr-progress");

    setIndicatorPosition(-80);
  }

  /********* native interactions *********/

  function installNativeInteractions() {
    if (interactionHandlersInstalled) return;

    interactionHandlersInstalled = true;

    document.addEventListener(
      "contextmenu",
      (event) => {
        if (!isStandalonePWA()) return;

        const target = event.target;

        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return;
        }

        event.preventDefault();
      },
      true
    );

    document.addEventListener(
      "dragstart",
      (event) => {
        if (!isStandalonePWA()) return;
        event.preventDefault();
      },
      true
    );

    document.addEventListener(
      "selectstart",
      (event) => {
        if (!isStandalonePWA()) return;

        const target = event.target;

        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable
        ) {
          return;
        }

        event.preventDefault();
      },
      true
    );
  }

  /********* pull to refresh *********/

  function initPullToRefresh(onRefresh) {
    const root = getRoot();
    const indicator = ensureIndicator();

    if (!root || !indicator) return null;

    let startY = 0;
    let currentY = 0;
    let tracking = false;
    let pulling = false;

    const START_ZONE = 120;
    const TRIGGER = 90;

    function touchStart(event) {
      if (refreshInProgress) return;
      if (getScrollTop() > 0) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];

      if (touch.clientY > START_ZONE) return;

      startY = touch.clientY;
      currentY = touch.clientY;

      tracking = true;
      pulling = false;
    }

    function touchMove(event) {
      if (!tracking || refreshInProgress) return;
      if (event.touches.length !== 1) return;

      if (getScrollTop() > 0) {
        tracking = false;
        pulling = false;
        resetIndicator();
        return;
      }

      const touch = event.touches[0];

      currentY = touch.clientY;

      const distance = currentY - startY;

      if (distance <= 0) return;

      pulling = true;

      event.preventDefault();

      showPullState(distance, TRIGGER);
    }

    async function touchEnd() {
      if (!tracking) return;

      const distance = currentY - startY;

      tracking = false;

      if (!pulling || distance < TRIGGER) {
        pulling = false;

        if (ptrIndicator) {
          ptrIndicator.classList.remove("pulling");
          setIndicatorPosition(-80);
        }

        await wait(180);

        resetIndicator();
        return;
      }

      pulling = false;
      refreshInProgress = true;

      showLoadingState();

      try {
        await Promise.resolve(onRefresh?.());
      } catch (error) {
        console.error("[PWA] Refresh failed:", error);
      }

      await wait(180);

      refreshInProgress = false;

      resetIndicator();
    }

    function touchCancel() {
      if (refreshInProgress) return;

      tracking = false;
      pulling = false;

      resetIndicator();
    }

    root.addEventListener(
      "touchstart",
      touchStart,
      { passive: true }
    );

    root.addEventListener(
      "touchmove",
      touchMove,
      { passive: false }
    );

    root.addEventListener(
      "touchend",
      touchEnd,
      { passive: true }
    );

    root.addEventListener(
      "touchcancel",
      touchCancel,
      { passive: true }
    );

    return () => {
      root.removeEventListener(
        "touchstart",
        touchStart
      );

      root.removeEventListener(
        "touchmove",
        touchMove
      );

      root.removeEventListener(
        "touchend",
        touchEnd
      );

      root.removeEventListener(
        "touchcancel",
        touchCancel
      );

      tracking = false;
      pulling = false;

      resetIndicator();
    };
  }

  /********* refresh *********/

  async function refreshApp() {
    if (refreshInProgress) return;

    refreshInProgress = true;
    showLoadingState();

    try {
      const router = window.router;

      if (
        router &&
        typeof router.refreshCurrentPage === "function"
      ) {
        await router.refreshCurrentPage();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error(
        "[PWA] Application refresh failed:",
        error
      );

      window.location.reload();
    } finally {
      await nextFrame();
      await nextFrame();

      refreshInProgress = false;
    }
  }

  /********* boot *********/

  function bootPWA() {
    const standalone = syncStandaloneClass();

    if (destroyPullToRefresh) {
      destroyPullToRefresh();
      destroyPullToRefresh = null;
    }

    if (!standalone) {
      return;
    }

    installNativeInteractions();

    ensureIndicator();

    destroyPullToRefresh =
      initPullToRefresh(refreshApp);
  }

  /********* page lifecycle *********/

  function scheduleBoot() {
    requestAnimationFrame(() => {
      bootPWA();
    });
  }

  /********* initialization *********/

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleBoot,
      { once: true }
    );
  } else {
    scheduleBoot();
  }

  window.addEventListener(
    "pageshow",
    scheduleBoot
  );

  document.addEventListener(
    "pageLoaded",
    scheduleBoot
  );

  document.addEventListener(
    "pageRefreshed",
    scheduleBoot
  );

  /********* display mode *********/

  const standaloneQuery =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  const fullscreenQuery =
    window.matchMedia(
      "(display-mode: fullscreen)"
    );

  if (
    typeof standaloneQuery.addEventListener ===
    "function"
  ) {
    standaloneQuery.addEventListener(
      "change",
      scheduleBoot
    );
  }

  if (
    typeof fullscreenQuery.addEventListener ===
    "function"
  ) {
    fullscreenQuery.addEventListener(
      "change",
      scheduleBoot
    );
  }

  /********* api *********/

  window.pwaApp = {
    isStandalonePWA,
    refreshApp,
    syncStandaloneClass,
    boot: scheduleBoot,
  };
})();