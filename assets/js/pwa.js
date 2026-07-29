const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;

if (isStandalone) {
    document.documentElement.classList.add("pwa-standalone");
    initPullToRefresh(refreshData);
}


function initPullToRefresh(onRefresh) {
  
  if (
    window.matchMedia("(display-mode: standalone)").matches === false &&
    document.referrer.indexOf("android-app://") === -1
  ) {
    return;
  }
  
  const wrapper = document.querySelector(".ptr-wrapper");
  const indicator = document.querySelector(".ptr-indicator");
  
  let startY = 0;
  let pulling = false;
  let distance = 0;
  let refreshing = false;
  
  const MAX_PULL = 120;
  const TRIGGER = 80;
  
  function ease(d) {
    return Math.min(MAX_PULL, d * 0.55);
  }
  
  document.addEventListener("touchstart", e => {
    
    if (refreshing) return;
    if (window.scrollY > 0) return;
    
    startY = e.touches[0].clientY;
    pulling = true;
    
  }, { passive: true });
  
  document.addEventListener("touchmove", e => {
    
    if (!pulling) return;
    
    distance = e.touches[0].clientY - startY;
    
    if (distance <= 0) return;
    
    e.preventDefault();
    
    const y = ease(distance);
    
    wrapper.style.transform = `translateY(${y}px)`;
    
    indicator.classList.add("active");
    
    indicator.style.transform =
      `translate(-50%, ${Math.min(y - 60, 25)}px)`;
    
  }, { passive: false });
  
  document.addEventListener("touchend", async () => {
    
    if (!pulling) return;
    
    pulling = false;
    
    if (distance >= TRIGGER && !refreshing) {
      
      refreshing = true;
      
      indicator.classList.add("loading");
      
      wrapper.style.transform = "translateY(70px)";
      
      try {
        
        await onRefresh();
        
      } finally {
        
        setTimeout(() => {
          
          wrapper.style.transform = "";
          
          indicator.classList.remove("loading");
          indicator.classList.remove("active");
          indicator.style.transform = "";
          
          refreshing = false;
          
        }, 300);
        
      }
      
    } else {
      
      wrapper.style.transform = "";
      
      indicator.classList.remove("active");
      indicator.style.transform = "";
      
    }
    
    distance = 0;
    
  });
  
}