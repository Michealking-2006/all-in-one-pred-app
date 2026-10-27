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

// ---- poisson-v2: what changed, one behaviour per test
const v1 = await import("../src/predictions/poisson-v1.js");
const v2 = await import("../src/predictions/model.js");
const mk = (id, hp, hf, ha, ap, af, aa, extra = {}) => ({ team: { id }, home: { played: hp, goals: { for: hf, against: ha } }, away: { played: ap, goals: { for: af, against: aa } }, ...extra });
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pois = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const league = (games) => Array.from({ length: 20 }, (_, i) => { const a = Math.exp(0.25 * (rnd() - 0.5) * 3.4), d = Math.exp(0.25 * (rnd() - 0.5) * 3.4); const g = (m) => pois(m * games / 2 * 1) ; return mk(i + 1, games / 2, g(1.5 * a * 1), g(1.2 * d), games / 2, g(1.2 * a), g(1.5 * d)); });

await test("poisson-v1 is frozen: the same table still gives exactly the same numbers", () => {
  const a = v1.predictFromTable({ homeId: 1, awayId: 2, rows: table, form: { home: ["W", "W", "W"], away: ["L", "L", "L"] } });
  assert.deepEqual({ probs: a.probs, xg: a.xg, over25: a.over25, btts: a.btts, likely: a.likelyScore, conf: a.confidence }, { probs: { home: 86, draw: 10, away: 4 }, xg: { home: 3.07, away: 0.54 }, over25: 70, btts: 40, likely: { home: 3, away: 0 }, conf: "high" });
  const b = v1.predictFromTable({ homeId: 3, awayId: 4, rows: table });
  assert.deepEqual({ probs: b.probs, xg: b.xg, over25: b.over25, btts: b.btts, likely: b.likelyScore, conf: b.confidence }, { probs: { home: 42, draw: 27, away: 31 }, xg: { home: 1.43, away: 1.18 }, over25: 49, btts: 53, likely: { home: 1, away: 1 }, conf: "medium" });
  assert.equal(v1.MODEL_VERSION, "poisson-v1"); assert.equal(v2.MODEL_VERSION, "poisson-v2");
});
await test("v2: a thin record is pulled toward the league average harder than a long one", () => {
  const avg = { home: 1.5, away: 1.2 };
  const thin = v2.strengthsOf(mk(1, 3, 8, 3, 3, 6, 3), avg, 14), full = v2.strengthsOf(mk(1, 15, 40, 15, 15, 30, 15), avg, 14); // same goals per game
  assert.ok(thin.attackHome > 1 && full.attackHome > thin.attackHome, `${thin.attackHome} ${full.attackHome}`);
  assert.ok(thin.defenceHome < 1 && full.defenceHome < thin.defenceHome);
});
await test("v2: a lopsided home/away split is partly pooled, not taken at face value", () => {
  const avg = { home: 1.5, away: 1.2 };
  const s = v2.strengthsOf(mk(1, 10, 30, 10, 10, 8, 14), avg, 14); // 3.0 goals a game at home, 0.8 away
  assert.ok(s.attackHome > s.attackAway); assert.ok(s.attackHome < 3.0 / 1.5 * 0.85, `home attack ${s.attackHome} should sit well under the raw 2.0`);
  assert.ok(s.attackAway > 0.8 / 1.2 * 1.05, `away attack ${s.attackAway} should sit above the raw 0.67`);
});
await test("v2: the league's draw rate moves the draw probability", () => {
  const withDraws = (draws) => table.map((r, i) => ({ ...r, all: { played: 16, win: 8 - draws / 2, draw: draws, lose: 8 - draws / 2 } }));
  const lots = v2.predictFromTable({ homeId: 3, awayId: 4, rows: withDraws(8) }), few = v2.predictFromTable({ homeId: 3, awayId: 4, rows: withDraws(2) });
  assert.ok(lots.exact.draw > few.exact.draw + 0.03, `${lots.exact.draw} vs ${few.exact.draw}`);
  assert.ok(lots.basis.drawBoost > 1 && few.basis.drawBoost < 1 && lots.basis.leagueDrawRate > few.basis.leagueDrawRate);
  const none = v2.predictFromTable({ homeId: 3, awayId: 4, rows: table }); // no results split in this table: no draw adjustment
  assert.equal(none.basis.drawBoost, 1); assert.equal(none.basis.leagueDrawRate, null);
});
await test("v2: form is judged against the team's own season", () => {
  const strong = mk(1, 10, 20, 5, 10, 16, 6, { all: { played: 20, win: 15, draw: 3, lose: 2 } }); // 2.4 points a game
  const weak = mk(2, 10, 6, 16, 10, 4, 20, { all: { played: 20, win: 3, draw: 3, lose: 14 } });    // 0.6 a game
  const W5 = ["W", "W", "W", "W", "W"], L5 = ["L", "L", "L", "L", "L"];
  assert.ok(v2.formShift(W5, strong) > 0 && v2.formShift(W5, strong) < v2.formShift(W5, weak)); // winning is normal for a strong side
  assert.ok(v2.formShift(L5, strong) < v2.formShift(L5, weak)); // losing is the real news
  for (const x of [W5, L5]) for (const r of [strong, weak]) assert.ok(Math.abs(v2.formShift(x, r)) <= 0.05 + 1e-12);
  assert.equal(v2.formShift(["W", "W"], strong), 0); assert.equal(v2.formShift(undefined, strong), 0);
  // And a side in good form nudges its opponent's expected goals down.
  const base = v2.predictFromTable({ homeId: 3, awayId: 4, rows: table }), hot = v2.predictFromTable({ homeId: 3, awayId: 4, rows: table, form: { home: W5 } });
  assert.ok(hot.xg.home >= base.xg.home && hot.xg.away <= base.xg.away);
});
await test("v2: shrinkage is measured from the table: near-equal teams are pulled harder than a league with a clear spread", () => {
  const avg = { home: 1.5, away: 1.2 };
  const equal = Array.from({ length: 20 }, (_, i) => mk(i + 1, 10, 15, 12, 10, 12, 15));                                   // every team identical
  const spread = Array.from({ length: 20 }, (_, i) => { const k = 0.5 + i * 0.08; return mk(i + 1, 10, Math.round(15 * k), Math.round(12 / k), 10, Math.round(12 * k), Math.round(15 / k)); }); // 0.5x to 2x
  const kEqual = v2.estimateKappa(equal, avg), kSpread = v2.estimateKappa(spread, avg);
  assert.equal(kEqual, 40); assert.ok(kSpread >= 8 && kSpread < kEqual, `${kSpread}`);
  assert.equal(v2.estimateKappa(table, avg), 14); // 4 teams are too few to measure anything
  seed = 99; const k = v2.estimateKappa(league(20), avg); assert.ok(k >= 8 && k <= 40);
});
await test("v2: confidence needs a real sample as well as a clear favourite", () => {
  const few = table.map((r) => ({ ...r, home: { ...r.home, played: 2 }, away: { ...r.away, played: 2 } }));
  assert.equal(v2.predictFromTable({ homeId: 1, awayId: 2, rows: few }).confidence, "low");
  const big = v2.predictFromTable({ homeId: 1, awayId: 2, rows: table }); // 16 games each, strong v weak
  assert.equal(big.confidence, "high"); assert.equal(big.pick, "home");
});
await test("v2: on a league whose true strengths are known, it is no worse than v1 (and usually better)", () => {
  // A small synthetic check of the machinery, not proof about real football: results are drawn from the same
  // kind of model the table is read with. Fixed seed, so it is repeatable.
  seed = 2026; let l1 = 0, l2 = 0, n = 0;
  for (let rep = 0; rep < 40; rep++) {
    const T = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, a: Math.exp(0.25 * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.283 * rnd())), d: Math.exp(0.25 * Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.283 * rnd())) }));
    const rows = T.map((t) => mk(t.id, 0, 0, 0, 0, 0, 0)); const game = (i, j) => [pois(1.5 * T[i].a * T[j].d), pois(1.2 * T[j].a * T[i].d)];
    const order = []; for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) if (i !== j) order.push([i, j]); order.sort(() => rnd() - 0.5);
    order.slice(0, 160).forEach(([i, j]) => { const [h, a] = game(i, j); rows[i].home.played++; rows[j].away.played++; rows[i].home.goals.for += h; rows[i].home.goals.against += a; rows[j].away.goals.for += a; rows[j].away.goals.against += h; });
    for (const [i, j] of order.slice(160, 200)) {
      const [h, a] = game(i, j), out = h > a ? "home" : h < a ? "away" : "draw";
      l1 += -Math.log(v1.predictFromTable({ homeId: T[i].id, awayId: T[j].id, rows }).exact[out]); l2 += -Math.log(v2.predictFromTable({ homeId: T[i].id, awayId: T[j].id, rows }).exact[out]); n++;
    }
  }
  assert.ok(l2 / n <= l1 / n + 0.002, `v2 ${(l2 / n).toFixed(4)} v1 ${(l1 / n).toFixed(4)}`);
});

const v3 = await import("../src/predictions/ratings.js");
await test("v3: needs a real sample, then rates a dominant team above a poor one and credits strong opposition", () => {
  assert.equal(v3.predictFromMatches({ homeId: 1, awayId: 2, matches: [{ date: 0, home: 1, away: 2, hg: 1, ag: 0 }] }), null);
  seed = 11; const ms = []; let t = 0;
  for (let k = 0; k < 4; k++) for (let i = 1; i <= 8; i++) for (let j = 1; j <= 8; j++) if (i !== j) ms.push({ date: (t++) * 864e5 / 4, home: i, away: j, hg: pois(1.4 * (i === 1 ? 2 : 1) * (j === 2 ? 2 : 1)), ag: pois(1.1 * (j === 1 ? 2 : 1) * (i === 2 ? 2 : 1)) });
  const now = t * 864e5 / 4;
  const p = v3.predictFromMatches({ homeId: 1, awayId: 2, matches: ms, now });
  assert.ok(p.exact.home > p.exact.away && Math.abs(p.exact.home + p.exact.draw + p.exact.away - 1) < 1e-9 && p.model === "ratings-v3");
  assert.equal(p.matrix.length, 9); assert.ok(p.basis.homeAdvantage > 1);
  const fit = v3.fitRatings(ms, now); assert.ok(fit.A.get(1) > 1.4 && fit.D.get(2) > 1.4); // team 1 attacks, team 2 defends badly
  assert.equal(v3.predictFromMatches({ homeId: 1, awayId: 99, matches: ms, now }), null); // unknown team
});
await test("v3: older results count less", () => {
  const base = []; for (let i = 0; i < 60; i++) base.push({ home: 1 + i % 6, away: 1 + (i + 1 + (i >> 3)) % 6, hg: 1, ag: 1 }); // placeholder: all level
  const mk2 = (oldDate, newDate) => base.map((m, i) => ({ ...m, date: i < 30 ? oldDate : newDate, hg: m.home === 1 && i < 30 ? 4 : 1 }));
  const now = 400 * 864e5;
  const ancient = v3.fitRatings(mk2(0, now), now).A.get(1), recent = v3.fitRatings(mk2(now, now), now).A.get(1);
  assert.ok(ancient < recent, `${ancient} < ${recent}`);
});
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
    if (t === "api_cache") {
      if (!db.api_cache) return json({ message: "relation does not exist" }, 404); // as if migration 008 hasn't been run
      if (method === "POST") { for (const r of b) { db.api_cache = db.api_cache.filter((x) => x.key !== r.key); db.api_cache.push(r); } return json(null, 201); }
      const k = decodeURIComponent(q.match(/key=eq\.([^&]+)/)[1]); return json(db.api_cache.filter((x) => x.key === k));
    }
    if (t === "predictions" || t === "prediction_benchmarks") {
      const key = t === "predictions" ? (r) => `${r.fixture_id}|${r.model}` : (r) => `${r.fixture_id}|${r.source}`;
      if (method === "POST") { for (const r of b) if (!db[t].find((x) => key(x) === key(r))) db[t].push({ status: "pending", ...r }); return json(null, 201); }
      if (method === "GET") {
        let rows = db[t];
        const inM = q.match(/fixture_id=in\.\(([\d,]+)\)/); if (inM) { const ids = inM[1].split(",").map(Number); rows = rows.filter((r) => ids.includes(Number(r.fixture_id))); }
        const mm = q.match(/model=eq\.([\w.-]+)/); if (mm) rows = rows.filter((r) => r.model === mm[1]);
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
  assert.equal(s.shadow, 1); // and the older model is recorded beside it on the same match
  assert.equal(s.leaguesSkipped + s.noTable, 1); // 103's competition has no league table
  assert.ok(s.callsUsed <= s.budget);
  assert.deepEqual(db.predictions.map((x) => x.model).sort(), ["poisson-v1", "poisson-v2"]);
  assert.equal(db.predictions[0].made_at, db.predictions[1].made_at); // same run, same inputs
  const r = db.predictions.find((x) => x.model === "poisson-v2");
  assert.equal(r.fixture_id, 101); assert.ok(new Date(r.made_at) < new Date(r.kickoff));
  assert.equal(r.matrix.length, 9); assert.equal(r.inputs.form.home, "WWWDW");
  assert.ok(r.analysis?.rows.length >= 3 && !("analysis" in r.prediction));
  assert.equal(db.prediction_benchmarks[0].source, "market");
  const again = await runPredict({ now: NOW });
  assert.equal(again.predicted, 0); assert.equal(again.shadow, 0); assert.equal(db.predictions.length, 2);
});
await test("predict job: a match that only has the older model's row gets the new one, and the old row is never touched", async () => {
  const i = db.predictions.findIndex((x) => x.model === "poisson-v2");
  const [removed] = db.predictions.splice(i, 1); // as if v2 had just been deployed
  const oldRow = db.predictions[0]; const before = JSON.stringify(oldRow);
  const s = await runPredict({ now: NOW + 60000 });
  assert.equal(s.predicted, 1); assert.equal(s.shadow, 0);
  assert.equal(db.predictions.length, 2); assert.equal(JSON.stringify(oldRow), before);
  assert.ok(db.predictions.find((x) => x.model === "poisson-v2").made_at > removed.made_at);
  db.predictions.find((x) => x.model === "poisson-v2").made_at = removed.made_at; // keep the later tests simple
});
await test("predict job: tables and season results are reused from the shared snapshot cache, and it is optional", async () => {
  const { clearMemo } = await import("../api/_predict.js");
  db.api_cache = []; db.predictions.length = 0; clearMemo();
  const standings = () => calls.football.filter((c) => c.startsWith("standings")).length;
  const before = standings(); await runPredict({ now: NOW });
  assert.equal(standings(), before + 2); assert.equal(db.api_cache.length >= 2, true); // the league and the competition with no table
  const stored = db.api_cache.find((r) => r.key.startsWith("standings"));
  assert.ok(stored.data.response); assert.equal(db.predictions.length, 2);
  db.predictions.length = 0; clearMemo(); // a new function instance, the next run
  const mid = standings(); const again = await runPredict({ now: NOW + 3600000 });
  assert.equal(standings(), mid, "the table came from the snapshot, no football API call"); assert.equal(again.predicted, 1);
  stored.fetched_at = new Date(Date.now() - 4 * 3600000).toISOString(); db.predictions.length = 0; clearMemo(); // older than 3 hours: refetch
  const old = standings(); await runPredict({ now: NOW + 7200000 }); assert.equal(standings(), old + 1); // only the stale snapshot is refetched
  delete db.api_cache; db.predictions.length = 0; clearMemo(); // migration not run: still works
  const none = await runPredict({ now: NOW + 9000000 }); assert.equal(none.predicted, 1);
});
await test("predict job: refuses to run without quota", async () => {
  const keep = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).endsWith("/status") ? json({ response: { requests: { current: 99, limit_day: 100 } } }) : keep(url, init);
  const s = await runPredict({ now: NOW });
  assert.ok(s.skipped); globalThis.fetch = keep;
});
await test("grade job: grades on the 90-minute score and is idempotent", async () => {
  const s = await runGrade({ now: Date.parse("2026-10-21T06:00:00Z") });
  assert.equal(s.graded, 2); // one row per model
  for (const r of db.predictions) { assert.equal(r.status, "graded"); assert.equal(r.home_goals, 2); assert.equal(r.away_goals, 0); assert.equal(r.grade.pickCorrect, true); } // not the extra-time 3-0
  assert.equal((await runGrade({ now: Date.parse("2026-10-21T07:00:00Z") })).pending, 0);
});
await test("report: the current model is compared with the older one on the matches both predicted", async () => {
  const { adminReport } = await import("../api/_report.js");
  const r = await adminReport();
  assert.equal(r.model, "poisson-v2"); assert.deepEqual(r.modelCompare.map((m) => m.model), ["poisson-v1", "ratings-v3"]);
  assert.equal(r.modelCompare[1].n, 0); // v3 needs a season of results: the fake league has one match
  const c = r.modelCompare[0]; assert.equal(c.model, "poisson-v1"); assert.equal(c.n, 1);
  assert.equal(c.current.n, 1); assert.equal(c.other.n, 1); assert.ok(c.current.logLoss > 0 && c.other.logLoss > 0);
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
