import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { isFeatureOn } from "../features.js";
import { getFixturesByDate } from "../api/footballApi.js";
import { localDateISO } from "../utils/fixtures.js";
import { predictFixture, serverAccuracy } from "../predictions/engine.js";
import { accuracySummary, gradeFixtures } from "../predictions/tracker.js";
import { PredictionRow } from "./PredictionCard.js";
import { SkeletonRow } from "./Skeleton.js";
import { safeMessage } from "../utils/errors.js";

const MAX_PICKS = 12;

// Today's not-yet-started matches in competitions that have a league table,
// predicted by Scoutwave's own model. One standings request per competition.
function loadModelFeed() {
  return getFixturesByDate(localDateISO()).then((rows) => {
    gradeFixtures(rows);
    const upcoming = rows.filter((fx) => fx.fixture?.status?.short === "NS" && new Date(fx.fixture.date).getTime() > Date.now());
    return Promise.allSettled(upcoming.slice(0, 40).map((fx) => predictFixture(fx).then((prediction) => ({ fx, prediction }))))
      .then((results) => results.filter((r) => r.status === "fulfilled" && r.value.prediction).map((r) => r.value)
        // The server ranks every match it was asked about (even locked ones, without a number); on-device picks have no rank.
        .sort((a, b) => (a.prediction.order ?? 999) - (b.prediction.order ?? 999) || (b.prediction.pickProb ?? 0) - (a.prediction.pickProb ?? 0)).slice(0, MAX_PICKS));
  });
}

// Tracked accuracy: three plain numbers. Server-tracked (all matches, shown once enough are graded) replaces the on-device figure.
function accuracyCard(rows) {
  const stat = (label, value) => h("div", { className: "pred-stat" }, [text("span", {}, label), text("strong", { className: "mono" }, value)]);
  return h("section", { className: "card pred-accuracy" }, [
    h("div", { className: "pred-accuracy-head" }, [text("span", { className: "section-kicker" }, "Tracked accuracy"), text("p", {}, "Every pick is saved before kick-off and graded after the match.")]),
    h("div", { className: "pred-stats" + (rows.length > 3 ? " pred-stats-4" : "") }, rows.map(([label, value]) => stat(label, value))),
  ]);
}

function accuracySection() {
  const holder = h("div", {}, []);
  const local = accuracySummary();
  if (local.total) holder.append(accuracyCard([["Winner picks", local.winnerAccuracy + "%"], ["Over/under 2.5", local.overUnderAccuracy + "%"], ["Matches graded", String(local.total)]]));
  serverAccuracy().then((a) => {
    if (!a) return;
    const pct = (v) => Math.round(v * 100) + "%";
    // The safer-pick figure is shown only once it rests on enough picks to mean something.
    const safe = a.safeN >= 30 && a.safeAccuracy != null ? [["Safer picks", pct(a.safeAccuracy)]] : [];
    holder.replaceChildren(accuracyCard([["Winner picks", pct(a.winnerAccuracy)], ["Over/under 2.5", pct(a.overUnderAccuracy)], ...safe, ["Matches graded", String(a.sample)]]));
  });
  return holder;
}

function modelFeed(isUnlocked) {
  const feed = h("div", { className: "vip-list" }, [SkeletonRow({ lines: 2 }), SkeletonRow({ lines: 2 })]);
  const count = text("span", { className: "muted-count" }, "");
  loadModelFeed().then((items) => {
    count.textContent = items.length + (items.length === 1 ? " pick" : " picks");
    feed.replaceChildren(...(items.length
      ? items.map(({ fx, prediction }) => PredictionRow(prediction, fx, { locked: prediction.locked === true || !isUnlocked(fx.fixture.id) }))
      : [h("div", { className: "empty-state" }, "No predictable matches left today. Check back tomorrow.")]));
  }).catch((error) => {
    feed.replaceChildren(h("div", { className: "error-state", role: "alert" }, [text("p", {}, safeMessage(error, "Predictions couldn't be loaded. Try again shortly."))]));
  });
  return { feed, count };
}

export function VipTipsScreen({ isUnlocked }) {
  const live = isFeatureOn("predictions");
  const model = live ? modelFeed(isUnlocked) : null;

  return h("main", { className: "screen vip-screen" }, [
    h("section", { className: "vip-hero" }, [
      text("span", { className: "section-kicker" }, "Scoutwave Premium"),
      text("h1", {}, "Today's predictions"),
      text("p", {}, "Our model's prediction and confidence for each match."),
    ]),
    live ? null : h("section", { className: "card sample-notice" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Sample picks. The picks below are placeholder data while live predictions are being connected, and no results have been tracked yet.")]),
    live ? accuracySection() : null,
    h("div", { className: "section-heading vip-heading" }, [
      h("div", {}, [text("span", { className: "section-kicker" }, "Predictions"), text("h2", {}, live ? "Today's model picks" : "Sample picks")]),
      live ? model.count : text("span", { className: "muted-count" }, matches.length + " picks"),
    ]),
    live
      ? h("div", {}, [model.feed, h("p", { className: "pred-footnote" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Picks come from Scoutwave's own statistical model, built from this season's league results. They are estimates, not guarantees or betting advice.")])])
      : h("div", { className: "vip-list" }, matches.map((m) =>
          h("article", { className: "vip-card " + (isUnlocked(m.id) ? "unlocked" : "locked") }, [
            h("div", { className: "vip-card-top" }, [text("span", { className: "eyebrow" }, m.league), text("span", { className: "badge badge-muted" }, m.confidence + "%")]),
            text("strong", { className: "vip-match" }, m.home + " vs " + m.away),
            isUnlocked(m.id)
              ? h("div", { className: "vip-pick" }, [text("span", { className: "eyebrow" }, "Pick"), text("strong", {}, m.winner), text("span", { className: "confidence" }, m.confidence + "% confidence")])
              : h("div", { className: "vip-lock" }, [h("i", { "data-lucide": "lock" }), text("span", {}, "Prediction locked")]),
          ])
        )),
  ]);
}
