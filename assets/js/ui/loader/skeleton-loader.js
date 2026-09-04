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
   * check if element has real content
   *********************/
  hasContent(element) {
    const text = element.textContent.replace(/\s+/g, "").trim();
    
    if (text.length > 0) {
      return true;
    }
    
    const img = element.querySelector("img");
    if (img && img.complete && img.naturalWidth > 0) {
      return true;
    }
    
    const hasMeaningfulChild = Array.from(element.children).some((child) => {
      return child.textContent.replace(/\s+/g, "").trim().length > 0;
    });
    
    return hasMeaningfulChild;
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