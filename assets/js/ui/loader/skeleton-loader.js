/*********************
 * global skeleton loader
 *********************/

const APP_SKELETON = {
  observer: null,
  initialized: false,
  
  /*********************
   * initialize skeleton
   *********************/
  
  init() {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    
    this.observer = new MutationObserver(() => {
      this.check();
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "src",
        "data-skeleton-ready",
      ],
    });
    
    this.check();
  },
  
  /*********************
   * check all skeletons
   *********************/
  
  check() {
    const skeletons = document.querySelectorAll(
      ".app-skeleton[data-skeleton-for]"
    );
    
    skeletons.forEach((skeleton) => {
      this.checkSkeleton(skeleton);
    });
  },
  
  /*********************
   * check skeleton
   *********************/
  
  checkSkeleton(skeleton) {
    const selector = skeleton.dataset.skeletonFor;
    
    if (!selector) {
      return;
    }
    
    const target = this.getTarget(selector);
    
    if (!target) {
      return;
    }
    
    if (this.hasContent(target)) {
      this.remove(skeleton);
    }
  },
  
  /*********************
   * get skeleton target
   *********************/
  
  getTarget(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  },
  
  /*********************
   * check target content
   *********************/
  
  hasContent(target) {
    if (target.dataset.skeletonReady === "true") {
      return true;
    }
    
    if (target instanceof HTMLImageElement) {
      return target.complete && target.naturalWidth > 0;
    }
    
    if (target instanceof HTMLInputElement) {
      return target.value.trim().length > 0;
    }
    
    if (target instanceof HTMLTextAreaElement) {
      return target.value.trim().length > 0;
    }
    
    if (target instanceof HTMLSelectElement) {
      return target.value.trim().length > 0;
    }
    
    if (target.textContent.trim().length > 0) {
      return true;
    }
    
    if (target.children.length > 0) {
      return true;
    }
    
    return false;
  },
  
  /*********************
   * remove skeleton
   *********************/
  
  remove(skeleton) {
    if (!skeleton || !skeleton.isConnected) {
      return;
    }
    
    skeleton.remove();
  },
  
  /*********************
   * mark target ready
   *********************/
  
  ready(target) {
    const element =
      typeof target === "string" ?
      this.getTarget(target) :
      target;
    
    if (!element) {
      return;
    }
    
    element.dataset.skeletonReady = "true";
    
    this.check();
  },
  
  /*********************
   * destroy skeleton
   *********************/
  
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.initialized = false;
  },
};

/*********************
 * initialize skeleton
 *********************/

APP_SKELETON.init();