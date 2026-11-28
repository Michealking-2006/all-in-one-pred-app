// Run with:  node tests/slip.test.mjs   (no network, no browser)
// The Slip Generator's rules: which picks exist, what each risk level allows, and the slip's odds and win chance.
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { BET_TYPES, RISKS, MARGIN, totalsFrom, candidatesFor, buildSlip, buildDifferent, swapPick, relaxSuggestion, summarise, returnsFor, slipTier } = await import("../src/predictions/slip.js");

const inHours = (h) => new Date(Date.now() + h * 3600000).toISOString(); // dates relative to now, so the tests never go stale
const match = (id, league, h, d, a, over, btts, date) => ({
  fx: { fixture: { id, date }, league: { id: league, name: "League " + league }, teams: { home: { name: "Home" + id }, away: { name: "Away" + id } } },
  prediction: { probs: { home: h, draw: d, away: a }, over25: over, btts, xg: { home: 1.6, away: 1.0 } },
});
const pool = [
  match(1, 1, 70, 18, 12, 55, 50, inHours(3)), match(2, 1, 20, 25, 55, 40, 45, inHours(5)),
  match(3, 2, 48, 28, 24, 62, 58, inHours(7)), match(4, 2, 33, 33, 34, 50, 50, inHours(8)),
];
const all = BET_TYPES.map((t) => t.id);

await test("goal lines agree with each other and with the model's Over 2.5", () => {
  const t = totalsFrom({ over25: 55, xg: { home: 1.6, away: 1 } });
  assert.equal(Math.round(t.over25 * 100), 55);
  assert.ok(t.over15 > t.over25 && t.over25 > t.over35, "more goals needed means less likely");
  const hi = totalsFrom({ over25: 80, xg: { home: 2, away: 1.6 } }), lo = totalsFrom({ over25: 30, xg: { home: 0.8, away: 0.7 } });
  assert.ok(hi.over35 > lo.over35);
});
await test("odds are the model's fair price less the margin; locked matches offer nothing", () => {
  const c = candidatesFor(pool[0].prediction, pool[0].fx, ["winner"]);
  const home = c.find((x) => x.pick === "home");
  assert.equal(home.odds, Math.round((MARGIN / 0.7) * 100) / 100);
  assert.equal(home.label, "Home1 to win");
  assert.deepEqual(candidatesFor({ locked: true }, pool[0].fx, all), []);
  assert.deepEqual(candidatesFor(null, pool[0].fx, all), []);
  assert.ok(candidatesFor(pool[0].prediction, pool[0].fx, ["dc"]).every((x) => x.type === "dc"), "only the chosen bet types");
});
await test("each risk level keeps to its own floor, one pick per match", () => {
  for (const risk of Object.keys(RISKS)) {
    const s = buildSlip(pool, { games: 4, risk, minOdds: 1.1 });
    assert.ok(s.picks.every((c) => c.p >= RISKS[risk].minP), risk + " floor");
    assert.equal(new Set(s.picks.map((c) => c.fixtureId)).size, s.picks.length, risk + " one per match");
  }
  const safe = buildSlip(pool, { games: 3, risk: "safe", minOdds: 1.1 }), risky = buildSlip(pool, { games: 3, risk: "risky", minOdds: 1.1 });
  assert.ok(safe.winChance > risky.winChance && risky.totalOdds > safe.totalOdds, "safe wins more often, risky pays more");
});
await test("total odds multiply, win chance is the product, returns follow the stake", () => {
  const s = buildSlip(pool, { games: 2, risk: "balanced", minOdds: 1.1 });
  assert.equal(s.totalOdds, Math.round(s.picks.reduce((t, c) => t * c.odds, 1) * 100) / 100);
  assert.ok(Math.abs(s.winChance - s.picks.reduce((t, c) => t * c.p, 1)) < 1e-12);
  assert.equal(returnsFor(10, 3.48), 34.8);
});
await test("filters: minimum odds, leagues and bet types; a slip that can't be filled says how short it is", () => {
  assert.equal(buildSlip(pool, { games: 2, risk: "safe", minOdds: 1.8 }).short, 2, "nothing safe pays 1.80");
  assert.ok(buildSlip(pool, { games: 2, risk: "balanced", minOdds: 1.1, leagues: [2] }).picks.every((c) => c.fx.league.id === 2));
  assert.ok(buildSlip(pool, { games: 3, risk: "safe", minOdds: 1.1, types: ["btts"] }).picks.every((c) => c.type === "btts"));
  const s = buildSlip(pool, { games: 7, risk: "safe", minOdds: 1.1 });
  assert.equal(s.short, 7 - s.picks.length);
  assert.deepEqual(buildSlip([], { games: 3 }).picks, []);
});
await test("games are clamped to 2-7, picks come out in kick-off order, and a jitter only reshuffles", () => {
  assert.ok(buildSlip(pool, { games: 99, risk: "risky", minOdds: 1.1 }).picks.length <= 7);
  const s = buildSlip(pool, { games: 4, risk: "risky", minOdds: 1.1 });
  const times = s.picks.map((c) => Date.parse(c.fx.fixture.date));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  let n = 0; const rng = () => ((n = (n * 7 + 3) % 10) / 10);
  const j = buildSlip(pool, { games: 4, risk: "risky", minOdds: 1.1, jitter: 0.2, rng });
  assert.ok(j.picks.every((c) => c.p >= RISKS.risky.minP));
});
await test("slip tiers", () => {
  assert.equal(slipTier(0.7).id, "high"); assert.equal(slipTier(0.3).id, "mid"); assert.equal(slipTier(0.04).id, "low");
});
await test("locked picks stay on a rebuilt slip, even if the settings would no longer choose them", () => {
  const first = buildSlip(pool, { games: 3, risk: "safe", minOdds: 1.1 });
  const keep = first.picks[0];
  const again = buildSlip(pool, { games: 3, risk: "risky", minOdds: 1.1, locked: [keep] });
  assert.ok(again.picks.some((c) => c.fixtureId === keep.fixtureId && c.pick === keep.pick && c.type === keep.type), "kept");
  assert.equal(new Set(again.picks.map((c) => c.fixtureId)).size, again.picks.length, "still one per match");
  assert.equal(buildSlip(pool, { games: 3, risk: "safe", minOdds: 1.1, locked: [keep], skip: new Set([keep.fixtureId]) }).picks.filter((c) => c.fixtureId === keep.fixtureId).length, 1);
});
await test("a match that has started (or starts within 5 minutes) is never offered or kept", () => {
  const soon = match(9, 1, 80, 12, 8, 55, 50, inHours(0.05)), done = match(10, 1, 80, 12, 8, 55, 50, inHours(-1));
  assert.ok(!buildSlip([soon, done], { games: 2, risk: "safe", minOdds: 1.1 }).picks.length, "none offered");
  const stale = buildSlip(pool, { games: 2, risk: "safe", minOdds: 1.1 }).picks[0];
  const late = buildSlip([], { games: 2, locked: [{ ...stale, fx: { ...stale.fx, fixture: { ...stale.fx.fixture, date: inHours(-2) } } }] });
  assert.equal(late.picks.length, 0, "a locked pick whose match has started is dropped");
});
await test("swap replaces one pick with a different match; null when nothing else fits", () => {
  const slip = buildSlip(pool, { games: 2, risk: "balanced", minOdds: 1.1 });
  const swapped = swapPick(pool, slip.picks, 0, { risk: "balanced", minOdds: 1.1 });
  assert.equal(swapped.picks.length, 2);
  assert.ok(!swapped.picks.some((c) => c.fixtureId === slip.picks[0].fixtureId), "the old match is gone");
  assert.equal(new Set(swapped.picks.map((c) => c.fixtureId)).size, 2);
  assert.ok(Math.abs(swapped.winChance - swapped.picks.reduce((t, c) => t * c.p, 1)) < 1e-12, "totals are recomputed");
  const full = buildSlip(pool, { games: 4, risk: "risky", minOdds: 1.1 });
  assert.equal(swapPick(pool, full.picks, 0, { risk: "risky", minOdds: 1.1 }), null);
  assert.equal(swapPick(pool, full.picks, 99, {}), null);
  assert.equal(summarise([]).totalOdds, 0);
});
await test("build another gives a different slip when one exists, and still answers when only one is possible", () => {
  const opts = { games: 2, risk: "balanced", minOdds: 1.1 };
  const first = buildSlip(pool, opts), key = (picks) => picks.map((c) => c.fixtureId + c.type + c.pick).sort().join();
  let n = 0; const rng = () => ((n = (n * 7 + 3) % 10) / 10);
  const next = buildDifferent(pool, { ...opts, rng }, first.picks);
  assert.equal(next.picks.length, 2);
  assert.notEqual(key(next.picks), key(first.picks), "different");
  const only = [pool[0], pool[1]];
  const same = buildDifferent(only, { ...opts, games: 2 }, buildSlip(only, { ...opts, games: 2 }).picks); // only one slip is possible: it still returns it
  assert.ok(same.picks.length <= 2);
});
await test("when a slip can't be filled, the smallest fix that would fill it is suggested", () => {
  const strict = { games: 3, risk: "safe", minOdds: 1.8, leagues: [], types: all };
  const fix = relaxSuggestion(pool, strict);
  assert.ok(fix && fix.patch, "a suggestion");
  assert.ok(buildSlip(pool, { ...strict, ...fix.patch }).picks.length > buildSlip(pool, strict).picks.length, "it helps");
  assert.equal(relaxSuggestion(pool, { games: 2, risk: "balanced", minOdds: 1.1, types: all }), null, "nothing to fix when it fills");
  assert.equal(relaxSuggestion([], { games: 3, risk: "risky", minOdds: 1.1, types: all }), null, "no matches at all: nothing helps");
});
await test("exact markets from the stored grid are used when the server sent them, the goals curve only otherwise", () => {
  const withGrid = { ...pool[0], prediction: { ...pool[0].prediction, markets: { home: 0.5, draw: 0.35, away: 0.15, dc1x: 0.85, dcx2: 0.5, dc12: 0.65, over15: 0.62, over25: 0.27, over35: 0.1, btts: 0.42 } } };
  const t = totalsFrom(withGrid.prediction);
  assert.deepEqual(t, { over15: 0.62, over25: 0.27, over35: 0.1 });
  const c = candidatesFor(withGrid.prediction, withGrid.fx, all);
  const find = (type, pick) => c.find((x) => x.type === type && x.pick === pick);
  assert.equal(find("dc", "1x").p, 0.85); assert.equal(find("dc", "12").p, 0.65); assert.equal(find("btts", "yes").p, 0.42);
  assert.equal(find("ou15", "over").p, 0.62); assert.equal(Math.round(find("ou35", "under").p * 100), 90);
  assert.equal(find("winner", "home").p, 0.5, "the grid's own win figure");
  const old = totalsFrom(pool[0].prediction); assert.ok(old.over15 > old.over25, "older rows still work");
});
console.log(`\n${passed} passed`);
