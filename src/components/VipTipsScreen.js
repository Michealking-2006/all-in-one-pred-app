import { h, text } from "../utils/h.js";
import { matches, trackRecord } from "../data/mockData.js";

// props: { isVip, isUnlocked } — isUnlocked(matchId) checks VIP OR a coin-unlocked match
export function VipTipsScreen({ isVip, isUnlocked }) {
  return h("div", { className: "screen", style: { padding: "18px" } }, [
    text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "2px" } }, "VIP tips"),
    h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "18px" } }, [
      text("span", { style: { fontSize: "13px", color: "var(--text-muted)" } }, "Last 30 tips:"),
      text("span", { className: "mono", style: { fontSize: "13px", fontWeight: "700", color: "var(--accent)" } }, `${trackRecord.overall}% hit rate`),
    ]),
    h(
      "div",
      { style: { display: "flex", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)", marginBottom: "20px" } },
      trackRecord.byMarket.map((m, i) =>
        h(
          "div",
          { style: { flex: "1", padding: "12px 4px", textAlign: "center", borderRight: i < trackRecord.byMarket.length - 1 ? "0.5px solid var(--border)" : "none" } },
          [
            text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" } }, m.label),
            text("div", { className: "mono", style: { fontSize: "17px", fontWeight: "700", color: m.pct >= 65 ? "var(--accent)" : "var(--danger)" } }, `${m.pct}%`),
          ]
        )
      )
    ),
    ...matches.map((m) =>
      h("div", { style: { borderBottom: "0.5px solid var(--border-soft)", padding: "13px 0" } }, [
        text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" } }, m.league),
        text("div", { style: { fontSize: "13px", marginBottom: "8px" } }, `${m.home} vs ${m.away}`),
        isUnlocked(m.id)
          ? h("div", { style: { display: "flex", alignItems: "baseline", gap: "8px" } }, [
              text("span", { style: { fontWeight: "700", fontSize: "14px", color: "var(--accent)" } }, m.winner),
              text("span", { className: "mono", style: { fontSize: "12px", color: "var(--text-muted)" } }, `${m.confidence}% confidence`),
            ])
          : h("div", { style: { filter: "blur(5px)" } }, [text("span", { style: { fontWeight: "700", fontSize: "14px" } }, `${m.winner} \u2014 ${m.confidence}% confidence`)]),
      ])
    ),
  ]);
}
