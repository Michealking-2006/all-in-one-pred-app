// Run with:  node tests/predicted.test.mjs
// GET /api/predicted lists the predicted matches from the predictions table alone (no football data service), shows
// picks only to people who may see them, and adds exact markets from the stored score grid. Supabase is faked.
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { marketsFromMatrix } = await import("../src/predictions/metrics.js");

// A 3x3 grid that can be checked by hand (the real one is 9x9): grid[i][j] = P(home scores i, away scores j).
const grid = [[0.10, 0.08, 0.02], [0.20, 0.15, 0.05], [0.18, 0.12, 0.10]];
await test("markets are exact sums over the score grid", () => {
  assert.deepEqual(marketsFromMatrix(grid), { home: 0.5, draw: 0.35, away: 0.15, dc1x: 0.85, dcx2: 0.5, dc12: 0.65, over15: 0.62, over25: 0.27, over35: 0.1, btts: 0.42 });
  assert.equal(marketsFromMatrix(null), null); assert.equal(marketsFromMatrix([[0.1]]), null, "an incomplete grid says nothing");
});

const U = { vip: "11111111-1111-4111-8111-111111111111", free: "22222222-2222-4222-8222-222222222222" };
const tokens = { "tok-vip": U.vip, "tok-free": U.free };
const ent = { [U.vip]: { is_vip: true, vip_until: null, coins: 0, unlocked_tips: [] }, [U.free]: { is_vip: false, vip_until: null, coins: 0, unlocked_tips: [] } };
let enforce = true; const asked = []; let predictionsQuery = "";
const at = (h) => new Date(Date.now() + h * 3600000).toISOString();
const row = (id, pickProb, hours, model = "poisson-v2") => ({
  fixture_id: id, model, made_at: at(-5), kickoff: at(hours), league_id: 39, league_name: "Premier League", home_id: id * 10, home_name: "Home " + id, away_id: id * 10 + 1, away_name: "Away " + id,
  note: "SECRET NOTE", matrix: grid, prediction: { fixtureId: id, pick: "home", pickProb, confidence: pickProb > 60 ? "high" : "low", probs: { home: 50, draw: 35, away: 15 }, over25: 27, btts: 42, xg: { home: 1.7, away: 0.9 } },
});
const rows = [row(1, 48, 6), row(2, 71, 3), row(3, 60, 30)];
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); asked.push(u.host + u.pathname); const t = u.pathname.split("/").pop();
  if (u.pathname === "/auth/v1/user") { const id = tokens[String(init.headers?.Authorization || "").replace("Bearer ", "")]; return id ? json({ id, email: "a@x.test" }) : json({ message: "bad" }, 401); }
  if (t === "app_config") return json([{ value: { flags: { serverEntitlements: enforce } }, updated_at: "2026-10-20T00:00:00Z" }]);
  if (t === "entitlements") { const id = u.search.match(/user_id=eq\.([0-9a-f-]+)/)[1]; return json([{ user_id: id, version: 0, ...ent[id] }]); }
  if (t === "predictions") { predictionsQuery = decodeURIComponent(u.search); return json(rows); }
  return json({}, 404);
};
const handler = (await import("../server/predicted.js")).default;
const get = async (query = {}, token, method = "GET") => {
  const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(j) { out.body = j; return this; }, end() { return this; } };
  await handler({ method, query, headers: token ? { authorization: "Bearer " + token } : {} }, res); return out;
};

await test("Premium: every predicted match with teams, league, kick-off, crests and the pick; the grid itself is never sent", async () => {
  const r = await get({}, "tok-vip");
  assert.equal(r.code, 200); assert.equal(r.body.matches.length, 3);
  assert.deepEqual(r.body.matches.map((m) => m.id), [2, 1, 3], "in kick-off order");
  const m = r.body.matches[0];
  assert.equal(m.home.name, "Home 2"); assert.equal(m.league.name, "Premier League"); assert.equal(m.home.logo, "https://media.api-sports.io/football/teams/20.png"); assert.ok(Date.parse(m.kickoff) > Date.now());
  assert.equal(m.prediction.pick, "home"); assert.equal(m.prediction.source, "server");
  assert.equal(m.prediction.markets.over15, 0.62); assert.equal(m.prediction.markets.dc12, 0.65);
  assert.ok(!JSON.stringify(r.body).includes("matrix"), "no score grid in the answer");
});
await test("nothing but our own database and sign-in is asked: never the football data service", () => {
  assert.ok(asked.length && asked.every((h) => /\/(rest|auth)\/v1\//.test(h)), asked.join(" "));
  assert.ok(!asked.some((h) => /api-sports|api-football/.test(h)), asked.join(" "));
});
await test("someone without Premium gets the matches and a teaser, never a pick, number or market", async () => {
  const r = await get({}, "tok-free");
  assert.equal(r.body.matches.length, 3);
  for (const m of r.body.matches) {
    assert.equal(m.prediction, undefined); assert.ok(m.locked && ["high", "low"].includes(m.locked.confidence));
    const s = JSON.stringify(m); for (const k of ["pick", "probs", "markets", "xg", "over25", "btts", "SECRET", "pickProb"]) assert.ok(!s.includes(k), `a teaser leaks "${k}": ${s}`);
  }
  const anon = await get({}); assert.ok(anon.body.matches.every((m) => m.locked), "signed out is locked too");
  assert.equal(r.headers["Cache-Control"], "private, no-store"); assert.equal(r.headers.Vary, "Authorization");
});
await test("demo mode (gate off): everyone sees everything, and the answer can be cached", async () => {
  enforce = false; const r = await get({});
  assert.ok(r.body.matches.every((m) => m.prediction)); assert.ok(r.headers["Vercel-CDN-Cache-Control"]); assert.ok(!r.headers.Vary); enforce = true;
});
await test("only upcoming, unfinished matches inside the window, never more than a week", async () => {
  await get({ days: "99" }, "tok-vip");
  assert.match(predictionsQuery, /status=eq\.pending/); assert.match(predictionsQuery, /kickoff=gte\./); assert.match(predictionsQuery, /limit=600/);
  const lt = Date.parse(predictionsQuery.match(/kickoff=lt\.([^&]+)/)[1]); assert.ok(lt - Date.now() <= 7 * 86400000 + 5000 && lt - Date.now() > 6 * 86400000, "99 days is cut to 7");
  await get({ days: "nonsense" }, "tok-vip");
  const lt2 = Date.parse(predictionsQuery.match(/kickoff=lt\.([^&]+)/)[1]); assert.ok(Math.abs(lt2 - Date.now() - 3 * 86400000) < 5000, "a default of 3 days");
  const gte = Date.parse(predictionsQuery.match(/kickoff=gte\.([^&]+)/)[1]); assert.ok(gte > Date.now() + 4 * 60000, "a match about to start is left out");
});
await test("one match with rows from two models appears once, from the earliest row", async () => {
  const early = { ...row(5, 55, 8, "poisson-v1"), made_at: at(-9) }, late = { ...row(5, 90, 8), made_at: at(-1) };
  rows.splice(0, rows.length, early, late);
  const r = await get({}, "tok-vip");
  assert.equal(r.body.matches.length, 1); assert.equal(r.body.matches[0].prediction.pickProb, 55); assert.equal(r.body.matches[0].prediction.model, "poisson-v1");
});
await test("only GET is answered", async () => {
  const r = await get({}, "tok-vip", "POST"); assert.equal(r.code, 405);
});
console.log(`\n${passed} passed`);
