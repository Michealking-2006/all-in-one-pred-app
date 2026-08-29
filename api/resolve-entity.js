const { football } = require("./_lib/football-api");
const { slugify } = require("./_lib/entity-utils");

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

function leagueEntity(item) {
  const league = item?.league;
  const country = item?.country;
  return {
    type: "league", id: league.id, name: league.name, slug: slugify(league.name),
    logo: league.logo || null, country: country?.name || null,
    countryCode: country?.code || null, flag: country?.flag || null,
  };
}

function clubEntity(item) {
  const team = item?.team;
  return {
    type: "club", id: team.id, name: team.name, slug: slugify(team.name),
    logo: team.logo || null, country: team.country || null,
    founded: team.founded || null, venue: item?.venue || null,
  };
}

function playerEntity(item) {
  const player = item?.player;
  const name = [player?.firstname, player?.lastname].filter(Boolean).join(" ");
  return {
    type: "player", id: player.id, name: name || player?.name || "",
    slug: slugify(name || player?.name), photo: player.photo || null,
    nationality: player.nationality || null, age: player.age || null,
    firstname: player.firstname || null, lastname: player.lastname || null,
  };
}

async function resolveLeague(slug) {
  const knownId = KNOWN_LEAGUE_IDS[slug];
  const results = knownId
    ? await football(`/leagues?id=${knownId}`)
    : await football(`/leagues?search=${encodeURIComponent(slug.replace(/-/g, " "))}`);
  const match = results.find(x => slugify(x?.league?.name) === slug || Number(x?.league?.id) === knownId);
  return match ? leagueEntity(match) : null;
}

async function resolveClub(slug) {
  const results = await football(`/teams?search=${encodeURIComponent(slug.replace(/-/g, " "))}`);
  const match = results.find(x => slugify(x?.team?.name) === slug);
  return match ? clubEntity(match) : null;
}

async function resolvePlayer(slug) {
  const words = slug.replace(/-/g, " ").trim().split(/\s+/).filter(Boolean);
  const terms = [...new Set([words.join(" "), words.slice(0, 2).join(" "), words.at(-1)])].filter(x => x.length >= 3);

  for (const term of terms) {
    const results = await football(`/players/profiles?search=${encodeURIComponent(term)}`);
    const match = results.find(x => {
      const name = [x?.player?.firstname, x?.player?.lastname].filter(Boolean).join(" ");
      return slugify(name) === slug || slugify(x?.player?.name) === slug;
    });
    if (match) return playerEntity(match);
  }

  return null;
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

  for (const resolver of [resolveLeague, resolveClub, resolvePlayer]) {
    try {
      const entity = await resolver(slug);
      if (entity) {
        res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
        return res.status(200).json({ entity });
      }
    } catch (error) {
      console.error("[Scoutwave] entity resolver failed:", error.message);
      if (resolver === resolveLeague && KNOWN_LEAGUE_IDS[slug]) {
        return res.status(502).json({ error: "Football data provider unavailable" });
      }
    }
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(404).json({ error: "Entity not found", slug });
};
