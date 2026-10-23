// Run with:  node tests/placements.test.mjs   (no network; Supabase is faked)
import assert from "node:assert/strict";
Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "k" });
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const { inWindow, placementState, ctr, isDay, isCampaign } = await import("../src/placements.js");
const { validateConfig } = await import("../api/_admin.js");

const at = (iso) => Date.parse(iso + "T12:00:00Z");
await test("run dates: both ends included, either may be blank", () => {
  const p = { startsAt: "2026-11-01", endsAt: "2026-11-30" };
  assert.equal(inWindow(p, at("2026-10-31")), false); assert.equal(inWindow(p, at("2026-11-01")), true); assert.equal(inWindow(p, at("2026-11-30")), true); assert.equal(inWindow(p, at("2026-12-01")), false);
  assert.equal(inWindow({ startsAt: "2026-11-01" }, at("2030-01-01")), true); assert.equal(inWindow({ endsAt: "2026-11-30" }, at("2020-01-01")), true); assert.equal(inWindow({}, at("2026-01-01")), true);
});
await test("state shown in the admin", () => {
  assert.equal(placementState({ on: false }).state, "off");
  assert.equal(placementState({ on: true, startsAt: "2026-11-01" }, at("2026-10-01")).state, "scheduled");
  assert.equal(placementState({ on: true, endsAt: "2026-09-01" }, at("2026-10-01")).state, "ended");
  assert.deepEqual(placementState({ on: true, endsAt: "2026-12-01" }, at("2026-10-01")), { state: "live", label: "Live until 2026-12-01" });
  assert.equal(ctr(200, 5), 0.025); assert.equal(ctr(0, 0), null);
  assert.ok(isDay("2026-02-28") && !isDay("2026-02-31x") && !isDay("2026-13-01") && !isDay(5)); assert.ok(isCampaign("a1b2c3d4") && !isCampaign("A1B2C3D4") && !isCampaign("a1b2c3"));
});
const slot = (extra = {}) => ({ placements: { news_top: { on: true, title: "Offer", link: "https://a.co/x", text: "t", cta: "Go", ...extra } } });
await test("config: dates are checked, and each version of an ad gets its own campaign id", () => {
  assert.throws(() => validateConfig(slot({ startsAt: "tomorrow" })), /real days/);
  assert.throws(() => validateConfig(slot({ startsAt: "2026-11-30", endsAt: "2026-11-01" })), /end date is before/);
  const a = validateConfig(slot({ startsAt: "2026-11-01", endsAt: "2026-11-30" })).placements.news_top;
  assert.equal(a.startsAt, "2026-11-01"); assert.match(a.campaign, /^[a-f0-9]{8}$/);
  assert.equal(validateConfig(slot({ text: "changed", cta: "Other" })).placements.news_top.campaign, a.campaign, "wording tweaks keep the figures together");
  assert.notEqual(validateConfig(slot({ title: "New offer" })).placements.news_top.campaign, a.campaign);
  assert.notEqual(validateConfig(slot({ link: "https://a.co/y" })).placements.news_top.campaign, a.campaign);
  assert.equal(validateConfig({}).placements.news_list.campaign, "");
});

// ---- fake Supabase
const db = { stats: [], config: null };
const json = (d, s = 200) => new Response(s === 204 ? null : JSON.stringify(d), { status: s });
let tableMissing = false;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const t = u.pathname.split("/").pop(); const b = init.body ? JSON.parse(init.body) : null;
  if (t === "app_config") return json([{ value: db.config, updated_at: "2026-10-20T00:00:00Z" }]);
  if (t === "bump_placement") { db.stats.push(b); return json(null, 204); }
  if (t === "placement_stats") return tableMissing ? json({ message: "relation does not exist" }, 404) : json(db.rows || []);
  return json({}, 404);
};
const live = validateConfig(slot({ title: "Live offer" })), campaign = live.placements.news_top.campaign;
db.config = live;
const handler = (await import("../server/placement-event.js")).default;
let ipn = 0;
const send = async (events, { ua = "Mozilla/5.0 (iPhone) Safari", ip = "9.9.9." + ++ipn, method = "POST", raw } = {}) => {
  const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, end() { return this; } };
  await handler({ method, body: raw ?? { events }, headers: { "user-agent": ua, "x-forwarded-for": ip } }, res); return out;
};
const counted = () => db.stats.splice(0).map((s) => `${s.p_slot}/${s.p_event}/${s.p_n}`);

await test("a view and a tap are counted, as counts only", async () => {
  const r = await send([{ slot: "news_top", campaign, event: "view" }, { slot: "news_top", campaign, event: "click" }]);
  assert.equal(r.code, 204); assert.deepEqual(counted().sort(), ["news_top/click/1", "news_top/view/1"]);
  assert.deepEqual(Object.keys((db.stats[0] || { p_day: 1, p_slot: 1, p_campaign: 1, p_event: 1, p_n: 1 })).sort(), ["p_campaign", "p_day", "p_event", "p_n", "p_slot"]); // nothing about the person
});
await test("made-up, stale, switched-off and out-of-date events are ignored", async () => {
  for (const ev of [{ slot: "nope", campaign, event: "view" }, { slot: "news_top", campaign: "ffffffff", event: "view" }, { slot: "news_top", campaign: "../etc", event: "view" }, { slot: "news_top", campaign, event: "purchase" }, { slot: "news_list", campaign, event: "view" }, null, "x", 5]) { await send([ev]); assert.deepEqual(counted(), [], JSON.stringify(ev)); }
  db.config = validateConfig(slot({ title: "Live offer", on: false, ...{} })); db.config.placements.news_top.on = false;
  await send([{ slot: "news_top", campaign, event: "view" }]); assert.deepEqual(counted(), []);
  db.config = validateConfig(slot({ title: "Live offer", startsAt: "2999-01-01" })); await send([{ slot: "news_top", campaign: db.config.placements.news_top.campaign, event: "view" }]); assert.deepEqual(counted(), []);
  db.config = validateConfig(slot({ title: "Live offer", endsAt: "2001-01-01" })); await send([{ slot: "news_top", campaign: db.config.placements.news_top.campaign, event: "view" }]); assert.deepEqual(counted(), []);
  db.config = live;
});
await test("bots are ignored; a flood is capped; garbage never produces an error", async () => {
  for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "python-requests/2.31", "HeadlessChrome/120", "curl/8"]) { await send([{ slot: "news_top", campaign, event: "view" }], { ua }); }
  assert.deepEqual(counted(), []);
  const many = Array.from({ length: 50 }, () => ({ slot: "news_top", campaign, event: "view" }));
  await send(many); assert.deepEqual(counted(), ["news_top/view/3"], "10 events max per request and 3 per kind");
  const ip = "7.7.7.7"; let total = 0; for (let i = 0; i < 12; i++) { await send(Array.from({ length: 10 }, () => ({ slot: "news_top", campaign, event: "view" })), { ip }); total += db.stats.splice(0).length; }
  assert.ok(total <= 6, "an address is limited to 60 events a minute, got " + total);
  for (const raw of ["{not json", "", undefined, { events: "x" }, { events: [] }]) assert.equal((await send(null, { raw })).code, 204);
  assert.equal((await send(null, { method: "GET" })).code, 405);
});

// ---- the report
const { placementsReport } = await import("../api/mingt.js");
const today = new Date().toISOString().slice(0, 10);
await test("report: per day, per space and per campaign, with tap rate; an earlier campaign stays visible", async () => {
  db.config = live;
  db.rows = [
    { day: today, slot: "news_top", campaign, event: "view", n: 200 }, { day: today, slot: "news_top", campaign, event: "click", n: 5 },
    { day: today, slot: "news_top", campaign: "deadbeef", event: "view", n: 50 }, { day: today, slot: "news_list", campaign: "cafebabe", event: "view", n: 10 },
  ];
  const r = await placementsReport(); assert.equal(r.ready, true); assert.equal(r.days.length, 30);
  assert.deepEqual(r.totals, { views: 260, clicks: 5, ctr: 5 / 260 });
  const top = r.slots.find((s) => s.slot === "news_top"); assert.equal(top.views, 250); assert.equal(top.state, "live"); assert.equal(top.headline, "Live offer");
  assert.equal(top.campaigns[0].title, "Live offer"); assert.equal(top.campaigns[0].ctr, 0.025); assert.equal(top.campaigns[1].title, "Earlier campaign"); assert.equal(top.campaigns[1].current, false);
  assert.equal(r.days.at(-1).views, 260);
  tableMissing = true; assert.deepEqual(await placementsReport(), { ready: false }); tableMissing = false;
});

// ---- the app's tracker
const beacons = []; const timers = [];
const sess = new Map();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { doNotTrack: null, sendBeacon: (u, b) => { beacons.push(b); return true; } } });
globalThis.window = { setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, addEventListener() {}, sessionStorage: { getItem: (k) => sess.get(k) ?? null, setItem: (k, v) => sess.set(k, v) } };
globalThis.document = { addEventListener() {}, hidden: false };
const tracker = await import("../src/placementTracker.js");
const bodies = async () => Promise.all(beacons.splice(0).map(async (b) => JSON.parse(await b.text()).events));
await test("tracker: one view per visit per campaign, taps throttled, sent together", async () => {
  tracker.trackView("news_top", "aaaaaaaa"); tracker.trackView("news_top", "aaaaaaaa"); tracker.trackView("news_top", "bbbbbbbb"); tracker.trackView("news_top", "");
  timers.splice(0).forEach((f) => f()); // the short delay passes
  const sent = (await bodies()).flat(); assert.deepEqual(sent.map((e) => e.campaign), ["aaaaaaaa", "bbbbbbbb"]);
  tracker.trackClick("news_top", "aaaaaaaa"); tracker.trackClick("news_top", "aaaaaaaa");
  assert.equal((await bodies()).flat().length, 1, "a double tap is one");
});
await test("tracker: Do Not Track and Global Privacy Control switch it off completely", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { doNotTrack: "1", sendBeacon: (u, b) => { beacons.push(b); return true; } } });
  tracker.trackView("news_list", "cccccccc"); tracker.trackClick("news_list", "cccccccc"); timers.splice(0).forEach((f) => f()); assert.deepEqual(await bodies(), []);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { doNotTrack: null, globalPrivacyControl: true, sendBeacon: (u, b) => { beacons.push(b); return true; } } });
  tracker.trackView("news_list", "dddddddd"); timers.splice(0).forEach((f) => f()); assert.deepEqual(await bodies(), []);
});
console.log(`\n${passed} tests passed`);
