(() => {
  if (window.__appScriptLoaderInstalled) return;
  window.__appScriptLoaderInstalled = true;

  const scriptPromises = new Map(); // url -> Promise<HTMLScriptElement>
  const scriptElements = new Map(); // url -> HTMLScriptElement

  function resolveSrc(src) {
    return new URL(src, document.baseURI).href;
  }

  function markLoaded(url, script) {
    script.dataset.loaded = "true";
    scriptPromises.set(url, Promise.resolve(script));
    scriptElements.set(url, script);
  }

  function loadPageScript(src, options = {}) {
    const url = resolveSrc(src);
    const { async = true } = options;

    const cached = scriptPromises.get(url);
    if (cached) return cached;

    const existing = scriptElements.get(url)
      || [...document.querySelectorAll("script[data-app-script-src]")].find(
        (el) => el.getAttribute("data-app-script-src") === url
      );

    if (existing) {
      scriptElements.set(url, existing);

      if (existing.dataset.loaded === "true") {
        const ready = Promise.resolve(existing);
        scriptPromises.set(url, ready);
        return ready;
      }

      const pending = new Promise((resolve, reject) => {
        const onLoad = () => {
          markLoaded(url, existing);
          cleanup();
          resolve(existing);
        };

        const onError = () => {
          cleanup();
          scriptPromises.delete(url);
          reject(new Error(`Failed to load ${url}`));
        };

        function cleanup() {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
        }

        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
      });

      scriptPromises.set(url, pending);
      return pending;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = async;
      script.setAttribute("data-app-script-src", url);

      script.addEventListener(
        "load",
        () => {
          markLoaded(url, script);
          resolve(script);
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          scriptPromises.delete(url);
          scriptElements.delete(url);
          reject(new Error(`Failed to load ${url}`));
        },
        { once: true }
      );

      document.head.appendChild(script);
      scriptElements.set(url, script);
    });

    scriptPromises.set(url, promise);
    return promise;
  }

  class AppScript extends HTMLElement {
    connectedCallback() {
      const src = this.getAttribute("src");
      if (!src) return;

      loadPageScript(src).catch((err) => {
        console.error(err);
      });
    }
  }

  if (!customElements.get("app-script")) {
    customElements.define("app-script", AppScript);
  }

  window.loadPageScript = loadPageScript;
})();