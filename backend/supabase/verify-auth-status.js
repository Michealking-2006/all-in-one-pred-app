(() => {
  "use strict";

  /*
   * ============================================================
   * SCOUTWAVE AUTH STATUS MANAGER
   * ============================================================
   *
   * Global, SPA-safe authentication UI manager.
   *
   * Supabase client:
   *   window.supabaseClient
   *
   * Supported markup:
   *
   *   data-auth-required
   *   data-auth-required="disable|hide|blur|lock"
   *   data-auth-message="Please log in to continue."
   *   data-auth-redirect="/login"
   *   data-auth-opacity="0.45"
   *
   *   data-auth="authenticated"
   *   data-auth="guest"
   *
   * Global state:
   *   html[data-auth-state="authenticated"]
   *   html[data-auth-state="unauthenticated"]
   *   html[data-auth-state="checking"]
   *   html[data-auth-ready="true"]
   *
   * Events:
   *   scoutwave:auth-ready
   *   scoutwave:auth-state-change
   */

  if (window.__scoutwaveAuthStatusManager) {
    return;
  }

  const API_VERSION = "1.0.0";
  const STYLE_ID = "scoutwave-auth-status-styles";
  const ROOT = document.documentElement;

  const MODE_DEFAULT = "disable";
  const MODES = new Set(["disable", "hide", "blur", "lock"]);

  const protectedElements = new WeakMap();
  const managedElements = new Set();

  let observer = null;
  let authSubscription = null;
  let initialized = false;
  let checkingPromise = null;
  let currentUser = null;
  let currentSession = null;
  let currentState = "checking";

  /* ============================================================
   * UTILITIES
   * ============================================================ */

  function getSupabase() {
    return (
      window.supabaseClient ||
      window.supabase ||
      null
    );
  }

  function getToastManager() {
    return (
      window.toastManager ||
      window.ToastManager ||
      window.ToastNotificationsManager ||
      window.toast ||
      null
    );
  }

  function toast(type, message) {
    if (!message) return;

    try {
      const manager = getToastManager();

      if (!manager) return;

      if (typeof manager[type] === "function") {
        manager[type](message);
        return;
      }

      if (typeof manager.show === "function") {
        manager.show(message, type);
        return;
      }

      if (typeof manager.notify === "function") {
        manager.notify({
          type,
          message,
        });
      }
    } catch (error) {
      console.warn(
        "Scoutwave auth toast error:",
        error
      );
    }
  }

  function normalizeMode(value) {
    const mode = String(
      value || MODE_DEFAULT
    )
      .trim()
      .toLowerCase();

    return MODES.has(mode)
      ? mode
      : MODE_DEFAULT;
  }

  function isElement(value) {
    return value instanceof Element;
  }

  function isFormControl(element) {
    return (
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLFieldSetElement ||
      element instanceof HTMLOptGroupElement ||
      element instanceof HTMLOptionElement
    );
  }

  function getMessage(element) {
    return (
      element.getAttribute(
        "data-auth-message"
      ) ||
      "Please log in to continue."
    );
  }

  function getRedirect(element) {
    return (
      element.getAttribute(
        "data-auth-redirect"
      ) || ""
    );
  }

  function getOpacity(element) {
    const value = Number(
      element.getAttribute(
        "data-auth-opacity"
      )
    );

    if (!Number.isFinite(value)) {
      return 0.45;
    }

    return Math.min(
      1,
      Math.max(0, value)
    );
  }

  function getRedirectHandler() {
    if (
      typeof window.navigate ===
      "function"
    ) {
      return window.navigate;
    }

    if (
      typeof window.routerNavigate ===
      "function"
    ) {
      return window.routerNavigate;
    }

    return (path) => {
      window.location.href = path;
    };
  }

  function navigate(path) {
    if (!path) return;

    try {
      getRedirectHandler()(path);
    } catch (error) {
      console.error(
        "Scoutwave auth navigation error:",
        error
      );
    }
  }

  /* ============================================================
   * GENERATED CSS
   * ============================================================ */

  function ensureStyles() {
    if (
      document.getElementById(STYLE_ID)
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      /* Scoutwave Auth Status Manager */

      html[data-auth-state="checking"]
        [data-auth-required],
      html[data-auth-state="checking"]
        [data-auth="authenticated"],
      html[data-auth-state="checking"]
        [data-auth="guest"] {
        transition:
          opacity 160ms ease,
          filter 160ms ease;
      }

      [data-auth-required].scoutwave-auth-disabled {
        opacity:
          var(--auth-disabled-opacity, .45)
          !important;
        cursor: not-allowed !important;
        user-select: none !important;
      }

      [data-auth-required].scoutwave-auth-disabled[aria-disabled="true"] {
        -webkit-tap-highlight-color: transparent;
      }

      [data-auth-required].scoutwave-auth-hidden {
        display: none !important;
      }

      [data-auth-required].scoutwave-auth-blurred {
        filter: blur(4px) !important;
        opacity:
          var(--auth-disabled-opacity, .5)
          !important;
        pointer-events: none !important;
        user-select: none !important;
      }

      [data-auth-required].scoutwave-auth-locked {
        position: relative;
        opacity:
          var(--auth-disabled-opacity, .55)
          !important;
        pointer-events: none !important;
        user-select: none !important;
        cursor: not-allowed !important;
      }

      [data-auth-required]
        .scoutwave-auth-disabled:not(button):not(input):not(select):not(textarea):not(fieldset) {
        pointer-events: none !important;
      }

      [data-auth="authenticated"].scoutwave-auth-guest-hidden {
        display: none !important;
      }

      [data-auth="guest"].scoutwave-auth-user-hidden {
        display: none !important;
      }

      html[data-auth-state="authenticated"] .auth-only {
        display: revert;
      }

      html[data-auth-state="unauthenticated"] .auth-only {
        display: none !important;
      }

      html[data-auth-state="authenticated"] .guest-only {
        display: none !important;
      }

      html[data-auth-state="unauthenticated"] .guest-only {
        display: revert;
      }
    `;

    document.head.appendChild(style);
  }

  /* ============================================================
   * ROOT STATE
   * ============================================================ */

  function setRootState(
    state,
    user = null,
    session = null
  ) {
    currentState = state;
    currentUser = user;
    currentSession = session;

    ROOT.dataset.authState = state;
    ROOT.dataset.authReady = "true";
    ROOT.dataset.authenticated =
      state === "authenticated"
        ? "true"
        : "false";

    document.dispatchEvent(
      new CustomEvent(
        "scoutwave:auth-state-change",
        {
          detail: {
            state,
            authenticated:
              state ===
              "authenticated",
            user,
            session,
          },
        }
      )
    );
  }

  function setChecking() {
    currentState = "checking";

    ROOT.dataset.authState =
      "checking";

    ROOT.dataset.authReady =
      "false";

    ROOT.dataset.authenticated =
      "false";
  }

  /* ============================================================
   * ELEMENT STATE
   * ============================================================ */

  function saveOriginalState(element) {
    if (
      protectedElements.has(element)
    ) {
      return;
    }

    protectedElements.set(element, {
      disabled:
        "disabled" in element
          ? element.disabled
          : null,

      ariaDisabled:
        element.getAttribute(
          "aria-disabled"
        ),

      tabIndex:
        element.getAttribute(
          "tabindex"
        ),

      title:
        element.getAttribute(
          "title"
        ),

      inert:
        "inert" in element
          ? element.inert
          : null,

      className: {
        disabled:
          element.classList.contains(
            "scoutwave-auth-disabled"
          ),

        hidden:
          element.classList.contains(
            "scoutwave-auth-hidden"
          ),

        blurred:
          element.classList.contains(
            "scoutwave-auth-blurred"
          ),

        locked:
          element.classList.contains(
            "scoutwave-auth-locked"
          ),
      },

      styleOpacity:
        element.style.getPropertyValue(
          "--auth-disabled-opacity"
        ),
    });
  }

  function restoreElement(element) {
    const original =
      protectedElements.get(
        element
      );

    if (
      !original ||
      !isElement(element)
    ) {
      return;
    }

    element.classList.remove(
      "scoutwave-auth-disabled",
      "scoutwave-auth-hidden",
      "scoutwave-auth-blurred",
      "scoutwave-auth-locked"
    );

    element.style.removeProperty(
      "--auth-disabled-opacity"
    );

    if (
      isFormControl(element) &&
      original.disabled !== null
    ) {
      element.disabled =
        original.disabled;
    }

    if (
      original.ariaDisabled === null
    ) {
      element.removeAttribute(
        "aria-disabled"
      );
    } else {
      element.setAttribute(
        "aria-disabled",
        original.ariaDisabled
      );
    }

    if (
      original.tabIndex === null
    ) {
      element.removeAttribute(
        "tabindex"
      );
    } else {
      element.setAttribute(
        "tabindex",
        original.tabIndex
      );
    }

    if (
      original.title === null
    ) {
      element.removeAttribute(
        "title"
      );
    } else {
      element.setAttribute(
        "title",
        original.title
      );
    }

    if (
      "inert" in element &&
      original.inert !== null
    ) {
      element.inert =
        original.inert;
    }

    if (original.styleOpacity) {
      element.style.setProperty(
        "--auth-disabled-opacity",
        original.styleOpacity
      );
    }
  }

  function applyProtectedMode(element) {
    if (!isElement(element)) {
      return;
    }

    saveOriginalState(element);

    const mode = normalizeMode(
      element.getAttribute(
        "data-auth-required"
      )
    );

    const opacity =
      getOpacity(element);

    element.style.setProperty(
      "--auth-disabled-opacity",
      String(opacity)
    );

    element.classList.remove(
      "scoutwave-auth-disabled",
      "scoutwave-auth-hidden",
      "scoutwave-auth-blurred",
      "scoutwave-auth-locked"
    );

    switch (mode) {
      case "hide":
        element.classList.add(
          "scoutwave-auth-hidden"
        );
        break;

      case "blur":
        element.classList.add(
          "scoutwave-auth-blurred"
        );
        break;

      case "lock":
        element.classList.add(
          "scoutwave-auth-locked"
        );
        break;

      case "disable":
      default:
        element.classList.add(
          "scoutwave-auth-disabled"
        );
        break;
    }

    if (isFormControl(element)) {
      element.disabled = true;
    }

    element.setAttribute(
      "aria-disabled",
      "true"
    );

    if (
      isLink(element) ||
      !isFormControl(element)
    ) {
      if (
        !element.hasAttribute(
          "tabindex"
        )
      ) {
        element.setAttribute(
          "tabindex",
          "-1"
        );
      }
    }

    if (
      !element.hasAttribute("title")
    ) {
      element.setAttribute(
        "title",
        getMessage(element)
      );
    }

    if ("inert" in element) {
      element.inert = true;
    }

    managedElements.add(element);
  }

  function protectElement(element) {
    if (!isElement(element)) {
      return;
    }

    if (
      currentState ===
      "authenticated"
    ) {
      restoreElement(element);
      managedElements.delete(element);
      return;
    }

    if (
      currentState ===
      "checking"
    ) {
      return;
    }

    applyProtectedMode(element);
  }

  function syncProtectedElements() {
    document
      .querySelectorAll(
        "[data-auth-required]"
      )
      .forEach(protectElement);

    managedElements.forEach(
      (element) => {
        if (!element.isConnected) {
          managedElements.delete(
            element
          );
          return;
        }

        if (
          !element.matches(
            "[data-auth-required]"
          )
        ) {
          restoreElement(element);
          managedElements.delete(
            element
          );
        }
      }
    );
  }

  /* ============================================================
   * AUTH VISIBILITY MARKERS
   * ============================================================ */

  function syncAuthVisibility() {
    document
      .querySelectorAll(
        '[data-auth="authenticated"]'
      )
      .forEach((element) => {
        element.classList.toggle(
          "scoutwave-auth-guest-hidden",
          currentState !==
            "authenticated"
        );
      });

    document
      .querySelectorAll(
        '[data-auth="guest"]'
      )
      .forEach((element) => {
        element.classList.toggle(
          "scoutwave-auth-user-hidden",
          currentState ===
            "authenticated"
        );
      });
  }

  function syncAll() {
    syncProtectedElements();
    syncAuthVisibility();
  }

  /* ============================================================
   * BLOCKED INTERACTIONS
   * ============================================================ */

  function handleBlockedInteraction(
    event
  ) {
    if (
      currentState !==
      "unauthenticated"
    ) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target.closest(
            "[data-auth-required]"
          )
        : null;

    if (
      !target ||
      !target.isConnected
    ) {
      return;
    }

    const mode =
      normalizeMode(
        target.getAttribute(
          "data-auth-required"
        )
      );

    if (mode === "hide") {
      return;
    }

    const message =
      getMessage(target);

    const redirect =
      getRedirect(target);

    if (
      event.type === "click" ||
      event.type === "pointerdown" ||
      event.type === "keydown"
    ) {
      if (
        mode !== "disable" ||
        !isFormControl(target)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (message) {
        toast(
          "error",
          message
        );
      }

      if (redirect) {
        navigate(redirect);
      }
    }
  }

  function handleKeydown(event) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    handleBlockedInteraction(
      event
    );
  }

  /* ============================================================
   * AUTH CHECK
   * ============================================================ */

  async function checkAuth() {
    if (checkingPromise) {
      return checkingPromise;
    }

    checkingPromise =
      (async () => {
        const supabase =
          getSupabase();

        if (!supabase?.auth) {
          setRootState(
            "unauthenticated",
            null,
            null
          );

          document.dispatchEvent(
            new CustomEvent(
              "scoutwave:auth-ready",
              {
                detail: {
                  authenticated:
                    false,
                  user: null,
                  session: null,
                  error:
                    new Error(
                      "Supabase auth client not found."
                    ),
                },
              }
            )
          );

          syncAll();

          return {
            authenticated: false,
            user: null,
            session: null,
            error:
              new Error(
                "Supabase auth client not found."
              ),
          };
        }

        setChecking();

        try {
          const [
            userResult,
            sessionResult,
          ] = await Promise.all([
            supabase.auth.getUser(),
            supabase.auth.getSession(),
          ]);

          const user =
            userResult?.data?.user ||
            null;

          const session =
            sessionResult?.data
              ?.session || null;

          if (
            userResult?.error &&
            !user
          ) {
            console.warn(
              "Scoutwave auth verification:",
              userResult.error
            );
          }

          const authenticated =
            Boolean(
              user?.id &&
                session?.access_token
            );

          setRootState(
            authenticated
              ? "authenticated"
              : "unauthenticated",
            authenticated
              ? user
              : null,
            authenticated
              ? session
              : null
          );

          syncAll();

          const detail = {
            authenticated,
            user: authenticated
              ? user
              : null,
            session: authenticated
              ? session
              : null,
            error:
              userResult?.error ||
              sessionResult?.error ||
              null,
          };

          document.dispatchEvent(
            new CustomEvent(
              "scoutwave:auth-ready",
              {
                detail,
              }
            )
          );

          return detail;
        } catch (error) {
          console.error(
            "Scoutwave auth verification failed:",
            error
          );

          setRootState(
            "unauthenticated",
            null,
            null
          );

          syncAll();

          const detail = {
            authenticated: false,
            user: null,
            session: null,
            error,
          };

          document.dispatchEvent(
            new CustomEvent(
              "scoutwave:auth-ready",
              {
                detail,
              }
            )
          );

          return detail;
        } finally {
          checkingPromise = null;
        }
      })();

    return checkingPromise;
  }

  /* ============================================================
   * SUPABASE AUTH EVENTS
   * ============================================================ */

  function subscribeToAuth() {
    const supabase =
      getSupabase();

    if (
      !supabase?.auth
        ?.onAuthStateChange
    ) {
      return;
    }

    if (authSubscription) {
      return;
    }

    const result =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          const user =
            session?.user || null;

          const authenticated =
            Boolean(
              user?.id &&
                session?.access_token
            );

          setRootState(
            authenticated
              ? "authenticated"
              : "unauthenticated",
            authenticated
              ? user
              : null,
            authenticated
              ? session
              : null
          );

          syncAll();

          document.dispatchEvent(
            new CustomEvent(
              "scoutwave:auth-event",
              {
                detail: {
                  event,
                  authenticated,
                  user: authenticated
                    ? user
                    : null,
                  session: authenticated
                    ? session
                    : null,
                },
              }
            )
          );
        }
      );

    authSubscription =
      result?.data
        ?.subscription || null;
  }

  /* ============================================================
   * SPA DOM OBSERVER
   * ============================================================ */

  function startObserver() {
    if (
      observer ||
      !document.body
    ) {
      return;
    }

    observer =
      new MutationObserver(
        (mutations) => {
          let relevant = false;

          for (
            const mutation of mutations
          ) {
            if (
              mutation.type !==
              "childList"
            ) {
              continue;
            }

            if (
              mutation.addedNodes
                .length ||
              mutation.removedNodes
                .length
            ) {
              relevant = true;
              break;
            }
          }

          if (relevant) {
            syncAll();
          }
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      }
    );
  }

  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  const API = {
    version:
      API_VERSION,

    get state() {
      return currentState;
    },

    get authenticated() {
      return (
        currentState ===
        "authenticated"
      );
    },

    get user() {
      return currentUser;
    },

    get session() {
      return currentSession;
    },

    check: checkAuth,

    async isAuthenticated() {
      const result =
        await checkAuth();

      return Boolean(
        result?.authenticated
      );
    },

    getUser() {
      return currentUser;
    },

    getSession() {
      return currentSession;
    },

    protect(root = document) {
      const elements = [];

      if (
        isElement(root) &&
        root.matches?.(
          "[data-auth-required]"
        )
      ) {
        elements.push(root);
      }

      root
        .querySelectorAll?.(
          "[data-auth-required]"
        )
        .forEach(
          (element) =>
            elements.push(element)
        );

      elements.forEach(
        protectElement
      );

      return elements;
    },

    refresh() {
      syncAll();
    },

    async requireAuth({
      message =
        "Please log in to continue.",

      redirect = "",

      notify = true,
    } = {}) {
      const authenticated =
        await API.isAuthenticated();

      if (authenticated) {
        return true;
      }

      if (notify) {
        toast(
          "error",
          message
        );
      }

      if (redirect) {
        navigate(redirect);
      }

      return false;
    },

    destroy() {
      observer?.disconnect();
      observer = null;

      authSubscription
        ?.unsubscribe?.();

      authSubscription = null;

      managedElements.forEach(
        (element) => {
          restoreElement(
            element
          );
        }
      );

      managedElements.clear();

      ROOT.removeAttribute(
        "data-auth-state"
      );

      ROOT.removeAttribute(
        "data-auth-ready"
      );

      ROOT.removeAttribute(
        "data-authenticated"
      );

      document
        .getElementById(
          STYLE_ID
        )
        ?.remove();

      initialized = false;
    },
  };

  /* ============================================================
   * STARTUP
   * ============================================================ */

  function init() {
    if (initialized) {
      return API;
    }

    initialized = true;

    ensureStyles();

    setChecking();

    startObserver();

    if (!observer) {
      requestAnimationFrame(
        startObserver
      );
    }

    document.addEventListener(
      "click",
      handleBlockedInteraction,
      true
    );

    document.addEventListener(
      "pointerdown",
      handleBlockedInteraction,
      true
    );

    document.addEventListener(
      "keydown",
      handleKeydown,
      true
    );

    subscribeToAuth();

    queueMicrotask(() => {
      checkAuth();
    });

    return API;
  }

  window.__scoutwaveAuthStatusManager =
    API;

  window.VerifyAuthStatus = API;

  init();
})();