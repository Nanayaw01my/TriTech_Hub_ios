const CACHE = 'tritech-v2';
const STATIC_CACHE = 'tritech-static-v2';

// App shell files to pre-cache on install
const PRECACHE = [
  '/',
  '/logo.png',
  '/favicon.svg',
  '/manifest.json',
  '/sw.js',
];

// Static assets (JS, CSS) — update these when you deploy new builds
const STATIC_ASSETS = [
  // Add your built JS/CSS chunks here after build, or rely on cache-first strategy below
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  // Activate new SW immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: delete old caches, take control of all clients ─────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for static assets ───────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Always go to the network for API calls — never serve stale data
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // For navigation requests (HTML pages), use network-first so users always
  // get fresh HTML, then fall back to cached shell for offline use
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Logo, favicon, and other images: cache with long expiry
  if (
    url.pathname === '/logo.png' ||
    url.pathname === '/favicon.svg' ||
    url.pathname.match(/\.(png|svg|jpg|jpeg|gif|webp)$/)
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            }
            return res;
          })
        );
      })
    );
    return;
  }

  // Static assets (JS, CSS): cache-first, update in background
  e.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});

// ── Push notifications (Android) ─────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'TriTech Hub', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'TriTech Hub iOS', {
      body: data.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: data.tag || 'tritech',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const match = wins.find((w) => w.url.includes(self.location.origin));
      if (match) { match.focus(); match.navigate(target); }
      else clients.openWindow(target);
    })
  );
});
