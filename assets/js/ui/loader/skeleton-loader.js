/*********************
 * global skeleton loader
 *********************/

const APP_SKELETON = {
  observer: null,
  initialized: false,
  checkTimer: null,
  
  /*********************
   * skeleton classes
   *********************/
  
  classes: [
    "app-skeleton",
    "app-skeleton-w-25",
    "app-skeleton-w-40",
    "app-skeleton-w-50",
    "app-skeleton-w-75",
    "app-skeleton-w-100",
    "app-skeleton-w-120",
    "app-skeleton-w-150",
    "app-skeleton-w-200",
    "app-skeleton-w-full",
    "app-skeleton-h-10",
    "app-skeleton-h-12",
    "app-skeleton-h-16",
    "app-skeleton-h-20",
    "app-skeleton-h-24",
    "app-skeleton-h-32",
    "app-skeleton-h-40",
    "app-skeleton-h-50",
    "app-skeleton-h-64",
    "app-skeleton-rounded-none",
    "app-skeleton-rounded-sm",
    "app-skeleton-rounded",
    "app-skeleton-rounded-md",
    "app-skeleton-rounded-lg",
    "app-skeleton-rounded-xl",
    "app-skeleton-rounded-full",
  ],
  
  /*********************
   * initialize skeleton
   *********************/
  
  init() {
    if (this.initialized) {
      return;
    }
    
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
   * schedule skeleton check
   *********************/
  
  scheduleCheck() {
    clearTimeout(this.checkTimer);
    
    this.checkTimer = setTimeout(() => {
      this.check();
    }, 50);
  },
  
  /*********************
   * check all skeletons
   *********************/
  
  check() {
    const skeletons = document.querySelectorAll(".app-skeleton");
    
    skeletons.forEach((skeleton) => {
      if (!this.hasContent(skeleton)) {
        return;
      }
      
      this.remove(skeleton);
    });
  },
  
  /*********************
   * check skeleton content
   *********************/
  
  hasContent(element) {
    if (!element) {
      return false;
    }
    
    return element.textContent.trim().length > 0;
  },
  
  /*********************
   * remove skeleton state
   *********************/
  
  remove(element) {
    if (!element || !element.isConnected) {
      return;
    }
    
    this.classes.forEach((className) => {
      element.classList.remove(className);
    });
  },
  
  /*********************
   * mark element ready
   *********************/
  
  ready(target) {
    const element =
      typeof target === "string" ?
      document.querySelector(target) :
      target;
    
    if (!element) {
      return;
    }
    
    this.remove(element);
  },
  
  /*********************
   * destroy skeleton
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