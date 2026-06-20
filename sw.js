// ══════════════════════════════════════════════════════════
// TUITION TRACKER — SERVICE WORKER
// Cache-first for app shell. All data in localStorage.
// ══════════════════════════════════════════════════════════

const CACHE_NAME = 'tuition-tracker-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './sw.js'
];
const CDN_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://ajax.googleapis.com/ajax/libs/threejs/r125/three.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache shell files (must succeed)
      await cache.addAll(SHELL_FILES);
      // Cache CDN files (best effort — failure is OK)
      for (const url of CDN_FILES) {
        try { await cache.add(url); } catch(e) { /* offline during install */ }
      }
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Shell files & CDN: cache-first
  const isShell = SHELL_FILES.some(f => event.request.url.includes(f.replace('./','')));
  const isCDN   = CDN_FILES.some(f => event.request.url.startsWith(f.split('?')[0]));

  if (isShell || isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
