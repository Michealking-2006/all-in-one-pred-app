// Admin sign-in layers 2 and 3 (layer 1, required two-factor, lives in _admin.js):
//   2. Lockout that is stored in the database, so it survives serverless restarts and instances:
//      per IP (5 failures -> 15 min, doubling each time up to a day) and overall (20 failures
//      from anywhere within an hour -> 15 min), so spreading guesses over many IPs doesn't help.
//   3. Sessions recorded on the server: they end after 30 idle minutes (ADMIN_IDLE_MINUTES), are
//      tied to the browser that signed in, can be listed and revoked, and "sign out everywhere"
//      ends them all.
// If the storage can't be reached at SIGN-IN (for instance migration 006 hasn't been run yet)
// the admin area still opens in a reduced-protection mode and says so, so a missing migration
// can never lock the owner out. Once a session exists it is always checked.
import crypto from "node:crypto";
import { env, sb, HttpError, loginLocked as memLocked, recordLogin as memRecord } from "./_admin.js";
import { q } from "./_query.js";

const IP = { max: 5, base: 15 * 60 };
const GLOBAL = { max: 20, base: 15 * 60 };
export const idleMs = () => Math.min(240, Math.max(5, Math.floor(Number(env("ADMIN_IDLE_MINUTES")) || 30))) * 60000;

const sha = (v) => crypto.createHash("sha256").update(env("ADMIN_SESSION_SECRET") + "|" + v).digest("hex").slice(0, 32);
const rpc = (name, body) => sb(`/rest/v1/rpc/${q.word(name)}`, { method: "POST", body });
const uaOf = (req) => String(req.headers?.["user-agent"] || "").slice(0, 300);
const coarse = (ip) => (ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip.split(".").slice(0, 3).join("."));

// ---------------------------------------------------------------- layer 2: lockout
export async function lockStatus(ip) {
  try {
    const [all, mine] = await Promise.all([rpc("admin_login_status", { p_scope: "global" }), rpc("admin_login_status", { p_scope: "ip:" + sha(ip) })]);
    return { seconds: Math.max(Number(all) || 0, Number(mine) || 0), degraded: false };
  } catch {
    return { seconds: memLocked(ip), degraded: true };
  }
}

export async function recordFailure(ip) {
  try {
    const [mine, all] = await Promise.all([
      rpc("admin_login_fail", { p_scope: "ip:" + sha(ip), p_max: IP.max, p_base_seconds: IP.base, p_escalate: true }),
      rpc("admin_login_fail", { p_scope: "global", p_max: GLOBAL.max, p_base_seconds: GLOBAL.base, p_escalate: false }),
    ]);
    const m = Array.isArray(mine) ? mine[0] : mine, g = Array.isArray(all) ? all[0] : all;
    return { fails: m?.fails ?? 0, lockedSeconds: Math.max(m?.locked_seconds || 0, g?.locked_seconds || 0), level: m?.level ?? 0, degraded: false };
  } catch {
    memRecord(ip, false);
    return { fails: 1, lockedSeconds: memLocked(ip), level: 0, degraded: true };
  }
}

export async function recordSuccess(ip) {
  memRecord(ip, true);
  await rpc("admin_login_ok", { p_scope: "ip:" + sha(ip) }).catch(() => {});
}

// ---------------------------------------------------------------- layer 1 helper: one-time codes
let lastStepLocal = 0; // fallback if storage is unreachable: still blocks replays on this instance
export async function consumeTotp(step) {
  try {
    return { ok: (await rpc("admin_use_totp_step", { p_step: step })) === true, degraded: false };
  } catch {
    const ok = step > lastStepLocal;
    if (ok) lastStepLocal = step;
    return { ok, degraded: true };
  }
}

// ---------------------------------------------------------------- layer 3: sessions
export async function createSession(req, { now = Date.now(), ttl }) {
  const id = crypto.randomUUID();
  const ip = String(req.__ip || "");
  try {
    await sb("/rest/v1/admin_sessions", { method: "POST", headers: { Prefer: "return=minimal" }, body: { id, created_at: new Date(now).toISOString(), last_seen: new Date(now).toISOString(), expires_at: new Date(now + ttl).toISOString(), ip, last_ip: ip, ua_hash: sha(uaOf(req)), ua: uaOf(req) } });
    sb(`/rest/v1/admin_sessions?expires_at=lt.${q.iso(now - 30 * 86400000)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    return { id, degraded: false };
  } catch {
    return { id, degraded: true };
  }
}

const REASONS = {
  unknown: "Your session has ended. Sign in again.",
  revoked: "You were signed out from the Security page. Sign in again.",
  expired: "Your session has expired. Sign in again.",
  idle: "You were signed out after a period of inactivity. Sign in again.",
  device: "This session doesn't match the browser it was started in, so it was ended. Sign in again.",
  network: "Your network changed, so the session was ended. Sign in again.",
};
export const reasonText = (r) => REASONS[r] || REASONS.unknown;

async function endSession(id, reason) {
  await sb(`/rest/v1/admin_sessions?id=eq.${q.uuid(id)}&revoked_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { revoked_at: new Date().toISOString(), revoked_reason: reason } }).catch(() => {});
}

// -> { ok: true, ipChanged? } | { ok: false, reason }   (throws HttpError(503) if storage is down: fail closed)
export async function checkSession(payload, req, ip, now = Date.now()) {
  if (payload.deg) return { ok: true, degraded: true }; // issued while storage was unreachable at sign-in
  const id = String(payload.jti || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, reason: "unknown" };
  let rows;
  try { rows = await sb(`/rest/v1/admin_sessions?id=eq.${q.uuid(id)}&select=*&limit=1`); }
  catch { throw new HttpError(503, "Can't verify your session right now. Try again in a moment."); }
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s) return { ok: false, reason: "unknown" };
  if (s.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(s.expires_at).getTime() <= now) return { ok: false, reason: "expired" };
  if (now - new Date(s.last_seen).getTime() > idleMs()) { await endSession(id, "idle"); return { ok: false, reason: "idle" }; }
  if (s.ua_hash !== sha(uaOf(req))) { await endSession(id, "device"); return { ok: false, reason: "device" }; }
  if (env("ADMIN_BIND_IP") === "1" && coarse(ip) !== coarse(s.ip)) { await endSession(id, "network"); return { ok: false, reason: "network" }; }
  const ipChanged = ip !== s.last_ip;
  if (ipChanged || now - new Date(s.last_seen).getTime() > 60000) {
    await sb(`/rest/v1/admin_sessions?id=eq.${q.uuid(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { last_seen: new Date(now).toISOString(), last_ip: ip } }).catch(() => {});
  }
  return { ok: true, ipChanged, from: s.last_ip };
}

function describe(ua) {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

export async function listSessions(currentId, now = Date.now()) {
  const rows = await sb(`/rest/v1/admin_sessions?revoked_at=is.null&expires_at=gt.${q.iso(now)}&last_seen=gt.${q.iso(now - idleMs())}&select=id,created_at,last_seen,ip,last_ip,ua&order=last_seen.desc&limit=20`);
  return (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, createdAt: r.created_at, lastSeen: r.last_seen, ip: r.last_ip || r.ip, device: describe(r.ua || ""), current: r.id === currentId }));
}

export const revokeSession = (id, reason = "manual") => endSession(id, reason);
export async function revokeAll(reason = "sign-out-everywhere") {
  await sb("/rest/v1/admin_sessions?revoked_at=is.null", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { revoked_at: new Date().toISOString(), revoked_reason: reason } });
}

export async function storageReady() {
  try { await rpc("admin_login_status", { p_scope: "global" }); await sb("/rest/v1/admin_sessions?select=id&limit=1"); return true; } catch { return false; }
}
