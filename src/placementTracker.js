// Reports views and clicks of ad / promotion spaces (counts only, see server/placement-event.js).
// Skipped entirely when the browser says Do Not Track or Global Privacy Control.
const SEEN_KEY = "scoutwave.pl.seen";
const queue = [];
let timer = null;
const memory = new Set();

const optedOut = () => { try { return navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true; } catch { return false; } };
const store = () => { try { return window.sessionStorage; } catch { return null; } };

function flush() {
  window.clearTimeout(timer); timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 10);
  const body = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/placement-event", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/placement-event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* best effort */ }
}

function add(event) {
  queue.push(event);
  if (queue.length >= 10) flush();
  else if (!timer) timer = window.setTimeout(flush, 2000);
}

let wired = false;
function wire() {
  if (wired) return; wired = true;
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  window.addEventListener("pagehide", flush);
}

// Once per visit for each space and campaign.
export function trackView(slot, campaign) {
  if (!campaign || optedOut()) return;
  wire();
  const key = `v|${slot}|${campaign}`;
  let seen = memory.has(key);
  try { seen = seen || store()?.getItem(SEEN_KEY + key) === "1"; } catch { /* ignore */ }
  if (seen) return;
  memory.add(key);
  try { store()?.setItem(SEEN_KEY + key, "1"); } catch { /* ignore */ }
  add({ slot, campaign, event: "view" });
}

// Every tap counts, but a double tap within a few seconds is one.
const lastClick = new Map();
export function trackClick(slot, campaign) {
  if (!campaign || optedOut()) return;
  wire();
  const key = slot + campaign, now = Date.now();
  if (now - (lastClick.get(key) || 0) < 5000) return;
  lastClick.set(key, now);
  add({ slot, campaign, event: "click" });
  flush(); // the page may be about to change
}

// A view counts when at least half of the space has been on screen for a full second.
export function watchView(element, slot, campaign) {
  if (!campaign || !("IntersectionObserver" in window)) return;
  let wait = null;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
    if (visible && !wait) wait = window.setTimeout(() => { trackView(slot, campaign); observer.disconnect(); }, 1000);
    else if (!visible && wait) { window.clearTimeout(wait); wait = null; }
  }, { threshold: [0, 0.5, 1] });
  observer.observe(element);
}
