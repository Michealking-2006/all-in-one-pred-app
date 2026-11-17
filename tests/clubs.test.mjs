// Run with:  node tests/clubs.test.mjs   (no network, no browser)
// The four supported clubs, their real colours, readable text in both modes, and what a saved choice may be.
import assert from "node:assert/strict";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const { CLUBS, CLUB_IDS, clubById } = await import("../src/clubs.js");

await test("exactly four clubs, each with a real crest and its brand colours", () => {
  assert.deepEqual(CLUB_IDS, ["barcelona", "real-madrid", "chelsea", "man-united"]);
  const teamIds = { barcelona: 529, "real-madrid": 541, chelsea: 49, "man-united": 33 };
  for (const club of CLUBS) {
    assert.equal(club.teamId, teamIds[club.id]);
    assert.equal(club.logo, `https://media.api-sports.io/football/teams/${club.teamId}.png`);
    for (const c of [club.primary, club.secondary]) assert.match(c, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(clubById("barcelona").primary, "#A50044"); // blaugrana: garnet and blue
  assert.equal(clubById("barcelona").secondary, "#004D98");
  assert.equal(clubById("man-united").secondary, "#FBE122");
  assert.equal(clubById("arsenal"), null);
});

// Browser stubs just enough for the modules to load.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = globalThis.window || { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = globalThis.document || { documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" } }, querySelector: () => null };

await test("every club stays readable in light and dark mode", async () => {
  const { deriveClubTheme, contrast } = await import("../src/clubTheme.js");
  for (const club of CLUBS) for (const mode of ["light", "dark"]) {
    const v = deriveClubTheme(club, mode);
    const card = mode === "dark" ? "#1c1c1e" : "#ffffff";
    assert.ok(contrast(v["--accent-text"], card) >= 4.4, `${club.id} ${mode}: link text`);
    assert.ok(contrast(v["--club-2-text"], card) >= 4.4, `${club.id} ${mode}: second-colour text`);
    assert.ok(contrast(v["--on-accent"], v["--accent"]) >= 3, `${club.id} ${mode}: text on buttons`);
    assert.ok(contrast(v["--on-club-2"], v["--club-2"]) >= 3, `${club.id} ${mode}: text on second colour`);
    assert.ok(v["--club-crest"].includes(club.logo));
    // the same tokens the base stylesheet defines for the standard red, so every screen follows
    for (const t of ["--accent", "--accent-strong", "--accent-lift", "--accent-text", "--accent-soft", "--accent-wash", "--accent-glow", "--on-accent"]) assert.ok(v[t], `${club.id} ${mode}: ${t}`);
    assert.ok(!("--bg" in v), "no tint on the page background");
  }
});

await test("a saved choice must be one of the four; the colour always comes from our table", async () => {
  const KEY = "scoutwave.app.state.v2";
  const load = async (clubTheme, extra = {}) => {
    store.set(KEY, JSON.stringify({ clubTheme, ...extra }));
    return (await import("../src/store.js?x=" + Math.random())).store.getState();
  };
  assert.equal((await load({ id: "arsenal", primary: "#EF0107" })).clubTheme, null, "another club");
  assert.equal((await load({ id: "custom", primary: "#123456" })).clubTheme, null, "custom colour");
  const s = await load({ id: "chelsea", primary: "#ff0000" });
  assert.deepEqual(s.clubTheme, { id: "chelsea", primary: "#034694" });
  assert.equal((await load(null, { clubPromptUntil: 123 })).clubPromptUntil, 123);
  assert.equal((await load(null, { clubPromptUntil: -5 })).clubPromptUntil, 0);
});

console.log(`\n${passed} passed`);
