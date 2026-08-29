const API_BASE_URL = "https://v3.football.api-sports.io";

function getKey() {
  return process.env.SCOUTWAVE_FOOTBALL_API_KEY;
}

function normalizeLeague(item) {
  return {
    id: item?.league?.id || null,
    name: item?.league?.name || "",
    type: item?.league?.type || null,
    logo: item?.league?.logo || null,
    country: item?.country?.name || "International",
    countryCode: item?.country?.code || null,
    flag: item?.country?.flag || null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = getKey();
  if (!key) return res.status(500).json({ error: "Football API is not configured on the server." });

  try {
    const response = await fetch(`${API_BASE_URL}/leagues?current=true`, {
      headers: {
        "x-apisports-key": key,
        accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Football API HTTP ${response.status}`);
    if (data?.errors && Object.keys(data.errors).length) throw new Error(String(Object.values(data.errors)[0]));

    const leagues = (Array.isArray(data?.response) ? data.response : [])
      .map(normalizeLeague)
      .filter(league => league.id && league.name)
      .sort((a, b) => `${a.country}-${a.name}`.localeCompare(`${b.country}-${b.name}`));

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ leagues });
  } catch (error) {
    console.error("[Scoutwave] leagues API error", error);
    return res.status(502).json({ error: "Unable to load leagues" });
  }
};
