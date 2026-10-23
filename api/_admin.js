// Shared server-side helpers for the admin dashboard (/mingt-t) and the public
// config / feedback endpoints. The leading underscore keeps Vercel from
// exposing this file as a route.
//
// Security model (the URL /mingt-t is only obscurity, the real protection is here):
//  Three layers guard the sign-in (see api/_adminsec.js and docs/ADMIN.md):
//   1. Two-factor is REQUIRED (ADMIN_TOTP_SECRET) and every code works once.
//   2. Failed logins lock out per IP and overall, stored in the database so
//      it survives serverless restarts, with lock times that double.
//   3. Sessions are recorded on the server: idle timeout, tied to the browser,
//      listed and revocable ("sign out everywhere").
//  - The admin signs in with ADMIN_PASSWORD_HASH (scrypt) or ADMIN_PASSWORD, an
//    optional ADMIN_EMAIL, and the authenticator code.
//  - A successful login returns a short-lived HMAC-signed token (ADMIN_SESSION_SECRET).
//    It travels in an Authorization header (never a cookie), so cross-site
//    request forgery can't use it.
//  - Every admin write is recorded in the admin_audit table.
//  - The Supabase service-role key only ever exists on the server.
import crypto from "node:crypto";
import { FEATURE_DEFAULTS } from "../src/features.js";
import { safeUrl } from "../src/utils/safeUrl.js";
import { isDay } from "../src/placements.js";

export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_SUPABASE_URL = "https://fhsteyglvxuanyvgkkxp.supabase.co";

export const env = (name) => String(process.env[name] || "").trim();

// ---------------------------------------------------------------------------
// Small crypto helpers
// ---------------------------------------------------------------------------
const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  // Compare fixed-length digests so the length of the secret never leaks through timing.
  const hx = crypto.createHash("sha256").update(x).digest(), hy = crypto.createHash("sha256").update(y).digest();
  return crypto.timingSafeEqual(hx, hy) && x.length === y.length;
}

export function hashPassword(password, saltHex = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${saltHex}$${hash}`;
}

function verifyPassword(password) {
  const stored = env("ADMIN_PASSWORD_HASH");
  if (stored) {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    try { return safeEqual(hashPassword(password, salt).split("$")[2], hash); } catch { return false; }
  }
  const plain = env("ADMIN_PASSWORD");
  return !!plain && safeEqual(password, plain);
}

// RFC 4648 base32 -> bytes
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of String(input).toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "")) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("bad base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s step)
export function totp(secretBase32, time = Date.now(), stepOffset = 0) {
  const counter = Math.floor(time / 30000) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secretBase32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export const twoFactorConfigured = () => env("ADMIN_TOTP_SECRET").length >= 16;

// The 30-second step the code belongs to, or null. Two-factor is required: with no secret
// configured no code is ever accepted (the sign-in refuses to start; it never skips the check).
export function totpStep(code, now = Date.now()) {
  const secret = env("ADMIN_TOTP_SECRET");
  if (!secret) return null;
  const clean = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  try {
    let found = null;
    for (const offset of [-1, 0, 1]) if (safeEqual(totp(secret, now, offset), clean)) found = Math.floor(now / 30000) + offset; // one step of clock drift either way
    return found;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------
const sessionSecret = () => env("ADMIN_SESSION_SECRET");
export const adminConfigured = () => sessionSecret().length >= 32 && !!(env("ADMIN_PASSWORD_HASH") || env("ADMIN_PASSWORD"));

export function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token, now = Date.now()) {
  if (!sessionSecret() || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload && payload.exp > now && payload.sub === "admin" ? payload : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (best effort: per server instance)
// ---------------------------------------------------------------------------
const attempts = new Map(); // ip -> { fails, lockedUntil }
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

export function clientIp(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}
export function loginLocked(ip, now = Date.now()) {
  const a = attempts.get(ip);
  return a && a.lockedUntil > now ? Math.ceil((a.lockedUntil - now) / 1000) : 0;
}
export function recordLogin(ip, success, now = Date.now()) {
  if (success) { attempts.delete(ip); return; }
  const a = attempts.get(ip) || { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) { a.lockedUntil = now + LOCK_MS; a.fails = 0; }
  attempts.set(ip, a);
}
export const resetRateLimits = () => attempts.clear();

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
// Always evaluates all three factors so nothing hints at which one was wrong.
// Returns { ok, step }: step is the authenticator step to burn once the login is accepted.
export function checkFactors({ email, password, code }, now = Date.now()) {
  const wantEmail = env("ADMIN_EMAIL").toLowerCase();
  const emailOk = !wantEmail || safeEqual(String(email || "").trim().toLowerCase(), wantEmail);
  const passOk = verifyPassword(String(password || ""));
  const step = totpStep(code, now);
  return { ok: emailOk && passOk && step !== null, step };
}

// ---------------------------------------------------------------------------
// Supabase (PostgREST + GoTrue admin) with the service-role key
// ---------------------------------------------------------------------------
export const supabaseUrl = () => (env("SUPABASE_URL") || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
export const supabaseConfigured = () => !!env("SUPABASE_SERVICE_ROLE_KEY");

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function sb(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  if (!supabaseConfigured()) throw new HttpError(503, "Storage is not configured (set SUPABASE_SERVICE_ROLE_KEY).");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let res;
  try {
    res = await fetch(supabaseUrl() + path, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(504, "Storage did not respond. Try again.");
  }
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, (data && (data.message || data.msg || data.error_description)) || `Storage error (${res.status}).`);
  return data;
}

// ---------------------------------------------------------------------------
// Remote config: one validated JSON document in app_config (key = 'main')
// ---------------------------------------------------------------------------
export const FX_PRICE_KEYS = ["fire", "ice", "bubbles"];
export const PLACEMENT_SLOTS = ["news_list", "news_top", "news_inline", "news_bottom"];

export const DEFAULT_CONFIG = {
  flags: { ...FEATURE_DEFAULTS },
  maintenance: { on: false, message: "" },
  announcement: { on: false, id: "", text: "", level: "info", link: "", expiresAt: null },
  // Spaces in the news section for an ad or a house promotion. Each is off until filled in and switched on.
  placements: Object.fromEntries(PLACEMENT_SLOTS.map((slot) => [slot, { on: false, label: "Sponsored", title: "", text: "", cta: "Learn more", link: "", image: "", startsAt: "", endsAt: "", campaign: "" }])),
  minVersion: "0.0.0",
  fxPrices: { fire: 50, ice: 40, bubbles: 30 },
  tipCost: 5,
  updatedAt: null,
};
export const KNOWN_FLAGS = Object.keys(DEFAULT_CONFIG.flags);

export const PLACEMENT_LABELS = ["Sponsored", "Ad", "Partner", "Promoted"];

const isSemver = (v) => /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v);
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

// Throws HttpError(400) with a message the admin can act on.
export function validateConfig(input) {
  if (!input || typeof input !== "object") throw new HttpError(400, "Config must be an object.");
  const out = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  for (const name of Object.keys(input.flags || {})) {
    if (!KNOWN_FLAGS.includes(name)) throw new HttpError(400, `Unknown flag "${name}".`);
    if (typeof input.flags[name] !== "boolean") throw new HttpError(400, `Flag "${name}" must be on or off.`);
    out.flags[name] = input.flags[name];
  }

  const m = input.maintenance || {};
  out.maintenance = { on: m.on === true, message: clean(m.message, 300) };

  const a = input.announcement || {};
  const level = ["info", "warn", "success"].includes(a.level) ? a.level : "info";
  let link = clean(a.link, 300);
  if (link && !/^https?:\/\//i.test(link) && !link.startsWith("/")) throw new HttpError(400, "The announcement link must start with https://, http:// or /.");
  let expiresAt = null;
  if (a.expiresAt) {
    const t = new Date(a.expiresAt).getTime();
    if (!Number.isFinite(t)) throw new HttpError(400, "The announcement expiry is not a valid date.");
    expiresAt = new Date(t).toISOString();
  }
  const text = clean(a.text, 240);
  if (a.on === true && !text) throw new HttpError(400, "Write the announcement text before turning it on.");
  out.announcement = { on: a.on === true, id: clean(a.id, 40) || (a.on ? String(Date.now()) : ""), text, level, link, expiresAt };

  for (const slot of PLACEMENT_SLOTS) {
    const p = input.placements?.[slot] || {};
    const link = clean(p.link, 500), image = clean(p.image, 500);
    const safeLink = link ? safeUrl(link) : "", safeImage = image ? safeUrl(image, { image: true, httpsOnly: true }) : "";
    if (link && (!safeLink || /^(mailto:|tel:)/i.test(safeLink))) throw new HttpError(400, `The ${slot.replace("_", " ")} link must start with https://, http:// or /.`);
    if (image && !safeImage) throw new HttpError(400, `The ${slot.replace("_", " ")} image must be an https:// address.`);
    const entry = { on: p.on === true, label: PLACEMENT_LABELS.includes(p.label) ? p.label : "Sponsored", title: clean(p.title, 90), text: clean(p.text, 200), cta: clean(p.cta, 24) || "Learn more", link: safeLink, image: safeImage };
    if (entry.on && (!entry.title || !entry.link)) throw new HttpError(400, `Add a headline and a link to the ${slot.replace("_", " ")} space before turning it on.`);
    // Run dates (whole days, UTC) and a campaign id: it changes when the headline or link changes, so each
    // creative gets its own figures in the placement report.
    const startsAt = clean(p.startsAt, 10), endsAt = clean(p.endsAt, 10);
    if ((startsAt && !isDay(startsAt)) || (endsAt && !isDay(endsAt))) throw new HttpError(400, `The ${slot.replace("_", " ")} dates must be real days.`);
    if (startsAt && endsAt && endsAt < startsAt) throw new HttpError(400, `The ${slot.replace("_", " ")} end date is before its start date.`);
    entry.startsAt = startsAt; entry.endsAt = endsAt;
    entry.campaign = entry.title && entry.link ? crypto.createHash("sha1").update(`${slot}|${entry.title}|${entry.link}`).digest("hex").slice(0, 8) : "";
    out.placements[slot] = entry;
  }

  const minVersion = clean(input.minVersion || "0.0.0", 20);
  if (!isSemver(minVersion)) throw new HttpError(400, "Minimum version must look like 0.17.0.");
  out.minVersion = minVersion;

  for (const key of FX_PRICE_KEYS) {
    const v = Number(input.fxPrices?.[key] ?? DEFAULT_CONFIG.fxPrices[key]);
    if (!Number.isInteger(v) || v < 0 || v > 5000) throw new HttpError(400, `The ${key} theme price must be a whole number from 0 to 5000 coins.`);
    out.fxPrices[key] = v;
  }
  const tip = Number(input.tipCost ?? DEFAULT_CONFIG.tipCost);
  if (!Number.isInteger(tip) || tip < 0 || tip > 500) throw new HttpError(400, "The tip unlock cost must be a whole number from 0 to 500 coins.");
  out.tipCost = tip;
  return out;
}

let configCache = { at: 0, value: null };
export async function readConfig({ fresh = false } = {}) {
  if (!fresh && configCache.value && Date.now() - configCache.at < 20_000) return configCache.value;
  let value = DEFAULT_CONFIG;
  if (supabaseConfigured()) {
    const rows = await sb("/rest/v1/app_config?key=eq.main&select=value,updated_at&limit=1");
    if (Array.isArray(rows) && rows[0]?.value) {
      try { value = { ...validateConfig(rows[0].value), updatedAt: rows[0].updated_at || null }; } catch { value = DEFAULT_CONFIG; }
    }
  }
  configCache = { at: Date.now(), value };
  return value;
}

export async function writeConfig(config) {
  await sb("/rest/v1/app_config?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: { key: "main", value: config, updated_at: new Date().toISOString() },
  });
  configCache = { at: 0, value: null };
}

export async function audit(actor, action, detail = {}, ip = "") {
  try {
    await sb("/rest/v1/admin_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: { actor, action, detail, ip } });
  } catch {
    // An audit failure must not hide the fact that the action itself ran; it is reported in the logs.
    console.error("admin audit write failed for", action);
  }
}
