// The pages search engines and link-preview bots get (see api/seo.js): a small, fully rendered HTML page per
// URL with real title, description, canonical, Open Graph tags, structured data and readable content with links.
// People never see these; they get the app. Builders return
//   { meta, heading, body, jsonLd, cache? }   a page,
//   { notFound: true }                         a real 404 (the thing does not exist),
//   { redirect: "/club/42-right-name" }        a 301 to the one correct address,
//   null                                       "no data right now": the generic page is served and cached briefly.
import { metaForPath, metaForFixture, metaForLeague, jsonLdSite, jsonLdFixture, breadcrumbs, normalizePath, KEYWORDS, SITE_NAME } from "../src/seoCore.js";
import { jsonLdTeam, jsonLdPerson, jsonLdVenue, jsonLdItemList, isKnownPath } from "../src/seoEntities.js";
import { siteOrigin, esc, footballData, slugOf, currentSeasonYear, TOP_LEAGUES } from "./_site.js";
import { env } from "./_admin.js";
import { cleanArticle } from "../server/news.js";
import { parseArticleId, isProviderId } from "../src/newsArticle.js";
import { SOCIAL_LINKS } from "../src/config.js";

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");
const clip = (t, n) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "\u2026");
const FINISHED = new Set(["FT", "AET", "PEN"]);

function fixtureLine(fx) {
  const h = fx.teams?.home?.name || "Home", a = fx.teams?.away?.name || "Away";
  const score = fx.goals?.home != null ? ` ${fx.goals.home}-${fx.goals.away} ` : " vs ";
  const day = fx.fixture?.date ? ` on ${new Date(fx.fixture.date).toISOString().slice(0, 10)}` : "";
  return link(`/match/${fx.fixture.id}`, `${h}${score}${a}`) + (fx.league?.name ? ` (${esc(fx.league.name)}${day})` : esc(day));
}

const letterFor = (fx, teamId) => {
  if (!FINISHED.has(fx.fixture?.status?.short) || fx.goals?.home == null) return null;
  const mine = fx.teams?.home?.id === teamId ? fx.goals.home : fx.goals.away, theirs = fx.teams?.home?.id === teamId ? fx.goals.away : fx.goals.home;
  return mine > theirs ? "W" : mine < theirs ? "L" : "D";
};

// Does the address use the one correct slug? If not, say where it should go.
const slugRedirect = (kind, id, name, requested) => (slugOf(id, name) !== requested ? { redirect: `/${kind}/${slugOf(id, name)}` } : null);

async function buildHome(origin) {
  const today = new Date().toISOString().slice(0, 10);
  const fixtures = ((await footballData("fixtures", { date: today })) || []).slice(0, 60);
  const sameAs = Object.values(SOCIAL_LINKS || {}).filter((u) => /^https:\/\//.test(u));
  return {
    jsonLd: jsonLdSite(origin, { sameAs }),
    heading: "Live football scores, predictions and football data",
    cache: 300,
    body: `<p>Follow live scores, fixtures, league tables, lineups, match statistics and odds from every major competition.</p>` +
      `<h2>Competitions</h2>${list(TOP_LEAGUES.map(([id, name]) => link(`/league/${slugOf(id, name)}`, name)))}` +
      (fixtures.length ? `<h2>Today's matches</h2>${list(fixtures.map(fixtureLine))}` : "") +
      `<h2>More</h2>${list([link("/leagues", "All leagues"), link("/news", "Football news"), link("/vip", "Football predictions")])}`,
  };
}

async function buildMatch(id, path, origin) {
  const rows = await footballData("fixtures", { id });
  if (rows === null) return null;
  const fx = rows[0];
  if (!fx) return { notFound: true };
  const meta = { ...metaForFixture(fx, path), image: fx.teams?.home?.logo || "" };
  const home = fx.teams?.home, away = fx.teams?.away;
  const goals = (fx.events || []).filter((e) => String(e.type).toLowerCase() === "goal" && !/missed/i.test(e.detail || ""));
  const live = !FINISHED.has(fx.fixture?.status?.short) && fx.fixture?.status?.short !== "NS" && fx.fixture?.status?.short !== "TBD";
  return {
    meta, cache: live ? 60 : FINISHED.has(fx.fixture?.status?.short) ? 3600 : 600,
    jsonLd: [jsonLdFixture(fx, origin + path), breadcrumbs(origin, [["Home", "/"], [fx.league?.name || "Football", fx.league?.id ? `/league/${slugOf(fx.league.id, fx.league.name)}` : "/leagues"], [`${home?.name} vs ${away?.name}`, path]])],
    heading: `${home?.name || "Home"} vs ${away?.name || "Away"}`,
    body: `<p>${esc(meta.description)}</p>` +
      `<p>Status: ${esc(fx.fixture?.status?.long || "")}${fx.goals?.home != null ? `. Score: ${fx.goals.home}-${fx.goals.away}` : ""}</p>` +
      list([
        fx.league?.name ? `Competition: ${link(`/league/${slugOf(fx.league.id, fx.league.name)}`, fx.league.name)}${fx.league.round ? ", " + esc(fx.league.round) : ""}` : "",
        fx.fixture?.venue?.name ? `Venue: ${esc(fx.fixture.venue.name)}${fx.fixture.venue.city ? ", " + esc(fx.fixture.venue.city) : ""}` : "",
        fx.fixture?.referee ? `Referee: ${esc(fx.fixture.referee)}` : "",
        home?.id ? link(`/club/${slugOf(home.id, home.name)}`, home.name) : "",
        away?.id ? link(`/club/${slugOf(away.id, away.name)}`, away.name) : "",
      ].filter(Boolean)) +
      (goals.length ? `<h2>Goals</h2>${list(goals.map((e) => `${esc(e.time?.elapsed)}' ${esc(e.player?.name)} (${esc(e.team?.name)})`))}` : ""),
  };
}

async function buildLeague(id, path, origin, requested) {
  const rows = await footballData("leagues", { id });
  if (rows === null) return null;
  const entry = rows[0];
  if (!entry?.league?.name) return { notFound: true };
  const moved = slugRedirect("league", id, entry.league.name, requested);
  if (moved) return moved;
  const meta = { ...metaForLeague(entry, path), image: entry.league.logo || "" };
  const season = (entry.seasons || []).find((s) => s.current)?.year || (entry.seasons || []).slice(-1)[0]?.year;
  const table = season ? ((((await footballData("standings", { league: id, season })) || [])[0]?.league?.standings || [])[0] || []) : [];
  const teams = table.slice(0, 24);
  return {
    meta, cache: 3600,
    jsonLd: [breadcrumbs(origin, [["Home", "/"], ["Leagues", "/leagues"], [entry.league.name, path]]), teams.length ? jsonLdItemList(`${entry.league.name} table${season ? " " + season : ""}`, teams.map((r) => ({ name: r.team.name, url: `${origin}/club/${slugOf(r.team.id, r.team.name)}` }))) : null],
    heading: entry.league.name,
    body: `<p>${esc(meta.description)}</p>` +
      (teams.length ? `<h2>League table${season ? ` ${esc(season)}` : ""}</h2><ol>${teams.map((r) => `<li>${link(`/club/${slugOf(r.team.id, r.team.name)}`, r.team.name)}: ${esc(r.points)} pts from ${esc(r.all?.played)} games (${esc(r.all?.win)}W ${esc(r.all?.draw)}D ${esc(r.all?.lose)}L, goal difference ${esc(r.goalsDiff)})</li>`).join("")}</ol>` : "") +
      list([link("/leagues", "All leagues"), link("/", "Live scores")]),
  };
}

async function buildClub(id, path, origin, requested) {
  const rows = await footballData("teams", { id });
  if (rows === null) return null;
  const entry = rows[0];
  if (!entry?.team?.name) return { notFound: true };
  const moved = slugRedirect("club", id, entry.team.name, requested);
  if (moved) return moved;
  const t = entry.team, v = entry.venue || {};
  const [last, next] = await Promise.all([footballData("fixtures", { team: id, last: 5 }), footballData("fixtures", { team: id, next: 5 })]);
  const recent = (last || []).slice().sort((a, b) => (a.fixture.timestamp || 0) - (b.fixture.timestamp || 0));
  const form = recent.map((fx) => letterFor(fx, Number(id))).filter(Boolean).join("");
  const description = clip(`${t.name}${t.country ? ` (${t.country})` : ""}: latest results, upcoming fixtures, squad and statistics.` + (t.founded ? ` Founded in ${t.founded}` : "") + (v.name ? `${t.founded ? "," : " "} plays at ${v.name}${v.city ? ", " + v.city : ""}.` : t.founded ? "." : "") + (form ? ` Recent form: ${form}.` : ""), 300);
  const meta = { path, kind: "club", title: clip(`${t.name}: Fixtures, Results, Squad & Stats | ${SITE_NAME}`, 70), description, image: t.logo || "" };
  return {
    meta, cache: 21600,
    jsonLd: [jsonLdTeam(entry, origin + path), breadcrumbs(origin, [["Home", "/"], ["Clubs", "/leagues"], [t.name, path]])],
    heading: t.name,
    body: `<p>${esc(description)}</p>` +
      `<h2>Club facts</h2>${list([t.country ? `Country: ${esc(t.country)}` : "", t.founded ? `Founded: ${esc(t.founded)}` : "", t.code ? `Short name: ${esc(t.code)}` : "", v.name ? `Stadium: ${v.id ? link(`/venue/${slugOf(v.id, v.name)}`, v.name) : esc(v.name)}${v.capacity ? `, capacity ${esc(v.capacity)}` : ""}${v.city ? `, ${esc(v.city)}` : ""}` : ""].filter(Boolean))}` +
      (recent.length ? `<h2>Recent results</h2>${list(recent.slice().reverse().map(fixtureLine))}` : "") +
      ((next || []).length ? `<h2>Upcoming fixtures</h2>${list(next.map(fixtureLine))}` : "") +
      `<h2>More</h2>${list([link("/leagues", "All leagues"), link("/", "Live scores")])}`,
  };
}

async function buildPlayer(id, path, origin, requested) {
  const profileRows = await footballData("players/profiles", { player: id });
  if (profileRows === null) return null;
  const p = profileRows[0]?.player;
  if (!p?.name) return { notFound: true };
  const moved = slugRedirect("player", id, p.name, requested);
  if (moved) return moved;
  const season = currentSeasonYear();
  const statRows = (await footballData("players", { id, season })) || [];
  const stats = statRows[0]?.statistics || [];
  const club = stats[0]?.team;
  const sum = (f) => stats.reduce((t, s) => t + (Number(f(s)) || 0), 0);
  const goals = sum((s) => s.goals?.total), assists = sum((s) => s.goals?.assists), apps = sum((s) => s.games?.appearences);
  const position = String(stats[0]?.games?.position || p.position || "").toLowerCase();
  const description = clip(`${p.name}${p.age ? `, ${p.age}` : ""}${p.nationality ? `, ${p.nationality}` : ""}${position ? ` ${position}` : " footballer"}${club?.name ? ` for ${club.name}` : ""}.` + (apps ? ` ${season}/${String(season + 1).slice(2)}: ${apps} appearances, ${goals} goals, ${assists} assists.` : "") + " Career statistics, trophies and transfers.", 300);
  const meta = { path, kind: "player", title: clip(`${p.name}: Stats, Career & Transfers | ${SITE_NAME}`, 70), description, image: p.photo || "" };
  return {
    meta, cache: 21600,
    jsonLd: [jsonLdPerson(p, { team: club, url: origin + path }), breadcrumbs(origin, [["Home", "/"], ["Players", "/search"], [p.name, path]])],
    heading: p.name,
    body: `<p>${esc(description)}</p>` +
      `<h2>Player facts</h2>${list([p.nationality ? `Nationality: ${esc(p.nationality)}` : "", p.age ? `Age: ${esc(p.age)}` : "", p.birth?.date ? `Born: ${esc(p.birth.date)}${p.birth.place ? ", " + esc(p.birth.place) : ""}` : "", p.height ? `Height: ${esc(p.height)}` : "", p.weight ? `Weight: ${esc(p.weight)}` : "", p.number ? `Shirt number: ${esc(p.number)}` : "", position ? `Position: ${esc(position)}` : "", club?.name ? `Club: ${club.id ? link(`/club/${slugOf(club.id, club.name)}`, club.name) : esc(club.name)}` : ""].filter(Boolean))}` +
      (apps ? `<h2>Season ${esc(season)}/${esc(String(season + 1).slice(2))}</h2>${list([`Appearances: ${apps}`, `Goals: ${goals}`, `Assists: ${assists}`])}` : "") +
      list([link("/search", "Search players"), link("/", "Live scores")]),
  };
}

async function buildVenue(id, path, origin, requested) {
  const rows = await footballData("venues", { id });
  if (rows === null) return null;
  const v = rows[0];
  if (!v?.name) return { notFound: true };
  const moved = slugRedirect("venue", id, v.name, requested);
  if (moved) return moved;
  const description = clip(`${v.name}${v.city ? `, ${v.city}` : ""}${v.country ? ` (${v.country})` : ""}: football stadium` + (v.capacity ? ` with a capacity of ${Number(v.capacity).toLocaleString("en-GB")}` : "") + (v.surface ? ` and a ${String(v.surface).toLowerCase()} pitch` : "") + ". Home teams and upcoming fixtures.", 300);
  const meta = { path, kind: "venue", title: clip(`${v.name}: Stadium Info & Fixtures | ${SITE_NAME}`, 70), description, image: v.image || "" };
  return {
    meta, cache: 86400,
    jsonLd: [jsonLdVenue(v, origin + path), breadcrumbs(origin, [["Home", "/"], ["Venues", "/search"], [v.name, path]])],
    heading: v.name,
    body: `<p>${esc(description)}</p>` + list([v.address ? `Address: ${esc(v.address)}` : "", v.city ? `City: ${esc(v.city)}` : "", v.country ? `Country: ${esc(v.country)}` : "", v.capacity ? `Capacity: ${esc(v.capacity)}` : "", v.surface ? `Surface: ${esc(v.surface)}` : ""].filter(Boolean)) + list([link("/leagues", "All leagues"), link("/", "Live scores")]),
  };
}

// A news story: the headline, the publisher's summary and a link to the full story.
async function buildArticle(id, path, origin) {
  const token = String(process.env.NEWS_ACCESS || "").trim();
  if (!token || !isProviderId(id)) return isProviderId(id) ? null : { notFound: true };
  const r = await fetch(`https://api.thenewsapi.com/v1/news/uuid/${id}?` + new URLSearchParams({ api_token: token }), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (r.status === 404) return { notFound: true };
  const article = r.ok ? cleanArticle(await r.json().catch(() => null)) : null;
  if (!article) return null;
  const description = clip(article.description || article.title, 300);
  return {
    meta: { path, kind: "article", title: clip(article.title, 62) + " | " + SITE_NAME, description, image: article.image || "" },
    heading: article.title, cache: 21600,
    jsonLd: [{ "@context": "https://schema.org", "@type": "NewsArticle", headline: clip(article.title, 110), ...(article.image ? { image: [article.image] } : {}), ...(article.publishedAt ? { datePublished: article.publishedAt, dateModified: article.publishedAt } : {}), author: { "@type": "Organization", name: article.source || "Publisher" }, publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: origin + "/icons/icon-512.png" } }, mainEntityOfPage: origin + path }, breadcrumbs(origin, [["Home", "/"], ["News", "/news"], [clip(article.title, 60), path]])],
    body: `<p>${esc(description)}</p>${article.source ? `<p>Source: ${esc(article.source)}</p>` : ""}<p><a href="${esc(article.url)}" rel="noopener nofollow">Read the full story${article.source ? " on " + esc(article.source) : ""}</a></p>${list([link("/news", "More football news")])}`,
  };
}

// ---------------------------------------------------------------------------
function shell({ meta, heading, body, jsonLd, origin, path, status = 200 }) {
  const url = origin + (path === "/" ? "/" : path);
  const hasImage = meta.image && /^https:\/\//.test(meta.image);
  const image = hasImage ? meta.image : origin + "/icons/icon-512.png";
  const noindex = meta.noindex || status === 404;
  const verify = [["google-site-verification", env("GOOGLE_SITE_VERIFICATION")], ["msvalidate.01", env("BING_SITE_VERIFICATION")]].filter(([, v]) => v);
  const twitter = env("TWITTER_SITE").replace(/^@?/, "@");
  const big = meta.kind === "article" && hasImage;
  const m = (attr, k, v) => `<meta ${attr}="${k}" content="${esc(v)}">`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
${m("name", "description", meta.description)}
${m("name", "keywords", KEYWORDS)}
${m("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1")}
${status === 404 ? "" : `<link rel="canonical" href="${esc(url)}">`}
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} football news" href="${esc(origin)}/feed.xml">
${verify.map(([k, v]) => m("name", k, v)).join("\n")}
${m("property", "og:site_name", SITE_NAME)}${m("property", "og:locale", "en_GB")}${m("property", "og:type", meta.kind === "article" ? "article" : "website")}
${m("property", "og:title", meta.title)}${m("property", "og:description", meta.description)}
${m("property", "og:url", url)}${m("property", "og:image", image)}${m("property", "og:image:alt", heading || meta.title)}
${hasImage ? "" : m("property", "og:image:width", "512") + m("property", "og:image:height", "512")}
${m("name", "twitter:card", big ? "summary_large_image" : "summary")}${m("name", "twitter:title", meta.title)}${m("name", "twitter:description", meta.description)}${m("name", "twitter:image", image)}
${twitter.length > 1 ? m("name", "twitter:site", twitter) : ""}
${m("name", "theme-color", "#d50000")}
${(jsonLd || []).filter(Boolean).map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`).join("\n")}
</head><body>
<header><a href="/">${SITE_NAME}</a> <nav>${link("/leagues", "Leagues")} ${link("/news", "News")} ${link("/vip", "Predictions")}</nav></header>
<main><h1>${esc(heading)}</h1>${body}</main>
<footer>${link("/about", "About")} ${link("/privacy-policy", "Privacy")} ${link("/terms-of-use", "Terms")} ${link("/contact-us", "Contact")}</footer>
</body></html>`;
}

// -> { status, headers, html } for one address. Never throws.
export async function renderPage(rawPath, origin) {
  const path = normalizePath(rawPath || "/");
  const [, kind, slug] = path.split("/");
  const html = (args) => shell({ origin, path, ...args });

  if (!isKnownPath(path)) {
    const meta = { title: `Page not found | ${SITE_NAME}`, description: "That page doesn't exist. Try live scores, leagues or football news.", noindex: true, path, kind: "page" };
    return { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" }, html: html({ meta, heading: "Page not found", body: `<p>${esc(meta.description)}</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`, status: 404 }) };
  }

  let meta = metaForPath(path);
  let jsonLd = [];
  let heading = meta.title.split(/[:|]/)[0].trim();
  let body = `<p>${esc(meta.description)}</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`;
  let cache = 300, built = null;
  try {
    if (path === "/") built = await buildHome(origin);
    else if (kind === "match" && /^\d+$/.test(slug || "")) built = await buildMatch(slug, path, origin);
    else if (kind === "league" && /^\d+/.test(slug || "")) built = await buildLeague(parseInt(slug, 10), path, origin, slug);
    else if (kind === "club" && /^\d+/.test(slug || "")) built = await buildClub(parseInt(slug, 10), path, origin, slug);
    else if (kind === "player" && /^\d+/.test(slug || "")) built = await buildPlayer(parseInt(slug, 10), path, origin, slug);
    else if (kind === "venue" && /^\d+/.test(slug || "")) built = await buildVenue(parseInt(slug, 10), path, origin, slug);
    else if (kind === "news" && slug) { const id = parseArticleId(slug); built = id ? await buildArticle(id, path, origin) : { notFound: true }; }
    else if (["match", "league", "club", "player", "venue"].includes(kind)) built = { notFound: true }; // no usable id in the address
  } catch (error) {
    console.error("SEO prerender error:", error?.message || error); // fall back to the generic page
  }

  if (built?.redirect) return { status: 301, headers: { Location: origin + built.redirect, "Cache-Control": "public, s-maxage=86400" }, html: "" };
  if (built?.notFound) {
    const nf = { title: `Not found | ${SITE_NAME}`, description: "We couldn't find that page.", noindex: true, path, kind: "page" };
    return { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" }, html: html({ meta: nf, heading: "Not found", body: `<p>We couldn't find that page.</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`, status: 404 }) };
  }
  if (built) {
    meta = built.meta || meta; heading = built.heading || heading; body = built.body; cache = built.cache ?? cache;
    jsonLd = built.jsonLd || [];
    if (path === "/" ) jsonLd = [...jsonLd];
  } else if (["match", "league", "club", "player", "venue"].includes(kind) || kind === "news") {
    cache = 60; // no data this time (quota, cap or provider down): serve the plain page, and try again soon
  }
  return { status: 200, headers: { "Cache-Control": `public, s-maxage=${cache}, stale-while-revalidate=${Math.max(3600, cache * 4)}` }, html: html({ meta, heading, body, jsonLd }) };
}

export { siteOrigin };
