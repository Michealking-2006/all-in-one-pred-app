// Run with:  node tests/club.test.mjs   (pure logic: club cards, performance tiers, list drawing)
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { lastResults, formString, topPerformers, standingsWindow, pickTable, seasonRank, historyChart, rankIn } = await import("../src/clubStats.js");

const fx = (id, ts, home, away, gh, ga, status = "FT") => ({ fixture: { id, timestamp: ts, status: { short: status } }, teams: { home: { id: home, name: "T" + home, logo: "l" + home }, away: { id: away, name: "T" + away, logo: "l" + away } }, goals: { home: gh, away: ga } });
const ME = 529;
const matches = [fx(1, 100, ME, 2, 7, 2), fx(2, 200, 3, ME, 1, 3), fx(3, 300, ME, 4, 0, 0), fx(4, 400, 5, ME, 4, 1), fx(5, 500, ME, 6, 2, 5), fx(6, 600, ME, 7, 1, 0), fx(7, 700, 8, ME, 0, 0, "NS")];

await test("last five: newest first, only finished matches, score as played, result for the club", () => {
  const r = lastResults(matches, ME, 5);
  assert.deepEqual(r.map((x) => x.fixtureId), [6, 5, 4, 3, 2]);
  assert.deepEqual(r.map((x) => x.result), ["W", "L", "L", "D", "W"]);
  assert.equal(r[4].score, "1-3"); assert.equal(r[4].home, false); assert.equal(r[4].opponent.id, 3); assert.equal(r[4].goalsFor, 3);
  assert.equal(lastResults(matches, ME, 3).length, 3); assert.deepEqual(lastResults([], ME), []); assert.deepEqual(lastResults(null, ME), []);
  assert.equal(formString(matches, ME, 5), "WDLLW"); // oldest to newest for the chips under the crest
});

const player = (id, name, stats) => ({ player: { id, name, photo: "p" + id }, statistics: stats });
const stat = (team, apps, goals, pens, assists, rating) => ({ team: { id: team }, games: { appearences: apps, rating }, goals: { total: goals, assists }, penalty: { scored: pens } });
await test("top performers: adds up competitions, ignores other clubs, needs real minutes for a rating", () => {
  const rows = [
    player(1, "Striker", [stat(ME, 20, 9, 2, 3, "7.40"), stat(ME, 6, 3, 1, 0, "7.00"), stat(99, 10, 40, 0, 0, "9.9")]), // loan: other club's numbers must not count
    player(2, "Winger", [stat(ME, 25, 4, 0, 11, "7.10")]),
    player(3, "Keeper", [stat(ME, 30, 0, 0, 0, "7.55")]),
    player(4, "Sub", [stat(ME, 2, 1, 0, 0, "9.50")]), // too few games to be "best rated"
    player(5, "Away", [stat(99, 30, 30, 0, 30, "9.0")]),
  ];
  const t = topPerformers(rows, ME);
  assert.equal(t.scorer.name, "Striker"); assert.equal(t.scorer.goals, 12); assert.equal(t.scorer.pens, 3);
  assert.equal(t.assister.name, "Winger"); assert.equal(t.assister.assists, 11);
  assert.equal(t.rated.name, "Keeper"); assert.ok(Math.abs(t.rated.rating - 7.55) < 1e-9);
  assert.deepEqual(topPerformers([], ME), { scorer: null, assister: null, rated: null });
  assert.equal(topPerformers([player(6, "Nil", [stat(ME, 10, 0, 0, 0, null)])], ME).scorer, null);
});

const tbl = (ranks) => ranks.map((r) => ({ rank: r, team: { id: 1000 + r, name: "T" + r }, points: 50 - r, all: { played: 9 } }));
await test("standings slice: the club in the middle, or the nearest three at the ends", () => {
  const rows = tbl([1, 2, 3, 4, 5, 6, 7, 8]);
  const ids = (me) => standingsWindow(rows, me).map((r) => r.rank);
  assert.deepEqual(ids(1004), [3, 4, 5]); assert.deepEqual(ids(1001), [1, 2, 3]); assert.deepEqual(ids(1008), [6, 7, 8]); assert.deepEqual(ids(1002), [1, 2, 3]);
  assert.deepEqual(standingsWindow(rows, 77777), []); assert.deepEqual(standingsWindow(null, 1), []);
  assert.deepEqual(standingsWindow(tbl([1, 2]), 1001).map((r) => r.rank), [1, 2]);
});

const league = (id, name, ranks) => ({ league: { id, name, standings: [tbl(ranks)] } });
await test("history: picks the club's own league, copes with promotion and missing seasons", () => {
  const resp = [league(2, "Champions League", Array.from({ length: 36 }, (_, i) => i + 1)), league(140, "La Liga", Array.from({ length: 20 }, (_, i) => i + 1))];
  assert.equal(pickTable(resp, 140).league.name, "La Liga");
  assert.equal(seasonRank(resp, 1003, 140).rank, 3); assert.equal(seasonRank(resp, 1003, 140).teams, 20);
  assert.equal(seasonRank(resp, 5555, 140), null);
  const promoted = [league(141, "Segunda", Array.from({ length: 22 }, (_, i) => i + 1))];
  assert.equal(seasonRank(promoted, 1005, 140).league, "Segunda"); // club's usual league isn't there that year: use the table it had
  assert.equal(seasonRank([], 1, 1), null); assert.equal(seasonRank(null, 1, 1), null);
});
await test("history chart: rank 1 on top, gaps break the line, points stay inside the frame", () => {
  const g = historyChart([{ season: 2018, rank: 1 }, { season: 2019, rank: 2 }, { season: 2020, rank: null }, { season: 2021, rank: 3 }, { season: 2022, rank: 1 }]);
  assert.equal(g.segments.length, 2); assert.deepEqual(g.segments.map((s) => s.length), [2, 2]);
  const top = g.coords[0], low = g.coords[3];
  assert.ok(top.y < g.coords[1].y && g.coords[1].y < low.y);
  for (const c of g.coords.filter(Boolean)) assert.ok(c.x >= 0 && c.x <= g.width && c.y >= 0 && c.y <= g.height);
  assert.equal(g.coords[2], null);
  assert.equal(historyChart([{ season: 2020, rank: 5 }]).coords[0].x, 160); // a single season sits in the middle
  assert.equal(historyChart([{ season: 1, rank: null }]).segments.length, 0);
});

await test("match header position: a club's place in the competition table, nothing for cups without one", () => {
  const resp = [league(2, "Champions League", Array.from({ length: 36 }, (_, i) => i + 1))];
  assert.equal(rankIn(resp, 2, 1002), 2); assert.equal(rankIn(resp, 2, 1036), 36);
  assert.equal(rankIn(resp, 2, 99999), null); assert.equal(rankIn([], 2, 1002), null); assert.equal(rankIn(null, 2, 1002), null); assert.equal(rankIn([{ league: { id: 2, standings: [] } }], 2, 1002), null);
  assert.equal(rankIn(resp, 777, 1005), 5, "a table for a different league id is still the only table we have, so the club's place in it is used");
});

// ------------------------------------------------------------------ performance tiers
const { detectTier, tierFor } = await import("../src/perf.js");
await test("performance tiers: 1 GB phones get the lightest mode", () => {
  assert.equal(detectTier({ deviceMemory: 0.5 }), 2); assert.equal(detectTier({ deviceMemory: 1 }), 2);
  assert.equal(detectTier({ deviceMemory: 2 }), 1); assert.equal(detectTier({ deviceMemory: 4 }), 0); assert.equal(detectTier({ deviceMemory: 8, hardwareConcurrency: 8 }), 0);
  assert.equal(detectTier({ hardwareConcurrency: 4, userAgent: "Mozilla/5.0 (Linux; Android 13)" }), 1); // no memory info, weak Android phone
  assert.equal(detectTier({ hardwareConcurrency: 8, userAgent: "Android" }), 0);
  assert.equal(detectTier({ deviceMemory: 8, connection: { saveData: true } }), 1); assert.equal(detectTier({ deviceMemory: 8, connection: { effectiveType: "2g" } }), 1);
  assert.equal(detectTier({}), 0); assert.equal(detectTier(null), 0);
});
await test("performance tiers: the Appearance switch overrides detection", () => {
  assert.equal(tierFor("off", { deviceMemory: 1 }), 0);
  assert.equal(tierFor("on", { deviceMemory: 8 }), 1); assert.equal(tierFor("on", { deviceMemory: 1 }), 2);
  assert.equal(tierFor("auto", { deviceMemory: 1 }), 2); assert.equal(tierFor(undefined, { deviceMemory: 4 }), 0);
});
console.log(`\n${passed} tests passed`);
