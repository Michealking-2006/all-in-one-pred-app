const API_BASE_URL = "https://v3.football.api-sports.io";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = globalThis.__SCOUTWAVE_ENTITY_CACHE || new Map();
globalThis.__SCOUTWAVE_ENTITY_CACHE = cache;

const LEAGUE_ALIASES = {
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
    throw new Error("Football API is not configured on the server.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": credential,
      accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Football API HTTP ${response.status}`);
  }

  if (data?.errors && Object.keys(data.errors).length) {
    throw new Error(String(Object.values(data.errors)[0]));
  }

  return data?.response || [];
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
  return {
    type,
    id: value?.id,
    name: value?.name || [value?.firstname, value?.lastname].filter(Boolean).join(" "),
    slug: type === "player"
      ? slugify([value?.firstname, value?.lastname].filter(Boolean).join(" "))
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
  const searchTerm = slug === "laliga" ? "La Liga" : slug.replace(/-/g, " ");
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

  // League first, then club, then player. This keeps common football names
  // deterministic while still allowing every entity type to use one URL.
  const finders = [findLeague, findClub, findPlayer];

  for (const finder of finders) {
    const entity = await finder(normalized);
    if (entity) {
      save(key, entity);
      return entity;
    }
  }

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

    if (!entity) {
      return res.status(404).json({
        error: "Entity not found",
        slug: slugify(slug),
      });
    }

    return res.status(200).json({ entity });
  } catch (error) {
    console.error("[Scoutwave] entity resolver error", error);
    return res.status(502).json({ error: "Unable to resolve entity" });
  }
};
