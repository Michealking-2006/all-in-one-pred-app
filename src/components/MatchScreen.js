import { h, text } from "../utils/h.js";
import { OddsTable } from "./OddsTable.js";
import { PredictionsPanel } from "./PredictionsPanel.js";

const TABS = ["summary", "predictions", "odds", "lineup", "standings"];

// props: { match, matchTab, isVip, coins, isFavorite, onBack, onTabChange, onRequestUpgrade, onUnlockWithCoins, onToggleFavorite }
// note: "isVip" here means "this match's winner is unlocked" — either via a real
// VIP subscription or a one-off coin spend, PredictionsPanel doesn't need to care which
export function MatchScreen({ match, matchTab, isVip, coins, isFavorite, onBack, onTabChange, onRequestUpgrade, onUnlockWithCoins, onToggleFavorite }) {
  const tabBar = h(
    "div",
    { style: { display: "flex", overflowX: "auto", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" } },
    TABS.map((t) =>
      h(
        "button",
        {
          onClick: () => onTabChange(t),
          style: {
            flex: "0 0 auto",
            whiteSpace: "nowrap",
            padding: "11px 16px",
            border: "none",
            background: "none",
            fontSize: "13px",
            fontWeight: "500",
            borderBottom: `2px solid ${matchTab === t ? "var(--accent)" : "transparent"}`,
            color: matchTab === t ? "var(--text)" : "var(--text-muted)",
          },
        },
        t.charAt(0).toUpperCase() + t.slice(1)
      )
    )
  );

  let panel;
  if (matchTab === "summary") {
    panel = h("div", { style: { padding: "18px" } }, [
      h("div", { style: { marginBottom: "20px" } }, [
        text("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--text-dim)", marginBottom: "6px" } }, "Head to head"),
        text("div", { style: { fontSize: "13px", lineHeight: "1.5", color: "var(--text-dim)" } }, match.h2h),
      ]),
      h("div", {}, [
        text("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--text-dim)", marginBottom: "8px" } }, "Form"),
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" } }, [
          text("span", {}, match.home),
          text("span", { className: "mono" }, match.form.home.join(" ")),
        ]),
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "13px" } }, [
          text("span", {}, match.away),
          text("span", { className: "mono" }, match.form.away.join(" ")),
        ]),
      ]),
    ]);
  } else if (matchTab === "predictions") {
    panel = PredictionsPanel({ match, isUnlocked: isVip, coins, onRequestUpgrade, onUnlockWithCoins });
  } else if (matchTab === "odds") {
    panel = OddsTable({ match });
  } else if (matchTab === "lineup") {
    panel = lineupPanel(match);
  } else {
    panel = standingsPanel(match);
  }

  return h("div", { className: "screen" }, [
    h("div", { style: { background: "var(--accent)", padding: "14px 18px 12px" } }, [
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
        h(
          "button",
          { "aria-label": "Back", onClick: onBack, style: { border: "none", background: "none", color: "var(--on-accent)", padding: "2px" } },
          [h("i", { "data-lucide": "arrow-left", "aria-hidden": "true", style: { width: "18px", height: "18px" } })]
        ),
        h("img", { src: "/src/assets/scoutwave-logo-light-a.png", alt: "Scoutwave", style: { height: "18px", width: "auto", display: "block" } }),
        h(
          "button",
          {
            "aria-label": isFavorite ? "Remove from favorites" : "Add to favorites",
            onClick: onToggleFavorite,
            style: { border: "none", background: "none", padding: "2px", color: "var(--on-accent)" },
          },
          [h("i", { "data-lucide": "star", "aria-hidden": "true", style: { width: "18px", height: "18px" }, fill: isFavorite ? "currentColor" : "none" })]
        ),
      ]),
    ]),
    h("div", { style: { padding: "12px 18px 0", textAlign: "center" } }, [
      text("span", { style: { fontSize: "13px", fontWeight: "600" } }, match.league),
      match.status === "live"
        ? h("span", { style: { display: "inline-flex", alignItems: "center", gap: "5px", marginLeft: "8px", color: "var(--accent)", fontSize: "12px", fontWeight: "700" } }, [
            h("span", { className: "live-dot", style: { width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", display: "inline-block" } }),
            text("span", {}, `${match.minute}'`),
          ])
        : text("span", { style: { fontSize: "12px", color: "var(--text-muted)" } }, match.time === "FT" ? " \u2014 full time" : ` \u2014 kicks off ${match.time}`),
    ]),
    h("div", { style: { padding: "14px 18px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      text("span", { style: { fontSize: "16px", fontWeight: "500" } }, match.home),
      text("span", { className: "mono", style: { fontSize: "28px", fontWeight: "600" } }, `${match.scoreH} \u2013 ${match.scoreA}`),
      text("span", { style: { fontSize: "16px", fontWeight: "500" } }, match.away),
    ]),
    tabBar,
    panel,
  ]);
}

function playerRow(p) {
  return h("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
    text("span", { className: "mono", style: { width: "22px", fontSize: "12px", color: "var(--text-muted)" } }, p.no),
    text("span", { style: { flex: "1", fontSize: "13px" } }, p.name),
    text("span", { style: { fontSize: "11px", color: "var(--text-muted)" } }, p.pos),
  ]);
}

function lineupPanel(match) {
  const { formation, home, away } = match.lineup;
  return h("div", { style: { padding: "18px" } }, [
    h("div", { style: { marginBottom: "22px" } }, [
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" } }, [
        text("div", { style: { fontSize: "13px", fontWeight: "600" } }, match.home),
        text("div", { className: "mono", style: { fontSize: "11px", color: "var(--text-muted)" } }, formation.home),
      ]),
      ...home.map(playerRow),
    ]),
    h("div", {}, [
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" } }, [
        text("div", { style: { fontSize: "13px", fontWeight: "600" } }, match.away),
        text("div", { className: "mono", style: { fontSize: "11px", color: "var(--text-muted)" } }, formation.away),
      ]),
      ...away.map(playerRow),
    ]),
  ]);
}

function standingsPanel(match) {
  const { leagueName, rows, highlight } = match.standings;
  return h("div", { style: { padding: "18px" } }, [
    text("div", { style: { fontSize: "13px", fontWeight: "600", marginBottom: "12px" } }, leagueName),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "6px", borderBottom: "0.5px solid var(--border)", fontSize: "11px", color: "var(--text-muted)" } },
      [
        text("div", { style: { width: "18px" } }, "#"),
        text("div", { style: { flex: "1" } }, "Team"),
        text("div", { style: { width: "24px", textAlign: "right" } }, "P"),
        text("div", { style: { width: "32px", textAlign: "right" } }, "Pts"),
      ]
    ),
    ...rows.map((row) => {
      const isHighlighted = highlight.includes(row.team);
      return h("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "0.5px solid var(--border-soft)" } }, [
        text("div", { className: "mono", style: { width: "18px", fontSize: "12px", color: "var(--text-muted)" } }, row.pos),
        text("div", { style: { flex: "1", fontSize: "13px", fontWeight: isHighlighted ? "700" : "400", color: isHighlighted ? "var(--accent)" : "var(--text)" } }, row.team),
        text("div", { className: "mono", style: { width: "24px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" } }, row.played),
        text("div", { className: "mono", style: { width: "32px", textAlign: "right", fontSize: "13px", fontWeight: "700" } }, row.points),
      ]);
    }),
  ]);
}
