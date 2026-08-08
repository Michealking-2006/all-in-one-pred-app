/*********************
 * PROFILE PAGE
 *********************/

let PROFILE_DATA = null;

let PROFILE_PAGE = {
  active: false,
  controller: null,
  authSubscription: null,
};

const PROFILE_DEFAULTS = {
  username: "Guest037",
  memberSince: "Member",
  avatar: "/assets/icons/normal-pfp.jpeg",
  authTextLoggedOut: "Login",
  authTextLoggedIn: "Logout",
};

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function escapeHTML(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentPath() {
  try {
    return window.router?.getCurrentPath?.() || location.pathname;
  } catch {
    return location.pathname;
  }
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

function getSupabaseClient() {
  return window.supabaseClient || null;
}

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

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  } catch (err) {
    console.error("[Profile] Failed to get user:", err);
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

function setProfileUsername(value) {
  const el = document.getElementById("appProfileUsername");
  if (!el) return;
  el.textContent = value || PROFILE_DEFAULTS.username;
}

function setProfileMemberSince(value) {
  const el = document.getElementById("appProfileMemberSince");
  if (!el) return;
  el.textContent = value || PROFILE_DEFAULTS.memberSince;
}

function setProfileAvatar(src) {
  const el = document.getElementById("appProfileAvatar");
  if (!el) return;
  el.src = src || PROFILE_DEFAULTS.avatar;
}

function setAuthButton(isLoggedIn) {
  const btn = document.getElementById("appProfileAuthBtn");
  if (!btn) return;
  
  btn.dataset.state = isLoggedIn ? "logged-in" : "logged-out";
  btn.innerHTML = isLoggedIn ?
    `<span>${escapeHTML(PROFILE_DEFAULTS.authTextLoggedIn)}</span>` :
    `<span>${escapeHTML(PROFILE_DEFAULTS.authTextLoggedOut)}</span>`;
}

async function handleAuthButtonClick(e) {
  const btn = e.currentTarget;
  const state = btn?.dataset?.state || "logged-out";
  const supabase = getSupabaseClient();
  if (!supabase) return;
  
  if (state === "logged-in") {
    try {
      await supabase.auth.signOut();
      await renderProfileState();
    } catch (err) {
      console.error("[Profile] Sign out failed:", err);
    }
    return;
  }
  
  const loginPath = "/login.html";
  if (window.router?.navigate) {
    window.router.navigate(loginPath);
  } else {
    window.location.href = loginPath;
  }
}

function bindAuthButton() {
  const btn = document.getElementById("appProfileAuthBtn");
  if (!btn || btn.dataset.bound === "true") return;
  
  btn.dataset.bound = "true";
  btn.addEventListener("click", handleAuthButtonClick);
}

async function renderGuestState() {
  setProfileUsername(PROFILE_DEFAULTS.username);
  setProfileMemberSince(PROFILE_DEFAULTS.memberSince);
  setProfileAvatar(PROFILE_DEFAULTS.avatar);
  setAuthButton(false);
  bindAuthButton();
}

async function renderAuthenticatedState() {
  const user = await getCurrentUser();
  if (!user) {
    await renderGuestState();
    return;
  }
  
  const profile = await getUserProfile(user.id);
  
  const username =
    profile?.username ||
    user.email?.split("@")[0] ||
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
  const session = await getSession();
  
  if (!session?.user) {
    await renderGuestState();
    return;
  }
  
  await renderAuthenticatedState();
}

function destroyProfilePage() {
  if (!PROFILE_PAGE.active) return;
  
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
  
  PROFILE_PAGE.active = false;
}

function initProfilePage() {
  if (PROFILE_PAGE.active) return;
  
  const root = document.getElementById("profile-page");
  if (!root) return;
  
  destroyProfilePage();
  
  PROFILE_PAGE.active = true;
  PROFILE_PAGE.controller = new AbortController();
  
  const { signal } = PROFILE_PAGE.controller;
  
  renderProfileState();
  
  const supabase = getSupabaseClient();
  if (supabase?.auth?.onAuthStateChange) {
    const { data } = supabase.auth.onAuthStateChange(async () => {
      if (!PROFILE_PAGE.active) return;
      await renderProfileState();
    });
    
    PROFILE_PAGE.authSubscription = data?.subscription || null;
  }
  
  const cleanup = () => destroyProfilePage();
  signal.addEventListener("abort", cleanup, { once: true });
}

function handleProfilePageLifecycle(e) {
  const path = (e?.detail?.path || getCurrentPath() || "").trim();
  
  if (path === "/profile") {
    initProfilePage();
  } else {
    destroyProfilePage();
  }
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