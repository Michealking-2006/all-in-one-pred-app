// Season recap for a club: record, goals, best result, longest unbeaten run, top scorer and league finish. The numbers
// come from every finished match of the club that season (all competitions); the scorer and the table position from the
// club's main league. seasonRecap() is pure and tested; loadRecap() fetches.
import { getTeamSeasonFixtures, getTopScorers, getStandings } from "./api/footballApi.js";

const DONE = new Set(["FT", "AET", "PEN"]);

export function seasonRecap(fixtures, teamId, { scorers = [], standing = null } = {}) {
  const games = (Array.isArray(fixtures) ? fixtures : [])
    .filter((fx) => DONE.has(fx.fixture?.status?.short) && Number.isFinite(fx.goals?.home) && Number.isFinite(fx.goals?.away) && (fx.teams?.home?.id === teamId || fx.teams?.away?.id === teamId))
    .map((fx) => {
      const home = fx.teams.home.id === teamId, gf = home ? fx.goals.home : fx.goals.away, ga = home ? fx.goals.away : fx.goals.home;
      return { fx, home, gf, ga, opponent: home ? fx.teams.away : fx.teams.home, result: gf > ga ? "W" : gf < ga ? "L" : "D", at: Date.parse(fx.fixture.date) || 0 };
    })
    .sort((a, b) => a.at - b.at);

  const count = (r) => games.filter((g) => g.result === r).length;
  const record = { played: games.length, won: count("W"), drawn: count("D"), lost: count("L"), goalsFor: games.reduce((s, g) => s + g.gf, 0), goalsAgainst: games.reduce((s, g) => s + g.ga, 0), cleanSheets: games.filter((g) => g.ga === 0).length };
  const margin = (g) => Math.abs(g.gf - g.ga);
  const best = games.filter((g) => g.result === "W").sort((a, b) => margin(b) - margin(a) || b.gf - a.gf || b.at - a.at)[0] || null;
  const worst = games.filter((g) => g.result === "L").sort((a, b) => margin(b) - margin(a) || b.ga - a.ga || b.at - a.at)[0] || null;

  let unbeaten = 0, wins = 0, u = 0, w = 0;
  for (const g of games) { u = g.result === "L" ? 0 : u + 1; w = g.result === "W" ? w + 1 : 0; unbeaten = Math.max(unbeaten, u); wins = Math.max(wins, w); }

  // The club's main league: the competition it played most matches in.
  const tally = new Map();
  for (const g of games) { const l = g.fx.league; if (l?.id) tally.set(l.id, { id: l.id, name: l.name, n: (tally.get(l.id)?.n || 0) + 1 }); }
  const league = [...tally.values()].sort((a, b) => b.n - a.n)[0] || { id: 0, name: "" };

  const mine = (Array.isArray(scorers) ? scorers : []).filter((s) => s.statistics?.[0]?.team?.id === teamId).sort((a, b) => (b.statistics[0].goals?.total || 0) - (a.statistics[0].goals?.total || 0))[0];
  const topScorer = mine ? { id: mine.player?.id, name: mine.player?.name || "", photo: mine.player?.photo || "", goals: mine.statistics[0].goals?.total || 0, assists: mine.statistics[0].goals?.assists || 0 } : null;

  return { record, best, worst, unbeaten, winStreak: wins, league: { id: league.id, name: league.name }, topScorer, standing };
}

// The club's row in a standings answer: { rank, points, played, won, drawn, lost } or null.
export function standingOf(rows, teamId) {
  for (const row of Array.isArray(rows) ? rows : []) {
    const entry = (row.league?.standings || []).flat().find((r) => r.team?.id === teamId);
    if (entry) return { rank: entry.rank, points: entry.points, played: entry.all?.played ?? 0, won: entry.all?.win ?? 0, drawn: entry.all?.draw ?? 0, lost: entry.all?.lose ?? 0 };
  }
  return null;
}

export const seasonLabel = (season) => `${season}/${String(season + 1).slice(2)}`;
export const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export async function loadRecap(club, season) {
  const fixtures = await getTeamSeasonFixtures(club.teamId, season);
  const base = seasonRecap(fixtures, club.teamId);
  if (!base.league.id) return base;
  const [scorers, table] = await Promise.all([getTopScorers(base.league.id, season).catch(() => []), getStandings(base.league.id, season, club.teamId).catch(() => [])]);
  return seasonRecap(fixtures, club.teamId, { scorers, standing: standingOf(table, club.teamId) });
}
