// Service worker: deja la versión web disponible sin conexión.
// En la app Android no hace falta (los archivos ya van dentro del APK) y podría servir
// una versión antigua tras actualizar, así que allí se da de baja solo.
const CACHE = 'pumba-v1.1.3';
const ASSETS = ['./', 'index.html', 'marcador.js', 'juego.js', 'online.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'masjuegos.js', 'turno.js', 'juegos/ajedrez.png', 'juegos/chinchon.png', 'juegos/damas.png'];
const NATIVE = self.location.hostname === 'localhost' && self.location.protocol === 'https:';

self.addEventListener('install', e => {
  if (NATIVE) { self.skipWaiting(); return; }
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => NATIVE || k !== CACHE).map(k => caches.delete(k)));
    if (NATIVE) { await self.registration.unregister(); return; }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (NATIVE || e.request.method !== 'GET') return;
  // Solo los archivos de la propia app: lo demás (GitHub, PayPal…) va siempre a internet
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // La página: primero internet (para tener siempre la última versión) y, sin conexión, la copia
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
