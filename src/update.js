// Una app instalada puede quedarse días abierta con el código viejo mientras los archivos ya son los nuevos.
// Aquí se comprueba si hay versión nueva y se recarga, nunca en mitad de una vuelta.
const KEY = 'dr.reloaded';
export function reloadForUpdate() {
  try { if (Date.now() - +(sessionStorage.getItem(KEY) || 0) < 60000) return false; sessionStorage.setItem(KEY, String(Date.now())); } catch (_) { return false; }
  location.reload(); return true;
}
export function watchUpdates(busy) {
  const version = __VERSION__;
  let latest = version, at = 0;
  const apply = () => { if (latest !== version && !busy()) reloadForUpdate(); };
  const check = async () => {
    if (Date.now() - at < 30000) return apply();
    at = Date.now();
    try { const r = await fetch('./version.json', { cache: 'no-store' }); if (r.ok) latest = (await r.json()).version || version; } catch (_) { /* sin conexión */ }
    apply();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 5 * 60000);
  setTimeout(check, 4000);
  return { check };
}
