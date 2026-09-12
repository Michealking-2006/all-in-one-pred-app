import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const PARAGRAPHS = [
  "This is placeholder text for Scoutwave's terms of use. Replace it with your actual terms before shipping.",
  "We'd typically cover acceptable use of predictions and tips (informational only, not betting advice or a guarantee of outcome), the coin and VIP subscription terms, refund policy, and account termination conditions.",
  "Sports predictions carry no guarantee of accuracy. Users should gamble responsibly and in accordance with their local laws, where applicable.",
];

export function TermsOfUseScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Terms of use", onBack }),
    h("div", { style: { padding: "18px" } }, [
      text("div", { className: "mono eyebrow", style: { marginBottom: "16px" } }, "LAST UPDATED \u00b7 PLACEHOLDER"),
      ...PARAGRAPHS.map((p) => text("p", { style: { fontSize: "13px", lineHeight: "1.6", color: "var(--text-dim)", marginBottom: "14px" } }, p)),
    ]),
  ]);
}
