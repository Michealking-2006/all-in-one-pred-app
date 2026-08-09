/*********************
 * global skeleton loader
 *********************/

const APP_SKELETON = {
  observer: null,
  initialized: false,
  checkTimer: null,
  
  /*********************
   * initialize skeleton
   *********************/
  
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
    });
    
    this.check();
  },
  
  /*********************
   * schedule check
   *********************/
  
  scheduleCheck() {
    clearTimeout(this.checkTimer);
    
    this.checkTimer = setTimeout(() => {
      this.check();
    }, 50);
  },
  
  /*********************
   * check skeletons
   *********************/
  
  check() {
    const skeletons = document.querySelectorAll(
      ".app-skeleton[data-skeleton-for]"
    );
    
    skeletons.forEach((skeleton) => {
      if (this.hasContent(skeleton)) {
        this.remove(skeleton);
      }
    });
  },
  
  /*********************
   * check element content
   *********************/
  
  hasContent(element) {
    return element.textContent.trim().length > 0;
  },
  
  /*********************
   * remove skeleton state
   *********************/
  
  remove(skeleton) {
    skeleton.classList.remove("app-skeleton");
    skeleton.removeAttribute("data-skeleton-for");
    skeleton.style.removeProperty("width");
    skeleton.style.removeProperty("height");
  },
  
  /*********************
   * mark element ready
   *********************/
  
  ready(target) {
    const element =
      typeof target === "string" ?
      document.querySelector(target) :
      target;
    
    if (!element) return;
    
    this.remove(element);
  },
  
  /*********************
   * destroy
   *********************/
  
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

/*********************
 * initialize skeleton
 *********************/

APP_SKELETON.init();