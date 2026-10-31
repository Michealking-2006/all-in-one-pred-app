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

await test("no fixtures request carries a time zone: every answer is the same URL for the whole world", async () => {
  urls.length = 0;
  await api.getFixturesByDate("2026-10-29"); await api.getFixtureById(5); await api.getTeamFixtures(33, { last: 8 });
  await api.getUpcomingFixtures(39, 2026); await api.getVenueFixtures(556, { next: 5 }); await api.getLeagueFixtures(39, 2026, { round: "x" });
  await api.getTeamSeasonFixtures(33, 2025); await api.getFixturesByIds([1, 2]);
  const q = asked();
  for (const p of q) assert.ok(!p.has("timezone"), "no time zone: " + p.toString()); // the by-date list asks for UTC days now
});

await test("the by-date list asks for UTC days (shared by every time zone) and keeps the matches on the user's local day", async () => {
  const fx = (id, iso) => ({ fixture: { id, date: iso, timestamp: Date.parse(iso) / 1000, status: { short: "NS" } } });
  const feed = { "2026-10-28": [fx(1, "2026-10-28T14:00:00Z"), fx(2, "2026-10-28T16:00:00Z")], "2026-10-29": [fx(4, "2026-10-29T16:00:00Z"), fx(3, "2026-10-29T10:00:00Z")] };
  const seen = [];
  globalThis.fetch = async (url) => { const p = new URL(url, "http://x").searchParams; seen.push(p); return new Response(JSON.stringify(feed[p.get("date")] || []), { status: 200 }); };
  api.clearFootballCache({ all: true });
  process.env.TZ = "Asia/Tokyo"; // UTC+9: the local day 29 October is 15:00 on the 28th to 15:00 on the 29th, UTC
  const rows = await api.getFixturesByDate("2026-10-29");
  assert.deepEqual(rows.map((r) => r.fixture.id), [2, 3], "only matches on the local day, in kick-off order");
  assert.deepEqual(seen.map((p) => p.get("date")).sort(), ["2026-10-28", "2026-10-29"]);
  assert.ok(seen.every((p) => !p.has("timezone")), "two UTC days, no time zone");
  seen.length = 0; assert.deepEqual((await api.getFixturesByDate("2026-10-29")).map((r) => r.fixture.id), [2, 3]); assert.equal(seen.length, 0, "second ask is from the cache");
  assert.deepEqual(api.peekFixturesByDate("2026-10-29").map((r) => r.fixture.id), [2, 3]);
  assert.equal(api.peekFixturesByDate("2026-10-27"), null, "peek is empty when nothing was fetched");
  process.env.TZ = "UTC"; api.clearFootballCache({ all: true }); seen.length = 0;
  assert.deepEqual((await api.getFixturesByDate("2026-10-29")).map((r) => r.fixture.id), [3, 4]);
  assert.equal(seen.length, 1, "in UTC one list is the whole day");
  globalThis.fetch = async (url) => { urls.push(String(url)); return new Response("[]", { status: 200 }); };
});
await test("the proxy asks the provider once when many visitors ask for the same thing at the same moment", async () => {
  process.env.SCOUTWAVE_FOOTBALL_API_KEY = "test-key";
  const { default: proxy } = await import("../api/football.js");
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; await new Promise((r) => setTimeout(r, 30)); return new Response(JSON.stringify({ response: [{ fixture: { id: 1, status: { short: "NS" }, date: "2026-10-29T18:00:00Z" } }], errors: [] }), { status: 200 }); };
  const call = () => new Promise((resolve) => { const out = { headers: {} }; proxy({ method: "GET", query: { endpoint: "fixtures", date: "2026-10-29" } }, { setHeader: (k, v) => (out.headers[k] = v), status(c) { out.status = c; return this; }, json(b) { out.body = b; resolve(out); } }); });
  const all = await Promise.all([call(), call(), call(), call(), call()]);
  assert.equal(providerCalls, 1); assert.ok(all.every((r) => r.status === 200 && r.body.length === 1 && /s-maxage=/.test(r.headers["Cache-Control"])));
  await call(); assert.equal(providerCalls, 2, "a later request asks again (the edge cache, not this map, keeps answers)");
  globalThis.fetch = async (url) => { urls.push(String(url)); return new Response("[]", { status: 200 }); };
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
  assert.ok(!/SF Pro/.test(css + boot)); assert.match(stack, /system-ui,Roboto/); assert.match(stack, /BlinkMacSystemFont,'Inter',system-ui/);
  assert.match(css, /html\{[^}]*\btext-size-adjust:100%/); assert.match(boot, /text-size-adjust:100%/);
});
console.log(`\n${passed} tests passed`);
