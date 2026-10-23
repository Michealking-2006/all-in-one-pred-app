// Server-side prediction jobs: record predictions for upcoming matches BEFORE
// kick-off, grade them afterwards, keep benchmark odds. Used by api/cron.js and
// the admin dashboard. The leading underscore keeps Vercel from exposing it.
//
// The numbers come only from our own statistical model (src/predictions/model.js).
// OpenAI, when enabled, only writes a short plain-language note about numbers it
// is given; it never changes a probability. No third-party prediction service is read.
import { env, sb, HttpError } from "./_admin.js";
import { tableFor, predictFromTable, MODEL_VERSION } from "../src/predictions/model.js";
import { gradeOne } from "../src/predictions/metrics.js";
import { recordUsage } from "./_usage.js";
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
  if (!key) throw new HttpError(503, "SCOUTWAVE_FOOTBALL_API_KEY is not set.");
  const res = await fetch(BASE + "/status", { headers: { "x-apisports-key": key }, signal: AbortSignal.timeout(6000) }).catch(() => null); // free: not counted
  const r = (await res?.json().catch(() => null))?.response;
  if (!r || Array.isArray(r)) throw new HttpError(502, "The football API did not return account details.");
  return { used: Number(r.requests?.current) || 0, limit: Number(r.requests?.limit_day) || 0 };
}

// The job may use at most PREDICT_MAX_CALLS requests and at most PREDICT_QUOTA_SHARE of what is left today.
export async function makeBudget() {
  const { used, limit } = await footballStatus();
  const left = Math.max(0, limit - used);
  const calls = Math.max(0, Math.min(num("PREDICT_MAX_CALLS", 40), Math.floor(left * num("PREDICT_QUOTA_SHARE", 0.35))));
  return { calls, spent: 0, quotaLeft: left };
}

export async function football(budget, endpoint, params, source = "cron") {
  if (budget.spent >= budget.calls) return null; // out of budget: caller carries on with what it has
  budget.spent++;
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();
  let res;
  try {
    res = await fetch(`${BASE}/${endpoint}?${query}`, { headers: { "x-apisports-key": env("SCOUTWAVE_FOOTBALL_API_KEY"), Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  } catch { await recordUsage(source, endpoint, 1, 1); return null; }
  const data = await res.json().catch(() => null);
  const failed = !res.ok || !data || (data.errors && !Array.isArray(data.errors) && Object.keys(data.errors).length);
  await recordUsage(source, endpoint, 1, failed ? 1 : 0);
  return failed ? null : data;
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
// Optional: OpenAI writes one or two plain sentences about numbers it is given.
// ---------------------------------------------------------------------------
const clean = (s, n = 60) => String(s || "").replace(/[^\p{L}\p{N} .'&-]/gu, "").slice(0, n);

export async function explain(row) {
  const key = env("OPENAI_API_KEY");
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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("OPENAI_MODEL") || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 140,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You explain a football statistical forecast in one or two plain sentences, at most 45 words. Use ONLY the numbers in the data. Never invent injuries, line-ups, news or head-to-head facts. Do not mention odds, stakes or betting, and do not guarantee outcomes. Reply as JSON: {\"note\": \"...\"}." },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json().catch(() => null);
    const note = JSON.parse(data?.choices?.[0]?.message?.content || "{}").note;
    return typeof note === "string" && note.trim() ? note.replace(/\s+/g, " ").trim().slice(0, 300) : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Job 1: predict the next two days of fixtures
// ---------------------------------------------------------------------------
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

export async function runPredict({ now = Date.now() } = {}) {
  const budget = await makeBudget();
  const summary = { job: "predict", model: MODEL_VERSION, budget: budget.calls, quotaLeft: budget.quotaLeft, fixtures: 0, predicted: 0, noTable: 0, already: 0, odds: 0, notes: 0, leaguesSkipped: 0, callsUsed: 0 };
  if (budget.calls < 3) { summary.skipped = "not enough football API quota left today"; return summary; }

  const wanted = new Set(env("PREDICT_LEAGUES").split(",").map((s) => Number(s.trim())).filter(Boolean));
  const dates = [utcDate(now), utcDate(now + DAY)];
  const fixtures = [];
  for (const date of dates) {
    const data = await football(budget, "fixtures", { date, timezone: "UTC", status: "NS" });
    for (const fx of data?.response || []) {
      const kickoff = new Date(fx.fixture?.date).getTime();
      // Only genuine pre-match predictions: at least 10 minutes before kick-off.
      if (!Number.isFinite(kickoff) || kickoff < now + 10 * 60000) continue;
      if (wanted.size && !wanted.has(fx.league?.id)) continue;
      if (!fx.league?.id || !fx.league?.season || !fx.teams?.home?.id || !fx.teams?.away?.id) continue;
      fixtures.push(fx);
    }
  }
  summary.fixtures = fixtures.length;
  if (!fixtures.length) { summary.callsUsed = budget.spent; return summary; }

  // Skip what is already recorded for this model version.
  const ids = fixtures.map((f) => f.fixture.id);
  const have = new Set();
  for (let i = 0; i < ids.length; i += 150) {
    const rows = await sb(`/rest/v1/predictions?model=eq.${q.word(MODEL_VERSION)}&fixture_id=in.(${q.ints(ids.slice(i, i + 150))})&select=fixture_id`);
    for (const r of rows || []) have.add(Number(r.fixture_id));
  }
  const todo = fixtures.filter((f) => !have.has(f.fixture.id));
  summary.already = fixtures.length - todo.length;

  // Biggest competitions first (most matches per standings call), until the budget runs out.
  const leagues = new Map();
  for (const fx of todo) {
    const key = `${fx.league.id}:${fx.league.season}`;
    if (!leagues.has(key)) leagues.set(key, { id: fx.league.id, season: fx.league.season, fixtures: [] });
    leagues.get(key).fixtures.push(fx);
  }
  const ordered = [...leagues.values()].sort((a, b) => b.fixtures.length - a.fixtures.length);
  const wantOdds = env("PREDICT_ODDS") === "1";
  const rows = [], benchmarks = [];

  for (const lg of ordered) {
    if (budget.spent >= budget.calls) { summary.leaguesSkipped++; continue; }
    const standings = await football(budget, "standings", { league: lg.id, season: lg.season });
    if (!standings) { summary.leaguesSkipped++; continue; }

    const oddsByFixture = new Map();
    if (wantOdds) {
      for (const date of [...new Set(lg.fixtures.map((f) => utcDate(new Date(f.fixture.date).getTime())))]) {
        for (let page = 1; page <= 3; page++) {
          const data = await football(budget, "odds", { league: lg.id, season: lg.season, date, bookmaker: env("PREDICT_ODDS_BOOKMAKER") || "8", page });
          for (const item of data?.response || []) { const parsed = parseOdds(item); if (parsed) oddsByFixture.set(item.fixture?.id, parsed); }
          if (!data || page >= (data.paging?.total || 1)) break;
        }
      }
    }

    for (const fx of lg.fixtures) {
      const homeId = fx.teams.home.id, awayId = fx.teams.away.id;
      const table = tableFor(standings.response, homeId, awayId);
      // The standings row carries the last five results ("WDLWW", newest last): free recent form.
      const formOf = (id) => String(table?.find((r) => r.team?.id === id)?.form || "").toUpperCase().replace(/[^WDL]/g, "").split("");
      const form = { home: formOf(homeId), away: formOf(awayId) };
      const prediction = predictFromTable({ homeId, awayId, rows: table, form });
      if (!prediction) { summary.noTable++; continue; }
      const { matrix, exact, ...shown } = prediction;
      shown.fixtureId = fx.fixture.id;
      const odds = oddsByFixture.get(fx.fixture.id) || null;
      const row = {
        fixture_id: fx.fixture.id, model: MODEL_VERSION, made_at: new Date(now).toISOString(), kickoff: new Date(fx.fixture.date).toISOString(),
        league_id: fx.league.id, league_name: String(fx.league.name || "").slice(0, 80), season: fx.league.season,
        home_id: homeId, home_name: String(fx.teams.home.name || "").slice(0, 80), away_id: awayId, away_name: String(fx.teams.away.name || "").slice(0, 80),
        prediction: shown, matrix, probs: exact,
        inputs: { form: { home: form.home.join(""), away: form.away.join("") }, basis: prediction.basis, drivers: prediction.drivers },
        analysis: odds ? valueAnalysis(exact, odds) : null,
      };
      rows.push(row);
      if (odds) benchmarks.push({ fixture_id: fx.fixture.id, source: "market", made_at: row.made_at, late: false, probs: marketProbs(odds), odds });
    }
  }

  // Optional plain-language notes, most confident matches first, capped.
  const maxNotes = Math.max(0, Math.floor(num("PREDICT_EXPLAIN_MAX", 0)));
  if (maxNotes && env("OPENAI_API_KEY")) {
    const rank = { high: 0, medium: 1, low: 2 };
    const chosen = [...rows].sort((a, b) => rank[a.prediction.confidence] - rank[b.prediction.confidence]).slice(0, maxNotes);
    await inBatches(chosen, 5, async (row) => { row.note = await explain(row); if (row.note) summary.notes++; });
  }

  // Never overwrite: the first prediction for a fixture and model is the one that is graded.
  for (let i = 0; i < rows.length; i += 100) {
    await sb("/rest/v1/predictions?on_conflict=fixture_id,model", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: rows.slice(i, i + 100) });
  }
  if (benchmarks.length) {
    await sb("/rest/v1/prediction_benchmarks?on_conflict=fixture_id,source", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: benchmarks });
  }
  summary.predicted = rows.length;
  summary.odds = benchmarks.length;
  summary.callsUsed = budget.spent;
  return summary;
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
    const data = await football(budget, "fixtures", { date, timezone: "UTC", status: FINISHED });
    if (!data) continue; // out of budget or API trouble: try again on the next run
    const finished = new Map((data.response || []).map((fx) => [fx.fixture?.id, fx]));
    for (const row of rows) {
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
    }
  }
  summary.callsUsed = budget.spent;
  return summary;
}
