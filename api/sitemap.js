// /sitemap.xml: the static pages, the major competitions, and today's matches
// (the pages most worth crawling). Cached for an hour at the edge.
import { siteOrigin, esc, footballData, slugOf, TOP_LEAGUES } from "./_site.js";

const STATIC = [["/", "daily", "1.0"], ["/leagues", "daily", "0.9"], ["/news", "hourly", "0.8"], ["/vip", "daily", "0.6"], ["/about", "monthly", "0.3"], ["/help-centre", "monthly", "0.3"], ["/contact-us", "monthly", "0.2"], ["/privacy-policy", "yearly", "0.1"], ["/terms-of-use", "yearly", "0.1"]];

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ...STATIC.map(([path, changefreq, priority]) => ({ loc: origin + path, changefreq, priority })),
    ...TOP_LEAGUES.map(([id, name]) => ({ loc: `${origin}/league/${slugOf(id, name)}`, changefreq: "daily", priority: "0.8" })),
  ];

  const fixtures = (await footballData("fixtures", { date: today })) || [];
  const seen = new Set();
  for (const fx of fixtures.slice(0, 500)) {
    const id = fx?.fixture?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    urls.push({ loc: `${origin}/match/${id}`, lastmod: fx.fixture?.date?.slice(0, 10), changefreq: "hourly", priority: "0.7" });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n") +
    "\n</urlset>\n";
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(body);
}
