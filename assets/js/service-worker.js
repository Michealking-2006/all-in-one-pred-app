/* ============================= */

const CACHE_NAME = "nexora-css-v1";

/* CSS files to cache */
const CSS_FILES = [
  "/assets/css/index.css",
  "/assets/css/components.css"
];

/* ======== Install ========================== */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CSS_FILES))
  );
  
  self.skipWaiting();
});

/* ============================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    )
  );
  
  self.clients.claim();
});

/* =========================================================== */

self.addEventListener("fetch", event => {
  
  const request = event.request;
  
  /* Ignore everything except stylesheets */
  if (
    request.destination !== "style" &&
    !request.url.endsWith(".css")
  ) {
    return;
  }
  
  event.respondWith(
    
    caches.match(request).then(cached => {
      
      if (cached) {
        return cached;
      }
      
      return fetch(request).then(response => {
        
        if (!response || response.status !== 200) {
          return response;
        }
        
        const responseClone = response.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        
        return response;
        
      });
      
    })
    
  );
  
});