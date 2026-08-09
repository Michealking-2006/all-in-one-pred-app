/************************************************************
 * SCOUTWAVE — SUPABASE CLIENT
 ************************************************************/

const SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_l-EwBR_dCGpxDo_87GC1HA_1COYjj3W";
const COOKIE_DOMAIN = ".myscoutwave.com";

function getCookie(name) {
  const escaped = name.replace(/[$()*+./?[\\\]^{|}-]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escaped}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 7) {
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ` +
    `path=/; domain=${COOKIE_DOMAIN}; samesite=lax; secure; max-age=${maxAgeSeconds}`;
}

function removeCookie(name) {
  document.cookie =
    `${encodeURIComponent(name)}=; ` +
    `path=/; domain=${COOKIE_DOMAIN}; samesite=lax; secure; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

const sharedStorage = {
  getItem: (key) => getCookie(key),
  setItem: (key, value) => setCookie(key, value),
  removeItem: (key) => removeCookie(key),
};

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sharedStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});