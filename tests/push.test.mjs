// Run with:  node tests/push.test.mjs   (no network: football API, Supabase and the push service are faked)
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", SCOUTWAVE_FOOTBALL_API_KEY: "f", VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.c" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const db = { push_subscriptions: [], push_fixture_state: [], usage: [] };
let dayList = [], lineups = {}, events = {}, noPlayerColumn = false, noLineupColumn = false, live = [], finished = [], quota = { current: 10, limit_day: 1000 }, footballCalls = [];
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
const fx = (id, status, elapsed, gh, ga, home = [1, "Reds"], away = [2, "Blues"]) => ({ fixture: { id, status: { short: status, elapsed } }, goals: { home: gh, away: ga }, teams: { home: { id: home[0], name: home[1] }, away: { id: away[0], name: away[1] } } });

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || "GET"; const b = init.body ? JSON.parse(init.body) : null;
  if (u.host === "v3.football.api-sports.io") {
    if (u.pathname === "/status") return json({ response: { requests: { current: quota.current, limit_day: quota.limit_day } } });
    footballCalls.push(u.pathname + u.search);
    if (u.pathname === "/fixtures/events") return json({ response: events[u.searchParams.get("fixture")] || [], errors: [] });
    if (u.pathname === "/fixtures/lineups") return json({ response: lineups[u.searchParams.get("fixture")] || [], errors: [] });
    if (u.searchParams.get("date")) return json({ response: dayList, errors: [] });
    if (u.searchParams.get("live")) return json({ response: live, errors: [] });
    if (u.searchParams.get("ids")) return json({ response: finished, errors: [] });
  }
  if (u.host.endsWith("supabase.co")) {
    const t = u.pathname.split("/").pop();
    if (t === "bump_usage") { db.usage.push(b); return json(null, 204); }
    if (t === "push_subscriptions") {
      if (method === "GET" && noPlayerColumn && u.search.includes("players")) return json({ message: "column push_subscriptions.players does not exist" }, 400);
      if (method === "GET") return json(db.push_subscriptions);
      if (method === "DELETE") { db.push_subscriptions = db.push_subscriptions.filter((s) => !u.search.includes(encodeURIComponent(s.endpoint))); return json(null, 204); }
      if (method === "PATCH") { const s = db.push_subscriptions.find((x) => u.search.includes(encodeURIComponent(x.endpoint))); Object.assign(s, b); return json(null, 204); }
      if (method === "POST" && noPlayerColumn && b.players !== undefined) return json({ message: "column players does not exist" }, 400);
      if (method === "POST") { const i = db.push_subscriptions.findIndex((x) => x.endpoint === b.endpoint); if (i >= 0) Object.assign(db.push_subscriptions[i], b); else db.push_subscriptions.push(b); return json(null, 201); }
    }
    if (t === "push_fixture_state") {
      if (method === "GET" && noLineupColumn && u.search.includes("lineup_sent")) return json({ message: "column push_fixture_state.lineup_sent does not exist" }, 400);
      if (noPlayerColumn && (u.search.includes("event_keys") || method === "PATCH")) return json({ message: "column push_fixture_state.event_keys does not exist" }, 400);
      if (method === "PATCH") { const id = Number(/fixture_id=eq\.(\d+)/.exec(u.search)[1]); const r = db.push_fixture_state.find((x) => x.fixture_id === id); Object.assign(r, b); return json(null, 204); }
      if (method === "GET") return json(db.push_fixture_state.filter((r) => r.live || u.search.includes(String(r.fixture_id))));
      if (method === "POST") { for (const r of b) { const i = db.push_fixture_state.findIndex((x) => x.fixture_id === r.fixture_id); if (i >= 0) Object.assign(db.push_fixture_state[i], r); else db.push_fixture_state.push(r); } return json(null, 201); }
      if (method === "DELETE") return json(null, 204);
    }
  }
  return json({}, 404);
};
const { runPush, messageFor, readLineups, playerEvents, playerMessage } = await import("../api/_push.js");
const { clearMemo } = await import("../api/_predict.js");
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
  assert.deepEqual(row.fixtures, [5, 7]); assert.deepEqual(row.prefs, { goals: true, kickoff: false, whistles: false, lineups: false, players: false });
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://evil.example.com/x", "https://fcm.googleapis.com.evil.com/x", "https://169.254.169.254/x", "https://fcm.googleapis.com:8443/x"]) assert.equal((await call("POST", { ...good, subscription: { ...good.subscription, endpoint } })).code, 400, endpoint);
  assert.equal((await call("POST", { ...good, subscription: { ...good.subscription, keys: { p256dh: "bad key!", auth: "x" } } })).code, 400);
  assert.equal((await call("POST", { action: "unsubscribe", endpoint: good.subscription.endpoint })).code, 200); assert.equal(db.push_subscriptions.length, 0);
});

// ---- lineup alerts ------------------------------------------------------------------------------------------------
const eleven = (teamId, formation) => ({ team: { id: teamId }, formation, startXI: Array.from({ length: 11 }, (_, i) => ({ player: { id: teamId * 100 + i } })) });
const upcoming = (id, minutes, home = [1, "Reds"], away = [2, "Blues"], status = "NS") => ({ ...fx(id, status, null, null, null, home, away), fixture: { id, date: new Date(NOW + minutes * 60000).toISOString(), status: { short: status } } });
const lineupSub = (n, extra = {}) => sub(n, { prefs: { lineups: true }, teams: [1], fixtures: [], ...extra });
const reset = () => { clearMemo(); sent.length = 0; footballCalls = []; live = []; lineups = {}; dayList = []; noLineupColumn = false; db.push_fixture_state = []; };

await test("lineups: both sheets in -> one alert about an hour out, only to people who asked for lineup alerts", async () => {
  reset(); db.push_subscriptions = [lineupSub("a"), sub("goalsOnly", { teams: [1] }), lineupSub("elsewhere", { teams: [9] })];
  dayList = [upcoming(700, 50), upcoming(701, 50, [8, "Other"], [9, "Else"]), upcoming(702, 300)];
  lineups = { 700: [eleven(1, "4-3-3"), eleven(2, "4-4-2")], 701: [eleven(8, "3-5-2")] }; // 701 is not complete, 702 is too far away
  const s = await runPush({ now: NOW, send });
  assert.equal(s.lineups, 1);
  assert.deepEqual(sent.filter((m) => m.type === "lineups").map((m) => m.to), ["a"]);
  const m = sent.find((x) => x.type === "lineups");
  assert.equal(m.title, "Lineups are in"); assert.match(m.body, /Reds v Blues \(4-3-3 v 4-4-2\)\. Kick-off in 50 min\./); assert.equal(m.url, "/match/700");
  assert.ok(!footballCalls.some((c) => c.includes("fixture=702")), "a match 5 hours away is not checked");
  assert.ok(db.push_fixture_state.find((r) => r.fixture_id === 700 && r.lineup_sent === true && r.live === false), "marked as sent");
});
await test("lineups: not repeated, and the next run does not even ask the football service again", async () => {
  clearMemo(); sent.length = 0; footballCalls = [];
  const s = await runPush({ now: NOW + 60000, send });
  assert.equal(sent.filter((m) => m.type === "lineups").length, 0); assert.equal(s.lineups, undefined);
  assert.ok(!footballCalls.some((c) => c.startsWith("/fixtures/lineups?fixture=700")), "already sent: no lineup lookup");
});
await test("lineups: sheets not out yet -> nothing sent, and the answer is remembered for a few minutes", async () => {
  reset(); db.push_subscriptions = [lineupSub("a")]; dayList = [upcoming(710, 70)]; lineups = {};
  const s = await runPush({ now: NOW, send });
  assert.equal(sent.length, 0); assert.equal(s.lineupCandidates, 1); assert.equal(db.push_fixture_state.length, 0);
  const lookups = () => footballCalls.filter((c) => c.startsWith("/fixtures/lineups")).length;
  assert.equal(lookups(), 1);
  await runPush({ now: NOW + 60000, send }); assert.equal(lookups(), 1, "asked once, not every minute");
  lineups = { 710: [eleven(1, "4-2-3-1"), eleven(2, "5-3-2")] }; clearMemo();
  await runPush({ now: NOW + 5 * 60000, send }); assert.equal(sent.length, 1); assert.match(sent[0].body, /4-2-3-1 v 5-3-2/);
});
await test("lineups: mixed with live alerts, lineup devices that also want goals still get each alert once", async () => {
  reset(); db.push_subscriptions = [sub("both", { prefs: { goals: true, kickoff: true, whistles: true, lineups: true } })];
  dayList = [upcoming(720, 40)]; lineups = { 720: [eleven(1, "4-3-3"), eleven(2, "4-3-3")] }; live = [];
  const s = await runPush({ now: NOW, send });
  assert.equal(sent.length, 1); assert.equal(sent[0].type, "lineups"); assert.equal(s.sent, 1);
});
await test("lineups: nobody asked for them -> no extra football API calls at all", async () => {
  reset(); db.push_subscriptions = [sub("a")]; dayList = [upcoming(730, 40)]; live = [];
  await runPush({ now: NOW, send });
  assert.ok(!footballCalls.some((c) => c.includes("date=") || c.startsWith("/fixtures/lineups")));
});
await test("lineups: before the database migration nothing is sent (never risk repeats)", async () => {
  reset(); db.push_subscriptions = [lineupSub("a")]; dayList = [upcoming(740, 40)]; lineups = { 740: [eleven(1, "4-3-3"), eleven(2, "4-3-3")] }; noLineupColumn = true;
  const s = await runPush({ now: NOW, send });
  assert.equal(sent.length, 0); assert.match(s.lineupSkipped, /011_lineup_alerts/); assert.ok(!footballCalls.some((c) => c.startsWith("/fixtures/lineups")));
});
await test("lineups: only complete sheets for both teams count", () => {
  assert.deepEqual(readLineups([eleven(1, "4-3-3"), eleven(2, "4-4-2")], 1, 2), { home: "4-3-3", away: "4-4-2" });
  assert.equal(readLineups([eleven(1, "4-3-3")], 1, 2), null);
  assert.equal(readLineups([eleven(1, "4-3-3"), { team: { id: 2 }, formation: "4-4-2", startXI: [{}] }], 1, 2), null);
  assert.equal(readLineups([eleven(1, "4-3-3"), eleven(3, "4-4-2")], 1, 2), null);
  assert.equal(readLineups(null, 1, 2), null);
  assert.equal(messageFor("lineups", { id: 5, home: "A", away: "B", formations: "", minutesTo: 0 }).body, "A v B.");
});


// ---- followed players ---------------------------------------------------------------------------------------------
const ev = (min, type, detail, player, assist = null, extra = null) => ({ time: { elapsed: min, extra }, type, detail, player: { id: player, name: "P" + player }, assist: assist ? { id: assist, name: "P" + assist } : { id: null, name: null }, team: { id: 1 } });
const pSub = (n, players, extra = {}) => sub(n, { prefs: { players: true }, teams: [], fixtures: [], players, ...extra });
const resetP = () => { clearMemo(); sent.length = 0; footballCalls = []; live = []; events = {}; noPlayerColumn = false; db.push_fixture_state = []; };
const playerSent = () => sent.filter((m) => m.type === "player");

await test("followed players: first look records only; a later goal is announced once, to the follower only", async () => {
  resetP(); db.push_subscriptions = [pSub("fan", { 100: 1 }), pSub("other", { 200: 9 }), pSub("off", { 100: 1 }, { prefs: { players: false } })];
  live = [fx(800, "2H", 40, 0, 0)]; events = { 800: [ev(10, "Goal", "Normal Goal", 100)] }; // an old goal: never announced
  await runPush({ now: NOW, send }); assert.equal(playerSent().length, 0);
  assert.ok(Array.isArray(db.push_fixture_state.find((r) => r.fixture_id === 800).event_keys), "what was seen is recorded");
  clearMemo(); live = [fx(800, "2H", 41, 1, 0)]; events = { 800: [ev(10, "Goal", "Normal Goal", 100), ev(34, "Goal", "Normal Goal", 100, 101)] };
  const s = await runPush({ now: NOW + 60000, send });
  assert.deepEqual(playerSent().map((m) => m.to), ["fan"]); assert.equal(s.playerAlerts, 1);
  assert.equal(playerSent()[0].title, "P100 scored"); assert.equal(playerSent()[0].body, "Reds 1\u20130 Blues (34')"); assert.equal(playerSent()[0].url, "/match/800");
  clearMemo(); sent.length = 0; await runPush({ now: NOW + 120000, send }); assert.equal(playerSent().length, 0, "not repeated");
});
await test("followed players: assists, cards, penalties and own goals; missed penalties and substitutions are not alerts", async () => {
  resetP(); db.push_subscriptions = [pSub("a", { 101: 1, 102: 1, 103: 2 })];
  live = [fx(810, "2H", 50, 0, 0)]; events = { 810: [] }; await runPush({ now: NOW, send });
  clearMemo(); sent.length = 0; live = [fx(810, "2H", 70, 2, 0)];
  events = { 810: [ev(55, "Goal", "Penalty", 102), ev(60, "Goal", "Normal Goal", 100, 101), ev(63, "Card", "Yellow Card", 103), ev(66, "Card", "Second Yellow card", 102), ev(68, "Goal", "Missed Penalty", 102), ev(69, "subst", "Substitution 1", 101), ev(70, "Goal", "Own Goal", 103, 101)] };
  await runPush({ now: NOW + 60000, send });
  assert.deepEqual(playerSent().map((m) => m.title).sort(), ["P101 set up a goal", "P102 scored a penalty", "P102 was sent off", "P103 scored an own goal", "P103 was booked"].sort());
});
await test("followed players: someone who starts following mid-match is not sent old events", async () => {
  resetP(); db.push_subscriptions = [pSub("early", { 100: 1 })]; live = [fx(820, "2H", 30, 0, 0)]; events = { 820: [] };
  await runPush({ now: NOW, send }); clearMemo(); events = { 820: [ev(20, "Goal", "Normal Goal", 100)] }; live = [fx(820, "2H", 31, 1, 0)];
  await runPush({ now: NOW + 60000, send }); assert.equal(playerSent().length, 1);
  db.push_subscriptions.push(pSub("late", { 100: 1 })); clearMemo(); sent.length = 0;
  await runPush({ now: NOW + 120000, send }); assert.equal(playerSent().length, 0);
});
await test("followed players: no followers of a live match -> its events are never requested; at most six matches a run", async () => {
  resetP(); db.push_subscriptions = [pSub("a", { 100: 9 })]; live = [fx(830, "2H", 30, 0, 0)];
  await runPush({ now: NOW, send }); assert.ok(!footballCalls.some((c) => c.startsWith("/fixtures/events")));
  resetP(); db.push_subscriptions = [pSub("a", Object.fromEntries(Array.from({ length: 8 }, (_, i) => [300 + i, 20 + i])))];
  live = Array.from({ length: 8 }, (_, i) => fx(840 + i, "2H", 30, 0, 0, [20 + i, "H" + i], [90 + i, "A" + i]));
  await runPush({ now: NOW, send }); assert.equal(footballCalls.filter((c) => c.startsWith("/fixtures/events")).length, 6);
});
await test("followed players: before migration 012 nothing is sent for players and goal alerts still work", async () => {
  resetP(); noPlayerColumn = true; db.push_subscriptions = [pSub("p", { 100: 1 }), sub("g")]; live = [fx(850, "2H", 40, 0, 0)];
  await runPush({ now: NOW, send }); clearMemo(); live = [fx(850, "2H", 41, 1, 0)]; events = { 850: [ev(41, "Goal", "Normal Goal", 100)] };
  const s = await runPush({ now: NOW + 60000, send });
  assert.equal(playerSent().length, 0); assert.equal(sent.filter((m) => m.type === "goal").length, 1, "the goal alert for a club follower is unaffected");
  assert.ok(s.subscribers >= 1);
});
await test("followed players: signup stores a clean { player: club } map, and still works before migration 012", async () => {
  noPlayerColumn = false; db.push_subscriptions = [];
  const good = { action: "subscribe", subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/pl", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", auth: "tBHItJI5svbpez7KI4CCXg" } }, prefs: { players: true }, fixtures: [], teams: [], players: { 100: 1, "-5": 3, abc: 2, 7: 0, 8: "9" } };
  assert.equal((await call("POST", good)).code, 200); assert.deepEqual(db.push_subscriptions[0].players, { 100: 1, 8: 9 }); assert.equal(db.push_subscriptions[0].prefs.players, true);
  db.push_subscriptions = []; noPlayerColumn = true;
  assert.equal((await call("POST", good)).code, 200); assert.equal(db.push_subscriptions.length, 1); assert.equal(db.push_subscriptions[0].players, undefined);
  noPlayerColumn = false;
});
await test("followed players: event reading", () => {
  const a = playerEvents([ev(5, "Goal", "Normal Goal", 1, 2), ev(6, "Goal", "Missed Penalty", 1), ev(7, "Card", "Red Card", 3), ev(8, "subst", "Substitution 2", 4, 5), ev(9, "Goal", "Own Goal", 6, 7), ev(90, "Goal", "Normal Goal", 8, null, 3)]);
  assert.deepEqual(a.map((x) => x.kind + ":" + x.playerId), ["goal:1", "assist:2", "red:3", "owngoal:6", "goal:8"]);
  assert.equal(a[4].minute, "90+3'"); assert.equal(new Set(a.map((x) => x.key)).size, a.length);
  assert.equal(playerMessage(a[0], { id: 1, home: "A", away: "B", gh: 1, ga: 0 }).body, "A 1\u20130 B (5')"); assert.deepEqual(playerEvents(null), []);
});

console.log(`\n${passed} tests passed`);
