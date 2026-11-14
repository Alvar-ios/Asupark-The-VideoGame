// Service worker de Daily Lapp: instalable, arranque rápido y notificaciones push.
const V = 'dr-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== V) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // Supabase y demás: siempre a la red
  if (r.mode === 'navigate' || /\.(js|html)$/.test(u.pathname)) { // código: red primero (siempre la última versión), caché si no hay conexión
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((ca) => ca.put(r, c)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('./index.html'))));
    return;
  }
  if (/\/assets\//.test(u.pathname)) { // modelos, miniaturas, audio: caché primero
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((ca) => ca.put(r, c)); } return res; })));
  }
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Daily Lapp', { body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag || 'dr', data: { url: d.url || './' }, renotify: !!d.tag }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cl) => { for (const c of cl) { if ('focus' in c) { c.navigate && c.navigate(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
