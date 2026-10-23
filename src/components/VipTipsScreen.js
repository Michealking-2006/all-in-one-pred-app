import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { isFeatureOn } from "../features.js";
import { getFixturesByDate } from "../api/footballApi.js";
import { localDateISO } from "../utils/fixtures.js";
import { predictFixture, serverAccuracy } from "../predictions/engine.js";
import { accuracySummary, gradeFixtures } from "../predictions/tracker.js";
import { PredictionRow } from "./PredictionCard.js";
import { SkeletonRow } from "./Skeleton.js";

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

// Server-tracked accuracy (all matches, shown once enough are graded) replaces the on-device figure.
function accuracyCard() {
  const holder = h("div", {}, []);
  const local = accuracySummary();
  if (local.total) holder.append(localAccuracyCard(local));
  serverAccuracy().then((a) => {
    if (!a) return;
    const pct = (v) => Math.round(v * 100) + "%";
    holder.replaceChildren(h("section", { className: "card pred-accuracy" }, [
      text("span", { className: "section-kicker" }, "Tracked accuracy"),
      h("div", { className: "pred-stats" }, [
        h("div", { className: "pred-stat" }, [text("span", {}, "Winner picks"), text("strong", { className: "mono" }, pct(a.winnerAccuracy))]),
        h("div", { className: "pred-stat" }, [text("span", {}, "Over/under 2.5"), text("strong", { className: "mono" }, pct(a.overUnderAccuracy))]),
        h("div", { className: "pred-stat" }, [text("span", {}, "Matches graded"), text("strong", { className: "mono" }, String(a.sample))]),
      ]),
    ]));
  });
  return holder;
}

function localAccuracyCard(a) {
  return h("section", { className: "card pred-accuracy" }, [
    text("span", { className: "section-kicker" }, "Tracked accuracy"),
    h("div", { className: "pred-stats" }, [
      h("div", { className: "pred-stat" }, [text("span", {}, "Winner picks"), text("strong", { className: "mono" }, a.winnerAccuracy + "%")]),
      h("div", { className: "pred-stat" }, [text("span", {}, "Over/under 2.5"), text("strong", { className: "mono" }, a.overUnderAccuracy + "%")]),
      h("div", { className: "pred-stat" }, [text("span", {}, "Matches graded"), text("strong", { className: "mono" }, String(a.total))]),
    ]),
  ]);
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
    feed.replaceChildren(h("div", { className: "error-state", role: "alert" }, [text("p", {}, error?.message || "Predictions couldn't be loaded. Try again shortly.")]));
  });
  return { feed, count };
}

export function VipTipsScreen({ isUnlocked }) {
  const live = isFeatureOn("predictions");
  const model = live ? modelFeed(isUnlocked) : null;

  return h("main", { className: "screen vip-screen" }, [
    h("section", { className: "vip-hero" }, [
      text("span", { className: "section-kicker" }, "Scoutwave Premium"),
      text("h1", {}, "Sharper signals. Less noise."),
      text("p", {}, "Premium match intelligence, confidence levels and market signals."),
    ]),
    live
      ? h("section", { className: "card sample-notice" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Picks come from Scoutwave's own statistical model, built from this season's league results. They are estimates, not guarantees or betting advice.")])
      : h("section", { className: "card sample-notice" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Sample signals. The picks below are placeholder data while live predictions are being connected, and no results have been tracked yet.")]),
    live ? accuracyCard() : null,
    h("div", { className: "section-heading vip-heading" }, [
      h("div", {}, [text("span", { className: "section-kicker" }, "Premium feed"), text("h2", {}, live ? "Today's model picks" : "Sample signals")]),
      live ? model.count : text("span", { className: "muted-count" }, matches.length + " picks"),
    ]),
    live
      ? model.feed
      : h("div", { className: "vip-list" }, matches.map((m) =>
          h("article", { className: "vip-card " + (isUnlocked(m.id) ? "unlocked" : "locked") }, [
            h("div", { className: "vip-card-top" }, [text("span", { className: "eyebrow" }, m.league), text("span", { className: "badge badge-muted" }, m.confidence + "%")]),
            text("strong", { className: "vip-match" }, m.home + " vs " + m.away),
            isUnlocked(m.id)
              ? h("div", { className: "vip-pick" }, [text("span", { className: "eyebrow" }, "Signal"), text("strong", {}, m.winner), text("span", { className: "confidence" }, m.confidence + "% confidence")])
              : h("div", { className: "vip-lock" }, [h("i", { "data-lucide": "lock" }), text("span", {}, "Premium signal locked")]),
          ])
        )),
  ]);
}
