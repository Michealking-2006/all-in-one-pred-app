const API_BASE_URL = "https://v3.football.api-sports.io";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function football(path) {
  const key = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!key) throw new Error("SCOUTWAVE_FOOTBALL_API_KEY is missing");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": key,
      accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Football API returned HTTP ${response.status}`);
  if (data?.errors && Object.keys(data.errors).length) {
    throw new Error("Football API returned an error");
  }

  return Array.isArray(data?.response) ? data.response : [];
}

function leagueResult(item) {
  const league = item?.league || {};
  const country = item?.country || {};
  return {
    id: league.id,
    type: "league",
    name: league.name || "",
    slug: slugify(league.name),
    icon: league.logo || "",
    country: country.name || "",
    code: country.code || "",
    flag: country.flag || "",
  };
}

function teamResult(item, type = "clubs") {
  const team = item?.team || {};
  const venue = item?.venue || {};
  return {
    id: team.id,
    type,
    name: team.name || "",
    slug: slugify(team.name),
    icon: team.logo || "",
    country: team.country || "",
    code: team.code || "",
    venue: venue.name || "",
  };
}

function playerResult(item) {
  const player = item?.player || {};
  const name = [player.firstname, player.lastname].filter(Boolean).join(" ") || player.name || "";
  return {
    id: player.id,
    type: "players",
    name,
    slug: slugify(name),
    icon: player.photo || "",
    country: player.nationality || "",
    age: player.age || null,
  };
}

function venueResult(item) {
  return {
    id: item?.id,
    type: "venues",
    name: item?.name || "",
    slug: slugify(item?.name),
    icon: "",
    country: item?.country || "",
    code: "",
    city: item?.city || "",
  };
}

async function searchFixtures(query, limit = 8) {
  const teams = await football(`/teams?search=${encodeURIComponent(query)}`);
  const candidates = teams.slice(0, 3);
  if (!candidates.length) return [];

  const responses = await Promise.allSettled(
    candidates.map(item => football(`/fixtures?team=${encodeURIComponent(item?.team?.id)}&next=10`))
  );

  const seen = new Set();
  const results = [];

  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const fixture of response.value) {
      const id = fixture?.fixture?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const home = fixture?.teams?.home?.name || "Home";
      const away = fixture?.teams?.away?.name || "Away";
      results.push({
        id,
        type: "matches",
        name: `${home} vs ${away}`,
        slug: `fixture-${id}`,
        icon: fixture?.league?.logo || "",
        country: fixture?.league?.name || "",
        date: fixture?.fixture?.date || "",
        route: null,
      });

      if (results.length >= limit) return results;
    }
  }

  return results;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String(req.query?.q || "").trim();
  const type = String(req.query?.type || "all").trim();

  if (query.length < 2 || query.length > 80) {
    return res.status(400).json({ error: "Search query must be between 2 and 80 characters" });
  }

  const encoded = encodeURIComponent(query);
  const limit = 12;

  try {
    let results = [];

    if (type === "leagues") {
      results = (await football(`/leagues?search=${encoded}`)).map(leagueResult);
    } else if (type === "players") {
      results = (await football(`/players/profiles?search=${encoded}`)).map(playerResult);
    } else if (type === "clubs") {
      results = (await football(`/teams?search=${encoded}`))
        .filter(item => item?.team && item.team.national !== true)
        .map(item => teamResult(item, "clubs"));
    } else if (type === "teams") {
      results = (await football(`/teams?search=${encoded}`))
        .filter(item => item?.team?.national === true)
        .map(item => teamResult(item, "teams"));
    } else if (type === "venues") {
      results = (await football(`/venues?search=${encoded}`)).map(venueResult);
    } else if (type === "matches") {
      results = await searchFixtures(query, limit);
    } else {
      const [leagues, teams, players, venues] = await Promise.allSettled([
        football(`/leagues?search=${encoded}`),
        football(`/teams?search=${encoded}`),
        football(`/players/profiles?search=${encoded}`),
        football(`/venues?search=${encoded}`),
      ]);

      const leagueResults = leagues.status === "fulfilled" ? leagues.value.map(leagueResult) : [];
      const teamResults = teams.status === "fulfilled" ? teams.value : [];
      const clubResults = teamResults
        .filter(item => item?.team?.national !== true)
        .map(item => teamResult(item, "clubs"));
      const nationalResults = teamResults
        .filter(item => item?.team?.national === true)
        .map(item => teamResult(item, "teams"));
      const playerResults = players.status === "fulfilled" ? players.value.map(playerResult) : [];
      const venueResults = venues.status === "fulfilled" ? venues.value.map(venueResult) : [];

      results = [
        ...playerResults,
        ...clubResults,
        ...leagueResults,
        ...nationalResults,
        ...venueResults,
      ];
    }

    const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    results.sort((a, b) => {
      const aName = String(a.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const bName = String(b.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const score = value => value === normalized ? 100 : value.startsWith(normalized) ? 80 : value.includes(normalized) ? 50 : 0;
      return score(bName) - score(aName) || aName.localeCompare(bName);
    });

    const unique = [];
    const seen = new Set();
    for (const item of results) {
      const key = `${item.type}:${item.id || item.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= limit) break;
    }

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ results: unique, total: unique.length });
  } catch (error) {
    console.error("[Scoutwave] search API error:", error);
    return res.status(502).json({ error: "Unable to search football data" });
  }
};
