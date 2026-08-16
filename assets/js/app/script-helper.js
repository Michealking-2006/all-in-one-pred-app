(() => {
  if (window.__appScriptLoaderInstalled) return;
  window.__appScriptLoaderInstalled = true;

  /********* load script *********/

  function resolveSrc(src) {
    return new URL(
      src,
      document.baseURI
    ).href;
  }

  function loadPageScript(
    src,
    options = {}
  ) {
    const url = resolveSrc(src);
    const { async = true } = options;

    return new Promise((resolve, reject) => {
      const script =
        document.createElement("script");

      script.src = url;
      script.async = async;

      script.setAttribute(
        "data-app-script-src",
        url
      );

      script.addEventListener(
        "load",
        () => {
          resolve(script);
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          reject(
            new Error(
              `Failed to load ${url}`
            )
          );
        },
        { once: true }
      );

      document.head.appendChild(script);
    });
  }

  /********* custom element *********/

  class AppScript extends HTMLElement {
    connectedCallback() {
      const src =
        this.getAttribute("src");

      if (!src) return;

      loadPageScript(src).catch(
        (error) => {
          console.error(
            "[AppScript]",
            error
          );
        }
      );
    }
  }

  if (
    !customElements.get("app-script")
  ) {
    customElements.define(
      "app-script",
      AppScript
    );
  }

  /********* api *********/

  window.loadPageScript =
    loadPageScript;

  window.appScriptLoader = {
    loadPageScript,
  };
})();