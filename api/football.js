// Serverless proxy for API-Football. The key stays on the server.
// Set SCOUTWAVE_FOOTBALL_API_KEY in Vercel -> Project Settings -> Environment
// Variables (and in a local .env for `vercel dev`).

import { recordUsage } from "./_usage.js";

const API_BASE = "https://v3.football.api-sports.io";

// endpoint -> edge cache lifetime in seconds
const MIN = 60, HOUR = 3600, DAY = 86400;
const ENDPOINT_TTL = {
  leagues: 3 * DAY,
  teams: 3 * DAY,
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
  "fixtures/headtohead": 12 * HOUR,
  "fixtures/rounds": 12 * HOUR,
  "fixtures/events": 30,
  "fixtures/lineups": 30,
  "fixtures/statistics": 30,
  "fixtures/players": 30,
  odds: 60,
  "players/seasons": DAY,
  "teams/seasons": DAY,
  coachs: 3 * DAY,
  trophies: 3 * DAY,
  transfers: DAY,
};


const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const OVER = new Set(["FT", "AET", "PEN"]);
const DETAILS = new Set(["fixtures/events", "fixtures/lineups", "fixtures/statistics", "fixtures/players"]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// How long the shared (edge) cache may keep an answer, in seconds. Everyone shares this cache, so it is where a
// football API call is saved for ALL users at once. The idea: the less likely an answer is to change, the longer it
// stays. Decided from the answer itself, so it can never be longer than the data allows.
export function ttlFor(endpoint, params, data, now = Date.now(), settled = false) {
  const base = ENDPOINT_TTL[endpoint];
  const rows = Array.isArray(data) ? data : [];
  const statusOf = (fx) => fx?.fixture?.status?.short;
  const kickoff = (fx) => new Date(fx?.fixture?.date).getTime();

  if (endpoint === "fixtures" && rows.length) {
    if (rows.some((fx) => LIVE.has(statusOf(fx)))) return base; // something is live: keep it fresh
    if (rows.every((fx) => OVER.has(statusOf(fx)))) {
      const newest = Math.max(...rows.map(kickoff));
      if (now - newest > 3 * HOUR * 1000) return params.id || params.date ? DAY : 6 * HOUR; // long over: final (a score correction is rare)
      return 10 * MIN;                                                              // just finished: corrections and stats settle
    }
    const upcoming = rows.filter((fx) => statusOf(fx) === "NS").map(kickoff).filter(Number.isFinite);
    if (upcoming.length) {
      const next = Math.min(...upcoming) - now;
      if (next < 10 * MIN * 1000) return base;                  // about to start
      return clamp(Math.floor(next / 4000), 2 * MIN, 10 * MIN); // a quarter of the wait, between 2 and 10 minutes
    }
    return 2 * MIN;
  }
  if (endpoint === "fixtures" && params.date && !rows.length) return 10 * MIN; // nothing scheduled (yet)

  // Details of a match the app knows ended more than 3 hours ago never change. Capped at 30 minutes on purpose:
  // the hint comes from the browser, so it must not be able to keep live data for long.
  if (DETAILS.has(endpoint) && settled) return 30 * MIN;

  if (endpoint === "standings") {
    if (Number(params.season) && Number(params.season) < new Date(now).getUTCFullYear() - (new Date(now).getUTCMonth() < 6 ? 1 : 0)) return 7 * DAY; // a finished season
    const updates = rows.flatMap((r) => (r?.league?.standings || []).flat()).map((row) => new Date(row?.update).getTime()).filter(Number.isFinite);
    if (updates.length) return clamp(Math.floor((now - Math.max(...updates)) / 12000), base, HOUR); // a table that has been quiet for a day can wait up to an hour
  }
  return base;
}

const ALLOWED_PARAMS = new Set([
  "id", "ids", "search", "league", "season", "team", "date", "timezone", "next",
  "last", "fixture", "h2h", "live", "current", "page", "venue", "country", "type",
  "player", "coach", "from", "to", "round", "status",
  "settled", // proxy-only hint (never sent to the provider): the app knows this match ended long ago
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
    console.error("Football data is not configured: the provider key is missing.");
    return res.status(503).json({ error: "Football data is unavailable right now.", code: "MISSING_FOOTBALL_API_KEY" });
  }

  const rawEndpoint = req.query?.endpoint;
  const endpoint = String(Array.isArray(rawEndpoint) ? rawEndpoint[0] : rawEndpoint || "").replace(/^\/+|\/+$/g, "");

  if (!Object.prototype.hasOwnProperty.call(ENDPOINT_TTL, endpoint)) {
    return res.status(400).json({ error: "Bad request.", code: "INVALID_ENDPOINT" });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "endpoint" || value == null) continue;
    if (!ALLOWED_PARAMS.has(key)) {
      return res.status(400).json({ error: "Bad request.", code: "INVALID_PARAMETER" });
    }
    if (key === "settled") continue; // read below, never forwarded
    for (const item of Array.isArray(value) ? value : [value]) {
      const str = String(item);
      if (str.length > MAX_PARAM_LENGTH) {
        return res.status(400).json({ error: "Bad request.", code: "INVALID_PARAMETER" });
      }
      params.append(key, str);
    }
  }

  try {
    const response = await fetch(API_BASE + "/" + endpoint + (params.toString() ? "?" + params : ""), {
      headers: { "x-apisports-key": apiKey, Accept: "application/json" },
    });

    const data = await response.json().catch(() => null);
    // Every request that reaches here used one provider call (edge-cached answers never get here).
    await recordUsage("proxy", endpoint, 1, !response.ok || (data?.errors && Object.keys(data.errors).length) ? 1 : 0);

    if (data?.errors && Object.keys(data.errors).length) {
      const message = providerErrorMessage(data.errors);
      const rateLimited = /\brequests\b|rate.?limit|request limit|quota|too many/i.test(message);
      // When the limit is hit every visitor would otherwise hit the provider again; let the edge answer for a minute.
      if (rateLimited) res.setHeader("Cache-Control", "public, s-maxage=60");
      return res.status(rateLimited ? 429 : 502).json({
        error: message,
        code: rateLimited ? "FOOTBALL_API_RATE_LIMIT" : "FOOTBALL_API_PROVIDER_ERROR",
        details: data.errors,
      });
    }

    if (!response.ok) {
      console.error("Football data provider answered HTTP", response.status);
      return res.status(response.status).json({ error: "Football data is unavailable right now.", code: "FOOTBALL_API_HTTP_ERROR" });
    }

    const ttl = ttlFor(endpoint, Object.fromEntries(params), data?.response, Date.now(), req.query?.settled === "1");
    res.setHeader("Cache-Control", "public, s-maxage=" + ttl + ", stale-while-revalidate=" + Math.min(ttl * 4, 7 * DAY));
    // Pass `response` through untouched: it is an array for most endpoints but a
    // single object for teams/statistics (flattening it to [] hid team stats).
    return res.status(200).json(data?.response ?? []);
  } catch (error) {
    console.error("Football API proxy error:", error);
    return res.status(502).json({
      error: "Football data is unavailable right now.",
      code: "FOOTBALL_API_NETWORK_ERROR",
    });
  }
}
