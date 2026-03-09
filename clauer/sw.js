const CACHE_NAME = "clauer-cache-v0.3.6";
const CACHE_FILES = [
  "../shared/fonts/InterDisplay-Bold.woff2",
  "../shared/fonts/InterDisplay-Italic.woff2",
  "../shared/fonts/InterDisplay-Regular.woff2",
  "../shared/fonts/iconoir/iconoir-font.css",
  "../shared/fonts/iconoir/iconoir.css",
  "../shared/fonts/iconoir/iconoir.woff2",
  "../shared/fonts/inter.css",
  "../shared/haptic.js",
  "./icon.png",
  "./icon192.png",
  "./index.html",
  "./js/constants.js",
  "./js/game.js",
  "./js/main.js",
  "./js/metrics.js",
  "./js/state.js",
  "./js/ui.js",
  "./manifest.json",
  "./style.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES).then(() => {
        // Activate immediately, don't wait for tabs to close
        return self.skipWaiting();
      });
    }),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Network failed and not in cache - for navigation, return cached index.html
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        }),
      ).then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      });
    }),
  );
});
