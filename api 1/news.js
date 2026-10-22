// Serverless proxy for TheNewsAPI (https://www.thenewsapi.com). The token stays
// on the server: set NEWS_ACCESS in Vercel -> Project Settings -> Environment
// Variables (and in a local .env for `vercel dev`).
//
// GET /api/news?page=1  ->  { articles: [...], page, found, limit }

import { tagQuery } from "../src/newsTags.js";
import crypto from "node:crypto";
import { safeUrl } from "../src/utils/safeUrl.js";
import { isProviderId } from "../src/newsArticle.js";

const API_URL = "https://api.thenewsapi.com/v1/news/all";

// Football-only: sports category plus a keyword query. Plain "football" alone
// pulls in a lot of American football, so lead with the soccer terms and fall
// back to the broad word only if that comes back empty.
const PRIMARY_QUERY = 'soccer | "premier league" | "champions league" | "la liga" | "serie a" | bundesliga';
const FALLBACK_QUERY = "football";

const MAX_PAGE = 20;

// Everything from the provider is untrusted text: lengths are capped, links must be plain https/http
// (never "javascript:" or "data:"), and images https only. The app also checks again when it renders.
const cap = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
export function cleanArticle(item) {
  if (!item || typeof item !== "object") return null;
  const url = safeUrl(String(item.url || ""), { httpsOnly: false });
  if (!url || /^(\/|#|\?|mailto:|tel:)/i.test(url) || !item.title) return null;
  return {
    // The provider's own id when it has one, otherwise a stable fingerprint of the link, so the same story
    // always has the same address in our app.
    id: isProviderId(String(item.uuid || "").toLowerCase()) ? String(item.uuid).toLowerCase() : crypto.createHash("sha1").update(url).digest("hex").slice(0, 32),
    title: cap(item.title, 240),
    description: cap(item.description || item.snippet || "", 600),
    url,
    image: safeUrl(String(item.image_url || ""), { image: true, httpsOnly: true }),
    source: cap(item.source, 80),
    publishedAt: item.published_at && !Number.isNaN(Date.parse(item.published_at)) ? new Date(item.published_at).toISOString() : "",
  };
}

async function fetchNews(token, search, page) {
  const params = new URLSearchParams({
    api_token: token,
    search,
    categories: "sports",
    language: "en",
    sort: "published_at",
    page: String(page),
  });
  const response = await fetch(API_URL + "?" + params.toString(), { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => null);
  return { response, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = String(process.env.NEWS_ACCESS || "").trim();
  if (!token) {
    return res.status(500).json({
      error: "Set NEWS_ACCESS in the Vercel project environment variables.",
      code: "MISSING_NEWS_ACCESS",
    });
  }

  // One story by id (an article opened from a shared link): ask the provider for just that story.
  const rawId = String(Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id || "").toLowerCase();
  if (rawId) {
    if (!isProviderId(rawId)) return res.status(404).json({ error: "Story not found.", code: "NEWS_NOT_FOUND" });
    try {
      const r = await fetch(`https://api.thenewsapi.com/v1/news/uuid/${rawId}?` + new URLSearchParams({ api_token: token }), { headers: { Accept: "application/json" } });
      const d = await r.json().catch(() => null);
      const article = r.ok ? cleanArticle(d) : null;
      if (!article) return res.status(r.status === 429 || r.status === 402 ? 429 : 404).json({ error: "Story not found.", code: "NEWS_NOT_FOUND" });
      res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
      return res.status(200).json({ article });
    } catch {
      return res.status(502).json({ error: "Unable to reach the news service.", code: "NEWS_NETWORK_ERROR" });
    }
  }

  const rawPage = Array.isArray(req.query?.page) ? req.query.page[0] : req.query?.page;
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(rawPage, 10) || 1));
  // A hashtag becomes one of our own pre-written searches (never free text).
  const rawTag = Array.isArray(req.query?.tag) ? req.query.tag[0] : req.query?.tag;
  const tag = rawTag ? String(rawTag) : "";
  const tagSearch = tag ? tagQuery(tag) : null;
  if (tag && !tagSearch) return res.status(400).json({ error: "Unknown news tag.", code: "NEWS_BAD_TAG" });

  try {
    let { response, data } = await fetchNews(token, tagSearch || PRIMARY_QUERY, page);
    if (!tag && response.ok && Array.isArray(data?.data) && data.data.length === 0 && page === 1) {
      ({ response, data } = await fetchNews(token, FALLBACK_QUERY, page));
    }

    if (!response.ok) {
      const providerCode = String(data?.error?.code || "");
      const limited = response.status === 402 || response.status === 429 || /limit/i.test(providerCode);
      return res.status(limited ? 429 : 502).json({
        error: limited ? "The news limit has been reached for now. Please try again later." : "The news service rejected the request.",
        code: limited ? "NEWS_RATE_LIMIT" : response.status === 401 ? "NEWS_BAD_TOKEN" : "NEWS_PROVIDER_ERROR",
      });
    }

    const articles = (Array.isArray(data?.data) ? data.data : []).map(cleanArticle).filter(Boolean);
    // News barely changes minute to minute, and the free plan is small — let the
    // edge cache absorb repeat visits.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({
      articles,
      page,
      tag: tag || null,
      found: Number(data?.meta?.found) || articles.length,
      limit: Number(data?.meta?.limit) || articles.length,
    });
  } catch (error) {
    console.error("News proxy error:", error?.message || error);
    return res.status(502).json({ error: "Unable to reach the news service.", code: "NEWS_NETWORK_ERROR" });
  }
}

// The latest stories, for the sitemap and the RSS feed (the same list the app opens first). Remembered for
// half an hour per server instance so the two never cost more than one provider request between them.
let latestCache = { at: 0, items: [] };
export async function latestArticles() {
  const token = String(process.env.NEWS_ACCESS || "").trim();
  if (!token) return [];
  if (Date.now() - latestCache.at < 30 * 60 * 1000) return latestCache.items;
  try {
    const { response, data } = await fetchNews(token, PRIMARY_QUERY, 1);
    const items = response.ok ? (Array.isArray(data?.data) ? data.data : []).map(cleanArticle).filter(Boolean) : [];
    if (items.length) latestCache = { at: Date.now(), items };
    return items.length ? items : latestCache.items;
  } catch { return latestCache.items; }
}
