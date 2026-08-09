/*********************
 * global skeleton loader
 *********************/

const APP_SKELETON = {
  observer: null,
  initialized: false,
  checkTimer: null,
  
  /*********************
   * initialize loader
   *********************/
  init() {
    if (this.initialized) return;
    
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => this.init(), {
        once: true,
      });
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
   * schedule check
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
    
    skeletons.forEach((element) => {
      if (this.hasContent(element)) {
        this.remove(element);
      }
    });
  },
  
  /*********************
   * check element content
   *********************/
  hasContent(element) {
    if (element.dataset.skeletonReady === "true") {
      return true;
    }
    
    if (element instanceof HTMLImageElement) {
      return element.complete && element.naturalWidth > 0;
    }
    
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      return element.value.trim().length > 0;
    }
    
    return element.textContent.trim().length > 0;
  },
  
  /*********************
   * remove skeleton classes
   *********************/
  remove(element) {
    const classesToRemove = [];
    
    element.classList.forEach((className) => {
      if (
        className === "app-skeleton" ||
        className.startsWith("app-skeleton-")
      ) {
        classesToRemove.push(className);
      }
    });
    
    element.classList.remove(...classesToRemove);
    element.removeAttribute("data-skeleton-ready");
  },
  
  /*********************
   * mark element ready manually
   *********************/
  ready(target) {
    const element =
      typeof target === "string" ? document.querySelector(target) : target;
    
    if (!element) return;
    
    element.dataset.skeletonReady = "true";
    this.scheduleCheck();
  },
  
  /*********************
   * destroy loader
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
 * initialize loader
 *********************/

APP_SKELETON.init();