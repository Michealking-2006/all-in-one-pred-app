// The numbers behind the club page cards: last five results, top performers, a slice of the league
// table, and the league-position history. Pure functions (no DOM, no network) so they are tested.
import { resultFor } from "./utils/fixtures.js";

const byTime = (a, b) => (a.fixture?.timestamp || 0) - (b.fixture?.timestamp || 0);

// The last `n` finished matches, NEWEST FIRST, with the opponent and the score as played (home-away).
export function lastResults(fixtures, teamId, n = 5) {
  return (Array.isArray(fixtures) ? fixtures : [])
    .filter((fx) => resultFor(fx, teamId))
    .sort(byTime)
    .slice(-n)
    .reverse()
    .map((fx) => {
      const home = fx.teams.home.id === teamId;
      const opponent = home ? fx.teams.away : fx.teams.home;
      return {
        fixtureId: fx.fixture?.id,
        result: resultFor(fx, teamId),
        home,
        opponent: { id: opponent.id, name: opponent.name, logo: opponent.logo },
        score: `${fx.goals?.home ?? 0}-${fx.goals?.away ?? 0}`,
        goalsFor: home ? fx.goals.home : fx.goals.away,
        goalsAgainst: home ? fx.goals.away : fx.goals.home,
      };
    });
}

// "WWDLW", oldest to newest, from the same list.
export const formString = (fixtures, teamId, n = 5) => lastResults(fixtures, teamId, n).map((r) => r.result).reverse().join("");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// players endpoint rows -> { scorer, assister, rated }. Only this club's own numbers count (a player on
// loan has rows for other clubs), added up across every competition the club played in.
export function topPerformers(rows, teamId) {
  const people = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const mine = (row.statistics || []).filter((s) => s?.team?.id === teamId);
    if (!mine.length || !row.player?.id) continue;
    let goals = 0, pens = 0, assists = 0, apps = 0, ratingSum = 0, ratingApps = 0;
    for (const s of mine) {
      const a = num(s.games?.appearences);
      goals += num(s.goals?.total); pens += num(s.penalty?.scored); assists += num(s.goals?.assists); apps += a;
      const r = parseFloat(s.games?.rating);
      if (Number.isFinite(r) && a > 0) { ratingSum += r * a; ratingApps += a; }
    }
    people.push({ id: row.player.id, name: row.player.name || "", photo: row.player.photo || "", nationality: row.player.nationality || "", goals, pens, assists, apps, rating: ratingApps ? ratingSum / ratingApps : null });
  }
  const best = (list, key) => list.reduce((top, p) => (top === null || p[key] > top[key] || (p[key] === top[key] && p.apps < top.apps) ? p : top), null);
  const scorer = best(people.filter((p) => p.goals > 0), "goals");
  const assister = best(people.filter((p) => p.assists > 0), "assists");
  const rated = best(people.filter((p) => p.rating != null && p.apps >= 3), "rating");
  return { scorer, assister, rated };
}

// Three table rows around the team (the one above, the team, the one below); at the top or bottom of the table, the three nearest.
export function standingsWindow(rows, teamId, size = 3) {
  const table = (Array.isArray(rows) ? rows : []).filter((r) => r?.team?.id != null).sort((a, b) => a.rank - b.rank);
  const at = table.findIndex((r) => r.team.id === teamId);
  if (at < 0 || !table.length) return [];
  const count = Math.min(size, table.length);
  const start = Math.max(0, Math.min(at - Math.floor(count / 2), table.length - count));
  return table.slice(start, start + count);
}

// The league table to show: the standings object for the club's league, else the only/largest domestic-looking one.
export function pickTable(response, leagueId) {
  const entries = (Array.isArray(response) ? response : []).map((r) => r?.league).filter(Boolean);
  const withRows = entries.map((l) => ({ league: l, rows: (l.standings || []).flat() })).filter((e) => e.rows.length);
  return (withRows.find((e) => e.league.id === leagueId) || withRows.sort((a, b) => a.rows.length - b.rows.length).find((e) => e.rows.length >= 8) || withRows[0] || null);
}

// A club's position in the table the standings response holds for this league, or null (cups without a table, unknown club).
export function rankIn(response, leagueId, teamId) {
  const table = pickTable(response, leagueId);
  const row = table?.rows.find((r) => r.team?.id === teamId);
  return row && Number.isFinite(Number(row.rank)) ? Number(row.rank) : null;
}

// One season of history from standings?team=&season= (every competition the club had a table in).
// Prefers the club's usual league; a promoted or relegated club falls back to its single league table.
export function seasonRank(response, teamId, preferredLeagueId) {
  const table = pickTable(response, preferredLeagueId);
  const row = table?.rows.find((r) => r.team?.id === teamId);
  return row ? { rank: row.rank, league: table.league.name || "", teams: table.rows.length, points: row.points } : null;
}

// Chart geometry for the rank history. Rank 1 is at the TOP. A missing season breaks the line.
// points: [{ season, rank|null }] oldest first -> { width, height, coords, segments, ticks }
export function historyChart(points, { width = 320, height = 150, padX = 22, padTop = 20, padBottom = 14 } = {}) {
  const ranked = points.filter((p) => p.rank != null);
  const worst = Math.max(3, ...ranked.map((p) => p.rank));
  const innerW = width - padX * 2, innerH = height - padTop - padBottom;
  const x = (i) => (points.length <= 1 ? width / 2 : padX + (i / (points.length - 1)) * innerW);
  const y = (rank) => padTop + ((rank - 1) / (worst - 1)) * innerH;
  const coords = points.map((p, i) => (p.rank == null ? null : { x: Math.round(x(i) * 10) / 10, y: Math.round(y(p.rank) * 10) / 10, rank: p.rank, season: p.season }));
  const segments = [];
  let run = [];
  for (const c of coords) {
    if (c) run.push(c);
    else { if (run.length) segments.push(run); run = []; }
  }
  if (run.length) segments.push(run);
  return { width, height, worst, coords, segments, ticks: [1, Math.round((1 + worst) / 2), worst].filter((v, i, a) => a.indexOf(v) === i).map((rank) => ({ rank, y: Math.round(y(rank) * 10) / 10 })) };
}
