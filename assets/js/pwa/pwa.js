(function() {
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
  
  function waitForNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  function callFirstAvailable(targets, methodNames, args = []) {
    for (const target of targets) {
      if (!target) continue;
      
      for (const methodName of methodNames) {
        const method = target[methodName];
        if (typeof method === "function") {
          return method.apply(target, args);
        }
      }
    }
    
    return undefined;
  }
  
  function getScrollTop() {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
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
    
    const showIdleIndicator = (pull) => {
      indicator.classList.add("active");
      indicator.classList.remove("loading");
      setIndicatorY(Math.max(-80, pull - 80));
    };
    
    const showLoadingIndicator = () => {
      indicator.classList.add("active", "loading");
      setIndicatorY(16);
    };
    
    const resetVisuals = () => {
      pulling = false;
      startY = 0;
      currentY = 0;
      
      indicator.classList.remove("active", "loading");
      indicator.style.transform = "";
    };
    
    const handleTouchStart = (event) => {
      if (refreshing) return;
      if (getScrollTop() > 0) return;
      
      const y = event.touches[0].clientY;
      if (y > START_ZONE) return;
      
      startY = y;
      currentY = y;
      pulling = true;
    };
    
    const handleTouchMove = (event) => {
      if (!pulling || refreshing) return;
      
      currentY = event.touches[0].clientY;
      const distance = currentY - startY;
      
      if (distance <= 0) return;
      
      if (getScrollTop() > 0) {
        resetVisuals();
        return;
      }
      
      event.preventDefault();
      
      const pull = easePull(distance);
      showIdleIndicator(pull);
    };
    
    const handleTouchEnd = async () => {
      if (!pulling) return;
      
      const distance = currentY - startY;
      pulling = false;
      
      if (distance >= TRIGGER && !refreshing) {
        refreshing = true;
        
        showLoadingIndicator();
        
        try {
          await Promise.resolve(onRefresh && onRefresh());
        } catch (error) {
          console.error(error);
        }
        
        await waitForNextFrame();
        await wait(150);
        
        refreshing = false;
        resetVisuals();
        return;
      }
      
      resetVisuals();
    };
    
    root.addEventListener("touchstart", handleTouchStart, { passive: true });
    root.addEventListener("touchmove", handleTouchMove, { passive: false });
    root.addEventListener("touchend", handleTouchEnd, { passive: true });
    root.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    
    return function destroyPullToRefreshInstance() {
      root.removeEventListener("touchstart", handleTouchStart);
      root.removeEventListener("touchmove", handleTouchMove);
      root.removeEventListener("touchend", handleTouchEnd);
      root.removeEventListener("touchcancel", handleTouchEnd);
      resetVisuals();
    };
  }
  
  async function refreshApp() {
    const router = window.router || window.appRouter || window.APP_ROUTER;
    const scriptHelper =
      window.scriptHelper ||
      window.appScriptHelper ||
      window.scriptHelpers ||
      window.APP_SCRIPT_HELPER;
    
    const currentUrl =
      window.location.pathname + window.location.search + window.location.hash;
    
    let refreshedByRouter = false;
    
    const routerResult = callFirstAvailable(
      [router],
      [
        "refreshCurrentPage",
        "refreshCurrentRoute",
        "refresh",
        "reloadCurrentRoute",
      ]
    );
    
    if (routerResult instanceof Promise) {
      await routerResult;
      refreshedByRouter = true;
    } else if (routerResult !== undefined) {
      refreshedByRouter = true;
    } else {
      const handleResult = callFirstAvailable([window], ["handleLocation"]);
      if (handleResult instanceof Promise) {
        await handleResult;
        refreshedByRouter = true;
      } else if (typeof window.route === "function") {
        const routeResult = window.route({ type: "refresh", url: currentUrl });
        if (routeResult instanceof Promise) {
          await routeResult;
        }
        refreshedByRouter = true;
      }
    }
    
    callFirstAvailable(
      [scriptHelper, window],
      [
        "refreshCurrentPageScripts",
        "runCurrentPageScripts",
        "reinitCurrentPage",
        "reinitializePage",
        "bootCurrentPage",
        "initCurrentPage",
        "runPageScripts",
      ]
    );
    
    if (window.APP_SKELETON && typeof window.APP_SKELETON.check === "function") {
      window.APP_SKELETON.check();
    }
    
    if (refreshedByRouter) return;
    
    window.location.reload();
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