// Advanced themes (fire / water / ice / bubbles): a liquid-glass tab bar with a
// sliding lens and themed particles that follow your finger. Everything here is
// presentation only; unlock rules live in fxEntitled().
import { store, FX_THEME_IDS } from "./store.js";
import { isLowEnd } from "./perf.js";
import { isFeatureOn } from "./features.js";
import { fxPriceOverride, REMOTE_EVENT } from "./remoteConfig.js";

export const FX_THEMES = [
  { id: "fire", name: "Fire", icon: "flame", price: 50, blurb: "Embers drift up from a molten glass bar." },
  { id: "water", name: "Water", icon: "droplet", vip: true, blurb: "Ripples and droplets over rolling waves. Included with Premium." },
  { id: "ice", name: "Ice", icon: "snowflake", price: 40, blurb: "Frosted glass with a cold shimmer and falling crystals." },
  { id: "bubbles", name: "Bubbles", icon: "bubbles", price: 30, blurb: "Iridescent bubbles float up as you glide across the bar." },
];

// The coin price, unless the admin dashboard has changed it.
export const fxPriceOf = (theme) => (theme?.vip ? null : fxPriceOverride(theme?.id) ?? theme?.price);

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
  if (!isFeatureOn("advancedThemes")) return null; // admin kill switch
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
  overlay = document.createElement("div");
  overlay.id = "fx-overlay";
  overlay.setAttribute("aria-hidden", "true");
  // The weather falls over the content (pointer-events are off, so it never gets in the way).
  ambient = document.createElement("div");
  ambient.className = "fx-ambient";
  overlay.appendChild(ambient);
  document.body.prepend(backdrop);
  document.body.appendChild(overlay);

  // Taps anywhere (the bottom bar has its own, richer effect).
  document.addEventListener("pointerdown", (event) => {
    const theme = currentFxTheme();
    if (!theme || event.target.closest?.(".bottom-nav, .fx-preview-bar")) return;
    tapBurst(overlay, theme, event.clientX, event.clientY);
  }, { passive: true, capture: true });

  // Each theme has its own pace: bubbles are occasional, rain is light, snow and fire drops are steady.
  const PACE = { fire: 190, water: 210, bubbles: 520, ice: 190 };
  let timer = null, pacedTheme = null;
  const schedule = () => {
    const theme = currentFxTheme();
    if (theme === pacedTheme && timer) return;
    window.clearInterval(timer);
    timer = null;
    pacedTheme = theme;
    if (!theme) return;
    timer = window.setInterval(() => {
      if (document.hidden) return;
      ambientDrift(ambient, pacedTheme);
    }, PACE[theme] || 400);
  };
  schedule();
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-fx"] });
}

export function initThemeFx() {
  const run = () => {
    applyAttribute();
    if (activeFxTheme(store.getState())) ensureLayers();
  };
  run();
  store.subscribe(run);
  window.addEventListener(REMOTE_EVENT, run); // the admin kill switch can change while the app is open
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

// ---------------------------------------------------------------------------
// Themed weather. Each theme has its own "weather" that runs by itself across
// the whole app (no tapping needed), and the same particles burst where a
// finger lands:
//   fire    - drops of fire fall, embers rise
//   water   - a light rain with small splashes
//   bubbles - bubbles appear all over and pop
//   ice     - snow: ice crystals and flakes drift down
// ---------------------------------------------------------------------------
const MAX_AMBIENT = 40;

function add(layer, el, lifeMs) {
  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), lifeMs);
  return el;
}

const fireDrop = (x, y, travel, size = rand(9, 17), dur = rand(1.2, 2.3)) => freeParticle("fx-firedrop", x, y, size, rand(-14, 14), dur, travel);
const ember = (x, y, travel) => freeParticle("fx-ember", x, y, rand(2.5, 6), rand(-40, 40), rand(4.5, 8), travel);
const raindrop = (x, y, travel, dur) => {
  const el = freeParticle("fx-rain", x, y, 0, rand(-18, -8), dur, travel);
  el.style.height = rand(14, 28).toFixed(0) + "px";
  return el;
};
const splash = (x, y) => freeParticle("fx-ripple fx-splash", x, y, 0, 0, rand(0.7, 1.1));
const snow = (x, y, travel, crystal) => freeParticle(crystal ? "fx-snow fx-crystal" : "fx-snow fx-snowball", x, y, crystal ? rand(7, 14) : rand(3, 9), rand(-46, 46), rand(7, 13), travel);

// A bubble that appears, floats a little, then pops with a ring and spray.
function poppingBubble(layer, x, y, size = rand(14, 40), dur = rand(1.8, 3.2)) {
  const el = freeParticle("fx-bubble fx-popper", x, y, size, rand(-12, 12), dur, -rand(24, 70));
  add(layer, el, dur * 1000 + 800);
  setTimeout(() => {
    if (!layer.isConnected || reducedMotion()) return;
    const ring = freeParticle("fx-popring", x + rand(-6, 6), y - rand(10, 30), size, 0, 0.45);
    add(layer, ring, 1200);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + rand(-0.3, 0.3);
      const speck = freeParticle("fx-speck", x, y - 18, rand(2, 4), 0, rand(0.4, 0.7), 0);
      speck.style.setProperty("--sx", (Math.cos(angle) * (size * 0.9 + rand(4, 14))).toFixed(0) + "px");
      speck.style.setProperty("--sy", (Math.sin(angle) * (size * 0.9 + rand(4, 14))).toFixed(0) + "px");
      add(layer, speck, 1200);
    }
  }, dur * 1000 * 0.93);
}

// A small burst where the finger lands, on any element of the app.
export function tapBurst(layer, theme, x, y) {
  if (isLowEnd()) return; // lighter mode: colours only, no particles
  if (!layer?.isConnected || reducedMotion() || layer.childElementCount >= MAX_AMBIENT + 24) return;
  if (theme === "fire") {
    for (let i = 0; i < 4; i++) add(layer, fireDrop(x + rand(-14, 14), y - rand(0, 10), rand(40, 110), rand(7, 12), rand(0.6, 1.2)), 2500);
    for (let i = 0; i < 4; i++) add(layer, freeParticle("fx-ember", x + rand(-8, 8), y, rand(3, 6), rand(-24, 24), rand(0.8, 1.4), -rand(50, 110)), 2500);
  } else if (theme === "water") {
    add(layer, freeParticle("fx-ripple", x, y, 0, 0, 1.1), 2500);
    for (let i = 0; i < 4; i++) add(layer, freeParticle("fx-drop", x + rand(-6, 6), y, rand(4, 7), rand(-24, 24), rand(0.8, 1.3), -rand(28, 60)), 2500);
  } else if (theme === "bubbles") {
    for (let i = 0; i < 3; i++) poppingBubble(layer, x + rand(-26, 26), y + rand(-10, 18), rand(12, 26), rand(0.8, 1.5));
  } else if (theme === "ice") {
    for (let i = 0; i < 7; i++) add(layer, snow(x + rand(-18, 18), y + rand(-18, 4), rand(40, 100), i % 2 === 0), 3000);
  }
}

// One tick of the whole-screen weather. `strength` is how many particles to try.
export function ambientDrift(layer, theme) {
  if (isLowEnd()) return;
  if (!layer?.isConnected || reducedMotion() || layer.childElementCount >= MAX_AMBIENT) return;
  const w = window.innerWidth, h = window.innerHeight;
  const x = rand(0.02, 0.98) * w;
  if (theme === "fire") {
    // Drops of fire fall from the top; a few embers rise from the bottom.
    add(layer, fireDrop(x, -16, h * rand(0.35, 1.05)), 4000);
    if (Math.random() < 0.3) add(layer, ember(rand(0.05, 0.95) * w, h + 6, -h * rand(0.35, 0.8)), 10000);
  } else if (theme === "water") {
    // A light rain: thin streaks, some of which end in a small splash.
    const travel = h * rand(0.3, 1.02);
    const dur = rand(0.8, 1.3);
    add(layer, raindrop(x, -30, travel, dur), 2500);
    if (Math.random() < 0.5) setTimeout(() => { if (layer.isConnected) add(layer, splash(x - 10, travel - 30), 1800); }, dur * 1000 * 0.92);
  } else if (theme === "bubbles") {
    // Bubbles appear all over the screen and pop.
    poppingBubble(layer, rand(0.06, 0.94) * w, rand(0.12, 0.92) * h);
    if (Math.random() < 0.35) add(layer, freeParticle("fx-bubble", rand(0.05, 0.95) * w, h + 10, rand(8, 22), rand(-30, 30), rand(7, 12), -rand(0.4, 0.85) * h), 14000);
  } else if (theme === "ice") {
    // Snow: crystals and soft flakes drifting down.
    add(layer, snow(x, -14, h * rand(0.6, 1.05), Math.random() < 0.4), 14000);
  }
}

export function spawn(layer, theme, x, strong = false) {
  if (isLowEnd()) return;
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
