const CACHE_NAME = "nb-cache-v0.7.2";
const CACHE_FILES = [
  "../shared/fire.js",
  "./fireworks.js",
  "../shared/fonts/InterDisplay-Bold.woff2",
  "../shared/fonts/InterDisplay-Italic.woff2",
  "../shared/fonts/InterDisplay-Regular.woff2",
  "../shared/fonts/inter.css",
  "../shared/fonts/monoid-bold.woff2",
  "../shared/fonts/monoid-italic.woff2",
  "../shared/fonts/monoid-regular.woff2",
  "../shared/fonts/monoid.css",
  "../shared/fonts/phosphor/Phosphor-Light.woff2",
  "../shared/fonts/phosphor/phosphor.css",
  "../shared/haptic.js",
  "./icon.png",
  "./icon_512.png",
  "./index.html",
  "./lib/idb-keyval.js",
  "./manifest.json",
  "./modals.js",
  "./nb.js",
  "./style.css",
];

// Install event: opens a cache and adds the core files to it.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache
        .addAll(CACHE_FILES)
        .then(() => {
          console.info("All files cached successfully.");
          // Activate immediately, don't wait for tabs to close
          return self.skipWaiting();
        })
        .catch((error) => {
          console.error("Service worker installation failed:", error);
          throw error;
        });
    }),
  );
});

// Fetch event: serves assets from cache if available, otherwise fetches from network.
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

// Activate event: cleans up old caches.
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
