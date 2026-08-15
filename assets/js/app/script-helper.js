(() => {
  if (window.__appScriptLoaderInstalled) {
    return;
  }

  window.__appScriptLoaderInstalled = true;

  /********* state *********/

  const scriptPromises = new Map();
  const scriptElements = new Map();
  const lifecycleRegistry = new Map();

  /********* helpers *********/

  function resolveSrc(src) {
    return new URL(
      src,
      document.baseURI
    ).href;
  }

  function normalizeUrl(src) {
    return resolveSrc(src);
  }

  function getExistingScript(url) {
    return (
      scriptElements.get(url) ||
      [...document.querySelectorAll(
        "script[data-app-script-src]"
      )].find(
        (script) =>
          script.getAttribute(
            "data-app-script-src"
          ) === url
      ) ||
      null
    );
  }

  function getScriptKey(src) {
    return normalizeUrl(src);
  }

  /********* lifecycle registration *********/

  function register(
    src,
    hooks = {}
  ) {
    const key =
      getScriptKey(src);

    lifecycleRegistry.set(
      key,
      {
        init:
          typeof hooks.init ===
          "function"
            ? hooks.init
            : null,

        destroy:
          typeof hooks.destroy ===
          "function"
            ? hooks.destroy
            : null,

        active: false,
      }
    );

    return lifecycleRegistry.get(
      key
    );
  }

  function getLifecycle(src) {
    return lifecycleRegistry.get(
      getScriptKey(src)
    );
  }

  async function initLifecycle(
    src,
    context = {}
  ) {
    const lifecycle =
      getLifecycle(src);

    if (
      !lifecycle ||
      lifecycle.active
    ) {
      return;
    }

    lifecycle.active = true;

    try {
      await lifecycle.init?.(
        context
      );
    } catch (error) {
      lifecycle.active = false;

      console.error(
        `[AppScript] Init failed for ${src}:`,
        error
      );

      throw error;
    }
  }

  async function destroyLifecycle(
    src,
    context = {}
  ) {
    const lifecycle =
      getLifecycle(src);

    if (
      !lifecycle ||
      !lifecycle.active
    ) {
      return;
    }

    try {
      await lifecycle.destroy?.(
        context
      );
    } catch (error) {
      console.error(
        `[AppScript] Destroy failed for ${src}:`,
        error
      );
    }

    lifecycle.active = false;
  }

  /********* script loading *********/

  function loadPageScript(
    src,
    options = {}
  ) {
    const url =
      normalizeUrl(src);

    const {
      async = true,
    } = options;

    const cached =
      scriptPromises.get(url);

    if (cached) {
      return cached;
    }

    const existing =
      getExistingScript(url);

    if (existing) {
      if (
        existing.dataset.loaded ===
        "true"
      ) {
        const ready =
          Promise.resolve(
            existing
          );

        scriptPromises.set(
          url,
          ready
        );

        return ready;
      }

      const pending =
        new Promise(
          (resolve, reject) => {
            const cleanup = () => {
              existing.removeEventListener(
                "load",
                onLoad
              );

              existing.removeEventListener(
                "error",
                onError
              );
            };

            const onLoad = () => {
              cleanup();

              existing.dataset.loaded =
                "true";

              resolve(
                existing
              );
            };

            const onError = () => {
              cleanup();

              scriptPromises.delete(
                url
              );

              reject(
                new Error(
                  `Failed to load ${url}`
                )
              );
            };

            existing.addEventListener(
              "load",
              onLoad,
              { once: true }
            );

            existing.addEventListener(
              "error",
              onError,
              { once: true }
            );
          }
        );

      scriptPromises.set(
        url,
        pending
      );

      return pending;
    }

    const promise =
      new Promise(
        (resolve, reject) => {
          const script =
            document.createElement(
              "script"
            );

          script.src = url;
          script.async = async;

          script.setAttribute(
            "data-app-script-src",
            url
          );

          script.addEventListener(
            "load",
            () => {
              script.dataset.loaded =
                "true";

              scriptElements.set(
                url,
                script
              );

              resolve(
                script
              );
            },
            {
              once: true,
            }
          );

          script.addEventListener(
            "error",
            () => {
              scriptPromises.delete(
                url
              );

              scriptElements.delete(
                url
              );

              reject(
                new Error(
                  `Failed to load ${url}`
                )
              );
            },
            {
              once: true,
            }
          );

          scriptElements.set(
            url,
            script
          );

          document.head.appendChild(
            script
          );
        }
      );

    scriptPromises.set(
      url,
      promise
    );

    return promise;
  }

  /********* app-script *********/

  class AppScript
    extends HTMLElement {

    async connectedCallback() {
      const src =
        this.getAttribute("src");

      if (!src) {
        return;
      }

      try {
        await loadPageScript(src);

        this.dispatchEvent(
          new CustomEvent(
            "appscriptready",
            {
              bubbles: true,
              detail: {
                src:
                  normalizeUrl(
                    src
                  ),
                element: this,
              },
            }
          )
        );
      } catch (error) {
        console.error(
          "[AppScript]",
          error
        );

        this.dispatchEvent(
          new CustomEvent(
            "appscripterror",
            {
              bubbles: true,
              detail: {
                src:
                  normalizeUrl(
                    src
                  ),
                error,
              },
            }
          )
        );
      }
    }

    async disconnect() {
      const src =
        this.getAttribute("src");

      if (!src) {
        return;
      }

      await destroyLifecycle(
        src,
        {
          element: this,
        }
      );
    }
  }

  if (
    !customElements.get(
      "app-script"
    )
  ) {
    customElements.define(
      "app-script",
      AppScript
    );
  }

  /********* public api *********/

  window.loadPageScript =
    loadPageScript;

  window.registerAppScript =
    register;

  window.initAppScript =
    initLifecycle;

  window.destroyAppScript =
    destroyLifecycle;

  window.appScriptLoader = {
    loadPageScript,
    register,
    init: initLifecycle,
    destroy: destroyLifecycle,
  };
})();