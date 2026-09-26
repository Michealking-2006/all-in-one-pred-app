import { store } from "./store.js";

// index.html's inline boot script already set html[data-theme] before first
// paint (reading localStorage directly, since this module can't run that
// early). This module takes over from there: keeps the attribute in sync with
// the store (so Settings changes apply instantly), and reacts live if the
// user is on "system" and flips their OS/browser theme while the app is open.
const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function resolve(pref) {
  if (pref === "light" || pref === "dark") return pref;
  return media && media.matches ? "dark" : "light";
}

function apply() {
  const pref = store.getState().theme || "system";
  const effective = resolve(pref);
  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.themePref = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "dark" ? "#000000" : "#f2f2f7");
}

export function initTheme() {
  apply();
  store.subscribe(apply);
  if (media) media.addEventListener("change", () => { if ((store.getState().theme || "system") === "system") apply(); });
}
