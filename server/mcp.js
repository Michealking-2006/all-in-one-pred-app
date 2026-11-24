// Scoutwave MCP server (Model Context Protocol, Streamable HTTP transport, stateless).
// POST /mcp  (rewritten by vercel.json to /api/public?route=mcp, so it adds no serverless function).
//
// It lets an AI assistant (Claude, ChatGPT, Cursor, MCP Inspector ...) ask Scoutwave for livescores, fixtures, match
// details, standings, top players, head to head, injuries, odds, the stored predictions, the tracked accuracy and the
// news. Every tool is READ-ONLY and goes through Scoutwave's own public endpoints (/api/football, /api/predictions,
// /api/accuracy, /api/news, /api/config) instead of calling a provider directly. That keeps everything the app already
// guarantees: the provider key never leaves the server, answers come from the shared edge cache, the circuit breaker
// and the quota floor protect the daily football allowance, and the prediction gate (who may see a pick) still applies.
//
// No dependencies: the protocol is plain JSON-RPC 2.0 and the small part of it that a stateless tool server needs is
// written out here. There is no session, no server-sent events stream and nothing stored.
import { NEWS_TAGS } from "../src/newsTags.js";

export const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]; // newest first
const SERVER_INFO = { name: "scoutwave", title: "Scoutwave football data", version: "1.0.0" };
const INSTRUCTIONS =
  "Scoutwave: football livescores, fixtures, standings, match details, head to head, injuries, odds, predictions and news. " +
  "All tools are read-only. Ids are API-Football ids: find them with `search` (leagues, teams, venues, players) or from `get_matches`. " +
  "Dates are YYYY-MM-DD (UTC unless a timezone is given). `season` is the year the season started (2025 = 2025/26) and defaults to the current one. " +
  "Predictions come from Scoutwave's own model; a pick can be locked (only its confidence is shown) unless the caller is signed in with Premium or unlocked that match. " +
  "Football data is limited by a daily allowance, so ask for what you need rather than sweeping many matches.";

// Tests replace these; nothing else touches them.
export const _deps = { fetch: (...a) => fetch(...a), now: () => Date.now() };

// ---------------------------------------------------------------------------------------------------------------------
// Errors. `Fail` is a problem the model can read and act on (bad argument, no data, rate limit): it becomes a tool
// result with isError:true. `Rpc` is a protocol-level error (unknown method or tool).
class Fail extends Error {}
class Rpc extends Error { constructor(code, message) { super(message); this.code = code; } }

// ---------------------------------------------------------------------------------------------------------------------
// Argument helpers. Everything a caller sends is checked here, so nothing unchecked ever reaches a query string.
const MAX_TEXT = 120;
function only(args, allowed) {
  for (const key of Object.keys(args)) if (!allowed.includes(key)) throw new Fail(`Unknown argument "${key}". Allowed: ${allowed.join(", ") || "none"}.`);
}
function int(args, key, { min = 1, max = 2147483647, required = false, fallback } = {}) {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new Fail(`"${key}" is required.`);
    return fallback;
  }
  const n = typeof v === "number" ? v : /^-?\d+$/.test(String(v).trim()) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new Fail(`"${key}" must be a whole number from ${min} to ${max}.`);
  return n;
}
function text(args, key, { min = 1, max = MAX_TEXT, required = false } = {}) {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new Fail(`"${key}" is required.`);
    return undefined;
  }
  if (typeof v !== "string") throw new Fail(`"${key}" must be text.`);
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (s.length < min) throw new Fail(`"${key}" must be at least ${min} characters.`);
  if (s.length > max) throw new Fail(`"${key}" must be at most ${max} characters.`);
  return s;
}
function pick(args, key, options, { required = false, fallback } = {}) {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new Fail(`"${key}" is required (${options.join(", ")}).`);
    return fallback;
  }
  if (!options.includes(v)) throw new Fail(`"${key}" must be one of: ${options.join(", ")}.`);
  return v;
}
function day(args, key) {
  const s = text(args, key, { min: 10, max: 10 });
  if (s === undefined) return undefined;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
  if (!ok) throw new Fail(`"${key}" must be a real date like 2026-05-17.`);
  return s;
}
function timezone(args) {
  const s = text(args, "timezone", { max: 64 });
  if (s === undefined) return undefined;
  if (!/^[A-Za-z_]+(?:\/[A-Za-z_+\-0-9]+){0,2}$/.test(s)) throw new Fail('"timezone" must look like Europe/London.');
  return s;
}
function ids(args, key, { max = 60 } = {}) {
  const v = args[key];
  if (!Array.isArray(v) || !v.length) throw new Fail(`"${key}" must be a list of 1 to ${max} whole numbers.`);
  const out = [...new Set(v.map((x) => (typeof x === "number" ? x : /^\d+$/.test(String(x).trim()) ? Number(x) : NaN)))];
  if (out.length > max || out.some((n) => !Number.isInteger(n) || n < 1 || n > 2147483647)) throw new Fail(`"${key}" must be a list of 1 to ${max} whole numbers.`);
  return out;
}
const seasonNow = () => { const d = new Date(_deps.now()); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; }; // July starts a new season
const today = () => new Date(_deps.now()).toISOString().slice(0, 10);
const season = (args) => int(args, "season", { min: 1990, max: seasonNow() + 1, fallback: seasonNow() });

// ---------------------------------------------------------------------------------------------------------------------
// Reaching Scoutwave's own endpoints (through the public address, so the shared edge cache answers repeat questions).
function origin(req) {
  const configured = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) throw new Fail("The Scoutwave address is not configured (set SITE_URL).");
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  return `${local ? "http" : "https"}://${host}`; // a public address is always reached over https
}

async function backend(ctx, path, params = {}, { auth = false } = {}) {
  const url = new URL(path, origin(ctx.req));
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers = { Accept: "application/json", "User-Agent": "scoutwave-mcp/" + SERVER_INFO.version };
  if (auth && ctx.req.headers?.authorization) headers.Authorization = String(ctx.req.headers.authorization);
  let response;
  try {
    response = await _deps.fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Fail("Scoutwave data is unreachable right now. Try again in a moment.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const wait = Number(response.headers?.get?.("retry-after")) || Number(body?.retryAfter) || 0;
    if (response.status === 429) throw new Fail(`Football data is at its limit right now.${wait ? ` Try again in about ${wait} seconds.` : " Try again shortly."}`);
    if (response.status === 404) throw new Fail("Not found.");
    throw new Fail(String(body?.error || "Scoutwave data is unavailable right now.") + (wait ? ` (retry in ${wait}s)` : ""));
  }
  return body;
}
const football = (ctx, endpoint, params) => backend(ctx, "/api/football", { endpoint, ...params });

// ---------------------------------------------------------------------------------------------------------------------
// Trimming: models need the facts, not the provider's logos, coverage tables and urls.
const FINISHED = new Set(["FT", "AET", "PEN"]);
const list = (v) => (Array.isArray(v) ? v : []);
const fixtureRow = (fx) => ({
  id: fx?.fixture?.id ?? null,
  kickoff: fx?.fixture?.date ?? null,
  status: fx?.fixture?.status?.long ?? null,
  statusCode: fx?.fixture?.status?.short ?? null,
  minute: fx?.fixture?.status?.elapsed ?? null,
  venue: fx?.fixture?.venue?.name ?? null,
  league: { id: fx?.league?.id ?? null, name: fx?.league?.name ?? null, country: fx?.league?.country ?? null, round: fx?.league?.round ?? null, season: fx?.league?.season ?? null },
  home: { id: fx?.teams?.home?.id ?? null, name: fx?.teams?.home?.name ?? null, goals: fx?.goals?.home ?? null },
  away: { id: fx?.teams?.away?.id ?? null, name: fx?.teams?.away?.name ?? null, goals: fx?.goals?.away ?? null },
  halftime: fx?.score?.halftime && fx.score.halftime.home != null ? `${fx.score.halftime.home}-${fx.score.halftime.away}` : null,
});

const ROW_CAP = 100;
const capRows = (rows, max = ROW_CAP) => ({ rows: rows.slice(0, max), total: rows.length, truncated: rows.length > max });

// ---------------------------------------------------------------------------------------------------------------------
// The tools.
const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const SEASON = { type: "integer", description: "Year the season started (2025 = 2025/26). Defaults to the current season." };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: "search",
    title: "Search leagues, teams, venues or players",
    description: "Find the id of a league, team, venue or player by name (at least 3 letters). Players can only be searched inside one league (a provider rule), so `league` is required for type \"player\".",
    inputSchema: obj({
      query: { type: "string", minLength: 3, maxLength: MAX_TEXT, description: "Name to look for, e.g. \"arsenal\", \"premier league\", \"salah\"." },
      type: { type: "string", enum: ["league", "team", "venue", "player"], description: "What to search for." },
      league: { type: "integer", description: "League id. Required when type is \"player\"." },
      season: SEASON,
    }, ["query", "type"]),
    async run(args, ctx) {
      only(args, ["query", "type", "league", "season"]);
      const query = text(args, "query", { min: 3, required: true });
      const type = pick(args, "type", ["league", "team", "venue", "player"], { required: true });
      if (type === "league") {
        const rows = list(await football(ctx, "leagues", { search: query })).map((r) => ({ id: r?.league?.id, name: r?.league?.name, kind: r?.league?.type, country: r?.country?.name || null }));
        return capRows(rows, 25);
      }
      if (type === "team") {
        const rows = list(await football(ctx, "teams", { search: query })).map((r) => ({ id: r?.team?.id, name: r?.team?.name, country: r?.team?.country || null, national: !!r?.team?.national, founded: r?.team?.founded ?? null, venue: r?.venue?.name || null, city: r?.venue?.city || null }));
        return capRows(rows, 25);
      }
      if (type === "venue") {
        const rows = list(await football(ctx, "venues", { search: query })).map((v) => ({ id: v?.id, name: v?.name, city: v?.city || null, country: v?.country || null, capacity: v?.capacity ?? null, surface: v?.surface || null }));
        return capRows(rows, 25);
      }
      const league = int(args, "league", { required: true });
      const rows = list(await football(ctx, "players", { search: query, league, season: season(args) })).map((r) => ({
        id: r?.player?.id, name: r?.player?.name, age: r?.player?.age ?? null, nationality: r?.player?.nationality || null,
        team: r?.statistics?.[0]?.team?.name || null, position: r?.statistics?.[0]?.games?.position || null,
      }));
      return capRows(rows, 25);
    },
  },
  {
    name: "get_matches",
    title: "Get matches (livescores, a day, or a team's next/last)",
    description: "Matches for one day (default today), everything live right now, or a team's next/last matches. Optional league filter. Returns kickoff, status, minute and score for each. Use the match `id` with get_match_details.",
    inputSchema: obj({
      date: { type: "string", description: "Day as YYYY-MM-DD. Default: today (UTC). Ignored when live is true or next/last is used." },
      live: { type: "boolean", description: "true = only matches in play right now." },
      league: { type: "integer", description: "Only this league id." },
      season: SEASON,
      team: { type: "integer", description: "Team id. Use with next or last." },
      next: { type: "integer", minimum: 1, maximum: 20, description: "The team's next N matches (needs team)." },
      last: { type: "integer", minimum: 1, maximum: 20, description: "The team's last N matches (needs team)." },
      timezone: { type: "string", description: "IANA timezone for kickoff times, e.g. Europe/London. Default UTC." },
    }),
    async run(args, ctx) {
      only(args, ["date", "live", "league", "season", "team", "next", "last", "timezone"]);
      if (args.live !== undefined && typeof args.live !== "boolean") throw new Fail('"live" must be true or false.');
      const league = int(args, "league"), team = int(args, "team"), next = int(args, "next", { max: 20 }), last = int(args, "last", { max: 20 }), tz = timezone(args);
      if ((next || last) && !team) throw new Fail('"next" and "last" need a "team" id.');
      if (next && last) throw new Fail('Use either "next" or "last", not both.');
      const params = { timezone: tz };
      if (args.live === true) params.live = league || "all"; // the provider takes a league id or "all"
      else if (team && (next || last)) Object.assign(params, { team, next, last });
      else {
        params.date = day(args, "date") || today();
        if (league) Object.assign(params, { league, season: season(args) });
        if (team) params.team = team;
      }
      const rows = list(await football(ctx, "fixtures", params)).map(fixtureRow);
      return capRows(rows);
    },
  },
  {
    name: "get_match_details",
    title: "Get one match in detail",
    description: "One match by id: score, status, referee, events (goals, cards, substitutions), lineups with formations and team statistics. Choose which parts to return with `include`.",
    inputSchema: obj({
      fixtureId: { type: "integer", minimum: 1, description: "Match id from get_matches." },
      include: { type: "array", items: { type: "string", enum: ["events", "lineups", "statistics"] }, description: "Parts to return. Default: all three." },
    }, ["fixtureId"]),
    async run(args, ctx) {
      only(args, ["fixtureId", "include"]);
      const id = int(args, "fixtureId", { required: true });
      const include = args.include === undefined ? ["events", "lineups", "statistics"] : args.include;
      if (!Array.isArray(include) || include.some((x) => !["events", "lineups", "statistics"].includes(x))) throw new Fail('"include" must be a list of: events, lineups, statistics.');
      const fx = list(await football(ctx, "fixtures", { id }))[0];
      if (!fx) throw new Fail("No match with that id.");
      const out = { ...fixtureRow(fx), referee: fx?.fixture?.referee || null };
      if (include.includes("events")) out.events = list(fx.events).map((e) => ({ minute: e?.time?.elapsed ?? null, extra: e?.time?.extra ?? null, team: e?.team?.name || null, player: e?.player?.name || null, assist: e?.assist?.name || null, type: e?.type || null, detail: e?.detail || null }));
      if (include.includes("lineups")) out.lineups = list(fx.lineups).map((l) => ({
        team: l?.team?.name || null, formation: l?.formation || null, coach: l?.coach?.name || null,
        startXI: list(l?.startXI).map((p) => ({ number: p?.player?.number ?? null, name: p?.player?.name || null, position: p?.player?.pos || null })),
        substitutes: list(l?.substitutes).map((p) => ({ number: p?.player?.number ?? null, name: p?.player?.name || null, position: p?.player?.pos || null })),
      }));
      if (include.includes("statistics")) out.statistics = list(fx.statistics).map((s) => ({ team: s?.team?.name || null, stats: Object.fromEntries(list(s?.statistics).filter((x) => x?.type).map((x) => [x.type, x.value])) }));
      return out;
    },
  },
  {
    name: "get_standings",
    title: "League table",
    description: "The league table for a league and season (several groups for cups with group stages). Returns rank, points, record, goals and recent form.",
    inputSchema: obj({ league: { type: "integer", minimum: 1, description: "League id from search." }, season: SEASON }, ["league"]),
    async run(args, ctx) {
      only(args, ["league", "season"]);
      const league = int(args, "league", { required: true });
      const sn = season(args);
      const first = list(await football(ctx, "standings", { league, season: sn }))[0];
      if (!first) throw new Fail("No table for that league and season.");
      return {
        league: { id: first.league?.id ?? league, name: first.league?.name || null, country: first.league?.country || null, season: first.league?.season ?? sn },
        groups: list(first.league?.standings).map((g) => ({
          name: g?.[0]?.group || null,
          table: list(g).map((r) => ({ rank: r?.rank, team: r?.team?.name, teamId: r?.team?.id, played: r?.all?.played, won: r?.all?.win, drawn: r?.all?.draw, lost: r?.all?.lose, goalsFor: r?.all?.goals?.for, goalsAgainst: r?.all?.goals?.against, goalDiff: r?.goalsDiff, points: r?.points, form: r?.form || null, note: r?.description || null })),
        })),
      };
    },
  },
  {
    name: "get_top_players",
    title: "Top scorers, assists and cards",
    description: "The leading players of a league season by goals, assists, yellow cards or red cards.",
    inputSchema: obj({
      league: { type: "integer", minimum: 1, description: "League id from search." },
      stat: { type: "string", enum: ["goals", "assists", "yellow_cards", "red_cards"], description: "Default goals." },
      season: SEASON,
      limit: { type: "integer", minimum: 1, maximum: 20, description: "How many players. Default 10." },
    }, ["league"]),
    async run(args, ctx) {
      only(args, ["league", "stat", "season", "limit"]);
      const league = int(args, "league", { required: true });
      const stat = pick(args, "stat", ["goals", "assists", "yellow_cards", "red_cards"], { fallback: "goals" });
      const limit = int(args, "limit", { max: 20, fallback: 10 });
      const endpoint = { goals: "players/topscorers", assists: "players/topassists", yellow_cards: "players/topyellowcards", red_cards: "players/topredcards" }[stat];
      const rows = list(await football(ctx, endpoint, { league, season: season(args) })).slice(0, limit).map((r, i) => {
        const s = r?.statistics?.[0] || {};
        return { rank: i + 1, id: r?.player?.id, name: r?.player?.name, nationality: r?.player?.nationality || null, team: s?.team?.name || null, appearances: s?.games?.appearences ?? null, goals: s?.goals?.total ?? 0, assists: s?.goals?.assists ?? 0, yellowCards: s?.cards?.yellow ?? 0, redCards: s?.cards?.red ?? 0 };
      });
      return { stat, rows };
    },
  },
  {
    name: "get_head_to_head",
    title: "Head to head between two teams",
    description: "Past meetings of two teams (newest first) with a tally of wins, draws and goals.",
    inputSchema: obj({
      teamA: { type: "integer", minimum: 1, description: "First team id." },
      teamB: { type: "integer", minimum: 1, description: "Second team id." },
      last: { type: "integer", minimum: 1, maximum: 20, description: "How many meetings. Default 10." },
    }, ["teamA", "teamB"]),
    async run(args, ctx) {
      only(args, ["teamA", "teamB", "last"]);
      const a = int(args, "teamA", { required: true }), b = int(args, "teamB", { required: true }), last = int(args, "last", { max: 20, fallback: 10 });
      if (a === b) throw new Fail("Pick two different teams.");
      const fixtures = list(await football(ctx, "fixtures/headtohead", { h2h: `${a}-${b}`, last }));
      const rows = fixtures.map(fixtureRow);
      const tally = { [a]: { name: null, wins: 0, goals: 0 }, [b]: { name: null, wins: 0, goals: 0 } };
      let draws = 0, played = 0;
      for (const fx of fixtures) {
        if (!FINISHED.has(fx?.fixture?.status?.short)) continue;
        const h = fx.teams?.home, w = fx.teams?.away;
        if (!tally[h?.id] || !tally[w?.id]) continue;
        played++;
        tally[h.id].name = h.name; tally[w.id].name = w.name;
        tally[h.id].goals += Number(fx.goals?.home) || 0; tally[w.id].goals += Number(fx.goals?.away) || 0;
        if (h.winner === true) tally[h.id].wins++; else if (w.winner === true) tally[w.id].wins++; else draws++;
      }
      return { played, draws, teamA: { id: a, ...tally[a] }, teamB: { id: b, ...tally[b] }, matches: rows };
    },
  },
  {
    name: "get_injuries",
    title: "Injuries and suspensions",
    description: "Players who are out or doubtful, for one team, one match or one league season. Give at least one of team, fixtureId or league.",
    inputSchema: obj({
      team: { type: "integer", minimum: 1, description: "Team id (uses the given or current season)." },
      fixtureId: { type: "integer", minimum: 1, description: "Match id." },
      league: { type: "integer", minimum: 1, description: "League id (uses the given or current season)." },
      season: SEASON,
    }),
    async run(args, ctx) {
      only(args, ["team", "fixtureId", "league", "season"]);
      const team = int(args, "team"), fixture = int(args, "fixtureId"), league = int(args, "league");
      if (!team && !fixture && !league) throw new Fail('Give at least one of "team", "fixtureId" or "league".');
      const params = fixture ? { fixture } : { team, league, season: season(args) };
      const rows = list(await football(ctx, "injuries", params)).map((r) => ({ player: r?.player?.name || null, playerId: r?.player?.id ?? null, status: r?.player?.type || null, reason: r?.player?.reason || null, team: r?.team?.name || null, fixtureId: r?.fixture?.id ?? null, date: r?.fixture?.date || null }));
      return capRows(rows, 60);
    },
  },
  {
    name: "get_odds",
    title: "Bookmaker odds for a match",
    description: "Pre-match odds from a few bookmakers for the main markets (match winner, double chance, over/under 2.5 goals, both teams to score). Information only.",
    inputSchema: obj({ fixtureId: { type: "integer", minimum: 1, description: "Match id from get_matches." } }, ["fixtureId"]),
    async run(args, ctx) {
      only(args, ["fixtureId"]);
      const fixture = int(args, "fixtureId", { required: true });
      const first = list(await football(ctx, "odds", { fixture }))[0];
      if (!first) throw new Fail("No odds for that match yet.");
      const MARKETS = new Set(["Match Winner", "Double Chance", "Goals Over/Under", "Both Teams Score"]);
      return {
        fixtureId: fixture,
        bookmakers: list(first.bookmakers).slice(0, 6).map((b) => ({
          name: b?.name || null,
          markets: Object.fromEntries(list(b?.bets).filter((m) => MARKETS.has(m?.name)).map((m) => [m.name, Object.fromEntries(list(m.values).filter((v) => m.name !== "Goals Over/Under" || /2\.5$/.test(String(v?.value))).map((v) => [String(v?.value), Number(v?.odd)]))])),
        })),
      };
    },
  },
  {
    name: "get_predictions",
    title: "Scoutwave predictions",
    description: "Scoutwave's own stored pre-match predictions for up to 60 matches: pick, 1X2 probabilities, likely score, confidence and a short note. When prediction access is enforced, picks for matches the caller has not unlocked come back locked (only confidence and rank). Sending the user's Scoutwave sign-in as an Authorization header unlocks what that account may see.",
    inputSchema: obj({ fixtureIds: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: 60, description: "Match ids from get_matches." } }, ["fixtureIds"]),
    async run(args, ctx) {
      only(args, ["fixtureIds"]);
      const fixtures = ids(args, "fixtureIds").join(",");
      const body = await backend(ctx, "/api/predictions", { fixtures }, { auth: true });
      return { predictions: body?.predictions || {}, locked: body?.locked || {}, enforced: body?.enforced === true, missing: ids(args, "fixtureIds").filter((id) => !body?.predictions?.[id] && !body?.locked?.[id]) };
    },
  },
  {
    name: "get_prediction_accuracy",
    title: "Tracked accuracy of the predictions",
    description: "How accurate Scoutwave's predictions have been on graded matches. Until enough matches are graded it only reports progress (sample and needed).",
    inputSchema: obj({}),
    async run(args, ctx) {
      only(args, []);
      return await backend(ctx, "/api/accuracy");
    },
  },
  {
    name: "get_news",
    title: "Football news",
    description: "Latest football stories, optionally for a topic tag (league, competition or club). Each story has a title, summary, source, date and link to the full article.",
    inputSchema: obj({
      tag: { type: "string", enum: NEWS_TAGS.map((t) => t.id), description: "Topic. Omit for the general feed." },
      page: { type: "integer", minimum: 1, maximum: 20, description: "Page of results. Default 1." },
    }),
    async run(args, ctx) {
      only(args, ["tag", "page"]);
      const tag = pick(args, "tag", NEWS_TAGS.map((t) => t.id));
      const page = int(args, "page", { max: 20, fallback: 1 });
      const body = await backend(ctx, "/api/news", { tag, page });
      return { tag: tag || null, page, found: body?.found ?? null, articles: list(body?.articles).map((a) => ({ id: a.id, title: a.title, summary: a.description, source: a.source, publishedAt: a.publishedAt, url: a.url })) };
    },
  },
  {
    name: "get_app_status",
    title: "Scoutwave service status",
    description: "Whether Scoutwave is in maintenance and any announcement currently shown to users.",
    inputSchema: obj({}),
    async run(args, ctx) {
      only(args, []);
      const c = await backend(ctx, "/api/config");
      const a = c?.announcement?.on ? { text: c.announcement.text, level: c.announcement.level, link: c.announcement.link || null, expiresAt: c.announcement.expiresAt || null } : null;
      return { maintenance: c?.maintenance?.on === true ? { on: true, message: c.maintenance.message || "" } : { on: false }, announcement: a, minimumAppVersion: c?.minVersion || null };
    },
  },
];

const PUBLIC_TOOLS = TOOLS.map(({ run, ...tool }) => ({ ...tool, annotations: { ...READ_ONLY, title: tool.title } }));

// ---------------------------------------------------------------------------------------------------------------------
// JSON-RPC.
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const MAX_RESULT = 100_000;

async function callTool(params, ctx) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) throw new Rpc(-32602, `Unknown tool: ${String(params?.name).slice(0, 60)}`);
  const args = params.arguments === undefined || params.arguments === null ? {} : params.arguments;
  try {
    if (typeof args !== "object" || Array.isArray(args)) throw new Fail('"arguments" must be an object.');
    const out = await tool.run(args, ctx);
    let body = JSON.stringify(out);
    if (body.length > MAX_RESULT) body = body.slice(0, MAX_RESULT) + '… [truncated: ask for fewer or narrower results]';
    return { content: [{ type: "text", text: body }] };
  } catch (error) {
    if (error instanceof Fail) return { isError: true, content: [{ type: "text", text: error.message }] };
    console.error("mcp tool failed:", tool.name, error?.message || error);
    return { isError: true, content: [{ type: "text", text: "Something went wrong. Try again in a moment." }] };
  }
}

async function handleMessage(msg, ctx) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0") return fail(msg?.id, -32600, "Invalid Request");
  if (typeof msg.method !== "string") return null; // a reply from the client: nothing to answer
  const notification = !("id" in msg);
  try {
    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return ok(msg.id, {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case "ping": return notification ? null : ok(msg.id, {});
      case "tools/list": return notification ? null : ok(msg.id, { tools: PUBLIC_TOOLS });
      case "tools/call": return notification ? null : ok(msg.id, await callTool(msg.params, ctx));
      default:
        if (notification) return null; // notifications/initialized, notifications/cancelled, ...
        throw new Rpc(-32601, `Method not found: ${msg.method.slice(0, 60)}`);
    }
  } catch (error) {
    if (error instanceof Rpc) return fail(msg.id, error.code, error.message);
    console.error("mcp failed:", error?.message || error);
    return fail(msg.id, -32603, "Internal error");
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// HTTP.
const recent = new Map(); // ip -> [timestamps] of tool calls
function limited(ip) {
  const per = Math.max(1, Number(process.env.MCP_RATE_PER_MIN) || 60);
  const now = _deps.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > per;
}
export const _resetLimits = () => recent.clear();

function cors(res) {
  // Nothing here uses cookies, so any origin may call: a browser tool such as MCP Inspector works.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  cors(res);
  if (String(process.env.MCP_DISABLED || "") === "1") return res.status(404).json({ error: "Not found" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "This is a Model Context Protocol endpoint: send JSON-RPC with POST.", name: SERVER_INFO.name, protocol: PROTOCOLS[0], docs: "docs/MCP.md" });
  }

  const version = req.headers?.["mcp-protocol-version"];
  if (version && !PROTOCOLS.includes(String(version))) return res.status(400).json(fail(null, -32600, `Unsupported protocol version. Supported: ${PROTOCOLS.join(", ")}`));

  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json(fail(null, -32700, "Parse error")); } }
  if (body === undefined || body === null) return res.status(400).json(fail(null, -32700, "Parse error"));

  const messages = Array.isArray(body) ? body : [body];
  if (!messages.length || messages.length > 20) return res.status(400).json(fail(null, -32600, "Send 1 to 20 messages."));

  if (messages.some((m) => m?.method === "tools/call")) {
    const ip = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    if (limited(ip)) {
      res.setHeader("Retry-After", "30");
      return res.status(429).json(fail(messages.find((m) => m?.method === "tools/call")?.id, -32000, "Too many requests. Slow down and try again in about 30 seconds."));
    }
  }

  const ctx = { req };
  const answers = (await Promise.all(messages.map((m) => handleMessage(m, ctx)))).filter(Boolean);
  if (!answers.length) return res.status(202).end();
  return res.status(200).json(Array.isArray(body) ? answers : answers[0]);
}
