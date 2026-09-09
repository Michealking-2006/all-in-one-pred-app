import { h, text } from "../utils/h.js";
import { UNLOCK_COST } from "../store.js";

// props: { match, isUnlocked, coins, onRequestUpgrade, onUnlockWithCoins }
export function PredictionsPanel({ match, isUnlocked, coins, onRequestUpgrade, onUnlockWithCoins }) {
  const voteRow = h(
    "div",
    { style: { display: "flex", borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" } },
    [
      ["HOME", match.votes.h],
      ["DRAW", match.votes.d],
      ["AWAY", match.votes.a],
    ].map(([label, pct], i) =>
      h(
        "div",
        {
          style: {
            flex: "1",
            padding: "9px 0",
            textAlign: "center",
            borderRight: i < 2 ? "0.5px solid var(--border)" : "none",
          },
        },
        [
          text("div", { style: { fontSize: "10px", color: "var(--text-muted)" } }, label),
          text("div", { className: "mono", style: { fontWeight: "600" } }, `${pct}%`),
        ]
      )
    )
  );

  const canAffordCoins = coins >= UNLOCK_COST;

  const winnerBody = isUnlocked
    ? [
        text("div", { style: { fontSize: "18px", fontWeight: "700", color: "var(--accent)" } }, match.winner),
        text("div", { className: "mono", style: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" } }, `${match.confidence}% CONFIDENCE`),
      ]
    : [
        text("div", { style: { filter: "blur(5px)", fontSize: "18px", fontWeight: "700" } }, match.winner),
        h("div", { style: { marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" } }, [
          h(
            "button",
            {
              onClick: onRequestUpgrade,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: "none",
                background: "var(--accent-bg)",
                color: "var(--accent)",
                padding: "7px 12px",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
              },
            },
            [
              h("i", { "data-lucide": "lock", "aria-hidden": "true", style: { width: "13px", height: "13px" } }),
              text("span", {}, "UNLOCK WITH VIP"),
            ]
          ),
          h(
            "button",
            {
              onClick: canAffordCoins ? onUnlockWithCoins : null,
              disabled: !canAffordCoins,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: "0.5px solid var(--border)",
                background: "none",
                color: canAffordCoins ? "var(--text)" : "var(--text-muted)",
                padding: "7px 12px",
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                opacity: canAffordCoins ? "1" : "0.5",
              },
            },
            [
              h("i", { "data-lucide": "coins", "aria-hidden": "true", style: { width: "13px", height: "13px" } }),
              text("span", {}, `${UNLOCK_COST} COINS`),
            ]
          ),
        ]),
      ];

  return h("div", { style: { padding: "18px" } }, [
    h("div", { style: { marginBottom: "18px" } }, [
      text("div", { className: "mono eyebrow", style: { marginBottom: "8px" } }, "COMMUNITY VOTE"),
      voteRow,
    ]),
    h("div", { style: { border: "0.5px solid var(--border)", borderRadius: "8px", padding: "16px", position: "relative" } }, [
      text("span", { className: "mono", style: { position: "absolute", top: "14px", right: "14px", color: "var(--accent)", fontSize: "10px" } }, "VIP"),
      text("div", { className: "mono eyebrow", style: { marginBottom: "8px" } }, "PREDICTED WINNER"),
      ...winnerBody,
    ]),
  ]);
}
