// Serverless proxy for API-Football. The key stays on the server.
// Set SCOUTWAVE_FOOTBALL_API_KEY in Vercel -> Project Settings -> Environment
// Variables (and in a local .env for `vercel dev`).

const API_BASE = "https://v3.football.api-sports.io";

// endpoint -> edge cache lifetime in seconds
const ENDPOINT_TTL = {
  leagues: 600,
  teams: 600,
  "teams/statistics": 600,
  venues: 600,
  players: 600,
  "players/squads": 600,
  "players/topscorers": 600,
  "players/topassists": 600,
  "players/topyellowcards": 600,
  "players/topredcards": 600,
  standings: 300,
  fixtures: 30,
  "fixtures/headtohead": 600,
  "fixtures/events": 30,
  "fixtures/lineups": 30,
  "fixtures/statistics": 30,
  predictions: 600,
  odds: 60,
  "players/seasons": 3600,
  "teams/seasons": 3600,
  coachs: 600,
  trophies: 600,
  transfers: 600,
};

const ALLOWED_PARAMS = new Set([
  "id", "ids", "search", "league", "season", "team", "date", "timezone", "next",
  "last", "fixture", "h2h", "live", "current", "page", "venue", "country", "type",
  "player", "coach", "from", "to", "round", "status",
]);

const MAX_PARAM_LENGTH = 120;

function providerErrorMessage(errors) {
  if (!errors) return "The football data provider rejected the request.";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) {
    return errors.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean).join("; ");
  }
  return Object.entries(errors)
    .map(([key, value]) => key + ": " + (Array.isArray(value) ? value.join(", ") : String(value)))
    .join("; ");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = String(process.env.SCOUTWAVE_FOOTBALL_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      error: "Set SCOUTWAVE_FOOTBALL_API_KEY in the Vercel project environment variables.",
      code: "MISSING_FOOTBALL_API_KEY",
    });
  }

  const rawEndpoint = req.query?.endpoint;
  const endpoint = String(Array.isArray(rawEndpoint) ? rawEndpoint[0] : rawEndpoint || "").replace(/^\/+|\/+$/g, "");

  if (!Object.prototype.hasOwnProperty.call(ENDPOINT_TTL, endpoint)) {
    return res.status(400).json({ error: "Unsupported football endpoint.", code: "INVALID_ENDPOINT" });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "endpoint" || value == null) continue;
    if (!ALLOWED_PARAMS.has(key)) {
      return res.status(400).json({ error: "Unsupported parameter: " + key, code: "INVALID_PARAMETER" });
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      const str = String(item);
      if (str.length > MAX_PARAM_LENGTH) {
        return res.status(400).json({ error: "Parameter too long: " + key, code: "INVALID_PARAMETER" });
      }
      params.append(key, str);
    }
  }

  try {
    const response = await fetch(API_BASE + "/" + endpoint + (params.toString() ? "?" + params : ""), {
      headers: { "x-apisports-key": apiKey, Accept: "application/json" },
    });

    const data = await response.json().catch(() => null);

    if (data?.errors && Object.keys(data.errors).length) {
      const message = providerErrorMessage(data.errors);
      const rateLimited = /\brequests\b|rate.?limit|request limit|quota|too many/i.test(message);
      return res.status(rateLimited ? 429 : 502).json({
        error: message,
        code: rateLimited ? "FOOTBALL_API_RATE_LIMIT" : "FOOTBALL_API_PROVIDER_ERROR",
        details: data.errors,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Football data request failed (HTTP " + response.status + ").",
        code: "FOOTBALL_API_HTTP_ERROR",
      });
    }

    const ttl = ENDPOINT_TTL[endpoint];
    res.setHeader("Cache-Control", "public, s-maxage=" + ttl + ", stale-while-revalidate=" + ttl * 4);
    // Pass `response` through untouched: it is an array for most endpoints but a
    // single object for teams/statistics (flattening it to [] hid team stats).
    return res.status(200).json(data?.response ?? []);
  } catch (error) {
    console.error("Football API proxy error:", error);
    return res.status(502).json({
      error: "Unable to reach the football data service.",
      code: "FOOTBALL_API_NETWORK_ERROR",
    });
  }
}
