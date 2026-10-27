// Run with:  node tests/football-cache.test.mjs   (no network)
// The shared (edge) cache: how long each kind of football answer may be kept.
import assert from "node:assert/strict";
const { ttlFor } = await import("../api/football.js");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const NOW = Date.parse("2026-10-27T12:00:00Z"), MIN = 60, HOUR = 3600, DAY = 86400;
const fx = (status, minutesFromNow, id = 1) => ({ fixture: { id, date: new Date(NOW + minutesFromNow * 60000).toISOString(), status: { short: status } } });

await test("live matches stay fresh (30 s)", () => assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("2H", -60), fx("NS", 120, 2)], NOW), 30));
await test("a day where nothing has started waits a quarter of the time to kick-off, between 2 and 10 minutes", () => {
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("NS", 600)], NOW), 10 * MIN);
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("NS", 20)], NOW), 5 * MIN);
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("NS", 5)], NOW), 30); // about to start
});
await test("matches long over are final for a day (6 h for lists without a date); just finished ones wait 10 minutes", () => {
  assert.equal(ttlFor("fixtures", { id: "1" }, [fx("FT", -300)], NOW), DAY);
  assert.equal(ttlFor("fixtures", { team: "5", last: "5" }, [fx("FT", -3000), fx("AET", -5000, 2)], NOW), 6 * HOUR);
  assert.equal(ttlFor("fixtures", { id: "1" }, [fx("FT", -130)], NOW), 10 * MIN);
});
await test("a mix of finished and not-started, nothing live, follows the next kick-off; an empty day is 10 minutes", () => {
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("FT", -300), fx("NS", 300, 2)], NOW), 10 * MIN);
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("FT", -300), fx("NS", 11, 2)], NOW), 165);
  assert.equal(ttlFor("fixtures", { date: "2026-10-27" }, [fx("PST", 0)], NOW), 2 * MIN);
  assert.equal(ttlFor("fixtures", { date: "2026-11-30" }, [], NOW), 10 * MIN);
});
await test("match details: 30 s normally, 30 minutes only when the app says the match ended long ago", () => {
  assert.equal(ttlFor("fixtures/events", { fixture: "1" }, [], NOW), 30);
  assert.equal(ttlFor("fixtures/events", { fixture: "1" }, [], NOW, true), 30 * MIN);
  assert.equal(ttlFor("fixtures/lineups", { fixture: "1" }, [], NOW, true), 30 * MIN);
  assert.equal(ttlFor("odds", { fixture: "1" }, [], NOW, true), 60); // the hint only applies to match details
});
await test("a table that has been quiet waits longer (up to an hour); a busy one stays at 10 minutes; a finished season is a week", () => {
  const table = (updatedMinutesAgo) => [{ league: { standings: [[{ update: new Date(NOW - updatedMinutesAgo * 60000).toISOString() }]] } }];
  assert.equal(ttlFor("standings", { league: "39", season: "2026" }, table(30), NOW), 10 * MIN);
  assert.equal(ttlFor("standings", { league: "39", season: "2026" }, table(24 * 60), NOW), HOUR);
  assert.equal(ttlFor("standings", { league: "39", season: "2026" }, table(5 * 60), NOW), 25 * MIN);
  assert.equal(ttlFor("standings", { league: "39", season: "2024" }, table(10), NOW), 7 * DAY);
});
await test("slow data keeps its fixed lifetime and nothing is ever shorter than before for it", () => {
  assert.equal(ttlFor("leagues", {}, [], NOW), 3 * DAY); assert.equal(ttlFor("venues", {}, [], NOW), 365 * DAY); assert.equal(ttlFor("players", {}, [], NOW), DAY);
});
await test("the proxy-only hint is accepted but never forwarded to the provider", async () => {
  process.env.SCOUTWAVE_FOOTBALL_API_KEY = "k"; let seen = "";
  globalThis.fetch = async (url) => { seen = String(url); return new Response(JSON.stringify({ response: [] }), { status: 200 }); };
  const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json() { return this; } };
  const handler = (await import("../api/football.js")).default;
  await handler({ method: "GET", query: { endpoint: "fixtures/events", fixture: "9", settled: "1" } }, res);
  assert.equal(out.code, 200); assert.ok(!seen.includes("settled") && seen.includes("fixture=9"), seen);
  assert.match(out.headers["Cache-Control"], /s-maxage=1800/);
});
console.log(`\n${passed} tests passed`);
