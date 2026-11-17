// Head-to-head between two clubs: the record, biggest wins, recent meetings and each side's form. Pure functions (tested)
// plus one loader. The derby names are for famous pairs only; any two clubs get the page, just without a name.
import { getHeadToHead, getTeamFixtures, getTeamById } from "./api/footballApi.js";
import { getNextMeeting } from "./api/footballExtras.js";

const DONE = new Set(["FT", "AET", "PEN"]);
// team id pairs (the football data provider's ids) -> what the fixture is called
const PAIRS = [
  [529, 541, "El Cl\u00e1sico"], [541, 530, "Madrid derby"], [529, 540, "Barcelona derby"], [536, 543, "Seville derby"],
  [33, 50, "Manchester derby"], [33, 40, "North West derby"], [40, 45, "Merseyside derby"], [42, 47, "North London derby"], [49, 42, "London derby"], [49, 47, "London derby"],
  [157, 165, "Der Klassiker"], [489, 505, "Derby della Madonnina"], [496, 505, "Derby d'Italia"], [497, 487, "Derby della Capitale"], [496, 503, "Derby della Mole"],
  [85, 81, "Le Classique"], [247, 257, "Old Firm"], [211, 212, "O Cl\u00e1ssico"], [211, 228, "Derby de Lisboa"], [451, 435, "Superclásico"], [645, 611, "Intercontinental derby"], [194, 209, "De Klassieker"],
];
const key = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
const DERBIES = new Map(PAIRS.map(([a, b, name]) => [key(a, b), name]));
export const derbyName = (a, b) => DERBIES.get(key(Number(a), Number(b))) || "";

const finished = (fx) => DONE.has(fx?.fixture?.status?.short) && Number.isFinite(fx.goals?.home) && Number.isFinite(fx.goals?.away);
const time = (fx) => Date.parse(fx.fixture?.date) || 0;

// Finished meetings between a and b (any order, any competition) -> the record and the highlights from a's side.
export function rivalryStats(fixtures, a, b) {
  const games = (Array.isArray(fixtures) ? fixtures : []).filter((fx) => finished(fx) && [fx.teams?.home?.id, fx.teams?.away?.id].sort().join() === [a, b].sort().join()).sort((x, y) => time(y) - time(x));
  const view = games.map((fx) => { const aHome = fx.teams.home.id === a; const ga = aHome ? fx.goals.home : fx.goals.away, gb = aHome ? fx.goals.away : fx.goals.home; return { fx, ga, gb, winner: ga > gb ? a : ga < gb ? b : 0 }; });
  const aWins = view.filter((g) => g.winner === a).length, bWins = view.filter((g) => g.winner === b).length;
  const goals = view.reduce((s, g) => s + g.ga + g.gb, 0);
  const margin = (g) => Math.abs(g.ga - g.gb);
  const biggest = (id) => view.filter((g) => g.winner === id).sort((x, y) => margin(y) - margin(x) || (y.ga + y.gb) - (x.ga + x.gb) || time(y.fx) - time(x.fx))[0] || null;
  // How many of the latest meetings in a row a side has gone unbeaten against the other.
  const unbeatenRun = (id) => { let n = 0; for (const g of view) { if (g.winner && g.winner !== id) break; n++; } return n; };
  return {
    played: view.length, aWins, bWins, draws: view.length - aWins - bWins,
    aGoals: view.reduce((s, g) => s + g.ga, 0), bGoals: view.reduce((s, g) => s + g.gb, 0),
    avgGoals: view.length ? Math.round((goals / view.length) * 10) / 10 : 0,
    bothScoredPct: view.length ? Math.round((view.filter((g) => g.ga > 0 && g.gb > 0).length / view.length) * 100) : 0,
    biggestA: biggest(a), biggestB: biggest(b), unbeatenA: unbeatenRun(a), unbeatenB: unbeatenRun(b),
    recent: view.slice(0, 8),
  };
}

// The last `n` finished results for a team, oldest first: ["W","W","D","L","W"].
export function teamForm(fixtures, teamId, n = 5) {
  return (Array.isArray(fixtures) ? fixtures : []).filter((fx) => finished(fx) && (fx.teams?.home?.id === teamId || fx.teams?.away?.id === teamId))
    .sort((x, y) => time(y) - time(x)).slice(0, n).reverse()
    .map((fx) => { const home = fx.teams.home.id === teamId, gf = home ? fx.goals.home : fx.goals.away, ga = home ? fx.goals.away : fx.goals.home; return gf > ga ? "W" : gf < ga ? "L" : "D"; });
}

export async function loadRivalry(a, b) {
  const [h2h, formA, formB, next, teamA, teamB] = await Promise.all([
    getHeadToHead(a, b, 30).catch(() => null), getTeamFixtures(a, { last: 8 }).catch(() => []), getTeamFixtures(b, { last: 8 }).catch(() => []),
    getNextMeeting(a, b).catch(() => []), getTeamById(a).then((r) => r?.[0]?.team).catch(() => null), getTeamById(b).then((r) => r?.[0]?.team).catch(() => null),
  ]);
  const nextFx = (next || []).filter((fx) => ["NS", "TBD"].includes(fx.fixture?.status?.short)).sort((x, y) => time(x) - time(y))[0] || null;
  return { stats: rivalryStats(h2h || [], a, b), formA: teamForm(formA, a), formB: teamForm(formB, b), next: nextFx, teamA: teamA || { id: a, name: "Club", logo: "" }, teamB: teamB || { id: b, name: "Club", logo: "" }, failed: h2h === null };
}
