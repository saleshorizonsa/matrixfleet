/* Haulora service worker — app shell caching for the driver PWA.
 * - static assets (/_next/static, /icons, fonts): cache-first
 * - page navigations: network-first, falling back to the last cached copy
 * - never cached: /api, /auth, server actions (POST), any cross-origin request (Supabase, maps)
 */
const VERSION = "hl-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, tiles, routing APIs
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return; // React Server Component payloads

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname.startsWith("/driver")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) =>
              hit ||
              caches.match("/driver").then(
                (home) =>
                  home ||
                  new Response(
                    '<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;background:#0a1430;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h1>Offline</h1><p>No connection. Your data is safe — reopen when you have signal.</p></div>',
                    { headers: { "Content-Type": "text/html; charset=utf-8" } },
                  ),
              ),
          ),
        ),
    );
  }
});
