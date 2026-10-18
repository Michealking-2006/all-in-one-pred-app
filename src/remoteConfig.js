// Remote configuration managed from the admin dashboard (/mingt-t): feature
// flags, maintenance mode, an announcement banner, a minimum app version and
// theme prices. Served by /api/config (cached at the edge for 30 s).
//
// Design rules: the app must never depend on it. A saved copy is used
// instantly at start, a failed or slow request is ignored, and anything
// malformed is thrown away in favour of the built-in defaults.
const KEY = "scoutwave.remote.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;
export const REMOTE_EVENT = "scoutwave:remote";

let current = readSaved();
let fetchedAt = 0;

function sane(data) {
  if (!data || typeof data !== "object") return null;
  const out = {
    flags: {},
    maintenance: { on: data.maintenance?.on === true, message: String(data.maintenance?.message || "").slice(0, 300) },
    announcement: null,
    minVersion: /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(data.minVersion || "") ? data.minVersion : "0.0.0",
    fxPrices: {},
    tipCost: Number.isInteger(data.tipCost) && data.tipCost >= 0 && data.tipCost <= 500 ? data.tipCost : null,
  };
  for (const [name, value] of Object.entries(data.flags || {})) if (typeof value === "boolean") out.flags[name] = value;
  const a = data.announcement;
  if (a && a.on === true && typeof a.text === "string" && a.text.trim()) {
    out.announcement = {
      id: String(a.id || ""), text: a.text.slice(0, 240), level: ["info", "warn", "success"].includes(a.level) ? a.level : "info",
      link: typeof a.link === "string" && /^(https?:\/\/|\/)/i.test(a.link) ? a.link : "", expiresAt: a.expiresAt || null,
    };
  }
  for (const [name, value] of Object.entries(data.fxPrices || {})) if (Number.isInteger(value) && value >= 0 && value <= 5000) out.fxPrices[name] = value;
  return out;
}

function readSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (saved && Date.now() - saved.at < MAX_AGE_MS) return sane(saved.data);
  } catch { /* ignore a corrupt copy */ }
  return null;
}

export const getRemote = () => current;

export function remoteFlag(name) {
  const value = current?.flags?.[name];
  return typeof value === "boolean" ? value : undefined;
}

export const tipCostOverride = () => current?.tipCost ?? undefined;
export const fxPriceOverride = (id) => current?.fxPrices?.[id];

// "0.17.0" vs "0.16.2": negative if a < b.
export function compareVersions(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

export async function refreshRemoteConfig() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("/api/config", { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return false;
    const next = sane(await res.json());
    if (!next) return false;
    fetchedAt = Date.now();
    const changed = JSON.stringify(next) !== JSON.stringify(current);
    current = next;
    try { window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: next })); } catch { /* storage full or blocked */ }
    if (changed) window.dispatchEvent(new Event(REMOTE_EVENT));
    return true;
  } catch {
    return false; // offline or slow: keep what we have
  } finally {
    window.clearTimeout(timer);
  }
}

export function initRemoteConfig() {
  refreshRemoteConfig();
  window.setInterval(() => { if (!document.hidden) refreshRemoteConfig(); }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - fetchedAt > 2 * 60 * 1000) refreshRemoteConfig();
  });
}
