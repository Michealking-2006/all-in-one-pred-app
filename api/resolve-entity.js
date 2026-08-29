const API_BASE_URL = "https://v3.football.api-sports.io";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = globalThis.__SCOUTWAVE_ENTITY_CACHE || new Map();
globalThis.__SCOUTWAVE_ENTITY_CACHE = cache;

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const aliases = {
    "la-liga": "laliga",
  };

  return aliases[slug] || slug;
}

async function request(path) {
  const credential = process.env.SCOUTWAVE_FOOTBALL_API_KEY;
  if (!credential) throw new Error("Football API is not configured on the server.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "x-apisports-key": credential, accept: "application/json" }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Football API HTTP ${response.status}`);
  if (data?.errors && Object.keys(data.errors).length) throw new Error(String(Object.values(data.errors)[0]));
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

async function findEntity(type, endpoint, field, slug) {
  const searchTerm = slug === "laliga" ? "La Liga" : slug.replace(/-/g, " ");
  const results = await request(`${endpoint}?search=${encodeURIComponent(searchTerm)}`);
  const item = results.find(entry => slugify(entry?.[field]?.name) === slug);
  if (!item?.[field]?.id) return null;

  const value = item[field];
  return {
    type,
    id: value.id,
    name: value.name,
    slug,
    logo: value.logo || null,
    photo: value.photo || null,
    country: item.country?.name || value.country || null,
    countryCode: item.country?.code || null,
    flag: item.country?.flag || null,
    venue: item.venue || null,
    team: item.statistics?.[0]?.team || null,
    firstname: value.firstname || null,
    lastname: value.lastname || null,
    nationality: value.nationality || null
  };
}

async function resolve(slug) {
  const normalized = slugify(slug);
  if (normalized.length < 3) return null;

  const key = `entity:${normalized}`;
  const existing = cached(key);
  if (existing !== undefined) return existing;

  const definitions = [
    ["league", "/leagues", "league"],
    ["club", "/teams", "team"],
    ["player", "/players", "player"]
  ];

  for (const [type, endpoint, field] of definitions) {
    const entity = await findEntity(type, endpoint, field, normalized);
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
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    if (!entity) return res.status(404).json({ error: "Entity not found", slug: slugify(slug) });
    return res.status(200).json({ entity });
  } catch (error) {
    console.error("[Scoutwave] entity resolver error", error);
    return res.status(502).json({ error: "Unable to resolve entity" });
  }
};
