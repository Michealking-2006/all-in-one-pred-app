// Scoutwave service worker: makes the app installable and fast on repeat visits.
//   - code (JS / CSS / manifest): stale-while-revalidate. Served instantly from
//     the cache and refreshed in the background, so the next visit has the new
//     version. (index.html is always checked first, see below.)
//   - HTML navigations: network first, but if the network is slower than
//     NAV_TIMEOUT_MS the cached shell is used so the app never waits on a bad
//     connection. A fresh copy is saved either way.
//   - images / fonts: cache first.
//   - API and auth traffic is never cached here (the app caches API data itself).
// Bump CACHE to drop every previously cached file.
const CACHE = "scoutwave-shell-v2";
const NAV_TIMEOUT_MS = 2500;
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const save = (request, response) => {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return; // Supabase, API-Football images, etc.
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  const isStaticAsset = isFont || /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok || response.type === "opaque") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      )
    );
    return;
  }

  if (sameOrigin && /\.(js|css|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const refresh = fetch(request).then((response) => save(request, response));
        if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
        return refresh;
      })
    );
    return;
  }

  // HTML navigations: network first, with a time limit.
  event.respondWith(
    new Promise((resolve) => {
      const fallback = () => caches.match(request).then((hit) => hit || (request.mode === "navigate" ? caches.match("/index.html") : Response.error()));
      let settled = false;
      const timer = setTimeout(() => { if (!settled) fallback().then((r) => { if (!settled) { settled = true; resolve(r); } }); }, NAV_TIMEOUT_MS);
      fetch(request)
        .then((response) => { if (!settled) { settled = true; clearTimeout(timer); resolve(save(request, response)); } else save(request, response); })
        .catch(() => { if (!settled) { settled = true; clearTimeout(timer); fallback().then(resolve); } });
    })
  );
});
