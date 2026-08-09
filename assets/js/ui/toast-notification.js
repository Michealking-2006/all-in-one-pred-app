(() => {
  "use strict";

  if (window.__ScoutwaveToastInstalled) return;
  window.__ScoutwaveToastInstalled = true;

  const CONFIG = {
    position: "top-right",
    duration: 4000,
    maxVisible: 5,
    gap: 10,
    animationDuration: 250,
    duplicateWindow: 1200,
  };

  const ICONS = {
    success: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `,

    error: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/>
      </svg>
    `,

    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2 1 21h22ZM13 18h-2v-2h2Zm0-4h-2v-5h2Z"/>
      </svg>
    `,

    info: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M11 17h2v-6h-2Zm1-15a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8ZM11 9h2V7h-2Z"/>
      </svg>
    `,

    loading: `
      <span class="toast-spinner" aria-hidden="true"></span>
    `,
  };

  let container = null;
  let sequence = 0;

  const activeToasts = new Map();
  const recentMessages = new Map();

  function ensureContainer() {
    if (container && document.body.contains(container)) {
      return container;
    }

    container = document.querySelector("[data-toast-container]");

    if (!container) {
      container = document.createElement("div");
      container.className = `toast-container toast-position-${CONFIG.position}`;
      container.dataset.toastContainer = "true";
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-atomic", "false");

      document.body.appendChild(container);
    }

    return container;
  }

  function normalizeType(type) {
    const allowed = [
      "success",
      "error",
      "warning",
      "info",
      "loading",
    ];

    return allowed.includes(type) ? type : "info";
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

  function createId() {
    sequence += 1;
    return `toast-${Date.now()}-${sequence}`;
  }

  function isDuplicate(type, message) {
    const key = `${type}:${String(message)}`;
    const now = Date.now();

    const previous = recentMessages.get(key);

    recentMessages.set(key, now);

    if (!previous) return false;

    return now - previous < CONFIG.duplicateWindow;
  }

  function createToast(type, options) {
    const normalized = normalizeOptions(options);

    const message = normalized.message ?? normalized.text ?? "";

    if (!message) return null;

    if (
      normalized.preventDuplicate !== false &&
      isDuplicate(type, message)
    ) {
      return null;
    }

    const root = ensureContainer();
    const id = normalized.id || createId();

    const duration =
      type === "loading"
        ? 0
        : Number.isFinite(normalized.duration)
          ? Math.max(0, normalized.duration)
          : CONFIG.duration;

    const title =
      normalized.title ||
      ({
        success: "Success",
        error: "Error",
        warning: "Warning",
        info: "Information",
        loading: "Loading",
      }[type]);

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;
    toast.dataset.toastId = id;
    toast.dataset.toastType = type;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const actionHTML = normalized.action
      ? `
        <button
          type="button"
          class="toast-action"
          data-toast-action
        >
          ${escapeHTML(normalized.action.label || "Action")}
        </button>
      `
      : "";

    toast.innerHTML = `
      <div class="toast-icon">
        ${ICONS[type]}
      </div>

      <div class="toast-content">
        ${
          normalized.showTitle === false
            ? ""
            : `<div class="toast-title">${escapeHTML(title)}</div>`
        }

        <div class="toast-message">
          ${escapeHTML(message)}
        </div>

        ${actionHTML}
      </div>

      ${
        normalized.closeButton === false
          ? ""
          : `
            <button
              type="button"
              class="toast-close"
              aria-label="Close notification"
              data-toast-close
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.7 10.59 10.59 5.7 15.48l1.41 1.41L12 12l4.89 4.89 1.41-1.41L13.41 10.59z"
                />
              </svg>
            </button>
          `
      }

      ${
        duration > 0
          ? `<div class="toast-progress"></div>`
          : ""
      }
    `;

    root.appendChild(toast);

    activeToasts.set(id, {
      element: toast,
      type,
      timer: null,
      duration,
    });

    requestAnimationFrame(() => {
      toast.classList.add("toast-visible");
    });

    const close = () => removeToast(id);

    const closeButton = toast.querySelector("[data-toast-close]");

    closeButton?.addEventListener("click", close);

    const actionButton = toast.querySelector("[data-toast-action]");

    actionButton?.addEventListener("click", () => {
      try {
        normalized.action?.onClick?.();
      } finally {
        if (normalized.action?.close !== false) {
          close();
        }
      }
    });

    if (duration > 0) {
      const timer = window.setTimeout(close, duration);

      const toastState = activeToasts.get(id);

      if (toastState) {
        toastState.timer = timer;
      }
    }

    enforceLimit();

    return createController(id);
  }

  function createController(id) {
    return {
      id,

      close() {
        removeToast(id);
      },

      success(message, options = {}) {
        return replaceToast(id, "success", message, options);
      },

      error(message, options = {}) {
        return replaceToast(id, "error", message, options);
      },

      warning(message, options = {}) {
        return replaceToast(id, "warning", message, options);
      },

      info(message, options = {}) {
        return replaceToast(id, "info", message, options);
      },

      loading(message, options = {}) {
        return replaceToast(id, "loading", message, options);
      },
    };
  }

  function replaceToast(id, type, message, options = {}) {
    removeToast(id, true);

    return createToast(type, {
      ...options,
      message,
      id,
      preventDuplicate: false,
    });
  }

  function removeToast(id, immediate = false) {
    const state = activeToasts.get(id);

    if (!state) return;

    const { element, timer } = state;

    if (timer) {
      clearTimeout(timer);
    }

    activeToasts.delete(id);

    if (immediate) {
      element.remove();
      return;
    }

    element.classList.remove("toast-visible");
    element.classList.add("toast-removing");

    window.setTimeout(() => {
      element.remove();
    }, CONFIG.animationDuration);
  }

  function enforceLimit() {
    while (activeToasts.size > CONFIG.maxVisible) {
      const first = activeToasts.keys().next().value;

      if (!first) break;

      removeToast(first);
    }
  }

  function clearAll() {
    [...activeToasts.keys()].forEach((id) => {
      removeToast(id);
    });
  }

  function configure(options = {}) {
    Object.assign(CONFIG, options);

    if (container) {
      container.className =
        `toast-container toast-position-${CONFIG.position}`;
    }

    return { ...CONFIG };
  }

  function show(type, options) {
    return createToast(normalizeType(type), options);
  }

  const Toast = {
    show,

    success(message, options = {}) {
      return createToast("success", {
        ...options,
        message,
      });
    },

    error(message, options = {}) {
      return createToast("error", {
        ...options,
        message,
      });
    },

    warning(message, options = {}) {
      return createToast("warning", {
        ...options,
        message,
      });
    },

    info(message, options = {}) {
      return createToast("info", {
        ...options,
        message,
      });
    },

    loading(message, options = {}) {
      return createToast("loading", {
        ...options,
        message,
      });
    },

    close(id) {
      removeToast(id);
    },

    clear() {
      clearAll();
    },

    configure,

    get count() {
      return activeToasts.size;
    },
  };

  window.Toast = Toast;
  window.toast = Toast;
})();