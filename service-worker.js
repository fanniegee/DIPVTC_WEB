const CACHE_NAME = "dipvtc-family-pwa-v3";
const APP_SHELL = [
  "/offline.html",
  "/pwa-install.js",
  "/manifest.webmanifest",
  "/staff-app.webmanifest",
  "/admin-app.webmanifest",
  "/assets/images/dipvtc-pwa-192.png",
  "/assets/images/dipvtc-pwa-512.png",
  "/assets/images/dipvtc-pwa-maskable-512.png",
  "/assets/images/dipvtc-favicon.svg"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("dipvtc-family-pwa-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.includes("auth") || url.pathname.includes("portal")) return;
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
