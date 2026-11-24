// Run with:  node tests/mcp.test.mjs
// The MCP server (server/mcp.js): protocol handling, argument checking, and that each tool asks Scoutwave's own
// endpoints the right question and trims the answer. A fake backend stands in for /api/*; nothing touches the network.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
Object.assign(process.env, { SITE_URL: "https://app.test", SUPABASE_SERVICE_ROLE_KEY: "k" });
delete process.env.MCP_DISABLED; delete process.env.MCP_RATE_PER_MIN;
const mcp = await import(path.join(root, "server/mcp.js"));
let passed = 0; const test = async (name, fn) => { mcp._resetLimits(); await fn(); passed++; console.log("ok  " + name); };

// ---- fake backend
let calls = [];
let backend = () => ({ status: 200, body: [] });
mcp._deps.fetch = async (url, opts) => {
  calls.push({ url: new URL(url), headers: opts.headers });
  const r = backend(new URL(url));
  return { ok: r.status < 400, status: r.status, headers: { get: (k) => r.headers?.[k.toLowerCase()] ?? null }, json: async () => r.body };
};
mcp._deps.now = () => Date.parse("2026-11-23T12:00:00Z");

const run = async (body, { method = "POST", headers = {} } = {}) => {
  const out = { headers: {} };
  const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, end() { return this; } };
  await mcp.default({ method, headers: { host: "x.test", ...headers }, body }, res);
  return out;
};
const rpc = (method, params, id = 1) => ({ jsonrpc: "2.0", id, method, params });
const call = async (name, args, headers) => { calls = []; const r = await run(rpc("tools/call", { name, arguments: args }), { headers }); return { ...r, result: r.body?.result, text: r.body?.result?.content?.[0]?.text }; };
const data = (r) => JSON.parse(r.text);

await test("initialize negotiates the protocol version and advertises tools only", async () => {
  const r = await run(rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } }));
  assert.equal(r.code, 200); assert.equal(r.body.result.protocolVersion, "2025-03-26");
  assert.deepEqual(Object.keys(r.body.result.capabilities), ["tools"]);
  assert.equal(r.body.result.serverInfo.name, "scoutwave");
  assert.equal((await run(rpc("initialize", { protocolVersion: "1999-01-01" }))).body.result.protocolVersion, mcp.PROTOCOLS[0]);
});
await test("notifications get 202 and no body; ping answers; unknown methods are -32601", async () => {
  const n = await run({ jsonrpc: "2.0", method: "notifications/initialized" }); assert.equal(n.code, 202); assert.equal(n.body, undefined);
  assert.deepEqual((await run(rpc("ping"))).body.result, {});
  assert.equal((await run(rpc("resources/list"))).body.error.code, -32601);
});
await test("bad input: parse error, wrong version header, empty or huge batch, non-JSON-RPC", async () => {
  assert.equal((await run("{nope")).body.error.code, -32700);
  assert.equal((await run(undefined)).code, 400);
  assert.equal((await run(rpc("ping"), { headers: { "mcp-protocol-version": "1999-01-01" } })).code, 400);
  assert.equal((await run([])).code, 400);
  assert.equal((await run(Array.from({ length: 21 }, (_, i) => rpc("ping", {}, i)))).code, 400);
  assert.equal((await run({ hello: 1 })).body.error.code, -32600);
});
await test("batches answer each request and skip notifications", async () => {
  const r = await run([rpc("ping", {}, 1), { jsonrpc: "2.0", method: "notifications/initialized" }, rpc("ping", {}, 2)]);
  assert.equal(r.body.length, 2); assert.deepEqual(r.body.map((x) => x.id), [1, 2]);
});
await test("only POST works; GET explains itself; OPTIONS is a CORS preflight; the kill switch answers 404", async () => {
  const g = await run(undefined, { method: "GET" }); assert.equal(g.code, 405); assert.equal(g.headers.Allow, "POST, OPTIONS");
  const o = await run(undefined, { method: "OPTIONS" }); assert.equal(o.code, 204); assert.match(o.headers["Access-Control-Allow-Headers"], /Authorization/);
  assert.equal((await run(rpc("ping"))).headers["Cache-Control"], "no-store");
  process.env.MCP_DISABLED = "1"; assert.equal((await run(rpc("ping"))).code, 404); delete process.env.MCP_DISABLED;
});
await test("every tool is described, read-only, and takes an object with no extra properties", async () => {
  const tools = (await run(rpc("tools/list"))).body.result.tools;
  assert.equal(tools.length, mcp.TOOLS.length);
  for (const t of tools) {
    assert.match(t.name, /^[a-z_]+$/); assert.ok(t.title && t.description.length > 20, t.name);
    assert.equal(t.inputSchema.type, "object"); assert.equal(t.inputSchema.additionalProperties, false);
    for (const r of t.inputSchema.required) assert.ok(t.inputSchema.properties[r], `${t.name}: required ${r} is not a property`);
    assert.equal(t.annotations.readOnlyHint, true); assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.run, undefined, "the implementation is never sent");
  }
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
});
await test("unknown tool is a protocol error; bad arguments are tool errors the model can read", async () => {
  assert.equal((await run(rpc("tools/call", { name: "nope" }))).body.error.code, -32602);
  for (const [name, args, re] of [
    ["get_standings", {}, /"league" is required/],
    ["get_standings", { league: "39; drop" }, /whole number/],
    ["get_standings", { league: 39, extra: 1 }, /Unknown argument "extra"/],
    ["get_matches", { date: "2026-02-30" }, /real date/],
    ["get_matches", { next: 3 }, /need a "team"/],
    ["get_matches", { team: 1, next: 2, last: 2 }, /either/],
    ["get_matches", { timezone: "x&y=1" }, /timezone/],
    ["search", { query: "ar", type: "team" }, /at least 3/],
    ["search", { query: "salah", type: "player" }, /"league" is required/],
    ["search", { query: "salah", type: "cat" }, /one of/],
    ["get_top_players", { league: 39, stat: "fouls" }, /one of/],
    ["get_predictions", { fixtureIds: [] }, /1 to 60/],
    ["get_predictions", { fixtureIds: Array.from({ length: 61 }, (_, i) => i + 1) }, /1 to 60/],
    ["get_head_to_head", { teamA: 5, teamB: 5 }, /different/],
    ["get_injuries", {}, /at least one/],
    ["get_news", { tag: "cricket" }, /one of/],
    ["get_match_details", { fixtureId: 1, include: ["players"] }, /include/],
  ]) { const r = await call(name, args); assert.equal(r.result.isError, true, name); assert.match(r.text, re, name); assert.equal(calls.length, 0, `${name} must not reach the backend with bad input`); }
});

await test("get_matches: today by default, filters, live, and a team's next matches build the right question", async () => {
  const fx = { fixture: { id: 9, date: "2026-11-23T15:00:00+00:00", status: { long: "Match Finished", short: "FT", elapsed: 90 }, venue: { name: "Anfield" } }, league: { id: 39, name: "Premier League", country: "England", round: "Regular Season - 12", season: 2026, logo: "x" }, teams: { home: { id: 40, name: "Liverpool", logo: "x" }, away: { id: 50, name: "Man City" } }, goals: { home: 2, away: 1 }, score: { halftime: { home: 1, away: 0 } } };
  backend = () => ({ status: 200, body: [fx] });
  let r = await call("get_matches", {}); let q = calls[0].url;
  assert.equal(q.origin, "https://app.test"); assert.equal(q.pathname, "/api/football");
  assert.equal(q.searchParams.get("endpoint"), "fixtures"); assert.equal(q.searchParams.get("date"), "2026-11-23");
  assert.deepEqual(data(r).rows[0], { id: 9, kickoff: "2026-11-23T15:00:00+00:00", status: "Match Finished", statusCode: "FT", minute: 90, venue: "Anfield", league: { id: 39, name: "Premier League", country: "England", round: "Regular Season - 12", season: 2026 }, home: { id: 40, name: "Liverpool", goals: 2 }, away: { id: 50, name: "Man City", goals: 1 }, halftime: "1-0" });
  assert.ok(!r.text.includes("logo"));
  await call("get_matches", { date: "2026-12-01", league: 140 }); q = calls[0].url;
  assert.equal(q.searchParams.get("league"), "140"); assert.equal(q.searchParams.get("season"), "2026");
  await call("get_matches", { live: true }); assert.equal(calls[0].url.searchParams.get("live"), "all"); assert.equal(calls[0].url.searchParams.get("date"), null);
  await call("get_matches", { live: true, league: 39 }); assert.equal(calls[0].url.searchParams.get("live"), "39");
  await call("get_matches", { team: 40, next: 3 }); q = calls[0].url;
  assert.equal(q.searchParams.get("team"), "40"); assert.equal(q.searchParams.get("next"), "3"); assert.equal(q.searchParams.get("date"), null);
  await call("get_matches", { timezone: "Europe/London" }); assert.equal(calls[0].url.searchParams.get("timezone"), "Europe/London");
});
await test("get_matches caps a long day and says so", async () => {
  backend = () => ({ status: 200, body: Array.from({ length: 150 }, (_, i) => ({ fixture: { id: i + 1 }, league: {}, teams: { home: {}, away: {} }, goals: {} })) });
  const d = data(await call("get_matches", {})); assert.equal(d.rows.length, 100); assert.equal(d.total, 150); assert.equal(d.truncated, true);
});
await test("get_match_details returns events, lineups and statistics, trimmed, and honours include", async () => {
  const fx = { fixture: { id: 7, referee: "A. Taylor", status: { short: "FT" } }, league: {}, teams: { home: { id: 1, name: "A" }, away: { id: 2, name: "B" } }, goals: { home: 1, away: 0 },
    events: [{ time: { elapsed: 12, extra: null }, team: { name: "A" }, player: { name: "X" }, assist: { name: "Y" }, type: "Goal", detail: "Normal Goal" }],
    lineups: [{ team: { name: "A" }, formation: "4-3-3", coach: { name: "C" }, startXI: [{ player: { number: 1, name: "GK", pos: "G", grid: "1:1" } }], substitutes: [{ player: { number: 12, name: "Sub", pos: "M" } }] }],
    statistics: [{ team: { name: "A" }, statistics: [{ type: "Ball Possession", value: "55%" }, { type: "Total Shots", value: 14 }] }] };
  backend = () => ({ status: 200, body: [fx] });
  let d = data(await call("get_match_details", { fixtureId: 7 }));
  assert.equal(calls[0].url.searchParams.get("endpoint"), "fixtures"); assert.equal(calls[0].url.searchParams.get("id"), "7");
  assert.equal(d.referee, "A. Taylor"); assert.deepEqual(d.events[0], { minute: 12, extra: null, team: "A", player: "X", assist: "Y", type: "Goal", detail: "Normal Goal" });
  assert.equal(d.lineups[0].formation, "4-3-3"); assert.deepEqual(d.lineups[0].startXI[0], { number: 1, name: "GK", position: "G" });
  assert.deepEqual(d.statistics[0].stats, { "Ball Possession": "55%", "Total Shots": 14 });
  d = data(await call("get_match_details", { fixtureId: 7, include: ["events"] })); assert.ok(d.events && !d.lineups && !d.statistics);
  backend = () => ({ status: 200, body: [] }); assert.match((await call("get_match_details", { fixtureId: 8 })).text, /No match/);
});
await test("get_standings flattens groups and defaults to the current season (a new one starts in July)", async () => {
  backend = () => ({ status: 200, body: [{ league: { id: 39, name: "Premier League", country: "England", season: 2026, standings: [[{ rank: 1, team: { id: 42, name: "Arsenal", logo: "x" }, points: 30, goalsDiff: 12, form: "WWDWW", description: "Champions League", all: { played: 12, win: 9, draw: 3, lose: 0, goals: { for: 25, against: 13 } } }]] } }] });
  const d = data(await call("get_standings", { league: 39 }));
  assert.equal(calls[0].url.searchParams.get("season"), "2026"); assert.equal(d.groups[0].table[0].team, "Arsenal"); assert.equal(d.groups[0].table[0].goalsFor, 25);
  mcp._deps.now = () => Date.parse("2026-03-01T00:00:00Z"); await call("get_standings", { league: 39 }); assert.equal(calls[0].url.searchParams.get("season"), "2025");
  mcp._deps.now = () => Date.parse("2026-11-23T12:00:00Z");
  await call("get_standings", { league: 39, season: 2023 }); assert.equal(calls[0].url.searchParams.get("season"), "2023");
  assert.match((await call("get_standings", { league: 39, season: 1900 })).text, /1990/);
});
await test("get_top_players picks the right endpoint per stat and honours the limit", async () => {
  const row = (n) => ({ player: { id: n, name: "P" + n, nationality: "X" }, statistics: [{ team: { name: "T" }, games: { appearences: 10 }, goals: { total: 7, assists: 2 }, cards: { yellow: 1, red: 0 } }] });
  backend = () => ({ status: 200, body: [1, 2, 3, 4].map(row) });
  let d = data(await call("get_top_players", { league: 39, limit: 2 })); assert.equal(calls[0].url.searchParams.get("endpoint"), "players/topscorers"); assert.equal(d.rows.length, 2); assert.equal(d.rows[0].rank, 1);
  for (const [stat, ep] of [["assists", "players/topassists"], ["yellow_cards", "players/topyellowcards"], ["red_cards", "players/topredcards"]]) { await call("get_top_players", { league: 39, stat }); assert.equal(calls[0].url.searchParams.get("endpoint"), ep); }
});
await test("get_head_to_head tallies wins, draws and goals for the two teams", async () => {
  const m = (h, a, hg, ag, hw, aw, s = "FT") => ({ fixture: { id: 1, status: { short: s } }, league: {}, teams: { home: { id: h, name: "T" + h, winner: hw }, away: { id: a, name: "T" + a, winner: aw } }, goals: { home: hg, away: ag } });
  backend = () => ({ status: 200, body: [m(1, 2, 2, 0, true, false), m(2, 1, 1, 1, null, null), m(2, 1, 0, 3, false, true), m(1, 2, 0, 0, null, null, "NS")] });
  const d = data(await call("get_head_to_head", { teamA: 1, teamB: 2 }));
  assert.equal(calls[0].url.searchParams.get("h2h"), "1-2"); assert.equal(calls[0].url.searchParams.get("last"), "10");
  assert.equal(d.played, 3); assert.equal(d.draws, 1); assert.equal(d.teamA.wins, 2); assert.equal(d.teamB.wins, 0); assert.equal(d.teamA.goals, 6); assert.equal(d.teamB.goals, 1); assert.equal(d.matches.length, 4);
});
await test("get_injuries asks by fixture, or by team/league with a season", async () => {
  backend = () => ({ status: 200, body: [{ player: { id: 5, name: "Z", type: "Missing Fixture", reason: "Knee" }, team: { name: "A" }, fixture: { id: 3, date: "d" } }] });
  const d = data(await call("get_injuries", { fixtureId: 3 })); assert.equal(calls[0].url.searchParams.get("fixture"), "3"); assert.equal(calls[0].url.searchParams.get("season"), null); assert.equal(d.rows[0].reason, "Knee");
  await call("get_injuries", { team: 42 }); assert.equal(calls[0].url.searchParams.get("team"), "42"); assert.equal(calls[0].url.searchParams.get("season"), "2026");
});
await test("search uses the right endpoint per type; players need a league and season", async () => {
  backend = (u) => ({ status: 200, body: { leagues: [{ league: { id: 39, name: "Premier League", type: "League" }, country: { name: "England" } }], teams: [{ team: { id: 42, name: "Arsenal", country: "England" }, venue: { name: "Emirates", city: "London" } }], venues: [{ id: 5, name: "Emirates", city: "London", capacity: 60000 }], players: [{ player: { id: 9, name: "Salah", age: 34 }, statistics: [{ team: { name: "Liverpool" }, games: { position: "Attacker" } }] }] }[{ leagues: "leagues", teams: "teams", venues: "venues", players: "players" }[u.searchParams.get("endpoint")]] });
  for (const [type, ep] of [["league", "leagues"], ["team", "teams"], ["venue", "venues"]]) { const d = data(await call("search", { query: "arsenal", type })); assert.equal(calls[0].url.searchParams.get("endpoint"), ep); assert.equal(calls[0].url.searchParams.get("search"), "arsenal"); assert.equal(d.rows.length, 1); }
  const p = data(await call("search", { query: "salah", type: "player", league: 39 })); assert.equal(calls[0].url.searchParams.get("league"), "39"); assert.equal(calls[0].url.searchParams.get("season"), "2026"); assert.equal(p.rows[0].team, "Liverpool");
});
await test("get_odds keeps the main markets, the 2.5 line only, and at most six bookmakers", async () => {
  const bet = (name, values) => ({ name, values });
  backend = () => ({ status: 200, body: [{ bookmakers: Array.from({ length: 9 }, (_, i) => ({ name: "B" + i, bets: [bet("Match Winner", [{ value: "Home", odd: "1.90" }, { value: "Draw", odd: "3.5" }]), bet("Goals Over/Under", [{ value: "Over 1.5", odd: "1.2" }, { value: "Over 2.5", odd: "1.8" }]), bet("Corners", [{ value: "x", odd: "1" }])] })) }] });
  const d = data(await call("get_odds", { fixtureId: 5 }));
  assert.equal(d.bookmakers.length, 6); assert.deepEqual(d.bookmakers[0].markets, { "Match Winner": { Home: 1.9, Draw: 3.5 }, "Goals Over/Under": { "Over 2.5": 1.8 } });
  backend = () => ({ status: 200, body: [] }); assert.match((await call("get_odds", { fixtureId: 5 })).text, /No odds/);
});
await test("get_predictions asks for the ids, forwards a sign-in only when there is one, and reports locked and missing", async () => {
  backend = () => ({ status: 200, body: { predictions: { 1: { pick: "home", pickProb: 0.6 } }, locked: { 2: { confidence: "high", order: 0 } }, enforced: true } });
  let d = data(await call("get_predictions", { fixtureIds: [1, 2, 3, 3] }));
  assert.equal(calls[0].url.pathname, "/api/predictions"); assert.equal(calls[0].url.searchParams.get("fixtures"), "1,2,3");
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(d.missing, [3]); assert.equal(d.locked[2].confidence, "high"); assert.equal(d.enforced, true);
  await call("get_predictions", { fixtureIds: [1] }, { authorization: "Bearer abc" }); assert.equal(calls[0].headers.Authorization, "Bearer abc");
  await call("get_matches", {}, { authorization: "Bearer abc" }); assert.equal(calls[0].headers.Authorization, undefined, "other tools never forward a sign-in");
});
await test("get_prediction_accuracy, get_news and get_app_status shape their answers", async () => {
  backend = () => ({ status: 200, body: { model: "v2", sample: 10, needed: 200, ready: false } });
  assert.equal(data(await call("get_prediction_accuracy", {})).ready, false); assert.equal(calls[0].url.pathname, "/api/accuracy");
  backend = () => ({ status: 200, body: { found: 99, articles: [{ id: "a", title: "T", description: "D", source: "S", publishedAt: "2026-11-22", url: "https://n.test/a", image: "https://n.test/i.png" }] } });
  const n = data(await call("get_news", { tag: "laliga", page: 2 })); assert.equal(calls[0].url.searchParams.get("tag"), "laliga"); assert.equal(calls[0].url.searchParams.get("page"), "2");
  assert.deepEqual(n.articles[0], { id: "a", title: "T", summary: "D", source: "S", publishedAt: "2026-11-22", url: "https://n.test/a" });
  backend = () => ({ status: 200, body: { maintenance: { on: false, message: "" }, announcement: { on: true, text: "Hi", level: "info", link: "" }, minVersion: "0.1.0", flags: { secret: true }, placements: { a: { on: true } }, fxPrices: {} } });
  const s = data(await call("get_app_status", {})); assert.equal(s.announcement.text, "Hi"); assert.equal(s.maintenance.on, false); assert.ok(!("flags" in s) && !("placements" in s));
});
await test("backend trouble becomes a clear tool error, never a crash or a leak", async () => {
  backend = () => ({ status: 429, headers: { "retry-after": "60" }, body: { error: "Football data is unavailable right now.", code: "FOOTBALL_API_RATE_LIMIT" } });
  let r = await call("get_matches", {}); assert.equal(r.result.isError, true); assert.match(r.text, /limit.*60 seconds/);
  backend = () => ({ status: 503, body: { error: "Football data is unavailable right now.", code: "MISSING_FOOTBALL_API_KEY" } });
  r = await call("get_matches", {}); assert.equal(r.result.isError, true); assert.ok(!/KEY|key/.test(r.text.replace("unavailable", "")), r.text);
  mcp._deps.fetch = async () => { throw new Error("socket hang up 10.0.0.5"); };
  r = await call("get_matches", {}); assert.equal(r.result.isError, true); assert.match(r.text, /unreachable/); assert.ok(!r.text.includes("10.0.0.5"));
  mcp._deps.fetch = async (url, opts) => { calls.push({ url: new URL(url), headers: opts.headers }); const x = backend(new URL(url)); return { ok: x.status < 400, status: x.status, headers: { get: () => null }, json: async () => x.body }; };
  backend = () => ({ status: 200, body: [] }); assert.equal(data(await call("get_matches", {})).total, 0);
});
await test("tool calls are limited per IP; other messages are not", async () => {
  process.env.MCP_RATE_PER_MIN = "3"; backend = () => ({ status: 200, body: [] });
  for (let i = 0; i < 3; i++) assert.equal((await run(rpc("tools/call", { name: "get_app_status", arguments: {} }), { headers: { "x-forwarded-for": "1.2.3.4" } })).code, 200);
  const r = await run(rpc("tools/call", { name: "get_app_status", arguments: {} }, 9), { headers: { "x-forwarded-for": "1.2.3.4" } });
  assert.equal(r.code, 429); assert.equal(r.headers["Retry-After"], "30"); assert.equal(r.body.id, 9);
  assert.equal((await run(rpc("tools/call", { name: "get_app_status", arguments: {} }), { headers: { "x-forwarded-for": "5.6.7.8" } })).code, 200);
  for (let i = 0; i < 10; i++) assert.equal((await run(rpc("ping"), { headers: { "x-forwarded-for": "1.2.3.4" } })).code, 200);
  delete process.env.MCP_RATE_PER_MIN;
});
await test("the address is SITE_URL, or the request's own host; a strange host is refused", async () => {
  backend = () => ({ status: 200, body: {} });
  delete process.env.SITE_URL;
  await call("get_app_status", {}, { host: "scoutwave.test", "x-forwarded-host": "app.example.com" }); assert.equal(calls[0].url.origin, "https://app.example.com");
  assert.match((await call("get_app_status", {}, { "x-forwarded-host": "evil.test/@x" })).text, /SITE_URL/);
  assert.equal(calls.length, 0);
  process.env.SITE_URL = "https://app.test/";
  await call("get_app_status", {}); assert.equal(calls[0].url.origin, "https://app.test");
});
await test("it is wired in: a route in public.js, a /mcp rewrite ahead of the crawler rewrites, no extra function, documented", () => {
  assert.match(fs.readFileSync(path.join(root, "api/public.js"), "utf8"), /mcp:\s*\(\)\s*=>\s*import\("\.\.\/server\/mcp\.js"\)/);
  const rewrites = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).rewrites;
  const first = (src) => rewrites.findIndex((r) => r.source === src);
  for (const s of ["/mcp", "/api/mcp"]) { assert.equal(rewrites[first(s)].destination, "/api/public?route=mcp"); assert.ok(first(s) < rewrites.findIndex((r) => r.has), s + " must come before the user-agent rewrites (AI crawlers' names would otherwise send it to the SEO page)"); }
  assert.ok(!fs.existsSync(path.join(root, "api/mcp.js")));
  assert.ok(fs.existsSync(path.join(root, "docs/MCP.md")));
  assert.match(fs.readFileSync(path.join(root, ".env.example"), "utf8"), /MCP_DISABLED/);
});
console.log(`\n${passed} tests passed`);
