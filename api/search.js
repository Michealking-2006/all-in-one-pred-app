const { football } = require("./_lib/football-api");
const { slugify, normalizeSearchText, uniqueBy } = require("./_lib/entity-utils");

const LIMIT = 12;

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

function teamResult(item, type) {
  const team = item?.team || {};
  return {
    id: team.id,
    type,
    name: team.name || "",
    slug: slugify(team.name),
    icon: team.logo || "",
    country: team.country || "",
    code: team.code || "",
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
    city: item?.city || "",
  };
}

async function searchFixtures(query) {
  const teams = await football(`/teams?search=${encodeURIComponent(query)}`);
  const responses = await Promise.allSettled(
    teams.slice(0, 3).map(item => football(`/fixtures?team=${encodeURIComponent(item?.team?.id)}&next=10`))
  );
  const results = [];

  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const fixture of response.value) {
      const id = fixture?.fixture?.id;
      if (!id) continue;
      results.push({
        id,
        type: "matches",
        name: `${fixture?.teams?.home?.name || "Home"} vs ${fixture?.teams?.away?.name || "Away"}`,
        slug: `fixture-${id}`,
        icon: fixture?.league?.logo || "",
        country: fixture?.league?.name || "",
        date: fixture?.fixture?.date || "",
      });
      if (results.length >= LIMIT) return results;
    }
  }

  return results;
}

function rankResults(results, query) {
  const normalized = normalizeSearchText(query);

  return results.sort((a, b) => {
    const score = name =>
      name === normalized ? 100 :
      name.startsWith(normalized) ? 80 :
      name.includes(normalized) ? 50 : 0;

    const aName = normalizeSearchText(a.name);
    const bName = normalizeSearchText(b.name);
    return score(bName) - score(aName) || aName.localeCompare(bName);
  });
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

  try {
    let results = [];

    if (type === "leagues") {
      results = (await football(`/leagues?search=${encoded}`)).map(leagueResult);
    } else if (type === "players") {
      results = (await football(`/players/profiles?search=${encoded}`)).map(playerResult);
    } else if (type === "clubs") {
      results = (await football(`/teams?search=${encoded}`))
        .filter(x => x?.team?.national !== true)
        .map(x => teamResult(x, "clubs"));
    } else if (type === "teams") {
      results = (await football(`/teams?search=${encoded}`))
        .filter(x => x?.team?.national === true)
        .map(x => teamResult(x, "teams"));
    } else if (type === "venues") {
      results = (await football(`/venues?search=${encoded}`)).map(venueResult);
    } else if (type === "matches") {
      results = await searchFixtures(query);
    } else {
      const [leagues, teams, players, venues] = await Promise.allSettled([
        football(`/leagues?search=${encoded}`),
        football(`/teams?search=${encoded}`),
        football(`/players/profiles?search=${encoded}`),
        football(`/venues?search=${encoded}`),
      ]);

      const teamData = teams.status === "fulfilled" ? teams.value : [];
      results = [
        ...(players.status === "fulfilled" ? players.value.map(playerResult) : []),
        ...teamData.filter(x => x?.team?.national !== true).map(x => teamResult(x, "clubs")),
        ...(leagues.status === "fulfilled" ? leagues.value.map(leagueResult) : []),
        ...teamData.filter(x => x?.team?.national === true).map(x => teamResult(x, "teams")),
        ...(venues.status === "fulfilled" ? venues.value.map(venueResult) : []),
      ];
    }

    const unique = uniqueBy(
      rankResults(results, query),
      item => `${item.type}:${item.id || item.slug}`
    ).slice(0, LIMIT);

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ results: unique, total: unique.length });
  } catch (error) {
    console.error("[Scoutwave] search API error:", error);
    return res.status(502).json({ error: "Unable to search football data" });
  }
};
