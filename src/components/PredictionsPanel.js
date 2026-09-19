import { h, text } from "../utils/h.js";
import { UNLOCK_COST } from "../store.js";
export function PredictionsPanel({ match, isUnlocked, coins, onRequestUpgrade, onUnlockWithCoins }) {
  const canAfford = coins >= UNLOCK_COST;
  return h("section", { className: "prediction-panel" }, [
    h("div", { className: "prediction-card card" }, [
      h("div", { className: "prediction-card-heading" }, [text("div", { className: "section-kicker" }, "COMMUNITY VOTE"), text("span", { className: "prediction-total mono" }, "100%")]),
      h("div", { className: "vote-grid" }, [vote("HOME", match.votes.h), vote("DRAW", match.votes.d), vote("AWAY", match.votes.a)]),
    ]),
    h("div", { className: "prediction-card card " + (isUnlocked ? "unlocked" : "locked") }, [
      h("div", { className: "prediction-card-heading" }, [text("div", { className: "section-kicker" }, "PREDICTED WINNER"), h("span", { className: "vip-badge" }, [h("i", { "data-lucide": "gem" }), text("span", {}, "VIP")])]),
      isUnlocked
        ? h("div", { className: "prediction-result" }, [text("strong", {}, match.winner), text("span", { className: "confidence" }, match.confidence + "% confidence")])
        : h("div", { className: "prediction-locked" }, [
            text("strong", { className: "prediction-blurred" }, match.winner),
            text("p", {}, "Unlock the full signal to reveal the predicted winner."),
            h("div", { className: "prediction-actions" }, [
              h("button", { className: "primary-button", onClick: onRequestUpgrade }, [h("i", { "data-lucide": "gem" }), text("span", {}, "Unlock with VIP")]),
              h("button", { className: "secondary-button", disabled: !canAfford, onClick: canAfford ? onUnlockWithCoins : null }, [h("i", { "data-lucide": "coins" }), text("span", {}, "Use " + UNLOCK_COST + " coins")]),
            ]),
          ]),
    ]),
  ]);
}
function vote(label, pct) {
  return h("div", { className: "vote-cell" }, [text("span", {}, label), text("strong", { className: "mono" }, pct + "%"), h("div", { className: "vote-track" }, [h("span", { style: { width: pct + "%" } })])]);
}