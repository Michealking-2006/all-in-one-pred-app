// Run with:  node tests/leagues-list.test.mjs
// The Leagues screen lists every league and cup that has a season under way: one request, trimmed, then searched,
// filtered and grouped by country on the device.
import assert from "node:assert/strict";
import { slimLeagues, filterLeagues, groupByCountry, popularFrom, loadAllLeagues, norm, _resetLeagueListForTests } from "../src/utils/leagueList.js";
let passed = 0; const test = async (name, fn) => { _resetLeagueListForTests(); await fn(); passed++; console.log("ok  " + name); };

const row = (id, name, type, country, flag = "") => ({ league: { id, name, type, logo: "https://logo/" + id }, country: { name: country, code: "XX", flag }, seasons: [{ year: 2026, current: true, coverage: { big: "x".repeat(500) } }] });
const RAW = [
  row(39, "Premier League", "League", "England", "https://flag/en"),
  row(40, "Championship", "League", "England"),
  row(45, "FA Cup", "Cup", "England"),
  row(140, "La Liga", "League", "Spain"),
  row(203, "Süper Lig", "League", "Turkey"),
  row(2, "UEFA Champions League", "Cup", "World"),
  row(78, "Bundesliga", "League", "Germany"),
  row(79, "2. Bundesliga", "League", "Germany"),
];

await test("rows are trimmed to what the list needs: no seasons, coverage or provider extras", () => {
  const [first] = slimLeagues(RAW);
  assert.deepEqual(Object.keys(first).sort(), ["country", "key", "league"]);
  assert.deepEqual(first.league, { id: 39, name: "Premier League", type: "League", logo: "https://logo/39" });
  assert.deepEqual(first.country, { name: "England", flag: "https://flag/en" });
  assert.ok(JSON.stringify(slimLeagues(RAW)).length < JSON.stringify(RAW).length / 3);
});
await test("rows without an id or a name, repeats, and non-lists are dropped; unknown types count as leagues", () => {
  const list = slimLeagues([row(1, "A", "League", "X"), row(1, "A again", "League", "X"), { league: { name: "No id" } }, { league: { id: 9, name: "  " } }, null, row(3, "B", "Weird", "Y")]);
  assert.deepEqual(list.map((e) => e.league.id), [1, 3]);
  assert.equal(list[1].league.type, "League");
  assert.deepEqual(slimLeagues(undefined), []);
  assert.deepEqual(slimLeagues({ response: [] }), []);
});
await test("search ignores accents, case and punctuation, and needs every word to match name or country", () => {
  const list = slimLeagues(RAW);
  assert.equal(norm("Süper  Lig!"), "super lig");
  assert.deepEqual(filterLeagues(list, { query: "super lig" }).map((e) => e.league.id), [203]);
  assert.deepEqual(filterLeagues(list, { query: "TURKEY" }).map((e) => e.league.id), [203]);
  assert.deepEqual(filterLeagues(list, { query: "england cup" }).map((e) => e.league.id), [45]);
  assert.deepEqual(filterLeagues(list, { query: "zzz" }), []);
  assert.equal(filterLeagues(list, { query: "   " }).length, list.length);
});
await test("search puts names that start with the query first, then country matches, then the rest", () => {
  const list = slimLeagues(RAW);
  const ids = filterLeagues(list, { query: "bundes" }).map((e) => e.league.id);
  assert.deepEqual(ids, [78, 79]); // "Bundesliga" starts with it, "2. Bundesliga" only contains it
  const eng = filterLeagues(list, { query: "eng" }).map((e) => e.league.id);
  assert.deepEqual(eng.slice(0, 3).sort(), [39, 40, 45]);
});
await test("the kind filter keeps leagues or cups", () => {
  const list = slimLeagues(RAW);
  assert.deepEqual(filterLeagues(list, { type: "Cup" }).map((e) => e.league.id).sort((a, b) => a - b), [2, 45]);
  assert.equal(filterLeagues(list, { type: "League" }).length, 6);
  assert.deepEqual(filterLeagues(list, { type: "Cup", query: "uefa" }).map((e) => e.league.id), [2]);
});
await test("countries: World first, then A to Z; leagues before cups; a country keeps its flag", () => {
  const groups = groupByCountry(slimLeagues(RAW));
  assert.deepEqual(groups.map((g) => g.country), ["World", "England", "Germany", "Spain", "Turkey"]);
  assert.deepEqual(groups[1].items.map((e) => e.league.name), ["Championship", "Premier League", "FA Cup"]);
  assert.equal(groups[1].flag, "https://flag/en");
  const noCountry = groupByCountry(slimLeagues([row(1, "Z", "League", ""), row(2, "A", "League", "Brazil")]));
  assert.deepEqual(noCountry.map((g) => g.country), ["Brazil", "Other"]);
});
await test("the popular six come from the list, in order, and a missing one is skipped", () => {
  assert.deepEqual(popularFrom(slimLeagues(RAW)).map((e) => e.league.id), [39, 140, 78, 2]);
  assert.deepEqual(popularFrom([]), []);
});
await test("the list is requested once for every league with a current season, shared, and kept", async () => {
  let calls = 0, args;
  const fetcher = async (endpoint, params) => { calls++; args = [endpoint, params]; await new Promise((r) => setTimeout(r, 5)); return RAW; };
  const [a, b] = await Promise.all([loadAllLeagues({ fetcher }), loadAllLeagues({ fetcher })]);
  assert.equal(calls, 1, "two screens opening together share one request");
  assert.deepEqual(args, ["leagues", { current: "true" }]);
  assert.equal(a, b);
  assert.equal((await loadAllLeagues({ fetcher })).length, 8);
  assert.equal(calls, 1, "kept for the session");
});
await test("the kept list expires, so a long-open app refreshes it", async () => {
  let calls = 0, t = 1000;
  const fetcher = async () => { calls++; return RAW; };
  await loadAllLeagues({ fetcher, now: () => t }); t += 5 * 3_600_000;
  await loadAllLeagues({ fetcher, now: () => t }); assert.equal(calls, 1);
  t += 2 * 3_600_000; await loadAllLeagues({ fetcher, now: () => t }); assert.equal(calls, 2);
});
await test("a failure or an empty answer is never kept: the next try asks again", async () => {
  let calls = 0;
  await assert.rejects(loadAllLeagues({ fetcher: async () => { calls++; throw new Error("down"); } }), /down/);
  await assert.rejects(loadAllLeagues({ fetcher: async () => { calls++; return []; } }), /No leagues/);
  assert.equal((await loadAllLeagues({ fetcher: async () => { calls++; return RAW; } })).length, 8);
  assert.equal(calls, 3);
});
console.log(`\n${passed} tests passed`);
