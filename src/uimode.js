// Dos interfaces conviviendo: la clásica y la nueva (más simple y «cartoon»). Un botón cambia entre ambas al momento.
// La clase va en <html> y se pone ya en el <head> (ver index.template.html) para que no haya parpadeo al cargar.
import { vt } from './ux.js';

const KEY = 'dr.ui';
const subs = [];
export const isUi2 = () => document.documentElement.classList.contains('ui2');
export const onUi = (fn) => subs.push(fn);

function paintToggles() {
  const v2 = isUi2();
  for (const b of document.querySelectorAll('[data-ui-toggle]')) {
    b.setAttribute('aria-pressed', String(v2));
    b.setAttribute('aria-label', 'Interfaz: ' + (v2 ? 'nueva' : 'clásica') + '. Cambiar');
    for (const s of b.querySelectorAll('[data-ui]')) s.classList.toggle('on', (s.dataset.ui === 'v2') === v2);
  }
}
export function setUi(v2) {
  vt(() => {
    document.documentElement.classList.toggle('ui2', v2);
    try { localStorage.setItem(KEY, v2 ? 'v2' : 'v1'); } catch (_) { /* sin almacenamiento */ }
    paintToggles();
    for (const f of subs) { try { f(v2); } catch (_) { /* cada vista se repinta por su cuenta */ } }
  });
}
export function initUiToggle() {
  paintToggles();
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ui-toggle]'); if (!b) return;
    const want = e.target.closest('[data-ui]');
    setUi(want ? want.dataset.ui === 'v2' : !isUi2());
  });
}
export const uiToggleHtml = (cls = '') => `<button type="button" class="ui-tg ${cls}" data-ui-toggle><span data-ui="v1">Clásica</span><span data-ui="v2">Nueva</span></button>`;
