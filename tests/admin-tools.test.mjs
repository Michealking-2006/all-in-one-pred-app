// Run with:  node tests/admin-tools.test.mjs   (no network: Supabase and the push service are faked)
import assert from "node:assert/strict";
import fs from "node:fs";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", SUPABASE_URL: "https://x.supabase.co", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 86400000, iso = (offset) => new Date(NOW + offset).toISOString();
const db = {
  users: [
    { id: "00000000-0000-4000-8000-000000000001", email: "ann@example.com", created_at: iso(-1 * DAY), last_sign_in_at: iso(-3600000), email_confirmed_at: iso(-DAY), app_metadata: { providers: ["google"] } },
    { id: "00000000-0000-4000-8000-000000000002", email: "bob@example.com", created_at: iso(-5 * DAY), last_sign_in_at: iso(-3 * DAY), email_confirmed_at: iso(-5 * DAY), app_metadata: { providers: ["email"] } },
    { id: "00000000-0000-4000-8000-000000000003", email: "cy@example.org", created_at: iso(-40 * DAY), last_sign_in_at: iso(-35 * DAY), email_confirmed_at: iso(-40 * DAY), banned_until: iso(5 * DAY), app_metadata: { providers: ["email"] } },
    { id: "00000000-0000-4000-8000-000000000004", email: "dee@example.com", created_at: iso(-2 * DAY), last_sign_in_at: null, email_confirmed_at: null, app_metadata: { providers: ["email"] } },
  ],
  entitlements: [{ user_id: "00000000-0000-4000-8000-000000000001", is_vip: true, vip_until: null, coins: 40 }, { user_id: "00000000-0000-4000-8000-000000000002", is_vip: true, vip_until: iso(-DAY), coins: 8 }],
  messages: [
    { created_at: iso(-DAY), status: "new", rating: 5, kind: "feedback" }, { created_at: iso(-DAY), status: "read", rating: 3, kind: "feedback" },
    { created_at: iso(-10 * DAY), status: "resolved", rating: null, kind: "contact" },
  ],
  predictions: [
    { kickoff: iso(3600000), league_name: "Premier League", status: "pending" }, { kickoff: iso(2 * DAY), league_name: "Premier League", status: "pending" },
    { kickoff: iso(2 * DAY), league_name: "La Liga", status: "pending" }, { kickoff: iso(-3 * DAY), league_name: "La Liga", status: "graded" },
  ],
  push: [
    { endpoint: "https://push/1", p256dh: "a", auth: "b", prefs: { goals: true, kickoff: true }, fail_count: 0, user_id: "00000000-0000-4000-8000-000000000001" },
    { endpoint: "https://push/2", p256dh: "a", auth: "b", prefs: { whistles: true }, fail_count: 2, user_id: null },
    { endpoint: "https://push/3", p256dh: "a", auth: "b", prefs: { goals: true }, fail_count: 0, user_id: null },
  ],
  audit: [], cache: [{ key: "a" }, { key: "b" }], usage: [], predictionsDown: false, deleted: [],
};
const json = (d, s = 200, h = {}) => new Response(s === 204 ? null : JSON.stringify(d), { status: s, headers: h });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const t = u.pathname.split("/").pop(); const m = init.method || "GET";
  if (u.pathname.startsWith("/auth/v1/admin/users")) return json({ users: db.users }, 200, { "x-total-count": String(db.users.length) });
  if (t === "bump_usage") { db.usage.push(JSON.parse(init.body)); return json(null, 204); }
  if (t === "entitlements") return json(db.entitlements);
  if (t === "support_messages") { if (m === "PATCH") { const r = db.messages.filter((x) => x.status === "new"); r.forEach((x) => (x.status = "read")); return json(r); } return json(db.messages); }
  if (t === "predictions") return db.predictionsDown ? json({ message: "relation does not exist" }, 404) : json(db.predictions);
  if (t === "push_subscriptions") { if (m === "DELETE") { db.deleted.push(decodeURIComponent(u.searchParams.get("endpoint").slice(3))); return json(null, 204); } return json(db.push); }
  if (t === "admin_audit") return json(db.audit);
  if (t === "api_cache") return json(db.cache);
  return json({}, 404);
};
const mod = await import("../api/_insights.js");

await test("insights: audience, feedback, prediction coverage and push, from what the database holds", async () => {
  const r = await mod.insightsReport({ now: NOW });
  assert.equal(r.users.total, 4); assert.equal(r.users.new7, 3); assert.equal(r.users.new30, 3);
  assert.equal(r.users.active1, 1); assert.equal(r.users.active7, 2); assert.equal(r.users.active30, 2);
  assert.deepEqual(r.users.lastSeen, { today: 1, week: 1, month: 0, older: 1, never: 1 });
  assert.equal(r.users.premium, 1, "an expired grant is not premium");
  assert.equal(r.users.coins, 48); assert.equal(r.users.banned, 1); assert.equal(r.users.unconfirmed, 1);
  assert.deepEqual(r.users.providers, { google: 1, email: 3 });
  assert.equal(r.users.signups.length, 30); assert.equal(r.users.signups.at(-1).day, "2026-10-20");
  assert.equal(r.messages.total, 3); assert.deepEqual(r.messages.status, { new: 1, read: 1, resolved: 1 }); assert.equal(r.messages.avgRating, 4);
  assert.equal(r.predictions.upcomingTotal, 3); assert.equal(r.predictions.upcoming.length, 7);
  assert.equal(r.predictions.upcoming[0].predictions, 1); assert.equal(r.predictions.upcoming[2].predictions, 2);
  assert.equal(r.predictions.topLeagues[0].league, "Premier League");
  assert.deepEqual(r.push, { devices: 3, signedIn: 1, goals: 2, kickoff: 1, whistles: 1, failing: 1, configured: false });
});
await test("insights: one missing table leaves the other sections intact", async () => {
  db.predictionsDown = true;
  const r = await mod.insightsReport({ now: NOW });
  db.predictionsDown = false;
  assert.equal(r.predictions, null); assert.equal(r.users.total, 4); assert.equal(r.push.devices, 3);
});
await test("users: search, filters and paging", async () => {
  const all = await mod.searchUsers({ now: NOW });
  assert.equal(all.total, 4); assert.equal(all.users[0].email, "ann@example.com", "newest first");
  assert.deepEqual((await mod.searchUsers({ q: "EXAMPLE.ORG", now: NOW })).users.map((u) => u.email), ["cy@example.org"]);
  assert.deepEqual((await mod.searchUsers({ filter: "premium", now: NOW })).users.map((u) => u.email), ["ann@example.com"]);
  assert.deepEqual((await mod.searchUsers({ filter: "banned", now: NOW })).users.map((u) => u.email), ["cy@example.org"]);
  assert.deepEqual((await mod.searchUsers({ filter: "inactive", now: NOW })).users.map((u) => u.email).sort(), ["cy@example.org", "dee@example.com"]);
  assert.deepEqual((await mod.searchUsers({ filter: "unconfirmed", now: NOW })).users.map((u) => u.email), ["dee@example.com"]);
  assert.equal((await mod.searchUsers({ page: 2, now: NOW })).users.length, 0);
  await assert.rejects(mod.searchUsers({ filter: "everyone" }), /Unknown filter/);
  const csv = await mod.exportUsers({ filter: "premium", now: NOW });
  assert.equal(csv.total, 1);
});
await test("broadcast: the text and the link are checked", () => {
  assert.deepEqual(mod.checkBroadcast({ title: " Hi ", body: "Body", url: "" }), { title: "Hi", body: "Body", url: "/" });
  assert.equal(mod.checkBroadcast({ title: "T", body: "B", url: "/news?x=1" }).url, "/news?x=1");
  for (const url of ["//evil.com", "https://evil.com", "javascript:alert(1)", "news", "/a b", "/" + "a".repeat(250)]) assert.throws(() => mod.checkBroadcast({ title: "T", body: "B", url }), /link/, url);
  assert.throws(() => mod.checkBroadcast({ title: "", body: "B" }), /title/);
  assert.throws(() => mod.checkBroadcast({ title: "x".repeat(61), body: "B" }), /title/);
  assert.throws(() => mod.checkBroadcast({ title: "T", body: "x".repeat(141) }), /message/);
});
await test("broadcast: reaches the chosen devices, drops dead ones, counts, and waits ten minutes between sends", async () => {
  assert.equal((await mod.broadcastPreview({ audience: "goals" })).count, 2);
  assert.equal((await mod.broadcastPreview({ audience: "signed_in" })).count, 1);
  await assert.rejects(mod.broadcastPreview({ audience: "nobody" }), /Choose who/);
  const got = [];
  const sender = async (sub, msg) => { got.push([sub.endpoint, msg]); if (sub.endpoint === "https://push/3") { const e = new Error("gone"); e.statusCode = 410; throw e; } };
  const out = await mod.broadcastSend({ audience: "goals", title: "Hello", body: "News from the team", url: "/news" }, { now: NOW, sender });
  assert.deepEqual([out.sent, out.failed, out.removed], [1, 1, 1]);
  assert.equal(got.length, 2); assert.equal(got[0][1].type, "announce"); assert.equal(got[0][1].url, "/news"); assert.ok(got[0][1].tag.startsWith("announce-"));
  assert.deepEqual(db.deleted, ["https://push/3"]);
  assert.ok(db.usage.some((u) => u.p_source === "push" && u.p_endpoint === "sent" && u.p_calls === 1));
  db.audit.push({ at: iso(-60000) });
  await assert.rejects(mod.broadcastSend({ audience: "all", title: "Again", body: "Too soon" }, { now: NOW, sender }), /Wait ten minutes/);
  db.audit.length = 0;
  await assert.rejects(mod.broadcastSend({ audience: "all", title: "T", body: "B" }, { now: NOW }), /unavailable/);
});
await test("maintenance: clearing saved data and marking messages read", async () => {
  assert.deepEqual(await mod.purgeCache({ scope: "old", now: NOW }), { removed: 2, scope: "old" });
  await assert.rejects(mod.purgeCache({ scope: "some" }), /Choose what/);
  assert.equal((await mod.markAllRead()).updated, 1);
});
await test("the service worker always shows an announcement, but keeps match alerts quiet while the app is open", () => {
  const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /data\.type !== "announce" && windows\.some/);
});
console.log(`\n${passed} passed`);
