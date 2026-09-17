import { h, text } from "../utils/h.js";

// props: { match }
export function OddsTable({ match }) {
  const bestH = Math.max(...match.odds.map((o) => o.h));
  const bestD = Math.max(...match.odds.map((o) => o.d));
  const bestA = Math.max(...match.odds.map((o) => o.a));

  const cellStyle = (val, best) => ({
    flex: "1",
    textAlign: "center",
    color: val === best ? "var(--accent)" : "var(--text-dim)",
    fontWeight: val === best ? "600" : "400",
  });

  return h("div", { style: { padding: "18px" } }, [
    h(
      "div",
      { className: "mono eyebrow", style: { display: "flex", paddingBottom: "8px", borderBottom: "0.5px solid var(--border)" } },
      [
        text("div", { style: { flex: "1.3" } }, "BOOKMAKER"),
        text("div", { style: { flex: "1", textAlign: "center" } }, "1"),
        text("div", { style: { flex: "1", textAlign: "center" } }, "X"),
        text("div", { style: { flex: "1", textAlign: "center" } }, "2"),
      ]
    ),
    ...match.odds.map((o) =>
      h(
        "div",
        { className: "mono", style: { display: "flex", padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)", fontSize: "13px" } },
        [
          text("div", { style: { flex: "1.3" } }, o.book),
          text("div", { style: cellStyle(o.h, bestH) }, o.h.toFixed(2)),
          text("div", { style: cellStyle(o.d, bestD) }, o.d.toFixed(2)),
          text("div", { style: cellStyle(o.a, bestA) }, o.a.toFixed(2)),
        ]
      )
    ),
    text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginTop: "10px" } }, "Amber = best price available"),
  ]);
}
