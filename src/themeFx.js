// Advanced themes (fire / water / ice / bubbles): a liquid-glass tab bar with a
// sliding lens and themed particles that follow your finger. Everything here is
// presentation only; unlock rules live in fxEntitled().
import { store, FX_THEME_IDS } from "./store.js";

export const FX_THEMES = [
  { id: "fire", name: "Fire", icon: "flame", price: 50, blurb: "Embers drift up from a molten glass bar." },
  { id: "water", name: "Water", icon: "droplet", vip: true, blurb: "Ripples and droplets over rolling waves. Included with Premium." },
  { id: "ice", name: "Ice", icon: "snowflake", price: 40, blurb: "Frosted glass with a cold shimmer and falling crystals." },
  { id: "bubbles", name: "Bubbles", icon: "bubbles", price: 30, blurb: "Iridescent bubbles float up as you glide across the bar." },
];

export const fxThemeById = (id) => FX_THEMES.find((t) => t.id === id) || null;

// Water belongs to Premium; the rest are bought once with coins.
export function fxEntitled(state, id) {
  const theme = fxThemeById(id);
  if (!theme) return false;
  return theme.vip ? !!state.isVip : (state.unlockedThemes || []).includes(id);
}

// The theme that is actually on screen (a saved choice stops applying if its
// entitlement lapses, e.g. Premium ending, without losing the choice).
export function activeFxTheme(state) {
  return state.fxTheme && fxEntitled(state, state.fxTheme) ? state.fxTheme : null;
}

function applyAttribute() {
  const active = activeFxTheme(store.getState());
  if (active) document.documentElement.dataset.fx = active;
  else delete document.documentElement.dataset.fx;
}

export function initThemeFx() {
  applyAttribute();
  store.subscribe(applyAttribute);
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const MAX_PARTICLES = 30;

function particle(className, x, size, dx, duration) {
  const el = document.createElement("span");
  el.className = "fx-p " + className;
  el.style.left = x.toFixed(1) + "%";
  if (size) { el.style.width = size.toFixed(1) + "px"; el.style.height = (className === "fx-drop" ? size * 1.5 : size).toFixed(1) + "px"; }
  el.style.setProperty("--dx", dx.toFixed(1) + "px");
  el.style.setProperty("--d", duration.toFixed(2) + "s");
  return el;
}

const MAKERS = {
  bubbles: (x, strong) => Array.from({ length: strong ? 4 : 1 }, () => particle("fx-bubble", x + rand(-6, 6), rand(6, 18), rand(-16, 16), rand(1.7, 2.9))),
  fire: (x, strong) => Array.from({ length: strong ? 5 : 2 }, () => particle("fx-ember", x + rand(-5, 5), rand(3, 7), rand(-12, 12), rand(0.9, 1.7))),
  ice: (x, strong) => Array.from({ length: strong ? 4 : 1 }, () => particle("fx-flake", x + rand(-6, 6), rand(5, 10), rand(-14, 14), rand(1.6, 2.8))),
  water: (x, strong) => [
    particle("fx-ripple", x, 0, 0, rand(1.0, 1.4)),
    ...Array.from({ length: strong ? 3 : 1 }, () => particle("fx-drop", x + rand(-5, 5), rand(4, 7), rand(-14, 14), rand(0.9, 1.5))),
  ],
};

export function spawn(layer, theme, x, strong = false) {
  if (!layer?.isConnected || reducedMotion()) return;
  const make = MAKERS[theme];
  if (!make || layer.childElementCount >= MAX_PARTICLES) return;
  for (const el of make(Math.max(2, Math.min(98, x)), strong)) {
    layer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 3500); // safety net if animationend never fires
  }
}

// Wires press / hover / glide on `el` to spawn particles into `layer`, plus a
// gentle ambient trickle. `getTheme()` returns the theme id to use right now
// (or null for none). Stops itself once `el` leaves the document.
export function attachFx(el, layer, getTheme, { ambientMs = 1100 } = {}) {
  let last = 0;
  const burst = (event, strong) => {
    const theme = getTheme();
    if (!theme) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    spawn(layer, theme, ((event.clientX - rect.left) / rect.width) * 100, strong);
  };
  el.addEventListener("pointerdown", (e) => burst(e, true));
  el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") burst(e, true); });
  el.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - last < 70) return;
    if (e.pointerType === "mouse" || e.buttons) { last = now; burst(e, false); }
  });

  const timer = window.setInterval(() => {
    if (!el.isConnected) { window.clearInterval(timer); return; }
    if (document.hidden) return;
    const theme = getTheme();
    if (theme) spawn(layer, theme, rand(8, 92), false);
  }, ambientMs);
}

export const currentFxTheme = () => document.documentElement.dataset.fx || null;
