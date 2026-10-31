import { h, text } from "../utils/h.js";
import { pickLabel } from "../predictions/engine.js";
import { predictionLock } from "./PredictionLock.js";
import { kickoffTime } from "../utils/fixtures.js";

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

// The safer pick, when the model rates one at 80% or more. Not every match has one, and the hit rate is tracked on its own.
function safeLine(prediction, fx) {
  const s = prediction.safe;
  if (!s) return null;
  const home = fx.teams?.home?.name || "Home", away = fx.teams?.away?.name || "Away";
  const label = { "1x": `${home} or draw`, x2: `${away} or draw`, over15: "Over 1.5 goals", under35: "Under 3.5 goals" }[s.market];
  return label ? h("div", { className: "pred-safe" }, [text("span", { className: "eyebrow" }, "Safer pick"), text("strong", {}, label), text("span", { className: "pred-fact" }, s.prob + "% chance")]) : null;
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
    safeLine(prediction, fx),
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

// A compact row for the premium feed: league and confidence, the two teams with their crests around the kick-off time,
// then either the pick (with its odds in plain words) and the outcome bar, or the lock.
const LEVEL = { high: 3, medium: 2, low: 1 };
const crest = (team) => (team?.logo ? h("img", { className: "pred-crest", src: team.logo, alt: "", width: 36, height: 36, loading: "lazy", decoding: "async" }) : h("span", { className: "pred-crest pred-crest-blank", "aria-hidden": "true" }));
const side = (team, fallback) => h("div", { className: "pred-team" }, [crest(team), text("span", {}, team?.name || fallback)]);
function confidenceChip(level) {
  if (!CONFIDENCE[level]) return null;
  return h("span", { className: "pred-conf pred-conf-" + level }, [
    h("span", { className: "pred-meter", "aria-hidden": "true" }, [1, 2, 3].map((n) => h("i", { className: n <= LEVEL[level] ? "on" : "" }))),
    text("span", {}, CONFIDENCE[level]),
  ]);
}

export function PredictionRow(prediction, fx, { locked = false } = {}) {
  const league = fx.league || {};
  return h("article", { className: "vip-card pred-row " + (locked ? "locked" : "unlocked") }, [
    h("div", { className: "vip-card-top" }, [
      h("span", { className: "pred-league" }, [league.logo ? h("img", { className: "pred-league-logo", src: league.logo, alt: "", width: 16, height: 16, loading: "lazy", decoding: "async" }) : null, text("span", {}, league.name || "")]),
      confidenceChip(prediction.confidence),
    ]),
    h("div", { className: "pred-matchup", "aria-label": `${fx.teams?.home?.name} vs ${fx.teams?.away?.name}` }, [
      side(fx.teams?.home, "Home"),
      h("div", { className: "pred-time" }, [text("strong", {}, kickoffTime(fx.fixture?.date)), text("span", {}, "kick-off")]),
      side(fx.teams?.away, "Away"),
    ]),
    locked
      ? h("div", {}, [h("div", { className: "vip-lock" }, [h("i", { "data-lucide": "lock" }), text("span", {}, "Prediction locked")]), predictionLock(fx.fixture?.id)])
      : h("div", {}, [
          h("div", { className: "vip-pick" }, [
            text("span", { className: "eyebrow" }, "Model pick"),
            text("strong", {}, pickLabel(prediction, fx)),
            h("div", { className: "pred-facts" }, [
              text("span", { className: "pred-fact" }, prediction.pickProb + "% chance"),
              text("span", { className: "pred-fact" }, "Expected goals " + prediction.xg.home.toFixed(1) + " to " + prediction.xg.away.toFixed(1)),
            ]),
          ]),
          bar(prediction.probs, fx),
          safeLine(prediction, fx),
        ]),
  ]);
}
