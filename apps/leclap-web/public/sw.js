// Zero-dependency service worker for offline/PWA support.
//
// Cross-origin isolation note: the app needs COOP/COEP headers (for SharedArrayBuffer /
// FFmpeg WASM). Those headers are set by the server on each response. This worker only ever
// *replays cached same-origin responses* — never synthesizes header-less ones — so the cached
// document keeps its COOP/COEP headers and `crossOriginIsolated` stays true offline. Cross-origin
// requests (Google Fonts, any CDN) are passed straight through to the network.

const CACHE = 'leclap-v1';
const APP_SHELL = '/';
// The ffmpeg.wasm core (see src/infrastructure/ffmpeg-core.ts), one directory per version.
const CORE_PREFIX = '/ffmpeg-core/';

// Open the cache and store a response, swallowing failures (quota, etc.).
// Fire-and-forget: the internal chain ends in `.catch`, so nothing floats.
function cachePut(key, response) {
  caches
    .open(CACHE)
    .then((cache) => cache.put(key, response))
    .catch(() => {});
}

// The version a core file belongs to: /ffmpeg-core/<version>/<file>.
function coreVersion(pathname) {
  return pathname.slice(CORE_PREFIX.length).split('/')[0];
}

// Store a core file, then drop every other version's files so an upgrade leaves no 10 MB behind.
// Fire-and-forget, like cachePut.
function cacheCore(request, response) {
  const version = coreVersion(new URL(request.url).pathname);

  caches
    .open(CACHE)
    .then((cache) =>
      cache
        .put(request, response)
        .then(() => cache.keys())
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => {
                const { pathname } = new URL(key.url);

                return pathname.startsWith(CORE_PREFIX) && coreVersion(pathname) !== version;
              })
              .map((key) => cache.delete(key))
          )
        )
    )
    .catch(() => {});
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave cross-origin requests to the browser (avoids caching opaque responses, which would
  // break COEP: require-corp).
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so updates ship immediately, falling back to the cached shell
  // (with its COOP/COEP headers intact) when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          cachePut(APP_SHELL, copy);

          return response;
        })
        .catch(() => caches.match(APP_SHELL).then((cached) => cached ?? caches.match(request)))
    );

    return;
  }

  // The core: a version's files never change, so serve them cache-first. Stale-while-revalidate would
  // download and store ~10 MB again behind every trim or render. Cached on first use, never preloaded.
  if (url.pathname.startsWith(CORE_PREFIX)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              cacheCore(request, response.clone());
            }

            return response;
          })
      )
    );

    return;
  }

  // Same-origin assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            cachePut(request, copy);
          }

          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    })
  );
});
