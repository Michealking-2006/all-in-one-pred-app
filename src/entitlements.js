// Premium, coins and unlocks that live on the account (server) instead of the
// device. Active only when the "serverEntitlements" flag is on (admin
// dashboard) AND the person is signed in; guests keep the local demo.
//
// The server is the only writer: the app asks to spend, the server decides
// price and balance and answers with the new state, which is mirrored here.
import { store, UNLOCK_COST, COIN_THEME_IDS } from "./store.js";
import { isFeatureOn } from "./features.js";
import { getAccessToken } from "./api/supabase.js";
import { REMOTE_EVENT, tipCostOverride } from "./remoteConfig.js";

const REFRESH_MS = 5 * 60 * 1000;
export const serverMode = () => isFeatureOn("serverEntitlements") && !!store.getState().authUser;
export const tipCost = () => tipCostOverride() ?? UNLOCK_COST;

async function call(path, { method = "GET", body } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to continue.");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(path, {
      method,
      cache: "no-store",
      headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const error = new Error(data.error || "Request failed."); error.status = res.status; error.coins = data.coins; throw error; }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("That took too long. Try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

// Mirror the server's answer into the store (only if something actually changed).
export function applyEntitlements(e) {
  if (!e || typeof e !== "object") return;
  const next = {
    isVip: e.isVip === true,
    coins: Number.isFinite(e.coins) ? Math.max(0, Math.floor(e.coins)) : store.getState().coins,
    unlockedThemes: (Array.isArray(e.unlockedThemes) ? e.unlockedThemes : []).filter((id) => COIN_THEME_IDS.includes(id)),
    unlockedMatchIds: (Array.isArray(e.unlockedTips) ? e.unlockedTips : []).map(Number).filter(Number.isFinite),
  };
  const now = store.getState();
  const same = now.isVip === next.isVip && now.coins === next.coins
    && JSON.stringify(now.unlockedThemes) === JSON.stringify(next.unlockedThemes)
    && JSON.stringify(now.unlockedMatchIds) === JSON.stringify(next.unlockedMatchIds);
  if (!same) store.setState(next);
}

let syncing = false;
let syncedUser = null;

export async function syncEntitlements() {
  if (!serverMode() || syncing) return false;
  syncing = true;
  try {
    applyEntitlements(await call("/api/me"));
    syncedUser = store.getState().authUser?.id || null;
    return true;
  } catch {
    return false; // offline or signed out: keep what we have
  } finally {
    syncing = false;
  }
}

// Spend coins on "theme:<id>" or "tip:<fixtureId>". Resolves with the new state.
export async function spendCoins(item) {
  const entitlements = await call("/api/spend", { method: "POST", body: { item } });
  applyEntitlements(entitlements);
  return entitlements;
}

// Open a Polar checkout for "premium:1m", "premium:12m" or "coins:<pack>". Leaves the app for the hosted payment page.
export async function startCheckout(item) {
  const { url } = await call("/api/checkout", { method: "POST", body: { item } });
  if (typeof url !== "string" || !/^https:\/\//.test(url)) throw new Error("Couldn't start the checkout. Try again.");
  window.location.assign(url);
}

// Back from the payment page (?checkout=success). The webhook can land a few seconds after the
// redirect, so ask a few times until the account shows the purchase.
async function finishCheckoutReturn() {
  let params;
  try { params = new URLSearchParams(window.location.search); } catch { return; }
  if (params.get("checkout") !== "success") return;
  params.delete("checkout"); params.delete("checkout_id");
  const query = params.toString();
  window.history.replaceState(window.history.state, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  const before = store.getState();
  const showToast = (await import("./toast.js")).showToast;
  showToast("Thanks! Confirming your payment…", "default", 4000);
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1500 : 3000));
    await syncEntitlements();
    const now = store.getState();
    if (now.isVip !== before.isVip || now.coins !== before.coins) { showToast("Payment received. Your account is updated.", "success", 4500); return; }
  }
  showToast("Payment received. It can take a minute to show up here; pull to refresh.", "default", 6000);
}

export function initEntitlements() {
  let lastUser = store.getState().authUser?.id || null;
  const check = () => {
    const user = store.getState().authUser?.id || null;
    if (user !== lastUser) {
      lastUser = user;
      if (user) syncEntitlements();
      else if (syncedUser) {
        // Signed out: account Premium and coins must not linger on the device.
        syncedUser = null;
        store.setState({ isVip: false, coins: 8, unlockedThemes: [], unlockedMatchIds: [], fxTheme: null });
      }
    }
  };
  store.subscribe(check);
  window.addEventListener(REMOTE_EVENT, () => { syncEntitlements(); });
  window.setInterval(() => { if (!document.hidden) syncEntitlements(); }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncEntitlements(); });
  syncEntitlements().then(finishCheckoutReturn);
}
