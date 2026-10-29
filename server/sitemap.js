// /sitemap.xml is an INDEX of smaller sitemaps (search engines handle several small, accurate ones better than one big one):
//   /sitemap-pages.xml    the fixed pages
//   /sitemap-leagues.xml  competitions (the main ones always; every current one when the football API answers)
//   /sitemap-clubs.xml    clubs of the main leagues (only when SITEMAP_CLUBS=1: about one request per league, cached a day)
//   /sitemap-matches.xml  yesterday's, today's and tomorrow's matches, with real dates
//   /sitemap-news.xml     the latest stories, at their own addresses on this site
// <lastmod> is given only where it is a real date; changefreq and priority are left out because search engines ignore them.
import { siteOrigin, esc, footballData, slugOf, currentSeasonYear, TOP_LEAGUES } from "../api/_site.js";
import { env } from "../api/_admin.js";
import { latestArticles } from "./news.js";
import { articlePath } from "../src/newsArticle.js";
import { shiftDay } from "../src/seoEntities.js";

const STATIC = ["/", "/livescores", "/predictions", "/leagues", "/news", "/about", "/help-centre", "/contact-us", "/privacy-policy", "/terms-of-use"];
const PARTS = ["pages", "leagues", "clubs", "days", "matches", "news"];
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

const urlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
const index = (origin, parts, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  parts.map((p) => `  <sitemap><loc>${esc(origin)}/sitemap-${p}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`).join("\n") + "\n</sitemapindex>\n";

export async function sitemapUrls(part, origin) {
  const seen = new Set();
  const add = (list, loc, lastmod) => { if (!seen.has(loc)) { seen.add(loc); list.push({ loc, lastmod }); } };
  const out = [];
  if (part === "pages") STATIC.forEach((p) => add(out, origin + p));
  if (part === "leagues") {
    TOP_LEAGUES.forEach(([id, name]) => add(out, `${origin}/league/${slugOf(id, name)}`));
    for (const e of ((await footballData("leagues", { current: "true" })) || []).slice(0, 1500)) if (e?.league?.id && e.league.name) add(out, `${origin}/league/${slugOf(e.league.id, e.league.name)}`);
  }
  if (part === "clubs" && env("SITEMAP_CLUBS") === "1") {
    const season = currentSeasonYear();
    for (const [id] of TOP_LEAGUES.slice(0, 12)) for (const e of (await footballData("teams", { league: id, season })) || []) if (e?.team?.id && e.team.name) add(out, `${origin}/club/${slugOf(e.team.id, e.team.name)}`);
  }
  // One livescores page and one predictions page per day: today, the last week and the next few days. Today's own
  // pages are /livescores and /predictions (the dated address of today would be a duplicate).
  if (part === "days") {
    const today = day(0);
    for (const kind of ["livescores", "predictions"]) for (let n = -7; n <= 7; n++) { const d = shiftDay(today, n); if (d !== today) add(out, `${origin}/${kind}/${d}`, d <= today ? d : undefined); }
  }
  if (part === "matches") {
    for (const date of [day(-1), day(0), day(1), day(2)]) for (const fx of ((await footballData("fixtures", { date })) || []).slice(0, 700)) if (fx?.fixture?.id) add(out, `${origin}/match/${fx.fixture.id}`, fx.fixture.date?.slice(0, 10));
  }
  if (part === "news") for (const a of await latestArticles()) add(out, origin + articlePath(a), a.publishedAt ? a.publishedAt.slice(0, 10) : undefined);
  return out;
}

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const part = String(Array.isArray(req.query?.part) ? req.query.part[0] : req.query?.part || "");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  if (!part) {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(index(origin, PARTS.filter((p) => p !== "clubs" || env("SITEMAP_CLUBS") === "1"), day(0)));
  }
  if (!PARTS.includes(part)) return res.status(404).send(urlset([]));
  const urls = await sitemapUrls(part, origin);
  // Matches and news change by the hour; the rest barely move.
  res.setHeader("Cache-Control", `public, s-maxage=${part === "matches" || part === "news" ? 3600 : 86400}, stale-while-revalidate=86400`);
  res.status(200).send(urlset(urls));
}
