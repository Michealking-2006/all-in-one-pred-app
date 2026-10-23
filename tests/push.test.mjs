// Run with:  node tests/push.test.mjs   (no network: football API, Supabase and the push service are faked)
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", SCOUTWAVE_FOOTBALL_API_KEY: "f", VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.c" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const db = { push_subscriptions: [], push_fixture_state: [], usage: [] };
let live = [], finished = [], quota = { current: 10, limit_day: 1000 }, footballCalls = [];
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
const fx = (id, status, elapsed, gh, ga, home = [1, "Reds"], away = [2, "Blues"]) => ({ fixture: { id, status: { short: status, elapsed } }, goals: { home: gh, away: ga }, teams: { home: { id: home[0], name: home[1] }, away: { id: away[0], name: away[1] } } });

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || "GET"; const b = init.body ? JSON.parse(init.body) : null;
  if (u.host === "v3.football.api-sports.io") {
    if (u.pathname === "/status") return json({ response: { requests: { current: quota.current, limit_day: quota.limit_day } } });
    footballCalls.push(u.search);
    if (u.searchParams.get("live")) return json({ response: live, errors: [] });
    if (u.searchParams.get("ids")) return json({ response: finished, errors: [] });
  }
  if (u.host.endsWith("supabase.co")) {
    const t = u.pathname.split("/").pop();
    if (t === "bump_usage") { db.usage.push(b); return json(null, 204); }
    if (t === "push_subscriptions") {
      if (method === "GET") return json(db.push_subscriptions);
      if (method === "DELETE") { db.push_subscriptions = db.push_subscriptions.filter((s) => !u.search.includes(encodeURIComponent(s.endpoint))); return json(null, 204); }
      if (method === "PATCH") { const s = db.push_subscriptions.find((x) => u.search.includes(encodeURIComponent(x.endpoint))); Object.assign(s, b); return json(null, 204); }
      if (method === "POST") { const i = db.push_subscriptions.findIndex((x) => x.endpoint === b.endpoint); if (i >= 0) Object.assign(db.push_subscriptions[i], b); else db.push_subscriptions.push(b); return json(null, 201); }
    }
    if (t === "push_fixture_state") {
      if (method === "GET") return json(db.push_fixture_state.filter((r) => r.live || u.search.includes(String(r.fixture_id))));
      if (method === "POST") { for (const r of b) { const i = db.push_fixture_state.findIndex((x) => x.fixture_id === r.fixture_id); if (i >= 0) Object.assign(db.push_fixture_state[i], r); else db.push_fixture_state.push(r); } return json(null, 201); }
      if (method === "DELETE") return json(null, 204);
    }
  }
  return json({}, 404);
};
const { runPush, messageFor } = await import("../api/_push.js");
const push = (await import("../server/push.js"));

const sub = (n, extra = {}) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: "p", auth: "a", prefs: { goals: true, kickoff: true, whistles: true }, fixtures: [], teams: [1], fail_count: 0, ...extra });
const sent = []; const send = async (s, m) => { if (s.endpoint.endsWith("dead")) { const e = new Error("gone"); e.statusCode = 410; throw e; } sent.push({ to: s.endpoint.split("/").pop(), ...m }); };
const NOW = Date.parse("2026-10-20T15:07:00Z");

await test("no subscribers or nobody watching: no football API call at all", async () => {
  assert.ok((await runPush({ now: NOW, send })).skipped); footballCalls = [];
  db.push_subscriptions = [sub("a", { teams: [], fixtures: [] })];
  const s = await runPush({ now: NOW, send }); assert.ok(s.skipped); assert.equal(footballCalls.length, 0);
});
await test("quota guard: leaves a share of the day's requests free", async () => {
  db.push_subscriptions = [sub("a")]; quota = { current: 900, limit_day: 1000 }; footballCalls = [];
  const s = await runPush({ now: NOW, send }); assert.match(s.skipped, /quota/); assert.equal(footballCalls.length, 0);
  quota = { current: 10, limit_day: 1000 };
});
await test("kick-off alert once, only to people who watch that club", async () => {
  db.push_subscriptions = [sub("a"), sub("b", { teams: [], fixtures: [] , prefs: { goals: true } }), sub("c", { teams: [9] }), sub("d", { teams: [], fixtures: [500] })];
  live = [fx(500, "1H", 1, 0, 0), fx(600, "1H", 1, 0, 0, [8, "Other"], [9, "Else"])];
  const s = await runPush({ now: NOW, send });
  assert.equal(s.events, 2);
  const kicks = sent.filter((m) => m.type === "kickoff");
  assert.deepEqual(kicks.map((m) => m.to).sort(), ["a", "c", "d"]); // b only wants goals
});
await test("goal alert names the scoring side and is not repeated by the next run", async () => {
  sent.length = 0; db.push_subscriptions = [sub("a")];
  db.push_fixture_state = []; live = [fx(700, "2H", 50, 0, 0)];
  await runPush({ now: NOW, send }); assert.equal(sent.length, 0); // first sighting records only
  live = [fx(700, "2H", 63, 1, 0)];
  const s = await runPush({ now: NOW + 60000, send });
  assert.equal(s.sent, 1); assert.equal(sent[0].type, "goal"); assert.equal(sent[0].body, "Goal for Reds (63')"); assert.equal(sent[0].title, "Reds 1\u20130 Blues"); assert.equal(sent[0].url, "/match/700");
  const again = await runPush({ now: NOW + 120000, send }); assert.equal(again.events, 0); assert.equal(sent.length, 1);
});
await test("half-time, then full-time from the final-score lookup", async () => {
  sent.length = 0; live = [fx(700, "HT", 45, 1, 0)];
  await runPush({ now: NOW + 180000, send }); assert.equal(sent.at(-1).type, "half");
  live = []; finished = [fx(700, "FT", 90, 2, 0)];
  const s = await runPush({ now: NOW + 240000, send });
  assert.equal(sent.at(-1).type, "full"); assert.equal(sent.at(-1).body, "Reds 2\u20130 Blues");
  assert.equal(db.push_fixture_state.find((r) => r.fixture_id === 700).live, false);
  assert.ok(s.callsUsed <= 2);
});
await test("respects each person's switches", async () => {
  sent.length = 0; db.push_fixture_state = [];
  db.push_subscriptions = [sub("goalsOnly", { prefs: { goals: true } }), sub("whistlesOnly", { prefs: { whistles: true } })];
  live = [fx(800, "2H", 70, 0, 0)]; await runPush({ now: NOW, send });
  live = [fx(800, "2H", 71, 0, 1)]; await runPush({ now: NOW + 60000, send });
  assert.deepEqual(sent.map((m) => m.to), ["goalsOnly"]);
});
await test("dead devices (410) are removed", async () => {
  sent.length = 0; db.push_fixture_state = []; db.push_subscriptions = [sub("dead"), sub("alive")];
  live = [fx(900, "2H", 10, 0, 0)]; await runPush({ now: NOW, send });
  live = [fx(900, "2H", 11, 1, 0)]; const s = await runPush({ now: NOW + 60000, send });
  assert.equal(s.removed, 1); assert.deepEqual(db.push_subscriptions.map((x) => x.endpoint.split("/").pop()), ["alive"]);
});
await test("message text", () => {
  assert.equal(messageFor("kickoff", { id: 1, home: "A", away: "B", gh: 0, ga: 0 }).body, "A v B has started");
  assert.equal(messageFor("half", { id: 1, home: "A", away: "B", gh: 1, ga: 1 }).title, "Half-time");
});

// ---- signup endpoint
const call = async (method, body, headers = {}) => { let out = { code: 0 }; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(j) { out.body = j; return this; }, end() { return this; } }; await push.default({ method, body, headers: { "x-forwarded-for": "9.9.9." + Math.floor(Math.random() * 250), ...headers } }, res); return out; };
await test("signup: only real push services, valid keys, clean ids", async () => {
  db.push_subscriptions = [];
  assert.equal((await call("GET")).body.publicKey, "pub");
  const good = { action: "subscribe", subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", auth: "tBHItJI5svbpez7KI4CCXg" } }, prefs: { goals: true, kickoff: "yes" }, fixtures: [5, "x", -1, 5, 7], teams: [3] };
  assert.equal((await call("POST", good)).code, 200);
  const row = db.push_subscriptions[0];
  assert.deepEqual(row.fixtures, [5, 7]); assert.deepEqual(row.prefs, { goals: true, kickoff: false, whistles: false });
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://evil.example.com/x", "https://fcm.googleapis.com.evil.com/x", "https://169.254.169.254/x", "https://fcm.googleapis.com:8443/x"]) assert.equal((await call("POST", { ...good, subscription: { ...good.subscription, endpoint } })).code, 400, endpoint);
  assert.equal((await call("POST", { ...good, subscription: { ...good.subscription, keys: { p256dh: "bad key!", auth: "x" } } })).code, 400);
  assert.equal((await call("POST", { action: "unsubscribe", endpoint: good.subscription.endpoint })).code, 200); assert.equal(db.push_subscriptions.length, 0);
});
console.log(`\n${passed} tests passed`);
