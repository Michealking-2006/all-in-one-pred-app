// The prediction inside a match row: the three outcomes with their chances (the pick filled in), the likely score,
// and, once the match is over, whether the pick was right. For someone who hasn't unlocked it, a quiet lock with how
// sure the model is (never the pick or any number). Built from what the server has stored: nothing here asks the
// football data service for anything.
import { h, text } from "../utils/h.js";
import { isFinished } from "../utils/fixtures.js";

const OUTCOMES = [["home", "1"], ["draw", "X"], ["away", "2"]];
const LEVEL = { high: 3, medium: 2, low: 1 };
const WORD = { high: "high", medium: "medium", low: "low" };

// Who won over 90 minutes (what predictions are graded on), or null while it isn't known.
export function outcomeOf(fx) {
  const ft = fx?.score?.fulltime;
  const home = Number.isFinite(ft?.home) ? ft.home : fx?.goals?.home, away = Number.isFinite(ft?.away) ? ft.away : fx?.goals?.away;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return home > away ? "home" : home < away ? "away" : "draw";
}

// One sentence for screen readers (the row is a single button, so the strip itself is hidden from them).
export function predictionSummary(prediction, fx) {
  if (!prediction) return "";
  if (prediction.locked) return "Premium prediction" + (WORD[prediction.confidence] ? `, ${WORD[prediction.confidence]} confidence` : "");
  const home = fx?.teams?.home?.name || "Home", away = fx?.teams?.away?.name || "Away";
  const who = prediction.pick === "draw" ? "a draw" : prediction.pick === "home" ? home : away;
  const chance = prediction.probs?.[prediction.pick];
  const actual = isFinished(fx?.fixture?.status?.short) ? outcomeOf(fx) : null;
  return `Prediction: ${who}${chance != null ? `, ${chance} percent` : ""}${actual ? (actual === prediction.pick ? ", correct" : ", missed") : ""}`;
}

const meter = (level) => h("span", { className: "pred-meter pred-conf-" + level, "aria-hidden": "true" }, [1, 2, 3].map((n) => h("i", { className: n <= LEVEL[level] ? "on" : "" })));

export function PredictionStrip(prediction, fx) {
  if (!prediction) return null;
  if (prediction.locked) {
    return h("div", { className: "pred-strip is-locked", "aria-hidden": "true" }, [
      h("span", { className: "ps-lock" }, [h("i", { "data-lucide": "lock", style: { width: "12px", height: "12px" } }), text("span", {}, "Premium pick")]),
      LEVEL[prediction.confidence] ? meter(prediction.confidence) : null,
    ]);
  }
  const probs = prediction.probs;
  if (!probs || !prediction.pick) return null;
  const actual = isFinished(fx?.fixture?.status?.short) ? outcomeOf(fx) : null;
  const score = prediction.likelyScore;
  return h("div", { className: "pred-strip", "aria-hidden": "true" }, [
    ...OUTCOMES.map(([key, label]) => {
      const picked = prediction.pick === key;
      const verdict = picked && actual ? (actual === key ? " hit" : " miss") : "";
      return h("span", { className: "ps-chip" + (picked ? " is-pick" : "") + verdict }, [text("b", {}, label), text("span", {}, probs[key] + "%")]);
    }),
    score && Number.isFinite(score.home) ? h("span", { className: "ps-score", title: "Likely score" }, [text("small", {}, "Pred"), text("span", {}, score.home + "\u2013" + score.away)]) : null,
    actual ? h("span", { className: "ps-result " + (actual === prediction.pick ? "hit" : "miss") }, [h("i", { "data-lucide": actual === prediction.pick ? "circle-check" : "x", style: { width: "15px", height: "15px" } })]) : null,
  ]);
}
