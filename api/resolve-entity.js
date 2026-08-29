const API_BASE_URL = "https://v3.football.api-sports.io";

const CURRENT_FOOTBALL_SEASON = 2026;
const PREVIOUS_FOOTBALL_SEASON = 2025;

const KNOWN_LEAGUE_IDS = {
  laliga: 140,
  "premier-league": 39,
  championship: 40,
  "league-one": 41,
  "league-two": 42,
  "serie-a": 135,
  "serie-b": 136,
  bundesliga: 78,
  "ligue-1": 61,
  "ligue-2": 62,
  eredivisie: 88,
  "primeira-liga": 94,
  "champions-league": 2,
  "europa-league": 3,
  "conference-league": 848,
};

const ALIASES = {
  "la-liga": "laliga",
  "la-liga-ea-sports": "laliga",
  "laliga-ea-sports": "laliga",
};

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ALIASES[slug] || slug;
}

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

function leagueEntity(item) {
  const league = item?.league;
  const country = item?.country;

  return {
    type: "league",
    id: league.id,
    name: league.name,
    slug: slugify(league.name),
    logo: league.logo || null,
    country: country?.name || null,
    countryCode: country?.code || null,
    flag: country?.flag || null,
  };
}

function clubEntity(item) {
  const team = item?.team;

  return {
    type: "club",
    id: team.id,
    name: team.name,
    slug: slugify(team.name),
    logo: team.logo || null,
    country: team.country || null,
    founded: team.founded || null,
    venue: item?.venue || null,
  };
}

function playerEntity(item) {
  const player = item?.player;
  const name = [player?.firstname, player?.lastname].filter(Boolean).join(" ");

  return {
    type: "player",
    id: player.id,
    name,
    slug: slugify(name),
    photo: player.photo || null,
    nationality: player.nationality || null,
    age: player.age || null,
    firstname: player.firstname || null,
    lastname: player.lastname || null,
  };
}

async function resolveLeague(slug) {
  const knownId = KNOWN_LEAGUE_IDS[slug];

  if (knownId) {
    const results = await football(`/leagues?id=${knownId}`);
    const match = results.find(x => Number(x?.league?.id) === knownId);
    return match ? leagueEntity(match) : null;
  }

  const results = await football(`/leagues?search=${encodeURIComponent(slug.replace(/-/g, " "))}`);
  const match = results.find(x => slugify(x?.league?.name) === slug);
  return match ? leagueEntity(match) : null;
}

async function resolveClub(slug) {
  const results = await football(`/teams?search=${encodeURIComponent(slug.replace(/-/g, " "))}`);
  const match = results.find(x => slugify(x?.team?.name) === slug);
  return match ? clubEntity(match) : null;
}

async function resolvePlayer(slug) {
  const search = encodeURIComponent(slug.replace(/-/g, " "));

  // API-Football season values represent the season's starting year.
  // Try the active season first, then the previous season because a player
  // may not yet have current-season statistics populated early in a season.
  const seasons = [CURRENT_FOOTBALL_SEASON, PREVIOUS_FOOTBALL_SEASON];

  for (const season of seasons) {
    const results = await football(`/players?search=${search}&season=${season}`);
    const match = results.find(x => {
      const name = [x?.player?.firstname, x?.player?.lastname]
        .filter(Boolean)
        .join(" ");
      return slugify(name) === slug;
    });

    if (match) return playerEntity(match);
  }

  // Final compatibility fallback for players that are searchable globally
  // but are not present in either season's player dataset yet.
  const results = await football(`/players?search=${search}`);
  const match = results.find(x => {
    const name = [x?.player?.firstname, x?.player?.lastname]
      .filter(Boolean)
      .join(" ");
    return slugify(name) === slug;
  });

  return match ? playerEntity(match) : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawSlug = String(req.query?.slug || "").trim();

  if (!rawSlug || rawSlug.length > 120 || rawSlug.includes("/")) {
    return res.status(400).json({ error: "Invalid entity slug" });
  }

  const slug = slugify(rawSlug);

  try {
    // Resolve leagues first. Known leagues require only one direct API call.
    const league = await resolveLeague(slug);
    if (league) {
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
      return res.status(200).json({ entity: league });
    }
  } catch (error) {
    console.error("[Scoutwave] league resolver failed:", error.message);

    // For known canonical leagues, this is an upstream/API failure, not a 404.
    if (KNOWN_LEAGUE_IDS[slug]) {
      return res.status(502).json({ error: "Football data provider unavailable" });
    }
  }

  try {
    const club = await resolveClub(slug);
    if (club) {
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
      return res.status(200).json({ entity: club });
    }
  } catch (error) {
    console.error("[Scoutwave] club resolver failed:", error.message);
  }

  try {
    const player = await resolvePlayer(slug);
    if (player) {
      res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
      return res.status(200).json({ entity: player });
    }
  } catch (error) {
    console.error("[Scoutwave] player resolver failed:", error.message);
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(404).json({
    error: "Entity not found",
    slug,
  });
};
