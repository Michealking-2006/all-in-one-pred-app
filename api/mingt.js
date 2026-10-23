// Admin API for the dashboard at /mingt-t. One endpoint, POST only, JSON in and
// out: { action, ...params }. Everything except "login" needs a valid token.
import crypto from "node:crypto";
import {
  env, adminConfigured, signToken, verifyToken, TOKEN_TTL_MS, clientIp, checkFactors, twoFactorConfigured,
  supabaseConfigured, sb, HttpError, validateConfig, readConfig, writeConfig, audit, KNOWN_FLAGS, DEFAULT_CONFIG,
} from "./_admin.js";
import { adminSet, effective, getRow, isUuid, hasStorage } from "./_account.js";
import { APP_VERSION } from "../src/config.js";
import { CATALOGUE } from "./_polar.js";
import { runPredict, runGrade } from "./_predict.js";
import { adminReport, importForebet } from "./_report.js";
import { pushConfigured } from "./_push.js";
import { renderPage } from "./_seoPages.js";
import { siteOrigin, spentToday, seoCap } from "./_site.js";
import { auditHtml } from "../src/seoAudit.js";
import { isKnownPath } from "../src/seoEntities.js";
import { PLACEMENT_SLOTS, placementState, ctr } from "../src/placements.js";
import { lockStatus, recordFailure, recordSuccess, consumeTotp, createSession, checkSession, reasonText, listSessions, revokeSession, revokeAll, storageReady, idleMs } from "./_adminsec.js";
import { q as Q } from "./_query.js";

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
    supabaseConfigured() ? sb("/rest/v1/entitlements?select=user_id&limit=1").then(() => true) : Promise.resolve(false),
    supabaseConfigured() ? sb("/rest/v1/payment_events?select=order_id&limit=1").then(() => true) : Promise.resolve(false),
    supabaseConfigured() ? sb("/rest/v1/predictions?select=fixture_id&limit=1").then(() => true) : Promise.resolve(false),
    supabaseConfigured() ? sb("/rest/v1/push_subscriptions?select=endpoint&limit=1000").catch(() => null) : Promise.resolve(null),
    supabaseConfigured() ? storageReady() : Promise.resolve(false),
  ]);
  const seoOk = env("SITE_URL").startsWith("https://");
  const [football, config, newMessages, totalMessages, users, accountsTable, paymentsTable, predictionsTable, pushRows, adminSecReady] = settled.map((s) => (s.status === "fulfilled" ? s.value : null));
  const supabaseOk = settled[1].status === "fulfilled" && supabaseConfigured();
  const flag = (name) => !!env(name);
  return {
    version: APP_VERSION,
    deploy: { env: env("VERCEL_ENV") || "local", region: env("VERCEL_REGION") || "", commit: env("VERCEL_GIT_COMMIT_SHA").slice(0, 7) },
    health: [
      { id: "football", label: "Football data API", ok: !!football?.ok, detail: football?.configured === false ? "SCOUTWAVE_FOOTBALL_API_KEY is not set" : football?.ok ? `${football.plan || "plan"} · ${football.used ?? "?"}/${football.limit ?? "?"} requests today` : football?.error || "No answer" },
      { id: "news", label: "News API", ok: flag("NEWS_ACCESS"), detail: flag("NEWS_ACCESS") ? "NEWS_ACCESS is set" : "NEWS_ACCESS is not set" },
      { id: "storage", label: "Database (Supabase)", ok: supabaseOk, detail: !supabaseConfigured() ? "SUPABASE_SERVICE_ROLE_KEY is not set" : supabaseOk ? "Reachable" : "Could not read app_config (did you run supabase/migrations/001_admin.sql?)" },
      { id: "accounts", label: "Account Premium & coins table", ok: accountsTable === true, detail: accountsTable === true ? "Ready" : "Run supabase/migrations/002_entitlements.sql (needed for Premium and coins on accounts)" },
      { id: "payments", label: "Payments (Polar)", ok: paymentsTable === true && flag("POLAR_ACCESS_TOKEN") && flag("POLAR_WEBHOOK_SECRET"), detail: paymentsTable !== true ? "Run supabase/migrations/003_payments.sql" : !flag("POLAR_ACCESS_TOKEN") ? "POLAR_ACCESS_TOKEN is not set" : !flag("POLAR_WEBHOOK_SECRET") ? "POLAR_WEBHOOK_SECRET is not set" : `Ready${env("POLAR_SERVER") === "sandbox" ? " (sandbox mode)" : ""} · ${Object.values(CATALOGUE).filter((c) => env(c.envVar)).length}/${Object.keys(CATALOGUE).length} products linked` },
      { id: "predtrack", label: "Server-side prediction tracking", ok: predictionsTable === true && flag("CRON_SECRET"), detail: predictionsTable !== true ? "Run supabase/migrations/004_predictions.sql" : !flag("CRON_SECRET") ? "CRON_SECRET is not set (the scheduled jobs can't run)" : `Ready · OpenAI notes ${flag("OPENAI_API_KEY") && Number(env("PREDICT_EXPLAIN_MAX")) > 0 ? "on" : "off"} · bookmaker odds ${env("PREDICT_ODDS") === "1" ? "on" : "off"}` },
      { id: "push", label: "Push notifications", ok: Array.isArray(pushRows) && pushConfigured() && flag("CRON_SECRET"), detail: !Array.isArray(pushRows) ? "Run supabase/migrations/005_usage_and_push.sql" : !pushConfigured() ? "Generate keys: node scripts/generate-vapid.mjs, then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT" : !flag("CRON_SECRET") ? "CRON_SECRET is not set" : `Ready · ${pushRows.length} device${pushRows.length === 1 ? "" : "s"} signed up · the alert job must be scheduled every minute (docs/NOTIFICATIONS.md)` },
      { id: "adminsec", label: "Admin sign-in protection", ok: adminSecReady === true && twoFactorConfigured(), detail: !twoFactorConfigured() ? "Two-factor is required: set ADMIN_TOTP_SECRET" : adminSecReady !== true ? "Run supabase/migrations/006_admin_security.sql (lockout and session controls are reduced until then)" : `Two-factor required, database lockout and ${Math.round(idleMs() / 60000)}-minute idle sessions active` },
      { id: "seo", label: "Search engine setup", ok: seoOk, detail: seoOk ? `SITE_URL set${env("GOOGLE_SITE_VERIFICATION") ? "" : " · add GOOGLE_SITE_VERIFICATION to claim the site in Search Console"} · full check on the SEO page` : "Set SITE_URL to your https address so canonical links and sitemaps never use a preview address" },
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

async function listMessages({ status, q: search, offset = 0, limit = 30 }) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100), off = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 1000000);
  let path = `/rest/v1/support_messages?select=*&order=created_at.desc`;
  if (["new", "read", "resolved"].includes(status)) path += `&status=eq.${q.word(status)}`;
  const term = Q.like(search);
  if (term) path += `&or=(message.ilike.${term},email.ilike.${term},name.ilike.${term})`;
  const res = await sb(path, { raw: true, headers: { Prefer: "count=exact", Range: `${off}-${off + lim - 1}`, "Range-Unit": "items" } });
  if (!res.ok && res.status !== 206) throw new HttpError(502, "Could not load messages.");
  return { items: await res.json(), total: countFrom(res), offset: off, limit: lim };
}

async function listUsers({ page = 1 }) {
  const p = Math.min(Math.max(parseInt(page, 10) || 1, 1), 1000);
  const res = await sb(`/auth/v1/admin/users?page=${Q.int(p)}&per_page=50`, { raw: true });
  if (!res.ok) throw new HttpError(502, "Could not load users.");
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.users || [];
  const total = Number(res.headers.get("x-total-count"));
  // Premium and coins for the people on this page (accounts that never opened the app have no row yet).
  let rows = [];
  const ids = list.map((u) => u.id).filter(isUuid);
  if (ids.length) {
    try { rows = await sb(`/rest/v1/entitlements?user_id=in.(${Q.uuids(ids)})&select=*`); } catch { rows = []; }
  }
  const byUser = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.user_id, effective(r)]));
  return {
    page: p, total: Number.isFinite(total) && total > 0 ? total : null,
    users: list.map((u) => ({
      id: u.id, email: u.email || "", createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null,
      confirmed: !!u.email_confirmed_at, providers: u.app_metadata?.providers || [], bannedUntil: u.banned_until || null,
      premium: byUser.get(u.id)?.isVip ?? false, premiumUntil: byUser.get(u.id)?.vipUntil ?? null, coins: byUser.get(u.id)?.coins ?? null,
    })),
  };
}

async function usageOverview() {
  const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const [usage, cache, football] = await Promise.all([
    sb(`/rest/v1/usage_daily?day=gte.${Q.day(since)}&select=day,source,endpoint,calls,errors&limit=5000`),
    sb(`/rest/v1/client_cache_daily?day=gte.${Q.day(since)}&select=*`),
    footballStatus(),
  ]);
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const rows = Array.isArray(usage) ? usage : [];
  const clients = new Map((Array.isArray(cache) ? cache : []).map((r) => [r.day, r]));
  const perDay = days.map((day) => {
    const mine = rows.filter((r) => r.day === day);
    const sum = (source, field = "calls") => mine.filter((r) => r.source === source).reduce((t, r) => t + r[field], 0);
    const c = clients.get(day);
    const answered = c ? Number(c.memory) + Number(c.stored) + Number(c.network) : 0;
    const proxy = sum("proxy");
    return {
      day, proxy, cron: sum("cron"), push: mine.filter((r) => r.source === "push" && !["sent", "failed"].includes(r.endpoint)).reduce((t, r) => t + r.calls, 0),
      errors: mine.filter((r) => r.source !== "push" || !["sent", "failed"].includes(r.endpoint)).reduce((t, r) => t + r.errors, 0),
      pushSent: mine.filter((r) => r.source === "push" && r.endpoint === "sent").reduce((t, r) => t + r.calls, 0),
      pushFailed: mine.filter((r) => r.source === "push" && r.endpoint === "failed").reduce((t, r) => t + r.calls, 0),
      // The app's own caches: share of lookups that never left the device.
      deviceHitRate: answered >= 20 ? (Number(c.memory) + Number(c.stored)) / answered : null,
      lookups: answered,
      // Of the lookups that did go to the server, how many were answered by the shared edge cache instead of the provider.
      // An estimate: only apps that reported are counted.
      edgeHitRate: c && Number(c.network) >= 20 ? Math.max(0, Math.min(1, 1 - proxy / Number(c.network))) : null,
    };
  });
  const byEndpoint = new Map();
  for (const r of rows) if (r.source !== "push" || !["sent", "failed"].includes(r.endpoint)) byEndpoint.set(r.endpoint, (byEndpoint.get(r.endpoint) || 0) + r.calls);
  const total = (field) => perDay.reduce((t, d) => t + d[field], 0);
  const lookups = total("lookups");
  const deviceHits = [...clients.values()].reduce((t, c) => t + Number(c.memory) + Number(c.stored), 0);
  return {
    days: perDay,
    endpoints: [...byEndpoint.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([endpoint, calls]) => ({ endpoint, calls })),
    totals: { calls14d: total("proxy") + total("cron") + total("push"), deviceHitRate14d: lookups ? deviceHits / lookups : null, pushSent14d: total("pushSent") },
    quota: football?.ok ? { used: football.used, limit: football.limit } : null,
  };
}

const LOGIN_EVENTS = ["login", "login.failed", "login.locked", "login.replayed_code", "session.rejected", "session.ip_changed", "sessions.revoke_all", "session.revoked"];

// Pages checked by the SEO audit when none are typed in: the home page, hubs, and one of each kind that has data.
const SEO_SAMPLE = ["/", "/leagues", "/news", "/league/39-premier-league", "/club/33-manchester-united", "/club/33", "/this-page-does-not-exist"];

async function seoAudit(paths, origin) {
  const results = [];
  for (const path of paths) {
    const { status, headers, html } = await renderPage(path, origin);
    if (status === 301) { results.push({ path, status, redirect: headers.Location.replace(origin, ""), issues: [] }); continue; }
    const indexable = status === 200 && !/^\/(auth|profile|favorites|edit-profile|change-password|notifications|report-issue|language|appearance|feedback|themes|premium|coins|avatar)(\/|$)/.test(path);
    const a = auditHtml(html, { canonical: status === 200 ? origin + (path === "/" ? "/" : path) : "", indexable });
    // A 404 is correct for an address that isn't a page; flag it only if it should have been one.
    const issues = status === 404 ? (isKnownPath(path) ? [{ level: "warn", code: "not-found", message: "Answered 404: the thing was not found at the football data provider." }] : []) : a.issues;
    results.push({ path, status, title: a.title, description: a.description, h1s: a.h1s, links: a.links, types: a.types, textLength: a.textLength, cache: headers["Cache-Control"], issues });
  }
  return results;
}

// Views, clicks and click rate for the ad / promotion spaces: last 30 days, per day, per space, per campaign.
export async function placementsReport() {
  const config = await readConfig({ fresh: true });
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  let rows;
  try { rows = await sb(`/rest/v1/placement_stats?day=gte.${Q.day(since)}&select=day,slot,campaign,event,n&limit=5000`); }
  catch { return { ready: false }; } // the table doesn't exist yet (migration 007)
  rows = Array.isArray(rows) ? rows : [];
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const perDay = days.map((day) => ({ day, views: rows.filter((r) => r.day === day && r.event === "view").reduce((t, r) => t + r.n, 0), clicks: rows.filter((r) => r.day === day && r.event === "click").reduce((t, r) => t + r.n, 0) }));
  const sum = (list, event) => list.filter((r) => r.event === event).reduce((t, r) => t + r.n, 0);
  const slots = PLACEMENT_SLOTS.map((slot) => {
    const p = config.placements?.[slot] || {};
    const mine = rows.filter((r) => r.slot === slot);
    const campaigns = [...new Set(mine.map((r) => r.campaign))].map((campaign) => {
      const list = mine.filter((r) => r.campaign === campaign), views = sum(list, "view"), clicks = sum(list, "click");
      const current = p.campaign === campaign;
      return { campaign, current, title: current ? p.title : "Earlier campaign", views, clicks, ctr: ctr(views, clicks) };
    }).sort((a, b) => b.views - a.views);
    const views = sum(mine, "view"), clicks = sum(mine, "click");
    return { slot, headline: p.title || "", ...placementState(p), startsAt: p.startsAt || "", endsAt: p.endsAt || "", views, clicks, ctr: ctr(views, clicks), campaigns };
  });
  const views = sum(rows, "view"), clicks = sum(rows, "click");
  return { ready: true, days: perDay, slots, totals: { views, clicks, ctr: ctr(views, clicks) } };
}

const ACTIONS = {
  placements_report: async () => placementsReport(),
  seo_audit: async (body, ctx) => {
    const typed = (Array.isArray(body.paths) ? body.paths : []).map((p) => String(p || "").trim()).filter((p) => /^\/[A-Za-z0-9/_\-.%]{0,119}$/.test(p)).slice(0, 8);
    const origin = ctx.origin;
    const site = {
      origin,
      siteUrlSet: env("SITE_URL") !== "", https: origin.startsWith("https://"),
      googleVerification: env("GOOGLE_SITE_VERIFICATION") !== "", bingVerification: env("BING_SITE_VERIFICATION") !== "",
      twitterSite: env("TWITTER_SITE") !== "", clubsInSitemap: env("SITEMAP_CLUBS") === "1",
      aiCrawlers: ["block", "training-only"].includes(env("AI_CRAWLERS")) ? env("AI_CRAWLERS") : "allow",
      footballApi: env("SCOUTWAVE_FOOTBALL_API_KEY") !== "", newsApi: env("NEWS_ACCESS") !== "",
      crawlerCallsToday: await spentToday(), crawlerCallsCap: seoCap(),
    };
    // Looking at the settings is free; checking pages costs football API requests (counted against the crawler cap), so it only runs on request.
    const pages = body.siteOnly ? [] : await seoAudit(typed.length ? typed : SEO_SAMPLE, origin);
    if (!body.siteOnly) await audit(ctx.actor, "seo.audit", { pages: pages.length }, ctx.ip);
    return { site, pages };
  },
  security_overview: async (body, ctx) => {
    const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const cspRows = await sb(`/rest/v1/usage_daily?source=eq.csp&day=gte.${Q.day(since)}&select=endpoint,calls&limit=200`).catch(() => []);
    const csp = {};
    for (const r of Array.isArray(cspRows) ? cspRows : []) csp[r.endpoint] = (csp[r.endpoint] || 0) + r.calls;
    const [ready, sessions, events] = await Promise.all([
      storageReady(),
      listSessions(ctx.token.jti).catch(() => []),
      sb(`/rest/v1/admin_audit?action=in.(${Q.words(LOGIN_EVENTS)})&select=at,action,detail,ip&order=at.desc&limit=25`).catch(() => []),
    ]);
    return { csp, twoFactor: twoFactorConfigured(), protectionsActive: ready, degradedSession: !!ctx.token.deg, idleMinutes: Math.round(idleMs() / 60000), bindIp: env("ADMIN_BIND_IP") === "1", sessions, events: Array.isArray(events) ? events : [] };
  },
  session_revoke: async (body, ctx) => {
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Bad request");
    await revokeSession(id, "manual");
    await audit(ctx.actor, "session.revoked", { current: id === ctx.token.jti }, ctx.ip);
    return { ok: true };
  },
  sessions_revoke_all: async (body, ctx) => {
    await revokeAll();
    await audit(ctx.actor, "sessions.revoke_all", {}, ctx.ip);
    return { ok: true };
  },
  logout: async (body, ctx) => {
    if (ctx.token.jti && !ctx.token.deg) await revokeSession(ctx.token.jti, "logout");
    return { ok: true };
  },
  usage_overview: async () => usageOverview(),
  predictions_overview: async () => adminReport(),
  predictions_run: async (body, ctx) => {
    if (!["predict", "grade"].includes(body.task)) throw new HttpError(400, "Unknown job.");
    const result = body.task === "predict" ? await runPredict() : await runGrade();
    await audit(ctx.actor, "predictions.run", { task: body.task, ...result }, ctx.ip);
    return { result };
  },
  benchmark_import: async (body, ctx) => {
    const text = String(body.text || "");
    if (text.length > 60000) throw new HttpError(400, "That is too much at once (up to 300 lines).");
    const result = await importForebet(text);
    await audit(ctx.actor, "benchmark.import", { saved: result.saved, late: result.late, problems: result.problems.length }, ctx.ip);
    return result;
  },
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
    await sb(`/rest/v1/support_messages?id=eq.${Q.int(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: patch });
    await audit(ctx.actor, "message.update", { id, ...patch }, ctx.ip);
    return { ok: true };
  },
  message_delete: async (body, ctx) => {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Bad message id.");
    await sb(`/rest/v1/support_messages?id=eq.${Q.int(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await audit(ctx.actor, "message.delete", { id }, ctx.ip);
    return { ok: true };
  },
  users_list: async (body) => listUsers(body),
  user_ban: async (body, ctx) => {
    if (!UUID.test(String(body.id))) throw new HttpError(400, "Bad user id.");
    const hours = body.permanent ? 876000 : Math.min(Math.max(parseInt(body.hours, 10) || 24, 1), 87600);
    await sb(`/auth/v1/admin/users/${Q.uuid(body.id)}`, { method: "PUT", body: { ban_duration: `${hours}h` } });
    await audit(ctx.actor, "user.ban", { id: body.id, hours }, ctx.ip);
    return { ok: true };
  },
  entitlement_set: async (body, ctx) => {
    if (!isUuid(String(body.id))) throw new HttpError(400, "Bad user id.");
    const { before, after } = await adminSet(body.id, body, ctx.actor);
    await audit(ctx.actor, "entitlement.update", {
      id: body.id, reason: String(body.reason).slice(0, 200),
      premium: { from: effective(before).isVip, to: effective(after).isVip, until: effective(after).vipUntil },
      coins: { from: before.coins, to: after.coins },
    }, ctx.ip);
    return { entitlements: effective(after) };
  },
  user_unban: async (body, ctx) => {
    if (!UUID.test(String(body.id))) throw new HttpError(400, "Bad user id.");
    await sb(`/auth/v1/admin/users/${Q.uuid(body.id)}`, { method: "PUT", body: { ban_duration: "none" } });
    await audit(ctx.actor, "user.unban", { id: body.id }, ctx.ip);
    return { ok: true };
  },
  audit_list: async (body) => {
    const lim = Math.min(Math.max(parseInt(body.limit, 10) || 100, 1), 300);
    return { items: await sb(`/rest/v1/admin_audit?select=*&order=at.desc&limit=${Q.int(lim)}`) };
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
  // Two-factor is required, never optional: without it nobody can sign in.
  if (!twoFactorConfigured()) {
    return res.status(503).json({ error: "Two-factor sign-in is required. Run node scripts/admin-setup.mjs, add ADMIN_TOTP_SECRET in Vercel, then redeploy. See docs/ADMIN.md.", code: "NOT_CONFIGURED" });
  }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  if (!body || typeof body.action !== "string") return res.status(400).json({ error: "Bad request" });
  const ip = clientIp(req);

  try {
    if (body.action === "login") {
      // The dashboard probes with an empty login to learn whether the area is configured: not a failed attempt.
      if (!body.password) return res.status(400).json({ error: "Enter your passphrase." });
      const lock = await lockStatus(ip);
      if (lock.seconds) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(lock.seconds / 60)} minute(s).`, retryAfter: lock.seconds });
      const { ok: factorsOk, step } = checkFactors({ email: body.email, password: body.password, code: body.code });
      let ok = factorsOk, degraded = lock.degraded, replay = false;
      if (ok) {
        // Every authenticator code works once: burning the step makes a seen code useless.
        const used = await consumeTotp(step);
        degraded = degraded || used.degraded;
        if (!used.ok) { ok = false; replay = true; }
      }
      if (!ok) {
        const fail = await recordFailure(ip);
        if (fail.fails === 1 || fail.lockedSeconds) await audit("admin", fail.lockedSeconds ? "login.locked" : replay ? "login.replayed_code" : "login.failed", { lockedMinutes: Math.ceil(fail.lockedSeconds / 60) || 0 }, ip);
        await sleep(400 + Math.floor(Math.random() * 300)); // slow down guessing
        return res.status(401).json({ error: replay ? "That code was already used. Wait for the next one." : "Those details are not right." });
      }
      await recordSuccess(ip);
      const now = Date.now();
      req.__ip = ip;
      const session = await createSession(req, { now, ttl: TOKEN_TTL_MS });
      degraded = degraded || session.degraded;
      const token = signToken({ sub: "admin", iat: now, exp: now + TOKEN_TTL_MS, jti: session.id, ...(session.degraded ? { deg: 1 } : {}) });
      await audit("admin", "login", { degraded }, ip);
      return res.status(200).json({ token, expiresAt: now + TOKEN_TTL_MS, idleMinutes: Math.round(idleMs() / 60000), degraded, version: APP_VERSION });
    }

    const header = String(req.headers?.authorization || "");
    const parsed = verifyToken(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (!parsed) return res.status(401).json({ error: "Your session has ended. Sign in again.", code: "SESSION" });
    const live = await checkSession(parsed, req, ip);
    if (!live.ok) {
      if (live.reason === "device" || live.reason === "network") await audit("admin", "session.rejected", { reason: live.reason }, ip);
      return res.status(401).json({ error: reasonText(live.reason), code: "SESSION" });
    }
    if (live.ipChanged) await audit("admin", "session.ip_changed", { from: live.from }, ip);

    const run = Object.prototype.hasOwnProperty.call(ACTIONS, body.action) ? ACTIONS[body.action] : null;
    if (!run) return res.status(400).json({ error: "Unknown action" });
    const result = await run(body, { actor: "admin", ip, token: parsed, origin: siteOrigin(req) });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error("admin error:", error?.message || error);
    return res.status(500).json({ error: "Something went wrong on the server." });
  }
}
