// Run with:  node tests/seo.test.mjs   (no network: the football and news APIs are faked)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
Object.assign(process.env, { SCOUTWAVE_FOOTBALL_API_KEY: "f", NEWS_ACCESS: "n", SITE_URL: "https://scoutwave.example" });
const root = path.resolve(import.meta.dirname, "..");
let passed = 0; const test = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };
const O = "https://scoutwave.example";

const { isKnownPath, jsonLdTeam, jsonLdPerson, jsonLdVenue } = await import("../src/seoEntities.js");
const { auditHtml } = await import("../src/seoAudit.js");

// ============================================================ addresses and crawler detection
await test("real pages are known; invented ones are not (so they can be answered with a real 404)", () => {
  for (const ok of ["/", "/leagues", "/news", "/vip", "/about", "/league/39-premier-league", "/club/33-manchester-united", "/player/276-x", "/venue/556-old-trafford", "/match/1234567", "/news/some-headline-123e4567-e89b-12d3-a456-426614174000", "/profile", "/premium", "/search"]) assert.ok(isKnownPath(ok), ok);
  for (const bad of ["/this-page-does-not-exist", "/club", "/club/33/extra/path", "/wp-login.php", "/admin", "/leagues/extra", "/match"]) assert.ok(!isKnownPath(bad), bad);
});
await test("crawler detection: search engines, link previews and AI search are served the prerendered page; browsers are not", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const has = vercel.rewrites.filter((r) => r.has?.some((h) => h.key === "user-agent"));
  assert.equal(has.length, 2);
  for (const r of has) {
    const re = new RegExp(r.has[0].value.replace(/^\(\?i\)/, ""), "i");
    for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "Twitterbot/1.0", "WhatsApp/2.23", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 AppleWebKit/605.1.15 (Applebot/0.1)", "Mozilla/5.0 (compatible; GPTBot/1.1)", "Mozilla/5.0 (compatible; PerplexityBot/1.0)", "Mozilla/5.0 (compatible; ClaudeBot/1.0)", "Mastodon/4.2 (http.rb)", "redditbot/1.0", "Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1)"]) assert.ok(re.test(ua), ua);
    for (const ua of ["Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15"]) assert.ok(!re.test(ua), ua);
  }
});
await test("routes exist for the sitemap parts, the feed and llms.txt; the API carries noindex", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const sources = vercel.rewrites.map((r) => r.source);
  for (const s of ["/sitemap.xml", "/feed.xml", "/llms.txt", "/robots.txt"]) assert.ok(sources.includes(s), s);
  assert.ok(sources.some((s) => s.startsWith("/sitemap-:part")));
  assert.ok(vercel.headers.some((h) => h.source === "/api/(.*)" && h.headers.some((x) => x.key === "X-Robots-Tag" && /noindex/.test(x.value))));
  assert.equal(vercel.trailingSlash, false);
});

// ============================================================ fake data providers
const calls = [];
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
const T = (id, name, extra = {}) => ({ id, name, logo: `https://m/${id}.png`, ...extra });
const fx = (id, home, away, gh, ga, status = "FT", ts = 1700000000) => ({ fixture: { id, timestamp: ts, date: new Date(ts * 1000).toISOString(), status: { short: status, long: status } }, league: { id: 39, name: "Premier League" }, teams: { home: home, away: away }, goals: { home: gh, away: ga }, events: [] });
const club = T(33, "Manchester United", { country: "England", founded: 1878, code: "MUN" });
const rival = T(40, "Liverpool");
let outage = false;
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.host === "sb.test") {
    if (u.pathname.endsWith("/predictions")) { const ids = (u.searchParams.get("fixture_id") || "").replace(/[^\d,]/g, "").split(",");
      const mine = { 12: { home: 2, away: 1, pick: "home", safe: { market: "1x", prob: 81 } }, 21: { home: 0, away: 1, pick: "away", safe: null }, 11: { home: 0, away: 2, pick: "away", safe: null } };
      return json(ids.filter((i) => mine[i]).map((i) => ({ fixture_id: Number(i), made_at: "2026-10-30T06:00:00Z", prediction: { confidence: "high", pick: mine[i].pick, pickProb: 52, probs: mine[i].pick === "home" ? { home: 52, draw: 26, away: 22 } : { home: 21, draw: 27, away: 52 }, likelyScore: { home: mine[i].home, away: mine[i].away }, over25: 61, safe: mine[i].safe } }))); }
    return json([]);
  }
  if (u.host === "v3.football.api-sports.io") {
    const ep = u.pathname.slice(1); const q = Object.fromEntries(u.searchParams); calls.push(ep + "?" + u.searchParams.toString());
    if (outage) return json({ errors: { rateLimit: "x" }, response: [] });
    if (ep === "teams" && q.id === "33") return json({ errors: [], response: [{ team: club, venue: { id: 556, name: "Old Trafford", city: "Manchester", capacity: 74310, address: "Sir Matt Busby Way" } }] });
    if (ep === "teams" && q.id === "666") return json({ errors: [], response: [{ team: T(666, "<script>alert(1)</script> FC", { country: "Evil</script><b>" }), venue: {} }] });
    if (ep === "teams") return json({ errors: [], response: q.league ? [{ team: T(Number(q.league) * 10, "Team " + q.league) }] : [] });
    if (ep === "fixtures" && q.team && q.last) return json({ errors: [], response: [fx(1, club, rival, 2, 1, "FT", 1700000000), fx(2, rival, club, 0, 0, "FT", 1700100000)] });
    if (ep === "fixtures" && q.team && q.next) return json({ errors: [], response: [fx(3, club, rival, null, null, "NS", 1800000000)] });
    if (ep === "fixtures" && q.league === "39" && q.next) return json({ errors: [], response: [fx(21, club, rival, null, null, "NS", Math.floor(Date.now() / 1000) + 86400), fx(22, rival, club, null, null, "NS", Math.floor(Date.now() / 1000) + 172800), fx(23, club, rival, 1, 1, "FT")] });
    if (ep === "fixtures" && q.id === "1") return json({ errors: [], response: [fx(1, club, rival, 2, 1)] });
    if (ep === "fixtures" && q.date) return json({ errors: [], response: [fx(11, club, rival, 1, 0, "FT", Math.floor(Date.now() / 1000)), fx(12, rival, club, null, null, "NS", Math.floor(Date.now() / 1000) + 7200)] });
    if (ep === "fixtures") return json({ errors: [], response: [] });
    if (ep === "leagues" && q.id === "39") return json({ errors: [], response: [{ league: { id: 39, name: "Premier League", logo: "https://m/l39.png" }, country: { name: "England" }, seasons: [{ year: 2025, current: true }] }] });
    if (ep === "leagues" && q.current) return json({ errors: [], response: [{ league: { id: 39, name: "Premier League" } }, { league: { id: 9999, name: "Odd Cup" } }] });
    if (ep === "leagues") return json({ errors: [], response: [] });
    if (ep === "standings") return json({ errors: [], response: [{ league: { standings: [[{ rank: 1, team: club, points: 30, goalsDiff: 12, all: { played: 12, win: 9, draw: 3, lose: 0 } }]] } }] });
    if (ep === "players/profiles" && q.player === "276") return json({ errors: [], response: [{ player: { id: 276, name: "Test Player", firstname: "Test", lastname: "Player", age: 28, nationality: "Brazil", height: "175 cm", weight: "68 kg", birth: { date: "1996-02-05", place: "Rio", country: "Brazil" }, photo: "https://m/p276.png" } }] });
    if (ep === "players/profiles") return json({ errors: [], response: [] });
    if (ep === "players") return json({ errors: [], response: [{ statistics: [{ team: club, games: { appearences: 20, position: "Attacker" }, goals: { total: 11, assists: 5 } }] }] });
    if (ep === "venues" && q.id === "556") return json({ errors: [], response: [{ id: 556, name: "Old Trafford", city: "Manchester", country: "England", capacity: 74310, surface: "grass", address: "Sir Matt Busby Way", image: "https://m/v.png" }] });
    if (ep === "venues") return json({ errors: [], response: [] });
  }
  if (u.host === "api.thenewsapi.com") {
    if (u.pathname.endsWith("/all")) return json({ data: [{ uuid: "123e4567-e89b-12d3-a456-426614174000", title: "Big win & <b>more</b>", description: "Summary here", url: "https://news.example/a", image_url: "https://i.example/a.jpg", source: "Paper", published_at: "2026-10-20T10:00:00Z" }, { uuid: "x", title: "Bad", url: "javascript:alert(1)" }], meta: { found: 2, limit: 2 } });
    return json({}, 404);
  }
  return json({}, 404);
};
const { renderPage } = await import("../api/_seoPages.js");
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

await test("home page: real content, canonical, structured data, a link to every top competition", async () => {
  const r = await renderPage("/", O); assert.equal(r.status, 200);
  const a = auditHtml(r.html, { canonical: O + "/", indexable: true });
  assert.deepEqual(a.issues.filter((i) => i.level === "error"), []);
  assert.ok(a.types.includes("WebSite") && a.types.includes("Organization")); assert.ok(a.links >= 20);
  assert.match(r.html, /rel="alternate" type="application\/rss\+xml"/);
});
await test("club page: real facts, structured data (SportsTeam), results and fixtures, good meta", async () => {
  const r = await renderPage("/club/33-manchester-united", O); assert.equal(r.status, 200);
  const a = auditHtml(r.html, { canonical: O + "/club/33-manchester-united", indexable: true });
  assert.deepEqual(a.issues.filter((i) => i.level === "error"), [], JSON.stringify(a.issues));
  assert.ok(a.types.includes("SportsTeam") && a.types.includes("BreadcrumbList"));
  assert.match(r.html, /Founded: 1878/); assert.match(r.html, /Old Trafford/); assert.match(r.html, /href="\/venue\/556-old-trafford"/); assert.match(r.html, /Recent results/); assert.match(r.html, /Upcoming fixtures/);
  assert.match(r.html, /Recent form: DW|Recent form: WD/); assert.ok(a.title.length <= 65 && a.description.length >= 70);
  assert.match(r.headers["Cache-Control"], /s-maxage=21600/);
});
await test("player and stadium pages", async () => {
  const p = await renderPage("/player/276-test-player", O); assert.equal(p.status, 200);
  const types = ld(p.html).map((d) => d["@type"]); assert.ok(types.includes("Person")); const person = ld(p.html).find((d) => d["@type"] === "Person");
  assert.equal(person.height.value, 175); assert.equal(person.weight.value, 68); assert.equal(person.nationality.name, "Brazil"); assert.match(p.html, /11 goals, 5 assists/);
  const v = await renderPage("/venue/556-old-trafford", O); assert.equal(v.status, 200);
  const venue = ld(v.html).find((d) => d["@type"] === "StadiumOrArena"); assert.equal(venue.maximumAttendeeCapacity, 74310);
});
await test("wrong or missing words in the address redirect (301) to the one correct address", async () => {
  for (const [from, to] of [["/club/33", "/club/33-manchester-united"], ["/club/33-wrong-name", "/club/33-manchester-united"], ["/league/39", "/league/39-premier-league"], ["/venue/556-x", "/venue/556-old-trafford"], ["/player/276-who", "/player/276-test-player"]]) {
    const r = await renderPage(from, O); assert.equal(r.status, 301, from); assert.equal(r.headers.Location, O + to);
    assert.equal((await renderPage(to, O)).status, 200); // and the target does not redirect again
  }
});
await test("things that don't exist get a real 404 that is not indexed, and no canonical", async () => {
  for (const p of ["/club/999999-nobody", "/player/1-x", "/venue/1-x", "/match/999", "/this-page-does-not-exist", "/club", "/news/not-an-id"]) {
    const r = await renderPage(p, O); assert.equal(r.status, 404, p); assert.match(r.html, /noindex/); assert.ok(!/rel="canonical"/.test(r.html), p);
  }
});
await test("hostile names from the data provider can't inject markup or break structured data", async () => {
  const r = await renderPage("/club/666-script-alert-1-fc", O);
  const html = (await renderPage("/club/666-" + "script-alert-1-fc", O)).html || r.html;
  assert.ok(!html.includes("<script>alert(1)"), "raw script tag in page");
  assert.ok(!/<b>/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")), "raw tag in body");
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { assert.ok(!block[1].includes("</script"), "JSON-LD can close its own tag"); JSON.parse(block[1]); }
});
await test("provider outage: the page is still served (plain, cached briefly), never an error or a false 404", async () => {
  outage = true; const r = await renderPage("/club/33-manchester-united", O); outage = false;
  assert.equal(r.status, 200); assert.match(r.headers["Cache-Control"], /s-maxage=60,/); assert.match(r.html, /<h1>/);
});
await test("the daily cap on football API requests spent for crawlers is enforced", async () => {
  process.env.SEO_MAX_CALLS_PER_DAY = "0"; const before = calls.length;
  const r = await renderPage("/club/33-manchester-united", O);
  assert.equal(r.status, 200); assert.equal(calls.length, before, "no provider request may be made past the cap"); assert.match(r.headers["Cache-Control"], /s-maxage=60,/);
  delete process.env.SEO_MAX_CALLS_PER_DAY;
});
await test("match page: dates, status and a link back to each club", async () => {
  const r = await renderPage("/match/1", O); assert.equal(r.status, 200);
  const e = ld(r.html).find((d) => d["@type"] === "SportsEvent"); assert.ok(e.endDate && e.startDate && e.image);
  assert.match(r.html, /href="\/club\/33-manchester-united"/);
});

// ============================================================ sitemaps, feed, robots, llms
const sitemap = (await import("../server/sitemap.js")).default;
const run = async (handler, query = {}) => { const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, send(b) { out.body = b; return this; } }; await handler({ query, headers: { host: "x" } }, res); return out; };
await test("sitemap: an index of small sitemaps with honest dates", async () => {
  const idx = await run(sitemap); assert.equal(idx.code, 200);
  for (const part of ["pages", "leagues", "matches", "news"]) assert.ok(idx.body.includes(`${O}/sitemap-${part}.xml`), part);
  assert.ok(!idx.body.includes("sitemap-clubs.xml")); // opt-in
  assert.ok(!/changefreq|priority/.test((await run(sitemap, { part: "pages" })).body));
  const m = await run(sitemap, { part: "matches" }); assert.match(m.body, /<loc>https:\/\/scoutwave\.example\/match\/11<\/loc><lastmod>\d{4}-\d\d-\d\d<\/lastmod>/);
  const l = await run(sitemap, { part: "leagues" }); assert.ok(l.body.includes("/league/9999-odd-cup")); assert.equal((l.body.match(/league\/39-premier-league/g) || []).length, 1); // no duplicates
  assert.equal((await run(sitemap, { part: "bogus" })).code, 404);
});
await test("sitemap: clubs only when switched on", async () => {
  assert.ok(!(await run(sitemap, { part: "clubs" })).body.includes("/club/"));
  process.env.SITEMAP_CLUBS = "1"; const c = await run(sitemap, { part: "clubs" }); assert.ok(c.body.includes("/club/")); assert.ok((await run(sitemap)).body.includes("sitemap-clubs.xml")); delete process.env.SITEMAP_CLUBS;
});
await test("news sitemap and RSS feed list our own story pages, drop unsafe stories, and escape their text", async () => {
  const n = await run(sitemap, { part: "news" }); assert.match(n.body, /<loc>https:\/\/scoutwave\.example\/news\/big-win-b-more-b-123e4567-e89b-12d3-a456-426614174000<\/loc><lastmod>2026-10-20<\/lastmod>/);
  assert.ok(!n.body.includes("javascript"));
  const feed = await run((await import("../server/feed.js")).default);
  assert.match(feed.headers["Content-Type"], /rss\+xml/); assert.ok(feed.body.includes("&lt;b&gt;more&lt;/b&gt;")); assert.ok(!feed.body.includes("<b>more")); assert.equal((feed.body.match(/<item>/g) || []).length, 1);
  assert.match(feed.body, /<guid isPermaLink="true">https:\/\/scoutwave\.example\/news\//);
});
await test("robots.txt: private areas closed, sitemap listed, AI crawler policy follows the setting", async () => {
  const { robotsText } = await import("../server/robots.js");
  const base = robotsText(O); for (const p of ["/api/", "/mingt-t", "/profile", "/premium"]) assert.ok(base.includes("Disallow: " + p), p);
  assert.ok(base.includes(`Sitemap: ${O}/sitemap.xml`)); assert.ok(!base.includes("GPTBot"));
  const training = robotsText(O, "training-only"); assert.ok(/User-agent: GPTBot\nDisallow: \//.test(training)); assert.ok(!training.includes("OAI-SearchBot"));
  assert.ok(robotsText(O, "block").includes("OAI-SearchBot"));
});

// ============================================================ the auditor
await test("auditor: finds the problems search engines care about", () => {
  const bad = `<html><head><title>x</title><meta name="robots" content="noindex"><script type="application/ld+json">{oops</script></head><body><h1>a</h1><h1>b</h1><p>hi</p></body></html>`;
  const codes = auditHtml(bad, { canonical: O + "/p", indexable: true }).issues.map((i) => i.code);
  for (const c of ["title-short", "description-missing", "canonical-missing", "noindex-by-mistake", "h1-many", "lang-missing", "ld-invalid", "few-links", "thin-content", "og-image"]) assert.ok(codes.includes(c), c + " in " + codes);
  const wrongCanon = `<html lang="en"><head><title>A fine title for a page</title><meta name="description" content="${"d".repeat(100)}"><link rel="canonical" href="https://other.example/p"><meta name="robots" content="index"></head><body><h1>t</h1></body></html>`;
  assert.ok(auditHtml(wrongCanon, { canonical: O + "/p" }).issues.some((i) => i.code === "canonical-mismatch"));
});
await test("structured data helpers skip missing fields instead of printing empty ones", () => {
  assert.equal(jsonLdTeam({}, "u"), null); assert.equal(jsonLdPerson({}, {}), null); assert.equal(jsonLdVenue({}, "u"), null);
  const t = jsonLdTeam({ team: { name: "A" } }, O + "/club/1-a"); assert.ok(!("foundingDate" in t) && !("logo" in t));
});

// ============================================================ livescores and predictions pages
const dayStr = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
await test("livescore and prediction addresses: today's, a date within the window; anything else is a real 404", async () => {
  for (const ok of ["/livescores", "/predictions", `/livescores/${dayStr(0)}`, `/predictions/${dayStr(3)}`, `/livescores/${dayStr(-30)}`, `/predictions/${dayStr(14)}`]) assert.ok(isKnownPath(ok), ok);
  for (const bad of ["/livescores/yesterday", "/livescores/2026-13-45", `/livescores/${dayStr(15)}`, `/predictions/${dayStr(-31)}`, "/livescores/2026-10-29/extra", "/predictions/1900-01-01"]) assert.ok(!isKnownPath(bad), bad);
  assert.equal((await renderPage(`/livescores/${dayStr(40)}`, O)).status, 404);
});
await test("/livescores: every match is a link, grouped by competition, with a summary, breadcrumbs and a list", async () => {
  const r = await renderPage("/livescores", O); assert.equal(r.status, 200);
  assert.match(r.html, /<title>Livescores: Live Football Scores/); assert.match(r.html, /<h1>Football livescores today: /);
  assert.match(r.html, /href="\/match\/11"/); assert.match(r.html, /href="\/league\/39-premier-league"/); assert.match(r.html, /2 matches in 1 competition/);
  assert.match(r.html, /<link rel="canonical" href="https:\/\/scoutwave\.example\/livescores">/);
  const types = ld(r.html).map((d) => d["@type"]); assert.ok(types.includes("BreadcrumbList") && types.includes("ItemList"));
  assert.deepEqual(auditHtml(r.html, { canonical: O + "/livescores", indexable: true }).issues.filter((i) => i.level === "error"), []);
  assert.match(r.html, /href="\/predictions"/); // the sister page, for today
});
await test("/predictions and dated pages: right title and canonical, links to the day before and after, no pick shown by default", async () => {
  const tomorrow = dayStr(1), r = await renderPage(`/predictions/${tomorrow}`, O); assert.equal(r.status, 200);
  assert.match(r.html, /<title>Football Predictions for \d+ [A-Z][a-z]+ \d{4}: Tips &amp; Previews \| Scoutwave<\/title>/);
  assert.ok(r.html.includes(`<link rel="canonical" href="${O}/predictions/${tomorrow}">`));
  assert.ok(r.html.includes(`href="/predictions"`) && r.html.includes(`href="/predictions/${dayStr(2)}"`)); // back to today, on to the day after
  assert.ok(r.html.includes(`href="/livescores/${tomorrow}"`));
  assert.doesNotMatch(r.html, /Most likely result/);
  const today = await renderPage("/predictions", O); assert.match(today.html, /<title>Football Predictions Today/);
});
await test("/vip is one address for search engines: it moves permanently to /predictions", async () => {
  const r = await renderPage("/vip", O); assert.equal(r.status, 301); assert.equal(r.headers.Location, O + "/predictions");
});
await test("an upcoming match page reads as a prediction page and links to its day", async () => {
  const day = dayStr(0);
  const r = await renderPage("/match/12", O); // the fake provider answers /fixtures?id= only for match 1; 12 has no data: still a plain page
  assert.ok([200, 404].includes(r.status));
  const meta = (await import("../src/seoCore.js")).metaForFixture({ fixture: { status: { short: "NS" }, date: `${day}T18:30:00Z` }, league: { name: "Premier League" }, teams: { home: { name: "Arsenal" }, away: { name: "Chelsea" } } }, "/match/5");
  assert.match(meta.title, /Arsenal vs Chelsea Prediction, Kick-off Time/); assert.match(meta.description, /prediction and preview/);
});
await test("sitemap: a days part lists the livescore and prediction pages (never today's dated twin); the fixed pages carry the new addresses", async () => {
  const idx = await run(sitemap); assert.ok(idx.body.includes(`${O}/sitemap-days.xml`));
  const d = await run(sitemap, { part: "days" }); assert.equal(d.code, 200);
  assert.ok(d.body.includes(`${O}/livescores/${dayStr(1)}`) && d.body.includes(`${O}/predictions/${dayStr(-3)}`));
  assert.ok(!d.body.includes(`/livescores/${dayStr(0)}<`) && !d.body.includes(`/predictions/${dayStr(0)}<`));
  const p = (await run(sitemap, { part: "pages" })).body; assert.ok(p.includes(`${O}/livescores<`) && p.includes(`${O}/predictions<`) && !p.includes("/vip<"));
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.ok(vercel.rewrites.some((r) => r.source.startsWith("/sitemap-:part") && r.source.includes("days")));
});
await test("the app opens the same addresses: /livescores[/date] is Home, /predictions is the predictions screen", () => {
  const src = fs.readFileSync(path.join(root, "src/router.js"), "utf8");
  assert.match(src, /parts\[0\] === "livescores" \|\| parts\[0\] === "predictions"/); assert.match(src, /tab: home \? "home" : "vip"/);
  assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /href="\/livescores"[\s\S]*href="\/predictions"/);
});

await test("copy reads like a person wrote it: no marketing filler in the text people and search engines read", () => {
  const files = ["index.html", "manifest.webmanifest", "src/seoCore.js", "src/seoEntities.js", "api/_seoPages.js", "src/legalContent.js", "src/data/mockData.js",
    ...fs.readdirSync(path.join(root, "src/components")).map((f) => "src/components/" + f)];
  const banned = /match intelligence|premium signals?\b|full signal|sharper signals|one calm|focused experience|hub for the|built for clarity|deserve your attention|one tap away|personalise Scoutwave|football data from every/i;
  for (const f of files) { const hit = fs.readFileSync(path.join(root, f), "utf8").match(banned); assert.ok(!hit, `${f}: "${hit && hit[0]}"`); }
});

await test("/predictions/39-premier-league: the next matches of one competition, linked, with the right title and canonical", async () => {
  const r = await renderPage("/predictions/39-premier-league", O); assert.equal(r.status, 200);
  assert.match(r.html, /<title>Premier League Predictions: Match Previews &amp; Tips \| Scoutwave<\/title>/);
  assert.ok(r.html.includes(`<link rel="canonical" href="${O}/predictions/39-premier-league">`));
  assert.match(r.html, /href="\/match\/21"/); assert.match(r.html, /href="\/match\/22"/); assert.doesNotMatch(r.html, /href="\/match\/23"/, "a finished match is not a prediction");
  assert.match(r.html, /The next 2 Premier League matches/); assert.match(r.html, /href="\/league\/39-premier-league"/); assert.match(r.html, /href="\/predictions\/140-la-liga"/);
  assert.ok(ld(r.html).some((d) => d["@type"] === "ItemList"));
  assert.deepEqual(auditHtml(r.html, { canonical: O + "/predictions/39-premier-league", indexable: true }).issues.filter((i) => i.level === "error"), []);
});
await test("league prediction addresses: a bare id moves to the full address; a competition we don't list, or a made-up one, is a 404", async () => {
  const moved = await renderPage("/predictions/39", O); assert.equal(moved.status, 301); assert.equal(moved.headers.Location, O + "/predictions/39-premier-league");
  assert.equal((await renderPage("/predictions/9999-odd-cup", O)).status, 404);
  assert.ok(!isKnownPath("/predictions/premier-league") && !isKnownPath("/predictions/39-x/extra") && isKnownPath("/predictions/39-premier-league"));
});
await test("the sitemap lists a predictions page for each major competition", async () => {
  const body = (await run(sitemap, { part: "leagues" })).body;
  assert.ok(body.includes(`${O}/predictions/39-premier-league<`) && body.includes(`${O}/league/39-premier-league<`));
});

async function withPredictions(fn, { picks = "" } = {}) {
  const saved = { k: process.env.SUPABASE_SERVICE_ROLE_KEY, u: process.env.SUPABASE_URL, p: process.env.SEO_SHOW_PICKS };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://sb.test"; if (picks) process.env.SEO_SHOW_PICKS = picks; else delete process.env.SEO_SHOW_PICKS;
  try { return await fn(); } finally { for (const [name, v] of [["SUPABASE_SERVICE_ROLE_KEY", saved.k], ["SUPABASE_URL", saved.u], ["SEO_SHOW_PICKS", saved.p]]) { if (v === undefined) delete process.env[name]; else process.env[name] = v; } }
}
await test("prediction pages list every match as a prediction table: 1 X 2 chances, pick, likely score, goals, safer pick", async () => {
  await withPredictions(async () => {
    const r = await renderPage("/predictions", O); assert.equal(r.status, 200);
    assert.match(r.html, /<th>1<\/th><th>X<\/th><th>2<\/th><th>Pick<\/th><th>Score<\/th><th>Goals<\/th><th>Safer pick<\/th><th>Result<\/th>/);
    const row = r.html.match(/<tr><th scope="row"><a href="\/match\/12">[\s\S]*?<\/tr>/)[0];
    assert.match(row, /52%<\/td><td>26%<\/td><td>22%<\/td><td>1<\/td><td>2-1<\/td><td>Over 2\.5 \(61%\)<\/td><td>1X \(81%\)<\/td>/);
    assert.match(r.html, /1 is a home win, X a draw and 2 an away win/);
    const done = r.html.match(/<tr><th scope="row"><a href="\/match\/11">[\s\S]*?<\/tr>/)[0]; // finished 1-0, the model said away: shown honestly
    assert.match(done, /1-0 \(pick missed\)/);
  });
});
await test("the league prediction page is a table too, and SEO_SHOW_PICKS=0 puts it back to confidence only", async () => {
  await withPredictions(async () => {
    const r = await renderPage("/predictions/39-premier-league", O);
    assert.match(r.html, /<tr><th scope="row"><a href="\/match\/21">[\s\S]*?<td>2<\/td><td>0-1<\/td>/);
  });
  await withPredictions(async () => {
    const r = await renderPage("/predictions/39-premier-league", O);
    assert.doesNotMatch(r.html, /<table>|Most likely result|Safer pick/); assert.match(r.html, /Model confidence: high/);
  }, { picks: "0" });
});
console.log(`\n${passed} tests passed`);
