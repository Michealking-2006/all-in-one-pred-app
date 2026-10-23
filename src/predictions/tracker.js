// Remembers every prediction the model made before kick-off and grades it when
// the match is over, so accuracy can be reported honestly ("tracked accuracy")
// instead of claimed. Stored on this device for now; the record shape is
// deliberately flat so it can move to a server table unchanged.
import { MODEL_VERSION } from "./model.js";

const KEY = "scoutwave.predictions.v1";
const MAX_RECORDS = 500;
const FINISHED = new Set(["FT", "AET", "PEN"]);

function load() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function save(records) {
  try {
    const entries = Object.entries(records);
    if (entries.length > MAX_RECORDS) {
      entries.sort((a, b) => (b[1].kickoff || 0) - (a[1].kickoff || 0));
      records = Object.fromEntries(entries.slice(0, MAX_RECORDS));
    }
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch { /* storage full or blocked: tracking is best-effort */ }
}

// Only genuine pre-match predictions count: one per fixture and model version.
export function recordPrediction(fx, prediction) {
  const id = fx?.fixture?.id;
  const kickoff = new Date(fx?.fixture?.date).getTime();
  if (!id || !prediction || !Number.isFinite(kickoff) || kickoff <= Date.now()) return false;
  const records = load();
  const existing = records[id];
  if (existing && existing.model === prediction.model) return false;
  records[id] = {
    id, model: prediction.model || MODEL_VERSION, madeAt: Date.now(), kickoff,
    homeId: fx.teams?.home?.id, awayId: fx.teams?.away?.id,
    probs: prediction.probs, pick: prediction.pick, over25: prediction.over25, btts: prediction.btts, xg: prediction.xg,
  };
  save(records);
  return true;
}

// The regular-time result (extra time and penalties don't count for 1X2).
function resultOf(fx) {
  const ft = fx?.score?.fulltime;
  const home = ft?.home ?? fx?.goals?.home;
  const away = ft?.away ?? fx?.goals?.away;
  return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
}

export function gradeFixtures(fixtures) {
  const records = load();
  let changed = 0;
  for (const fx of Array.isArray(fixtures) ? fixtures : []) {
    const record = records[fx?.fixture?.id];
    if (!record || record.result || !FINISHED.has(fx.fixture?.status?.short)) continue;
    const result = resultOf(fx);
    if (!result) continue;
    const outcome = result.home > result.away ? "home" : result.home < result.away ? "away" : "draw";
    record.result = {
      ...result, outcome,
      pickCorrect: record.pick === outcome,
      overCorrect: (record.over25 >= 50) === (result.home + result.away > 2),
      bttsCorrect: (record.btts >= 50) === (result.home > 0 && result.away > 0),
      // Brier score for the 1X2 probabilities (lower is better; 0.667 = always guessing 1/3 each).
      brier: ["home", "draw", "away"].reduce((sum, k) => sum + ((record.probs[k] / 100) - (k === outcome ? 1 : 0)) ** 2, 0),
    };
    changed++;
  }
  if (changed) save(records);
  return changed;
}

export function accuracySummary() {
  const graded = Object.values(load()).filter((r) => r.result);
  const total = graded.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : null);
  return {
    total,
    pending: Object.values(load()).filter((r) => !r.result).length,
    winnerAccuracy: pct(graded.filter((r) => r.result.pickCorrect).length),
    overUnderAccuracy: pct(graded.filter((r) => r.result.overCorrect).length),
    bttsAccuracy: pct(graded.filter((r) => r.result.bttsCorrect).length),
    avgBrier: total ? Math.round((graded.reduce((s, r) => s + r.result.brier, 0) / total) * 1000) / 1000 : null,
  };
}

export function resetTracker() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
