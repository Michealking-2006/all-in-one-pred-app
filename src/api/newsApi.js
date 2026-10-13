// Client for /api/news (the server holds the TheNewsAPI token as NEWS_ACCESS).
const TTL_MS = 15 * 60_000;
const cache = new Map();   // page -> { at, data }
const inflight = new Map();

const SESSION_KEY = "scoutwave.news.";

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

export function peekNews(page = 1) {
  const hit = cache.get(page);
  if (hit) return Date.now() - hit.at < TTL_MS ? hit.data : undefined;
  try {
    const saved = JSON.parse(sessionStore()?.getItem(SESSION_KEY + page) || "null");
    if (saved && typeof saved.at === "number" && Date.now() - saved.at < TTL_MS && Array.isArray(saved.data?.articles)) {
      cache.set(page, saved);
      return saved.data;
    }
  } catch { /* corrupt entry: ignore */ }
  return undefined;
}

export function getNews(page = 1) {
  const cached = peekNews(page);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(page)) return inflight.get(page);

  const promise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/news?page=" + page, { headers: { Accept: "application/json" }, signal: controller.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "News request failed (" + res.status + ").");
      if (!data || !Array.isArray(data.articles)) throw new Error("The news service returned an invalid response.");
      const entry = { at: Date.now(), data };
      cache.set(page, entry);
      try { sessionStore()?.setItem(SESSION_KEY + page, JSON.stringify(entry)); } catch { /* storage full or blocked */ }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("News request timed out. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  })().finally(() => inflight.delete(page));

  inflight.set(page, promise);
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
