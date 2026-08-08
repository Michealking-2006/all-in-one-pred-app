/*********************
 * PROFILE PAGE
 *********************/

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
  username: "Guest037",
  memberSince: "Member",
  avatar: "/assets/icons/normal-pfp.jpeg",
  authTextLoggedOut: "Login",
  authTextLoggedIn: "Logout",
};

const PROFILE_AUTH_LOGIN_URL = "https://auth.myscoutwave.com/login";

/* ---------------------------------
 * Helpers
 * --------------------------------- */
function getCurrentPath() {
  try {
    const path = window.router?.getCurrentPath?.() || location.pathname;
    return String(path).split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  } catch {
    return location.pathname.replace(/\/+$/, "") || "/";
  }
}

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function getEl(selector, root = document) {
  return root.querySelector(selector);
}

function formatMemberSince(dateValue) {
  if (!dateValue) return PROFILE_DEFAULTS.memberSince;
  
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return PROFILE_DEFAULTS.memberSince;
  
  return `Member since ${date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
}

/* ---------------------------------
 * Supabase
 * --------------------------------- */
async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  } catch (err) {
    console.error("[Profile] Failed to get session:", err);
    return null;
  }
}

async function getUserProfile(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle();
    
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error("[Profile] Failed to load profile:", err);
    return null;
  }
}

/* ---------------------------------
 * DOM setters
 * --------------------------------- */
function setProfileUsername(value) {
  const el = getEl(PROFILE_SELECTORS.username);
  if (!el) return;
  el.textContent = value || PROFILE_DEFAULTS.username;
}

function setProfileMemberSince(value) {
  const el = getEl(PROFILE_SELECTORS.memberSince);
  if (!el) return;
  el.textContent = value || PROFILE_DEFAULTS.memberSince;
}

function setProfileAvatar(src) {
  const el = getEl(PROFILE_SELECTORS.avatar);
  if (!el) return;
  el.src = src || PROFILE_DEFAULTS.avatar;
}

function setAuthButton(isLoggedIn) {
  const btn = getEl(PROFILE_SELECTORS.authBtn);
  if (!btn) return;
  
  btn.dataset.state = isLoggedIn ? "logged-in" : "logged-out";
  btn.textContent = isLoggedIn ?
    PROFILE_DEFAULTS.authTextLoggedIn :
    PROFILE_DEFAULTS.authTextLoggedOut;
}

/* ---------------------------------
 * Render states
 * --------------------------------- */
function clearProfileToGuest() {
  setProfileUsername(PROFILE_DEFAULTS.username);
  setProfileMemberSince(PROFILE_DEFAULTS.memberSince);
  setProfileAvatar(PROFILE_DEFAULTS.avatar);
  setAuthButton(false);
  bindAuthButton();
}

async function renderAuthenticatedProfile(user, requestId) {
  if (!PROFILE_PAGE.active || requestId !== PROFILE_PAGE.renderToken) return;
  
  if (!user) {
    clearProfileToGuest();
    return;
  }
  
  const profile = await getUserProfile(user.id);
  
  if (!PROFILE_PAGE.active || requestId !== PROFILE_PAGE.renderToken) return;
  
  const username =
    profile?.username ||
    user.email?.split("@")?.[0] ||
    PROFILE_DEFAULTS.username;
  
  const memberSince = formatMemberSince(profile?.created_at || user.created_at);
  const avatar = profile?.avatar_url || PROFILE_DEFAULTS.avatar;
  
  setProfileUsername(username);
  setProfileMemberSince(memberSince);
  setProfileAvatar(avatar);
  setAuthButton(true);
  bindAuthButton();
}

async function renderProfileState() {
  const requestId = ++PROFILE_PAGE.renderToken;
  const session = await getSession();
  
  if (!PROFILE_PAGE.active || requestId !== PROFILE_PAGE.renderToken) return;
  
  if (!session?.user) {
    clearProfileToGuest();
    return;
  }
  
  await renderAuthenticatedProfile(session.user, requestId);
}

/* ---------------------------------
 * Button binding
 * --------------------------------- */
function bindAuthButton() {
  const btn = getEl(PROFILE_SELECTORS.authBtn);
  if (!btn || btn.dataset.bound === "true") return;
  
  btn.dataset.bound = "true";
  
  btn.addEventListener("click", async () => {
    const state = btn.dataset.state || "logged-out";
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    if (state === "logged-in") {
      try {
        await supabase.auth.signOut();
        clearProfileToGuest();
      } catch (err) {
        console.error("[Profile] Sign out failed:", err);
      }
      return;
    }
    
    window.location.replace(PROFILE_AUTH_LOGIN_URL);
  });
}

/* ---------------------------------
 * Lifecycle
 * --------------------------------- */
function destroyProfilePage() {
  if (!PROFILE_PAGE.active) return;
  
  PROFILE_PAGE.active = false;
  PROFILE_PAGE.renderToken++;
  
  PROFILE_PAGE.controller?.abort();
  PROFILE_PAGE.controller = null;
  
  if (PROFILE_PAGE.authSubscription) {
    try {
      PROFILE_PAGE.authSubscription.unsubscribe?.();
    } catch (err) {
      console.warn("[Profile] auth unsubscribe failed:", err);
    }
    PROFILE_PAGE.authSubscription = null;
  }
}

function initProfilePage() {
  if (PROFILE_PAGE.active) return;
  
  const root = getEl(PROFILE_SELECTORS.root);
  if (!root) return;
  
  destroyProfilePage();
  
  PROFILE_PAGE.active = true;
  PROFILE_PAGE.controller = new AbortController();
  
  bindAuthButton();
  
  renderProfileState().catch((err) => {
    console.error("[Profile] render failed:", err);
  });
  
  const supabase = getSupabaseClient();
  if (supabase?.auth?.onAuthStateChange) {
    const { data } = supabase.auth.onAuthStateChange(async () => {
      if (!PROFILE_PAGE.active) return;
      await renderProfileState();
    });
    
    PROFILE_PAGE.authSubscription = data?.subscription || null;
  }
}

function handleProfilePageLifecycle(e) {
  const path = (e?.detail?.path || getCurrentPath() || "").trim();
  
  if (path === "/profile") {
    initProfilePage();
    return;
  }
  
  destroyProfilePage();
}

document.addEventListener("pageLoaded", handleProfilePageLifecycle);
document.addEventListener("pageRefreshed", handleProfilePageLifecycle);

if (getCurrentPath() === "/profile") {
  queueMicrotask(initProfilePage);
}

window.router?.registerPage?.("ProfilePage", {
  init: initProfilePage,
  destroy: destroyProfilePage,
});