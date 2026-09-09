import { h, text } from "../utils/h.js";
import { matches, trackRecord } from "../data/mockData.js";

// props: { isVip, isUnlocked } — isUnlocked(matchId) checks VIP OR a coin-unlocked match
export function VipTipsScreen({ isVip, isUnlocked }) {
  return h("div", { className: "screen", style: { padding: "18px" } }, [
    text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "4px" } }, "VIP tips"),
    h("div", { className: "mono", style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px" } }, [
      text("span", {}, "LAST 30 TIPS \u00b7 "),
      text("span", { style: { color: "var(--accent)" } }, `${trackRecord.overall}% HIT RATE`),
    ]),
    h(
      "div",
      { style: { display: "flex", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)", marginBottom: "16px" } },
      trackRecord.byMarket.map((m, i) =>
        h(
          "div",
          {
            style: {
              flex: "1",
              padding: "10px 0",
              textAlign: "center",
              borderRight: i < trackRecord.byMarket.length - 1 ? "0.5px solid var(--border)" : "none",
            },
          },
          [
            text("div", { className: "mono", style: { fontSize: "10px", color: "var(--text-muted)" } }, m.label.toUpperCase()),
            text("div", { className: "mono", style: { fontSize: "17px", fontWeight: "600", color: m.pct >= 65 ? "var(--accent)" : "var(--danger)" } }, `${m.pct}%`),
          ]
        )
      )
    ),
    ...matches.map((m) =>
      h("div", { style: { borderBottom: "0.5px solid var(--border-soft)", padding: "12px 0" } }, [
        text("div", { className: "mono eyebrow", style: { marginBottom: "5px" } }, m.league),
        text("div", { style: { fontSize: "13px", marginBottom: "8px" } }, `${m.home} vs ${m.away}`),
        isUnlocked(m.id)
          ? text("div", { className: "mono", style: { fontWeight: "600", color: "var(--accent)" } }, `${m.winner} \u00b7 ${m.confidence}%`)
          : h("div", { className: "mono", style: { filter: "blur(5px)" } }, [text("span", { style: { fontWeight: "600" } }, `${m.winner} \u00b7 ${m.confidence}%`)]),
      ])
    ),
  ]);
}
