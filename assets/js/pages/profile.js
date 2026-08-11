/********* profile page *********/

let PROFILE_PAGE = {
  active: false,
  controller: null,
  authSubscription: null,
  renderToken: 0,
};

const PROFILE_SELECTORS = {
  root: "#profile-page",
  username: "#appProfileUsername",
  memberSince: "#appProfileMemberSince",
  avatar: "#appProfileAvatar",
  authBtn: "#appProfileAuthBtn",
};

const PROFILE_DEFAULTS = {
  username: "Guest",
  memberSince: "Member",
  avatar: "/assets/icons/normal-pfp.jpeg",
  authTextLoggedOut: "Login",
  authTextLoggedIn: "Logout",
};

const PROFILE_AUTH_LOGIN_URL =
  "https://auth.myscoutwave.com/login";

/********* helpers *********/

function getCurrentPath() {
  try {
    const path =
      window.router?.getCurrentPath?.() ||
      location.pathname;

    return (
      String(path)
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "") || "/"
    );
  } catch {
    return (
      location.pathname.replace(/\/+$/, "") || "/"
    );
  }
}

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function getEl(selector, root = document) {
  return root.querySelector(selector);
}

function notify(type, message, options = {}) {
  const toast = window.Toast || window.toast;

  if (toast && typeof toast[type] === "function") {
    return toast[type](message, options);
  }

  const fallback =
    type === "error"
      ? console.error
      : type === "warning"
        ? console.warn
        : console.log;

  fallback("[Profile]", message);

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

/********* supabase *********/

async function getSession() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session || null;
  } catch (error) {
    console.error(
      "[Profile] Failed to get session:",
      error
    );

    return null;
  }
}

async function getUserProfile(userId) {
  const supabase = getSupabaseClient();

  if (!supabase || !userId) {
    return {
      data: null,
      error: new Error(
        "Authentication service unavailable"
      ),
    };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "username, avatar_url, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return {
      data: data || null,
      error: null,
    };
  } catch (error) {
    console.error(
      "[Profile] Failed to load profile:",
      error
    );

    return {
      data: null,
      error,
    };
  }
}

/********* dom setters *********/

function setProfileUsername(value) {
  const el = getEl(
    PROFILE_SELECTORS.username
  );

  if (!el) return;

  el.textContent =
    value || PROFILE_DEFAULTS.username;
}

function setProfileMemberSince(value) {
  const el = getEl(
    PROFILE_SELECTORS.memberSince
  );

  if (!el) return;

  el.textContent =
    value || PROFILE_DEFAULTS.memberSince;
}

function setProfileAvatar(src) {
  const el = getEl(
    PROFILE_SELECTORS.avatar
  );

  if (!el) return;

  el.src = src || PROFILE_DEFAULTS.avatar;

  el.onerror = () => {
    el.onerror = null;
    el.src = PROFILE_DEFAULTS.avatar;
  };
}

function setAuthButton(isLoggedIn) {
  const btn = getEl(
    PROFILE_SELECTORS.authBtn
  );

  if (!btn) return;

  btn.dataset.state = isLoggedIn
    ? "logged-in"
    : "logged-out";

  btn.textContent = isLoggedIn
    ? PROFILE_DEFAULTS.authTextLoggedIn
    : PROFILE_DEFAULTS.authTextLoggedOut;
}

/********* guest state *********/

function clearProfileToGuest() {
  setProfileUsername(
    PROFILE_DEFAULTS.username
  );

  setProfileMemberSince(
    PROFILE_DEFAULTS.memberSince
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
    requestId !== PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (!user) {
    clearProfileToGuest();
    return;
  }

  const {
    data: profile,
    error,
  } = await getUserProfile(user.id);

  if (
    !PROFILE_PAGE.active ||
    requestId !== PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (error) {
    notify(
      "error",
      "Unable to load your profile right now."
    );

    return;
  }

  /*
   * The database trigger should normally
   * create this row immediately when the
   * Supabase auth user is created.
   *
   * Keep the fallback so the UI still
   * works during a short database delay.
   */

  const metadata =
    user.user_metadata || {};

  const username =
    profile?.username ||
    metadata.user_name ||
    metadata.preferred_username ||
    user.email?.split("@")?.[0] ||
    PROFILE_DEFAULTS.username;

  const memberSince =
    formatMemberSince(
      profile?.created_at ||
      user.created_at
    );

  const avatar =
    profile?.avatar_url ||
    metadata.avatar_url ||
    metadata.picture ||
    PROFILE_DEFAULTS.avatar;

  setProfileUsername(username);
  setProfileMemberSince(memberSince);
  setProfileAvatar(avatar);
  setAuthButton(true);

  bindAuthButton();

  /*
   * A missing profile should no longer
   * force the user into guest mode.
   */

  if (!profile) {
    notify(
      "info",
      "Your profile is being prepared."
    );
  }
}

/********* render session *********/

async function renderSession(
  session,
  requestId
) {
  if (
    !PROFILE_PAGE.active ||
    requestId !== PROFILE_PAGE.renderToken
  ) {
    return;
  }

  if (!session?.user) {
    clearProfileToGuest();
    return;
  }

  await renderAuthenticatedProfile(
    session.user,
    requestId
  );
}

/********* initial auth state *********/

async function renderInitialSession() {
  const requestId =
    ++PROFILE_PAGE.renderToken;

  const session = await getSession();

  if (
    !PROFILE_PAGE.active ||
    requestId !== PROFILE_PAGE.renderToken
  ) {
    return;
  }

  await renderSession(
    session,
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
      const state =
        btn.dataset.state ||
        "logged-out";

      const supabase =
        getSupabaseClient();

      if (!supabase) {
        notify(
          "error",
          "Something went wrong. Please try again."
        );

        return;
      }

      if (state === "logged-in") {
        btn.disabled = true;

        try {
          const { error } =
            await supabase.auth.signOut();

          if (error) {
            throw error;
          }

          clearProfileToGuest();

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

        return;
      }

      window.location.replace(
        PROFILE_AUTH_LOGIN_URL
      );
    }
  );
}

/********* auth subscription *********/

function subscribeToAuth() {
  const supabase =
    getSupabaseClient();

  if (
    !supabase?.auth?.onAuthStateChange
  ) {
    return;
  }

  const {
    data,
  } =
    supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!PROFILE_PAGE.active) {
          return;
        }

        /*
         * Don't call getSession() from inside
         * this callback. Supabase already gives
         * us the current session here.
         */

        const requestId =
          ++PROFILE_PAGE.renderToken;

        queueMicrotask(() => {
          if (
            !PROFILE_PAGE.active ||
            requestId !==
              PROFILE_PAGE.renderToken
          ) {
            return;
          }

          renderSession(
            session,
            requestId
          ).catch((error) => {
            console.error(
              "[Profile] Auth render failed:",
              error
            );
          });
        });
      }
    );

  PROFILE_PAGE.authSubscription =
    data?.subscription || null;
}

/********* lifecycle *********/

function destroyProfilePage() {
  if (!PROFILE_PAGE.active) {
    return;
  }

  PROFILE_PAGE.active = false;

  PROFILE_PAGE.renderToken++;

  PROFILE_PAGE.controller?.abort();

  PROFILE_PAGE.controller = null;

  if (PROFILE_PAGE.authSubscription) {
    try {
      PROFILE_PAGE.authSubscription.unsubscribe?.();
    } catch (error) {
      console.warn(
        "[Profile] Auth unsubscribe failed:",
        error
      );
    }

    PROFILE_PAGE.authSubscription = null;
  }
}

function initProfilePage() {
  if (PROFILE_PAGE.active) {
    return;
  }

  const root = getEl(
    PROFILE_SELECTORS.root
  );

  if (!root) {
    return;
  }

  destroyProfilePage();

  PROFILE_PAGE.active = true;

  PROFILE_PAGE.controller =
    new AbortController();

  bindAuthButton();

  /*
   * Subscribe first so Google OAuth,
   * email login, logout and token refresh
   * all update the page automatically.
   */

  subscribeToAuth();

  /*
   * Then load the current session.
   * This covers direct navigation and
   * initial page rendering.
   */

  renderInitialSession().catch(
    (error) => {
      console.error(
        "[Profile] Initial render failed:",
        error
      );

      if (!PROFILE_PAGE.active) {
        return;
      }

      notify(
        "error",
        "Profile page failed to load."
      );
    }
  );
}

/********* page lifecycle *********/

function handleProfilePageLifecycle(e) {
  const path = String(
    e?.detail?.path ||
    getCurrentPath() ||
    ""
  )
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");

  if (path === "/profile") {
    initProfilePage();
    return;
  }

  destroyProfilePage();
}

/********* router events *********/

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
  getCurrentPath() === "/profile"
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