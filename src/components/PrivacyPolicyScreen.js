import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

const PARAGRAPHS = [
  "This is placeholder text for Scoutwave's privacy policy. Replace it with your actual policy before shipping.",
  "We'd typically cover what data is collected (account details, favourites, coin balance, betting preferences), how it's stored, and who it's shared with, if anyone.",
  "We'd also cover how long data is retained, how a user can request deletion of their account and data, and how to contact us with privacy questions.",
];

export function PrivacyPolicyScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "Privacy policy", onBack }),
    h("div", { style: { padding: "18px" } }, [
      text("div", { className: "mono eyebrow", style: { marginBottom: "16px" } }, "LAST UPDATED \u00b7 PLACEHOLDER"),
      ...PARAGRAPHS.map((p) => text("p", { style: { fontSize: "13px", lineHeight: "1.6", color: "var(--text-dim)", marginBottom: "14px" } }, p)),
    ]),
  ]);
}
