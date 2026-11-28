// The four quick-pick clubs. No imports on purpose: the store, the boot script's rules and the tests all read this list.
// `primary` is the colour the app is built around, `secondary` the club's other colour (highlights, crest ring, badge).
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

// Any other club comes from search, saved whole; its id is "t-" + the team id. Saved values are checked on the way back in.
const CREST = /^https:\/\/media\.api-sports\.io\/[\w./-]{1,80}$/;
const ID = /^t-[1-9]\d{0,8}$/;
export const isClubId = (id) => CLUB_IDS.includes(id) || ID.test(String(id));
const str = (v, n) => String(v || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
export const clubFromSaved = (v) => {
  if (!v || typeof v !== "object") return null;
  const f = clubById(v.id);
  if (f) return f;
  const name = str(v.name, 60), teamId = Number(String(v.id).slice(2));
  if (!ID.test(String(v.id)) || !name || !isHex(v.primary) || !isHex(v.secondary)) return null;
  return { id: v.id, name, short: str(v.short, 24) || name, teamId, logo: CREST.test(v.logo) ? v.logo : crest(teamId), primary: v.primary.toUpperCase(), secondary: v.secondary.toUpperCase(), motto: str(v.motto, 40), custom: true };
};
export const clubSnapshot = (c) => (!c ? null : c.custom ? { id: c.id, primary: c.primary, secondary: c.secondary, name: c.name, short: c.short, teamId: c.teamId, logo: c.logo, motto: c.motto, custom: true } : { id: c.id, primary: c.primary });
