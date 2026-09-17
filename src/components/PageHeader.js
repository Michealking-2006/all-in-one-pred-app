import { h, text } from "../utils/h.js";

// props: { title, onBack }
export function PageHeader({ title, onBack }) {
  return h("div", { style: { padding: "14px 18px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "0.5px solid var(--border-soft)" } }, [
    h(
      "button",
      { "aria-label": "Back", onClick: onBack, style: { border: "none", background: "none", color: "var(--text)", padding: "2px" } },
      [h("i", { "data-lucide": "arrow-left", "aria-hidden": "true", style: { width: "18px", height: "18px" } })]
    ),
    text("span", { style: { fontWeight: "700", fontSize: "16px" } }, title),
  ]);
}

// Shared label+input pair for forms (Edit profile, Change password, Report issue).
// Deliberately uncontrolled — no value from store, no onInput handler — because
// this app re-renders by tearing down and rebuilding the whole DOM tree on every
// store.setState. A controlled input wired to the store would lose focus and
// cursor position on every keystroke. Since nothing else changes state while
// typing here, the browser manages the input's value fine on its own.
export function formField(label, { tag = "input", ...attrs } = {}) {
  return h("label", { style: { display: "block", marginBottom: "14px" } }, [
    text("div", { style: { fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" } }, label),
    h(tag, tag === "textarea" ? { rows: "4", ...attrs } : { type: "text", ...attrs }),
  ]);
}
