import { h } from "./h.js";

// The Scoutwave wordmark in the club's colours: the mark and "SCOUT" take the accent, "WAVE" takes the text colour.
// It is hidden until a club is chosen (see .wordmark-club in theme.css); the normal red/black images are used otherwise.
// `width` in px sets the size; leave it out when CSS sizes it (the About page).
export function ClubWordmark(width, className = "") {
  const style = width ? { width: width + "px", height: Math.round(width * 88 / 560) + "px" } : {};
  return h("span", { className: ("wordmark-club " + className).trim(), role: "img", "aria-label": "Scoutwave", style });
}
