// Low-end device support. Phones with about 2 GB of RAM (or data saver on, or a
// very slow connection) get a "lighter" mode: no backdrop blur, no animated
// theme weather, smaller caches, slower background refresh. It is automatic by
// default and can be forced on or off in Appearance.
import { store } from "./store.js";

export function detectLowEnd() {
  try {
    const nav = window.navigator;
    const memory = nav.deviceMemory;            // GB, rounded down to 0.25 / 0.5 / 1 / 2 / 4 / 8 (Chromium)
    const cores = nav.hardwareConcurrency;
    const connection = nav.connection || {};
    if (typeof memory === "number" && memory <= 2) return true;
    // Browsers without deviceMemory (Firefox, some WebViews): few cores on Android is a good proxy.
    if (memory == null && typeof cores === "number" && cores <= 4 && /Android/i.test(nav.userAgent || "")) return true;
    if (connection.saveData === true) return true;
    if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return true;
  } catch { /* unknown: assume capable */ }
  return false;
}

export function isLowEndFor(mode) {
  return mode === "on" ? true : mode === "off" ? false : detectLowEnd();
}

export const isLowEnd = () => document.documentElement.dataset.lowend === "1";

// Refresh intervals stretch on low-end phones (fewer wake-ups, less battery and CPU).
export const pollMs = (base) => (isLowEnd() ? Math.round(base * 1.5) : base);

function apply() {
  const on = isLowEndFor(store.getState().perfMode);
  if (on) document.documentElement.dataset.lowend = "1";
  else delete document.documentElement.dataset.lowend;
}

export function initPerf() {
  apply();
  store.subscribe(apply);
}
