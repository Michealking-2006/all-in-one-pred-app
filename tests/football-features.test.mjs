// Run with:  node tests/football-features.test.mjs
// Match diary, your-club widget and shortcuts, followed players, transfers & injuries, season recap, rivalry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

// ---- a small fake browser ------------------------------------------------------------------------------------------
const memory = {};
globalThis.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = String(v); }, removeItem: (k) => { delete memory[k]; } };
globalThis.sessionStorage = globalThis.localStorage;
class El {
  constructor(t) { this.tag = t; this.children = []; this.attrs = {}; this.listeners = {}; this.style = { setProperty: (k, v) => { this.style[k] = v; } }; this.classes = new Set(); this.isConnected = false; this.dataset = {}; this.childNodes = []; this.innerHTML = ""; this.classList = { add: (c) => this.classes.add(c), toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)), contains: (c) => this.classes.has(c) }; }
  setAttribute(k, v) { this.attrs[k] = v; } hasAttribute(k) { return k in this.attrs; } getAttribute(k) { return this.attrs[k]; }
  addEventListener(k, f) { (this.listeners[k] ||= []).push(f); }
  appendChild(c) { this.children.push(c); return c; } append(...c) { c.forEach((x) => this.appendChild(x)); }
  replaceChildren(...c) { this.children = c; } remove() {} querySelector() { return null; }
}
const loc = { href: "https://app.myscoutwave.com/", origin: "https://app.myscoutwave.com", get pathname() { return new URL(this.href).pathname; }, get search() { return new URL(this.href).search; } };
globalThis.window = { location: loc, history: { pushState(_s, _t, u) { loc.href = new URL(u, loc.href).href; }, replaceState(_s, _t, u) { loc.href = new URL(u, loc.href).href; } }, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout, setInterval, clearInterval };
globalThis.document = { body: new El("body"), hidden: false, documentElement: new El("html"), createElement: (t) => new El(t), createElementNS: (_n, t) => new El(t), createTextNode: (t) => ({ text: t }), addEventListener() {} };
globalThis.Event = class { constructor(t) { this.type = t; } };
const texts = (n, out = []) => { if (!n) return out; if (n.text !== undefined) out.push(n.text); n.children?.forEach((c) => texts(c, out)); return out; };
const find = (n, cls, out = []) => { if (n?.attrs && new RegExp("(^| )" + cls + "( |$)").test(n.attrs.class || "")) out.push(n); n?.children?.forEach((c) => find(c, cls, out)); return out; };

const diary = await import("../src/diary.js");
const my = await import("../src/myClub.js");
const fp = await import("../src/followedPlayers.js");
const hub = await import("../src/hub.js");
const rec = await import("../src/recap.js");
const riv = await import("../src/rivalry.js");
const { store } = await import("../src/store.js");
const { initRouter, navigate } = await import("../src/router.js");
const { NEWS_TAGS, tagById } = await import("../src/newsTags.js");

const team = (id, name) => ({ id, name, logo: `https://media.api-sports.io/football/teams/${id}.png` });
const game = (id, date, h, a, gh, ga, status = "FT", league = { id: 39, name: "Premier League" }) => ({ fixture: { id, date, status: { short: status } }, league, teams: { home: team(...h), away: team(...a) }, goals: { home: gh, away: ga } });

// ---- match diary --------------------------------------------------------------------------------------------------
await test("diary: entries are cleaned on the way in and out", () => {
  assert.equal(diary.sanitizeEntry({ id: 0 }), null); assert.equal(diary.sanitizeEntry({ id: "x" }), null); assert.equal(diary.sanitizeEntry(null), null);
  const e = diary.sanitizeEntry({ id: 5, kind: "bogus", rating: 9, note: "  " + "n".repeat(900) + "  ", match: { home: { id: 1, name: "A", logo: "javascript:alert(1)" }, away: { id: 2, name: "B", logo: "https://x.test/b.png" }, goals: { home: 2, away: "x" } } });
  assert.equal(e.kind, "watched"); assert.equal(e.rating, 0); assert.equal(e.note.length, 500); assert.equal(e.match.home.logo, ""); assert.equal(e.match.away.logo, "https://x.test/b.png"); assert.equal(e.match.goals.away, null);
  assert.equal(diary.sanitizeEntry({ id: 5, rating: 3.6 }).rating, 4);
});
await test("diary: save, replace, remove, newest match first, survives broken storage", () => {
  memory["scoutwave.diary"] = "{not json"; assert.deepEqual(diary.loadDiary(), []);
  delete memory["scoutwave.diary"];
  const m = (d, h, a, gh, ga) => ({ date: d, league: "PL", home: team(1, h), away: team(2, a), goals: { home: gh, away: ga } });
  diary.saveEntry({ id: 1, kind: "attended", rating: 5, note: "Great", match: m("2026-03-01T15:00:00Z", "A", "B", 2, 1) });
  diary.saveEntry({ id: 2, kind: "watched", rating: 3, note: "", match: m("2026-04-10T15:00:00Z", "C", "D", 0, 0) });
  assert.deepEqual(diary.loadDiary().map((e) => e.id), [2, 1]);
  diary.saveEntry({ id: 1, kind: "watched", rating: 2, match: m("2026-03-01T15:00:00Z", "A", "B", 2, 1) });
  assert.equal(diary.loadDiary().length, 2); assert.equal(diary.entryFor(1).kind, "watched"); assert.equal(diary.entryFor("1").rating, 2);
  diary.removeEntry(2); assert.deepEqual(diary.loadDiary().map((e) => e.id), [1]); assert.equal(diary.entryFor(99), null);
});
await test("diary: stats and month groups", () => {
  const mk = (id, kind, rating, date, gh, ga) => diary.sanitizeEntry({ id, kind, rating, match: { date, goals: { home: gh, away: ga } } });
  const list = [mk(1, "attended", 5, "2026-04-10T12:00:00", 2, 1), mk(2, "watched", 3, "2026-04-02T12:00:00", 0, 0), mk(3, "watched", 0, "2026-03-20T12:00:00", 1, 1)];
  assert.deepEqual(diary.diaryStats(list), { total: 3, attended: 1, watched: 2, average: 4, goals: 5 });
  assert.equal(diary.diaryStats([]).average, null);
  const g = diary.groupByMonth(list); assert.deepEqual(g.map((x) => [x.label, x.entries.length]), [["April 2026", 2], ["March 2026", 1]]);
  assert.deepEqual(diary.snapshotOf({ fixture: { date: "d" }, league: { name: "L" }, teams: { home: team(1, "A"), away: team(2, "B") }, goals: { home: 1, away: 0 } }).goals, { home: 1, away: 0 });
});

// ---- your club: widget, shortcut ------------------------------------------------------------------------------------
await test("your club: live beats everything, then a fresh result, then the next match", () => {
  const now = Date.parse("2026-11-14T15:00:00Z"), T = 49;
  const at = (min, status, id, h = [49, "C"], a = [33, "U"]) => game(id, new Date(now + min * 60000).toISOString(), h, a, 1, 0, status);
  assert.equal(my.clubState({ today: [at(-30, "2H", 1)], next: [at(300, "NS", 2)] }, T, now).kind, "live");
  assert.equal(my.clubState({ today: [at(-200, "FT", 1)], next: [at(300, "NS", 2)] }, T, now).kind, "result");
  assert.equal(my.clubState({ last: [at(-60 * 20, "FT", 1)], next: [at(300, "NS", 2)] }, T, now).fx.fixture.id, 2);
  assert.equal(my.clubState({ next: [at(-5, "NS", 3)] }, T, now).kind, "next"); // just kicked off, not yet live in the data
  assert.equal(my.clubState({ next: [at(-30, "NS", 3)] }, T, now).kind, "none");
  assert.equal(my.clubState({ today: [at(-30, "2H", 4, [8, "X"], [9, "Y"])] }, T, now).kind, "none", "other clubs' matches are ignored");
  assert.equal(my.clubState({ last: [at(-60 * 30, "FT", 5)] }, T, now).kind, "result", "nothing else known: the last result");
  assert.equal(my.targetPath({ fx: at(5, "NS", 7) }, T), "/match/7"); assert.equal(my.targetPath({ fx: null }, T), "/club/49");
});
await test("your club: kick-off wording", () => {
  const now = new Date(2026, 10, 14, 15, 0).getTime(), at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
  assert.match(my.kickoffLabel(at(14, 20, 0), now).when, /^Today at /); assert.equal(my.kickoffLabel(at(14, 20, 0), now).soon, "in 5h");
  assert.match(my.kickoffLabel(at(15, 12, 0), now).when, /^Tomorrow at /); assert.equal(my.kickoffLabel(at(15, 12, 0), now).soon, "in 21h"); assert.equal(my.kickoffLabel(at(16, 12, 0), now).soon, "");
  assert.equal(my.kickoffLabel(at(14, 15, 30), now).soon, "in 30 min"); assert.equal(my.kickoffLabel(at(14, 17, 15), now).soon, "in 2h 15m");
  assert.equal(my.kickoffLabel(at(14, 14, 0), now).soon, ""); assert.deepEqual(my.kickoffLabel(NaN, now), { when: "", soon: "" });
  assert.equal(my.seasonFor(Date.UTC(2026, 7, 1)), 2026); assert.equal(my.seasonFor(Date.UTC(2026, 4, 1)), 2025);
  assert.equal(my.recapSeason(new Date(2026, 5, 15).getTime()), 2025); assert.equal(my.recapSeason(new Date(2026, 10, 15).getTime()), null);
});
await test("your club: the Home card draws live, next and result without errors", async () => {
  const { drawWidget } = await import("../src/components/ClubWidget.js");
  const club = { primary: "#034694", secondary: "#fff" }, now = Date.parse("2026-11-14T15:00:00Z");
  const fx = game(9, "2026-11-14T20:00:00Z", [49, "Chelsea"], [33, "Man United"], 2, 1, "2H"); fx.fixture.status.elapsed = 67;
  const live = drawWidget({ kind: "live", fx }, club, now); assert.match(live.attrs["aria-label"], /Live now: Chelsea 2.1 Man United\. 67'/);
  const next = drawWidget({ kind: "next", fx: { ...fx, fixture: { ...fx.fixture, status: { short: "NS" } } } }, club, now); assert.match(next.attrs["aria-label"], /Next match: Chelsea v Man United/);
  assert.match(drawWidget({ kind: "result", fx }, club, now).attrs["aria-label"], /Full time/); assert.equal(drawWidget({ kind: "none", fx: null }, club, now), null);
});
await test("shortcuts: the app icon offers four, each opening a real screen", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.shortcuts.length, 4);
  initRouter();
  for (const s of manifest.shortcuts) {
    assert.ok(s.name && s.short_name.length <= 12 && s.url.startsWith("/") && s.icons?.[0]?.src, s.name);
    loc.href = "https://app.myscoutwave.com" + s.url; window.history.pushState({}, "", s.url); navigate(s.url);
    const st = store.getState(); assert.ok(st.tab === s.url.slice(1) || (s.url === "/livescores" && st.tab === "home"), s.url + " -> " + st.tab);
  }
});

// ---- followed players ---------------------------------------------------------------------------------------------
await test("followed players: remembered with their club, forgotten, capped, and sent as a clean map", () => {
  fp.rememberPlayer({ player: { id: 154, name: "Mo", photo: "https://x.test/p.png" }, statistics: [{ team: { id: 40, name: "Liverpool" } }] });
  fp.rememberPlayer({ player: { id: 0 } }); fp.rememberPlayer(null);
  assert.deepEqual(fp.playerTeams([154, 999]), { 154: 40 });
  fp.rememberPlayer({ player: { id: 154, name: "Mo" }, statistics: [{ team: { id: 42, name: "Arsenal" } }] }); // a transfer
  assert.deepEqual(fp.playerTeams([154]), { 154: 42 });
  fp.forgetPlayer(154); assert.deepEqual(fp.playerTeams([154]), {});
  for (let i = 1; i <= 60; i++) fp.rememberPlayer({ player: { id: i, name: "P" + i }, statistics: [{ team: { id: 1 } }] });
  assert.equal(Object.keys(fp.loadFollowed()).length, 50); assert.equal(fp.loadFollowed()[1], undefined);
  memory["scoutwave.players"] = "[1,2]"; assert.deepEqual(fp.loadFollowed(), {});
});
await test("followed players: goals, penalties, own goals, assists and cards; nothing else", () => {
  const ev = (min, type, detail, player, assist, extra) => ({ time: { elapsed: min, extra: extra || null }, type, detail, player: { id: player, name: "P" + player }, assist: { id: assist || null, name: assist ? "P" + assist : null } });
  const a = fp.followedAlerts([ev(5, "Goal", "Normal Goal", 1, 2), ev(6, "Goal", "Penalty", 3), ev(7, "Goal", "Missed Penalty", 1), ev(8, "Goal", "Own Goal", 4, 1), ev(9, "Card", "Yellow Card", 1), ev(10, "Card", "Second Yellow card", 3), ev(11, "subst", "Substitution", 1, 2), ev(90, "Card", "Red Card", 2, null, 4)], [1, 2, 3]);
  assert.deepEqual(a.map((x) => x.kind + ":" + x.playerId), ["goal:1", "assist:2", "penalty:3", "yellow:1", "red:3", "red:2"]);
  assert.equal(fp.alertText(a[0]), "P1 scored (5')"); assert.equal(fp.alertText(a[5]), "P2 was sent off (90+4')"); assert.equal(fp.alertText(a[1]), "P2 set up a goal (5')");
  assert.equal(new Set(a.map((x) => x.key)).size, a.length); assert.deepEqual(fp.followedAlerts(null, [1]), []); assert.deepEqual(fp.followedAlerts([ev(1, "Goal", "Normal Goal", 9)], []), []);
});

// ---- transfers & injuries -----------------------------------------------------------------------------------------
await test("transfers: one line per player, the club's side of the move, within the window, newest first", () => {
  const now = Date.parse("2026-11-14T12:00:00Z"), T = 49;
  const mv = (id, name, date, type, inT, outT) => ({ player: { id, name }, transfers: [{ date, type, teams: { in: { id: inT, name: "In" + inT, logo: "l" }, out: { id: outT, name: "Out" + outT, logo: "l" } } }] });
  const rows = [mv(1, "Signed", "2026-08-01", "\u20ac 40M", 49, 7), mv(2, "Sold", "2026-09-15", "N/A", 8, 49), mv(3, "Old", "2024-01-01", "Free", 49, 9), mv(4, "Elsewhere", "2026-08-01", "Free", 5, 6),
    { player: { id: 5, name: "Twice" }, transfers: [{ date: "2025-12-01", type: "Loan", teams: { in: { id: 60, name: "Loanee", logo: "" }, out: { id: 49, name: "C", logo: "" } } }, { date: "2026-07-01", type: "Free", teams: { in: { id: 49, name: "C", logo: "" }, out: { id: 60, name: "Loanee", logo: "" } } }] }];
  const out = hub.recentTransfers(rows, T, now);
  assert.deepEqual(out.map((m) => m.name), ["Sold", "Signed", "Twice"]);
  assert.deepEqual(out.map((m) => m.direction), ["out", "in", "in"]); assert.equal(out[0].fee, "Undisclosed"); assert.equal(out[1].fee, "\u20ac 40M"); assert.equal(out[0].other.name, "In8");
  assert.deepEqual(hub.recentTransfers(null, T, now), []); assert.deepEqual(hub.recentTransfers([{ player: {}, transfers: [{ date: "bad" }] }], T, now), []);
});
await test("injuries: each player once, recent or upcoming only, definitely out before doubtful", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const r = (id, name, type, reason, date) => ({ player: { id, name, type, reason, photo: "p" }, fixture: { id: id * 10, date } });
  const out = hub.currentInjuries([r(1, "Zed", "Missing Fixture", "Knee Injury", "2026-11-10T15:00:00Z"), r(1, "Zed", "Missing Fixture", "Knee Injury", "2026-11-20T15:00:00Z"), r(2, "Amy", "Questionable", "Muscle", "2026-11-18T15:00:00Z"), r(3, "Old", "Missing Fixture", "Ankle", "2026-09-01T15:00:00Z"), r(4, "Bob", "Missing Fixture", "Hamstring", "2026-11-12T15:00:00Z"), { player: {}, fixture: {} }], now);
  assert.deepEqual(out.map((p) => p.name + ":" + (p.out ? "out" : "doubt")), ["Zed:out", "Bob:out", "Amy:doubt"]);
  assert.deepEqual(hub.currentInjuries(undefined, now), []);
});
await test("news: topic and club must both match; a themed club uses its own tag, others their name", () => {
  const a = (title, description = "") => ({ title, description });
  const list = [a("Chelsea sign a striker in a \u00a360m transfer"), a("Arsenal transfer news"), a("Chelsea injury blow ahead of derby"), a("Chelsea beat Spurs"), a("Brighton loan deal agreed for winger")];
  assert.deepEqual(hub.newsAbout(list, { id: "chelsea", name: "Chelsea" }, "transfers").map((x) => x.title), [list[0].title]);
  assert.deepEqual(hub.newsAbout(list, { id: "chelsea", name: "Chelsea" }, "injuries").map((x) => x.title), [list[2].title]);
  assert.deepEqual(hub.newsAbout(list, { id: 0, name: "Brighton" }, "transfers").map((x) => x.title), [list[4].title]);
  assert.ok(tagById("injuries") && tagById("transfers")); assert.ok(NEWS_TAGS.filter((t) => t.id === "injuries").length === 1);
  assert.deepEqual(hub.newsAbout(null, { id: "chelsea" }, "transfers"), []);
});

// ---- season recap -------------------------------------------------------------------------------------------------
await test("recap: record, best and worst result, runs, main league, top scorer, table position", () => {
  const C = [49, "Chelsea"], d = (n) => `2026-0${1 + Math.floor(n / 10)}-${String(1 + (n % 10) * 2).padStart(2, "0")}T15:00:00Z`;
  const fixtures = [
    game(1, d(0), C, [1, "A"], 3, 0), game(2, d(1), [2, "B"], C, 1, 1), game(3, d(2), C, [3, "D"], 5, 0), game(4, d(3), [4, "E"], C, 2, 0), game(5, d(4), C, [5, "F"], 2, 1),
    game(6, d(5), [6, "G"], C, 0, 1), game(7, d(6), C, [7, "H"], 1, 0, "NS"), game(8, d(7), [9, "I"], [10, "J"], 4, 4), game(9, d(8), C, [11, "K"], 1, 1, "PEN", { id: 2, name: "FA Cup" }),
  ];
  const scorers = [{ player: { id: 1, name: "Palmer", photo: "p" }, statistics: [{ team: { id: 49 }, goals: { total: 18, assists: 9 } }] }, { player: { id: 2, name: "Jackson" }, statistics: [{ team: { id: 49 }, goals: { total: 12 } }] }, { player: { id: 3, name: "Other" }, statistics: [{ team: { id: 33 }, goals: { total: 30 } }] }];
  const r = rec.seasonRecap(fixtures, 49, { scorers, standing: { rank: 2, points: 71 } });
  assert.deepEqual(r.record, { played: 7, won: 4, drawn: 2, lost: 1, goalsFor: 13, goalsAgainst: 5, cleanSheets: 3 });
  assert.equal(r.best.opponent.name, "D"); assert.equal(`${r.best.gf}-${r.best.ga}`, "5-0"); assert.equal(r.best.home, true);
  assert.equal(r.worst.opponent.name, "E"); assert.equal(r.unbeaten, 3, "after the 2-0 defeat: W, W, then the cup tie that went to penalties (a draw)"); assert.equal(r.winStreak, 2);
  assert.equal(r.league.id, 39); assert.deepEqual(r.topScorer, { id: 1, name: "Palmer", photo: "p", goals: 18, assists: 9 }); assert.equal(r.standing.rank, 2);
  const none = rec.seasonRecap([], 49); assert.equal(none.record.played, 0); assert.equal(none.best, null); assert.equal(none.topScorer, null); assert.equal(rec.seasonRecap(null, 49).record.played, 0);
});
await test("recap: league table row, season and ordinal wording", () => {
  const rows = [{ league: { standings: [[{ rank: 1, team: { id: 33 }, points: 80, all: { played: 38, win: 25, draw: 5, lose: 8 } }, { rank: 2, team: { id: 49 }, points: 71, all: { played: 38, win: 21, draw: 8, lose: 9 } }]] } }];
  assert.deepEqual(rec.standingOf(rows, 49), { rank: 2, points: 71, played: 38, won: 21, drawn: 8, lost: 9 }); assert.equal(rec.standingOf(rows, 1), null); assert.equal(rec.standingOf(null, 49), null);
  assert.equal(rec.seasonLabel(2025), "2025/26"); assert.equal(rec.seasonLabel(2099), "2099/00");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(rec.ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
});
await test("recap: the card draws the whole story, and leaves out what it doesn't have", async () => {
  const { recapCard } = await import("../src/components/RecapScreen.js");
  const full = rec.seasonRecap([game(1, "2026-01-01T15:00:00Z", [49, "Chelsea"], [1, "A"], 4, 0), game(2, "2026-01-08T15:00:00Z", [2, "B"], [49, "Chelsea"], 0, 2), game(3, "2026-01-15T15:00:00Z", [49, "Chelsea"], [3, "C"], 1, 0)], 49, { standing: { rank: 3, points: 66 }, scorers: [{ player: { id: 1, name: "Palmer" }, statistics: [{ team: { id: 49 }, goals: { total: 15 } }] }] });
  const club = { name: "Chelsea", logo: "https://x.test/c.png", primary: "#034694", secondary: "#fff" };
  const words = texts(recapCard(club, 2025, full, false)).join(" | ");
  for (const s of ["Chelsea", "2025/26 season", "Won", "Finished 3rd", "66 points in the Premier League", "4\u20130 v A", "Palmer, 15 goals", "3 games"]) assert.ok(words.includes(s), s + " in: " + words);
  const so = texts(recapCard(club, 2026, rec.seasonRecap([game(1, "2026-01-01T15:00:00Z", [49, "Chelsea"], [1, "A"], 0, 0)], 49), true)).join(" | ");
  assert.ok(so.includes("2026/27 so far") && !so.includes("Finished") && !so.includes("Top scorer") && !so.includes("unbeaten"));
});

// ---- rivalry ------------------------------------------------------------------------------------------------------
await test("rivalry: record from one side, biggest wins, goals, both-scored, unbeaten runs, newest meetings first", () => {
  const A = [529, "Barcelona"], B = [541, "Real Madrid"];
  const meets = [game(1, "2026-01-10T20:00:00Z", A, B, 2, 1), game(2, "2025-10-26T20:00:00Z", B, A, 2, 1), game(3, "2025-04-20T20:00:00Z", A, B, 4, 0), game(4, "2024-10-26T20:00:00Z", B, A, 0, 4), game(5, "2024-04-20T20:00:00Z", A, B, 1, 1), game(6, "2023-04-20T20:00:00Z", B, A, 3, 0), game(7, "2027-01-01T20:00:00Z", A, B, 0, 0, "NS"), game(8, "2025-01-01T20:00:00Z", [1, "X"], [2, "Y"], 9, 9)];
  const s = riv.rivalryStats(meets, 529, 541);
  assert.equal(s.played, 6); assert.equal(s.aWins, 3); assert.equal(s.bWins, 2); assert.equal(s.draws, 1);
  assert.equal(s.aGoals, 2 + 1 + 4 + 4 + 1 + 0); assert.equal(s.bGoals, 1 + 2 + 0 + 0 + 1 + 3);
  assert.equal(s.avgGoals, 3.2); assert.equal(s.bothScoredPct, 50); assert.equal(`${s.biggestA.ga}-${s.biggestA.gb}`, "4-0"); assert.equal(`${s.biggestB.ga}-${s.biggestB.gb}`, "0-3");
  assert.equal(s.unbeatenA, 1, "lost the second-latest meeting"); assert.equal(s.unbeatenB, 0); assert.deepEqual(s.recent.map((g) => g.fx.fixture.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(riv.rivalryStats([], 1, 2).played, 0); assert.equal(riv.rivalryStats(null, 1, 2).avgGoals, 0);
  const flip = riv.rivalryStats(meets, 541, 529); assert.equal(flip.aWins, 2); assert.equal(flip.bWins, 3);
});
await test("rivalry: form (oldest first, finished only) and the derby names", () => {
  const T = [49, "C"], O = [9, "O"];
  const fs = [game(1, "2026-01-01T15:00:00Z", T, O, 1, 0), game(2, "2026-01-08T15:00:00Z", O, T, 2, 2), game(3, "2026-01-15T15:00:00Z", T, O, 0, 1), game(4, "2026-01-22T15:00:00Z", O, T, 0, 3), game(5, "2026-01-29T15:00:00Z", T, O, 5, 5, "NS"), game(6, "2026-02-05T15:00:00Z", T, O, 2, 0), game(7, "2026-02-12T15:00:00Z", T, O, 1, 3)];
  assert.deepEqual(riv.teamForm(fs, 49), ["D", "L", "W", "W", "L"]); assert.deepEqual(riv.teamForm(fs, 49, 2), ["W", "L"]); assert.deepEqual(riv.teamForm(null, 49), []);
  assert.equal(riv.derbyName(529, 541), "El Cl\u00e1sico"); assert.equal(riv.derbyName(541, 529), "El Cl\u00e1sico"); assert.equal(riv.derbyName(33, 50), "Manchester derby"); assert.equal(riv.derbyName(49, 541), ""); assert.equal(riv.derbyName("x", 1), "");
});
await test("rivalry: /h2h/<team>-<team> opens the page; a half-written link doesn't", () => {
  const go = (path) => { loc.href = "https://app.myscoutwave.com" + path; navigate(path); return store.getState(); };
  assert.deepEqual(go("/h2h/49-33").openEntity, { type: "h2h", id: 49, vs: 33 });
  assert.equal(go("/h2h/49").openEntity?.type === "h2h", false); assert.equal(go("/h2h/x-y").openEntity?.type === "h2h", false);
  assert.deepEqual(go("/club/49").openEntity, { type: "club", id: 49 }); assert.equal(go("/diary").tab, "diary"); assert.equal(go("/hub").tab, "hub"); assert.equal(go("/recap").tab, "recap"); assert.equal(go("/my-club").tab, "my-club");
});

// ---- screens that render without a network -------------------------------------------------------------------------
await test("diary screen: empty state, then stats and month groups once there are entries", async () => {
  delete memory["scoutwave.diary"];
  const { DiaryScreen } = await import("../src/components/DiaryScreen.js");
  assert.ok(texts(DiaryScreen({ onBack() {} })).join(" ").includes("Your diary is empty"));
  diary.saveEntry({ id: 1, kind: "attended", rating: 4, note: "Brilliant night", match: { date: "2026-03-01T15:00:00Z", league: "Premier League", home: team(49, "Chelsea"), away: team(33, "Man United"), goals: { home: 2, away: 1 } } });
  const words = texts(DiaryScreen({ onBack() {} })).join(" | ");
  for (const s of ["Matches", "In the stadium", "March 2026", "Chelsea v Man United", "Brilliant night", "There", "\u2605\u2605\u2605\u2605\u2606"]) assert.ok(words.includes(s), s + " in " + words);
});
console.log("\n" + passed + " tests passed");
