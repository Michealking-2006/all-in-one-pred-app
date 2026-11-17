// The four clubs the app can be themed around. No imports on purpose: the store, the boot script's rules and the
// tests all read this list, and it must be safe to load first.
//
// `primary` is the colour the whole app is built around (buttons, active states, links, avatars, headers); `secondary`
// is the club's other brand colour, used sparingly for highlights (the active-tab marker, the crest ring, the supporter
// badge). Barcelona is blaugrana (garnet and blue), Real Madrid blue and gold, Chelsea blue and gold, Manchester United
// red and yellow. Crests come from the same football-data image host as every other team logo in the app (the numbers
// are that provider's team ids), so they are always the real, current crest.
const crest = (teamId) => "https://media.api-sports.io/football/teams/" + teamId + ".png";

export const CLUBS = [
  { id: "barcelona", name: "Barcelona", short: "Barça", teamId: 529, logo: crest(529), primary: "#A50044", secondary: "#004D98", motto: "Més que un club" },
  { id: "real-madrid", name: "Real Madrid", short: "Real Madrid", teamId: 541, logo: crest(541), primary: "#00529F", secondary: "#FEBE10", motto: "Hala Madrid" },
  { id: "chelsea", name: "Chelsea", short: "Chelsea", teamId: 49, logo: crest(49), primary: "#034694", secondary: "#DBA111", motto: "Keep the blue flag flying high" },
  { id: "man-united", name: "Manchester United", short: "Man United", teamId: 33, logo: crest(33), primary: "#DA291C", secondary: "#FBE122", motto: "Glory glory" },
];

export const CLUB_IDS = CLUBS.map((club) => club.id);
export const clubById = (id) => CLUBS.find((club) => club.id === id) || null;
export const isHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));
