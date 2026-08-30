(() => {
  "use strict";

  if (window.__ScoutwaveToastInstalled) {
    return;
  }

  window.__ScoutwaveToastInstalled = true;

  /********* config *********/

  const CONFIG = {
    position: "top-right",
    duration: 4000,
    loadingDuration: 0,
    maxVisible: 4,
    gap: 10,
    animationDuration: 260,
    duplicateWindow: 1200,
  };

  /********* state *********/

  let container = null;
  let sequence = 0;

  const toasts = new Map();
  const recent = new Map();

  /********* icons *********/

  const ICONS = {
    success: `
      <span class="toast-icon-mask toast-icon-success"></span>
    `,

    error: `
      <span class="toast-icon-mask toast-icon-error"></span>
    `,

    warning: `
      <span class="toast-icon-mask toast-icon-warning"></span>
    `,

    info: `
      <span class="toast-icon-mask toast-icon-info"></span>
    `,

    loading: `
      <span class="toast-spinner"></span>
    `,
  };

  /********* helpers *********/

  function nextId() {
    sequence += 1;

    return `toast-${Date.now()}-${sequence}`;
  }

  function normalizeType(type) {
    return [
      "success",
      "error",
      "warning",
      "info",
      "loading",
    ].includes(type)
      ? type
      : "info";
  }

  function normalizeOptions(options) {
    if (typeof options === "string") {
      return {
        message: options,
      };
    }

    return {
      ...(options || {}),
    };
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureContainer() {
    if (
      container &&
      container.isConnected
    ) {
      return container;
    }

    if (!document.body) {
      return null;
    }

    container =
      document.querySelector(
        "[data-toast-container]"
      );

    if (!container) {
      container =
        document.createElement("div");

      container.className =
        "toast-container";

      container.dataset.toastContainer =
        "true";

      container.setAttribute(
        "aria-live",
        "polite"
      );

      container.setAttribute(
        "aria-atomic",
        "false"
      );

      document.body.appendChild(
        container
      );
    }

    applyPosition();

    return container;
  }

  function applyPosition() {
    if (!container) return;

    container.classList.remove(
      "toast-position-top-right",
      "toast-position-top-left",
      "toast-position-bottom-right",
      "toast-position-bottom-left",
      "toast-position-top-center",
      "toast-position-bottom-center"
    );

    container.classList.add(
      `toast-position-${CONFIG.position}`
    );
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches ?? false
    );
  }

  /********* stacking *********/

  /*
   * A toast always enters at the edge the
   * container is anchored to — top stacks
   * grow downward from a new top card,
   * bottom stacks grow upward from a new
   * bottom card — just like a native
   * notification stack.
   */
  function insertToastElement(root, element) {
    if (CONFIG.position.startsWith("top-")) {
      root.prepend(element);
    } else {
      root.appendChild(element);
    }
  }

  /*
   * Assigns each toast a --stack-i custom
   * property (0 = frontmost/newest) so the
   * CSS can fade + scale older cards behind
   * the active one, like a stacked deck.
   */
  function reindexStack() {
    if (!container) return;

    const children = [...container.children];

    const ordered = CONFIG.position.startsWith("top-")
      ? children
      : children.reverse();

    ordered.forEach((el, index) => {
      el.style.setProperty("--stack-i", index);
    });
  }

  /*
   * FLIP reflow: captures where every other
   * toast sits before a removal, then — once
   * the DOM has actually settled — animates
   * from the old position to the new one, so
   * the stack glides shut instead of snapping.
   */
  function captureRects(excludeEl) {
    const rects = new Map();

    if (!container) return rects;

    for (const el of container.children) {
      if (el === excludeEl) continue;
      rects.set(el, el.getBoundingClientRect());
    }

    return rects;
  }

  function playReflow(beforeRects) {
    if (prefersReducedMotion()) return;

    for (const [el, rectBefore] of beforeRects) {
      if (!el.isConnected) continue;

      const rectAfter = el.getBoundingClientRect();

      const dx = rectBefore.left - rectAfter.left;
      const dy = rectBefore.top - rectAfter.top;

      if (!dx && !dy) continue;

      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 320,
          easing: "cubic-bezier(.22, 1.1, .32, 1)",
          composite: "add",
        }
      );
    }
  }

  function isDuplicate(type, message) {
    const key =
      `${type}:${String(message)}`;

    const now = Date.now();
    const previous =
      recent.get(key);

    recent.set(key, now);

    if (!previous) {
      return false;
    }

    return (
      now - previous <
      CONFIG.duplicateWindow
    );
  }

  function clearExpiredRecentMessages() {
    const cutoff =
      Date.now() -
      CONFIG.duplicateWindow;

    recent.forEach(
      (timestamp, key) => {
        if (timestamp < cutoff) {
          recent.delete(key);
        }
      }
    );
  }

  /********* toast html *********/

  function createHTML(
    type,
    title,
    message,
    options,
    duration
  ) {
    const showTitle =
      options.showTitle !== false;

    const closeButton =
      options.closeButton !== false;

    const action =
      options.action &&
      typeof options.action ===
        "object";

    return `
      <div
        class="toast-icon toast-icon-${type}"
        aria-hidden="true"
      >
        ${ICONS[type]}
      </div>

      <div class="toast-content">

        ${
          showTitle
            ? `
              <div class="toast-title">
                ${escapeHTML(title)}
              </div>
            `
            : ""
        }

        <div class="toast-message">
          ${escapeHTML(message)}
        </div>

        ${
          action
            ? `
              <button
                class="toast-action"
                type="button"
                data-toast-action
              >
                ${escapeHTML(
                  action.label ||
                  "Action"
                )}
              </button>
            `
            : ""
        }

      </div>

      ${
        closeButton
          ? `
            <button
              class="toast-close"
              type="button"
              data-toast-close
              aria-label="Close notification"
            ></button>
          `
          : ""
      }

      ${
        duration > 0
          ? `
            <span
              class="toast-progress"
              style="--toast-duration:${duration}ms"
              aria-hidden="true"
            ></span>
          `
          : ""
      }
    `;
  }

  /********* create toast *********/

  function createToast(
    type,
    options = {}
  ) {
    type =
      normalizeType(type);

    clearExpiredRecentMessages();

    const normalized =
      normalizeOptions(options);

    const message =
      normalized.message ??
      normalized.text ??
      "";

    if (!message) {
      return null;
    }

    if (
      normalized.preventDuplicate !==
        false &&
      isDuplicate(
        type,
        message
      )
    ) {
      return null;
    }

    const root =
      ensureContainer();

    if (!root) {
      console.warn(
        "[Toast] Document body is not ready."
      );

      return null;
    }

    const id =
      normalized.id ||
      nextId();

    const duration =
      type === "loading"
        ? CONFIG.loadingDuration
        : Number.isFinite(
            normalized.duration
          )
          ? Math.max(
              0,
              normalized.duration
            )
          : CONFIG.duration;

    const titles = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Information",
      loading: "Loading",
    };

    const title =
      normalized.title ??
      titles[type];

    const element =
      document.createElement("div");

    element.className =
      `toast toast-${type}`;

    element.dataset.toastId =
      id;

    element.dataset.toastType =
      type;

    element.setAttribute(
      "role",
      type === "error"
        ? "alert"
        : "status"
    );

    element.innerHTML =
      createHTML(
        type,
        title,
        message,
        normalized,
        duration
      );

    insertToastElement(root, element);
    reindexStack();

    const state = {
      id,
      type,
      element,
      timer: null,
      duration,
      options: normalized,
    };

    toasts.set(id, state);

    bindToastEvents(state);

    requestAnimationFrame(() => {
      if (
        element.isConnected
      ) {
        element.classList.add(
          "is-visible"
        );
      }
    });

    if (duration > 0) {
      state.timer =
        window.setTimeout(
          () => {
            removeToast(id);
          },
          duration
        );
    }

    enforceLimit();

    return createController(id);
  }

  /********* events *********/

  function bindToastEvents(state) {
    const {
      id,
      element,
      options,
    } = state;

    element
      .querySelector(
        "[data-toast-close]"
      )
      ?.addEventListener(
        "click",
        () => {
          removeToast(id);
        }
      );

    element
      .querySelector(
        "[data-toast-action]"
      )
      ?.addEventListener(
        "click",
        () => {
          try {
            options.action
              ?.onClick?.();
          } catch (error) {
            console.error(
              "[Toast] Action failed:",
              error
            );
          }

          if (
            options.action
              ?.close !== false
          ) {
            removeToast(id);
          }
        }
      );
  }

  /********* remove toast *********/

  function removeToast(
    id,
    immediate = false
  ) {
    const state =
      toasts.get(id);

    if (!state) {
      return;
    }

    if (state.timer) {
      clearTimeout(
        state.timer
      );
    }

    toasts.delete(id);

    const element =
      state.element;

    if (
      immediate ||
      !element.isConnected
    ) {
      const beforeRects =
        captureRects(element);

      element.remove();

      reindexStack();
      playReflow(beforeRects);
      return;
    }

    element.classList.remove(
      "is-visible"
    );

    element.classList.add(
      "is-removing"
    );

    window.setTimeout(
      () => {
        const beforeRects =
          captureRects(element);

        element.remove();

        reindexStack();
        playReflow(beforeRects);
      },
      CONFIG.animationDuration
    );
  }

  /********* replace toast *********/

  function updateToast(
    id,
    type,
    message,
    options = {}
  ) {
    const state =
      toasts.get(id);

    if (!state) {
      return createToast(
        type,
        {
          ...options,
          message,
        }
      );
    }

    if (state.timer) {
      clearTimeout(
        state.timer
      );

      state.timer = null;
    }

    type =
      normalizeType(type);

    const normalized =
      normalizeOptions(options);

    const duration =
      type === "loading"
        ? CONFIG.loadingDuration
        : Number.isFinite(
            normalized.duration
          )
          ? Math.max(
              0,
              normalized.duration
            )
          : CONFIG.duration;

    const titles = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Information",
      loading: "Loading",
    };

    const title =
      normalized.title ??
      titles[type];

    state.type = type;
    state.duration =
      duration;
    state.options =
      normalized;

    state.element.className =
      `toast toast-${type} is-visible`;

    state.element.dataset.toastType =
      type;

    state.element.innerHTML =
      createHTML(
        type,
        title,
        message,
        normalized,
        duration
      );

    bindToastEvents(state);

    if (duration > 0) {
      state.timer =
        window.setTimeout(
          () => {
            removeToast(id);
          },
          duration
        );
    }

    return createController(id);
  }

  /********* controller *********/

  function createController(id) {
    return {
      id,

      close() {
        removeToast(id);
      },

      success(
        message,
        options = {}
      ) {
        return updateToast(
          id,
          "success",
          message,
          options
        );
      },

      error(
        message,
        options = {}
      ) {
        return updateToast(
          id,
          "error",
          message,
          options
        );
      },

      warning(
        message,
        options = {}
      ) {
        return updateToast(
          id,
          "warning",
          message,
          options
        );
      },

      info(
        message,
        options = {}
      ) {
        return updateToast(
          id,
          "info",
          message,
          options
        );
      },

      loading(
        message,
        options = {}
      ) {
        return updateToast(
          id,
          "loading",
          message,
          options
        );
      },
    };
  }

  /********* limit *********/

  function enforceLimit() {
    while (
      toasts.size >
      CONFIG.maxVisible
    ) {
      const oldest =
        toasts.keys()
          .next()
          .value;

      if (!oldest) {
        break;
      }

      removeToast(oldest);
    }
  }

  /********* clear *********/

  function clearAll() {
    [
      ...toasts.keys(),
    ].forEach(id => {
      removeToast(
        id,
        true
      );
    });
  }

  /********* configuration *********/

  function configure(
    options = {}
  ) {
    Object.assign(
      CONFIG,
      options
    );

    if (container) {
      applyPosition();
      reindexStack();
    }

    enforceLimit();

    return {
      ...CONFIG,
    };
  }

  /********* public api *********/

  const Toast = {
    __scoutwaveToast: true,

    show(
      type,
      options
    ) {
      return createToast(
        type,
        options
      );
    },

    success(
      message,
      options = {}
    ) {
      return createToast(
        "success",
        {
          ...options,
          message,
        }
      );
    },

    error(
      message,
      options = {}
    ) {
      return createToast(
        "error",
        {
          ...options,
          message,
        }
      );
    },

    warning(
      message,
      options = {}
    ) {
      return createToast(
        "warning",
        {
          ...options,
          message,
        }
      );
    },

    info(
      message,
      options = {}
    ) {
      return createToast(
        "info",
        {
          ...options,
          message,
        }
      );
    },

    loading(
      message,
      options = {}
    ) {
      return createToast(
        "loading",
        {
          ...options,
          message,
        }
      );
    },

    close(id) {
      removeToast(id);
    },

    clear() {
      clearAll();
    },

    configure,

    get count() {
      return toasts.size;
    },
  };

  window.Toast = Toast;
  window.toast = Toast;
})();