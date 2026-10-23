import { h, text } from "../utils/h.js";
import { getRemote, compareVersions, refreshRemoteConfig } from "../remoteConfig.js";
import { APP_VERSION } from "../config.js";

const DISMISS_KEY = "scoutwave.announce.dismissed";

// Maintenance mode and "update required" take over the screen; everything else is a banner.
export function blockingNotice() {
  const remote = getRemote();
  if (!remote) return null;
  if (remote.maintenance.on) return { kind: "maintenance", message: remote.maintenance.message };
  if (compareVersions(APP_VERSION, remote.minVersion) < 0) return { kind: "update" };
  return null;
}

async function reloadFresh() {
  try {
    if ("serviceWorker" in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((r) => r.unregister());
    if (window.caches) (await caches.keys()).forEach((k) => caches.delete(k));
  } catch { /* reload anyway */ }
  window.location.reload();
}

export function blockingScreen(notice, onChecked) {
  const maintenance = notice.kind === "maintenance";
  const button = h("button", { type: "button", className: "primary-button" }, maintenance ? "Check again" : "Update now");
  button.addEventListener("click", async () => {
    if (!maintenance) { reloadFresh(); return; }
    button.disabled = true;
    button.textContent = "Checking\u2026";
    await refreshRemoteConfig();
    button.disabled = false;
    button.textContent = "Check again";
    onChecked();
  });
  return h("main", { className: "screen blocking-screen", role: "alert" }, [
    h("div", { className: "blocking-card card" }, [
      h("div", { className: "blocking-icon" }, [h("i", { "data-lucide": maintenance ? "wrench" : "download" })]),
      text("h1", {}, maintenance ? "We'll be right back" : "Please update Scoutwave"),
      text("p", {}, maintenance ? (notice.message || "Scoutwave is being improved. This usually takes only a few minutes.") : "A newer version is required to keep your scores accurate. It only takes a moment."),
      button,
    ]),
  ]);
}

const dismissed = () => { try { return window.localStorage.getItem(DISMISS_KEY) || ""; } catch { return ""; } };

export function announcementBar(onDismissed) {
  const a = getRemote()?.announcement;
  if (!a || a.id === dismissed()) return null;
  if (a.expiresAt && new Date(a.expiresAt).getTime() < Date.now()) return null;
  const close = h("button", { type: "button", className: "announce-close", "aria-label": "Dismiss announcement" }, [h("i", { "data-lucide": "x" })]);
  close.addEventListener("click", () => {
    try { window.localStorage.setItem(DISMISS_KEY, a.id); } catch { /* ignore */ }
    onDismissed();
  });
  const body = a.link
    ? h("a", { className: "announce-text", href: a.link, target: a.link.startsWith("/") ? null : "_blank", rel: "noopener noreferrer" }, a.text)
    : text("span", { className: "announce-text" }, a.text);
  return h("div", { className: "announcement-bar level-" + a.level, role: "status" }, [h("i", { "data-lucide": a.level === "warn" ? "triangle-alert" : a.level === "success" ? "check-circle" : "info", "aria-hidden": "true" }), body, close]);
}
