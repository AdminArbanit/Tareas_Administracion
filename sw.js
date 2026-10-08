// Service worker mínimo: la app se puede instalar y abrir sin conexión.
// Estrategia "red primero": siempre intenta traer la versión más nueva; solo usa la copia guardada si no hay red.
// Solo maneja pedidos GET del mismo origen (la sincronización con Google no pasa por acá).
const CACHE = 'tareas-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req)));
});
