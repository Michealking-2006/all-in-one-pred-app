/*********************
 * global skeleton loader
 *********************/

const APP_SKELETON = {
  observer: null,
  initialized: false,
  checkTimer: null,
  
  init() {
    if (this.initialized) return;
    
    this.initialized = true;
    
    this.observer = new MutationObserver(() => {
      this.scheduleCheck();
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["src", "value", "data-skeleton-ready"],
    });
    
    this.scheduleCheck();
  },
  
  scheduleCheck() {
    clearTimeout(this.checkTimer);
    
    this.checkTimer = setTimeout(() => {
      this.check();
    }, 50);
  },
  
  check() {
    const skeletons = document.querySelectorAll(
      ".app-skeleton[data-skeleton-for]"
    );
    
    skeletons.forEach((skeleton) => {
      const selector = skeleton.dataset.skeletonFor;
      const target = this.getTarget(selector);
      
      if (!target) return;
      
      if (this.hasRealContent(target)) {
        skeleton.remove();
      }
    });
  },
  
  getTarget(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  },
  
  hasRealContent(target) {
    if (target.dataset.skeletonReady === "true") {
      return true;
    }
    
    if (target instanceof HTMLImageElement) {
      return target.complete && target.naturalWidth > 0;
    }
    
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return target.value.trim().length > 0;
    }
    
    const clone = target.cloneNode(true);
    
    clone.querySelectorAll(".app-skeleton").forEach((node) => node.remove());
    
    return this.nodeHasMeaningfulContent(clone);
  },
  
  nodeHasMeaningfulContent(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.trim().length > 0) {
          return true;
        }
      }
      
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child;
        
        if (el.matches("img")) {
          if (el.complete && el.naturalWidth > 0) {
            return true;
          }
        } else if (el.children.length > 0 || el.textContent.trim().length > 0) {
          return true;
        }
      }
    }
    
    return false;
  },
  
  ready(target) {
    const element =
      typeof target === "string" ? this.getTarget(target) : target;
    
    if (!element) return;
    
    element.dataset.skeletonReady = "true";
    this.scheduleCheck();
  },
  
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    clearTimeout(this.checkTimer);
    this.checkTimer = null;
    this.initialized = false;
  },
};

APP_SKELETON.init();