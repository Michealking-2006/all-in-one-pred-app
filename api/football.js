const API_BASE_URL = "https://v3.football.api-sports.io";
const ALLOWED_PREFIXES = ["/standings", "/fixtures", "/teams", "/players", "/leagues"];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const credential = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!credential) {
    return res.status(500).json({ error: "Football API is not configured on the server." });
  }

  const path = String(req.query?.path || "");
  const allowed = ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}?`));
  if (!path.startsWith("/") || !allowed) {
    return res.status(400).json({ error: "Unsupported Football API endpoint" });
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "x-apisports-key": credential, accept: "application/json" },
    });

    const text = await response.text();
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.end(text);
  } catch (error) {
    console.error("[Scoutwave] Football API proxy error", error);
    return res.status(502).json({ error: "Unable to reach Football API" });
  }
};
