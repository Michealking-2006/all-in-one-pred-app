// Run with:  node tests/premium-gate.test.mjs
// The server decides who may see a stored prediction. Supabase is faked.
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const U = { vip: "11111111-1111-4111-8111-111111111111", free: "22222222-2222-4222-8222-222222222222", paid1: "33333333-3333-4333-8333-333333333333", lapsed: "44444444-4444-4444-8444-444444444444", banned: "55555555-5555-4555-8555-555555555555" };
const tokens = { "tok-vip": U.vip, "tok-vip2": U.vip, "tok-free": U.free, "tok-paid1": U.paid1, "tok-lapsed": U.lapsed, "tok-banned": U.banned };
const ent = {
  [U.vip]: { is_vip: true, vip_until: null, coins: 0, unlocked_tips: [] },
  [U.free]: { is_vip: false, vip_until: null, coins: 9, unlocked_tips: [] },
  [U.paid1]: { is_vip: false, vip_until: null, coins: 0, unlocked_tips: [102] },
  [U.lapsed]: { is_vip: true, vip_until: "2020-01-01T00:00:00Z", coins: 0, unlocked_tips: [] }, // Premium that has ended
  [U.banned]: { is_vip: true, vip_until: null, coins: 0, unlocked_tips: [] },
};
let enforce = true, authDown = false;
const pred = (id, pickProb, confidence) => ({ fixture_id: id, made_at: "2026-10-20T06:00:00Z", note: "SECRET NOTE " + id, prediction: { fixtureId: id, pick: "home", pickProb, confidence, probs: { home: pickProb, draw: 20, away: 100 - pickProb - 20 }, likelyScore: { home: 2, away: 1 }, xg: { home: 1.9, away: 0.8 }, over25: 55, btts: 52, drivers: { homeScoring: 2.1 }, basis: { leagueAvgHome: 1.5 } } });
const rows = [pred(101, 48, "low"), pred(102, 71, "high"), pred(103, 60, "medium")];
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const t = u.pathname.split("/").pop();
  if (u.pathname === "/auth/v1/user") {
    if (authDown) return json({ message: "down" }, 500);
    const tok = String(init.headers?.Authorization || "").replace("Bearer ", ""); const id = tokens[tok];
    if (!id) return json({ message: "bad token" }, 401);
    return json({ id, email: id.slice(0, 4) + "@x.test", ...(id === U.banned ? { banned_until: "2099-01-01T00:00:00Z" } : {}) });
  }
  if (t === "app_config") return json([{ value: { flags: { serverEntitlements: enforce } }, updated_at: "2026-10-20T00:00:00Z" }]);
  if (t === "entitlements") { const id = u.search.match(/user_id=eq\.([0-9a-f-]+)/)[1]; return json(ent[id] ? [{ user_id: id, version: 0, ...ent[id] }] : []); }
  if (t === "predictions") { const ids = u.search.match(/fixture_id=in\.\(([\d,]+)\)/)[1].split(",").map(Number); return json(rows.filter((r) => ids.includes(r.fixture_id))); }
  return json({}, 404);
};
const handler = (await import("../api/predictions.js")).default;
const get = async (fixtures, token) => {
  const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(j) { out.body = j; return this; }, end() { return this; } };
  await handler({ method: "GET", query: { fixtures }, headers: token ? { authorization: "Bearer " + token } : {} }, res); return out;
};
const SECRETS = ["pick", "probs", "likelyScore", "xg", "over25", "btts", "drivers", "basis", "note", "pickProb", "SECRET"];
const noSecrets = (obj) => { const s = JSON.stringify(obj); for (const k of SECRETS) assert.ok(!s.includes(k), `locked answer leaks "${k}": ${s}`); };

await test("flag off (demo): everyone gets everything, cacheable", async () => {
  enforce = false; const r = await get("101,102,103");
  assert.equal(r.code, 200); assert.equal(Object.keys(r.body.predictions).length, 3); assert.deepEqual(r.body.locked, {}); assert.equal(r.body.enforced, false);
  assert.ok(r.headers["Vercel-CDN-Cache-Control"]); assert.ok(!r.headers.Vary);
  enforce = true;
});
await test("not signed in: nothing but teasers, and teasers carry no pick", async () => {
  const r = await get("101,102,103");
  assert.deepEqual(r.body.predictions, {}); assert.equal(Object.keys(r.body.locked).length, 3); assert.equal(r.body.enforced, true);
  noSecrets(r.body.locked);
  assert.deepEqual(r.body.locked[102], { confidence: "high", order: 0 }); assert.equal(r.body.locked[103].order, 1); assert.equal(r.body.locked[101].order, 2);
});
await test("answers for a signed-in person are never shared between people", async () => {
  const r = await get("101", "tok-free");
  assert.equal(r.headers["Cache-Control"], "private, no-store"); assert.equal(r.headers.Vary, "Authorization"); assert.ok(!r.headers["Vercel-CDN-Cache-Control"]);
});
await test("signed in without Premium: locked, except a match they unlocked with coins", async () => {
  const free = await get("101,102,103", "tok-free"); assert.deepEqual(free.body.predictions, {}); noSecrets(free.body.locked);
  const one = await get("101,102,103", "tok-paid1");
  assert.deepEqual(Object.keys(one.body.predictions), ["102"]); assert.equal(one.body.predictions[102].pick, "home"); assert.equal(one.body.predictions[102].source, "server");
  assert.deepEqual(Object.keys(one.body.locked).sort(), ["101", "103"]); noSecrets(one.body.locked);
});
await test("Premium: everything, with ranks; an ended Premium counts as none", async () => {
  const vip = await get("101,102,103", "tok-vip");
  assert.equal(Object.keys(vip.body.predictions).length, 3); assert.deepEqual(vip.body.locked, {}); assert.equal(vip.body.predictions[102].order, 0);
  const lapsed = await get("101,102,103", "tok-lapsed"); assert.deepEqual(lapsed.body.predictions, {}); noSecrets(lapsed.body.locked);
});
await test("bad, expired or suspended sign-in is treated as signed out (no error that reveals anything)", async () => {
  for (const tok of ["tok-nope", "tok-banned", "x".repeat(5000)]) { const r = await get("101,102", tok); assert.equal(r.code, 200, tok.slice(0, 8)); assert.deepEqual(r.body.predictions, {}); noSecrets(r.body.locked); }
});
await test("sign-in service down: fails closed (a lock for a moment, never a free pick)", async () => {
  authDown = true; const r = await get("101,102", "tok-vip2"); // a token the server has not verified before (verified ones are remembered briefly)
  assert.equal(r.code, 200); assert.deepEqual(r.body.predictions, {}); noSecrets(r.body.locked); authDown = false;
  assert.equal(Object.keys((await get("101,102", "tok-vip2")).body.predictions).length, 2); // and it recovers on the next ask
});
await test("input is validated: junk ids are dropped, a list is capped", async () => {
  assert.equal((await get("")).code, 400); assert.equal((await get("abc,-5,0")).code, 400);
  const r = await get("101,101,102);drop table x,1e3", "tok-vip"); assert.equal(r.code, 200); assert.deepEqual(Object.keys(r.body.predictions).sort(), ["101", "102"]);
});
await test("matches with no stored pick are simply absent (the app then decides, see engine.js)", async () => {
  const r = await get("999", "tok-vip"); assert.deepEqual(r.body.predictions, {}); assert.deepEqual(r.body.locked, {});
});
console.log(`\n${passed} tests passed`);
