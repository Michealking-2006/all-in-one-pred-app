import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";
import { faqItems } from "../data/mockData.js";

// props: { onBack }
export function HelpCentreScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Help centre", onBack }),
    ...faqItems.map((item) =>
      h("details", { style: { padding: "14px 18px", borderBottom: "0.5px solid var(--border-soft)" } }, [
        h("summary", { style: { fontSize: "14px", fontWeight: "600" } }, [text("span", {}, item.q)]),
        text("div", { style: { fontSize: "13px", color: "var(--text-dim)", lineHeight: "1.5", marginTop: "10px" } }, item.a),
      ])
    ),
  ]);
}
