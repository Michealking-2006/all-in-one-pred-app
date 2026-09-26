import { h, text } from "./utils/h.js";

const ICONS = { default: "info", success: "circle-check", error: "circle-alert" };

let stack = null;

// #toast-root lives outside #root in index.html, so App.js's render() —
// which does root.innerHTML = "" on every store change — never touches it.
// Toast lifecycle (add a capsule, animate it out ~2.5s later) is therefore never
// disrupted by the rest of the app re-rendering.
function ensureStack() {
  if (stack) return stack;
  stack = h("div", { className: "toast-stack", "aria-live": "polite" });
  document.getElementById("toast-root").appendChild(stack);
  return stack;
}

// showToast is the one function every part of the app calls to surface a brief
// message. type: "default" | "success" | "error"
export function showToast(message, type = "default", duration = 2500) {
  const toast = h("div", { className: "toast " + type, role: type === "error" ? "alert" : "status", onClick: () => dismiss() }, [
    h("i", { "data-lucide": ICONS[type] || ICONS.default, "aria-hidden": "true" }),
    text("span", {}, message),
  ]);

  function dismiss() {
    if (!toast.isConnected || toast.classList.contains("leaving")) return;
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 220);
  }

  ensureStack().appendChild(toast);
  setTimeout(dismiss, duration);
}
