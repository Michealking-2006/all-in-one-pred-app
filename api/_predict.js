// Server-side prediction jobs: record predictions for upcoming matches BEFORE
// kick-off, grade them afterwards, keep benchmark odds. Used by api/cron.js and
// the admin dashboard. The leading underscore keeps Vercel from exposing it.
//
// The numbers come only from our own statistical model (src/predictions/model.js). Older model
// versions (api/_models.js) are recorded beside it on the same matches, never shown, only compared.
// DeepSeek, when enabled, only writes a short plain-language note about numbers it
// is given; it never changes a probability. No third-party prediction service is read.
import { env, sb, HttpError } from "./_admin.js";
import { tableFor, MODEL_VERSION } from "../src/predictions/model.js";
import { ALL_MODELS } from "./_models.js";
import { matchesFrom } from "../src/predictions/ratings.js";
import { gradeOne } from "../src/predictions/metrics.js";
import { recordUsage } from "./_usage.js";
import { classifyError, classifyText, recordServiceError } from "./_errors.js";
import { q } from "./_query.js";

const BASE = "https://v3.football.api-sports.io";
const FINISHED = "FT-AET-PEN";
const DAY = 86400000;
const num = (name, fallback) => { const v = Number(env(name)); return Number.isFinite(v) && env(name) !== "" ? v : fallback; };
const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Football API with a hard call budget (every counted request goes through here)
// ---------------------------------------------------------------------------
export async function footballStatus() {
  const key = env("SCOUTWAVE_FOOTBALL_API_KEY");
  if (!key) throw new HttpError(503, "Football data is unavailable right now.");
  const res = await fetch(BASE + "/status", { headers: { "x-apisports-key": key }, signal: AbortSignal.timeout(6000) }).catch(() => null); // free: not counted
  const r = (await res?.json().catch(() => null))?.response;
  if (!r || Array.isArray(r)) throw new HttpError(502, "Football data is unavailable right now.");
  return { used: Number(r.requests?.current) || 0, limit: Number(r.requests?.limit_day) || 0, plan: String(r.subscription?.plan || "") };
}

// Budget = everything the football API still has today, minus a small reserve (PREDICT_RESERVE, default 1).
// With 19 requests left the job may spend 18; with 3 left, 2. A low quota never switches predicting off: the job
// spends what it can on the matches that matter most and the next daily run carries on (matches already
// recorded are skipped). PREDICT_MAX_CALLS (default 300) is only a safety ceiling, PREDICT_QUOTA_SHARE
// (default 1 = all of it) can still hold some back. Saved data (the api_cache table) costs no requests.
export async function makeBudget() {
  let left = null, plan = "";
  try { const status = await footballStatus(); left = Math.max(0, status.limit - status.used); plan = status.plan; }
  catch (e) { if (e?.status === 503) throw e; /* no key: nothing can work; any other failure: carry on below */ }
  const ceiling = Math.max(0, Math.floor(num("PREDICT_MAX_CALLS", 300)));
  const reserve = Math.max(0, Math.floor(num("PREDICT_RESERVE", 1)));
  const share = Math.max(0, Math.min(1, num("PREDICT_QUOTA_SHARE", 1)));
  // If the quota counter can't be read, assume little rather than nothing (the API refuses politely when it is really out).
  const calls = left === null ? Math.min(ceiling, 20) : Math.max(0, Math.min(ceiling, Math.floor((left - reserve) * share)));
  return { calls, spent: 0, quotaLeft: left, reserve, plan };
}

// Slow-moving answers are remembered for a few minutes inside a running function instance, so pressing "Record
// predictions now" twice (or cron + a manual run) doesn't pay twice. Free: they don't count against the budget.
// Only a season's table and a season's finished matches qualify; the day's not-started list is always fetched fresh.
const memo = new Map();
const memoMs = () => { const v = Number(env("PREDICT_MEMO_SECONDS")); return (Number.isFinite(v) && env("PREDICT_MEMO_SECONDS") !== "" ? v : 600) * 1000; };
const memoable = (endpoint, params) => endpoint === "standings" || (endpoint === "fixtures" && params.league && params.season);

// Second layer, shared between runs and instances: the api_cache table (migration 009). Optional: if the table
// isn't there, or Supabase hiccups, the job just fetches. Only a compact copy is kept (what the models read).
const keepMinutes = () => { const v = Number(env("PREDICT_CACHE_MINUTES")); return env("PREDICT_CACHE_MINUTES") !== "" && Number.isFinite(v) ? v : 180; };
const compact = (endpoint, data) => (endpoint === "fixtures"
  ? { response: (data.response || []).map((fx) => ({ fixture: { id: fx.fixture?.id, date: fx.fixture?.date, status: { short: fx.fixture?.status?.short } }, league: { id: fx.league?.id, name: fx.league?.name, season: fx.league?.season }, teams: { home: { id: fx.teams?.home?.id, name: fx.teams?.home?.name }, away: { id: fx.teams?.away?.id, name: fx.teams?.away?.name } }, goals: fx.goals, score: { fulltime: fx.score?.fulltime } })) }
  : endpoint === "predictions"
    ? { response: (data.response || []).slice(0, 1).map((it) => { const slim = (t) => ({ id: t?.id, name: t?.name, league: { form: t?.league?.form, fixtures: t?.league?.fixtures && { played: t.league.fixtures.played, wins: t.league.fixtures.wins, draws: t.league.fixtures.draws, loses: t.league.fixtures.loses }, goals: t?.league?.goals && { for: { total: t.league.goals.for?.total }, against: { total: t.league.goals.against?.total } } } }); return { predictions: { percent: it.predictions?.percent }, teams: { home: slim(it.teams?.home), away: slim(it.teams?.away) } }; }) }
    : { response: data.response });
const storedGet = async (key, minutes = keepMinutes()) => {
  if (minutes <= 0 || !env("SUPABASE_SERVICE_ROLE_KEY")) return null;
  try {
    const rows = await sb(`/rest/v1/api_cache?key=eq.${q.text(key)}&select=data,fetched_at&limit=1`);
    const r = Array.isArray(rows) ? rows[0] : null;
    return r && Date.now() - new Date(r.fetched_at).getTime() < minutes * 60000 ? r.data : null;
  } catch { return null; }
};
const storedPut = async (key, data, minutes = keepMinutes()) => {
  if (minutes <= 0 || !env("SUPABASE_SERVICE_ROLE_KEY")) return;
  try { await sb("/rest/v1/api_cache?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: [{ key, data, fetched_at: new Date().toISOString() }] }); } catch { /* optional */ }
};
export const clearMemo = () => memo.clear(); // for tests

// opts.cacheMinutes: also remember this answer (in memory and in api_cache) for that long. Used for the not-started
// lists of days further away, which change slowly, so a daily run doesn't re-buy them every time.
export async function football(budget, endpoint, params, source = "cron", opts = {}) {
  const minutes = opts.cacheMinutes ?? keepMinutes();
  const key = opts.cacheMinutes ? endpoint + "?" + JSON.stringify(Object.entries(params).sort())
    : memoable(endpoint, params) ? endpoint + "?" + JSON.stringify(Object.entries(params).sort()) : null;
  if (key && memoMs() > 0) { const hit = memo.get(key); if (hit && Date.now() - hit.at < Math.min(memoMs(), minutes * 60000)) return hit.data; }
  if (key) { const saved = await storedGet(key, minutes); if (saved) { memo.set(key, { at: Date.now(), data: saved }); return saved; } }
  const data = await footballFresh(budget, endpoint, params, source);
  if (key && data) {
    if (memoMs() > 0) { memo.set(key, { at: Date.now(), data }); if (memo.size > 200) memo.delete(memo.keys().next().value); }
    await storedPut(key, compact(endpoint, data), minutes);
  }
  return data;
}

// Why a football API call failed, in plain terms. The API answers 200 with an "errors" object (for example
// { plan: "Free plans do not have access to this season..." } or { rateLimit: "Too many requests..." }).
//   plan  = the subscription does not cover this request (a season, a date range, an endpoint): retrying cannot help
//   rate  = too many requests per minute: wait a few seconds
//   quota = the daily allowance is used up
export { classifyError };

async function footballFresh(budget, endpoint, params, source) {
  if (budget.spent >= budget.calls) return null; // out of budget: caller carries on with what it has
  budget.spent++;
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();
  const note = (kind, text) => {
    budget.lastError = { endpoint, kind, text };
    const log = (budget.errorLog ||= {});
    const row = (log[endpoint] ||= { count: 0, kind, message: text });
    row.count++;
    if (row.count === 1) recordServiceError("predict", kind, endpoint, text, null); // once per endpoint per run: the admin Errors page
  };
  let res;
  try {
    res = await fetch(`${BASE}/${endpoint}?${query}`, { headers: { "x-apisports-key": env("SCOUTWAVE_FOOTBALL_API_KEY"), Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  } catch { note("other", "no answer from the football data service"); await recordUsage(source, endpoint, 1, 1); return null; }
  const data = await res.json().catch(() => null);
  const hasErrors = data?.errors && (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors).length);
  const failed = !res.ok || !data || hasErrors;
  // The per-minute allowance, when the service reports it: lets a caller slow down before being refused.
  const perMinute = Number(res.headers?.get?.("x-ratelimit-remaining"));
  budget.minuteLeft = Number.isFinite(perMinute) ? perMinute : null;
  if (failed) { const why = classifyError(data?.errors, res.status); note(why.kind, why.text); } else budget.lastError = null;
  await recordUsage(source, endpoint, 1, failed ? 1 : 0);
  return failed ? null : data;
}

// A season's goals for / against for the two teams of a match, from the per-match prediction answer, shaped like
// league table rows so the same model can use them. One request per match instead of one per league: this is
// how predictions work when the plan cannot read league tables.
export function rowsFromPredictions(item) {
  const out = [];
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  for (const side of ["home", "away"]) {
    const t = item?.teams?.[side], lg = t?.league;
    if (!t?.id || !lg?.fixtures?.played || !lg?.goals?.for?.total || !lg?.goals?.against?.total) continue;
    const split = (k) => ({
      played: n(lg.fixtures.played[k]), win: n(lg.fixtures.wins?.[k]), draw: n(lg.fixtures.draws?.[k]), lose: n(lg.fixtures.loses?.[k]),
      goals: { for: n(lg.goals.for.total[k]), against: n(lg.goals.against.total[k]) },
    });
    const row = { team: { id: t.id, name: t.name }, home: split("home"), away: split("away"), all: split("total"), form: String(lg.form || "").toUpperCase().replace(/[^WDL]/g, "").slice(-5) };
    if (row.all.played >= 1) out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Odds: bookmaker prices -> probabilities with the margin removed (benchmark + edge)
// ---------------------------------------------------------------------------
const noVig = (odds) => {
  const inv = Object.fromEntries(Object.entries(odds).map(([k, o]) => [k, 1 / o]));
  const total = Object.values(inv).reduce((s, v) => s + v, 0);
  return Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, v / total]));
};
const decimal = (v) => { const n = Number(v); return Number.isFinite(n) && n > 1 ? n : null; };

export function parseOdds(item) {
  const book = item?.bookmakers?.[0];
  if (!book) return null;
  const bet = (id) => book.bets?.find((b) => b.id === id)?.values || [];
  const pick = (values, name) => decimal(values.find((v) => String(v.value).toLowerCase() === name)?.odd);
  const x2 = bet(1), ou = bet(5), bt = bet(8);
  const out = { bookmaker: book.name || "" };
  const h = pick(x2, "home"), d = pick(x2, "draw"), a = pick(x2, "away");
  if (h && d && a) out.x12 = { home: h, draw: d, away: a };
  const over = decimal(ou.find((v) => String(v.value).toLowerCase() === "over 2.5")?.odd), under = decimal(ou.find((v) => String(v.value).toLowerCase() === "under 2.5")?.odd);
  if (over && under) out.ou25 = { over, under };
  const yes = pick(bt, "yes"), no = pick(bt, "no");
  if (yes && no) out.btts = { yes, no };
  return out.x12 || out.ou25 || out.btts ? out : null;
}

export function marketProbs(odds) {
  const probs = {};
  if (odds.x12) Object.assign(probs, noVig(odds.x12));
  if (odds.ou25) probs.over25 = noVig(odds.ou25).over;
  if (odds.btts) probs.btts = noVig(odds.btts).yes;
  return probs;
}

// Edge = our probability minus the market's. Kelly is recorded as analysis for the admin only
// (a quarter of full Kelly); it is never shown in the app, which does not give betting advice.
export function valueAnalysis(exact, odds) {
  const market = marketProbs(odds);
  const rows = [];
  const add = (market_, label, ours, theirs, price) => {
    if (!Number.isFinite(theirs) || !price) return;
    const edge = ours - theirs;
    const kelly = Math.max(0, (ours * price - 1) / (price - 1)) * 0.25;
    rows.push({ market: market_, pick: label, ours: +ours.toFixed(4), market_p: +theirs.toFixed(4), odds: price, edge: +edge.toFixed(4), kelly25: +kelly.toFixed(4) });
  };
  if (odds.x12) for (const k of ["home", "draw", "away"]) add("1x2", k, exact[k], market[k], odds.x12[k]);
  if (odds.ou25) { add("ou25", "over", exact.over25, market.over25, odds.ou25.over); add("ou25", "under", 1 - exact.over25, 1 - market.over25, odds.ou25.under); }
  if (odds.btts) { add("btts", "yes", exact.btts, market.btts, odds.btts.yes); add("btts", "no", 1 - exact.btts, 1 - market.btts, odds.btts.no); }
  return { bookmaker: odds.bookmaker, rows, bestEdge: rows.reduce((m, r) => Math.max(m, r.edge), 0) };
}

// ---------------------------------------------------------------------------
// Optional: DeepSeek writes one or two plain sentences about numbers it is given.
// Model ids per DeepSeek's API docs: "deepseek-v4-pro" (flagship) and "deepseek-flash". The old "deepseek-chat" /
// "deepseek-reasoner" names are retired. Thinking mode is on by default for these models, so it is switched off here:
// a 45-word note needs no reasoning, and thinking tokens would eat the max_tokens budget and slow every run.
// ---------------------------------------------------------------------------
const clean = (s, n = 60) => String(s || "").replace(/[^\p{L}\p{N} .'&-]/gu, "").slice(0, n);

export async function explain(row) {
  const key = env("DEEPSEEK_API_KEY");
  if (!key) return null;
  const p = row.prediction;
  const facts = {
    league: clean(row.league_name), home: clean(row.home_name), away: clean(row.away_name),
    winChancePercent: { home: p.probs.home, draw: p.probs.draw, away: p.probs.away },
    expectedGoals: p.xg, likeliestScore: `${p.likelyScore.home}-${p.likelyScore.away}`,
    over25Percent: p.over25, bothTeamsScorePercent: p.btts, confidence: p.confidence,
    recentForm: row.inputs?.form || null,
  };
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("DEEPSEEK_MODEL") || "deepseek-v4-pro",
        thinking: { type: "disabled" },
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You explain a football statistical forecast in one or two plain sentences, at most 45 words. Use ONLY the numbers in the data. Never invent injuries, line-ups, news or head-to-head facts. Do not mention odds, stakes or betting, and do not guarantee outcomes. Reply as JSON: {\"note\": \"...\"}." },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) { const why = classifyText(data?.error?.message || data?.error, res.status); recordServiceError("ai", why.kind, "notes", why.text, res.status); }
    const note = JSON.parse(data?.choices?.[0]?.message?.content || "{}").note;
    return typeof note === "string" && note.trim() ? note.replace(/\s+/g, " ").trim().slice(0, 300) : null;
  } catch { recordServiceError("ai", "network", "notes", "no answer from the AI service", null); return null; }
}

// ---------------------------------------------------------------------------
// Job 1: predict the next PREDICT_DAYS days (default 7) of fixtures
//
// Where the football API requests go, in this order of importance:
//   1. The list of not-started matches per day, nearest day first. (Days further out are remembered for
//      PREDICT_LIST_CACHE_MINUTES, default 12 h, and at most about 40% of the budget goes on lists.)
//   2. One league table per competition. It unlocks the current model for EVERY match of that league, so
//      one request can cover many matches. Competitions are ranked by how many matches they hold, weighted
//      towards the ones that kick off soonest.
//   3. Only when requests are spare after every competition has its table: the season's results (for the
//      ratings-v3 comparison model) and, if PREDICT_ODDS=1, bookmaker odds.
// Each competition is saved as soon as it is done, so a timeout or an empty quota loses nothing; whatever is
// left is picked up by the next run.
// ---------------------------------------------------------------------------
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function runPredict({ now = Date.now() } = {}) {
  const started = Date.now();
  const timeLimit = Math.max(5000, num("PREDICT_TIME_BUDGET_MS", 45000)); // Vercel stops the job at 60 s (vercel.json)
  const overTime = (margin = 0) => Date.now() - started > timeLimit - margin;
  const budget = await makeBudget();
  const source = (env("PREDICT_SOURCE") || "auto").toLowerCase(); // auto | table | match
  // A free football data plan cannot read the current season's league tables, and only sees today and tomorrow.
  // The plan name comes with the free status check, so such a plan is never sent a request it can only refuse.
  const freePlan = /free/i.test(budget.plan || "") && source !== "table";
  const asked = Math.max(1, Math.min(14, Math.floor(num("PREDICT_DAYS", 7))));
  const days = freePlan ? Math.min(asked, 2) : asked;
  const summary = { job: "predict", model: MODEL_VERSION, days, budget: budget.calls, reserve: budget.reserve, quotaLeft: budget.quotaLeft, plan: budget.plan || null, fixtures: 0, predicted: 0, shadow: 0, noTable: 0, already: 0, uncovered: 0, odds: 0, notes: 0, leaguesSkipped: 0, writeErrors: 0, callsUsed: 0 };

  const BLOCKED = "flag:tables-blocked"; // remembered for 12 hours, then tables are tried again (the plan may have changed)
  let mode = source === "match" ? "match" : "table";
  if (source === "auto" && (freePlan || (await storedGet(BLOCKED, 720)))) mode = "match";
  // The ratings comparison model needs a whole season of results: not available per match, so it is only
  // wanted when league tables are read, and a match is not "unfinished" just because that model is missing.
  let ratingsOn = env("PREDICT_RATINGS") !== "0" && mode === "table";

  const wanted = new Set(env("PREDICT_LEAGUES").split(",").map((s) => Number(s.trim())).filter(Boolean));
  const fixtures = [];
  const listAllowance = Math.max(1, Math.min(days, Math.ceil(budget.calls * 0.4)));
  const listCache = Math.max(0, num("PREDICT_LIST_CACHE_MINUTES", 720));
  for (let i = 0; i < days; i++) {
    const date = utcDate(now + i * DAY);
    const allowed = budget.spent < listAllowance; // past its share, a day list can still come from a saved copy (free) but is not bought
    const data = await football(allowed ? budget : { calls: 0, spent: 0 }, "fixtures", { date, timezone: "UTC", status: "NS" }, "cron", i >= 2 ? { cacheMinutes: listCache } : {});
    if (!data && allowed && budget.lastError?.kind === "plan") { summary.daysNote = `Only ${i} day${i === 1 ? "" : "s"} ahead can be read with this football data plan`; delete budget.errorLog?.fixtures; break; } // later dates would be refused too; handled, so not reported as a failure
    if (data) summary.daysReached = i + 1;
    for (const fx of data?.response || []) {
      const kickoff = new Date(fx.fixture?.date).getTime();
      // Only genuine pre-match predictions: at least 10 minutes before kick-off.
      if (!Number.isFinite(kickoff) || kickoff < now + 10 * 60000) continue;
      if (wanted.size && !wanted.has(fx.league?.id)) continue;
      if (!fx.league?.id || !fx.league?.season || !fx.teams?.home?.id || !fx.teams?.away?.id) continue;
      if (!fixtures.some((f) => f.fixture.id === fx.fixture.id)) fixtures.push(fx);
    }
  }
  summary.fixtures = fixtures.length;
  if (freePlan && asked > days) summary.daysNote = "Free football data plan: today and tomorrow";
  const finish = () => {
    summary.callsUsed = budget.spent;
    const log = budget.errorLog || {};
    if (Object.keys(log).length) summary.apiErrors = Object.fromEntries(Object.entries(log).map(([k, v]) => [k, { count: v.count, kind: v.kind, message: v.message }]));
    if (!summary.predicted && !summary.shadow) {
      const first = Object.entries(log).sort((a, b) => b[1].count - a[1].count)[0];
      if (budget.calls === 0) summary.skipped = `no football API requests left today (${budget.reserve} kept in reserve); only saved data could be used`;
      else if (first) summary.skipped = `the football data service refused ${first[1].count} "${first[0]}" request${first[1].count === 1 ? "" : "s"}: ${first[1].message}`;
    }
    return summary;
  };
  if (!fixtures.length) return finish();

  // Skip what is already recorded, model by model (a fixture may have the old model's row but not the new one's).
  const ids = fixtures.map((f) => f.fixture.id);
  const have = new Map(ALL_MODELS.map((m) => [m.model, new Set()]));
  const lookups = [];
  for (const { model } of ALL_MODELS) for (let i = 0; i < ids.length; i += 150) lookups.push([model, ids.slice(i, i + 150)]);
  await inBatches(lookups, 6, async ([model, chunk]) => {
    const rows = await sb(`/rest/v1/predictions?model=eq.${q.word(model)}&fixture_id=in.(${q.ints(chunk)})&select=fixture_id`);
    for (const r of rows || []) have.get(model).add(Number(r.fixture_id));
  });
  const lacking = (fx) => ALL_MODELS.filter((m) => !have.get(m.model).has(fx.fixture.id) && (ratingsOn || !m.needsMatches));
  const todo = fixtures.filter((f) => lacking(f).length);
  summary.already = fixtures.length - todo.length;

  // Rank competitions: most matches first, soonest kick-offs counting most (a match tomorrow is worth more than one in 6 days,
  // because the later one will be seen again by tomorrow's run).
  const leagues = new Map();
  for (const fx of todo) {
    const key = `${fx.league.id}:${fx.league.season}`;
    if (!leagues.has(key)) leagues.set(key, { id: fx.league.id, season: fx.league.season, fixtures: [], score: 0 });
    const lg = leagues.get(key);
    lg.fixtures.push(fx);
    lg.score += 1 / (1 + Math.max(0, Math.floor((new Date(fx.fixture.date).getTime() - now) / DAY)));
  }
  const ordered = [...leagues.values()].sort((a, b) => b.score - a.score || b.fixtures.length - a.fixtures.length);
  const wantOdds = env("PREDICT_ODDS") === "1";
  const saved = [];                     // rows that really reached the database, for the notes
  let waitingForTable = ordered.length; // competitions that have not had their table yet
  // A request beyond the tables is only spent if every competition still waiting for its table can still get one.
  const spare = () => budget.calls - budget.spent > waitingForTable;

  const doneLeagues = new Set();
  let tablesRead = 0;

  // Turn one fixture + the team rows that cover it into prediction rows (one per model still missing).
  const makeRows = (fx, table, matches, odds, rows, benchmarks) => {
    const homeId = fx.teams.home.id, awayId = fx.teams.away.id;
    // The last five results ("WDLWW", newest last) come with each team's row: free recent form.
    const formOf = (id) => String(table?.find((r) => r.team?.id === id)?.form || "").toUpperCase().replace(/[^WDL]/g, "").split("");
    const form = { home: formOf(homeId), away: formOf(awayId) };
    for (const { model, predict, needsMatches } of lacking(fx)) {
      const primary = model === MODEL_VERSION;
      if (needsMatches && !matches) continue; // no season results this run: try again next run
      const prediction = predict({ homeId, awayId, rows: table, form, matches, now });
      if (!prediction) { if (primary) summary.noTable++; continue; }
      const { matrix, exact, ...shown } = prediction;
      shown.fixtureId = fx.fixture.id;
      const row = {
        fixture_id: fx.fixture.id, model, made_at: new Date(now).toISOString(), kickoff: new Date(fx.fixture.date).toISOString(),
        league_id: fx.league.id, league_name: String(fx.league.name || "").slice(0, 80), season: fx.league.season,
        home_id: homeId, home_name: String(fx.teams.home.name || "").slice(0, 80), away_id: awayId, away_name: String(fx.teams.away.name || "").slice(0, 80),
        prediction: shown, matrix, probs: exact,
        inputs: { form: { home: form.home.join(""), away: form.away.join("") }, basis: prediction.basis, drivers: prediction.drivers },
        analysis: primary && odds ? valueAnalysis(exact, odds) : null,
      };
      rows.push(row);
      if (primary && odds) benchmarks.push({ fixture_id: fx.fixture.id, source: "market", made_at: row.made_at, late: false, probs: marketProbs(odds), odds });
    }
  };

  // Never overwrite: the first prediction for a fixture and model is the one that is graded. Saved as soon as it is made.
  const saveRows = async (rows, benchmarks, covers) => {
    try {
      for (let i = 0; i < rows.length; i += 100) {
        await sb("/rest/v1/predictions?on_conflict=fixture_id,model", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: rows.slice(i, i + 100) });
      }
      if (benchmarks.length) {
        await sb("/rest/v1/prediction_benchmarks?on_conflict=fixture_id,source", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: benchmarks });
        summary.odds += benchmarks.length;
      }
      saved.push(...rows);
      const primaryRows = rows.filter((r) => r.model === MODEL_VERSION).length;
      summary.predicted += primaryRows; summary.shadow += rows.length - primaryRows;
      return true;
    } catch { summary.writeErrors++; summary.uncovered += covers; return false; }
  };

  // Mode 1, one request per competition: the league table covers every match of that league.
  const doLeague = async (lg) => {
    if (overTime()) { waitingForTable--; summary.leaguesSkipped++; summary.uncovered += lg.fixtures.length; return "time"; }
    const standings = await football(budget, "standings", { league: lg.id, season: lg.season });
    waitingForTable--;
    // This plan cannot read league tables: not a failure of this competition, so don't count it; the caller switches mode.
    if (!standings && !tablesRead && source !== "table" && budget.errorLog?.standings?.kind === "plan") return "denied";
    if (!standings) { summary.leaguesSkipped++; summary.uncovered += lg.fixtures.length; return "nodata"; }
    tablesRead++;

    // Season results for the ratings model: only if something still needs them and requests are spare.
    let matches = null;
    if (ratingsOn && lg.fixtures.some((fx) => lacking(fx).some((m) => m.needsMatches))) {
      // A saved copy is free, so look for it even when nothing is spare; only a fresh request needs spare budget.
      const done = await football(spare() ? budget : { calls: 0, spent: 0 }, "fixtures", { league: lg.id, season: lg.season, status: FINISHED });
      matches = done ? matchesFrom(done.response) : null;
    }

    const oddsByFixture = new Map();
    if (wantOdds) {
      for (const date of [...new Set(lg.fixtures.map((f) => utcDate(new Date(f.fixture.date).getTime())))]) {
        for (let page = 1; page <= 3 && spare(); page++) {
          const data = await football(budget, "odds", { league: lg.id, season: lg.season, date, bookmaker: env("PREDICT_ODDS_BOOKMAKER") || "8", page });
          for (const item of data?.response || []) { const parsed = parseOdds(item); if (parsed) oddsByFixture.set(item.fixture?.id, parsed); }
          if (!data || page >= (data.paging?.total || 1)) break;
        }
      }
    }
    const rows = [], benchmarks = [];
    for (const fx of lg.fixtures) makeRows(fx, tableFor(standings.response, fx.teams.home.id, fx.teams.away.id), matches, oddsByFixture.get(fx.fixture.id) || null, rows, benchmarks);
    await saveRows(rows, benchmarks, lg.fixtures.length);
    doneLeagues.add(`${lg.id}:${lg.season}`);
    return "saved";
  };

  // Mode 2, one request per match: for football data plans that cannot read league tables. The per-match answer
  // carries each team's season goals for and against, which is all the model reads. Soonest matches first, so
  // with 19 requests left the 18 nearest matches are predicted.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rateWait = Math.max(0, num("PREDICT_RATE_WAIT_MS", 7000)); // free football data plans allow about 10 requests a minute
  const doMatches = async (pool) => {
    const rank = new Map(ordered.map((lg, i) => [`${lg.id}:${lg.season}`, i]));
    const keyOf = (fx) => `${fx.league.id}:${fx.league.season}`;
    pool = [...pool].sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date) || (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));
    const seen = new Map(); // competition -> team id -> that team's row, built up as matches are read
    let rows = [], benchmarks = [], covers = 0, refused = 0, empty = 0, done = 0;
    const flush = async () => { if (rows.length || covers) await saveRows(rows, benchmarks, covers); rows = []; benchmarks = []; covers = 0; };
    for (const fx of pool) {
      if (budget.spent >= budget.calls || overTime(3000)) break;
      if (budget.minuteLeft === 0 && !overTime(10000)) await sleep(rateWait); // this minute's allowance is used: wait it out rather than be refused
      let data = await football(budget, "predictions", { fixture: fx.fixture.id }, "cron", { cacheMinutes: 360 });
      if (!data && budget.lastError?.kind === "rate" && !overTime(10000)) { await sleep(rateWait); data = await football(budget, "predictions", { fixture: fx.fixture.id }, "cron", { cacheMinutes: 360 }); }
      if (!data) {
        // Two refusals in a row for the same plan reason: stop, don't burn the rest of the allowance.
        if (budget.lastError?.kind === "plan" || budget.lastError?.kind === "key" || budget.lastError?.kind === "quota") { if (++refused >= 2) break; } else if (++empty >= 5) break;
        continue;
      }
      refused = 0; empty = 0;
      const key = keyOf(fx);
      if (!seen.has(key)) seen.set(key, new Map());
      const teams = seen.get(key);
      for (const r of rowsFromPredictions(data.response?.[0])) teams.set(r.team.id, r);
      done++;
      const before = rows.length;
      makeRows(fx, [...teams.values()], null, null, rows, benchmarks);
      covers += 1;
      if (rows.length === before) summary.noTable++;
      if (done % 10 === 0) await flush();
    }
    await flush();
    summary.matchesRead = done;
    summary.uncovered += Math.max(0, pool.length - done);
  };
  if (mode === "table") {
    // Ask the first competition alone: if the plan cannot read tables, only one request is spent finding out.
    const [probe, ...rest] = ordered;
    let outcome = probe ? await doLeague(probe) : "saved";
    for (let i = 0; outcome !== "denied" && i < rest.length; i += 3) {
      if (!tablesRead && (budget.errorLog?.standings?.count || 0) >= 3) { outcome = "denied"; break; } // three refusals and no table at all
      await Promise.all(rest.slice(i, i + 3).map(doLeague));
    }
    if (outcome === "denied" && source === "auto") { delete budget.errorLog?.standings; mode = "match"; ratingsOn = false; await storedPut(BLOCKED, { at: new Date(now).toISOString() }, 720); }
  }
  summary.mode = mode;
  if (mode === "match") await doMatches(todo.filter((fx) => lacking(fx).length && !doneLeagues.has(`${fx.league.id}:${fx.league.season}`)));

  // Optional plain-language notes, most confident matches first, capped. They are added to rows already saved,
  // and skipped when the run is close to its time limit.
  const maxNotes = Math.max(0, Math.floor(num("PREDICT_EXPLAIN_MAX", 0)));
  if (maxNotes && env("DEEPSEEK_API_KEY")) {
    const rank = { high: 0, medium: 1, low: 2 };
    const chosen = saved.filter((r) => r.model === MODEL_VERSION).sort((a, b) => rank[a.prediction.confidence] - rank[b.prediction.confidence]).slice(0, maxNotes);
    for (let i = 0; i < chosen.length && !overTime(25000); i += 5) {
      await Promise.all(chosen.slice(i, i + 5).map(async (row) => {
        const note = await explain(row);
        if (!note) return;
        try {
          await sb(`/rest/v1/predictions?fixture_id=eq.${q.int(row.fixture_id)}&model=eq.${q.word(row.model)}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: { note } });
          summary.notes++;
        } catch { /* a missing note is harmless */ }
      }));
    }
  }
  return finish();
}

// ---------------------------------------------------------------------------
// Job 2: grade finished matches (90-minute result; extra time and penalties don't count)
// ---------------------------------------------------------------------------
export async function runGrade({ now = Date.now() } = {}) {
  const summary = { job: "grade", pending: 0, graded: 0, voided: 0, callsUsed: 0 };
  const pending = await sb(`/rest/v1/predictions?status=eq.pending&kickoff=lt.${q.iso(now - 2 * 3600000)}&select=fixture_id,model,kickoff,probs,matrix&order=kickoff.asc&limit=600`);
  summary.pending = pending?.length || 0;
  if (!summary.pending) return summary;

  const budget = await makeBudget();
  const byDate = new Map();
  for (const row of pending) {
    const d = utcDate(new Date(row.kickoff).getTime());
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(row);
  }
  const patch = async (row, body) =>
    sb(`/rest/v1/predictions?fixture_id=eq.${q.int(row.fixture_id)}&model=eq.${q.word(row.model)}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body });

  for (const [date, rows] of [...byDate.entries()].sort()) {
    const byId = /free/i.test(budget.plan || "");
    const data = byId ? null : await football(budget, "fixtures", { date, timezone: "UTC", status: FINISHED });
    let finished;
    if (data) finished = new Map((data.response || []).map((fx) => [fx.fixture?.id, fx]));
    else if (byId || budget.lastError?.kind === "plan") {
      // This plan cannot list that date (old dates are often outside it): ask for the matches by id instead, 20 per request.
      finished = new Map();
      const ids = [...new Set(rows.map((r) => Number(r.fixture_id)))];
      for (let i = 0; i < ids.length; i += 20) {
        const part = await football(budget, "fixtures", { ids: ids.slice(i, i + 20).join("-") });
        if (!part) break;
        for (const fx of part.response || []) if (["FT", "AET", "PEN"].includes(fx.fixture?.status?.short)) finished.set(fx.fixture?.id, fx); // only finished matches count
      }
      if (!finished.size) continue;
    } else continue; // out of budget or API trouble: try again on the next run
    // Each match now has a row per model, so there are more rows to write: ten at a time.
    await inBatches(rows, 10, async (row) => {
      const fx = finished.get(Number(row.fixture_id));
      const ft = fx?.score?.fulltime;
      const h = ft?.home ?? fx?.goals?.home, a = ft?.away ?? fx?.goals?.away;
      if (fx && Number.isFinite(h) && Number.isFinite(a)) {
        await patch(row, { status: "graded", home_goals: h, away_goals: a, graded_at: new Date(now).toISOString(), grade: gradeOne({ probs: row.probs, matrix: row.matrix }, h, a) });
        summary.graded++;
      } else if (now - new Date(row.kickoff).getTime() > 7 * DAY) {
        // Postponed or abandoned and still unplayed after a week: leave it out of the accuracy figures.
        await patch(row, { status: "void", graded_at: new Date(now).toISOString() });
        summary.voided++;
      }
    });
  }
  summary.callsUsed = budget.spent;
  return summary;
}
