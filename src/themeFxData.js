// Advanced themes: which exist, what they cost and who may use them. Small and needed at startup; the animation itself
// is in themeFx.js and loads only when a theme is actually on. Unlock rules are decided here.
import { store } from "./store.js";
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

export function applyFxAttribute() {
  const active = activeFxTheme(store.getState());
  if (active) document.documentElement.dataset.fx = active;
  else delete document.documentElement.dataset.fx;
}


// The theme currently applied to the page (read back from the attribute so every module agrees).
export const currentFxTheme = () => document.documentElement.dataset.fx || null;

// Sets the page attribute the CSS keys off, and loads the animation only when a theme is really on (and the
// admin kill switch is not off). Default users never download the animation code.
let effects = null;
const loadEffects = () => (effects ||= import("./themeFx.js"));

export function initThemeFx() {
  const run = () => {
    applyFxAttribute();
    if (activeFxTheme(store.getState())) loadEffects().then((m) => m.ensureFxLayers()).catch(() => {});
  };
  run();
  store.subscribe(run);
  window.addEventListener(REMOTE_EVENT, run); // the admin kill switch can change while the app is open
}

// The glass tab bar's finger effect. Built on every screen draw, so it must stay cheap for people with no theme:
// nothing is loaded unless a theme is on, and when one is, the effect is attached as soon as the animation code is ready.
export function attachNavFx(el, layer, getTheme, options) {
  if (!activeFxTheme(store.getState())) return;
  loadEffects().then((m) => { if (el.isConnected) m.attachFx(el, layer, getTheme, options); }).catch(() => {});
}
