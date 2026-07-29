// ================================
// PWA Standalone Detection
// ================================

function isStandalonePWA() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

if (isStandalonePWA()) {
  document.documentElement.classList.add("pwa-standalone");
  
  initPullToRefresh(async () => {
    await refreshData(); // Replace with your refresh function
  });
}

// ================================
// Pull To Refresh
// ================================

function initPullToRefresh(onRefresh) {
  
  const wrapper = document.querySelector(".ptr-wrapper");
  const indicator = document.querySelector(".ptr-indicator");
  
  if (!wrapper || !indicator) return;
  
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  
  const MAX_PULL = 130;
  const TRIGGER = 85;
  const START_ZONE = 70;
  
  function getScrollTop() {
    return window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
  }
  
  function ease(distance) {
    
    if (distance <= 0) return 0;
    
    return Math.min(
      MAX_PULL,
      distance * 0.45 + Math.sqrt(distance) * 2
    );
    
  }
  
  document.addEventListener("touchstart", e => {
    
    if (refreshing) return;
    
    if (getScrollTop() > 0) return;
    
    startY = e.touches[0].clientY;
    
    if (startY > START_ZONE) return;
    
    pulling = true;
    
    wrapper.classList.add("dragging");
    
  }, {
    passive: true
  });
  
  document.addEventListener("touchmove", e => {
    
    if (!pulling) return;
    
    currentY = e.touches[0].clientY;
    
    const distance = currentY - startY;
    
    if (distance <= 0) return;
    
    e.preventDefault();
    
    const pull = ease(distance);
    
    wrapper.style.transform =
      `translate3d(0,${pull}px,0)`;
    
    indicator.classList.add("active");
    
    indicator.style.transform =
      `translate(-50%, ${Math.min(pull - 70, 20)}px)`;
    
  }, {
    passive: false
  });
  
  document.addEventListener("touchend", async () => {
    
    if (!pulling) return;
    
    pulling = false;
    
    wrapper.classList.remove("dragging");
    
    const distance = currentY - startY;
    
    if (distance >= TRIGGER && !refreshing) {
      
      refreshing = true;
      
      indicator.classList.add("loading");
      
      wrapper.style.transform =
        "translate3d(0,70px,0)";
      
      try {
        
        await Promise.resolve(onRefresh());
        
      } catch (err) {
        
        console.error(err);
        
      }
      
      setTimeout(() => {
        
        wrapper.style.transform = "";
        
        indicator.classList.remove("loading");
        indicator.classList.remove("active");
        
        indicator.style.transform = "";
        
        refreshing = false;
        
      }, 350);
      
    } else {
      
      wrapper.style.transform = "";
      
      indicator.classList.remove("active");
      
      indicator.style.transform = "";
      
    }
    
    startY = 0;
    currentY = 0;
    
  });
  
}