(function () {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;

  let destroyPullToRefresh = null;

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

  function initPullToRefresh(onRefresh, options = {}) {
    const root = options.root || document.querySelector("#root");
    const indicator = options.indicator || document.querySelector(".ptr-indicator");

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
  }

  function bootPWA() {
    const standalone = syncStandaloneClass();

    if (destroyPullToRefresh) {
      destroyPullToRefresh();
      destroyPullToRefresh = null;
    }

    if (!standalone) return;

    destroyPullToRefresh = initPullToRefresh(refreshApp, {
      root: document.querySelector("#root"),
      indicator: document.querySelector(".ptr-indicator"),
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPWA, { once: true });
  } else {
    bootPWA();
  }

  window.addEventListener("pageshow", syncStandaloneClass);

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
  };
})();