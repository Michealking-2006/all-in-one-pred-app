// Run with:  node tests/predict-priority.test.mjs   (no network)
// Top leagues are predicted before lower ones, and the jobs never use up the football API plan.
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", SCOUTWAVE_FOOTBALL_API_KEY: "f", PREDICT_RATE_WAIT_MS: "1", PREDICT_ODDS: "0", PREDICT_RATINGS: "0", PREDICT_DAYS: "1" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const json = (d, s = 200, h = {}) => new Response(s === 204 ? null : JSON.stringify(d), { status: s, headers: h });

const { leaguePriority, tierOf } = await import("../src/predictions/tiers.js");
await test("tiers: big five and European cups, other first divisions, second divisions, unknown, youth/women", () => {
  const p = (id, name = "") => leaguePriority({ id, name });
  assert.ok(p(39) < p(2) && p(2) < p(88) && p(88) < p(40) && p(40) < p(999999, "Some League") && p(999999, "Some League") < p(999998, "Premier League U21"));
  assert.deepEqual([39, 88, 40, 999999, 999998].map((id) => tierOf({ id, name: id === 999998 ? "Liga Women" : "" })), [0, 1, 2, 3, 4]);
  assert.ok(leaguePriority({ id: 999999 }, [999999]) < p(39), "PREDICT_PRIORITY goes first");
});

let db, calls, remaining, status;
const reset = (s, rem) => { db = { predictions: [] }; calls = []; status = s; remaining = rem; };
const fx = (id, league, hour) => ({ fixture: { id, date: new Date(Date.UTC(2026, 9, 20, 13, 0) + hour * 3600000).toISOString(), status: { short: "NS" } }, league: { id: league, name: "League " + league, season: 2026 }, teams: { home: { id: id * 10, name: "H" + id }, away: { id: id * 10 + 1, name: "A" + id } } });
const lg = (n, gf, ga) => ({ form: "WDLWW", fixtures: { played: { home: n, away: n, total: 2 * n }, wins: { home: 4, away: 3, total: 7 }, draws: { home: 2, away: 2, total: 4 }, loses: { home: 2, away: 3, total: 5 } }, goals: { for: { total: { home: gf, away: gf - 2, total: 2 * gf - 2 } }, against: { total: { home: ga, away: ga + 1, total: 2 * ga + 1 } } } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url), method = init.method || "GET";
  if (u.host === "v3.football.api-sports.io") {
    const ep = u.pathname.slice(1);
    if (ep === "status") return json({ response: { requests: { current: status.used, limit_day: status.limit } } });
    calls.push(ep + "?" + u.searchParams.toString());
    const h = {}; if (remaining !== null) { remaining--; h["x-ratelimit-requests-remaining"] = String(remaining); }
    if (ep === "fixtures") return json({ errors: [], response: u.searchParams.get("date") === "2026-10-20" ? status.fixtures : [] }, 200, h);
    if (ep === "standings") return json({ errors: { plan: "no tables" }, response: [] }, 200, h);
    if (ep === "predictions") { const id = Number(u.searchParams.get("fixture")); return json({ errors: [], response: [{ teams: { home: { id: id * 10, name: "H" + id, league: lg(8, 12 + (id % 7), 7 + (id % 3)) }, away: { id: id * 10 + 1, name: "A" + id, league: lg(8, 9 + (id % 5), 9 + (id % 4)) } } }] }, 200, h); }
    return json({ errors: [], response: [] }, 200, h);
  }
  if (u.host.endsWith("supabase.co")) {
    const t = u.pathname.split("/").pop(), b = init.body ? JSON.parse(init.body) : null;
    if (t === "bump_usage") return json(null, 204);
    if (t === "predictions") { if (method === "POST") { for (const r of b) if (!db.predictions.find((x) => x.fixture_id === r.fixture_id && x.model === r.model)) db.predictions.push(r); return json(null, 201); } return json([]); }
    return json({}, 404);
  }
  return json({}, 404);
};
const { runPredict, makeBudget, clearMemo } = await import("../api/_predict.js");

await test("budget: a share of the day's limit is always kept free, and one run can only spend a share of it", async () => {
  reset({ used: 10, limit: 100 }, null);
  let b = await makeBudget(); assert.deepEqual([b.calls, b.keptFree], [40, 30]);           // 90 left - 31 floor = 59, capped at 40% of 100
  reset({ used: 60, limit: 100 }, null); b = await makeBudget(); assert.equal(b.calls, 9);   // 40 left - 31
  reset({ used: 81, limit: 100 }, null); b = await makeBudget(); assert.equal(b.calls, 0);   // 19 left: all of it stays free for the app
  reset({ used: 100, limit: 7500 }, null); b = await makeBudget(); assert.equal(b.calls, 300); // big plan: the 300 safety ceiling
  reset({ used: 6000, limit: 7500 }, null); b = await makeBudget(); assert.equal(b.calls, 0);  // 1500 left < 2250 kept free
  reset({ used: 10, limit: 100 }, null); b = await makeBudget({ job: "grade" }); assert.equal(b.calls, 15);
});

await test("order: top leagues are read before lower ones, whatever their kick-off time or size", async () => {
  process.env.PREDICT_SOURCE = "match"; clearMemo();
  reset({ used: 0, limit: 7500, fixtures: [fx(1, 999991, 0), fx(2, 999991, 0.1), fx(3, 999991, 0.2), fx(4, 40, 1), fx(5, 88, 2), fx(6, 39, 5), fx(7, 999992, 0.5)] }, null);
  const s = await runPredict({ now: NOW });
  const order = calls.filter((c) => c.startsWith("predictions")).map((c) => Number(c.split("fixture=")[1]));
  assert.deepEqual(order, [6, 5, 4, 1, 2, 3, 7], JSON.stringify(s)); // 39, 88, 40, then the unlisted ones
  assert.equal(s.predicted, 7);
});

await test("match mode: every match of a league is judged against the same league averages", () => {
  const rows = db.predictions.filter((r) => r.model === "poisson-v2" && r.league_id === 999991);
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((r) => r.inputs.basis.leagueAvgHome)).size, 1, "not dependent on which match was read first");
});

await test("the day's limit is never reached: the run stops at the floor even when visitors use the quota meanwhile", async () => {
  process.env.PREDICT_SOURCE = "match"; clearMemo();
  const many = Array.from({ length: 30 }, (_, i) => fx(100 + i, 39, i * 0.05));
  // the status check says 90 are left, but visitors are using it: the answers report 36 left, the floor is 31
  reset({ used: 10, limit: 100, fixtures: many }, 36);
  const s = await runPredict({ now: NOW });
  assert.ok(remaining >= 31, "never below the floor: " + remaining);
  assert.equal(s.stoppedForQuota, true, JSON.stringify(s)); assert.equal(s.apiErrors, undefined, "kept free, not a failure");
  assert.ok(s.predicted > 0 && s.predicted < 30);
});
console.log("\n" + passed + " tests passed");
