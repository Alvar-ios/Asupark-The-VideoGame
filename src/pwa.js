// App instalable: service worker, tarjeta «Instalar» (Android/escritorio con el aviso nativo, iOS con instrucciones) y accesos directos (?go=daily|leagues).
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initPwa({ $, store }) {
  let deferred = null;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW: el juego sigue igual */ });
  const card = $('hmInstall');
  const hide = () => { if (card) card.classList.add('hidden'); };
  const dismissed = () => { try { return Date.now() < +store.get('pwaHide', 0); } catch (_) { return false; } };
  function render() {
    if (!card || isStandalone() || dismissed()) return hide();
    if (deferred) card.innerHTML = '<span>📲</span><div><b>Instala Drift Rush</b><small>Icono en tu pantalla de inicio, a pantalla completa y con avisos del reto.</small></div><button type="button" data-i="go">Instalar</button><button type="button" class="x" data-i="x" aria-label="Ocultar">✕</button>';
    else if (isIOS()) card.innerHTML = '<span>📲</span><div><b>Instala Drift Rush</b><small>Pulsa <b>Compartir</b> <i>⬆︎</i> y luego <b>Añadir a pantalla de inicio</b>.</small></div><button type="button" class="x" data-i="x" aria-label="Ocultar">✕</button>';
    else return hide();
    card.classList.remove('hidden');
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', () => { deferred = null; hide(); });
  if (card) card.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i === 'x') { store.set('pwaHide', Date.now() + 14 * 864e5); return hide(); }
    if (b.dataset.i === 'go' && deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (_) { /* cerrado */ } deferred = null; hide(); }
  });
  render();
  return { render };
}
