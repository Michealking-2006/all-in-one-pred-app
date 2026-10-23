// Low-end device support, in two tiers. It is automatic by default and can be forced on or off in Appearance.
//   tier 1 (about 2 GB of RAM, data saver, very slow connection): no backdrop blur, no animated theme
//     weather, smaller caches, slower background refresh, long lists drawn in pieces.
//   tier 2 (1 GB of RAM or less): everything in tier 1, plus: no animations at all, much smaller caches,
//     no decorative photos (stadiums, news thumbnails), lower-resolution share pictures, and
//     background refresh at half speed. Football crests and player photos stay.
import { store } from "./store.js";

// 0 = capable, 1 = lighter, 2 = lightest. `nav` is injectable so this can be tested.
export function detectTier(nav = typeof navigator !== "undefined" ? navigator : {}) {
  try {
    const memory = nav.deviceMemory;            // GB, rounded to 0.25 / 0.5 / 1 / 2 / 4 / 8 (Chromium)
    const cores = nav.hardwareConcurrency;
    const connection = nav.connection || {};
    if (typeof memory === "number" && memory <= 1) return 2;
    if (typeof memory === "number" && memory <= 2) return 1;
    // Browsers without deviceMemory (Firefox, some WebViews): few cores on Android is a good proxy.
    if (memory == null && typeof cores === "number" && cores <= 4 && /Android/i.test(nav.userAgent || "")) return 1;
    if (connection.saveData === true) return 1;
    if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return 1;
  } catch { /* unknown: assume capable */ }
  return 0;
}

export const detectLowEnd = () => detectTier() > 0;

// "on" in Appearance means the lighter mode (tier 1) at least; an automatic 1 GB phone gets tier 2.
export function tierFor(mode, nav) {
  const auto = detectTier(nav);
  return mode === "on" ? Math.max(1, auto) : mode === "off" ? 0 : auto;
}
export const isLowEndFor = (mode) => tierFor(mode) > 0;

export const isLowEnd = () => !!document.documentElement.dataset.lowend;
export const isUltraLow = () => document.documentElement.dataset.lowend === "2";

// Decorative photos (news pictures, stadiums, ad images) are skipped on 1 GB phones: each decoded photo
// costs far more memory than the information it adds. Crests and player photos are always shown.
export const showPhotos = () => !isUltraLow();

// Refresh intervals stretch on low-end phones (fewer wake-ups, less battery and CPU).
export const pollMs = (base) => (isUltraLow() ? base * 2 : isLowEnd() ? Math.round(base * 1.5) : base);

function apply() {
  const tier = tierFor(store.getState().perfMode);
  if (tier > 0) document.documentElement.dataset.lowend = String(tier);
  else delete document.documentElement.dataset.lowend;
}

export function initPerf() {
  apply();
  store.subscribe(apply);
}
