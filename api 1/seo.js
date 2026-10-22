// Crawler pre-render. The app is a client-side single page app, which search engines and link-preview bots only
// partly understand, so vercel.json routes known bot user agents here: a small, fully rendered HTML page per URL.
// People never see these pages; they get the app. The pages themselves are built in _seoPages.js.
import { normalizePath } from "../src/seoCore.js";
import { renderPage, siteOrigin } from "./_seoPages.js";

export default async function handler(req, res) {
  const origin = siteOrigin(req);
  const raw = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  const { status, headers, html } = await renderPage(normalizePath(raw || "/"), origin);
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (status === 301) return res.status(301).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(status).send(html);
}
