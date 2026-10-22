// /feed.xml: an RSS feed of the latest football stories, each pointing at its own page on this site
// (headline and the publisher's summary; the full story stays with the publisher). Lets feed readers and
// aggregators find new stories, and gives search engines another discovery path.
import { siteOrigin, esc } from "./_site.js";
import { latestArticles } from "./news.js";
import { articlePath } from "../src/newsArticle.js";
import { SITE_NAME } from "../src/seoCore.js";

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const items = await latestArticles();
  const date = (iso) => (iso ? new Date(iso).toUTCString() : new Date().toUTCString());
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${esc(SITE_NAME)} football news</title><link>${esc(origin)}/news</link>
<description>The latest football headlines, with summaries and links to the full stories.</description><language>en</language>
<atom:link href="${esc(origin)}/feed.xml" rel="self" type="application/rss+xml"/>
<lastBuildDate>${date(items[0]?.publishedAt)}</lastBuildDate>
${items.map((a) => `<item><title>${esc(a.title)}</title><link>${esc(origin + articlePath(a))}</link><guid isPermaLink="true">${esc(origin + articlePath(a))}</guid><pubDate>${date(a.publishedAt)}</pubDate><description>${esc(a.description || a.title)}</description>${a.source ? `<source url="${esc(a.url)}">${esc(a.source)}</source>` : ""}</item>`).join("\n")}
</channel></rss>
`;
  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  res.status(200).send(xml);
}
