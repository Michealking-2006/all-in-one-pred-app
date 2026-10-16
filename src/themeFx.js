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

// The app-wide layers live on <body>, outside #root, so re-rendering a screen
// never wipes them: a backdrop (drifting colour + ambient particles) behind the
// content, and an overlay above it for tap bursts.
let backdrop = null, ambient = null, overlay = null;

function ensureLayers() {
  if (backdrop) return;
  backdrop = document.createElement("div");
  backdrop.id = "fx-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 2; i++) { const orb = document.createElement("span"); orb.className = "fx-orb"; backdrop.appendChild(orb); }
  ambient = document.createElement("div");
  ambient.className = "fx-ambient";
  backdrop.appendChild(ambient);
  overlay = document.createElement("div");
  overlay.id = "fx-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.prepend(backdrop);
  document.body.appendChild(overlay);

  // Taps anywhere (the bottom bar has its own, richer effect).
  document.addEventListener("pointerdown", (event) => {
    const theme = currentFxTheme();
    if (!theme || event.target.closest?.(".bottom-nav, .fx-preview-bar")) return;
    tapBurst(overlay, theme, event.clientX, event.clientY);
  }, { passive: true, capture: true });

  window.setInterval(() => {
    if (document.hidden) return;
    const theme = currentFxTheme();
    if (theme) ambientDrift(ambient, theme);
  }, 1100);
}

export function initThemeFx() {
  const run = () => {
    applyAttribute();
    if (activeFxTheme(store.getState())) ensureLayers();
  };
  run();
  store.subscribe(run);
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

// Particles placed by viewport coordinates (the app-wide backdrop and tap bursts),
// as opposed to the bottom bar's local, percentage-based ones.
function freeParticle(className, x, y, size, dx, duration, travel = 0) {
  const el = document.createElement("span");
  el.className = "fx-p fx-free " + className;
  el.style.left = x.toFixed(1) + "px";
  el.style.top = y.toFixed(1) + "px";
  if (size) { el.style.width = size.toFixed(1) + "px"; el.style.height = (className === "fx-drop" ? size * 1.5 : size).toFixed(1) + "px"; }
  el.style.setProperty("--dx", dx.toFixed(1) + "px");
  el.style.setProperty("--d", duration.toFixed(2) + "s");
  el.style.setProperty("--travel", travel.toFixed(0) + "px");
  return el;
}

function place(layer, el, lifeMs) {
  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), lifeMs);
}

// A small burst where the finger lands, on any element of the app.
export function tapBurst(layer, theme, x, y) {
  if (!layer?.isConnected || reducedMotion() || layer.childElementCount >= MAX_PARTICLES) return;
  const burst = {
    bubbles: () => Array.from({ length: 4 }, () => freeParticle("fx-bubble", x + rand(-12, 12), y + rand(-6, 6), rand(7, 18), rand(-24, 24), rand(1.2, 2.2), -rand(60, 130))),
    fire: () => Array.from({ length: 6 }, () => freeParticle("fx-ember", x + rand(-8, 8), y, rand(3, 7), rand(-20, 20), rand(0.8, 1.5), -rand(50, 110))),
    ice: () => Array.from({ length: 5 }, () => freeParticle("fx-flake", x + rand(-14, 14), y + rand(-14, 0), rand(6, 11), rand(-18, 18), rand(1.2, 2.2), rand(40, 90))),
    water: () => [freeParticle("fx-ripple", x, y, 0, 0, 1.1), ...Array.from({ length: 3 }, () => freeParticle("fx-drop", x + rand(-6, 6), y, rand(4, 7), rand(-22, 22), rand(0.8, 1.3), -rand(28, 54)))],
  }[theme];
  burst?.().forEach((el) => place(layer, el, 3000));
}

// Slow ambient life across the whole screen: bubbles rising, embers drifting up,
// crystals falling, ripples on the surface.
export function ambientDrift(layer, theme) {
  if (!layer?.isConnected || reducedMotion() || layer.childElementCount >= 18) return;
  const w = window.innerWidth, h = window.innerHeight;
  const x = rand(0.04, 0.96) * w;
  const el = {
    bubbles: () => freeParticle("fx-bubble", x, h + 10, rand(8, 26), rand(-30, 30), rand(7, 13), -rand(0.45, 0.9) * h),
    fire: () => freeParticle("fx-ember", x, h + 6, rand(2.5, 6), rand(-40, 40), rand(5, 9), -rand(0.4, 0.85) * h),
    ice: () => freeParticle("fx-flake", x, -12, rand(6, 13), rand(-36, 36), rand(7, 12), rand(0.5, 0.95) * h),
    water: () => freeParticle("fx-ripple", x, rand(0.15, 0.9) * h, 0, 0, rand(2.2, 3.4)),
  }[theme]?.();
  if (el) place(layer, el, 15000);
}

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
