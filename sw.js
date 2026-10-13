// Offline helper: keeps a copy of the app so it opens instantly and
// works without signal. Always tries the internet first, so updates
// you upload show up the next time you open the app.
const CACHE = 'bookshelf-v1';
const SHELL = ['./', './index.html', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png'];
const CACHEABLE_HOSTS = ['www.gstatic.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const COVERS = 'bookshelf-covers';
const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com', 'archive.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== COVERS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Book covers never change, so keep a copy and show it instantly next time.
  if (req.destination === 'image' && COVER_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(COVERS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  if (!sameOrigin && !CACHEABLE_HOSTS.includes(url.hostname)) return; // book lookups & sync go straight to the network

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
