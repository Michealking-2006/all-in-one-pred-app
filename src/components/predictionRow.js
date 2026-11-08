// Adds a match row's stored prediction under its team names. Loaded on demand by MatchRow, so the match list itself
// starts without any of this. Only our own server is asked; rows without a stored prediction are left untouched.
import { isFeatureOn } from "../features.js";

// Ask for a row's prediction only when it is about to be seen, so a long day's list doesn't ask about every match at once.
let watcher = null;
const waiting = new WeakMap();
function whenNear(el, run) {
  if (typeof IntersectionObserver === "undefined") return run();
  watcher ||= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      watcher.unobserve(entry.target);
      const fn = waiting.get(entry.target); waiting.delete(entry.target); fn?.();
    }
  }, { rootMargin: "320px 0px" });
  waiting.set(el, run); watcher.observe(el);
}

// The stored prediction for this match, set into the row once it arrives. Rows without one stay exactly as they were.
export function showPrediction(row, fx, label) {
  const main = row.children[0]; // the row's button
  if (!isFeatureOn("predictions")) return; // switched off: the row asks for nothing
  whenNear(row, () => {
    // the prediction code loads on first use, so the list itself starts without it
    Promise.all([import("../predictions/engine.js"), import("./PredictionStrip.js")]).then(async ([engine, ui]) => {
      const prediction = await engine.predictFixture(fx);
      const strip = ui.PredictionStrip(prediction, fx);
      if (!strip) return;
      main.append(strip);
      main.setAttribute("aria-label", label + ". " + ui.predictionSummary(prediction, fx));
    }).catch(() => {}); // a missing prediction is never an error on the list
  });
}

