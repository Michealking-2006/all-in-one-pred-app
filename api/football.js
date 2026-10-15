// Serverless proxy for API-Football. The key stays on the server.
// Set SCOUTWAVE_FOOTBALL_API_KEY in Vercel -> Project Settings -> Environment
// Variables (and in a local .env for `vercel dev`).

const API_BASE = "https://v3.football.api-sports.io";

// endpoint -> edge cache lifetime in seconds
const MIN = 60, HOUR = 3600, DAY = 86400;
const ENDPOINT_TTL = {
  leagues: DAY,
  teams: DAY,
  "teams/statistics": HOUR,
  venues: 365 * DAY,
  players: DAY,
  "players/profiles": DAY,
  "players/squads": DAY,
  "players/topscorers": HOUR,
  "players/topassists": HOUR,
  "players/topyellowcards": HOUR,
  "players/topredcards": HOUR,
  standings: 10 * MIN,
  fixtures: 30,
  "fixtures/headtohead": 6 * HOUR,
  "fixtures/rounds": 6 * HOUR,
  "fixtures/events": 30,
  "fixtures/lineups": 30,
  "fixtures/statistics": 30,
  "fixtures/players": 30,
  predictions: HOUR,
  odds: 60,
  "players/seasons": DAY,
  "teams/seasons": DAY,
  coachs: DAY,
  trophies: DAY,
  transfers: DAY,
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

    let ttl = ENDPOINT_TTL[endpoint];
    // A fixtures answer where every match is over can't change: cache it longer.
    if (endpoint === "fixtures" && Array.isArray(data?.response) && data.response.length &&
        data.response.every((fx) => ["FT", "AET", "PEN"].includes(fx?.fixture?.status?.short))) {
      ttl = HOUR;
    }
    res.setHeader("Cache-Control", "public, s-maxage=" + ttl + ", stale-while-revalidate=" + Math.min(ttl * 4, 7 * DAY));
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
