// Accuracy reporting for the tracked predictions: headline figures, calibration,
// and a like-for-like comparison with the bookmaker market and with Forebet
// (entered by hand). Used by server/accuracy.js (public) and the admin dashboard.
import { env, sb } from "./_admin.js";
import { MODEL_VERSION } from "../src/predictions/model.js";
import { summarizeGrades, calibration, gradeBenchmark } from "../src/predictions/metrics.js";
import { q } from "./_query.js";
import { SHADOW_NAMES } from "./_models.js";

const PAGE = 1000;

async function all(path, max = 6000) {
  const out = [];
  for (let offset = 0; offset < max; offset += PAGE) {
    const rows = await sb(`${path}&limit=${q.int(PAGE)}&offset=${q.int(offset)}`);
    if (!Array.isArray(rows)) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export const minToPublish = () => Math.max(1, Math.floor(Number(env("PREDICT_MIN_PUBLISH")) || 200));

export async function gradedRows(model = MODEL_VERSION) {
  return all(`/rest/v1/predictions?model=eq.${q.word(model)}&status=eq.graded&select=fixture_id,kickoff,league_name,home_name,away_name,probs,matrix,grade,home_goals,away_goals&order=kickoff.desc`);
}

export async function counts(model = MODEL_VERSION) {
  const rows = await all(`/rest/v1/predictions?model=eq.${q.word(model)}&select=status`, 20000);
  const by = { pending: 0, graded: 0, void: 0 };
  for (const r of rows) by[r.status] = (by[r.status] || 0) + 1;
  return { ...by, total: rows.length };
}

const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 1000) / 1000 : null);
const share = (xs) => (xs.length ? Math.round((xs.filter(Boolean).length / xs.length) * 1000) / 1000 : null);

// What the public sees: a real figure only once the sample is big enough to mean something.
export async function publicAccuracy() {
  const rows = await gradedRows();
  const need = minToPublish();
  const base = { model: MODEL_VERSION, sample: rows.length, needed: need, ready: rows.length >= need };
  return base.ready ? { ...base, ...summarizeGrades(rows.map((r) => r.grade)) } : base;
}

export async function adminReport() {
  const [rows, count] = await Promise.all([gradedRows(), counts()]);
  const headline = summarizeGrades(rows.map((r) => r.grade));

  // Calibration of the headline probabilities: "when we said X%, how often did it happen?"
  const home = [], draw = [], away = [], over = [], btts = [];
  for (const r of rows) {
    const o = r.grade?.outcome;
    home.push({ p: r.probs.home, hit: o === "home" }); draw.push({ p: r.probs.draw, hit: o === "draw" }); away.push({ p: r.probs.away, hit: o === "away" });
    over.push({ p: r.probs.over25, hit: r.home_goals + r.away_goals > 2 }); btts.push({ p: r.probs.btts, hit: r.home_goals > 0 && r.away_goals > 0 });
  }
  const calib = { outcome: calibration([...home, ...draw, ...away]), over25: calibration(over), btts: calibration(btts) };

  // Same matches, same scoring, different source. Late entries (after kick-off) are excluded.
  const ids = new Set(rows.map((r) => Number(r.fixture_id)));
  const bench = (await all(`/rest/v1/prediction_benchmarks?late=eq.false&select=fixture_id,source,probs,top_scores`)).filter((b) => ids.has(Number(b.fixture_id)));
  const byFixture = new Map(rows.map((r) => [Number(r.fixture_id), r]));
  const versus = {};
  for (const source of ["market", "forebet"]) {
    const mine = [], theirs = [];
    for (const b of bench.filter((x) => x.source === source)) {
      const r = byFixture.get(Number(b.fixture_id));
      const g = gradeBenchmark({ probs: b.probs, topScores: b.top_scores }, r.home_goals, r.away_goals);
      mine.push(r.grade); theirs.push(g);
    }
    if (!mine.length) { versus[source] = { n: 0 }; continue; }
    const withProbs = theirs.map((g, i) => [g, mine[i]]).filter(([g]) => g.brier !== undefined);
    const withScores = theirs.map((g, i) => [g, mine[i]]).filter(([g]) => g.exact !== undefined);
    versus[source] = {
      n: mine.length,
      probs: { n: withProbs.length, scoutwave: { brier: avg(withProbs.map(([, m]) => m.brier)), logLoss: avg(withProbs.map(([, m]) => m.logLoss)), winner: share(withProbs.map(([, m]) => m.pickCorrect)) }, other: { brier: avg(withProbs.map(([g]) => g.brier)), logLoss: avg(withProbs.map(([g]) => g.logLoss)), winner: share(withProbs.map(([g]) => g.pickCorrect)) } },
      scores: { n: withScores.length, scoutwave: { exact: share(withScores.map(([, m]) => m.exact)), top3: share(withScores.map(([, m]) => m.top3)), top5: share(withScores.map(([, m]) => m.top5)) }, other: { exact: share(withScores.map(([g]) => g.exact)), top3: share(withScores.map(([g]) => g.top3)), top5: share(withScores.map(([g]) => g.top5)) } },
    };
  }

  // The current model against the older versions kept running beside it, on the matches BOTH predicted.
  const modelCompare = [];
  for (const other of SHADOW_NAMES) {
    const theirRows = await gradedRows(other);
    const theirs = new Map(theirRows.map((r) => [Number(r.fixture_id), r]));
    const both = rows.filter((r) => theirs.has(Number(r.fixture_id)));
    modelCompare.push({
      model: other, n: both.length,
      current: summarizeGrades(both.map((r) => r.grade)),
      other: summarizeGrades(both.map((r) => theirs.get(Number(r.fixture_id)).grade)),
    });
  }

  return {
    model: MODEL_VERSION, counts: count, headline, calibration: calib, versus, modelCompare,
    publishNeeds: minToPublish(), publishReady: rows.length >= minToPublish(),
    recent: rows.slice(0, 15).map((r) => ({ fixtureId: r.fixture_id, kickoff: r.kickoff, league: r.league_name, home: r.home_name, away: r.away_name, score: `${r.home_goals}-${r.away_goals}`, pick: r.grade?.pick, pickCorrect: r.grade?.pickCorrect, topScoreRank: r.grade?.scoreRank })),
  };
}

// ---------------------------------------------------------------------------
// Forebet (or any outside source) typed in by hand, matched to our fixtures.
// One line each:  date, home team, away team, home%, draw%, away%, top score [, 2nd, 3rd, 4th, 5th]
// e.g.  2026-10-20,Arsenal,Chelsea,52,25,23,2-1,1-0,2-0,1-1,3-1
// ---------------------------------------------------------------------------
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(fc|cf|afc|sc|ac|as|ss|club|de|the)\b/g, "").replace(/[^a-z0-9]/g, "");
const sameTeam = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y))); };

export async function importForebet(text, { now = Date.now() } = {}) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 300);
  const result = { saved: 0, late: 0, problems: [] };
  const toSave = [];
  for (const [i, line] of lines.entries()) {
    if (/^date\b/i.test(line)) continue; // header row
    const f = line.split(",").map((x) => x.trim());
    const [date, home, away, ph, pd, pa, ...scores] = f;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !home || !away) { result.problems.push(`Line ${i + 1}: expected date,home,away,...`); continue; }
    const day = Date.parse(date + "T00:00:00Z");
    const found = await sb(`/rest/v1/predictions?model=eq.${q.word(MODEL_VERSION)}&kickoff=gte.${q.iso(day - 86400000)}&kickoff=lt.${q.iso(day + 2 * 86400000)}&select=fixture_id,kickoff,home_name,away_name&limit=500`);
    const hit = (found || []).filter((r) => sameTeam(r.home_name, home) && sameTeam(r.away_name, away));
    if (hit.length !== 1) { result.problems.push(`Line ${i + 1}: ${hit.length ? "more than one match" : "no tracked match"} for ${home} v ${away} around ${date}`); continue; }
    const pct = [ph, pd, pa].map((v) => (v === "" || v === undefined ? NaN : Number(v)));
    const probs = pct.every((v) => Number.isFinite(v) && v >= 0 && v <= 100) ? { home: pct[0] / 100, draw: pct[1] / 100, away: pct[2] / 100 } : null;
    const top = scores.filter((s) => /^\d{1,2}-\d{1,2}$/.test(s)).slice(0, 5);
    if (!probs && !top.length) { result.problems.push(`Line ${i + 1}: needs probabilities or at least one score`); continue; }
    const late = new Date(hit[0].kickoff).getTime() <= now; // typed in after kick-off: hindsight, so excluded from comparisons
    if (late) result.late++;
    toSave.push({ fixture_id: hit[0].fixture_id, source: "forebet", made_at: new Date(now).toISOString(), late, probs, top_scores: top.length ? top : null });
  }
  if (toSave.length) {
    await sb("/rest/v1/prediction_benchmarks?on_conflict=fixture_id,source", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: toSave });
    result.saved = toSave.length;
  }
  return result;
}
