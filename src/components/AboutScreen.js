import { h, text } from "../utils/h.js";
import { PageHeader } from "./PageHeader.js";

export function AboutScreen({ onBack }) {
  return h("div", { className: "screen" }, [
    PageHeader({ title: "About", onBack }),
    h("div", { style: { padding: "24px 18px", textAlign: "center" } }, [
      h("img", { src: "/src/assets/scoutwave-logo.png", alt: "Scoutwave", style: { height: "26px", width: "auto", display: "block", margin: "0 auto 14px" } }),
      text("div", { className: "mono", style: { fontSize: "12px", color: "var(--text-muted)", marginBottom: "18px" } }, "VERSION 0.1.0 (PROTOTYPE)"),
      text("p", { style: { fontSize: "13px", lineHeight: "1.6", color: "var(--text-dim)" } }, "Scoutwave brings livescores, stats, and an auditable VIP tips track record into one place, with multi-bookmaker odds comparison alongside every match."),
    ]),
  ]);
}
