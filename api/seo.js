// Crawler pre-render, and the machine-readable documents for search engines (sitemaps, feed, robots.txt, llms.txt).
// The app is a client-side single page app, which search engines and link-preview bots only partly understand, so
// vercel.json routes known bot user agents here: a small, fully rendered HTML page per URL. People never see these
// pages; they get the app. The pages themselves are built in _seoPages.js.
// The documents share this function (Hobby plan: 12 functions at most): /sitemap.xml -> /api/seo?doc=sitemap, and so on.
import { normalizePath } from "../src/seoCore.js";
import { renderPage, siteOrigin } from "./_seoPages.js";

const DOCS = {
  sitemap: () => import("../server/sitemap.js"),
  feed: () => import("../server/feed.js"),
  robots: () => import("../server/robots.js"),
  llms: () => import("../server/llms.js"),
};
const first = (v) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req, res) {
  const doc = first(req.query?.doc);
  if (doc) {
    const load = Object.prototype.hasOwnProperty.call(DOCS, doc) ? DOCS[doc] : null;
    if (!load) return res.status(404).end();
    const { doc: _d, ...own } = req.query;
    req.query = own;
    return (await load()).default(req, res);
  }
  const origin = siteOrigin(req);
  const { status, headers, html } = await renderPage(normalizePath(first(req.query?.path) || "/"), origin);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (status === 301) return res.status(301).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(status).send(html);
}
