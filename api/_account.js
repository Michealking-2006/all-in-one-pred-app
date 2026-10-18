// Account entitlements (Premium, coins, unlocked themes and tips) stored in the
// database and changed only by the server. Used by api/me.js, api/spend.js and
// the admin dashboard.
import { sb, env, HttpError, readConfig } from "./_admin.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const COIN_THEMES = ["fire", "ice", "bubbles"];
export const STARTING_COINS = 8;

// ---------------------------------------------------------------------------
// Who is calling? Ask Supabase to validate the person's access token.
// ---------------------------------------------------------------------------
const tokenCache = new Map(); // token -> { user, at }
const TOKEN_CACHE_MS = 60_000;

export async function verifyUser(req) {
  const header = String(req.headers?.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 4000) throw new HttpError(401, "Sign in to continue.");
  const hit = tokenCache.get(token);
  if (hit && Date.now() - hit.at < TOKEN_CACHE_MS) return hit.user;
  let user;
  try {
    // sb() sends the service key by default; here the person's own token must be the bearer.
    user = await sb("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 502)) throw new HttpError(401, "Your session has expired. Sign in again.");
    throw error;
  }
  if (!user?.id || !UUID.test(user.id)) throw new HttpError(401, "Sign in to continue.");
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) throw new HttpError(403, "This account is suspended.");
  if (tokenCache.size > 2000) tokenCache.clear();
  tokenCache.set(token, { user: { id: user.id, email: user.email || "" }, at: Date.now() });
  return tokenCache.get(token).user;
}
export const clearTokenCache = () => tokenCache.clear();

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
export const isUuid = (v) => UUID.test(String(v));

export function effective(row, now = Date.now()) {
  const vipActive = !!row.is_vip && (!row.vip_until || new Date(row.vip_until).getTime() > now);
  return {
    isVip: vipActive,
    vipUntil: vipActive ? row.vip_until || null : null,
    coins: row.coins,
    unlockedThemes: row.unlocked_themes || [],
    unlockedTips: (row.unlocked_tips || []).map(Number),
  };
}

export async function getRow(userId) {
  if (!isUuid(userId)) throw new HttpError(400, "Bad user id.");
  const rows = await sb(`/rest/v1/entitlements?user_id=eq.${userId}&select=*&limit=1`);
  if (Array.isArray(rows) && rows[0]) return rows[0];
  // First time we see this account: create its row (a second concurrent create is ignored).
  const created = await sb("/rest/v1/entitlements?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: { user_id: userId, coins: STARTING_COINS },
  });
  if (Array.isArray(created) && created[0]) return created[0];
  const again = await sb(`/rest/v1/entitlements?user_id=eq.${userId}&select=*&limit=1`);
  if (Array.isArray(again) && again[0]) return again[0];
  throw new HttpError(502, "Could not load the account.");
}

// ---------------------------------------------------------------------------
// Writing: read, change, write back only if nobody else wrote in between.
// `change(row)` returns the columns to update and an optional ledger entry, or
// throws an HttpError to refuse. Retries a few times on a write race.
// ---------------------------------------------------------------------------
export async function mutate(userId, change, actor = "system") {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await getRow(userId);
    const { patch, ledger } = change(row);
    const next = { ...patch, version: Number(row.version) + 1, updated_at: new Date().toISOString() };
    const updated = await sb(`/rest/v1/entitlements?user_id=eq.${userId}&version=eq.${row.version}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: next,
    });
    if (Array.isArray(updated) && updated[0]) {
      if (ledger) {
        await sb("/rest/v1/coin_ledger", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: { user_id: userId, delta: ledger.delta, reason: ledger.reason, balance_after: updated[0].coins, actor },
        }).catch(() => console.error("coin ledger write failed for", userId));
      }
      return { before: row, after: updated[0] };
    }
    // Someone else changed the row first: loop and apply our change to the fresh copy.
  }
  throw new HttpError(409, "That account is busy. Try again.");
}

// ---------------------------------------------------------------------------
// Spending coins (the only way a person changes their own entitlements)
// ---------------------------------------------------------------------------
export async function spend(userId, item) {
  const config = await readConfig({ fresh: true });
  if (config.flags.serverEntitlements !== true) throw new HttpError(403, "Account purchases are not switched on yet.");
  const [kind, rawId] = String(item || "").split(":");

  if (kind === "theme") {
    if (!COIN_THEMES.includes(rawId)) throw new HttpError(400, "That theme can't be bought with coins.");
    const price = config.fxPrices[rawId];
    return mutate(userId, (row) => {
      if ((row.unlocked_themes || []).includes(rawId)) return { patch: {} }; // already yours: no charge
      if (row.coins < price) throw Object.assign(new HttpError(402, "Not enough coins."), { coins: row.coins });
      return { patch: { coins: row.coins - price, unlocked_themes: [...(row.unlocked_themes || []), rawId] }, ledger: { delta: -price, reason: `theme:${rawId}` } };
    });
  }
  if (kind === "tip") {
    const fixtureId = Number(rawId);
    if (!Number.isInteger(fixtureId) || fixtureId < 1) throw new HttpError(400, "Bad match.");
    const cost = config.tipCost;
    return mutate(userId, (row) => {
      if ((row.unlocked_tips || []).map(Number).includes(fixtureId)) return { patch: {} };
      if (effective(row).isVip) throw new HttpError(400, "Premium already includes every tip.");
      if (row.coins < cost) throw Object.assign(new HttpError(402, "Not enough coins."), { coins: row.coins });
      return { patch: { coins: row.coins - cost, unlocked_tips: [...(row.unlocked_tips || []), fixtureId] }, ledger: { delta: -cost, reason: `tip:${fixtureId}` } };
    });
  }
  throw new HttpError(400, "Unknown item.");
}

// ---------------------------------------------------------------------------
// Admin changes
// ---------------------------------------------------------------------------
export async function adminSet(userId, { vip, days, permanent, coinsDelta, reason }, actor = "admin") {
  const delta = coinsDelta === undefined || coinsDelta === null || coinsDelta === "" ? 0 : Number(coinsDelta);
  if (!Number.isInteger(delta) || Math.abs(delta) > 100000) throw new HttpError(400, "Coin change must be a whole number up to 100,000.");
  const wantsVip = vip === undefined ? undefined : vip === true;
  if (wantsVip === undefined && delta === 0) throw new HttpError(400, "Nothing to change.");
  const why = String(reason || "").trim().slice(0, 200);
  if (why.length < 3) throw new HttpError(400, "Write a short reason (it goes in the audit log).");
  let until = null;
  if (wantsVip === true && !permanent) {
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 3650) throw new HttpError(400, "Premium length must be 1 to 3650 days, or permanent.");
    until = new Date(Date.now() + d * 86400000).toISOString();
  }
  return mutate(userId, (row) => {
    const patch = {};
    let ledger;
    if (delta !== 0) {
      if (row.coins + delta < 0) throw new HttpError(400, `That would leave the balance below zero (they have ${row.coins}).`);
      patch.coins = row.coins + delta;
      ledger = { delta, reason: `admin: ${why}` };
    }
    if (wantsVip === true) { patch.is_vip = true; patch.vip_until = until; }
    if (wantsVip === false) { patch.is_vip = false; patch.vip_until = null; }
    return { patch, ledger };
  }, actor);
}

export const hasStorage = () => !!env("SUPABASE_SERVICE_ROLE_KEY");
