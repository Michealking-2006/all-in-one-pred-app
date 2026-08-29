const API_BASE_URL = "https://v3.football.api-sports.io";

async function football(path) {
  const key = process.env.SCOUTWAVE_FOOTBALL_API_KEY;

  if (!key) {
    throw new Error("SCOUTWAVE_FOOTBALL_API_KEY is missing");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "x-apisports-key": key,
      accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Football API returned HTTP ${response.status}`);
  }

  if (data?.errors && Object.keys(data.errors).length) {
    throw new Error("Football API returned an error");
  }

  return Array.isArray(data?.response) ? data.response : [];
}

module.exports = { API_BASE_URL, football };
