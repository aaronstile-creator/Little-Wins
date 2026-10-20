/* Little Wins offline worker (used only when the app is hosted on a website, never from the downloaded file).
   It keeps a copy of the app so it opens without the internet, and refreshes that copy in the background.
   It never sees anyone's habits, goals or photos: those live only in the browser's storage on the device.
   Bump VERSION whenever index.html changes so phones pick up the new copy. */
const VERSION = '3f5d771f10d8';
const CACHE = 'little-wins-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('little-wins-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Saved copy first, so it opens instantly and offline; a fresh copy is fetched in the background for next time.
// Only opening the app itself (the folder, or index.html) counts as opening the app. Any other page in the
// folder goes straight to the network, so it can never overwrite the saved app.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const base = new URL(self.registration.scope).pathname;
  const isApp = req.mode === 'navigate' && (url.pathname === base || url.pathname === base + 'index.html');
  if (req.mode === 'navigate' && !isApp) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = isApp ? './index.html' : req;
    const saved = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then(r => {
      const isHtml = (r.headers.get('content-type') || '').includes('text/html');
      if (r.ok && r.type === 'basic' && (!isApp || isHtml)) cache.put(key, r.clone());
      return r;
    }).catch(() => null);
    if (saved) { e.waitUntil(fresh); return saved; }
    return (await fresh) || new Response('Little Wins is offline and has no saved copy yet. Connect to the internet once.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
