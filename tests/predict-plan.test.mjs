// Run with:  node tests/predict-plan.test.mjs   (no network)
// A football data plan that cannot read league tables or far-off dates: predictions must still be made, per match,
// without burning the day's requests on calls that can only be refused.
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k", SCOUTWAVE_FOOTBALL_API_KEY: "f", PREDICT_RATE_WAIT_MS: "5", PREDICT_ODDS: "0", PREDICT_RATINGS: "0" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const json = (d, s = 200, h = {}) => new Response(s === 204 ? null : JSON.stringify(d), { status: s, headers: h });

const fx = (id, hour) => ({ fixture: { id, date: new Date(Date.UTC(2026, 9, 20, 13, 0) + hour * 3600000).toISOString(), status: { short: "NS" } }, league: { id: 39, name: "Premier League", season: 2026 }, teams: { home: { id: id * 10, name: "Home " + id }, away: { id: id * 10 + 1, name: "Away " + id } } });
const league = (played, gfH, gaH, gfA, gaA, form) => ({ form, fixtures: { played: { home: played, away: played, total: played * 2 }, wins: { home: 5, away: 4, total: 9 }, draws: { home: 2, away: 2, total: 4 }, loses: { home: 1, away: 2, total: 3 } }, goals: { for: { total: { home: gfH, away: gfA, total: gfH + gfA } }, against: { total: { home: gaH, away: gaA, total: gaH + gaA } } } });
const predictionFor = (id) => ({ predictions: { percent: { home: "50%", draw: "25%", away: "25%" } }, teams: {
  home: { id: id * 10, name: "Home " + id, league: league(8, 20, 5, 16, 6, "WWWDWWLWW") },
  away: { id: id * 10 + 1, name: "Away " + id, league: league(8, 6, 16, 4, 20, "LLDLLDLLL") } } });

let db, calls, mode;
const reset = (m) => { db = { predictions: [], cache: [], usage: [] }; calls = []; mode = m; };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url), method = init.method || "GET";
  if (u.host === "v3.football.api-sports.io") {
    const ep = u.pathname.slice(1);
    if (ep === "status") return json({ response: { requests: { current: mode.used ?? 10, limit_day: 100 } } });
    calls.push(ep + "?" + u.searchParams.toString());
    if (ep === "fixtures" && u.searchParams.get("ids")) return json({ errors: [], response: u.searchParams.get("ids").split("-").map((id) => ({ fixture: { id: Number(id), status: { short: Number(id) === 101 ? "NS" : "FT" } }, goals: { home: 2, away: 0 }, score: { fulltime: { home: 2, away: 0 } } })) });
    if (ep === "fixtures" && u.searchParams.get("status") === "FT-AET-PEN") return json({ errors: { plan: "Free plans can only access a range of dates around today." }, response: [] });
    if (ep === "fixtures" && u.searchParams.get("status") === "NS") {
      const date = u.searchParams.get("date");
      if (!["2026-10-20", "2026-10-21"].includes(date)) return json({ errors: { plan: "Free plans can only access a range of dates around today." }, response: [] });
      return json({ errors: [], response: date === "2026-10-20" ? mode.fixtures : [] });
    }
    if (ep === "standings") return mode.tablesOpen ? json({ errors: [], response: [] }) : json({ errors: { plan: "Free plans do not have access to this season, try from 2021 to 2023." }, response: [] });
    if (ep === "predictions") {
      if (mode.predictionsPlan) return json({ errors: { plan: "This endpoint is not included in your plan." }, response: [] });
      if (mode.rateOnce && !mode.rateHit) { mode.rateHit = true; return json({ errors: { rateLimit: "Too many requests. Your rate limit is 10 requests per minute." }, response: [] }); }
      return json({ errors: [], response: [predictionFor(Number(u.searchParams.get("fixture")))] });
    }
    return json({ errors: [], response: [] });
  }
  if (u.host.endsWith("supabase.co")) {
    const t = u.pathname.split("/").pop(), q = u.search, b = init.body ? JSON.parse(init.body) : null;
    if (t === "bump_usage") { db.usage.push(b); return json(null, 204); }
    if (t === "api_cache") {
      if (method === "POST") { for (const r of b) { db.cache = db.cache.filter((x) => x.key !== r.key); db.cache.push(r); } return json(null, 201); }
      const k = decodeURIComponent(q.match(/key=eq\.([^&]+)/)[1]); return json(db.cache.filter((x) => x.key === k));
    }
    if (t === "predictions") {
      if (method === "POST") { for (const r of b) if (!db.predictions.find((x) => x.fixture_id === r.fixture_id && x.model === r.model)) db.predictions.push(r); return json(null, 201); }
      if (method === "PATCH") { const id = Number(q.match(/fixture_id=eq\.(\d+)/)[1]); const r = db.predictions.find((x) => x.fixture_id === id && x.model === q.match(/model=eq\.([\w.-]+)/)[1] && x.status === "pending"); if (r) Object.assign(r, b); return json(null, 204); }
      const inM = q.match(/fixture_id=in\.\(([\d,]+)\)/), mm = q.match(/model=eq\.([\w.-]+)/);
      let rows = db.predictions; if (q.includes("status=eq.pending")) rows = rows.filter((r) => (r.status || "pending") === "pending"); const lt = q.match(/kickoff=lt\.([^&]+)/); if (lt) rows = rows.filter((r) => new Date(r.kickoff) < new Date(decodeURIComponent(lt[1]))); if (inM) rows = rows.filter((r) => inM[1].split(",").map(Number).includes(r.fixture_id)); if (mm) rows = rows.filter((r) => r.model === mm[1]);
      return json(rows);
    }
  }
  return json({}, 404);
};
const mod = await import("../api/_predict.js");
const { runPredict, runGrade, classifyError, rowsFromPredictions, clearMemo } = mod;
const list = (n) => Array.from({ length: n }, (_, i) => fx(100 + i, i * 0.05));

await test("errors are told apart: plan, rate limit, quota, key", () => {
  assert.equal(classifyError({ plan: "Free plans do not have access to this season, try from 2021 to 2023." }).kind, "plan");
  assert.equal(classifyError({ plan: "x" }).kind, "plan");
  assert.equal(classifyError({ rateLimit: "Too many requests. Your rate limit is 10 requests per minute." }).kind, "rate");
  assert.equal(classifyError({ requests: "You have reached the request limit for the day" }).kind, "quota");
  assert.equal(classifyError({ token: "Error/Missing application key." }).kind, "key");
  assert.equal(classifyError(null, 429).kind, "rate");
  assert.equal(classifyError([], 500).kind, "other");
  assert.match(classifyError({ plan: "Free plans do not have access" }).text, /plan: Free plans/);
});
await test("a per-match answer becomes the two team rows the model reads", () => {
  const rows = rowsFromPredictions(predictionFor(7));
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].team.id, rows[0].home.played, rows[0].home.goals, rows[0].all.played, rows[0].form], [70, 8, { for: 20, against: 5 }, 16, "LWWWW".length === 5 ? "DWWLW".length === 5 ? rows[0].form : "" : ""]);
  assert.equal(rows[0].form.length, 5); assert.equal(rowsFromPredictions({ teams: { home: { id: 1 } } }).length, 0);
});
await test("tables refused by the plan: one probe, then predictions are made per match, soonest first, within budget", async () => {
  reset({ fixtures: list(30), used: 81 }); clearMemo(); // 19 requests left -> 18 may be spent
  const s = await runPredict({ now: NOW });
  assert.equal(s.mode, "match", JSON.stringify(s));
  assert.equal(calls.filter((c) => c.startsWith("standings")).length, 1, "only one request finds out the plan cannot read tables");
  assert.equal(s.apiErrors.standings.kind, "plan"); assert.match(s.apiErrors.standings.message, /Free plans do not have access/);
  assert.equal(calls.filter((c) => c.startsWith("fixtures")).length, 3, "two days read, the third refused, no further days asked");
  assert.equal(s.daysReached, 2); assert.match(s.daysNote, /Only 2 days/);
  assert.equal(s.budget, 18); assert.equal(s.callsUsed, 18);
  assert.equal(s.predicted, 14); assert.equal(s.uncovered, 16);
  const done = new Set(db.predictions.filter((r) => r.model === "poisson-v2").map((r) => r.fixture_id));
  assert.deepEqual([...done].sort((a, b) => a - b), Array.from({ length: 14 }, (_, i) => 100 + i), "the 14 soonest matches");
  const p = db.predictions.find((r) => r.model === "poisson-v2");
  assert.ok(p.probs.home > p.probs.away, "the side with the better record is the favourite");
  assert.ok(db.cache.some((r) => r.key === "flag:tables-blocked"), "remembered, so the next run doesn't ask again");
});
await test("next run: no table request at all, and the matches already recorded are not bought again", async () => {
  mode.used = 10; clearMemo(); calls.length = 0; mode.fixtures = list(30);
  const s = await runPredict({ now: NOW });
  assert.equal(s.mode, "match"); assert.equal(calls.filter((c) => c.startsWith("standings")).length, 0);
  assert.equal(s.already, 14); assert.equal(s.predicted, 16, JSON.stringify(s));
  assert.equal(calls.filter((c) => c.startsWith("predictions")).length, 16);
});
await test("a per-minute refusal is waited out and retried once", async () => {
  reset({ fixtures: list(3), rateOnce: true }); clearMemo();
  const s = await runPredict({ now: NOW });
  assert.equal(s.predicted, 3, JSON.stringify(s)); assert.equal(s.apiErrors.predictions.kind, "rate");
});
await test("when per-match answers are refused too, it stops after two refusals and says why", async () => {
  reset({ fixtures: list(10), predictionsPlan: true }); clearMemo();
  const s = await runPredict({ now: NOW });
  assert.equal(s.predicted, 0); assert.equal(calls.filter((c) => c.startsWith("predictions")).length, 2, "no more requests wasted");
  assert.match(s.skipped, /refused 2 "predictions" requests: plan: This endpoint is not included/);
});
await test("a plan that can read tables still predicts per competition", async () => {
  reset({ fixtures: list(2), tablesOpen: true }); clearMemo();
  const s = await runPredict({ now: NOW });
  assert.equal(s.mode, "table"); assert.equal(calls.filter((c) => c.startsWith("predictions")).length, 0);
});
await test("grading: a plan that refuses old dates still grades by match id, and only finished matches count", async () => {
  reset({ fixtures: list(2) }); clearMemo();
  await runPredict({ now: NOW }); // records 100 and 101 per match
  db.predictions.forEach((r) => { r.kickoff = new Date(NOW - 30 * 3600000).toISOString(); r.status = "pending"; });
  calls.length = 0; clearMemo();
  const s = await runGrade({ now: NOW });
  assert.ok(calls.some((c) => c.startsWith("fixtures?ids=")), calls.join(" | "));
  const graded = db.predictions.filter((r) => r.status === "graded");
  assert.ok(graded.length >= 1 && graded.every((r) => r.fixture_id === 100), "fixture 100 finished and is graded");
  assert.ok(db.predictions.filter((r) => r.fixture_id === 101).every((r) => r.status === "pending"), "101 has not finished: left alone");
  assert.equal(s.graded, graded.length);
});
console.log(`\n${passed} passed`);
