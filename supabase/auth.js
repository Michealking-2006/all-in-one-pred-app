/********* profile page *********/

let PROFILE_PAGE = {
  active: false,
  authSubscription: null,
  renderToken: 0,
  authReady: false,
  authReadyPromise: null,
};

const PROFILE_SELECTORS = {
  root: "#profile-page",
  username: "#appProfileUsername",
  memberSince: "#appProfileMemberSince",
  avatar: "#appProfileAvatar",
  coins: ".coins-balance-el-profile-page",
  authBtn: "#appProfileAuthBtn",
};

const PROFILE_DEFAULTS = {
  username: "Guest",
  memberSince: "Member",
  coins: "0",
  avatar: "/assets/icons/normal-pfp.jpeg",
  authTextLoggedOut: "Login",
  authTextLoggedIn: "Logout",
};

const PROFILE_AUTH_LOGIN_URL =
  "https://auth.myscoutwave.com/login";

/********* helpers *********/

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function getEl(selector, root = document) {
  return root.querySelector(selector);
}

function getCurrentPath() {
  try {
    return (
      window.router?.getCurrentPath?.() ||
      location.pathname
    )
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";
  } catch {
    return (
      location.pathname
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "") || "/"
    );
  }
}

function notify(type, message, options = {}) {
  const toast = window.Toast || window.toast;

  if (
    toast &&
    typeof toast[type] === "function"
  ) {
    return toast[type](message, options);
  }

  const logger =
    type === "error"
      ? console.error
      : type === "warning"
        ? console.warn
        : console.log;

  logger("[Profile]", message);

  return null;
}

function formatMemberSince(dateValue) {
  if (!dateValue) {
    return PROFILE_DEFAULTS.memberSince;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return PROFILE_DEFAULTS.memberSince;
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

  if (!Number.isFinite(amount) || amount < 0) {
    return PROFILE_DEFAULTS.coins;
  }

  return amount.toLocaleString("en-US");
}

/********* auth readiness *********/

function getAuthReadyPromise() {
  if (PROFILE_PAGE.authReadyPromise) {
    return PROFILE_PAGE.authReadyPromise;
  }

  PROFILE_PAGE.authReadyPromise =
    new Promise((resolve) => {
      const supabase =
        getSupabaseClient();

      if (!supabase?.auth) {
        resolve(null);
        return;
      }

      let resolved = false;

      const finish = (session) => {
        if (resolved) return;

        resolved = true;
        PROFILE_PAGE.authReady = true;

        resolve(session || null);
      };

      const { data } =
        supabase.auth.onAuthStateChange(
          (event, session) => {
            finish(session);
          }
        );

      PROFILE_PAGE.authSubscription =
        data?.subscription || null;

      supabase.auth
        .getSession()
        .then(({ data }) => {
          finish(data?.session || null);
        })
        .catch((error) => {
          console.error(
            "[Profile] Auth initialization failed:",
            error
          );

          finish(null);
        });
    });

  return PROFILE_PAGE.authReadyPromise;
}

/********* oauth callback recovery *********/

async function recoverOAuthSession() {
  const supabase =
    getSupabaseClient();

  if (!supabase?.auth) {
    return null;
  }

  const url = new URL(
    window.location.href
  );

  const code =
    url.searchParams.get("code");

  if (!code) {
    return null;
  }

  try {
    const {
      data,
      error,
    } =
      await supabase.auth.exchangeCodeForSession(
        code
      );

    if (error) {
      console.error(
        "[Profile] OAuth code exchange failed:",
        error
      );

      return null;
    }

    url.searchParams.delete("code");

    const cleanUrl =
      url.pathname +
      (url.search || "") +
      (url.hash || "");

    window.history.replaceState(
      window.history.state,
      "",
      cleanUrl
    );

    return data?.session || null;
  } catch (error) {
    console.error(
      "[Profile] OAuth recovery failed:",
      error
    );

    return null;
  }
}

/********* session *********/

async function getCurrentSession() {
  const supabase =
    getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const {
      data,
      error,
    } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
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

async function getAuthenticatedUser() {
  const supabase =
    getSupabaseClient();

  if (!supabase) {
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
        "[Profile] User verification failed:",
        error
      );

      return null;
    }

    return data?.user || null;
  } catch (error) {
    console.error(
      "[Profile] User verification failed:",
      error
    );

    return null;
  }
}

/********* profile data *********/

async function getUserProfile(userId) {
  const supabase =
    getSupabaseClient();

  if (!supabase || !userId) {
    return {
      profile: null,
      error: new Error(
        "Authentication service unavailable."
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

      return {
        profile: null,
        error,
      };
    }

    return {
      profile: data || null,
      error: null,
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

/********* dom setters *********/

function setProfileUsername(username) {
  const el = getEl(
    PROFILE_SELECTORS.username
  );

  if (!el) return;

  el.textContent =
    username ||
    PROFILE_DEFAULTS.username;
}

function setProfileMemberSince(dateValue) {
  const el = getEl(
    PROFILE_SELECTORS.memberSince
  );

  if (!el) return;

  el.textContent =
    formatMemberSince(dateValue);
}

function setProfileCoins(value) {
  const el = getEl(
    PROFILE_SELECTORS.coins
  );

  if (!el) return;

  el.textContent = formatCoins(value);
}

function setProfileAvatar(src) {
  const el = getEl(
    PROFILE_SELECTORS.avatar
  );

  if (!el) return;

  el.onerror = null;

  el.src =
    src ||
    PROFILE_DEFAULTS.avatar;

  el.onerror = () => {
    el.onerror = null;
    el.src =
      PROFILE_DEFAULTS.avatar;
  };
}

function setAuthButton(loggedIn) {
  const btn = getEl(
    PROFILE_SELECTORS.authBtn
  );

  if (!btn) return;

  btn.dataset.state = loggedIn
    ? "logged-in"
    : "logged-out";

  btn.textContent = loggedIn
    ? PROFILE_DEFAULTS.authTextLoggedIn
    : PROFILE_DEFAULTS.authTextLoggedOut;

  btn.disabled = false;
}

/********* guest *********/

function renderGuestProfile() {
  setProfileUsername(
    PROFILE_DEFAULTS.username
  );

  setProfileMemberSince(null);

  setProfileCoins(
    PROFILE_DEFAULTS.coins
  );

  setProfileAvatar(
    PROFILE_DEFAULTS.avatar
  );

  setAuthButton(false);

  bindAuthButton();
}

/********* authenticated profile *********/

async function renderAuthenticatedProfile(
  user,
  requestId
) {
  if (
    !PROFILE_PAGE.active ||
    requestId !==
      PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (!user) {
    renderGuestProfile();
    return;
  }

  const {
    profile,
    error,
  } =
    await getUserProfile(user.id);

  if (
    !PROFILE_PAGE.active ||
    requestId !==
      PROFILE_PAGE.renderToken
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
    user.email?.split("@")?.[0] ||
    PROFILE_DEFAULTS.username;

  const avatar =
    profile?.avatar_url ||
    metadata.avatar_url ||
    metadata.picture ||
    PROFILE_DEFAULTS.avatar;

  const coins =
    profile?.coins_balance ?? 0;

  setProfileUsername(username);

  setProfileMemberSince(
    profile?.created_at ||
      user.created_at
  );

  setProfileCoins(coins);

  setProfileAvatar(avatar);

  setAuthButton(true);

  bindAuthButton();

  if (error) {
    /*
     * Keep the authenticated user visible
     * even when the profile query fails.
     */

    setProfileCoins(
      PROFILE_DEFAULTS.coins
    );

    notify(
      "warning",
      "Your account is signed in, but your profile data could not be loaded."
    );
  }
}

/********* render *********/

async function renderProfileState(
  suppliedSession = undefined
) {
  const requestId =
    ++PROFILE_PAGE.renderToken;

  if (!PROFILE_PAGE.active) {
    return;
  }

  const readySession =
    await getAuthReadyPromise();

  if (
    !PROFILE_PAGE.active ||
    requestId !==
      PROFILE_PAGE.renderToken
  ) {
    return;
  }

  let session =
    suppliedSession !== undefined
      ? suppliedSession
      : readySession;

  if (!session) {
    session =
      await recoverOAuthSession();
  }

  if (!session) {
    session =
      await getCurrentSession();
  }

  if (
    !PROFILE_PAGE.active ||
    requestId !==
      PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (!session?.user) {
    renderGuestProfile();
    return;
  }

  const user =
    await getAuthenticatedUser();

  if (
    !PROFILE_PAGE.active ||
    requestId !==
      PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (!user) {
    renderGuestProfile();
    return;
  }

  await renderAuthenticatedProfile(
    user,
    requestId
  );
}

/********* auth button *********/

function bindAuthButton() {
  const btn = getEl(
    PROFILE_SELECTORS.authBtn
  );

  if (
    !btn ||
    btn.dataset.bound === "true"
  ) {
    return;
  }

  btn.dataset.bound = "true";

  btn.addEventListener(
    "click",
    async () => {
      const supabase =
        getSupabaseClient();

      if (!supabase) {
        notify(
          "error",
          "Something went wrong. Please try again."
        );

        return;
      }

      const loggedIn =
        btn.dataset.state ===
        "logged-in";

      if (!loggedIn) {
        window.location.replace(
          PROFILE_AUTH_LOGIN_URL
        );

        return;
      }

      btn.disabled = true;

      try {
        const {
          error,
        } =
          await supabase.auth.signOut();

        if (error) {
          throw error;
        }

        renderGuestProfile();

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
    }
  );
}

/********* auth listener *********/

function subscribeToAuthChanges() {
  const supabase =
    getSupabaseClient();

  if (
    !supabase?.auth?.onAuthStateChange
  ) {
    return;
  }

  if (
    PROFILE_PAGE.authSubscription
  ) {
    PROFILE_PAGE.authSubscription.unsubscribe?.();
    PROFILE_PAGE.authSubscription =
      null;
  }

  const {
    data,
  } =
    supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!PROFILE_PAGE.active) {
          return;
        }

        renderProfileState(
          session
        ).catch((error) => {
          console.error(
            "[Profile] Auth state render failed:",
            error
          );
        });
      }
    );

  PROFILE_PAGE.authSubscription =
    data?.subscription || null;
}

/********* lifecycle *********/

function destroyProfilePage() {
  PROFILE_PAGE.renderToken++;

  PROFILE_PAGE.active = false;
  PROFILE_PAGE.authReady = false;
  PROFILE_PAGE.authReadyPromise = null;

  if (
    PROFILE_PAGE.authSubscription
  ) {
    try {
      PROFILE_PAGE
        .authSubscription
        .unsubscribe?.();
    } catch (error) {
      console.warn(
        "[Profile] Auth unsubscribe failed:",
        error
      );
    }

    PROFILE_PAGE.authSubscription =
      null;
  }
}

function initProfilePage() {
  const root = getEl(
    PROFILE_SELECTORS.root
  );

  if (!root) {
    return;
  }

  if (PROFILE_PAGE.active) {
    return;
  }

  PROFILE_PAGE.active = true;
  PROFILE_PAGE.renderToken = 0;
  PROFILE_PAGE.authReady = false;
  PROFILE_PAGE.authReadyPromise = null;

  bindAuthButton();
  subscribeToAuthChanges();

  renderProfileState().catch(
    (error) => {
      console.error(
        "[Profile] Initial render failed:",
        error
      );

      if (
        PROFILE_PAGE.active
      ) {
        notify(
          "error",
          "Unable to load your profile."
        );
      }
    }
  );
}

/********* page lifecycle *********/

function handleProfilePageLifecycle(event) {
  const path =
    event?.detail?.path ||
    getCurrentPath();

  const cleanPath =
    String(path)
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";

  if (cleanPath === "/profile") {
    initProfilePage();
    return;
  }

  destroyProfilePage();
}

/********* router lifecycle *********/

document.addEventListener(
  "pageLoaded",
  handleProfilePageLifecycle
);

document.addEventListener(
  "pageRefreshed",
  handleProfilePageLifecycle
);

/********* direct boot *********/

if (
  getCurrentPath() ===
  "/profile"
) {
  queueMicrotask(
    initProfilePage
  );
}

/********* router registry *********/

window.router?.registerPage?.(
  "ProfilePage",
  {
    init: initProfilePage,
    destroy: destroyProfilePage,
  }
);