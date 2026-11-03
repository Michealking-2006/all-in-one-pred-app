// Admin tools behind the dashboard's Insights, Users, Broadcast and maintenance cards.
// The leading underscore keeps Vercel from exposing this file as a route.
//
// Everything here is read through the same service-role helper as the rest of the admin API. Each part of the
// insights report is fetched on its own and may come back null (for example when an optional table has not been
// created yet): one missing table never blanks the whole page.
import { sb, HttpError } from "./_admin.js";
import { effective } from "./_account.js";
import { q } from "./_query.js";
import { recordUsage } from "./_usage.js";
import { makeSender, pushConfigured } from "./_push.js";
import { MODEL_VERSION } from "../src/predictions/model.js";

const DAY = 86400000;
const PAGE = 1000, MAX_PAGES = 5; // up to 5,000 accounts are scanned for search, export and insights
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const lastDays = (n, now) => Array.from({ length: n }, (_, i) => dayOf(now - (n - 1 - i) * DAY));
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const isBanned = (u, now) => !!u.bannedUntil && new Date(u.bannedUntil).getTime() > now;

// ---------------------------------------------------------------- users
export async function loadUsers({ now = Date.now() } = {}) {
  const list = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await sb(`/auth/v1/admin/users?page=${q.int(page)}&per_page=${q.int(PAGE)}`, { raw: true });
    if (!res.ok) throw new HttpError(502, "Could not load users.");
    const data = await res.json();
    const part = Array.isArray(data) ? data : data.users || [];
    list.push(...part);
    if (part.length < PAGE) break;
  }
  const rows = await safe(() => sb(`/rest/v1/entitlements?select=*&limit=${q.int(PAGE * MAX_PAGES)}`));
  const byUser = new Map((Array.isArray(rows) ? rows : []).map((r) => [r.user_id, effective(r, now)]));
  return list.map((u) => ({
    id: u.id, email: u.email || "", createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null,
    confirmed: !!u.email_confirmed_at, providers: u.app_metadata?.providers || [], bannedUntil: u.banned_until || null,
    premium: byUser.get(u.id)?.isVip ?? false, premiumUntil: byUser.get(u.id)?.vipUntil ?? null, coins: byUser.get(u.id)?.coins ?? null,
  }));
}

export const USER_FILTERS = ["all", "premium", "banned", "inactive", "unconfirmed"];

function matchUsers(users, { q: text = "", filter = "all", now = Date.now() }) {
  const term = String(text || "").trim().toLowerCase().slice(0, 100);
  const keep = (u) => {
    if (term && !u.email.toLowerCase().includes(term) && !String(u.id).startsWith(term)) return false;
    if (filter === "premium") return u.premium;
    if (filter === "banned") return isBanned(u, now);
    if (filter === "inactive") return !u.lastSignInAt || now - new Date(u.lastSignInAt).getTime() > 30 * DAY;
    if (filter === "unconfirmed") return !u.confirmed;
    return true;
  };
  return users.filter(keep).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function searchUsers({ q: text, filter = "all", page = 1, now = Date.now() } = {}) {
  if (!USER_FILTERS.includes(filter)) throw new HttpError(400, "Unknown filter.");
  const p = Math.min(Math.max(parseInt(page, 10) || 1, 1), 100);
  const users = await loadUsers({ now });
  const hits = matchUsers(users, { q: text, filter, now });
  return { page: p, perPage: 50, total: hits.length, scanned: users.length, capped: users.length >= PAGE * MAX_PAGES, users: hits.slice((p - 1) * 50, p * 50) };
}

export async function exportUsers({ q: text, filter = "all", now = Date.now() } = {}) {
  if (!USER_FILTERS.includes(filter)) throw new HttpError(400, "Unknown filter.");
  const users = await loadUsers({ now });
  const hits = matchUsers(users, { q: text, filter, now });
  return { total: hits.length, capped: users.length >= PAGE * MAX_PAGES, users: hits };
}

// ---------------------------------------------------------------- insights
export async function insightsReport({ now = Date.now() } = {}) {
  const days30 = lastDays(30, now);
  const [users, messages, upcoming, pipeline, push] = await Promise.all([
    safe(() => loadUsers({ now })),
    safe(() => sb(`/rest/v1/support_messages?created_at=gte.${q.iso(now - 29 * DAY)}&select=created_at,status,rating,kind&limit=5000`)),
    safe(() => sb(`/rest/v1/predictions?model=eq.${q.word(MODEL_VERSION)}&kickoff=gte.${q.iso(now)}&select=kickoff,league_name&limit=5000`)),
    safe(() => sb(`/rest/v1/predictions?model=eq.${q.word(MODEL_VERSION)}&select=status&order=made_at.desc&limit=5000`)),
    safe(() => sb("/rest/v1/push_subscriptions?select=user_id,prefs,fail_count&limit=5000")),
  ]);
  const report = { generatedAt: new Date(now).toISOString(), days: days30, users: null, messages: null, predictions: null, push: null };

  if (Array.isArray(users)) {
    const signups = new Map(days30.map((d) => [d, 0]));
    const seen = { today: 0, week: 0, month: 0, older: 0, never: 0 };
    const providers = {};
    let premium = 0, coins = 0, unconfirmed = 0, banned = 0;
    for (const u of users) {
      const made = dayOf(u.createdAt || 0);
      if (signups.has(made)) signups.set(made, signups.get(made) + 1);
      const age = u.lastSignInAt ? now - new Date(u.lastSignInAt).getTime() : null;
      if (age == null) seen.never++; else if (age < DAY) seen.today++; else if (age < 7 * DAY) seen.week++; else if (age < 30 * DAY) seen.month++; else seen.older++;
      for (const p of u.providers.length ? u.providers : ["email"]) providers[p] = (providers[p] || 0) + 1;
      if (u.premium) premium++;
      if (typeof u.coins === "number") coins += u.coins;
      if (!u.confirmed) unconfirmed++;
      if (isBanned(u, now)) banned++;
    }
    const perDay = days30.map((day) => ({ day, signups: signups.get(day) }));
    const sum = (n) => perDay.slice(-n).reduce((t, d) => t + d.signups, 0);
    report.users = {
      total: users.length, capped: users.length >= PAGE * MAX_PAGES, signups: perDay, new7: sum(7), new30: sum(30),
      active1: seen.today, active7: seen.today + seen.week, active30: seen.today + seen.week + seen.month,
      lastSeen: seen, providers, premium, coins, unconfirmed, banned,
    };
  }

  if (Array.isArray(messages)) {
    const per = new Map(days30.map((d) => [d, 0]));
    const status = { new: 0, read: 0, resolved: 0 }, kinds = {};
    let stars = 0, rated = 0;
    for (const m of messages) {
      const d = dayOf(m.created_at);
      if (per.has(d)) per.set(d, per.get(d) + 1);
      if (m.status in status) status[m.status]++;
      kinds[m.kind || "contact"] = (kinds[m.kind || "contact"] || 0) + 1;
      if (Number.isFinite(m.rating) && m.rating > 0) { stars += m.rating; rated++; }
    }
    report.messages = { perDay: days30.map((day) => ({ day, messages: per.get(day) })), total: messages.length, status, kinds, avgRating: rated ? Math.round((stars / rated) * 10) / 10 : null, rated };
  }

  if (Array.isArray(upcoming) || Array.isArray(pipeline)) {
    const next = lastDays(7, now + 6 * DAY); // today .. today+6
    const byDay = new Map(next.map((d) => [d, 0])), leagues = {};
    for (const r of Array.isArray(upcoming) ? upcoming : []) {
      const d = dayOf(r.kickoff);
      if (byDay.has(d)) byDay.set(d, byDay.get(d) + 1);
      leagues[r.league_name] = (leagues[r.league_name] || 0) + 1;
    }
    const status = { pending: 0, graded: 0, void: 0 };
    for (const r of Array.isArray(pipeline) ? pipeline : []) if (r.status in status) status[r.status]++;
    report.predictions = {
      model: MODEL_VERSION, upcoming: next.map((day) => ({ day, predictions: byDay.get(day) })), upcomingTotal: [...byDay.values()].reduce((t, n) => t + n, 0),
      topLeagues: Object.entries(leagues).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([league, count]) => ({ league, count })), status,
    };
  }

  if (Array.isArray(push)) {
    const prefs = (s, k) => (s.prefs || {})[k] === true;
    report.push = {
      devices: push.length, signedIn: push.filter((s) => s.user_id).length,
      goals: push.filter((s) => prefs(s, "goals")).length, kickoff: push.filter((s) => prefs(s, "kickoff")).length, whistles: push.filter((s) => prefs(s, "whistles")).length,
      failing: push.filter((s) => (s.fail_count || 0) > 0).length, configured: pushConfigured(),
    };
  }
  return report;
}

// ---------------------------------------------------------------- broadcast
export const AUDIENCES = {
  all: "Every device with alerts on",
  goals: "Devices that get goal alerts",
  kickoff: "Devices that get kick-off alerts",
  whistles: "Devices that get half-time and full-time alerts",
  signed_in: "Devices of signed-in users",
};
const MAX_SENDS = 2000, COOLDOWN_MS = 10 * 60000;

async function recipients(kind) {
  if (!Object.prototype.hasOwnProperty.call(AUDIENCES, kind)) throw new HttpError(400, "Choose who should get this.");
  const subs = await sb(`/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,prefs,fail_count,user_id&limit=${q.int(MAX_SENDS)}`);
  const list = Array.isArray(subs) ? subs : [];
  const has = (s, k) => (s.prefs || {})[k] === true;
  if (kind === "goals") return list.filter((s) => has(s, "goals"));
  if (kind === "kickoff") return list.filter((s) => has(s, "kickoff"));
  if (kind === "whistles") return list.filter((s) => has(s, "whistles"));
  if (kind === "signed_in") return list.filter((s) => s.user_id);
  return list;
}

export async function broadcastPreview({ audience = "all" } = {}) {
  const list = await recipients(audience);
  return { count: list.length, configured: pushConfigured(), audiences: AUDIENCES };
}

export function checkBroadcast(input) {
  const title = String(input?.title ?? "").trim(), body = String(input?.body ?? "").trim();
  let url = String(input?.url ?? "").trim() || "/";
  if (!title || title.length > 60) throw new HttpError(400, "The title needs 1 to 60 characters.");
  if (!body || body.length > 140) throw new HttpError(400, "The message needs 1 to 140 characters.");
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/.test(url) || url.length > 200) throw new HttpError(400, "The link must be a page of the app, like /news.");
  return { title, body, url };
}

export async function broadcastSend(input, { now = Date.now(), sender } = {}) {
  const { title, body, url } = checkBroadcast(input);
  const list = await recipients(input.audience || "all");
  if (!list.length) throw new HttpError(400, "Nobody would receive this: no devices match.");
  if (!sender && !pushConfigured()) throw new HttpError(503, "Alerts are unavailable right now.");
  // One broadcast every ten minutes: a slip of the finger can't spam everybody twice.
  const recent = await safe(() => sb(`/rest/v1/admin_audit?action=eq.broadcast.send&at=gte.${q.iso(now - COOLDOWN_MS)}&select=at&limit=1`));
  if (Array.isArray(recent) && recent.length) throw new HttpError(429, "A broadcast went out a few minutes ago. Wait ten minutes between broadcasts.");
  const send = sender || (await makeSender());
  const msg = { type: "announce", title, body, tag: `announce-${now}`, url };
  const dead = new Set();
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async (sub) => {
      try { await send(sub, msg); sent++; }
      catch (error) { failed++; if (error?.statusCode === 404 || error?.statusCode === 410) dead.add(sub.endpoint); }
    }));
  }
  for (const endpoint of dead) await sb(`/rest/v1/push_subscriptions?endpoint=eq.${q.text(endpoint)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
  await recordUsage("push", "sent", sent, 0);
  if (failed) await recordUsage("push", "failed", failed, 0);
  return { sent, failed, removed: dead.size, audience: input.audience || "all", title, body, url };
}

// ---------------------------------------------------------------- maintenance
// Saved football answers (league tables, season results, day lists) are reused by the prediction jobs.
// "old" drops what is more than six hours old; "all" drops everything so the next run fetches fresh data.
export async function purgeCache({ scope = "old", now = Date.now() } = {}) {
  if (!["old", "all"].includes(scope)) throw new HttpError(400, "Choose what to clear.");
  const cutoff = scope === "all" ? now + DAY : now - 6 * 3600000;
  let rows;
  try { rows = await sb(`/rest/v1/api_cache?fetched_at=lt.${q.iso(cutoff)}&select=key`, { method: "DELETE", headers: { Prefer: "return=representation" } }); }
  catch { throw new HttpError(502, "Saved football data can't be cleared right now."); }
  return { removed: Array.isArray(rows) ? rows.length : 0, scope };
}

export async function markAllRead() {
  const rows = await sb("/rest/v1/support_messages?status=eq.new&select=id", { method: "PATCH", headers: { Prefer: "return=representation" }, body: { status: "read" } });
  return { updated: Array.isArray(rows) ? rows.length : 0 };
}

