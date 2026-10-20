// Crawler pre-render. The app is a client-side single page app, which search
// engines and link-preview bots only partly understand, so vercel.json routes
// known bot user agents here: a small, fully rendered HTML page per URL with
// real title, description, canonical, Open Graph tags, JSON-LD and readable
// content with links. People never see this page; they get the app.
import { metaForPath, metaForFixture, metaForLeague, jsonLdSite, jsonLdFixture, breadcrumbs, normalizePath, KEYWORDS, SITE_NAME } from "../src/seoCore.js";
import { siteOrigin, esc, footballData, slugOf, TOP_LEAGUES } from "./_site.js";
import { cleanArticle } from "./news.js";
import { parseArticleId, isProviderId } from "../src/newsArticle.js";

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "");

function fixtureLine(fx) {
  const h = fx.teams?.home?.name || "Home", a = fx.teams?.away?.name || "Away";
  const score = fx.goals?.home != null ? ` ${fx.goals.home}-${fx.goals.away} ` : " vs ";
  return link(`/match/${fx.fixture.id}`, `${h}${score}${a}`) + (fx.league?.name ? ` (${esc(fx.league.name)})` : "");
}

async function buildHome() {
  const today = new Date().toISOString().slice(0, 10);
  const fixtures = ((await footballData("fixtures", { date: today })) || []).slice(0, 60);
  return {
    heading: "Live football scores, predictions and football data",
    body: `<p>Follow live scores, fixtures, league tables, lineups, match statistics and odds from every major competition.</p>` +
      `<h2>Competitions</h2>${list(TOP_LEAGUES.map(([id, name]) => link(`/league/${slugOf(id, name)}`, name)))}` +
      (fixtures.length ? `<h2>Today's matches</h2>${list(fixtures.map(fixtureLine))}` : "") +
      `<h2>More</h2>${list([link("/leagues", "All leagues"), link("/news", "Football news"), link("/vip", "Football predictions")])}`,
  };
}

async function buildMatch(id, path, origin) {
  const fx = ((await footballData("fixtures", { id })) || [])[0];
  if (!fx) return null;
  const meta = metaForFixture(fx, path);
  const home = fx.teams?.home, away = fx.teams?.away;
  const goals = (fx.events || []).filter((e) => String(e.type).toLowerCase() === "goal" && !/missed/i.test(e.detail || ""));
  return {
    meta,
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

async function buildLeague(id, path, origin) {
  const entry = ((await footballData("leagues", { id })) || [])[0];
  if (!entry) return null;
  const meta = metaForLeague(entry, path);
  const season = (entry.seasons || []).find((s) => s.current)?.year || (entry.seasons || []).slice(-1)[0]?.year;
  const table = season ? ((((await footballData("standings", { league: id, season })) || [])[0]?.league?.standings || [])[0] || []) : [];
  return {
    meta,
    jsonLd: [breadcrumbs(origin, [["Home", "/"], ["Leagues", "/leagues"], [entry.league.name, path]])],
    heading: entry.league.name,
    body: `<p>${esc(meta.description)}</p>` +
      (table.length ? `<h2>League table${season ? ` ${esc(season)}` : ""}</h2><ol>${table.slice(0, 24).map((r) => `<li>${link(`/club/${slugOf(r.team.id, r.team.name)}`, r.team.name)}: ${esc(r.points)} pts from ${esc(r.all?.played)} played</li>`).join("")}</ol>` : ""),
  };
}

// A news story: the headline, the publisher's summary and a link to the full story, as real HTML for
// search engines and link previews (WhatsApp, X, Slack). Only stories the provider can return by id.
async function buildArticle(id, path, origin) {
  const token = String(process.env.NEWS_ACCESS || "").trim();
  if (!token || !isProviderId(id)) return null;
  const r = await fetch(`https://api.thenewsapi.com/v1/news/uuid/${id}?` + new URLSearchParams({ api_token: token }), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  const article = r.ok ? cleanArticle(await r.json().catch(() => null)) : null;
  if (!article) return null;
  const clip = (t, n) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "\u2026");
  const description = clip(article.description || article.title, 300);
  return {
    meta: { path, kind: "article", title: clip(article.title, 62) + " | " + SITE_NAME, description, image: article.image || "" },
    heading: article.title,
    jsonLd: [{ "@context": "https://schema.org", "@type": "NewsArticle", headline: clip(article.title, 110), ...(article.image ? { image: [article.image] } : {}), ...(article.publishedAt ? { datePublished: article.publishedAt } : {}), author: { "@type": "Organization", name: article.source || "Publisher" }, publisher: { "@type": "Organization", name: SITE_NAME }, mainEntityOfPage: origin + path }, breadcrumbs(origin, [["Home", "/"], ["News", "/news"], [clip(article.title, 60), path]])],
    body: `<p>${esc(description)}</p>${article.source ? `<p>Source: ${esc(article.source)}</p>` : ""}<p><a href="${esc(article.url)}" rel="noopener nofollow">Read the full story${article.source ? " on " + esc(article.source) : ""}</a></p>${list([link("/news", "More football news")])}`,
  };
}

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const raw = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  const path = normalizePath(raw || "/");
  const [, kind, slug] = path.split("/");

  let meta = metaForPath(path);
  let jsonLd = meta.kind === "home" ? jsonLdSite(origin) : [];
  let heading = meta.title.split(/[:|]/)[0].trim();
  let body = `<p>${esc(meta.description)}</p>${list([link("/", "Live scores"), link("/leagues", "Leagues"), link("/news", "News")])}`;

  try {
    let built = null;
    if (path === "/") built = await buildHome();
    else if (kind === "match" && /^\d+$/.test(slug || "")) built = await buildMatch(slug, path, origin);
    else if (kind === "league" && /^\d+/.test(slug || "")) built = await buildLeague(parseInt(slug, 10), path, origin);
    else if (kind === "news" && slug && parseArticleId(slug)) built = await buildArticle(parseArticleId(slug), path, origin);
    if (built) {
      meta = built.meta || meta;
      heading = built.heading || heading;
      body = built.body;
      jsonLd = [...jsonLd, ...(built.jsonLd || [])].filter(Boolean);
    }
  } catch (error) {
    console.error("SEO prerender error:", error?.message || error); // fall back to the generic page
  }

  const url = origin + (path === "/" ? "/" : path);
  const image = meta.image && /^https:\/\//.test(meta.image) ? meta.image : origin + "/icons/icon-512.png";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="keywords" content="${esc(KEYWORDS)}">
<meta name="robots" content="${meta.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="${SITE_NAME}"><meta property="og:type" content="${meta.kind === "article" ? "article" : "website"}">
<meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${meta.kind === "article" && meta.image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.description)}"><meta name="twitter:image" content="${esc(image)}">
${jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head><body>
<header><a href="/">${SITE_NAME}</a></header>
<main><h1>${esc(heading)}</h1>${body}</main>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.status(200).send(html);
}
