// Run with:  node tests/live-features.test.mjs   (which side scored, own-club goals, the confetti burst, what the live card shows and when to poll)
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const memory = {};
globalThis.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = String(v); }, removeItem: (k) => { delete memory[k]; } };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage, location: { hash: "" } };
globalThis.document = { documentElement: { dataset: {}, style: {} }, hidden: false, addEventListener() {} };

const { detectEvents, resetLiveAlerts } = await import("../src/liveAlerts.js");
const { CLUBS } = await import("../src/clubs.js");
const { confettiPieces, confettiColors, ownClubScored } = await import("../src/goalCelebration.js");
const { pollDue, pinnedRows } = await import("../src/liveWatch.js");
const { minuteLabel } = await import("../src/components/LiveCard.js");

const chelsea = CLUBS.find((c) => c.id === "chelsea"); // teamId 49
const fx = (id, status, gh, ga, home = 49, away = 33, extra = {}) => ({ fixture: { id, status: { short: status, elapsed: 34, ...extra }, date: new Date(1e12).toISOString(), timestamp: 1000 + id }, goals: { home: gh, away: ga }, teams: { home: { id: home, name: "H" + home, logo: "l" }, away: { id: away, name: "A" + away, logo: "l" } } });

await test("a goal says which side scored; the first sighting never alerts", () => {
  resetLiveAlerts();
  assert.equal(detectEvents([fx(1, "1H", 0, 0)]).length, 0);
  const home = detectEvents([fx(1, "1H", 1, 0)]); assert.equal(home[0].type, "goal"); assert.equal(home[0].side, "home");
  const away = detectEvents([fx(1, "1H", 1, 1)]); assert.equal(away[0].side, "away");
  const both = detectEvents([fx(1, "2H", 2, 2)]); assert.equal(both[0].side, "both");
  assert.equal(detectEvents([fx(1, "2H", 2, 2)]).length, 0);
});
await test("own club: celebrates its own goals (home or away), not the opponent's, and nothing with no club", () => {
  resetLiveAlerts(); detectEvents([fx(2, "1H", 0, 0), fx(3, "1H", 0, 0, 33, 49)]);
  const mineHome = detectEvents([fx(2, "1H", 1, 0)])[0], theirsHome = detectEvents([fx(2, "1H", 1, 1)])[0];
  assert.equal(ownClubScored(mineHome, chelsea), true); assert.equal(ownClubScored(theirsHome, chelsea), false);
  const mineAway = detectEvents([fx(3, "1H", 0, 1, 33, 49)])[0], theirsAway = detectEvents([fx(3, "1H", 1, 1, 33, 49)])[0];
  assert.equal(ownClubScored(mineAway, chelsea), true); assert.equal(ownClubScored(theirsAway, chelsea), false);
  assert.equal(ownClubScored(mineHome, null), false);
  assert.equal(ownClubScored({ type: "half", fx: mineHome.fx, side: "home" }, chelsea), false);
  resetLiveAlerts(); detectEvents([fx(4, "1H", 0, 0, 10, 11)]);
  assert.equal(ownClubScored(detectEvents([fx(4, "1H", 1, 0, 10, 11)])[0], chelsea), false, "a match your club isn't in");
});
await test("confetti: a seeded burst flies up in a cone, uses the club's colours and stays inside sane limits", () => {
  let n = 0; const rand = () => ((n = (n * 9301 + 49297 + 1) % 233280) / 233280);
  const colors = confettiColors(chelsea);
  assert.ok(colors.includes(chelsea.primary) && colors.includes(chelsea.secondary) && colors.includes("#ffffff"));
  assert.ok(colors.every((c) => /^#[0-9a-f]{6}$/i.test(c)));
  const pieces = confettiPieces(colors, 30, rand);
  assert.equal(pieces.length, 30);
  for (const p of pieces) {
    assert.ok(p.uy < 0, "launched upward"); assert.ok(Math.hypot(p.ux, p.uy) <= 290);
    assert.ok(p.fall >= 300 && p.fall <= 660); assert.ok(p.dur >= 1.9 && p.dur <= 2.8); assert.ok(p.delay >= 0 && p.delay <= 0.12);
    assert.ok(colors.includes(p.color));
  }
  assert.equal(new Set(pieces.map((p) => p.color)).size, new Set(colors).size);
  assert.equal(confettiPieces(colors, 0).length, 0);
});

await test("live card: only starred matches in play, not the one already open, hidden until the next goal", () => {
  const known = new Map([[10, fx(10, "2H", 1, 0)], [11, fx(11, "NS", 0, 0)], [12, fx(12, "FT", 2, 2)], [13, fx(13, "HT", 0, 0)], [99, fx(99, "1H", 0, 0)]]);
  const ids = (rows) => rows.map((r) => r.fixture.id);
  assert.deepEqual(ids(pinnedRows(known, { starred: [10, 11, 12, 13], openId: null, hidden: {} })), [10, 13]); // 99 is not starred
  assert.deepEqual(ids(pinnedRows(known, { starred: [10, 13], openId: 10, hidden: {} })), [13]);
  assert.deepEqual(ids(pinnedRows(known, { starred: [10, 13], openId: null, hidden: { 10: 1 } })), [13]); // hidden at 1 goal
  known.set(10, fx(10, "2H", 2, 0));
  assert.deepEqual(ids(pinnedRows(known, { starred: [10, 13], openId: null, hidden: { 10: 1 } })), [10, 13]); // a goal brings it back
});
await test("live card: minute labels", () => {
  assert.equal(minuteLabel(fx(1, "2H", 0, 0)), "34'"); assert.equal(minuteLabel(fx(1, "HT", 0, 0)), "HT");
  assert.equal(minuteLabel(fx(1, "2H", 0, 0, 1, 2, { elapsed: 90, extra: 4 })), "90+4'"); assert.equal(minuteLabel(fx(1, "P", 0, 0)), "Pens");
});
await test("polling: first look always, then only when something is live or about to start, else every 5 minutes", () => {
  const now = Date.parse("2026-11-14T15:00:00Z");
  const at = (min, status) => { const f = fx(1, status, 0, 0); f.fixture.date = new Date(now + min * 60000).toISOString(); return f; };
  assert.equal(pollDue(new Map(), now, 0), true);
  assert.equal(pollDue(new Map([[1, at(-30, "2H")]]), now, now - 1000), true, "live");
  assert.equal(pollDue(new Map([[1, at(10, "NS")]]), now, now - 1000), true, "kicks off within 15 minutes");
  assert.equal(pollDue(new Map([[1, at(180, "NS")]]), now, now - 1000), false, "hours away");
  assert.equal(pollDue(new Map([[1, at(-300, "FT")]]), now, now - 1000), false, "finished");
  assert.equal(pollDue(new Map([[1, at(180, "NS")]]), now, now - 6 * 60000), true, "a periodic check");
});
console.log("\n" + passed + " tests passed");
