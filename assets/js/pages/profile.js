(() => {
  "use strict";

  /********* state *********/

  const previous =
    window.__scoutwaveProfilePage;

  if (previous?.destroy) {
    previous.destroy();
  }

  const state = {
    active: false,
    authSubscription: null,
    renderToken: 0,
    authReadyPromise: null,
    root: null,
  };

  const SELECTORS = {
    root: "#profile-page",
    username: "#appProfileUsername",
    memberSince: "#appProfileMemberSince",
    avatar: "#appProfileAvatar",
    coins: ".coins-balance-el-profile-page",
    authBtn: "#appProfileAuthBtn",
  };

  const DEFAULTS = {
    username: "Guest",
    memberSince: "Member",
    coins: "0",
    avatar: "/assets/icons/normal-pfp.jpeg",
    loginText: "Login",
    logoutText: "Logout",
  };

  const LOGIN_URL =
    "https://auth.myscoutwave.com/login";

  /********* helpers *********/

  function getSupabase() {
    return window.supabaseClient || null;
  }

  function getEl(selector, root = document) {
    return root?.querySelector(selector) || null;
  }

  function getPath() {
    return (
      window.router?.getCurrentPath?.() ||
      window.location.pathname
    )
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";
  }

  function isProfileRoute() {
    return getPath() === "/profile";
  }

  /********* toast *********/

  function notify(type, message, options = {}) {
    const toast =
      window.Toast ||
      window.toast;

    if (
      toast &&
      typeof toast[type] === "function"
    ) {
      return toast[type](
        message,
        options
      );
    }

    /*
     * Toast system may not have loaded yet.
     * Never allow a notification failure
     * to break the profile page.
     */
    console[type === "error"
      ? "error"
      : type === "warning"
        ? "warn"
        : "log"](
      `[Profile] ${message}`
    );

    return null;
  }

  /********* formatting *********/

  function formatMemberSince(value) {
    if (!value) {
      return DEFAULTS.memberSince;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return DEFAULTS.memberSince;
    }

    return `Member since ${date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        year: "numeric",
      }
    )}`;
  }

  function formatCoins(value) {
    const amount = Number(value);

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return DEFAULTS.coins;
    }

    return amount.toLocaleString("en-US");
  }

  /********* dom *********/

  function setUsername(value) {
    const el = getEl(
      SELECTORS.username,
      state.root
    );

    if (!el) return;

    el.textContent =
      value || DEFAULTS.username;
  }

  function setMemberSince(value) {
    const el = getEl(
      SELECTORS.memberSince,
      state.root
    );

    if (!el) return;

    el.textContent =
      formatMemberSince(value);
  }

  function setCoins(value) {
    const el = getEl(
      SELECTORS.coins,
      state.root
    );

    if (!el) return;

    el.textContent =
      formatCoins(value);
  }

  function setAvatar(src) {
    const el = getEl(
      SELECTORS.avatar,
      state.root
    );

    if (!el) return;

    el.onerror = null;

    el.src =
      src || DEFAULTS.avatar;

    el.onerror = () => {
      el.onerror = null;
      el.src = DEFAULTS.avatar;
    };
  }

  function setAuthButton(loggedIn) {
    const btn = getEl(
      SELECTORS.authBtn,
      state.root
    );

    if (!btn) return;

    btn.dataset.state =
      loggedIn
        ? "logged-in"
        : "logged-out";

    btn.textContent =
      loggedIn
        ? DEFAULTS.logoutText
        : DEFAULTS.loginText;

    btn.disabled = false;
  }

  /********* session *********/

  async function getSession() {
    const supabase =
      getSupabase();

    if (!supabase?.auth) {
      return null;
    }

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession();

      if (error) {
        console.error(
          "[Profile] Session error:",
          error
        );

        return null;
      }

      return data?.session || null;
    } catch (error) {
      console.error(
        "[Profile] Session request failed:",
        error
      );

      return null;
    }
  }

  async function getUser() {
    const supabase =
      getSupabase();

    if (!supabase?.auth) {
      return null;
    }

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.getUser();

      if (error) {
        console.error(
          "[Profile] User error:",
          error
        );

        return null;
      }

      return data?.user || null;
    } catch (error) {
      console.error(
        "[Profile] User request failed:",
        error
      );

      return null;
    }
  }

  /********* profile query *********/

  async function getProfile(userId) {
    const supabase =
      getSupabase();

    if (!supabase || !userId) {
      return {
        profile: null,
        error: new Error(
          "Profile service unavailable."
        ),
      };
    }

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from("profiles")
          .select(
            "username, avatar_url, created_at, coins_balance"
          )
          .eq("id", userId)
          .maybeSingle();

      if (error) {
        console.error(
          "[Profile] Profile query failed:",
          error
        );
      }

      return {
        profile: data || null,
        error: error || null,
      };
    } catch (error) {
      console.error(
        "[Profile] Profile request failed:",
        error
      );

      return {
        profile: null,
        error,
      };
    }
  }

  /********* auth readiness *********/

  function waitForAuth() {
    if (state.authReadyPromise) {
      return state.authReadyPromise;
    }

    const supabase =
      getSupabase();

    if (!supabase?.auth) {
      return Promise.resolve(null);
    }

    state.authReadyPromise =
      new Promise(resolve => {
        let resolved = false;

        const finish = session => {
          if (resolved) return;

          resolved = true;
          resolve(session || null);
        };

        try {
          const {
            data,
          } =
            supabase.auth.onAuthStateChange(
              (
                event,
                session
              ) => {
                if (!state.active) {
                  return;
                }

                finish(session);

                render().catch(
                  error => {
                    console.error(
                      "[Profile] Auth render failed:",
                      error
                    );
                  }
                );
              }
            );

          state.authSubscription =
            data?.subscription ||
            null;
        } catch (error) {
          console.error(
            "[Profile] Auth listener failed:",
            error
          );
        }

        supabase.auth
          .getSession()
          .then(({ data }) => {
            finish(
              data?.session ||
              null
            );
          })
          .catch(error => {
            console.error(
              "[Profile] Auth initialization failed:",
              error
            );

            finish(null);
          });
      });

    return state.authReadyPromise;
  }

  /********* render guest *********/

  function renderGuest() {
    setUsername(
      DEFAULTS.username
    );

    setMemberSince(null);

    setCoins(
      DEFAULTS.coins
    );

    setAvatar(
      DEFAULTS.avatar
    );

    setAuthButton(false);

    bindAuthButton();
  }

  /********* render authenticated *********/

  async function renderAuthenticated(
    user,
    requestId
  ) {
    if (
      !state.active ||
      requestId !==
        state.renderToken
    ) {
      return;
    }

    const {
      profile,
      error,
    } =
      await getProfile(user.id);

    if (
      !state.active ||
      requestId !==
        state.renderToken
    ) {
      return;
    }

    const metadata =
      user.user_metadata || {};

    const username =
      profile?.username ||
      metadata.user_name ||
      metadata.preferred_username ||
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      DEFAULTS.username;

    const avatar =
      profile?.avatar_url ||
      metadata.avatar_url ||
      metadata.picture ||
      DEFAULTS.avatar;

    const coins =
      profile?.coins_balance ?? 0;

    setUsername(username);

    setMemberSince(
      profile?.created_at ||
      user.created_at
    );

    setCoins(coins);

    setAvatar(avatar);

    setAuthButton(true);

    bindAuthButton();

    /*
     * Authentication succeeded even if
     * the profile table couldn't be read.
     */
    if (error) {
      setCoins(
        DEFAULTS.coins
      );

      notify(
        "warning",
        "Your account is signed in, but some profile data could not be loaded."
      );
    }
  }

  /********* render *********/

  async function render() {
    if (
      !state.active ||
      !state.root ||
      !isProfileRoute()
    ) {
      return;
    }

    const requestId =
      ++state.renderToken;

    const readySession =
      await waitForAuth();

    if (
      !state.active ||
      requestId !==
        state.renderToken
    ) {
      return;
    }

    let session =
      readySession ||
      await getSession();

    if (
      !state.active ||
      requestId !==
        state.renderToken
    ) {
      return;
    }

    if (!session?.user) {
      renderGuest();
      return;
    }

    const user =
      await getUser();

    if (
      !state.active ||
      requestId !==
        state.renderToken
    ) {
      return;
    }

    if (!user) {
      renderGuest();
      return;
    }

    await renderAuthenticated(
      user,
      requestId
    );
  }

  /********* auth button *********/

  function bindAuthButton() {
    const btn = getEl(
      SELECTORS.authBtn,
      state.root
    );

    if (!btn) return;

    if (
      btn.__profileClickHandler
    ) {
      btn.removeEventListener(
        "click",
        btn.__profileClickHandler
      );
    }

    const handler = async () => {
      const supabase =
        getSupabase();

      if (!supabase?.auth) {
        console.error(
          "[Profile] Supabase auth unavailable."
        );

        notify(
          "error",
          "Something went wrong. Please try again."
        );

        return;
      }

      const loggedIn =
        btn.dataset.state ===
        "logged-in";

      /*
       * LOGIN
       */
      if (!loggedIn) {
        window.location.href =
          LOGIN_URL;

        return;
      }

      /*
       * LOGOUT
       */

      btn.disabled = true;

      try {
        const {
          error,
        } =
          await supabase.auth.signOut();

        if (error) {
          throw error;
        }

        /*
         * Update UI immediately.
         * Supabase auth listener will also
         * receive the signed-out state.
         */
        renderGuest();

        notify(
          "success",
          "You have been logged out."
        );

      } catch (error) {
        console.error(
          "[Profile] Sign out failed:",
          error
        );

        btn.disabled = false;

        notify(
          "error",
          "Unable to sign out. Please try again."
        );
      }
    };

    btn.__profileClickHandler =
      handler;

    btn.addEventListener(
      "click",
      handler
    );
  }

  /********* destroy *********/

  function destroy() {
    state.renderToken++;
    state.active = false;

    if (
      state.authSubscription
    ) {
      try {
        state.authSubscription
          .unsubscribe?.();
      } catch (error) {
        console.warn(
          "[Profile] Auth cleanup failed:",
          error
        );
      }
    }

    state.authSubscription =
      null;

    state.authReadyPromise =
      null;

    const btn = getEl(
      SELECTORS.authBtn,
      state.root
    );

    if (
      btn &&
      btn.__profileClickHandler
    ) {
      btn.removeEventListener(
        "click",
        btn.__profileClickHandler
      );

      delete btn.__profileClickHandler;
    }

    state.root = null;
  }

  /********* init *********/

  function init() {
    const root =
      document.querySelector(
        SELECTORS.root
      );

    if (!root) {
      return;
    }

    destroy();

    state.root = root;
    state.active = true;

    render().catch(error => {
      console.error(
        "[Profile] Initial render failed:",
        error
      );

      if (state.active) {
        notify(
          "error",
          "Unable to load your profile."
        );
      }
    });
  }

  /********* page events *********/

  function onPageLoaded(event) {
    const path =
      event?.detail?.path ||
      getPath();

    if (
      path === "/profile"
    ) {
      init();
    } else {
      destroy();
    }
  }

  function onPageRefreshed(event) {
    const path =
      event?.detail?.path ||
      getPath();

    if (
      path === "/profile"
    ) {
      init();
    }
  }

  document.addEventListener(
    "pageLoaded",
    onPageLoaded
  );

  document.addEventListener(
    "pageRefreshed",
    onPageRefreshed
  );

  /********* initial boot *********/

  if (
    getPath() === "/profile"
  ) {
    queueMicrotask(init);
  }

  /********* router registry *********/

  window.router?.registerPage?.(
    "ProfilePage",
    {
      init,
      destroy,
    }
  );

  /********* public api *********/

  window.__scoutwaveProfilePage = {
    destroy,
    init,
  };
})();