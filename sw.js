/*********************
 * Scoutwave service worker
 *********************/

const SW_VERSION = "v1";
const SHELL_CACHE = `scoutwave-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `scoutwave-runtime-${SW_VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/css/index.css",
  "/assets/css/pages.css",
  "/assets/css/ui/components.css",
  "/assets/css/entities.css",
  "/assets/css/pwa.css",
  "/assets/css/navigator-loader.css",
  "/assets/css/skeleton-loader.css",
  "/assets/css/utilities.css/toast-notification.css",
  "/assets/js/app/router.js",
  "/assets/js/app/script-helper.js",
  "/assets/js/pages/index.js",
  "/assets/js/ui/toast-notification.js",
  "/assets/js/ui/loader/skeleton-loader.js",
  "/assets/js/pwa/pwa.js",
  "/supabase/client.js",
  "/backend/supabase/verify-auth-status.js",
  "/assets/js/app/favourites-store.js",
  "/assets/icons/pwa/icon-192.png",
  "/assets/icons/pwa/icon-512.png",
  "/assets/icons/app/scoutwave-logo.png",
];

// requests that should never be served from cache or intercepted
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,
  /supabase\.co/,
  /api-sports\.io/,
  /api\.thenewsapi\.com/,
];

function isNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

/*********************
 * install: precache the shell
 *********************/

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
        )
      );
      await self.skipWaiting();
    })()
  );
});

/*********************
 * activate: drop old cache versions
 *********************/

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/*********************
 * fetch: routing strategy
 *********************/

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // never intercept API calls, auth, or third-party data providers
  if (isNeverCache(url.href)) return;

  // cross-origin static assets (cdn, flags, media) -> cache-first, best effort
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // SPA navigations -> network-first, fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // page fragments -> network-first, fall back to last-seen cached copy
  if (url.pathname.startsWith("/pages/")) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // static assets (css/js/icons/data) -> cache-first, refresh in background
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }
});

/*********************
 * strategies
 *********************/

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match("/index.html");
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || Response.error();
}
