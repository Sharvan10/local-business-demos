/* Shared service-worker logic, loaded with importScripts() from each owner app's sw.js.
   Strategy: precache the whole app on install (works fully offline after first visit),
   then stale-while-revalidate for same-origin GETs; navigations fall back to the cached app shell. */
/* eslint-env serviceworker */
self.setupSW = function setupSW({ name, version, files }) {
  const CACHE = `${name}-${version}`;
  const shell = new URL('./', self.registration.scope).href;

  self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(files)).then(() => self.skipWaiting()));
  });

  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith(`${name}-`) && k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    if (req.mode === 'navigate') {
      e.respondWith(
        fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(shell, copy)); return res; })
          .catch(() => caches.match(shell, { ignoreSearch: true }).then((r) => r || caches.match(req))),
      );
      return;
    }
    e.respondWith(
      caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })),
    );
  });
};
