import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const BENEFITS = ["Match winner predictions", "Full odds comparison", "Tracked accuracy by market"];

// props: { isVip, onSubscribe, onBack }
export function PremiumScreen({ isVip, onSubscribe, onBack }) {
  if (isVip) {
    return h("div", { className: "screen" }, [
      PageHeader({ title: "Premium", onBack }),
      h("div", { style: { padding: "24px 18px", textAlign: "center" } }, [
        h("i", { "data-lucide": "gem", "aria-hidden": "true", style: { width: "40px", height: "40px", color: "var(--accent)", margin: "0 auto 14px", display: "block" } }),
        text("div", { style: { fontWeight: "700", fontSize: "18px", marginBottom: "6px" } }, "You're a VIP member"),
        text("div", { style: { fontSize: "13px", color: "var(--text-muted)" } }, "Every tip, every market, unlocked."),
      ]),
    ]);
  }

  return h("div", { className: "screen" }, [
    PageHeader({ title: "Premium", onBack }),
    h("div", { style: { padding: "20px 18px" } }, [
      text("h2", { style: { margin: "0 0 14px", fontSize: "20px", fontWeight: "700" } }, "Unlock every tip"),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "9px", marginBottom: "20px", fontSize: "13px" } },
        BENEFITS.map((f) =>
          h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, [
            h("i", { "data-lucide": "check", "aria-hidden": "true", style: { width: "16px", height: "16px", color: "var(--primary)" } }),
            text("span", {}, f),
          ])
        )
      ),
      h("div", { style: { display: "flex", gap: "8px", marginBottom: "18px" } }, [
        h("div", { style: { flex: "1", border: "2px solid var(--accent)", borderRadius: "8px", padding: "12px", textAlign: "center" } }, [
          text("div", { className: "mono", style: { fontSize: "10px", color: "var(--text-muted)" } }, "12 MONTHS"),
          text("div", { className: "mono", style: { fontWeight: "600", fontSize: "18px" } }, "$59"),
        ]),
        h("div", { style: { flex: "1", border: "0.5px solid var(--border)", borderRadius: "8px", padding: "12px", textAlign: "center" } }, [
          text("div", { className: "mono", style: { fontSize: "10px", color: "var(--text-muted)" } }, "1 MONTH"),
          text("div", { className: "mono", style: { fontWeight: "600", fontSize: "18px" } }, "$9"),
        ]),
      ]),
      h(
        "button",
        {
          onClick: onSubscribe,
          style: { width: "100%", background: "var(--primary)", color: "#FFFFFF", border: "none", padding: "14px", borderRadius: "8px", fontWeight: "700", fontSize: "14px" },
        },
        "Subscribe"
      ),
    ]),
  ]);
}
