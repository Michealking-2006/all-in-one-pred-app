// Sends the app's cache counters (totals only) to /api/usage every few minutes
// and when the app is hidden, so the admin Usage page can show cache hit rates.
import { takeUsage } from "./api/footballApi.js";

function send() {
  const u = takeUsage();
  if (u.memory + u.stored + u.network === 0) return;
  const body = JSON.stringify(u);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/usage", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* best effort */ }
}

export function initUsageBeacon() {
  document.addEventListener("visibilitychange", () => { if (document.hidden) send(); });
  window.setInterval(() => { if (!document.hidden) send(); }, 5 * 60 * 1000);
}
