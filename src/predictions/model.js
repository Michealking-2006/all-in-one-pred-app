// Scoutwave's own prediction model. Pure functions, no network and no DOM.
//
// poisson-v2. Same inputs as poisson-v1 (the league table, plus the last five results), so it
// costs no extra football API requests. What changed, and why:
//
//  1. Strengths come from ALL of a team's games first, then the home/away split nudges them.
//     A team's 8 home games say little on their own; its 16 games say more. (v1 trusted the split.)
//  2. Shrinkage is measured, not guessed. How far a team's record is pulled toward the league
//     average comes from how much teams really differ in this league right now (method of moments
//     on the table): a league of near-equals pulls harder than one with a clear top and bottom.
//     Few games behind a record also means a bigger pull, as before. (v1 used a fixed "6 average games".)
//  3. Draws are calibrated to the league. The model's draw rate for an average match is lined up
//     with the competition's real draw rate (itself shrunk toward 26%), instead of a fixed
//     small low-score correction alone.
//  4. Form is judged against the team's own season. A strong team winning is not "hot form";
//     only results better or worse than its usual points per game move the numbers, and a team's
//     form nudges its opponent slightly the other way. (v1 counted raw points, so good teams were
//     credited twice.)
//  5. Confidence needs enough games, not just a big percentage.
//
// The constants below are sensible, not fitted: Scoutwave has no history to fit them on yet.
// The server records poisson-v1 beside this model on the same matches so the two can be compared
// honestly (Admin > Predictions); keep a change only if it wins there.
// A statistical estimate, not a guarantee, and not betting advice.
export const MODEL_VERSION = "poisson-v2";

const MAX_GOALS = 8;
const RHO = -0.03;               // Dixon-Coles low-score correction (unchanged from v1)
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 4.5;

const PRIOR_LEAGUE_GAMES = 10;   // league scoring averages are blended with typical values until ~10 games are in
const PRIOR_HOME = 1.45;
const PRIOR_AWAY = 1.15;
const KAPPA_DEFAULT = 14;        // prior strength (in expected goals) when the table can't tell us
const KAPPA_MIN = 8;             // never trust a table's raw spread more than this
const KAPPA_MAX = 40;            // the table shows no measurable spread between teams (common very early in a season)
const KAPPA_VENUE = 40;          // how strongly a team's home (or away) record is pulled toward its overall record
const DRAW_PRIOR = 0.26;
const DRAW_PRIOR_GAMES = 30;
const DRAW_BOOST_MIN = 0.8;
const DRAW_BOOST_MAX = 1.35;
const FORM_SLOPE = 0.025;        // change in expected goals per point of (recent - season) points per game
const FORM_MAX = 0.05;           // never more than 5% on a team's own expected goals (2.5% against its opponent)
const AVERAGE_PPG = 1.37;        // used only when a table row has no win/draw split

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Goals per game for display, to two decimals; safe when a table row has no home/away split.
const perGame = (goals, played) => Math.round((num(goals) / Math.max(1, num(played))) * 100) / 100;

// Standings -> the flat list of team rows (some competitions have groups: use
// the group that contains both teams).
export function tableFor(standingsResponse, homeId, awayId) {
  const groups = standingsResponse?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return null;
  const hasTeam = (group, id) => group.some((row) => row?.team?.id === id);
  return groups.find((g) => Array.isArray(g) && hasTeam(g, homeId) && hasTeam(g, awayId)) || null;
}

// ---------------------------------------------------------------------------
// League level
// ---------------------------------------------------------------------------
export function leagueAverages(rows) {
  let hg = 0, hp = 0, ag = 0, ap = 0;
  for (const r of rows) {
    hp += num(r.home?.played); hg += num(r.home?.goals?.for);
    ap += num(r.away?.played); ag += num(r.away?.goals?.for);
  }
  // Blend with typical values while few games have been played, so matchday 1-2 can't swing the baseline.
  return {
    home: (hg + PRIOR_HOME * PRIOR_LEAGUE_GAMES) / (hp + PRIOR_LEAGUE_GAMES),
    away: (ag + PRIOR_AWAY * PRIOR_LEAGUE_GAMES) / (ap + PRIOR_LEAGUE_GAMES),
    games: hp,
  };
}

// Goals scored / conceded by a team, next to what an average team would have scored / conceded in the
// same venues (in goals, so it works as a Poisson exposure).
function exposures(row, avg) {
  const hp = num(row.home?.played), ap = num(row.away?.played);
  return {
    hp, ap,
    gfH: num(row.home?.goals?.for), gfA: num(row.away?.goals?.for),
    gaH: num(row.home?.goals?.against), gaA: num(row.away?.goals?.against),
    eAttH: hp * avg.home, eAttA: ap * avg.away,     // what an average attack would score at home / away
    eDefH: hp * avg.away, eDefA: ap * avg.home,     // what an average defence would concede at home / away
  };
}

// How strongly to pull a team toward the league average, from how much teams really differ.
// Method of moments: the spread of the teams' goal ratios, minus the spread chance alone would cause.
export function estimateKappa(rows, avg) {
  const att = [], def = [], noiseA = [], noiseD = [];
  for (const row of rows) {
    const e = exposures(row, avg);
    const eA = e.eAttH + e.eAttA, eD = e.eDefH + e.eDefA;
    if (eA < 4 || eD < 4) continue;
    att.push((e.gfH + e.gfA) / eA); noiseA.push(1 / eA);
    def.push((e.gaH + e.gaA) / eD); noiseD.push(1 / eD);
  }
  if (att.length < 8) return KAPPA_DEFAULT;
  const excess = (xs, noise) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
    const chance = (noise.reduce((a, b) => a + b, 0) / noise.length) * m; // Var(goals / expected) = ratio / expected
    return Math.max(0, variance - chance);
  };
  const tau2 = (excess(att, noiseA) + excess(def, noiseD)) / 2;
  return tau2 > 0 ? clamp(1 / tau2, KAPPA_MIN, KAPPA_MAX) : KAPPA_MAX;
}

// The competition's draw share, shrunk toward 26%. null when the table has no results split.
export function leagueDrawRate(rows) {
  let draws = 0, played = 0, seen = false;
  for (const r of rows) {
    const d = r.all?.draw ?? (r.home?.draw !== undefined && r.away?.draw !== undefined ? num(r.home.draw) + num(r.away.draw) : undefined);
    if (d === undefined || d === null || !Number.isFinite(Number(d))) continue;
    seen = true;
    draws += num(d);
    played += num(r.all?.played) || num(r.home?.played) + num(r.away?.played);
  }
  if (!seen) return null;
  // Every draw appears in two rows, and so does every game.
  return (draws / 2 + DRAW_PRIOR * DRAW_PRIOR_GAMES) / (played / 2 + DRAW_PRIOR_GAMES);
}

// ---------------------------------------------------------------------------
// Team level
// ---------------------------------------------------------------------------
// Each strength is a ratio around 1 (1.2 = 20% better than the league average). Overall first, then the venue split.
export function strengthsOf(row, avg, kappa = KAPPA_DEFAULT) {
  const e = exposures(row, avg);
  const post = (goals, expected, prior, strength) => (goals + strength * prior) / (expected + strength);
  const attAll = post(e.gfH + e.gfA, e.eAttH + e.eAttA, 1, kappa);
  const defAll = post(e.gaH + e.gaA, e.eDefH + e.eDefA, 1, kappa);
  return {
    homePlayed: e.hp, awayPlayed: e.ap, played: e.hp + e.ap,
    attackHome: post(e.gfH, e.eAttH, attAll, KAPPA_VENUE),
    attackAway: post(e.gfA, e.eAttA, attAll, KAPPA_VENUE),
    defenceHome: post(e.gaH, e.eDefH, defAll, KAPPA_VENUE),   // goals conceded at home vs a typical away attack
    defenceAway: post(e.gaA, e.eDefA, defAll, KAPPA_VENUE),   // goals conceded away vs a typical home attack
  };
}

const pointsPerGame = (row) => {
  const played = num(row.all?.played) || num(row.home?.played) + num(row.away?.played);
  const win = row.all?.win ?? (row.home?.win !== undefined && row.away?.win !== undefined ? num(row.home.win) + num(row.away.win) : undefined);
  const draw = row.all?.draw ?? (row.home?.draw !== undefined && row.away?.draw !== undefined ? num(row.home.draw) + num(row.away.draw) : undefined);
  if (!played || win === undefined || draw === undefined) return null;
  return (3 * num(win) + num(draw)) / played;
};

// ["W","D","L",...] (newest last), judged against the team's own season: a number in [-FORM_MAX, FORM_MAX].
export function formShift(letters, row) {
  const last = (Array.isArray(letters) ? letters : []).slice(-5);
  if (last.length < 3) return 0;
  const recent = last.reduce((sum, l) => sum + (l === "W" ? 3 : l === "D" ? 1 : 0), 0) / last.length;
  const season = pointsPerGame(row) ?? AVERAGE_PPG;
  return clamp((recent - season) * FORM_SLOPE, -FORM_MAX, FORM_MAX);
}

// ---------------------------------------------------------------------------
// Match level
// ---------------------------------------------------------------------------
export function expectedGoals(home, away, avg, shifts = {}) {
  const sh = num(shifts.home), sa = num(shifts.away);
  const lambdaHome = avg.home * home.attackHome * away.defenceAway * (1 + sh) * (1 - sa / 2);
  const lambdaAway = avg.away * away.attackAway * home.defenceHome * (1 + sa) * (1 - sh / 2);
  return { home: clamp(lambdaHome, MIN_LAMBDA, MAX_LAMBDA), away: clamp(lambdaAway, MIN_LAMBDA, MAX_LAMBDA) };
}

function poissonPmf(lambda) {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) out.push((out[k - 1] * lambda) / k);
  return out;
}

// drawBoost multiplies every level scoreline (0-0, 1-1, ...) before the grid is normalised.
export function scoreMatrix(lambdaHome, lambdaAway, drawBoost = 1) {
  const ph = poissonPmf(lambdaHome), pa = poissonPmf(lambdaAway);
  const grid = [];
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    grid.push([]);
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = ph[i] * pa[j];
      if (i === 0 && j === 0) p *= 1 - lambdaHome * lambdaAway * RHO;
      else if (i === 0 && j === 1) p *= 1 + lambdaHome * RHO;
      else if (i === 1 && j === 0) p *= 1 + lambdaAway * RHO;
      else if (i === 1 && j === 1) p *= 1 - RHO;
      if (i === j) p *= drawBoost;
      grid[i].push(p);
      total += p;
    }
  }
  return grid.map((row) => row.map((p) => p / total)); // normalised
}

const drawShare = (grid) => grid.reduce((s, row, i) => s + row[i], 0);

// The factor that makes an average match in this league come out at the league's real draw share.
export function drawBoostFor(avg, targetDrawRate) {
  if (!Number.isFinite(targetDrawRate)) return 1;
  const d = drawShare(scoreMatrix(avg.home, avg.away, 1));
  const t = clamp(targetDrawRate, 0.05, 0.6);
  if (!(d > 0 && d < 1)) return 1;
  return clamp((t * (1 - d)) / (d * (1 - t)), DRAW_BOOST_MIN, DRAW_BOOST_MAX); // odds-ratio scaling
}

// Whole percentages that always add up to 100 (largest remainder).
export function toPercents(values) {
  const raw = values.map((v) => v * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - floor[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floor[i]++; left--; } });
  return floor;
}

export function summarize(grid) {
  let home = 0, draw = 0, away = 0, over25 = 0, btts = 0;
  const scores = [];
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const p = grid[i][j];
      if (i > j) home += p; else if (i === j) draw += p; else away += p;
      if (i + j > 2) over25 += p;
      if (i > 0 && j > 0) btts += p;
      scores.push({ home: i, away: j, p });
    }
  }
  scores.sort((a, b) => b.p - a.p);
  const [pHome, pDraw, pAway] = toPercents([home, draw, away]);
  return { home: pHome, draw: pDraw, away: pAway, over25: Math.round(over25 * 100), btts: Math.round(btts * 100), scores: scores.slice(0, 3) };
}

// Predict one fixture from a standings table. Returns null when there isn't
// enough data (no table, or a team missing from it).
// form: { home: ["W","D",...], away: [...] }, newest last (optional).
export function predictFromTable({ homeId, awayId, rows, form = {} }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const homeRow = rows.find((r) => r?.team?.id === homeId);
  const awayRow = rows.find((r) => r?.team?.id === awayId);
  if (!homeRow || !awayRow) return null;

  const avg = leagueAverages(rows);
  const kappa = estimateKappa(rows, avg);
  const home = strengthsOf(homeRow, avg, kappa);
  const away = strengthsOf(awayRow, avg, kappa);
  const shifts = { home: formShift(form.home, homeRow), away: formShift(form.away, awayRow) };
  const xg = expectedGoals(home, away, avg, shifts);
  const leagueDraws = leagueDrawRate(rows);
  const drawBoost = drawBoostFor(avg, leagueDraws);
  const grid = scoreMatrix(xg.home, xg.away, drawBoost);
  const probs = summarize(grid);
  // Unrounded figures for scoring, the 5 likeliest scores and the whole score grid (server tracking).
  let h = 0, d = 0, a = 0, o = 0, b = 0;
  const all = [];
  grid.forEach((row, i) => row.forEach((p, j) => { if (i > j) h += p; else if (i === j) d += p; else a += p; if (i + j > 2) o += p; if (i > 0 && j > 0) b += p; all.push({ home: i, away: j, p }); }));
  all.sort((x, y) => y.p - x.p);

  const outcomes = [["home", probs.home], ["draw", probs.draw], ["away", probs.away]].sort((x, y) => y[1] - x[1]);
  const pick = outcomes[0][0];
  const pickProb = outcomes[0][1];
  const games = Math.min(home.played, away.played);
  // Thin records and near coin-flips are both "low"; "high" needs a clear favourite AND a real sample.
  const confidence = games < 5 ? "low" : pickProb >= 55 && games >= 8 ? "high" : pickProb >= 42 ? "medium" : "low";
  const r2 = (v) => Math.round(v * 100) / 100;
  const r3 = (v) => Math.round(v * 1000) / 1000;

  return {
    model: MODEL_VERSION,
    probs: { home: probs.home, draw: probs.draw, away: probs.away },
    pick, pickProb, confidence,
    xg: { home: r2(xg.home), away: r2(xg.away) },
    likelyScore: { home: probs.scores[0].home, away: probs.scores[0].away },
    topScores: probs.scores.map((s) => ({ home: s.home, away: s.away, p: Math.round(s.p * 1000) / 10 })),
    over25: probs.over25, under25: 100 - probs.over25, btts: probs.btts,
    top5: all.slice(0, 5).map((s) => ({ home: s.home, away: s.away, p: Math.round(s.p * 1000) / 10 })),
    exact: { home: h, draw: d, away: a, over25: o, btts: b },
    matrix: grid.map((row) => row.map((p) => Math.round(p * 10000) / 10000)),
    basis: {
      gamesHome: home.homePlayed, gamesAway: away.awayPlayed, leagueAvgHome: r2(avg.home), leagueAvgAway: r2(avg.away),
      formUsed: !!(form.home?.length || form.away?.length),
      // What v2 measured about this competition and match (stored for later back-tests; not shown in the app).
      kappa: Math.round(kappa * 10) / 10, drawBoost: r3(drawBoost), leagueDrawRate: leagueDraws === null ? null : r3(leagueDraws),
      formShift: { home: r3(shifts.home), away: r3(shifts.away) },
    },
    // Plain-language drivers, for display.
    drivers: {
      homeScoring: perGame(homeRow.home?.goals?.for, homeRow.home?.played),
      awayConceding: perGame(awayRow.away?.goals?.against, awayRow.away?.played),
      awayScoring: perGame(awayRow.away?.goals?.for, awayRow.away?.played),
      homeConceding: perGame(homeRow.home?.goals?.against, homeRow.home?.played),
    },
  };
}
