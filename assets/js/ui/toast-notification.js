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
        <path fill="currentColor"
          d="m9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `,

    error: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/>
      </svg>
    `,

    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M12 2 1 21h22ZM13 18h-2v-2h2Zm0-4h-2V9h2Z"/>
      </svg>
    `,

    info: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M11 17h2v-6h-2Zm1-15a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8ZM11 9h2V7h-2Z"/>
      </svg>
    `,

    loading: `
      <span class="toast-spinner" aria-hidden="true"></span>
    `,
  };

  let container = null;
  let sequence = 0;

  const active = new Map();
  const recent = new Map();

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

    container =
      document.querySelector(
        "[data-toast-container]"
      );

    if (!container) {
      container =
        document.createElement("div");

      container.className =
        `toast-container toast-position-${CONFIG.position}`;

      container.dataset.toastContainer = "true";

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

  function typeOf(type) {
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

  function escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeOptions(options) {
    return typeof options === "string"
      ? { message: options }
      : { ...(options || {}) };
  }

  function nextId() {
    sequence++;
    return `toast-${Date.now()}-${sequence}`;
  }

  function duplicate(type, message) {
    const key =
      `${type}:${String(message)}`;

    const now = Date.now();
    const previous = recent.get(key);

    recent.set(key, now);

    return (
      previous &&
      now - previous <
        CONFIG.duplicateWindow
    );
  }

  function remove(id, immediate = false) {
    const state = active.get(id);

    if (!state) return;

    if (state.timer) {
      clearTimeout(state.timer);
    }

    active.delete(id);

    const element = state.element;

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

    setTimeout(() => {
      element.remove();
    }, CONFIG.animationDuration);
  }

  function limit() {
    while (
      active.size >
      CONFIG.maxVisible
    ) {
      const id =
        active.keys().next().value;

      if (!id) break;

      remove(id);
    }
  }

  function create(type, options = {}) {
    type = typeOf(type);

    const opts =
      normalizeOptions(options);

    const message =
      opts.message ??
      opts.text ??
      "";

    if (!message) {
      return null;
    }

    if (
      opts.preventDuplicate !== false &&
      duplicate(type, message)
    ) {
      return null;
    }

    const root = getContainer();

    if (!root) {
      console.warn(
        "[Toast] document.body is not ready."
      );

      return null;
    }

    const id =
      opts.id || nextId();

    const duration =
      type === "loading"
        ? 0
        : Number.isFinite(
            opts.duration
          )
          ? Math.max(
              0,
              opts.duration
            )
          : CONFIG.duration;

    const title =
      opts.title ||
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

    toast.dataset.toastId = id;
    toast.dataset.toastType = type;

    toast.setAttribute(
      "role",
      type === "error"
        ? "alert"
        : "status"
    );

    const action =
      opts.action &&
      typeof opts.action === "object"
        ? `
          <button
            type="button"
            class="toast-action"
            data-toast-action
          >
            ${escape(
              opts.action.label ||
              "Action"
            )}
          </button>
        `
        : "";

    const closeButton =
      opts.closeButton === false
        ? ""
        : `
          <button
            type="button"
            class="toast-close"
            data-toast-close
            aria-label="Close notification"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
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
          opts.showTitle === false
            ? ""
            : `
              <div class="toast-title">
                ${escape(title)}
              </div>
            `
        }

        <div class="toast-message">
          ${escape(message)}
        </div>

        ${action}
      </div>

      ${closeButton}

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

    active.set(id, state);

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
        () => remove(id)
      );

    toast
      .querySelector(
        "[data-toast-action]"
      )
      ?.addEventListener(
        "click",
        () => {
          try {
            opts.action?.onClick?.();
          } finally {
            if (
              opts.action?.close !==
              false
            ) {
              remove(id);
            }
          }
        }
      );

    if (duration > 0) {
      state.timer = setTimeout(
        () => remove(id),
        duration
      );
    }

    limit();

    return controller(id);
  }

  function replace(
    id,
    type,
    message,
    options = {}
  ) {
    remove(id, true);

    return create(type, {
      ...options,
      message,
      id,
      preventDuplicate: false,
    });
  }

  function controller(id) {
    return {
      id,

      close() {
        remove(id);
      },

      success(message, options = {}) {
        return replace(
          id,
          "success",
          message,
          options
        );
      },

      error(message, options = {}) {
        return replace(
          id,
          "error",
          message,
          options
        );
      },

      warning(message, options = {}) {
        return replace(
          id,
          "warning",
          message,
          options
        );
      },

      info(message, options = {}) {
        return replace(
          id,
          "info",
          message,
          options
        );
      },

      loading(message, options = {}) {
        return replace(
          id,
          "loading",
          message,
          options
        );
      },
    };
  }

  function show(type, options) {
    return create(type, options);
  }

  function clear() {
    [...active.keys()].forEach(
      id => remove(id)
    );
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

    return { ...CONFIG };
  }

  const Toast = {
    __scoutwaveToast: true,

    show,

    success(message, options = {}) {
      return create(
        "success",
        {
          ...options,
          message,
        }
      );
    },

    error(message, options = {}) {
      return create(
        "error",
        {
          ...options,
          message,
        }
      );
    },

    warning(message, options = {}) {
      return create(
        "warning",
        {
          ...options,
          message,
        }
      );
    },

    info(message, options = {}) {
      return create(
        "info",
        {
          ...options,
          message,
        }
      );
    },

    loading(message, options = {}) {
      return create(
        "loading",
        {
          ...options,
          message,
        }
      );
    },

    close(id) {
      remove(id);
    },

    clear,

    configure,

    get count() {
      return active.size;
    },
  };

  window.Toast = Toast;
  window.toast = Toast;
})();