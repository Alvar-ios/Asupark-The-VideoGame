// Notificaciones push: avisos de adelantamientos, nuevo reto y recordatorio. Las envía la función send-push de Supabase (Web Push + VAPID).
import { isStandalone, isIOS } from './pwa.js';
const DEF = { overtaken: true, reminder: true, newday: true };
const LABEL = { overtaken: 'Cuando me quiten el liderato', newday: 'Nuevo reto cada mañana', reminder: 'Recordatorio si no he corrido' };
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

export function initPush({ $, acc, esc }) {
  const key = (window.DRIFT_CONFIG || {}).vapidKey;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!key;
  const S = { sub: null, prefs: null };
  async function refresh() {
    S.sub = null; S.prefs = null;
    if (!supported()) return;
    try {
      const reg = await navigator.serviceWorker.ready; S.sub = await reg.pushManager.getSubscription();
      if (S.sub && acc.loggedIn) { S.prefs = await acc.rpc('push_status', { p_endpoint: S.sub.endpoint }); if (!S.prefs) { await acc.rpc('push_subscribe', { p_endpoint: S.sub.endpoint, p_p256dh: S.sub.toJSON().keys.p256dh, p_auth: S.sub.toJSON().keys.auth, p_prefs: DEF }); S.prefs = { ...DEF }; } }
    } catch (e) { /* sin red */ }
  }
  async function enable() {
    if (!acc.loggedIn) return { err: 'Entra en tu perfil para activar los avisos' };
    const perm = await Notification.requestPermission(); if (perm !== 'granted') return { err: 'Permiso denegado: actívalo en los ajustes del navegador' };
    try {
      const reg = await navigator.serviceWorker.ready; const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      const j = sub.toJSON(); await acc.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_prefs: DEF });
      S.sub = sub; S.prefs = { ...DEF }; return {};
    } catch (e) { return { err: 'No se pudieron activar los avisos en este dispositivo' }; }
  }
  async function disable() { try { if (S.sub) { await acc.rpc('push_unsubscribe', { p_endpoint: S.sub.endpoint }); await S.sub.unsubscribe(); } } catch (e) { /* ya estaba baja */ } S.sub = null; S.prefs = null; }
  async function setPref(k) { if (!S.prefs || !S.sub) return; S.prefs = { ...S.prefs, [k]: !S.prefs[k] }; try { await acc.rpc('push_set_prefs', { p_endpoint: S.sub.endpoint, p_prefs: S.prefs }); } catch (e) { S.prefs[k] = !S.prefs[k]; } }

  // ----- ajustes -----
  const box = $('pushBox');
  async function renderBox(msg) {
    if (!box) return;
    if (!supported()) { box.innerHTML = `<p class="keys" style="display:block">${isIOS() && !isStandalone() ? 'En iPhone, instala la app (Compartir → Añadir a pantalla de inicio) para recibir avisos.' : 'Este navegador no admite avisos.'}</p>`; return; }
    if (!acc.loggedIn) { box.innerHTML = '<p class="keys" style="display:block">Entra en tu perfil para activar los avisos del reto.</p>'; return; }
    const on = !!(S.sub && S.prefs);
    box.innerHTML = `<button type="button" class="tog${on ? ' on' : ''}" data-p="master">Avisos: ${on ? 'SÍ' : 'NO'}</button>${on ? Object.keys(LABEL).map((k) => `<button type="button" class="tog${S.prefs[k] ? ' on' : ''}" data-p="${k}">${esc(LABEL[k])}: ${S.prefs[k] ? 'SÍ' : 'NO'}</button>`).join('') : ''}${msg ? `<p class="keys" style="display:block;color:#ff9a9a">${esc(msg)}</p>` : ''}`;
  }
  if (box) box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const k = b.dataset.p;
    if (k === 'master') { if (S.sub && S.prefs) await disable(); else { const r = await enable(); return renderBox(r.err); } } else await setPref(k);
    renderBox();
  });
  const sb = $('setBtn'); if (sb) sb.addEventListener('click', async () => { await refresh(); renderBox(); });

  // ----- tarjeta de inicio -----
  const card = $('hmPush');
  async function renderCard() {
    if (!card) return;
    await refresh();
    const dismissed = (() => { try { return Date.now() < +JSON.parse(localStorage.getItem('dr.pushHide') || '0'); } catch (_) { return false; } })();
    if (!supported() || !acc.loggedIn || (S.sub && S.prefs) || dismissed || (typeof Notification !== 'undefined' && Notification.permission === 'denied')) { card.classList.add('hidden'); return; }
    card.innerHTML = '<span>🔔</span><div><b>Activa los avisos</b><small>Te avisamos si te quitan el liderato, del nuevo reto y de tu racha.</small></div><button type="button" data-i="go">Activar</button><button type="button" class="x" data-i="x" aria-label="Ocultar">✕</button>';
    card.classList.remove('hidden');
  }
  if (card) card.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i === 'x') { try { localStorage.setItem('dr.pushHide', JSON.stringify(Date.now() + 14 * 864e5)); } catch (_) { /* sin almacenamiento */ } card.classList.add('hidden'); return; }
    const r = await enable(); if (r.err) { card.querySelector('small').textContent = r.err; return; } card.classList.add('hidden');
  });
  acc.onChange(() => setTimeout(renderCard, 300)); setTimeout(renderCard, 1500);
  return { refresh: renderCard };
}
