import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const TIERS = [
  { coins: 10, price: "$0.99" },
  { coins: 50, price: "$3.99" },
  { coins: 120, price: "$7.99", badge: "-10%" },
  { coins: 300, price: "$14.99", badge: "-20%" },
];

// props: { coins, onBuy, onBack }
export function CoinsScreen({ coins, onBuy, onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Coins", onBack }),
    h("div", { style: { padding: "24px 18px 8px", textAlign: "center" } }, [
      text("div", { style: { fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" } }, "YOUR BALANCE"),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" } }, [
        h("i", { "data-lucide": "coins", "aria-hidden": "true", style: { width: "26px", height: "26px", color: "var(--accent)" } }),
        text("span", { className: "mono", style: { fontSize: "32px", fontWeight: "700" } }, coins),
      ]),
    ]),
    text("div", { style: { padding: "18px 18px 8px", fontSize: "13px", fontWeight: "600" } }, "Top up"),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "0 18px 20px" } },
      TIERS.map((t) =>
        h(
          "button",
          {
            onClick: () => onBuy(t.coins),
            style: { position: "relative", border: "0.5px solid var(--border)", borderRadius: "10px", padding: "16px 10px", background: "var(--surface)", textAlign: "center" },
          },
          [
            t.badge
              ? text("span", { style: { position: "absolute", top: "8px", right: "8px", fontSize: "10px", color: "var(--accent)", fontWeight: "700" } }, t.badge)
              : null,
            h("i", { "data-lucide": "coins", "aria-hidden": "true", style: { width: "20px", height: "20px", color: "var(--text-muted)", margin: "0 auto 8px", display: "block" } }),
            text("div", { className: "mono", style: { fontSize: "16px", fontWeight: "700" } }, t.coins),
            text("div", { className: "mono", style: { fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" } }, t.price),
          ]
        )
      )
    ),
    text("div", { style: { padding: "0 18px", fontSize: "11px", color: "var(--text-muted)" } }, "Coins unlock a single tip's result without a VIP subscription. This is a prototype — no real payment is processed."),
  ]);
}
