import { h } from "./utils/h.js";
import { clearFootballCache } from "./api/footballApi.js";

// Custom pull-to-refresh: the browser's native one is already disabled
// (body { overscroll-behavior-y: none }), so without this, pulling down at the
// top of any screen would just do nothing.
//
// The screen content ("#root .screen") moves down with the finger and the dial
// rides in the gap that opens above it, like iOS — rather than floating over
// the content and covering it. Only .screen moves: the tab bar, toasts and the
// compact nav are position:fixed elements that live outside it, so they stay
// put. The dial itself lives in its own root outside #root (like #toast-root)
// so App.js's full re-render on every store change can't tear it out mid-pull.
const THRESHOLD = 64; // px of damped pull needed to trigger a refresh
const MAX_PULL = 96; // px the content travels, however hard you pull
const RESISTANCE = 0.55; // each extra px of finger movement buys less travel
const MIN_SPINNER_MS = 600; // so a refresh never looks like a no-op flicker
const DIAL = 36; // dial diameter in px (keep in sync with .ptr-dial in theme.css)
const GAP = 8; // breathing room between the dial and the content edge

let onRefresh = null; // set by App.js: null on screens that opt out
let root = null, icon = null;
let startY = 0, pulling = false, refreshing = false;
let safeTop = 0; // notch / status-bar inset, so the dial clears it

function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function measureSafeTop() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden";
  document.body.appendChild(probe);
  safeTop = probe.offsetHeight;
  probe.remove();
}

const screenEl = () => document.querySelector("#root .screen");

function moveContent(px, animated) {
  const el = screenEl();
  if (!el) return;
  el.style.transition = animated && !reducedMotion() ? "transform .28s cubic-bezier(.22,.9,.3,1)" : "none";
  el.style.transform = `translateY(${px}px)`;
}

// Leave no inline transform behind: even translateY(0) would keep .screen a
// containing block for fixed descendants and a stacking context.
function clearContent() {
  const el = screenEl();
  if (!el) return;
  el.style.transition = "";
  el.style.transform = "";
}

function moveDial(offset, opacity) {
  root.style.opacity = String(opacity);
  root.style.transform = `translateY(${offset - DIAL - GAP}px)`;
}

function setPull(distance, ready) {
  const progress = Math.min(1, distance / THRESHOLD);
  const offset = Math.min(distance, MAX_PULL) + safeTop * progress;
  moveContent(offset, false);
  moveDial(offset, Math.min(1, progress * 1.3));
  icon.style.transform = `rotate(${ready ? 180 : progress * 180}deg)`;
  root.classList.toggle("is-ready", ready);
}

function settle() {
  root.classList.toggle("is-animated", !reducedMotion());
  moveDial(0, 0);
  root.classList.remove("is-ready", "is-refreshing");
  icon.style.transform = "";
  moveContent(0, true);
  window.setTimeout(() => { if (!pulling && !refreshing) clearContent(); }, reducedMotion() ? 0 : 320);
}

async function triggerRefresh() {
  refreshing = true;
  const hold = THRESHOLD + safeTop;
  root.classList.add("is-animated", "is-refreshing");
  moveContent(hold, true);
  moveDial(hold, 1);
  const started = Date.now();
  try {
    clearFootballCache();
    if (onRefresh) onRefresh(); // re-renders, which replaces .screen with a fresh element…
    moveContent(hold, false); // …so hold the new one open too, or the gap would snap shut
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed < MIN_SPINNER_MS) await new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS - elapsed));
    refreshing = false;
    settle();
  }
}

function onTouchStart(event) {
  // No handler = this screen opted out of pull-to-refresh (e.g. forms), so the
  // gesture must be fully inert — not just skip the refetch, or the indicator
  // would still animate and spin for nothing.
  if (!onRefresh || refreshing || window.scrollY > 0 || event.touches.length !== 1) { pulling = false; return; }
  startY = event.touches[0].clientY;
  pulling = true;
  root.classList.remove("is-animated");
}

function onTouchMove(event) {
  if (!pulling || refreshing) return;
  const delta = event.touches[0].clientY - startY;
  if (delta <= 0 || window.scrollY > 0) { pulling = false; settle(); return; }
  event.preventDefault(); // don't also scroll/bounce the page while visually pulling
  const damped = delta * RESISTANCE;
  setPull(damped, damped >= THRESHOLD);
}

function onTouchEnd() {
  if (!pulling || refreshing) { pulling = false; return; }
  pulling = false;
  if (root.classList.contains("is-ready")) triggerRefresh();
  else settle();
}

// Which screen "refresh" applies to changes as the user navigates; App.js sets
// this on every render: a function that re-fetches the current screen, or null
// on screens with nothing safe to refresh (anything with typed input).
export function setRefreshHandler(fn) {
  onRefresh = fn;
}

export function initPullToRefresh() {
  if (root) return; // guard against double-init
  measureSafeTop();
  icon = h("i", { "data-lucide": "arrow-down", "aria-hidden": "true" });
  const dial = h("div", { className: "ptr-dial" }, [icon, h("span", { className: "ptr-spinner", "aria-hidden": "true" })]);
  root = h("div", { className: "ptr-root", role: "status", "aria-live": "polite", "aria-label": "Pull to refresh" }, [dial]);
  moveDial(0, 0);
  document.getElementById("pull-refresh-root").appendChild(root);

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", () => { pulling = false; if (!refreshing) settle(); }, { passive: true });
  window.addEventListener("resize", measureSafeTop);
}
