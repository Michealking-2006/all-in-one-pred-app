import { h, text } from "../utils/h.js";
import { pickLabel } from "../predictions/engine.js";
import { predictionLock } from "./PredictionLock.js";

const CONFIDENCE = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

function bar(probs, fx) {
  const seg = (key, label) => h("div", { className: "pred-seg pred-" + key, style: { flexGrow: String(Math.max(probs[key], 6)) }, "aria-label": `${label} ${probs[key]} percent` }, [
    text("strong", { className: "mono" }, probs[key] + "%"),
    text("span", {}, label),
  ]);
  return h("div", { className: "pred-bar", role: "group", "aria-label": "Outcome probabilities" }, [
    seg("home", fx.teams?.home?.name || "Home"),
    seg("draw", "Draw"),
    seg("away", fx.teams?.away?.name || "Away"),
  ]);
}

const stat = (label, value) => h("div", { className: "pred-stat" }, [text("span", {}, label), text("strong", { className: "mono" }, value)]);

// The full prediction for one match (match page).
export function PredictionCard(prediction, fx) {
  const { likelyScore, xg } = prediction;
  const d = prediction.drivers;
  return h("section", { className: "prediction-card-v2 card" }, [
    h("div", { className: "pred-head" }, [
      text("span", { className: "section-kicker" }, "Scoutwave model"),
      text("span", { className: "pred-conf pred-conf-" + prediction.confidence }, CONFIDENCE[prediction.confidence]),
    ]),
    h("div", { className: "pred-pick" }, [text("span", {}, "Most likely"), text("strong", {}, pickLabel(prediction, fx) + (prediction.pick === "draw" ? "" : " to win"))]),
    bar(prediction.probs, fx),
    h("div", { className: "pred-stats" }, [
      stat("Likely score", likelyScore.home + " \u2013 " + likelyScore.away),
      stat("Expected goals", xg.home.toFixed(1) + " \u2013 " + xg.away.toFixed(1)),
      stat("Over 2.5 goals", prediction.over25 + "%"),
      stat("Both teams score", prediction.btts + "%"),
    ]),
    h("div", { className: "pred-why" }, [
      text("strong", {}, "Why"),
      h("ul", {}, [
        text("li", {}, `${fx.teams?.home?.name} score ${d.homeScoring} goals per home game; ${fx.teams?.away?.name} concede ${d.awayConceding} away.`),
        text("li", {}, `${fx.teams?.away?.name} score ${d.awayScoring} per away game; ${fx.teams?.home?.name} concede ${d.homeConceding} at home.`),
        text("li", {}, `League average: ${prediction.basis.leagueAvgHome} home goals and ${prediction.basis.leagueAvgAway} away goals per game.` + (prediction.basis.formUsed ? " Recent form is included." : "")),
      ]),
    ]),
    text("p", { className: "pred-disclaimer" }, "A statistical estimate from this season's results, not a guarantee and not betting advice."),
  ]);
}

// The match page when the pick is locked: what it would show, how sure the model is, and how to unlock it.
export function PredictionLockedCard(prediction, fx) {
  const conf = CONFIDENCE[prediction?.confidence];
  return h("section", { className: "prediction-card-v2 card pred-locked" }, [
    h("div", { className: "pred-head" }, [
      text("span", { className: "section-kicker" }, "Scoutwave model"),
      conf ? text("span", { className: "pred-conf pred-conf-" + prediction.confidence }, conf) : null,
    ]),
    h("div", { className: "pred-locked-body" }, [
      h("div", { className: "pred-locked-lock", "aria-hidden": "true" }, [h("i", { "data-lucide": "lock" })]),
      text("strong", {}, "This pick is for Premium members"),
      text("p", {}, `Most likely result, win chances, likely score and expected goals for ${fx.teams?.home?.name || "the home side"} v ${fx.teams?.away?.name || "the away side"}.`),
    ]),
    predictionLock(fx.fixture?.id),
  ]);
}

// A compact row for the premium feed.
export function PredictionRow(prediction, fx, { locked = false } = {}) {
  return h("article", { className: "vip-card pred-row " + (locked ? "locked" : "unlocked") }, [
    h("div", { className: "vip-card-top" }, [
      text("span", { className: "eyebrow" }, fx.league?.name || ""),
      CONFIDENCE[prediction.confidence] ? text("span", { className: "pred-conf pred-conf-" + prediction.confidence }, CONFIDENCE[prediction.confidence]) : null,
    ]),
    text("strong", { className: "vip-match" }, `${fx.teams?.home?.name} vs ${fx.teams?.away?.name}`),
    locked
      ? h("div", {}, [h("div", { className: "vip-lock" }, [h("i", { "data-lucide": "lock" }), text("span", {}, "Prediction locked")]), predictionLock(fx.fixture?.id)])
      : h("div", {}, [
          h("div", { className: "vip-pick" }, [text("span", { className: "eyebrow" }, "Model pick"), text("strong", {}, pickLabel(prediction, fx)), text("span", { className: "confidence" }, prediction.pickProb + "% \u00b7 xG " + prediction.xg.home.toFixed(1) + "\u2013" + prediction.xg.away.toFixed(1))]),
          bar(prediction.probs, fx),
        ]),
  ]);
}
