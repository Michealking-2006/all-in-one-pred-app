// Run with:  node tests/api-usage.test.mjs   (no network: fetch is faked)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.window = { sessionStorage: mem(), localStorage: mem(), setTimeout, clearTimeout };
globalThis.document = { documentElement: { dataset: {} } };
const urls = [];
globalThis.fetch = async (url) => { urls.push(String(url)); return new Response("[]", { status: 200 }); };
const api = await import("../src/api/footballApi.js");
const asked = () => urls.map((u) => new URL(u, "http://x").searchParams);

await test("only the by-date list carries the time zone; every other fixtures request is the same for the whole world", async () => {
  urls.length = 0;
  await api.getFixturesByDate("2026-10-29"); await api.getFixtureById(5); await api.getTeamFixtures(33, { last: 8 });
  await api.getUpcomingFixtures(39, 2026); await api.getVenueFixtures(556, { next: 5 }); await api.getLeagueFixtures(39, 2026, { round: "x" });
  await api.getTeamSeasonFixtures(33, 2025); await api.getFixturesByIds([1, 2]);
  const q = asked();
  assert.ok(q[0].has("timezone"), "the by-date list keeps it");
  for (const p of q.slice(1)) assert.ok(!p.has("timezone"), "no time zone: " + p.toString());
});
await test("pull-to-refresh forgets live data only: a player, a venue or a squad is not re-fetched", async () => {
  urls.length = 0;
  await api.getFixtureById(7); await api.getFixtureEvents(7); await api.getStandings(39, 2026); await api.getTeamSquad(33); await api.getVenueById(556); await api.getCoach(33);
  assert.equal(urls.length, 6);
  api.clearFootballCache();
  urls.length = 0;
  await api.getFixtureById(7); await api.getFixtureEvents(7); await api.getStandings(39, 2026);
  assert.equal(urls.length, 3, "scores, events and the table are asked for again");
  await api.getTeamSquad(33); await api.getVenueById(556); await api.getCoach(33);
  assert.equal(urls.length, 3, "slow data came from the cache");
  api.clearFootballCache({ all: true }); urls.length = 0; await api.getTeamSquad(33);
  assert.equal(urls.length, 1, "{ all: true } forgets everything");
});
await test("a player's season: before July ask for last year's season first (one request for most players, not two)", async () => {
  const RealDate = Date; const at = (iso) => { globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } }; };
  try {
    for (const [iso, first] of [["2026-03-10T12:00:00Z", 2025], ["2026-10-29T12:00:00Z", 2026]]) {
      at(iso); api.clearFootballCache({ all: true }); urls.length = 0;
      globalThis.fetch = async (url) => { urls.push(String(url)); return new Response(JSON.stringify([{ player: { id: 9 } }]), { status: 200 }); };
      await api.getPlayerProfile(9 + (first === 2025 ? 0 : 1));
      assert.equal(urls.length, 1); assert.equal(new URL(urls[0], "http://x").searchParams.get("season"), String(first));
    }
  } finally { globalThis.Date = RealDate; }
});
await test("fonts: the same stack before and after the app starts, no Apple-only font names, Android text auto-sizing off", () => {
  const css = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8"), boot = fs.readFileSync(path.join(root, "src/styles/boot.css"), "utf8");
  const stack = css.match(/--font-display:([^;]+);/)[1];
  assert.ok(boot.includes(stack), "boot.css uses the very same stack, so there is no font swap when the app appears");
  assert.ok(!/SF Pro/.test(css + boot)); assert.match(stack, /system-ui,Roboto/);
  assert.match(css, /html\{[^}]*\btext-size-adjust:100%/); assert.match(boot, /text-size-adjust:100%/);
});
console.log(`\n${passed} tests passed`);
