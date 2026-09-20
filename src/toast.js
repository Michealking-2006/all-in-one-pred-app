import { h, text } from "./utils/h.js";

const ICONS = { default: "info", success: "check-circle", error: "circle-alert" };
const COLORS = { default: "var(--bg)", success: "#3B9A5C", error: "var(--danger)" };

let stack = null;

// #toast-root lives outside #root in index.html, so App.js's render() —
// which does root.innerHTML = "" on every store change — never touches it.
// This is deliberate: toast lifecycle (add a pill, auto-remove it 2.5s later)
// should never trigger or be disrupted by the rest of the app re-rendering,
// the same reasoning as SkeletonImage managing its own onload locally.
function ensureStack() {
  if (stack) return stack;
  const root = document.getElementById("toast-root");
  stack = h("div", {
    style: {
      maxWidth: "420px",
      width: "100%",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    },
  });
  root.appendChild(stack);
  return stack;
}

// showToast is the one function every part of the app should call to surface
// a brief message — import it directly, no prop drilling, no store wiring.
// type: "default" | "success" | "error"
export function showToast(message, type = "default", duration = 2500) {
  const pill = h(
    "div",
    {
      style: {
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "var(--text)",
        color: "var(--bg)",
        padding: "10px 16px",
        borderRadius: "999px",
        fontSize: "13px",
        fontWeight: "500",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        maxWidth: "88%",
      },
      onClick: () => pill.remove(),
    },
    [
      h("i", { "data-lucide": ICONS[type] || ICONS.default, "aria-hidden": "true", style: { width: "16px", height: "16px", color: COLORS[type] || COLORS.default, flexShrink: "0" } }),
      text("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, message),
    ]
  );

  ensureStack().appendChild(pill);
  setTimeout(() => pill.remove(), duration);
}
