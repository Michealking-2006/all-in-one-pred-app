// Shared helpers for the SEO endpoints (the leading underscore keeps Vercel
// from exposing this file as a route).
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

// Server-side football data for crawlers. Never throws: a missing key, a rate
// limit or a slow provider simply means the page is rendered without data.
export async function footballData(endpoint, params = {}) {
  const key = String(process.env.SCOUTWAVE_FOOTBALL_API_KEY || "").trim();
  if (!key) return null;
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/${endpoint}${query ? "?" + query : ""}`, {
      headers: { "x-apisports-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || (data?.errors && Object.keys(data.errors).length)) return null;
    return Array.isArray(data?.response) ? data.response : null;
  } catch {
    return null;
  }
}

export const slugOf = (id, name) =>
  `${id}-${String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

// Competitions worth listing for discovery even when the data provider is down.
export const TOP_LEAGUES = [
  [39, "Premier League"], [140, "La Liga"], [135, "Serie A"], [78, "Bundesliga"], [61, "Ligue 1"],
  [2, "UEFA Champions League"], [3, "UEFA Europa League"], [848, "UEFA Conference League"], [88, "Eredivisie"],
  [94, "Primeira Liga"], [253, "Major League Soccer"], [71, "Serie A Brazil"], [128, "Liga Profesional Argentina"],
  [1, "World Cup"], [4, "Euro Championship"], [45, "FA Cup"], [48, "EFL Cup"], [40, "Championship"],
];
