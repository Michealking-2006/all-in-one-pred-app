(() => {
  if (window.__appScriptLoaderInstalled) return;
  
  window.__appScriptLoaderInstalled = true;
  
  const scriptPromises = new Map();
  
  function resolveUrl(src) {
    return new URL(src, document.baseURI).href;
  }
  
  function findScript(url) {
    return [...document.scripts].find(
      script => script.dataset.appScriptSrc === url
    );
  }
  
  function loadPageScript(src) {
    const url = resolveUrl(src);
    
    if (scriptPromises.has(url)) {
      return scriptPromises.get(url);
    }
    
    const existing = findScript(url);
    
    if (existing) {
      if (existing.dataset.loaded === "true") {
        const ready = Promise.resolve(existing);
        scriptPromises.set(url, ready);
        return ready;
      }
      
      const waiting = new Promise((resolve, reject) => {
        const cleanup = () => {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
        };
        
        const onLoad = () => {
          cleanup();
          existing.dataset.loaded = "true";
          resolve(existing);
        };
        
        const onError = () => {
          cleanup();
          scriptPromises.delete(url);
          reject(new Error(`Failed to load ${url}`));
        };
        
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
      });
      
      scriptPromises.set(url, waiting);
      return waiting;
    }
    
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      
      script.src = url;
      script.async = false;
      script.dataset.appScriptSrc = url;
      
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve(script);
      };
      
      script.onerror = () => {
        scriptPromises.delete(url);
        reject(new Error(`Failed to load ${url}`));
      };
      
      document.head.appendChild(script);
    });
    
    scriptPromises.set(url, promise);
    
    return promise;
  }
  
  class AppScript extends HTMLElement {
    connectedCallback() {
      // Deliberately do nothing.
      //
      // The router loads app scripts AFTER the complete
      // page HTML has been mounted.
    }
  }
  
  if (!customElements.get("app-script")) {
    customElements.define("app-script", AppScript);
  }
  
  window.loadPageScript = loadPageScript;
})();