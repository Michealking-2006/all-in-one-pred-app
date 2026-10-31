// Sends the app's cache counters (totals only) to /api/usage every few minutes
// and when the app is hidden, so the admin Usage page can show cache hit rates.
import { takeUsage } from "./api/footballApi.js";

let last = 0;
function send(gap) {
  if (Date.now() - last < gap) return; // counts keep adding up, so reports can be sparse
  last = Date.now();
  const u = takeUsage();
  if (u.memory + u.stored + u.network === 0) return;
  const body = JSON.stringify(u);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/usage", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* best effort */ }
}

export function initUsageBeacon() {
  document.addEventListener("visibilitychange", () => { if (document.hidden) send(2 * 60 * 1000); });
  window.setInterval(() => { if (!document.hidden) send(10 * 60 * 1000); }, 15 * 60 * 1000);
}
