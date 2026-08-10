(function () {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  let destroyPullToRefresh = null;
  let ptrIndicatorEl = null;
  let ptrIndicatorInserted = false;

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
    document.documentElement.classList.toggle("pwa-standalone", standalone);
    document.documentElement.classList.toggle("pwa-not-standalone", !standalone);
    return standalone;
  }

  function getScrollTop() {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function createPullToRefreshIndicator() {
    if (ptrIndicatorEl && document.body.contains(ptrIndicatorEl)) {
      return ptrIndicatorEl;
    }

    const existing = document.querySelector(".ptr-indicator");
    if (existing) {
      ptrIndicatorEl = existing;
      return ptrIndicatorEl;
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
    ptrIndicatorEl = indicator;
    return ptrIndicatorEl;
  }

  function ensurePullToRefreshIndicator() {
    if (!isStandalonePWA()) return null;

    const indicator = createPullToRefreshIndicator();
    if (!indicator) return null;

    if (!ptrIndicatorInserted) {
      ptrIndicatorInserted = true;
      indicator.classList.add("ptr-indicator-ready");
    }

    return indicator;
  }

  function initPullToRefresh(onRefresh, options = {}) {
    const root = options.root || document.querySelector("#root") || document;
    const indicator = options.indicator || ensurePullToRefreshIndicator();

    if (!root || !indicator) return null;

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;

    const START_ZONE = 90;
    const TRIGGER = 85;
    const MAX_PULL = 130;

    const easePull = (distance) => {
      if (distance <= 0) return 0;
      return Math.min(MAX_PULL, distance * 0.45 + Math.sqrt(distance) * 2);
    };

    const setIndicatorY = (y) => {
      indicator.style.transform = `translate3d(-50%, ${y}px, 0)`;
    };

    const showPulling = (pull) => {
      indicator.classList.add("active");
      indicator.classList.remove("loading");
      setIndicatorY(Math.max(-80, pull - 80));
    };

    const showLoading = () => {
      indicator.classList.add("active", "loading");
      setIndicatorY(16);
    };

    const reset = () => {
      pulling = false;
      startY = 0;
      currentY = 0;

      indicator.classList.remove("active", "loading");
      indicator.style.transform = "";
    };

    const onTouchStart = (event) => {
      if (refreshing) return;
      if (getScrollTop() > 0) return;

      const y = event.touches[0].clientY;
      if (y > START_ZONE) return;

      startY = y;
      currentY = y;
      pulling = true;
    };

    const onTouchMove = (event) => {
      if (!pulling || refreshing) return;

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
    };

    const onTouchEnd = async () => {
      if (!pulling) return;

      const distance = currentY - startY;
      pulling = false;

      if (distance >= TRIGGER && !refreshing) {
        refreshing = true;
        showLoading();

        try {
          await Promise.resolve(onRefresh && onRefresh());
        } catch (error) {
          console.error(error);
        }

        await wait(150);

        refreshing = false;
        reset();
        return;
      }

      reset();
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return function destroyPullToRefreshInstance() {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      reset();
    };
  }

  async function refreshApp() {
    const router = window.router || window.appRouter || window.APP_ROUTER;

    try {
      if (router && typeof router.refreshCurrentPage === "function") {
        await router.refreshCurrentPage();
      } else if (typeof window.handleLocation === "function") {
        await window.handleLocation();
      } else if (typeof window.route === "function") {
        await window.route({
          type: "refresh",
          url:
            window.location.pathname +
            window.location.search +
            window.location.hash,
        });
      } else {
        window.location.reload();
        return;
      }

      if (typeof window.loadPageScript === "function" && window.router?.getCurrentPath) {
        const path = window.router.getCurrentPath();
        const scriptHost = document.querySelector("main, #main-page, #root");
        const appScripts = [...(scriptHost || document).querySelectorAll("app-script[src]")];

        await Promise.allSettled(
          appScripts.map((el) => {
            const src = el.getAttribute("src");
            if (!src) return Promise.resolve();
            return window.loadPageScript(src);
          })
        );
      }

      if (window.refreshCurrentPageScripts) {
        await window.refreshCurrentPageScripts();
      }

      if (window.APP_SKELETON && typeof window.APP_SKELETON.check === "function") {
        window.APP_SKELETON.check();
      }

      window.dispatchEvent(
        new CustomEvent("app:page:refreshed", {
          detail: { url: window.location.href },
        })
      );
    } catch (error) {
      console.error("[PWA] refresh failed:", error);
    }
  }

  function bootPWA() {
    const standalone = syncStandaloneClass();

    if (destroyPullToRefresh) {
      destroyPullToRefresh();
      destroyPullToRefresh = null;
    }

    if (!standalone) {
      if (ptrIndicatorEl) {
        ptrIndicatorEl.remove();
        ptrIndicatorEl = null;
        ptrIndicatorInserted = false;
      }
      return;
    }

    const indicator = ensurePullToRefreshIndicator();

    destroyPullToRefresh = initPullToRefresh(refreshApp, {
      root: document.querySelector("#root") || document.querySelector("#main-page") || document,
      indicator,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPWA, { once: true });
  } else {
    bootPWA();
  }

  window.addEventListener("pageshow", bootPWA);

  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");

  if (standaloneQuery && typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", bootPWA);
  }

  if (fullscreenQuery && typeof fullscreenQuery.addEventListener === "function") {
    fullscreenQuery.addEventListener("change", bootPWA);
  }

  window.pwaApp = {
    isStandalonePWA,
    refreshApp,
    syncStandaloneClass,
    ensurePullToRefreshIndicator,
  };
})();