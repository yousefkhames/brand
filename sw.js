const CACHE = 'brand-v2';
importScripts('assets/kit-theme.js');
const customLogo = self.KitTheme.logoPath();
const FILES = ['./', 'index.html', 'css/style.css', 'js/lib.js', 'js/art.js', 'js/i18n.js', 'js/app.js', 'icon.svg', 'manifest.webmanifest', 'assets/kit-theme.js', 'assets/yk-logo.svg', 'assets/favicon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(async (c) => {
  await c.addAll(FILES);
  if (customLogo) { try { await c.add(customLogo); } catch { /* optional logo */ } }
}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => /^brand-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const url = new URL(e.request.url);
  if (![...FILES, ...(customLogo ? [customLogo] : [])].some((file) => new URL(file, self.registration.scope).pathname === url.pathname)) return;
  const request = new Request(url.origin + url.pathname);
  e.respondWith((async () => {
    const cached = async () => (await caches.open(CACHE)).match(request);
    try {
      const response = await fetch(e.request);
      if (response.ok) {
        try { await (await caches.open(CACHE)).put(request, response.clone()); } catch { /* cache unavailable */ }
        return response;
      }
      return response.status >= 500 ? (await cached()) || response : response;
    } catch {
      return (await cached()) || new Response('Offline', { status: 503 });
    }
  })());
});
