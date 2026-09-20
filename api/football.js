const API_BASE = "https://v3.football.api-sports.io";

// Paste your Football API key between the quotes before deploying.
const API_KEY = "c3e4c14be7c1b0cb011eefd4ab4ddeaf";

const ALLOWED_ENDPOINTS = new Set([
  "leagues",
  "teams",
  "teams/statistics",
  "venues",
  "players",
  "players/squads",
  "players/topscorers",
  "players/topassists",
  "players/topyellowcards",
  "players/topredcards",
  "standings",
  "fixtures",
  "fixtures/headtohead",
  "fixtures/events",
  "fixtures/lineups",
  "fixtures/statistics",
  "predictions",
]);

function providerErrorMessage(errors) {
  if (!errors) return "The football data provider rejected the request.";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) {
    return errors.map((item) => typeof item === "string" ? item : JSON.stringify(item)).filter(Boolean).join("; ");
  }
  return Object.entries(errors)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join("; ");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = String(API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "Add your Football API key to api/football.js.",
      code: "MISSING_FOOTBALL_API_KEY",
    });
  }

  const rawEndpoint = req.query?.endpoint;
  const endpoint = String(Array.isArray(rawEndpoint) ? rawEndpoint[0] : rawEndpoint || "")
    .replace(/^\/+|\/+$/g, "");

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: "Unsupported football endpoint.", code: "INVALID_ENDPOINT" });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "endpoint" || value == null) continue;
    for (const item of (Array.isArray(value) ? value : [value])) params.append(key, String(item));
  }

  try {
    const response = await fetch(
      `${API_BASE}/${endpoint}${params.toString() ? `?${params}` : ""}`,
      { headers: { "x-apisports-key": apiKey, Accept: "application/json" } }
    );

    const data = await response.json().catch(() => null);

    if (data?.errors && Object.keys(data.errors).length) {
      const message = providerErrorMessage(data.errors);
      const rateLimited = /rate|limit|quota|requests/i.test(message);
      return res.status(rateLimited ? 429 : 502).json({
        error: message,
        code: rateLimited ? "FOOTBALL_API_RATE_LIMIT" : "FOOTBALL_API_PROVIDER_ERROR",
        details: data.errors,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Football data request failed (HTTP ${response.status}).`,
        code: "FOOTBALL_API_HTTP_ERROR",
      });
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(Array.isArray(data?.response) ? data.response : []);
  } catch (error) {
    console.error("Football API proxy error:", error);
    return res.status(502).json({
      error: "Unable to reach the football data service.",
      code: "FOOTBALL_API_NETWORK_ERROR",
    });
  }
}
