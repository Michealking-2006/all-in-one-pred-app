// Push alerts on this device: ask permission, subscribe, and keep the server's copy of
// "which matches and clubs does this device care about" up to date.
import { store } from "./store.js";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
// On iPhone and iPad, alerts only work once the app is on the Home Screen.
export const needsInstall = () => isIos() && !isInstalled();

const keyBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function post(body) {
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Couldn't update alerts. Try again.");
}

const current = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription();

// What this device wants alerts about, taken from the app's own settings.
function interests() {
  const s = store.getState();
  const prefs = s.notificationPrefs || {};
  return {
    prefs: { goals: !!prefs.goals, kickoff: !!prefs.kickoff, whistles: !!prefs.whistles },
    fixtures: s.favorites?.match || [],
    teams: s.favorites?.club || [],
  };
}

export async function pushStatus() {
  if (!pushSupported()) return { supported: false };
  const sub = await current().catch(() => null);
  return { supported: true, permission: Notification.permission, subscribed: !!sub && Notification.permission === "granted", needsInstall: needsInstall() };
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser can't receive push alerts.");
  if (needsInstall()) throw new Error("On iPhone, add Scoutwave to your Home Screen first, then turn alerts on from there.");
  const info = await fetch("/api/push").then((r) => r.json()).catch(() => null);
  if (!info?.enabled || !info.publicKey) throw new Error("Push alerts aren't switched on yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for Scoutwave in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(info.publicKey) }));
  await post({ action: "subscribe", subscription: sub.toJSON(), ...interests() });
}

export async function disablePush() {
  const sub = await current().catch(() => null);
  if (!sub) return;
  await post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// Starring a match or club, or changing a toggle, updates the server a moment later.
let timer = null, last = "";
export function initPush() {
  if (!pushSupported()) return;
  store.subscribe(() => {
    const snapshot = JSON.stringify(interests());
    if (snapshot === last) return;
    last = snapshot;
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const sub = await current().catch(() => null);
      if (sub && Notification.permission === "granted") post({ action: "update", subscription: sub.toJSON(), ...interests() }).catch(() => {});
    }, 3000);
  });
  last = JSON.stringify(interests());
}
