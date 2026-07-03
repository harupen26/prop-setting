const CACHE_VERSION = "props-setting-pwa-v8";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
  "/apple-touch-icon.png",
  "/maskable-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html", "/offline.html"));
    return;
  }

  if (
    url.pathname.startsWith("/_expo/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackPath, offlinePath) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) {
        return fallback;
      }
    }

    if (offlinePath) {
      const offline = await cache.match(offlinePath);
      if (offline) {
        return offline;
      }
    }

    throw new Error("No cached response available");
  }
}
