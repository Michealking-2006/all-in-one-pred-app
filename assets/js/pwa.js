function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function initPullToRefresh(onRefresh, options = {}) {
  const root = options.root || document.querySelector("#root");
  const wrapper = options.wrapper || document.querySelector(".ptr-wrapper");
  const indicator = options.indicator || document.querySelector(".ptr-indicator");
  
  if (!root || !wrapper || !indicator) return;
  
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  let triggered = false;
  
  const MAX_PULL = 130;
  const TRIGGER = 85;
  const START_ZONE = 90;
  
  const getScrollTop = () => root.scrollTop;
  
  const ease = (distance) => {
    if (distance <= 0) return 0;
    return Math.min(MAX_PULL, distance * 0.45 + Math.sqrt(distance) * 2);
  };
  
  const resetVisuals = () => {
    wrapper.style.transform = "";
    wrapper.classList.remove("dragging");
    indicator.classList.remove("active", "loading");
    indicator.style.transform = "";
  };
  
  root.addEventListener("touchstart", (e) => {
    if (refreshing) return;
    if (getScrollTop() > 0) return;
    
    const y = e.touches[0].clientY;
    if (y > START_ZONE) return;
    
    startY = y;
    currentY = y;
    pulling = true;
    triggered = false;
    wrapper.classList.add("dragging");
  }, { passive: true });
  
  root.addEventListener("touchmove", (e) => {
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
    
    wrapper.style.transform = `translate3d(0, ${pull}px, 0)`;
    indicator.classList.add("active");
    indicator.style.transform = `translate(-50%, ${Math.min(pull - 70, 20)}px)`;
  }, { passive: false });
  
  root.addEventListener("touchend", async () => {
    if (!pulling) return;
    
    pulling = false;
    wrapper.classList.remove("dragging");
    
    const distance = currentY - startY;
    
    if (triggered && distance >= TRIGGER && !refreshing) {
      refreshing = true;
      indicator.classList.add("loading");
      wrapper.style.transform = "translate3d(0, 70px, 0)";
      
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
  }, { passive: true });
  initPullToRefresh(refreshCurrentPage);
}

if (isStandalonePWA()) {
  document.documentElement.classList.add("pwa-standalone");
  initPullToRefresh(async () => {
    await refreshData();
  });
}