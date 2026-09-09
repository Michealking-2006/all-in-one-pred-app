// Deploy target: Vercel (or any platform that runs Node serverless functions
// under /api). This file never ships to the browser — the client only ever
// calls /api/football?... and gets back JSON, never the key itself.
//
// Set SCOUTWAVE_FOOTBALL_API_KEY in your deployment platform's environment
// variables (Vercel: Project Settings -> Environment Variables). Do NOT put
// the real key in this file or in any src/ file — anything under src/ ships
// to the browser as plain text.

const BASE_URL = "https://v3.football.api-sports.io";

// Endpoints this proxy is willing to forward. Whitelisting like this stops
// the client from turning this into an open proxy for arbitrary API calls.
const ALLOWED_ENDPOINTS = new Set(["leagues", "teams", "players", "venues", "fixtures", "standings"]);

export default async function handler(req, res) {
  const { endpoint, ...params } = req.query;

  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    res.status(400).json({ error: `Unknown or missing endpoint. Allowed: ${[...ALLOWED_ENDPOINTS].join(", ")}` });
    return;
  }

  const apiKey = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "SCOUTWAVE_FOOTBALL_API_KEY is not set on the server." });
    return;
  }

  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${endpoint}${query ? `?${query}` : ""}`;

  try {
    const apiRes = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
    });
    const data = await apiRes.json();
    res.status(apiRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream API-Football request failed." });
  }
}
