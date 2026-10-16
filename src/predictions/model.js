// Scoutwave's own prediction model. Pure functions, no network and no DOM.
//
// Method (a transparent, well-understood baseline): every team gets attack and
// defence strengths, separately at home and away, from the league table's goals
// for / against, blended toward the league average while few games have been
// played. Expected goals for each side come from those strengths; a Poisson
// grid over scorelines (with the usual small correction for low scores) then
// gives win / draw / loss, over 2.5, both teams to score and the likeliest score.
// Recent form (last five results) nudges the expected goals by at most 8%.
// This is a statistical estimate, not a guarantee, and not betting advice.
export const MODEL_VERSION = "poisson-v1";

const PRIOR_GAMES = 6;     // how many "average" games each team's record is blended with
const MAX_GOALS = 8;
const RHO = -0.03;         // Dixon-Coles low-score correction
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 4.5;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Standings -> the flat list of team rows (some competitions have groups: use
// the group that contains both teams).
export function tableFor(standingsResponse, homeId, awayId) {
  const groups = standingsResponse?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return null;
  const hasTeam = (group, id) => group.some((row) => row?.team?.id === id);
  return groups.find((g) => Array.isArray(g) && hasTeam(g, homeId) && hasTeam(g, awayId)) || null;
}

export function leagueAverages(rows) {
  let hg = 0, hp = 0, ag = 0, ap = 0;
  for (const r of rows) {
    hp += num(r.home?.played); hg += num(r.home?.goals?.for);
    ap += num(r.away?.played); ag += num(r.away?.goals?.for);
  }
  return { home: hp ? hg / hp : 1.45, away: ap ? ag / ap : 1.15, games: hp };
}

const shrink = (perGame, avg, n) => (perGame * n + avg * PRIOR_GAMES) / (n + PRIOR_GAMES);

export function strengthsOf(row, avg) {
  const hp = num(row.home?.played), ap = num(row.away?.played);
  const hf = hp ? num(row.home.goals.for) / hp : avg.home;
  const hAgainst = hp ? num(row.home.goals.against) / hp : avg.away;
  const af = ap ? num(row.away.goals.for) / ap : avg.away;
  const aAgainst = ap ? num(row.away.goals.against) / ap : avg.home;
  return {
    homePlayed: hp, awayPlayed: ap,
    attackHome: shrink(hf, avg.home, hp) / avg.home,
    defenceHome: shrink(hAgainst, avg.away, hp) / avg.away,   // goals conceded at home, vs a typical away team's output
    attackAway: shrink(af, avg.away, ap) / avg.away,
    defenceAway: shrink(aAgainst, avg.home, ap) / avg.home,   // goals conceded away, vs a typical home team's output
  };
}

// ["W","D","L",...] (newest last) -> a multiplier near 1.
export function formFactor(letters) {
  const last = (Array.isArray(letters) ? letters : []).slice(-5);
  if (last.length < 3) return 1;
  const points = last.reduce((sum, l) => sum + (l === "W" ? 3 : l === "D" ? 1 : 0), 0);
  return 1 + clamp((points / last.length - 1.4) * 0.04, -0.08, 0.08);
}

export function expectedGoals(home, away, avg, form = {}) {
  const lambdaHome = avg.home * home.attackHome * away.defenceAway * formFactor(form.home);
  const lambdaAway = avg.away * away.attackAway * home.defenceHome * formFactor(form.away);
  return { home: clamp(lambdaHome, MIN_LAMBDA, MAX_LAMBDA), away: clamp(lambdaAway, MIN_LAMBDA, MAX_LAMBDA) };
}

function poissonPmf(lambda) {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) out.push((out[k - 1] * lambda) / k);
  return out;
}

export function scoreMatrix(lambdaHome, lambdaAway) {
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
      grid[i].push(p);
      total += p;
    }
  }
  return grid.map((row) => row.map((p) => p / total)); // normalised
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
export function predictFromTable({ homeId, awayId, rows, form = {} }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const homeRow = rows.find((r) => r?.team?.id === homeId);
  const awayRow = rows.find((r) => r?.team?.id === awayId);
  if (!homeRow || !awayRow) return null;

  const avg = leagueAverages(rows);
  const home = strengthsOf(homeRow, avg);
  const away = strengthsOf(awayRow, avg);
  const xg = expectedGoals(home, away, avg, form);
  const probs = summarize(scoreMatrix(xg.home, xg.away));

  const outcomes = [["home", probs.home], ["draw", probs.draw], ["away", probs.away]].sort((a, b) => b[1] - a[1]);
  const pick = outcomes[0][0];
  const pickProb = outcomes[0][1];
  const games = Math.min(home.homePlayed, away.awayPlayed);
  // Thin records and near coin-flips are both "low".
  const confidence = games < 4 ? "low" : pickProb >= 55 ? "high" : pickProb >= 42 ? "medium" : "low";

  return {
    model: MODEL_VERSION,
    probs: { home: probs.home, draw: probs.draw, away: probs.away },
    pick, pickProb, confidence,
    xg: { home: Math.round(xg.home * 100) / 100, away: Math.round(xg.away * 100) / 100 },
    likelyScore: { home: probs.scores[0].home, away: probs.scores[0].away },
    topScores: probs.scores.map((s) => ({ home: s.home, away: s.away, p: Math.round(s.p * 1000) / 10 })),
    over25: probs.over25, under25: 100 - probs.over25, btts: probs.btts,
    basis: { gamesHome: home.homePlayed, gamesAway: away.awayPlayed, leagueAvgHome: Math.round(avg.home * 100) / 100, leagueAvgAway: Math.round(avg.away * 100) / 100, formUsed: !!(form.home?.length || form.away?.length) },
    // Plain-language drivers, for display.
    drivers: {
      homeScoring: Math.round(((homeRow.home.goals.for) / Math.max(1, homeRow.home.played)) * 100) / 100,
      awayConceding: Math.round(((awayRow.away.goals.against) / Math.max(1, awayRow.away.played)) * 100) / 100,
      awayScoring: Math.round(((awayRow.away.goals.for) / Math.max(1, awayRow.away.played)) * 100) / 100,
      homeConceding: Math.round(((homeRow.home.goals.against) / Math.max(1, homeRow.home.played)) * 100) / 100,
    },
  };
}
