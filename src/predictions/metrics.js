// Scoring for predictions. Pure functions (no network, no DOM) shared by the
// server job and the tests. Lower is better for Brier and log loss.
const EPS = 1e-4;
const clampP = (p) => Math.min(1 - EPS, Math.max(EPS, p));
const round = (v, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

export const outcomeOf = (h, a) => (h > a ? "home" : h < a ? "away" : "draw");

// probs: fractions { home, draw, away }
export const brier1x2 = (probs, outcome) =>
  ["home", "draw", "away"].reduce((s, k) => s + ((probs[k] ?? 0) - (k === outcome ? 1 : 0)) ** 2, 0);
export const logLoss1x2 = (probs, outcome) => -Math.log(clampP(probs[outcome] ?? 0));
export const binaryBrier = (p, hit) => (p - (hit ? 1 : 0)) ** 2;
export const binaryLogLoss = (p, hit) => -Math.log(clampP(hit ? p : 1 - p));

// matrix[i][j] = P(home scores i, away scores j). 1-based rank of the real score (null if outside the grid).
export function scoreRank(matrix, h, a) {
  if (!Array.isArray(matrix) || !matrix[h] || matrix[h][a] === undefined) return null;
  const mine = matrix[h][a];
  let better = 0;
  for (let i = 0; i < matrix.length; i++) for (let j = 0; j < matrix[i].length; j++) if (matrix[i][j] > mine) better++;
  return better + 1;
}
export const scoreLogLoss = (matrix, h, a) => -Math.log(Math.max(1e-6, matrix?.[h]?.[a] ?? 0));

// Grade one prediction against the 90-minute result.
export function gradeOne({ probs, matrix }, h, a) {
  const outcome = outcomeOf(h, a);
  const p = { home: probs.home, draw: probs.draw, away: probs.away };
  const pick = Object.entries(p).sort((x, y) => y[1] - x[1])[0][0];
  const over = h + a > 2, btts = h > 0 && a > 0;
  const rank = scoreRank(matrix, h, a);
  return {
    outcome, pick, pickCorrect: pick === outcome,
    brier: round(brier1x2(p, outcome), 4), logLoss: round(logLoss1x2(p, outcome), 4),
    overCorrect: (probs.over25 >= 0.5) === over, bttsCorrect: (probs.btts >= 0.5) === btts,
    ouLogLoss: round(binaryLogLoss(probs.over25, over), 4), bttsLogLoss: round(binaryLogLoss(probs.btts, btts), 4),
    scoreRank: rank, exact: rank === 1, top3: rank !== null && rank <= 3, top5: rank !== null && rank <= 5,
    scoreLogLoss: matrix ? round(scoreLogLoss(matrix, h, a), 4) : null,
  };
}

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);

// Aggregate a list of grades (from gradeOne) into the headline figures.
export function summarizeGrades(grades) {
  const g = grades.filter(Boolean);
  const n = g.length;
  return {
    n,
    winnerAccuracy: round(share(g.map((x) => x.pickCorrect))),
    overUnderAccuracy: round(share(g.map((x) => x.overCorrect))),
    bttsAccuracy: round(share(g.map((x) => x.bttsCorrect))),
    brier: round(avg(g.map((x) => x.brier)), 4),
    logLoss: round(avg(g.map((x) => x.logLoss)), 4),
    exactScore: round(share(g.map((x) => x.exact))),
    top3Score: round(share(g.map((x) => x.top3))),
    top5Score: round(share(g.map((x) => x.top5))),
    scoreLogLoss: round(avg(g.filter((x) => x.scoreLogLoss != null).map((x) => x.scoreLogLoss)), 3),
  };
}

// Calibration: of all the times we said ~X%, how often did it happen? points: [{ p: 0..1, hit: bool }]
export function calibration(points, bins = 10) {
  const rows = Array.from({ length: bins }, (_, i) => ({ from: i / bins, to: (i + 1) / bins, n: 0, p: 0, hits: 0 }));
  for (const { p, hit } of points) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor(p * bins)));
    rows[i].n++; rows[i].p += p; rows[i].hits += hit ? 1 : 0;
  }
  return rows.filter((r) => r.n).map((r) => ({ from: round(r.from, 2), to: round(r.to, 2), n: r.n, predicted: round(r.p / r.n), actual: round(r.hits / r.n) }));
}

// Compare another source (market or Forebet) with ours on the SAME matches.
// bench: { probs?: { home, draw, away }, topScores?: ["2-1", ...] }
export function gradeBenchmark(bench, h, a) {
  const outcome = outcomeOf(h, a);
  const out = {};
  const p = bench?.probs;
  if (p && Number.isFinite(p.home) && Number.isFinite(p.draw) && Number.isFinite(p.away)) {
    const sum = p.home + p.draw + p.away || 1;
    const q = { home: p.home / sum, draw: p.draw / sum, away: p.away / sum };
    out.brier = round(brier1x2(q, outcome), 4);
    out.logLoss = round(logLoss1x2(q, outcome), 4);
    out.pickCorrect = Object.entries(q).sort((x, y) => y[1] - x[1])[0][0] === outcome;
  }
  const list = Array.isArray(bench?.topScores) ? bench.topScores : [];
  if (list.length) {
    const at = list.indexOf(`${h}-${a}`);
    out.exact = at === 0;
    out.top3 = at >= 0 && at < 3;
    out.top5 = at >= 0 && at < 5;
    out.scoreListLength = list.length;
  }
  return out;
}
