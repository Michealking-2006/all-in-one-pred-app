import { h, text } from "../utils/h.js";

export function PageHeader({ title, onBack }) {
  return h("header", { className: "page-header" }, [
    h("button", { className: "back-button", "aria-label": "Back", onClick: onBack }, [
      h("i", { "data-lucide": "arrow-left", "aria-hidden": "true" })
    ]),
    text("h1", { className: "page-header-title" }, title),
  ]);
}

export function formField(label, { tag = "input", ...attrs } = {}) {
  return h("label", { style: { display: "block", marginBottom: "16px" } }, [
    text("div", { style: { fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: ".06em" } }, label),
    h(tag, tag === "textarea" ? { rows: "4", ...attrs } : { type: "text", ...attrs }),
  ]);
}
