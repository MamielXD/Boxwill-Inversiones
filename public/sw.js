const CACHE_NAME = 'boxwill-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-black.png',
  '/isotipo-brandlab.png',
  // puedes añadir más rutas de _astro si quieres precachear
];

// Precaching
self.addEventListener('install', event => {
  self.skipWaiting(); // Fuerza la actualización inmediata del SW
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activación: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // Toma el control de las pestañas abiertas inmediatamente
});

// Estrategia de fetch
self.addEventListener('fetch', event => {
  const { request } = event;

  // Solo cachear peticiones GET (Cache API no soporta POST/PUT/DELETE)
  if (request.method !== 'GET') return;

  // Para API o admin → network-first
  if (request.url.includes('/api') || request.url.includes('/admin')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Para estáticos → cache-first
  event.respondWith(
    caches.match(request).then(response => {
      return (
        response ||
        fetch(request).then(networkResponse => {
          // Solo cachear si la respuesta es exitosa (evita guardar errores 502 de Cloudflare)
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(err => {
          // Si falla la red por completo
          console.error('Error fetching:', err);
        })
      );
    })
  );
});
