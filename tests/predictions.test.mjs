// Run with:  node tests/predictions.test.mjs   (no network: football API and Supabase are faked)
import assert from "node:assert/strict";
process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SCOUTWAVE_FOOTBALL_API_KEY = "f"; process.env.PREDICT_ODDS = "1";
const { predictFromTable, tableFor } = await import("../src/predictions/model.js");
const m = await import("../src/predictions/metrics.js");

let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

// ---- fixtures for the fakes
const row = (id, name, hf, ha, af, aa, form) => ({ team: { id, name }, form, home: { played: 8, goals: { for: hf, against: ha } }, away: { played: 8, goals: { for: af, against: aa } } });
const table = [row(1, "Strong FC", 20, 5, 16, 6, "WWWDW"), row(2, "Weak FC", 6, 16, 4, 20, "LLDLL"), row(3, "Mid A", 11, 11, 9, 11, "WDLDW"), row(4, "Mid B", 10, 12, 8, 12, "DLWLD")];

await test("model: probabilities sum to 1, stronger side favoured, matrix returned", () => {
  const p = predictFromTable({ homeId: 1, awayId: 2, rows: table, form: { home: ["W","W","W"], away: ["L","L","L"] } });
  assert.ok(Math.abs(p.exact.home + p.exact.draw + p.exact.away - 1) < 1e-9);
  assert.ok(p.exact.home > p.exact.away && p.pick === "home");
  assert.equal(p.matrix.length, 9); assert.equal(p.top5.length, 5);
  assert.ok(Math.abs(p.matrix.flat().reduce((a, b) => a + b, 0) - 1) < 1e-3);
});
await test("model: a table row without a home/away split does not crash the drivers", () => {
  const flat = table.map((r) => ({ team: r.team, form: r.form, home: { played: 0, goals: { for: 0, against: 0 } }, away: undefined }));
  const p = predictFromTable({ homeId: 1, awayId: 2, rows: flat });
  assert.ok(p && p.drivers.awayConceding === 0 && Number.isFinite(p.probs.home));
});
await test("model: drivers are goals per game to two decimals", () => {
  const p = predictFromTable({ homeId: 1, awayId: 2, rows: table });
  assert.equal(p.drivers.homeScoring, 2.5); assert.equal(p.drivers.awayConceding, 2.5);
});
await test("model: missing team returns null", () => assert.equal(predictFromTable({ homeId: 1, awayId: 99, rows: table }), null));

await test("metrics: grading, ranks and coverage", () => {
  const p = predictFromTable({ homeId: 1, awayId: 2, rows: table });
  const g = m.gradeOne({ probs: p.exact, matrix: p.matrix }, 2, 0);
  assert.equal(g.outcome, "home"); assert.equal(g.pickCorrect, true); assert.ok(g.brier >= 0 && g.brier < 0.667);
  assert.ok(g.scoreRank >= 1 && g.top5 === (g.scoreRank <= 5));
  assert.equal(m.scoreRank(p.matrix, 20, 20), null); // outside the grid
  const bad = m.gradeOne({ probs: p.exact, matrix: p.matrix }, 0, 3);
  assert.equal(bad.pickCorrect, false); assert.ok(bad.logLoss > g.logLoss);
});
await test("metrics: uniform guess scores 0.667 Brier / 1.099 log loss", () => {
  const u = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  assert.ok(Math.abs(m.brier1x2(u, "draw") - 0.6667) < 1e-3); assert.ok(Math.abs(m.logLoss1x2(u, "home") - 1.0986) < 1e-3);
});
await test("metrics: calibration bins and benchmark grading", () => {
  const c = m.calibration([{ p: 0.62, hit: true }, { p: 0.65, hit: false }, { p: 0.1, hit: false }]);
  assert.equal(c.length, 2); assert.equal(c.find((b) => b.n === 2).actual, 0.5);
  const b = m.gradeBenchmark({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, topScores: ["1-1", "2-1", "1-0"] }, 2, 1);
  assert.equal(b.pickCorrect, true); assert.equal(b.exact, false); assert.equal(b.top3, true); assert.equal(b.top5, true);
});

// ---- fakes for the jobs
const db = { predictions: [], prediction_benchmarks: [] };
const calls = { football: [] };
const NOW = Date.parse("2026-10-20T06:00:00Z");
const fixtureList = [
  { fixture: { id: 101, date: "2026-10-20T15:00:00Z", status: { short: "NS" } }, league: { id: 39, name: "Premier League", season: 2026 }, teams: { home: { id: 1, name: "Strong FC" }, away: { id: 2, name: "Weak FC" } } },
  { fixture: { id: 102, date: "2026-10-20T06:05:00Z", status: { short: "NS" } }, league: { id: 39, name: "Premier League", season: 2026 }, teams: { home: { id: 3, name: "Mid A" }, away: { id: 4, name: "Mid B" } } }, // starts in 5 min: too late
  { fixture: { id: 103, date: "2026-10-20T18:00:00Z", status: { short: "NS" } }, league: { id: 9999, name: "Friendly", season: 2026 }, teams: { home: { id: 7, name: "X" }, away: { id: 8, name: "Y" } } }, // no table
];
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
globalThis.fetch = async (url, init = {}) => {
  try { return await fake(url, init); } catch (e) { console.error("FAKE ERROR", e); throw e; }
};
const fake = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || "GET";
  if (u.host === "v3.football.api-sports.io") {
    const ep = u.pathname.slice(1);
    if (ep === "status") return json({ response: { requests: { current: 10, limit_day: 100 } } });
    calls.football.push(ep + "?" + u.searchParams.toString());
    if (ep === "fixtures" && u.searchParams.get("status") === "NS") return json({ response: u.searchParams.get("date") === "2026-10-20" ? fixtureList : [], errors: [] });
    if (ep === "fixtures") return json({ response: [{ fixture: { id: 101, status: { short: "FT" } }, goals: { home: 3, away: 0 }, score: { fulltime: { home: 2, away: 0 } } }], errors: [] });
    if (ep === "standings") return json({ response: u.searchParams.get("league") === "39" ? [{ league: { standings: [table] } }] : [], errors: [] });
    if (ep === "odds") return json({ paging: { current: 1, total: 1 }, response: [{ fixture: { id: 101 }, bookmakers: [{ name: "Bet", bets: [{ id: 1, values: [{ value: "Home", odd: "1.40" }, { value: "Draw", odd: "4.50" }, { value: "Away", odd: "8.00" }] }, { id: 5, values: [{ value: "Over 2.5", odd: "1.90" }, { value: "Under 2.5", odd: "1.90" }] }] }] }], errors: [] });
  }
  if (u.host.endsWith("supabase.co")) {
    const t = u.pathname.split("/").pop(); const q = u.search; const b = init.body ? JSON.parse(init.body) : null;
    if (t === "predictions" || t === "prediction_benchmarks") {
      const key = t === "predictions" ? (r) => `${r.fixture_id}|${r.model}` : (r) => `${r.fixture_id}|${r.source}`;
      if (method === "POST") { for (const r of b) if (!db[t].find((x) => key(x) === key(r))) db[t].push({ status: "pending", ...r }); return json(null, 201); }
      if (method === "GET") {
        let rows = db[t];
        const inM = q.match(/fixture_id=in\.\(([\d,]+)\)/); if (inM) { const ids = inM[1].split(",").map(Number); rows = rows.filter((r) => ids.includes(Number(r.fixture_id))); }
        if (q.includes("status=eq.pending")) rows = rows.filter((r) => r.status === "pending");
        const lt = q.match(/kickoff=lt\.([^&]+)/); if (lt) rows = rows.filter((r) => new Date(r.kickoff) < new Date(decodeURIComponent(lt[1])));
        return json(rows);
      }
      if (method === "PATCH") { const id = Number(q.match(/fixture_id=eq\.(\d+)/)[1]); const r = db[t].find((x) => Number(x.fixture_id) === id && x.status === "pending"); if (r) Object.assign(r, b); return json(null, 204); }
    }
  }
  return json({}, 404);
};
const { runPredict, runGrade, parseOdds, marketProbs, valueAnalysis } = await import("../api/_predict.js");

await test("predict job: records only valid pre-match fixtures, stays in budget, never duplicates", async () => {
  const s = await runPredict({ now: NOW });
  assert.equal(s.predicted, 1, JSON.stringify(s)); // 101 only: 102 starts too soon, 103 has no table
  assert.equal(s.leaguesSkipped + s.noTable, 1); // 103's competition has no league table
  assert.ok(s.callsUsed <= s.budget);
  const r = db.predictions[0];
  assert.equal(r.fixture_id, 101); assert.ok(new Date(r.made_at) < new Date(r.kickoff));
  assert.equal(r.matrix.length, 9); assert.equal(r.inputs.form.home, "WWWDW");
  assert.ok(r.analysis?.rows.length >= 3 && !("analysis" in r.prediction));
  assert.equal(db.prediction_benchmarks[0].source, "market");
  const again = await runPredict({ now: NOW });
  assert.equal(again.predicted, 0); assert.equal(db.predictions.length, 1);
});
await test("predict job: refuses to run without quota", async () => {
  const keep = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).endsWith("/status") ? json({ response: { requests: { current: 99, limit_day: 100 } } }) : keep(url, init);
  const s = await runPredict({ now: NOW });
  assert.ok(s.skipped); globalThis.fetch = keep;
});
await test("grade job: grades on the 90-minute score and is idempotent", async () => {
  const s = await runGrade({ now: Date.parse("2026-10-21T06:00:00Z") });
  assert.equal(s.graded, 1);
  const r = db.predictions[0];
  assert.equal(r.status, "graded"); assert.equal(r.home_goals, 2); assert.equal(r.away_goals, 0); // not the extra-time 3-0
  assert.equal(r.grade.pickCorrect, true);
  assert.equal((await runGrade({ now: Date.parse("2026-10-21T07:00:00Z") })).pending, 0);
});
await test("odds: margin removed, edge and quarter-Kelly computed", () => {
  const o = parseOdds({ bookmakers: [{ name: "B", bets: [{ id: 1, values: [{ value: "Home", odd: "2.00" }, { value: "Draw", odd: "3.50" }, { value: "Away", odd: "4.00" }] }] }] });
  const p = marketProbs(o);
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  const v = valueAnalysis({ home: 0.6, draw: 0.2, away: 0.2, over25: 0.5, btts: 0.5 }, o);
  assert.ok(v.rows.find((r) => r.pick === "home").edge > 0 && v.rows.find((r) => r.pick === "home").kelly25 > 0);
});
await test("forebet import: matches by names, flags late entries, rejects junk", async () => {
  const { importForebet } = await import("../api/_report.js");
  const origGet = globalThis.fetch;
  const rows = [{ fixture_id: 101, kickoff: "2026-10-20T15:00:00Z", home_name: "Strong FC", away_name: "Weak FC" }];
  globalThis.fetch = async (url, init = {}) => { const u = new URL(url); const t = u.pathname.split("/").pop();
    if (t === "predictions") return json(rows);
    if (t === "prediction_benchmarks" && init.method === "POST") { db.prediction_benchmarks.push(...JSON.parse(init.body)); return json(null, 201); }
    return origGet(url, init); };
  const early = await importForebet("2026-10-20,Strong,Weak,60,22,18,2-0,1-0,2-1\nbad line\n2026-10-20,Nobody,Nope,50,25,25,1-0", { now: Date.parse("2026-10-20T10:00:00Z") });
  assert.equal(early.saved, 1); assert.equal(early.problems.length, 2); assert.equal(early.late, 0);
  const late = await importForebet("2026-10-20,Strong FC,Weak FC,60,22,18,2-0", { now: Date.parse("2026-10-20T20:00:00Z") });
  assert.equal(late.late, 1);
  const saved = db.prediction_benchmarks.filter((b) => b.source === "forebet");
  assert.equal(saved[0].late, false); assert.deepEqual(saved[0].top_scores, ["2-0", "1-0", "2-1"]);
  globalThis.fetch = origGet;
});
console.log(`\n${passed} tests passed`);
