// Which competitions are predicted first. Pure functions, no network.
//
// Tiers, best first. Inside a tier the order of the lists below is the order used.
//   0  the big five leagues and the European club competitions
//   1  other first divisions, national-team tournaments and the big domestic cups
//   2  second divisions
//   3  anything not listed (small first divisions, regional cups ...)
//   4  lower divisions, youth, reserve, women's and amateur competitions, recognised by their name
// API-Football league ids. Edit freely; PREDICT_PRIORITY (comma-separated ids) puts extra
// competitions in front of everything else, in the order given.
const TIER0 = [39, 140, 135, 78, 61, 2, 3, 848];
const TIER1 = [
  1, 4, 5, 9, 531, // World Cup, Euro, Nations League, Copa America, UEFA Super Cup
  88, 94, 144, 203, 179, 71, 128, 253, 262, // Eredivisie, Primeira, Belgium, Turkey, Scotland, Brazil, Argentina, MLS, Liga MX
  307, 235, 197, 218, 207, 119, 103, 113, 106, 345, 283, 210, 333, 98, 292, 188, 169, // other first divisions
  13, 11, 17, 45, 143, 137, 81, 66, 48, // Libertadores, Sudamericana, AFC CL, FA Cup, Copa del Rey, Coppa Italia, DFB-Pokal, Coupe de France, League Cup
];
const TIER2 = [40, 141, 136, 79, 62, 89, 95, 145, 204, 180, 72, 129, 255, 263, 41, 42, 80];

const LOWER_NAME = /\b(u-?\d{2}|youth|junior|juvenil|reserves?|primavera|academy|development|women|feminin\w*|femenin\w*|frauen|amateur|regional\w*|oberliga|division [2-9]|league (one|two|1|2)|third|fourth|serie [cd]|segunda|liga [3-9]|national [23])\b/i;

const rankMap = (ids, tier) => ids.map((id, i) => [id, tier * 1000 + i]);
const LISTED = new Map([...rankMap(TIER0, 0), ...rankMap(TIER1, 1), ...rankMap(TIER2, 2)]);

// Lower number = predicted earlier. `boost` is a list of league ids that go before everything else.
export function leaguePriority(league, boost = []) {
  const id = Number(league?.id);
  const b = boost.indexOf(id);
  if (b >= 0) return -1000 + b;
  if (LISTED.has(id)) return LISTED.get(id);
  return LOWER_NAME.test(String(league?.name || "")) ? 4000 : 3000;
}

export const tierOf = (league, boost = []) => Math.max(0, Math.floor(leaguePriority(league, boost) / 1000));
