/********* Scoutwave toast *********/

(() => {
  "use strict";

  if (window.Toast?.__scoutwaveToast) {
    return;
  }

  const CONFIG = {
    position: "top-right",
    duration: 4000,
    maxVisible: 5,
    animationDuration: 250,
    duplicateWindow: 1200,
  };

  const ICONS = {
    success: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="m9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41z"
        />
      </svg>
    `,

    error: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"
        />
      </svg>
    `,

    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2 1 21h22ZM13 18h-2v-2h2Zm0-4h-2V9h2Z"
        />
      </svg>
    `,

    info: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M11 17h2v-6h-2Zm1-15a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8ZM11 9h2V7h-2Z"
        />
      </svg>
    `,

    loading: `
      <span
        class="toast-spinner"
        aria-hidden="true"
      ></span>
    `,
  };

  let container = null;
  let sequence = 0;

  const activeToasts = new Map();
  const recentMessages = new Map();

  /********* helpers *********/

  function getContainer() {
    if (
      container &&
      container.isConnected
    ) {
      return container;
    }

    if (!document.body) {
      return null;
    }

    container = document.querySelector(
      "[data-toast-container]"
    );

    if (!container) {
      container =
        document.createElement("div");

      container.className =
        `toast-container toast-position-${CONFIG.position}`;

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

    return container;
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
    if (
      typeof options === "string"
    ) {
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

  function createId() {
    sequence += 1;

    return `toast-${Date.now()}-${sequence}`;
  }

  function isDuplicate(
    type,
    message
  ) {
    const key =
      `${type}:${String(message)}`;

    const now = Date.now();
    const previous =
      recentMessages.get(key);

    recentMessages.set(key, now);

    return (
      previous &&
      now - previous <
        CONFIG.duplicateWindow
    );
  }

  /********* remove *********/

  function removeToast(
    id,
    immediate = false
  ) {
    const state =
      activeToasts.get(id);

    if (!state) {
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
    }

    activeToasts.delete(id);

    const element =
      state.element;

    if (
      immediate ||
      !element.isConnected
    ) {
      element.remove();
      return;
    }

    element.classList.remove(
      "toast-visible"
    );

    element.classList.add(
      "toast-removing"
    );

    window.setTimeout(() => {
      element.remove();
    }, CONFIG.animationDuration);
  }

  function enforceLimit() {
    while (
      activeToasts.size >
      CONFIG.maxVisible
    ) {
      const first =
        activeToasts
          .keys()
          .next()
          .value;

      if (!first) {
        break;
      }

      removeToast(first);
    }
  }

  /********* create *********/

  function createToast(
    type,
    options = {}
  ) {
    type =
      normalizeType(type);

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
      isDuplicate(type, message)
    ) {
      return null;
    }

    const root =
      getContainer();

    if (!root) {
      console.warn(
        "[Toast] Document body is not ready."
      );

      return null;
    }

    const id =
      normalized.id ||
      createId();

    const duration =
      type === "loading"
        ? 0
        : Number.isFinite(
            normalized.duration
          )
          ? Math.max(
              0,
              normalized.duration
            )
          : CONFIG.duration;

    const title =
      normalized.title ||
      {
        success: "Success",
        error: "Error",
        warning: "Warning",
        info: "Information",
        loading: "Loading",
      }[type];

    const toast =
      document.createElement("div");

    toast.className =
      `toast toast-${type}`;

    toast.dataset.toastId =
      id;

    toast.dataset.toastType =
      type;

    toast.setAttribute(
      "role",
      type === "error"
        ? "alert"
        : "status"
    );

    const actionHTML =
      normalized.action
        ? `
          <button
            type="button"
            class="toast-action"
            data-toast-action
          >
            ${escapeHTML(
              normalized.action.label ||
              "Action"
            )}
          </button>
        `
        : "";

    const closeHTML =
      normalized.closeButton === false
        ? ""
        : `
          <button
            type="button"
            class="toast-close"
            data-toast-close
            aria-label="Close notification"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.7l4.89 4.89-4.89 4.89 1.41 1.41L12 12l4.89 4.89 1.41-1.41-4.89-4.89z"
              />
            </svg>
          </button>
        `;

    toast.innerHTML = `
      <div class="toast-icon">
        ${ICONS[type]}
      </div>

      <div class="toast-content">

        ${
          normalized.showTitle === false
            ? ""
            : `
              <div class="toast-title">
                ${escapeHTML(title)}
              </div>
            `
        }

        <div class="toast-message">
          ${escapeHTML(message)}
        </div>

        ${actionHTML}

      </div>

      ${closeHTML}

      ${
        duration > 0
          ? `<div class="toast-progress"></div>`
          : ""
      }
    `;

    root.appendChild(toast);

    const state = {
      element: toast,
      timer: null,
    };

    activeToasts.set(
      id,
      state
    );

    requestAnimationFrame(() => {
      if (toast.isConnected) {
        toast.classList.add(
          "toast-visible"
        );
      }
    });

    toast
      .querySelector(
        "[data-toast-close]"
      )
      ?.addEventListener(
        "click",
        () => {
          removeToast(id);
        }
      );

    toast
      .querySelector(
        "[data-toast-action]"
      )
      ?.addEventListener(
        "click",
        () => {
          try {
            normalized
              .action
              ?.onClick?.();
          } finally {
            if (
              normalized.action
                ?.close !== false
            ) {
              removeToast(id);
            }
          }
        }
      );

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
        return replaceToast(
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
        return replaceToast(
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
        return replaceToast(
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
        return replaceToast(
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
        return replaceToast(
          id,
          "loading",
          message,
          options
        );
      },
    };
  }

  function replaceToast(
    id,
    type,
    message,
    options = {}
  ) {
    removeToast(
      id,
      true
    );

    return createToast(
      type,
      {
        ...options,
        id,
        message,
        preventDuplicate: false,
      }
    );
  }

  /********* public methods *********/

  function show(type, options) {
    return createToast(
      normalizeType(type),
      options
    );
  }

  function clear() {
    [
      ...activeToasts.keys(),
    ].forEach(id => {
      removeToast(id);
    });
  }

  function configure(options = {}) {
    Object.assign(
      CONFIG,
      options
    );

    if (container) {
      container.className =
        `toast-container toast-position-${CONFIG.position}`;
    }

    return {
      ...CONFIG,
    };
  }

  /********* API *********/

  const Toast = {
    __scoutwaveToast: true,

    show,

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

    clear,

    configure,

    get count() {
      return activeToasts.size;
    },
  };

  window.Toast = Toast;
  window.toast = Toast;

})();