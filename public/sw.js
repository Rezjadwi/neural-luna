// Minimal service worker — exists only to satisfy Chrome's installability
// requirement for "Add to Dock". Luna is a live dashboard talking to a local
// API, so we deliberately do NOT cache or serve offline responses here;
// everything just passes straight through to the network.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
