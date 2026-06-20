// ══════════════════════════════════════════════════════════
// TUITION TRACKER — SERVICE WORKER
// Cache-first for app shell. All data in localStorage.
// Works on GitHub Pages subfolder deployment.
// ══════════════════════════════════════════════════════════

const CACHE_NAME = 'tuition-tracker-v2';

// Use relative paths so this works in any subfolder
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
];

const CDN_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r125/three.min.js',
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache shell files (must succeed)
      try { await cache.addAll(SHELL_FILES); } catch(e) { console.warn('Shell cache partial', e); }
      // Cache CDN files (best effort)
      for (const url of CDN_FILES) {
        try { await cache.add(url); } catch(e) { /* offline during install is fine */ }
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

  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  // Don't intercept Google Fonts (they have their own caching)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return;

  const isCDN = CDN_FILES.some(f => event.request.url.startsWith(f.split('?')[0]));
  const isShell = url.hostname === self.location.hostname;

  if (isShell || isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
        // For shell files: return cache immediately if available, update in background
        return cached || networkFetch;
      })
    );
  }
});
