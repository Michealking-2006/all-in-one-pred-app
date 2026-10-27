// poisson-v3: team ratings fitted from MATCH RESULTS instead of the league table. Pure functions,
// no network. Server-only (api/_models.js); the app does not download it.
//
// Every finished match this season is used, newest weighted most (half-life ~150 days), and each
// team's attack and defence are fitted TOGETHER, so scoring against a strong defence counts for more
// than scoring against a weak one (the table can't see that). Home advantage is fitted per league.
// Ridge pull toward the average (RIDGE expected goals) keeps thin records sane. The scoreline grid,
// draw calibration and outputs are shared with poisson-v2 (model.js).
// Constants are sensible, not fitted: the side-by-side comparison in Admin > Predictions decides.
import { scoreMatrix, summarize, drawBoostFor } from "./model.js";

export const MODEL_VERSION = "ratings-v3";
const HALF_LIFE_DAYS = 150, RIDGE = 10, ITERATIONS = 40, MIN_GAMES = 3, DAY = 86400000;
const DRAW_PRIOR = 0.26, DRAW_PRIOR_GAMES = 30;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// matches: [{ date (ms), home, away (team ids), hg, ag }]
export function fitRatings(matches, now = Date.now()) {
  const ms = matches.filter((m) => Number.isFinite(m.hg) && Number.isFinite(m.ag) && Number.isFinite(m.date));
  const w = ms.map((m) => Math.exp((-Math.LN2 * Math.max(0, now - m.date)) / (HALF_LIFE_DAYS * DAY)));
  const ids = [...new Set(ms.flatMap((m) => [m.home, m.away]))];
  const A = new Map(ids.map((i) => [i, 1])), D = new Map(ids.map((i) => [i, 1])), games = new Map(ids.map((i) => [i, 0]));
  ms.forEach((m) => { games.set(m.home, games.get(m.home) + 1); games.set(m.away, games.get(m.away) + 1); });
  let B = 1.2, H = 1.25;
  const W = w.reduce((a, b) => a + b, 0) || 1;
  B = Math.max(0.3, ms.reduce((s, m, i) => s + w[i] * m.ag, 0) / W);
  for (let it = 0; it < ITERATIONS; it++) {
    // home advantage and base rate in closed form
    let num = 0, den = 0, numA = 0, denA = 0;
    ms.forEach((m, i) => { num += w[i] * m.hg; den += w[i] * B * A.get(m.home) * D.get(m.away); numA += w[i] * m.ag; denA += w[i] * A.get(m.away) * D.get(m.home); });
    H = clamp(num / (den || 1), 0.8, 2);
    B = clamp(numA / (denA || 1), 0.3, 3);
    // each team's attack: goals it scored vs what it was "expected" to score at rating 1, plus ridge toward 1
    const aNum = new Map(ids.map((i) => [i, RIDGE])), aDen = new Map(ids.map((i) => [i, RIDGE]));
    const dNum = new Map(ids.map((i) => [i, RIDGE])), dDen = new Map(ids.map((i) => [i, RIDGE]));
    ms.forEach((m, i) => {
      const lh = B * H * D.get(m.away), la = B * D.get(m.home);   // per unit of the scorer's attack
      aNum.set(m.home, aNum.get(m.home) + w[i] * m.hg); aDen.set(m.home, aDen.get(m.home) + w[i] * lh);
      aNum.set(m.away, aNum.get(m.away) + w[i] * m.ag); aDen.set(m.away, aDen.get(m.away) + w[i] * la);
      const dh = B * H * A.get(m.home), da = B * A.get(m.away);   // per unit of the conceder's weakness
      dNum.set(m.away, dNum.get(m.away) + w[i] * m.hg); dDen.set(m.away, dDen.get(m.away) + w[i] * dh);
      dNum.set(m.home, dNum.get(m.home) + w[i] * m.ag); dDen.set(m.home, dDen.get(m.home) + w[i] * da);
    });
    for (const i of ids) { A.set(i, aNum.get(i) / aDen.get(i)); D.set(i, dNum.get(i) / dDen.get(i)); }
    // keep the scale identifiable: average attack and defence are 1
    const mA = [...A.values()].reduce((a, b) => a + b, 0) / ids.length, mD = [...D.values()].reduce((a, b) => a + b, 0) / ids.length;
    for (const i of ids) { A.set(i, A.get(i) / mA); D.set(i, D.get(i) / mD); }
    B *= mA * mD;
  }
  const draws = ms.filter((m) => m.hg === m.ag).length;
  return { A, D, B, H, games, drawRate: (draws + DRAW_PRIOR * DRAW_PRIOR_GAMES) / (ms.length + DRAW_PRIOR_GAMES), n: ms.length };
}

const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

// Same call shape and result shape as the table models; extra input: matches (finished games this season).
export function predictFromMatches({ homeId, awayId, matches, now = Date.now(), form = {} }) {
  if (!Array.isArray(matches) || matches.length < 20) return null;
  const fit = fitRatings(matches, now);
  const gh = fit.games.get(homeId) || 0, ga = fit.games.get(awayId) || 0;
  if (gh < MIN_GAMES || ga < MIN_GAMES) return null;
  const lh = clamp(fit.B * fit.H * fit.A.get(homeId) * fit.D.get(awayId), 0.2, 4.5);
  const la = clamp(fit.B * fit.A.get(awayId) * fit.D.get(homeId), 0.2, 4.5);
  const boost = drawBoostFor({ home: fit.B * fit.H, away: fit.B }, fit.drawRate);
  const grid = scoreMatrix(lh, la, boost);
  const probs = summarize(grid);
  let h = 0, d = 0, a = 0, o = 0, b = 0; const all = [];
  grid.forEach((row, i) => row.forEach((p, j) => { if (i > j) h += p; else if (i === j) d += p; else a += p; if (i + j > 2) o += p; if (i > 0 && j > 0) b += p; all.push({ home: i, away: j, p }); }));
  all.sort((x, y) => y.p - x.p);
  const top = [["home", probs.home], ["draw", probs.draw], ["away", probs.away]].sort((x, y) => y[1] - x[1])[0];
  const games = Math.min(gh, ga);
  const confidence = games < 5 ? "low" : top[1] >= 55 && games >= 8 ? "high" : top[1] >= 42 ? "medium" : "low";
  const team = (id) => ({ attack: r3(fit.A.get(id)), defence: r3(fit.D.get(id)) });
  return {
    model: MODEL_VERSION,
    probs: { home: probs.home, draw: probs.draw, away: probs.away }, pick: top[0], pickProb: top[1], confidence,
    xg: { home: r2(lh), away: r2(la) }, likelyScore: { home: probs.scores[0].home, away: probs.scores[0].away },
    topScores: probs.scores.map((s) => ({ home: s.home, away: s.away, p: Math.round(s.p * 1000) / 10 })),
    over25: probs.over25, under25: 100 - probs.over25, btts: probs.btts,
    top5: all.slice(0, 5).map((s) => ({ home: s.home, away: s.away, p: Math.round(s.p * 1000) / 10 })),
    exact: { home: h, draw: d, away: a, over25: o, btts: b },
    matrix: grid.map((row) => row.map((p) => Math.round(p * 10000) / 10000)),
    basis: { gamesHome: gh, gamesAway: ga, leagueAvgHome: r2(fit.B * fit.H), leagueAvgAway: r2(fit.B), formUsed: false, matches: fit.n, homeAdvantage: r3(fit.H), drawBoost: r3(boost), ratings: { home: team(homeId), away: team(awayId) } },
    drivers: { homeScoring: 0, awayConceding: 0, awayScoring: 0, homeConceding: 0 },
  };
}

// API-Football fixtures response -> matches (90-minute score).
export function matchesFrom(response) {
  return (response || []).map((fx) => {
    const ft = fx?.score?.fulltime;
    return { date: new Date(fx?.fixture?.date).getTime(), home: fx?.teams?.home?.id, away: fx?.teams?.away?.id, hg: ft?.home ?? fx?.goals?.home, ag: ft?.away ?? fx?.goals?.away };
  }).filter((m) => m.home && m.away && Number.isFinite(m.date) && Number.isFinite(m.hg) && Number.isFinite(m.ag));
}
