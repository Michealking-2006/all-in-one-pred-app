import { h, text } from "../utils/h.js";
import { matches } from "../data/mockData.js";

export function VipTipsScreen({ isUnlocked }) {
  return h("main", { className: "screen vip-screen" }, [
    h("section", { className: "vip-hero" }, [
      text("span", { className: "section-kicker" }, "Scoutwave Premium"),
      text("h1", {}, "Sharper signals. Less noise."),
      text("p", {}, "Premium match intelligence, confidence levels and market signals."),
    ]),
    h("section", { className: "card sample-notice" }, [
      h("i", { "data-lucide": "info" }),
      text("span", {}, "Sample signals. The picks below are placeholder data while live predictions are being connected, and no results have been tracked yet."),
    ]),
    h("div", { className: "section-heading vip-heading" }, [
      h("div", {}, [text("span", { className: "section-kicker" }, "Premium feed"), text("h2", {}, "Sample signals")]),
      text("span", { className: "muted-count" }, matches.length + " picks"),
    ]),
    h("div", { className: "vip-list" }, matches.map((m) =>
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
