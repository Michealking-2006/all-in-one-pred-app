// Client for /api/news (the server holds the TheNewsAPI token as NEWS_ACCESS).
const TTL_MS = 15 * 60_000;
const cache = new Map();   // page -> { at, data }
const inflight = new Map();

const SESSION_KEY = "scoutwave.news.";
const keyOf = (page, tag) => (tag || "all") + ":" + page;

function sessionStore() {
  try { return window.sessionStorage; } catch { return null; }
}

export function clearNewsCache() {
  cache.clear();
  const store = sessionStore();
  if (!store) return;
  try {
    const names = [];
    for (let i = 0; i < store.length; i++) { const name = store.key(i); if (name && name.startsWith(SESSION_KEY)) names.push(name); }
    names.forEach((name) => store.removeItem(name));
  } catch { /* ignore */ }
}

export function peekNews(page = 1, tag = "") {
  const id = keyOf(page, tag);
  const hit = cache.get(id);
  if (hit) return Date.now() - hit.at < TTL_MS ? hit.data : undefined;
  try {
    const saved = JSON.parse(sessionStore()?.getItem(SESSION_KEY + id) || "null");
    if (saved && typeof saved.at === "number" && Date.now() - saved.at < TTL_MS && Array.isArray(saved.data?.articles)) {
      cache.set(id, saved);
      return saved.data;
    }
  } catch { /* corrupt entry: ignore */ }
  return undefined;
}

export function getNews(page = 1, tag = "") {
  const id = keyOf(page, tag);
  const cached = peekNews(page, tag);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(id)) return inflight.get(id);

  const promise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/news?page=" + page + (tag ? "&tag=" + encodeURIComponent(tag) : ""), { headers: { Accept: "application/json" }, signal: controller.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "News request failed (" + res.status + ").");
      if (!data || !Array.isArray(data.articles)) throw new Error("The news service returned an invalid response.");
      const entry = { at: Date.now(), data };
      cache.set(id, entry);
      try { sessionStore()?.setItem(SESSION_KEY + id, JSON.stringify(entry)); } catch { /* storage full or blocked */ }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("News request timed out. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  })().finally(() => inflight.delete(id));

  inflight.set(id, promise);
  return promise;
}

// "5 min ago", "3 h ago", "2 d ago", else a short date.
export function timeAgo(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + " h ago";
  const days = Math.round(hours / 24);
  if (days < 7) return days + " d ago";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Single stories (the in-app article page at /news/<words>-<id>)
// ---------------------------------------------------------------------------
const ARTICLE_KEY = "scoutwave.news.article.";
const memoryArticles = new Map();

// Called when a story is shown in a list, so opening it later needs no request at all.
export function rememberArticle(article) {
  if (!article?.id) return;
  memoryArticles.set(article.id, article);
  try { sessionStore()?.setItem(ARTICLE_KEY + article.id, JSON.stringify(article)); } catch { /* storage full or blocked */ }
}

function validArticle(a) {
  return a && typeof a === "object" && typeof a.id === "string" && typeof a.title === "string" && typeof a.url === "string";
}

// A story we already have: remembered from a list, or inside any cached page of the news list.
export function recallArticle(id) {
  if (memoryArticles.has(id)) return memoryArticles.get(id);
  try {
    const saved = JSON.parse(sessionStore()?.getItem(ARTICLE_KEY + id) || "null");
    if (validArticle(saved)) { memoryArticles.set(id, saved); return saved; }
  } catch { /* ignore a corrupt copy */ }
  for (const entry of cache.values()) {
    const hit = entry?.data?.articles?.find((a) => a.id === id);
    if (hit) return hit;
  }
  return null;
}

// Other stories we already have, for the "More stories" list. Never makes a request.
export function relatedArticles(id, limit = 4) {
  const out = [];
  for (const entry of cache.values()) {
    for (const a of entry?.data?.articles || []) if (a.id !== id && !out.some((o) => o.id === a.id)) out.push(a);
    if (out.length >= limit * 3) break;
  }
  return out.slice(0, limit);
}

// The story, from what we have or (for a shared link opened cold) from the server.
export async function getArticle(id) {
  const have = recallArticle(id);
  if (have) return have;
  const res = await fetch("/api/news?id=" + encodeURIComponent(id), { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !validArticle(data?.article)) {
    const error = new Error(res.status === 404 ? "This story is no longer available." : "The story could not be loaded.");
    error.notFound = res.status === 404;
    throw error;
  }
  rememberArticle(data.article);
  return data.article;
}
