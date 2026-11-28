import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";
import { isFeatureOn } from "../features.js";
import { listPredicted, serverAccuracy } from "../predictions/engine.js";
import { accuracySummary } from "../predictions/tracker.js";
import { PredictionRow } from "./PredictionCard.js";
import { SkeletonRow } from "./Skeleton.js";
import { safeMessage } from "../utils/errors.js";

const MAX_PICKS = 12;

// Today's not-yet-started matches that Scoutwave has predicted, listed by our own server (no football data service).
function loadModelFeed() {
  const today = new Date().toDateString();
  return listPredicted(1).then((items) => items
    .filter(({ fx }) => new Date(fx.fixture.date).toDateString() === today && Date.parse(fx.fixture.date) > Date.now())
    // The server ranks every match it was asked about (even locked ones, without a number).
    .sort((a, b) => (a.prediction.order ?? 999) - (b.prediction.order ?? 999) || (b.prediction.pickProb ?? 0) - (a.prediction.pickProb ?? 0)).slice(0, MAX_PICKS));
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

// Predictions | Slip Generator. The generator loads only when its tab is opened.
function slipTab({ isVip, onRequestUpgrade }) {
  const slot = h("div", { className: "slip-slot" });
  let loaded = false;
  return { slot, load: () => { if (loaded) return; loaded = true; slot.replaceChildren(SkeletonRow({ lines: 2 })); import("./SlipGenerator.js").then((m) => slot.replaceChildren(m.SlipGenerator({ isVip, onRequestUpgrade }))).catch(() => { loaded = false; slot.replaceChildren(h("div", { className: "error-state", role: "alert" }, [text("p", {}, "The slip generator couldn't be loaded. Try again shortly.")])); }); } };
}

export function VipTipsScreen({ isUnlocked, isVip = false, onRequestUpgrade = () => {} }) {
  const live = isFeatureOn("predictions");
  const model = live ? modelFeed(isUnlocked) : null;
  const slip = live ? slipTab({ isVip, onRequestUpgrade }) : null;
  const picksPanel = h("div", { className: "vip-panel" }, []);
  const tabs = live ? h("div", { className: "seg seg-wrap vip-tabs", role: "tablist", "aria-label": "Predictions" }, ["Predictions", "Slip Generator"].map((label, i) =>
    h("button", { type: "button", role: "tab", "aria-selected": String(i === 0), className: i === 0 ? "active" : "", onClick: (e) => {
      for (const b of e.currentTarget.parentNode.children) { const on = b === e.currentTarget; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); }
      picksPanel.hidden = i === 1; slip.slot.hidden = i === 0;
      if (i === 1) slip.load();
    } }, label)
  )) : null;
  if (slip) slip.slot.hidden = true;
  picksPanel.append(...[
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
        ))
  ].filter(Boolean));

  return h("main", { className: "screen vip-screen" }, [
    h("section", { className: "vip-hero" }, [
      text("span", { className: "section-kicker" }, "Scoutwave Premium"),
      text("h1", {}, "Today's predictions"),
      text("p", {}, "Our model's prediction and confidence for each match."),
    ]),
    live ? null : h("section", { className: "card sample-notice" }, [h("i", { "data-lucide": "info" }), text("span", {}, "Sample picks. The picks below are placeholder data while live predictions are being connected, and no results have been tracked yet.")]),
    tabs,
    h("div", { className: "vip-panel-wrap" }, [picksPanel, slip ? slip.slot : null]),
  ]);
}
