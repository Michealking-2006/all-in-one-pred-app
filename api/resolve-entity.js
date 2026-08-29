const API_BASE_URL = "https://v3.football.api-sports.io";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = globalThis.__SCOUTWAVE_ENTITY_CACHE || new Map();
globalThis.__SCOUTWAVE_ENTITY_CACHE = cache;

const LEAGUE_ALIASES = {
  "la-liga": "laliga",
  "la-liga-ea-sports": "laliga",
  "laliga-ea-sports": "laliga",
};

// Stable API-Football V3 league IDs for canonical/high-traffic routes.
// These avoid unnecessary name-search requests for leagues whose IDs are
// already stable in API-Football V3.
const KNOWN_LEAGUE_IDS = {
  laliga: 140,
  premier-league: 39,
  championship: 40,
  league-one: 41,
  league-two: 42,
  serie-a: 135,
  serie-b: 136,
  bundesliga: 78,
  ligue-1: 61,
  ligue-2: 62,
  eredivisie: 88,
  primeira-liga: 94,
  champions-league: 2,
  europa-league: 3,
  conference-league: 848,
};

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return LEAGUE_ALIASES[slug] || slug;
}

function playerSlugs(player) {
  const firstname = slugify(player?.firstname);
  const lastname = slugify(player?.lastname);
  const full = slugify(
    [player?.firstname, player?.lastname].filter(Boolean).join(" ")
  );

  return new Set([
    full,
    firstname && lastname ? `${firstname}-${lastname}` : "",
  ].filter(Boolean));
}

async function request(path) {
  const credential = process.env.SCOUTWAVE_FOOTBALL_API_KEY;

  if (!credential) {
    const error = new Error("Football API is not configured on the server.");
    error.code = "MISSING_API_KEY";
    throw error;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "x-apisports-key": credential,
        accept: "application/json",
      },
    });
  } catch (error) {
    const networkError = new Error("Unable to reach Football API.");
    networkError.code = "API_NETWORK_ERROR";
    networkError.cause = error;
    throw networkError;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || `Football API HTTP ${response.status}`
    );
    error.code = `API_HTTP_${response.status}`;
    throw error;
  }

  if (data?.errors && Object.keys(data.errors).length) {
    const message = String(Object.values(data.errors)[0]);
    const error = new Error(message);
    error.code = "API_RESPONSE_ERROR";
    throw error;
  }

  return Array.isArray(data?.response) ? data.response : [];
}

function cached(key) {
  const item = cache.get(key);
  if (!item) return undefined;

  if (Date.now() - item.time > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }

  return item.value;
}

function save(key, value) {
  cache.set(key, { time: Date.now(), value });
}

function makeEntity(type, value, parent = {}) {
  const playerName = [value?.firstname, value?.lastname]
    .filter(Boolean)
    .join(" ");

  return {
    type,
    id: value?.id || null,
    name: value?.name || playerName || "",
    slug: type === "player"
      ? slugify(playerName)
      : slugify(value?.name),
    logo: value?.logo || null,
    photo: value?.photo || null,
    country: parent?.country?.name || value?.country || null,
    countryCode: parent?.country?.code || null,
    flag: parent?.country?.flag || null,
    venue: parent?.venue || null,
    founded: value?.founded || null,
    firstname: value?.firstname || null,
    lastname: value?.lastname || null,
    age: value?.age || null,
    nationality: value?.nationality || null,
    team: parent?.team || null,
  };
}

async function findLeague(slug) {
  // Prefer the stable V3 ID when we already know the canonical mapping.
  const knownId = KNOWN_LEAGUE_IDS[slug];
  if (knownId) {
    const results = await request(`/leagues?id=${knownId}`);
    const match = results.find(entry => Number(entry?.league?.id) === knownId);
    if (match?.league?.id) return makeEntity("league", match.league, match);
  }

  const searchTerm = slug.replace(/-/g, " ");
  const results = await request(`/leagues?search=${encodeURIComponent(searchTerm)}`);
  const match = results.find(entry => slugify(entry?.league?.name) === slug);

  if (!match?.league?.id) return null;
  return makeEntity("league", match.league, match);
}

async function findClub(slug) {
  const searchTerm = slug.replace(/-/g, " ");
  const results = await request(`/teams?search=${encodeURIComponent(searchTerm)}`);
  const match = results.find(entry => slugify(entry?.team?.name) === slug);

  if (!match?.team?.id) return null;
  return makeEntity("club", match.team, match);
}

async function findPlayer(slug) {
  const searchTerm = slug.replace(/-/g, " ");
  const results = await request(`/players?search=${encodeURIComponent(searchTerm)}`);
  const match = results.find(entry => playerSlugs(entry?.player).has(slug));

  if (!match?.player?.id) return null;
  return makeEntity("player", match.player, match);
}

async function resolve(slug) {
  const normalized = slugify(slug);
  if (normalized.length < 3) return null;

  const key = `entity:${normalized}`;
  const existing = cached(key);
  if (existing !== undefined) return existing;

  const attempts = [
    ["league", findLeague],
    ["club", findClub],
    ["player", findPlayer],
  ];

  const errors = [];

  for (const [type, finder] of attempts) {
    try {
      const entity = await finder(normalized);
      if (entity) {
        save(key, entity);
        return entity;
      }
    } catch (error) {
      console.error(`[Scoutwave] entity ${type} lookup failed`, {
        slug: normalized,
        code: error?.code || "UNKNOWN",
      });
      errors.push(error);
    }
  }

  // Do not cache an upstream failure as a permanent 404.
  if (errors.length === attempts.length) return undefined;

  save(key, null);
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = String(req.query?.slug || "").trim();

  if (!slug || slug.length > 120 || slug.includes("/")) {
    return res.status(400).json({ error: "Invalid entity slug" });
  }

  try {
    const entity = await resolve(slug);

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=3600"
    );

    if (entity === undefined) {
      return res.status(502).json({
        error: "Football data provider unavailable",
      });
    }

    if (!entity) {
      return res.status(404).json({
        error: "Entity not found",
        slug: slugify(slug),
      });
    }

    return res.status(200).json({ entity });
  } catch (error) {
    console.error("[Scoutwave] entity resolver error", {
      code: error?.code || "UNKNOWN",
    });

    return res.status(502).json({
      error: "Unable to resolve entity",
    });
  }
};
