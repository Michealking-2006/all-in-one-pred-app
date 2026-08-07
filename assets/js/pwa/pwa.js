(function() {
  if (window.__pwaModuleInitialized) return;
  window.__pwaModuleInitialized = true;
  
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
  
  function initPullToRefresh(onRefresh, options = {}) {
    const root = options.root || document.querySelector("#root");
    const content = options.content || document.querySelector("#main-page");
    const indicator = options.indicator || document.querySelector(".ptr-indicator");
    
    if (!root || !content || !indicator) return;
    
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;
    let triggered = false;
    
    const MAX_PULL = 130;
    const TRIGGER = 85;
    const START_ZONE = 90;
    
    const getScrollTop = () => {
      return window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
    };
    
    const ease = (distance) => {
      if (distance <= 0) return 0;
      return Math.min(MAX_PULL, distance * 0.45 + Math.sqrt(distance) * 2);
    };
    
    const resetVisuals = () => {
      content.style.transform = "";
      content.classList.remove("dragging");
      indicator.classList.remove("active", "loading");
      indicator.style.transform = "";
    };
    
    const onTouchStart = (e) => {
      if (refreshing) return;
      if (getScrollTop() > 0) return;
      
      const y = e.touches[0].clientY;
      if (y > START_ZONE) return;
      
      startY = y;
      currentY = y;
      pulling = true;
      triggered = false;
      content.classList.add("dragging");
    };
    
    const onTouchMove = (e) => {
      if (!pulling || refreshing) return;
      
      currentY = e.touches[0].clientY;
      const distance = currentY - startY;
      
      if (distance <= 0) return;
      
      if (getScrollTop() > 0) {
        pulling = false;
        resetVisuals();
        return;
      }
      
      e.preventDefault();
      triggered = true;
      
      const pull = ease(distance);
      
      content.style.transform = `translate3d(0, ${pull}px, 0)`;
      indicator.classList.add("active");
      indicator.style.transform = `translate(-50%, ${Math.min(pull - 70, 20)}px)`;
    };
    
    const onTouchEnd = async () => {
      if (!pulling) return;
      
      pulling = false;
      content.classList.remove("dragging");
      
      const distance = currentY - startY;
      
      if (triggered && distance >= TRIGGER && !refreshing) {
        refreshing = true;
        indicator.classList.add("loading");
        content.style.transform = "translate3d(0, 70px, 0)";
        
        try {
          await Promise.resolve(onRefresh && onRefresh());
        } catch (err) {
          console.error(err);
        }
        
        setTimeout(() => {
          refreshing = false;
          resetVisuals();
        }, 300);
      } else {
        resetVisuals();
      }
      
      startY = 0;
      currentY = 0;
      triggered = false;
    };
    
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchEnd, { passive: true });
    
    return function destroyPullToRefresh() {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
    };
  }
  
  async function refreshApp() {
    if (window.router && typeof window.router.refreshCurrentPage === "function") {
      await window.router.refreshCurrentPage();
      return;
    }
    
    window.location.reload();
  }
  
  function bootPWA() {
    const standalone = syncStandaloneClass();
    
    if (!standalone) return;
    
    initPullToRefresh(refreshApp, {
      root: document.querySelector("#root"),
      content: document.querySelector("#main-page"),
      indicator: document.querySelector(".ptr-indicator")
    });
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPWA, { once: true });
  } else {
    bootPWA();
  }
  
  window.addEventListener("pageshow", syncStandaloneClass);
  
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  if (standaloneQuery && typeof standaloneQuery.addEventListener === "function") {
    standaloneQuery.addEventListener("change", bootPWA);
  }
  
  const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
  if (fullscreenQuery && typeof fullscreenQuery.addEventListener === "function") {
    fullscreenQuery.addEventListener("change", bootPWA);
  }
  
  window.pwaApp = {
    isStandalonePWA,
    refreshApp
  };
})();