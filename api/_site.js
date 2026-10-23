// Shared helpers for the SEO endpoints (the leading underscore keeps Vercel
// from exposing this file as a route).
import { env, sb, supabaseConfigured } from "./_admin.js";
import { recordUsage } from "./_usage.js";
import { q } from "./_query.js";

const API_BASE = "https://v3.football.api-sports.io";

export function siteOrigin(req) {
  const configured = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  const proto = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  return host ? `${proto}://${host}` : "https://scoutwave.app";
}

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Search engines can ask for thousands of pages. Every page that needs football data spends API requests, so the total
// spent on crawlers is capped per day (SEO_MAX_CALLS_PER_DAY, default 400). Past the cap pages are still served, just
// without the data (and cached briefly), so a crawl can never use up the quota the app needs.
let spendCache = { at: 0, day: "", used: 0 };
export async function spentToday() {
  const day = new Date().toISOString().slice(0, 10);
  if (!supabaseConfigured()) return spendCache.day === day ? spendCache.used : 0;
  if (spendCache.day === day && Date.now() - spendCache.at < 60_000) return spendCache.used;
  try {
    const rows = await sb(`/rest/v1/usage_daily?day=eq.${q.day(day)}&source=eq.seo&select=calls&limit=100`);
    spendCache = { at: Date.now(), day, used: (Array.isArray(rows) ? rows : []).reduce((t, r) => t + (Number(r.calls) || 0), 0) };
  } catch { /* can't read the counter: trust this instance's own count */ }
  return spendCache.used;
}
export const seoCap = () => { const v = Number(env("SEO_MAX_CALLS_PER_DAY")); return env("SEO_MAX_CALLS_PER_DAY") !== "" && Number.isFinite(v) ? v : 400; };

// Server-side football data for crawlers. Never throws: a missing key, a rate limit, the daily cap or a slow
// provider simply returns null (the page is then rendered without data). An empty list means "looked, found nothing".
export async function footballData(endpoint, params = {}) {
  const key = String(process.env.SCOUTWAVE_FOOTBALL_API_KEY || "").trim();
  if (!key) return null;
  if ((await spentToday()) >= seoCap()) return null;
  spendCache.used += 1; // count it now so a burst can't overshoot the cap before the counter catches up
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/${endpoint}${query ? "?" + query : ""}`, {
      headers: { "x-apisports-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => null);
    const failed = !res.ok || (data?.errors && !Array.isArray(data.errors) && Object.keys(data.errors).length > 0);
    await recordUsage("seo", endpoint, 1, failed ? 1 : 0);
    if (failed) return null;
    return Array.isArray(data?.response) ? data.response : null;
  } catch {
    await recordUsage("seo", endpoint, 1, 1);
    return null;
  }
}

export const currentSeasonYear = () => { const d = new Date(); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };

export const slugOf = (id, name) =>
  `${id}-${String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

// Competitions worth listing for discovery even when the data provider is down.
export const TOP_LEAGUES = [
  [39, "Premier League"], [140, "La Liga"], [135, "Serie A"], [78, "Bundesliga"], [61, "Ligue 1"],
  [2, "UEFA Champions League"], [3, "UEFA Europa League"], [848, "UEFA Conference League"], [88, "Eredivisie"],
  [94, "Primeira Liga"], [253, "Major League Soccer"], [71, "Serie A Brazil"], [128, "Liga Profesional Argentina"],
  [1, "World Cup"], [4, "Euro Championship"], [45, "FA Cup"], [48, "EFL Cup"], [40, "Championship"],
];
