import { h } from "./h.js";

// Renders meta text as separate spans (spacing handled by CSS) instead of
// joining strings with middle dots.
export function metaLine(parts, className = "meta-line") {
  return h(
    "div",
    { className },
    parts.filter((p) => p != null && p !== "").map((p) => h("span", {}, String(p)))
  );
}

// Updates a star/favourite button in place, so toggling never needs a full
// app re-render (which would reset scroll position and refetch).
export function setStarState(button, on) {
  button.classList.toggle("selected", on);
  button.setAttribute("aria-label", on ? "Remove favourite" : "Add favourite");
  button.setAttribute("aria-pressed", String(on));
  const svg = button.querySelector("svg");
  if (svg) svg.setAttribute("fill", on ? "currentColor" : "none");
}
