// Slip Generator: builds a betting slip from Scoutwave's own predicted matches (the stored predictions, read from our
// own server: no football data service involved). Pure functions (tested without a
// browser); the screen is src/components/SlipGenerator.js.
//
// Odds here are MODEL odds: the fair price from the model's probability with a 6% margin taken off, the way a
// bookmaker prices it. They are not bookmaker prices, and the screen says so. Win chance is the product of the picks'
// probabilities (the matches are different games, so the picks are independent).
export const MARGIN = 0.94;
export const BET_TYPES = [
  { id: "winner", label: "Winner" },
  { id: "dc", label: "Double chance" },
  { id: "ou15", label: "Over / Under 1.5" },
  { id: "ou25", label: "Over / Under 2.5" },
  { id: "ou35", label: "Over / Under 3.5" },
  { id: "btts", label: "Both teams to score" },
];
// minP: the least likely a pick may be. rank: how the picks are ordered before the best N are taken.
export const RISKS = {
  safe: { label: "Safe", minP: 0.62, rank: (c) => c.p },
  balanced: { label: "Balanced", minP: 0.48, rank: (c) => c.p * c.odds },
  risky: { label: "Risky", minP: 0.33, rank: (c) => c.odds * Math.sqrt(c.p) },
};
export const MIN_GAMES = 2, MAX_GAMES = 7;
export const ODDS_RANGE = { min: 1.1, max: 3.5, step: 0.05, default: 1.2 };

const r2 = (v) => Math.round(v * 100) / 100;
const oddsFor = (p) => Math.max(1.01, r2(MARGIN / p));

// P(total goals > line) for a Poisson total with mean lambda; line = 1, 2 or 3 (i.e. Over 1.5, 2.5, 3.5).
function poissonOver(lambda, k) {
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i <= k; i++) { term *= lambda / i; cdf += term; }
  return 1 - cdf;
}
// Goal lines come exactly from the stored score grid (`markets`). A prediction recorded without one (older rows) falls
// back to a goals curve fitted to the model's own Over 2.5 figure, so the three lines still agree with each other.
export function totalsFrom(prediction) {
  const m = prediction?.markets;
  if (m && [m.over15, m.over25, m.over35].every(Number.isFinite)) return { over15: m.over15, over25: m.over25, over35: m.over35 }; // exact, from the stored score grid
  const target = Number.isFinite(prediction?.over25) ? Math.min(0.97, Math.max(0.03, prediction.over25 / 100)) : null;
  const xg = (prediction?.xg?.home ?? 1.3) + (prediction?.xg?.away ?? 1.1);
  let lambda = Math.max(0.4, xg);
  if (target !== null) {
    let lo = 0.2, hi = 9;
    for (let i = 0; i < 40; i++) { lambda = (lo + hi) / 2; if (poissonOver(lambda, 2) < target) lo = lambda; else hi = lambda; }
  }
  return { over15: poissonOver(lambda, 1), over25: target ?? poissonOver(lambda, 2), over35: poissonOver(lambda, 3) };
}

// Every pick the model can offer for one match, with its probability (0 to 1) and model odds. One list per bet type.
export function candidatesFor(prediction, fx, types) {
  if (!prediction || prediction.locked || !prediction.probs) return [];
  const home = fx.teams?.home?.name || "Home", away = fx.teams?.away?.name || "Away";
  const m = prediction.markets || {}; // exact figures from the stored score grid when the server sent them
  const p = { home: m.home ?? prediction.probs.home / 100, draw: m.draw ?? prediction.probs.draw / 100, away: m.away ?? prediction.probs.away / 100 };
  const out = [];
  const xg = Number.isFinite(prediction.xg?.home) && Number.isFinite(prediction.xg?.away) ? prediction.xg.home.toFixed(1) + " - " + prediction.xg.away.toFixed(1) : "";
  const add = (type, pick, label, prob) => { if (prob > 0.01 && prob < 0.99) out.push({ fixtureId: fx.fixture?.id, fx, type, pick, label, p: prob, odds: oddsFor(prob), xg }); };
  const on = (id) => types.includes(id);
  if (on("winner")) { add("winner", "home", home + " to win", p.home); add("winner", "draw", "Draw", p.draw); add("winner", "away", away + " to win", p.away); }
  if (on("dc")) { add("dc", "1x", home + " or draw", m.dc1x ?? p.home + p.draw); add("dc", "x2", away + " or draw", m.dcx2 ?? p.away + p.draw); add("dc", "12", "Either team to win (no draw)", m.dc12 ?? p.home + p.away); }
  const t = totalsFrom(prediction);
  for (const [id, line, over] of [["ou15", "1.5", t.over15], ["ou25", "2.5", t.over25], ["ou35", "3.5", t.over35]]) {
    if (!on(id)) continue;
    add(id, "over", "Over " + line + " goals", over);
    add(id, "under", "Under " + line + " goals", 1 - over);
  }
  const btts = Number.isFinite(m.btts) ? m.btts : Number.isFinite(prediction.btts) ? prediction.btts / 100 : null;
  if (on("btts") && btts !== null) { add("btts", "yes", "Both teams to score", btts); add("btts", "no", "Not both teams to score", 1 - btts); }
  return out;
}

const START_BUFFER_MS = 5 * 60000; // a match that starts within 5 minutes is no longer offered
const startsLater = (c, now) => Date.parse(c.fx.fixture?.date) > now + START_BUFFER_MS;
const byKickoff = (a, b) => Date.parse(a.fx.fixture?.date) - Date.parse(b.fx.fixture?.date);

// Best pick per match for these settings, best first. skip: match ids to leave out.
function rankedBest(pool, { risk = "safe", types = BET_TYPES.map((t) => t.id), minOdds = ODDS_RANGE.default, leagues = [], jitter = 0, rng = Math.random, skip = new Set(), now = Date.now() } = {}) {
  const rule = RISKS[risk] || RISKS.safe;
  const best = [];
  for (const { fx, prediction } of pool) {
    if (skip.has(fx.fixture?.id) || (leagues.length && !leagues.includes(fx.league?.id)) || Date.parse(fx.fixture?.date) <= now + START_BUFFER_MS) continue;
    const fits = candidatesFor(prediction, fx, types).filter((c) => c.p >= rule.minP && c.odds >= minOdds);
    if (!fits.length) continue;
    // One pick per match: the one this risk level likes best.
    const scored = fits.map((c) => ({ c, s: rule.rank(c) * (1 + (jitter ? (rng() - 0.5) * 2 * jitter : 0)) })).sort((a, b) => b.s - a.s);
    best.push(scored[0]);
  }
  return best.sort((a, b) => b.s - a.s);
}

export function summarise(picks) {
  return { picks, totalOdds: picks.length ? r2(picks.reduce((t, c) => t * c.odds, 1)) : 0, winChance: picks.length ? picks.reduce((t, c) => t * c.p, 1) : 0 };
}

// pool: [{ fx, prediction }]. options: { games, risk, types, minOdds, leagues (ids; empty = all), jitter (0..0.4), rng,
// locked (picks to keep: they stay whatever the filters say, unless the match has started), skip (match ids to avoid), now }.
// Returns { picks, totalOdds, winChance, short } where short is how many of the wanted games could not be filled.
export function buildSlip(pool, options = {}) {
  const wanted = Math.max(MIN_GAMES, Math.min(MAX_GAMES, Math.round(options.games ?? 2)));
  const now = options.now ?? Date.now();
  const kept = (options.locked || []).filter((c) => startsLater(c, now)).slice(0, wanted);
  const taken = new Set([...(options.skip || []), ...kept.map((c) => c.fixtureId)]);
  const fresh = rankedBest(pool, { ...options, skip: taken, now }).slice(0, wanted - kept.length).map((x) => x.c);
  const picks = [...kept, ...fresh].sort(byKickoff);
  return { ...summarise(picks), short: wanted - picks.length };
}

// "Build another": like buildSlip, but nudges the ranking harder each try until the slip differs from the one on screen.
export function buildDifferent(pool, options, previous = []) {
  const key = (picks) => picks.map((c) => c.fixtureId + c.type + c.pick).sort().join("|");
  const before = key(previous);
  let slip;
  for (let i = 0; i < 6; i++) { slip = buildSlip(pool, { ...options, jitter: Math.min(0.4, 0.12 + i * 0.06) }); if (key(slip.picks) !== before) break; }
  return slip;
}

// Replace one pick with the best pick from a match that is not already on the slip (or in `skip`). null if there is none.
export function swapPick(pool, picks, index, options = {}) {
  if (!picks[index]) return null;
  const now = options.now ?? Date.now();
  const skip = new Set([...(options.skip || []), ...picks.map((c) => c.fixtureId)]);
  const next = rankedBest(pool, { ...options, jitter: 0, skip, now })[0];
  return next ? summarise([...picks.slice(0, index), ...picks.slice(index + 1), next.c].sort(byKickoff)) : null;
}

// When a slip can't be filled, the smallest change that would fill it: { label, patch } (patch is merged into the
// settings), or null if nothing helps. Tried in order: lower the minimum odds, all leagues, all bet types, a riskier level.
export function relaxSuggestion(pool, options) {
  const wanted = Math.max(MIN_GAMES, Math.min(MAX_GAMES, Math.round(options.games ?? 2)));
  const have = buildSlip(pool, options).picks.length;
  if (have >= wanted) return null;
  const order = Object.keys(RISKS), next = order[order.indexOf(options.risk || "safe") + 1];
  const steps = [];
  if (options.minOdds > ODDS_RANGE.min) steps.push({ label: "Lower the minimum odds to " + ODDS_RANGE.min.toFixed(2), patch: { minOdds: ODDS_RANGE.min } });
  if (options.leagues?.length) steps.push({ label: "Use all leagues", patch: { leagues: [] } });
  if ((options.types?.length ?? BET_TYPES.length) < BET_TYPES.length) steps.push({ label: "Use every bet type", patch: { types: BET_TYPES.map((t) => t.id) } });
  if (next) steps.push({ label: "Switch to " + RISKS[next].label, patch: { risk: next } });
  let best = null;
  for (const step of steps) { // the first single change that fills the slip, else the one that adds the most
    const n = buildSlip(pool, { ...options, ...step.patch, locked: options.locked }).picks.length;
    if (n >= wanted) return step;
    if (n > have && (!best || n > best.n)) best = { ...step, n };
  }
  return best ? { label: best.label, patch: best.patch } : null;
}

export const returnsFor = (stake, totalOdds) => r2(stake * totalOdds);
export function slipTier(winChance) {
  return winChance >= 0.55 ? { id: "high", label: "High probability slip" } : winChance >= 0.25 ? { id: "mid", label: "Balanced slip" } : { id: "low", label: "Long shot" };
}
