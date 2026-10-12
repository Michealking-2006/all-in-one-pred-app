// Pure helpers for per-match player ratings (no DOM, easy to test).
// Source: API-Football `fixtures/players` -> [{ team, players: [{ player, statistics: [{ games: { rating, minutes, ... } }] }] }]

export function parseRating(value) {
  const n = parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : null;
}

export function formatRating(value) {
  const n = typeof value === "number" ? value : parseRating(value);
  return n == null ? "" : n.toFixed(1);
}

// good / ok / poor buckets drive the colour of the rating pill.
export function ratingTier(value) {
  const n = typeof value === "number" ? value : parseRating(value);
  if (n == null) return "none";
  if (n >= 8) return "great";
  if (n >= 7) return "good";
  if (n >= 6) return "ok";
  return "poor";
}

// Flattens the provider payload into Map<playerId, entry>. Players with no
// rating (unused substitutes, match not started) are skipped.
export function ratingMap(payload) {
  const map = new Map();
  for (const side of Array.isArray(payload) ? payload : []) {
    for (const item of side?.players || []) {
      const player = item?.player;
      const games = item?.statistics?.[0]?.games;
      const rating = parseRating(games?.rating);
      if (!player?.id || rating == null) continue;
      map.set(player.id, {
        id: player.id,
        name: player.name || "Unknown",
        photo: player.photo || "",
        teamId: side?.team?.id ?? null,
        rating,
        minutes: games?.minutes ?? null,
        number: games?.number ?? null,
        pos: games?.position || "",
        substitute: !!games?.substitute,
      });
    }
  }
  return map;
}

// Rated players of one side, best first.
export function sortedRatings(map, teamId) {
  return [...map.values()].filter((e) => e.teamId === teamId).sort((a, b) => b.rating - a.rating || (b.minutes ?? 0) - (a.minutes ?? 0));
}
