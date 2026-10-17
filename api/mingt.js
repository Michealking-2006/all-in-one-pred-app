// Admin API for the dashboard at /mingt-t. One endpoint, POST only, JSON in and
// out: { action, ...params }. Everything except "login" needs a valid token.
import crypto from "node:crypto";
import {
  env, adminConfigured, signToken, verifyToken, TOKEN_TTL_MS, clientIp, loginLocked, recordLogin, checkCredentials,
  supabaseConfigured, sb, HttpError, validateConfig, readConfig, writeConfig, audit, KNOWN_FLAGS, DEFAULT_CONFIG,
} from "./_admin.js";
import { APP_VERSION } from "../src/config.js";

const FOOTBALL_BASE = env("FOOTBALL_API_BASE") || "https://v3.football.api-sports.io";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let footballStatusCache = { at: 0, value: null };

async function footballStatus() {
  if (Date.now() - footballStatusCache.at < 60_000 && footballStatusCache.value) return footballStatusCache.value;
  const key = env("SCOUTWAVE_FOOTBALL_API_KEY");
  if (!key) return { configured: false };
  try {
    // /status is free: it does not count against the daily request quota.
    const res = await fetch(FOOTBALL_BASE + "/status", { headers: { "x-apisports-key": key }, signal: AbortSignal.timeout(6000) });
    const data = await res.json().catch(() => null);
    const r = data?.response;
    const value = r && !Array.isArray(r)
      ? { configured: true, ok: true, plan: r.subscription?.plan || "", active: r.subscription?.active ?? null, ends: r.subscription?.end || null, used: r.requests?.current ?? null, limit: r.requests?.limit_day ?? null }
      : { configured: true, ok: false, error: "The football API did not return account details (check the key)." };
    footballStatusCache = { at: Date.now(), value };
    return value;
  } catch {
    return { configured: true, ok: false, error: "The football API did not respond." };
  }
}

const countFrom = (res) => {
  const range = res.headers.get("content-range") || ""; // "0-0/42"
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
};

async function overview() {
  const settled = await Promise.allSettled([
    footballStatus(),
    readConfig({ fresh: true }),
    supabaseConfigured() ? sb("/rest/v1/support_messages?select=id&status=eq.new&limit=1", { raw: true, headers: { Prefer: "count=exact", Range: "0-0" } }).then(countFrom) : Promise.resolve(null),
    supabaseConfigured() ? sb("/rest/v1/support_messages?select=id&limit=1", { raw: true, headers: { Prefer: "count=exact", Range: "0-0" } }).then(countFrom) : Promise.resolve(null),
    supabaseConfigured() ? sb("/auth/v1/admin/users?page=1&per_page=1", { raw: true }).then((res) => { const n = Number(res.headers.get("x-total-count")); return Number.isFinite(n) && n > 0 ? n : null; }) : Promise.resolve(null),
  ]);
  const [football, config, newMessages, totalMessages, users] = settled.map((s) => (s.status === "fulfilled" ? s.value : null));
  const supabaseOk = settled[1].status === "fulfilled" && supabaseConfigured();
  const flag = (name) => !!env(name);
  return {
    version: APP_VERSION,
    deploy: { env: env("VERCEL_ENV") || "local", region: env("VERCEL_REGION") || "", commit: env("VERCEL_GIT_COMMIT_SHA").slice(0, 7) },
    health: [
      { id: "football", label: "Football data API", ok: !!football?.ok, detail: football?.configured === false ? "SCOUTWAVE_FOOTBALL_API_KEY is not set" : football?.ok ? `${football.plan || "plan"} · ${football.used ?? "?"}/${football.limit ?? "?"} requests today` : football?.error || "No answer" },
      { id: "news", label: "News API", ok: flag("NEWS_ACCESS"), detail: flag("NEWS_ACCESS") ? "NEWS_ACCESS is set" : "NEWS_ACCESS is not set" },
      { id: "storage", label: "Database (Supabase)", ok: supabaseOk, detail: !supabaseConfigured() ? "SUPABASE_SERVICE_ROLE_KEY is not set" : supabaseOk ? "Reachable" : "Could not read app_config (did you run supabase/migrations/001_admin.sql?)" },
      { id: "site", label: "Public site URL", ok: flag("SITE_URL"), detail: flag("SITE_URL") ? env("SITE_URL") : "SITE_URL not set (the request host is used for canonical links)" },
      { id: "twofa", label: "Admin two-factor sign-in", ok: flag("ADMIN_TOTP_SECRET"), detail: flag("ADMIN_TOTP_SECRET") ? "Enabled" : "Not enabled: strongly recommended (ADMIN_TOTP_SECRET)" },
    ],
    football: football || { configured: false },
    inbox: { new: newMessages, total: totalMessages },
    users,
    config,
    flagsKnown: KNOWN_FLAGS,
  };
}

function diffKeys(before, after) {
  const changes = {};
  for (const key of Object.keys(after)) {
    if (key === "updatedAt") continue;
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after[key])) changes[key] = { from: before?.[key] ?? null, to: after[key] };
  }
  return changes;
}

async function setConfig(input, actor, ip) {
  const next = validateConfig(input);
  const current = await readConfig({ fresh: true }).catch(() => DEFAULT_CONFIG);
  // A changed (or newly enabled) announcement gets a new id, so people who dismissed the old one see it again.
  const a = next.announcement, c = current.announcement || {};
  if (a.on) {
    const changed = !c.on || c.text !== a.text || c.level !== a.level || c.link !== a.link;
    a.id = changed ? String(Date.now()) : (c.id || String(Date.now()));
  }
  next.updatedAt = new Date().toISOString();
  await writeConfig(next);
  const changes = diffKeys(current, next);
  await audit(actor, "config.update", { changed: Object.keys(changes), changes }, ip);
  return next;
}

const likeTerm = (q) => String(q || "").replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 60);

async function listMessages({ status, q, offset = 0, limit = 30 }) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100), off = Math.max(parseInt(offset, 10) || 0, 0);
  let path = `/rest/v1/support_messages?select=*&order=created_at.desc`;
  if (["new", "read", "resolved"].includes(status)) path += `&status=eq.${status}`;
  const term = likeTerm(q);
  if (term) path += `&or=(message.ilike.*${encodeURIComponent(term)}*,email.ilike.*${encodeURIComponent(term)}*,name.ilike.*${encodeURIComponent(term)}*)`;
  const res = await sb(path, { raw: true, headers: { Prefer: "count=exact", Range: `${off}-${off + lim - 1}`, "Range-Unit": "items" } });
  if (!res.ok && res.status !== 206) throw new HttpError(502, "Could not load messages.");
  return { items: await res.json(), total: countFrom(res), offset: off, limit: lim };
}

async function listUsers({ page = 1 }) {
  const p = Math.min(Math.max(parseInt(page, 10) || 1, 1), 1000);
  const res = await sb(`/auth/v1/admin/users?page=${p}&per_page=50`, { raw: true });
  if (!res.ok) throw new HttpError(502, "Could not load users.");
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.users || [];
  const total = Number(res.headers.get("x-total-count"));
  return {
    page: p, total: Number.isFinite(total) && total > 0 ? total : null,
    users: list.map((u) => ({
      id: u.id, email: u.email || "", createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null,
      confirmed: !!u.email_confirmed_at, providers: u.app_metadata?.providers || [], bannedUntil: u.banned_until || null,
    })),
  };
}

const ACTIONS = {
  me: async (_body, ctx) => ({ ok: true, expiresAt: ctx.token.exp, version: APP_VERSION }),
  overview: async () => overview(),
  config_get: async () => ({ config: await readConfig({ fresh: true }), flagsKnown: KNOWN_FLAGS }),
  config_set: async (body, ctx) => ({ config: await setConfig(body.config, ctx.actor, ctx.ip) }),
  messages_list: async (body) => listMessages(body),
  message_update: async (body, ctx) => {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Bad message id.");
    const patch = {};
    if (body.status !== undefined) {
      if (!["new", "read", "resolved"].includes(body.status)) throw new HttpError(400, "Bad status.");
      patch.status = body.status;
    }
    if (body.note !== undefined) patch.note = String(body.note).slice(0, 500);
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to update.");
    await sb(`/rest/v1/support_messages?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: patch });
    await audit(ctx.actor, "message.update", { id, ...patch }, ctx.ip);
    return { ok: true };
  },
  message_delete: async (body, ctx) => {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Bad message id.");
    await sb(`/rest/v1/support_messages?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await audit(ctx.actor, "message.delete", { id }, ctx.ip);
    return { ok: true };
  },
  users_list: async (body) => listUsers(body),
  user_ban: async (body, ctx) => {
    if (!UUID.test(String(body.id))) throw new HttpError(400, "Bad user id.");
    const hours = body.permanent ? 876000 : Math.min(Math.max(parseInt(body.hours, 10) || 24, 1), 87600);
    await sb(`/auth/v1/admin/users/${body.id}`, { method: "PUT", body: { ban_duration: `${hours}h` } });
    await audit(ctx.actor, "user.ban", { id: body.id, hours }, ctx.ip);
    return { ok: true };
  },
  user_unban: async (body, ctx) => {
    if (!UUID.test(String(body.id))) throw new HttpError(400, "Bad user id.");
    await sb(`/auth/v1/admin/users/${body.id}`, { method: "PUT", body: { ban_duration: "none" } });
    await audit(ctx.actor, "user.unban", { id: body.id }, ctx.ip);
    return { ok: true };
  },
  audit_list: async (body) => {
    const lim = Math.min(Math.max(parseInt(body.limit, 10) || 100, 1), 300);
    return { items: await sb(`/rest/v1/admin_audit?select=*&order=at.desc&limit=${lim}`) };
  },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Same-origin only: a page on another site can't drive this API from a visitor's browser.
  const origin = req.headers?.origin;
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* malformed */ }
    if (host !== String(req.headers.host || "")) return res.status(403).json({ error: "Forbidden" });
  }
  if (!adminConfigured()) {
    return res.status(503).json({ error: "The admin area is not set up yet. See docs/ADMIN.md.", code: "NOT_CONFIGURED" });
  }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  if (!body || typeof body.action !== "string") return res.status(400).json({ error: "Bad request" });
  const ip = clientIp(req);

  try {
    if (body.action === "login") {
      // The dashboard probes with an empty login to learn whether the area is configured: not a failed attempt.
      if (!body.password) return res.status(400).json({ error: "Enter your passphrase." });
      const wait = loginLocked(ip);
      if (wait) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, retryAfter: wait });
      const ok = checkCredentials({ email: body.email, password: body.password, code: body.code });
      recordLogin(ip, ok);
      if (!ok) {
        await sleep(400 + Math.floor(Math.random() * 300)); // slow down guessing
        return res.status(401).json({ error: "Those details are not right." });
      }
      const now = Date.now();
      const token = signToken({ sub: "admin", iat: now, exp: now + TOKEN_TTL_MS, jti: crypto.randomUUID() });
      await audit("admin", "login", {}, ip);
      return res.status(200).json({ token, expiresAt: now + TOKEN_TTL_MS, version: APP_VERSION });
    }

    const header = String(req.headers?.authorization || "");
    const parsed = verifyToken(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (!parsed) return res.status(401).json({ error: "Your session has ended. Sign in again.", code: "SESSION" });

    const run = Object.prototype.hasOwnProperty.call(ACTIONS, body.action) ? ACTIONS[body.action] : null;
    if (!run) return res.status(400).json({ error: "Unknown action" });
    const result = await run(body, { actor: "admin", ip, token: parsed });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error("admin error:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong on the server." });
  }
}
