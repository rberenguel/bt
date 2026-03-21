// Generated with get_cache.go — run `go run get_cache.go` to regenerate.
// Dynamic fetch() targets added manually (not reachable via import graph).
const CACHE_NAME = "bt-hub-v0.3.1";
const CACHE_FILES = [
  "./app.js",
  "./attn/app.js",
  "./attn/history.js",
  "./attn/icon.png",
  "./attn/index.html",
  "./attn/manifest.json",
  "./attn/storage.js",
  "./attn/style.css",
  "./clauer/icon.png",
  "./clauer/icon192.png",
  "./clauer/index.html",
  "./clauer/js/constants.js",
  "./clauer/js/faker.js",
  "./clauer/js/game.js",
  "./clauer/js/history.js",
  "./clauer/js/main.js",
  "./clauer/js/metrics.js",
  "./clauer/js/state.js",
  "./clauer/js/storage.js",
  "./clauer/js/ui.js",
  "./clauer/manifest.json",
  "./clauer/style.css",
  "./dotmatrix/favicon.ico",
  "./dotmatrix/icon.png",
  "./dotmatrix/index.html",
  "./dotmatrix/manifest.json",
  "./icon.png",
  "./index.html",
  "./manifest.json",
  "./mussol/app.js",
  "./mussol/data/questions.md",
  "./mussol/faker.js",
  "./mussol/history.js",
  "./mussol/icon.png",
  "./mussol/icon192.png",
  "./mussol/index.html",
  "./mussol/manifest.json",
  "./mussol/storage.js",
  "./mussol/style.css",
  "./nb/fireworks.js",
  "./nb/icon.png",
  "./nb/icon_512.png",
  "./nb/index.html",
  "./nb/lib/idb-keyval.js",
  "./nb/manifest.json",
  "./nb/modals.js",
  "./nb/nb.js",
  "./nb/style.css",
  "./regles/game.js",
  "./regles/icon.png",
  "./regles/index.html",
  "./regles/manifest.json",
  "./regles/storage.js",
  "./regles/style.css",
  "./shared/fire.js",
  "./shared/fonts/InterDisplay-Bold.woff2",
  "./shared/fonts/InterDisplay-Italic.woff2",
  "./shared/fonts/InterDisplay-Regular.woff2",
  "./shared/fonts/iconoir/iconoir-font.css",
  "./shared/fonts/iconoir/iconoir.css",
  "./shared/fonts/iconoir/iconoir.woff2",
  "./shared/fonts/inter.css",
  "./shared/fonts/monoid-bold.woff2",
  "./shared/fonts/monoid-italic.woff2",
  "./shared/fonts/monoid-regular.woff2",
  "./shared/fonts/monoid.css",
  "./shared/fonts/phosphor/Phosphor-Light.woff2",
  "./shared/fonts/phosphor/phosphor.css",
  "./shared/haptic.js",
  "./shared/history.js",
  "./shared/idb-keyval.js",
  "./shared/storage.js",
  "./stop/app.js",
  "./stop/faker.js",
  "./stop/history.js",
  "./stop/icon.png",
  "./stop/index.html",
  "./stop/manifest.json",
  "./stop/storage.js",
  "./stop/style.css",
  "./style.css",
  "./summum/app.js",
  "./summum/faker.js",
  "./summum/history.js",
  "./summum/icon.png",
  "./summum/index.html",
  "./summum/manifest.json",
  "./summum/storage.js",
  "./summum/style.css",
  "./tanmateix/core/Entity.js",
  "./tanmateix/core/Path.js",
  "./tanmateix/core/PremiseNetwork.js",
  "./tanmateix/core/Relation.js",
  "./tanmateix/core/RelationType.js",
  "./tanmateix/faker.js",
  "./tanmateix/favicon.ico",
  "./tanmateix/generators/PathBasedQuestionGenerator.js",
  "./tanmateix/history.js",
  "./tanmateix/icon.png",
  "./tanmateix/index.html",
  "./tanmateix/lib/TAU-PROLOG-LICENSE",
  "./tanmateix/lib/tau-prolog-core.js",
  "./tanmateix/main.js",
  "./tanmateix/manifest.json",
  "./tanmateix/models/Question.js",
  "./tanmateix/relations/CategoricalRelationType.js",
  "./tanmateix/relations/LinearRelationType.js",
  "./tanmateix/relations/SpatialRelationType.js",
  "./tanmateix/relations/SyllogisticRelationType.js",
  "./tanmateix/render/Renderer.js",
  "./tanmateix/render/Vocabulary.js",
  "./tanmateix/render/logic.css",
  "./tanmateix/storage.js",
  "./tanmateix/utils/EntityFactory.js",
  "./tanmateix/utils/RandomUtils.js",
  "./tanmateix/utils/SpatialGrid.js",
  "./tanmateix/verification/QuestionVerifier.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of CACHE_FILES) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("bt-hub SW: failed to cache", url, err);
        }
      }
      return self.skipWaiting();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});
