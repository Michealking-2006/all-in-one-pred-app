// Run with:  node tests/news.test.mjs   (no network)
import assert from "node:assert/strict";
const { timeAgo } = await import("../src/api/newsApi.js");
const { tagsOf } = await import("../src/newsTags.js");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const NOW = Date.parse("2026-10-28T12:00:00Z"), ago = (ms) => new Date(NOW - ms).toISOString(), MIN = 60000, H = 3600000, D = 24 * H;

await test("timeAgo counts whole minutes, hours and days (never rounds up)", () => {
  assert.equal(timeAgo(ago(20000), NOW), "Just now");
  assert.equal(timeAgo(ago(59 * MIN + 40000), NOW), "59 min ago");
  assert.equal(timeAgo(ago(3 * H + 40 * MIN), NOW), "3 h ago");
  assert.equal(timeAgo(ago(23 * H + 50 * MIN), NOW), "23 h ago");
  assert.equal(timeAgo(ago(D + 20 * H), NOW), "1 d ago");
  assert.equal(timeAgo(ago(6 * D + 23 * H), NOW), "6 d ago");
  assert.equal(timeAgo("not a date", NOW), ""); assert.equal(timeAgo(new Date(NOW + H).toISOString(), NOW), "Just now");
});
await test("hashtags match whole words: 'design' or 'assigning' is not a transfer story", () => {
  const ids = (title, description = "") => tagsOf({ title, description }).map((t) => t.id);
  assert.deepEqual(ids("Club announces new kit design"), []);
  assert.deepEqual(ids("Striker assigning blame after defeat"), []);
  assert.ok(ids("Chelsea agree deal to sign winger, signing confirmed").includes("transfers"));
  assert.ok(ids("Arsenal in transfer talks").includes("transfers")); assert.ok(ids("Midfielder signs for Real Madrid").includes("real-madrid"));
  assert.ok(ids("Loan deal agreed").includes("transfers"));
  assert.ok(ids("Premier League table", "").includes("premierleague"));
  assert.ok(tagsOf({ title: "Arsenal Chelsea Liverpool Spurs transfer" }, 3).length <= 3);
});
console.log(`\n${passed} tests passed`);
