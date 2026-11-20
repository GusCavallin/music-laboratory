// Minimal service worker: makes the page installable as an app. It deliberately caches nothing,
// because data.js must always be fresh and the music is streamed from the local helper.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => e.respondWith(fetch(e.request)));
