(() => {
  if (window.__appScriptLoaderInstalled) return;
  window.__appScriptLoaderInstalled = true;
  
  const loadedScripts = new Map();
  
  function resolveSrc(src) {
    return new URL(src, document.baseURI).href;
  }
  
  function loadPageScript(src) {
    const url = resolveSrc(src);
    
    if (loadedScripts.has(url)) {
      return loadedScripts.get(url);
    }
    
    const promise = new Promise((resolve, reject) => {
      const existing = [...document.querySelectorAll("script[data-app-script-src]")].find(
        el => el.getAttribute("data-app-script-src") === url
      );
      
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve(existing);
          return;
        }
        
        existing.addEventListener("load", () => resolve(existing), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${url}`)), { once: true });
        return;
      }
      
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.setAttribute("data-app-script-src", url);
      
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(script);
      }, { once: true });
      
      script.addEventListener("error", () => {
        loadedScripts.delete(url);
        reject(new Error(`Failed to load ${url}`));
      }, { once: true });
      
      document.head.appendChild(script);
    });
    
    loadedScripts.set(url, promise);
    return promise;
  }
  
  class AppScript extends HTMLElement {
    connectedCallback() {
      const src = this.getAttribute("src");
      if (!src) return;
      
      loadPageScript(src).catch(err => {
        console.error(err);
      });
    }
  }
  
  if (!customElements.get("app-script")) {
    customElements.define("app-script", AppScript);
  }
  
  window.loadPageScript = loadPageScript;
})();