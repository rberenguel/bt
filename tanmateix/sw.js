const CACHE_NAME = "tanmateix-cache-v0.5.1";
const CACHE_FILES = [
  "./favicon.ico",
  "../shared/fonts/phosphor/phosphor.css",
  "./icon.png",
  "./index.html",
  "./lib/tau-prolog-core.js",
  "./main.js",
  "./manifest.json",
  "./render/logic.css",
  "./render/index.js",
  "./render/Renderer.js",
  "./render/Vocabulary.js",
  "./generators/index.js",
  "./generators/PathBasedQuestionGenerator.js",
  "./generators/PremiseNetworkGenerator.js",
  "./generators/QuestionGenerator.js",
  "./generators/ConclusionGenerator.js",
  "./models/index.js",
  "./models/MultiQuestion.js",
  "./models/Question.js",
  "./relations/index.js",
  "./relations/LinearRelationType.js",
  "./relations/SpatialRelationType.js",
  "./relations/CategoricalRelationType.js",
  "./utils/index.js",
  "./utils/RandomUtils.js",
  "./utils/SpatialGrid.js",
  "./utils/EntityFactory.js",
  "./core/index.js",
  "./core/Entity.js",
  "./core/PremiseNetwork.js",
  "./core/Relation.js",
  "./core/RelationType.js",
  "./core/Path.js",
  "./verification/SpatialVerifier.js",
  "./verification/QuestionVerifier.js",
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
