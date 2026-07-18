const CACHE = "volleystat-v3";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Toujours aller chercher sur le réseau, jamais de cache local.
  e.respondWith(fetch(e.request));
});