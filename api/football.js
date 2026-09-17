const API_BASE = "https://v3.football.api-sports.io";

const ALLOWED_ENDPOINTS = new Set([
  "leagues",
  "teams",
  "venues",
  "players",
  "standings",
  "fixtures",
  "players/topscorers",
]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Football data service is not configured." });
  }

  const endpoint = String(req.query.endpoint || "").replace(/^\/+|\/+$/g, "");
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: "Unsupported football endpoint." });
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "endpoint" || value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) params.append(key, String(item));
  }

  const url = `${API_BASE}/${endpoint}${params.toString() ? `?${params}` : ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Football data request failed.",
        details: data?.errors || undefined,
      });
    }

    if (data?.errors && Object.keys(data.errors).length > 0) {
      return res.status(502).json({
        error: "Football data provider returned an error.",
        details: data.errors,
      });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data?.response || []);
  } catch (error) {
    console.error("Football API proxy error:", error);
    return res.status(502).json({ error: "Unable to reach the football data service." });
  }
}
