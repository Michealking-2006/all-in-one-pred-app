(() => {
  "use strict";

  if (window.__appScriptLoaderInstalled) {
    return;
  }

  window.__appScriptLoaderInstalled = true;

  /********* helpers *********/

  function resolveSrc(src) {
    return new URL(
      src,
      document.baseURI
    ).href;
  }

  /********* load script *********/

  function loadPageScript(
    src,
    options = {}
  ) {
    if (!src) {
      return Promise.reject(
        new Error(
          "[AppScript] Missing src"
        )
      );
    }

    const url = resolveSrc(src);

    /*
     * Match a normal dynamically-created
     * <script src="...">.
     *
     * No caching.
     * Every call creates a new script.
     */
    const {
      async = false,
      defer = false,
      type = "",
      noModule = false,
    } = options;

    return new Promise(
      (resolve, reject) => {
        const script =
          document.createElement(
            "script"
          );

        script.src = url;
        script.async = async;
        script.defer = defer;

        if (type) {
          script.type = type;
        }

        script.noModule = noModule;

        script.dataset.appScriptSrc =
          url;

        script.addEventListener(
          "load",
          () => {
            resolve(script);
          },
          {
            once: true,
          }
        );

        script.addEventListener(
          "error",
          () => {
            script.remove();

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

        document.head.appendChild(
          script
        );
      }
    );
  }

  /********* custom element *********/

  class AppScript extends HTMLElement {

    connectedCallback() {
      const src =
        this.getAttribute("src");

      if (!src) {
        return;
      }

      const asyncAttr =
        this.getAttribute("async");

      const deferAttr =
        this.getAttribute("defer");

      const type =
        this.getAttribute("type") || "";

      const noModule =
        this.hasAttribute("nomodule");

      loadPageScript(src, {
        /*
         * Default is false so the router
         * can preserve script order.
         */
        async:
          asyncAttr !== null,

        defer:
          deferAttr !== null,

        type,

        noModule,
      }).then(() => {
        this.dispatchEvent(
          new CustomEvent(
            "appscriptload",
            {
              bubbles: true,
              detail: {
                src,
              },
            }
          )
        );
      }).catch(error => {
        this.dispatchEvent(
          new CustomEvent(
            "appscripterror",
            {
              bubbles: true,
              detail: {
                src,
                error,
              },
            }
          )
        );

        console.error(
          "[AppScript]",
          error
        );
      });
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

  /********* api *********/

  window.loadPageScript =
    loadPageScript;

  window.appScriptLoader = {
    loadPageScript,
  };
})();