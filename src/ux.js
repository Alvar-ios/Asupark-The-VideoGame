import { ic } from './icons.js';
// Capa de experiencia: esqueletos de carga, transiciones de vista, botón Atrás y deslizar para cerrar en las pantallas,
// menú de comandos (Ctrl/⌘+K) con atajos, avisos con «Deshacer», imágenes que aparecen con desenfoque y precarga en segundo plano.
export const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// ---------- esqueletos: reproducen la forma del contenido para que no haya saltos ----------
const bar = (w, h = 12) => `<i class="sk" style="width:${w}%;height:${h}px"></i>`;
export const sk = {
  rows: (n = 4) => `<div class="sk-w" aria-busy="true" aria-label="Cargando">${Array.from({ length: n }, (_, i) => `<div class="sk-r"><i class="sk sk-c"></i><div class="sk-l">${bar(48 + ((i * 17) % 30), 13)}${bar(28 + ((i * 11) % 20), 9)}</div>${bar(14, 14)}</div>`).join('')}</div>`,
  cards: (n = 2) => `<div class="sk-w" aria-busy="true" aria-label="Cargando">${Array.from({ length: n }, () => `<div class="sk-card"><i class="sk sk-c lg"></i><div class="sk-l">${bar(55, 15)}${bar(35, 10)}</div></div>`).join('')}</div>`,
  league: () => `<div class="sk-w" aria-busy="true" aria-label="Cargando"><div class="sk-l" style="padding:6px 2px 14px">${bar(50, 20)}${bar(32, 10)}</div><div class="sk sk-block" style="height:62px"></div><div class="sk sk-block" style="height:38px;margin:12px 0"></div></div>${sk.rows(6)}`,
  text: (n = 3) => `<div class="sk-w" aria-busy="true" aria-label="Cargando">${Array.from({ length: n }, (_, i) => bar(92 - i * 14, 12)).join('')}</div>`,
};

// ---------- transición de vista (si el navegador la admite y el usuario no pide menos movimiento) ----------
export function vt(fn) {
  if (!document.startViewTransition || reduced() || document.hidden) { fn(); return Promise.resolve(); }
  try { const t = document.startViewTransition(() => { fn(); }); return t.updateCallbackDone.catch(() => {}); } catch (_) { fn(); return Promise.resolve(); }
}

// ---------- aviso global (con acción opcional) ----------
const tEl = () => { let e = document.getElementById('toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e); } return e; };
export const toastEl = {
  show(t, o = {}) {
    const e = tEl(); e.textContent = '';
    const s = document.createElement('span'); s.textContent = t; e.appendChild(s);
    if (o.action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = o.action; b.onclick = () => { if (o.onAction) o.onAction(); toastEl.hide(); }; e.appendChild(b); }
    e.className = 'show' + (o.action ? ' act' : ''); clearTimeout(toastEl.t); toastEl.t = setTimeout(() => { e.className = ''; }, o.ms || 2400);
  },
  hide() { const e = document.getElementById('toast'); if (e) e.className = ''; },
};

// ---------- aviso con «Deshacer»: la acción se ejecuta tras unos segundos, salvo que la deshagan (y se ejecuta ya si cierran la app) ----------
const pending = new Set();
export function undoable(label, run, { ms = 6000, onUndo } = {}) {
  let done = false, tm = 0;
  const fire = () => { if (done) return; done = true; clearTimeout(tm); pending.delete(fire); toastEl.hide(); try { run(); } catch (_) { /* se informa en run */ } };
  pending.add(fire); tm = setTimeout(fire, ms);
  toastEl.show(label, { action: 'Deshacer', ms, onAction: () => { if (done) return; done = true; clearTimeout(tm); pending.delete(fire); if (onUndo) onUndo(); } });
}

export function initUx({ $, acc }) {
  const body = document.body;
  document.addEventListener('visibilitychange', () => { if (document.hidden) [...pending].forEach((f) => f()); });
  addEventListener('pagehide', () => { [...pending].forEach((f) => f()); });

  // ----- pantallas superpuestas: botón Atrás las cierra (Android/PWA) y se cierran deslizando hacia abajo -----
  const SHEETS = { daily: 'dyClose', leagues: 'lgClose', boxui: 'bxClose', board: 'boardClose', musicPick: 'musicClose', settings: 'setClose', sanction: 'sancClose' };
  const stack = []; let navBack = 0;
  const visible = (id) => { const o = $(id); return !!o && !o.classList.contains('hidden'); };
  const closeBtn = (id) => $(SHEETS[id]);
  for (const id of Object.keys(SHEETS)) {
    const o = $(id); if (!o) continue;
    new MutationObserver(() => {
      const v = visible(id), i = stack.indexOf(id);
      if (v && i < 0) { stack.push(id); try { history.pushState({ dr: id }, ''); } catch (_) { /* sin history */ } }
      else if (!v && i >= 0) { stack.splice(i, 1); if (history.state && history.state.dr === id) { navBack++; try { history.back(); } catch (_) { navBack--; } } }
    }).observe(o, { attributes: true, attributeFilter: ['class'] });
  }
  addEventListener('popstate', () => {
    if (navBack > 0) { navBack--; return; }
    const id = stack[stack.length - 1]; if (!id) return;
    const b = closeBtn(id); stack.pop(); if (b) b.click();
    if (visible(id)) { stack.push(id); try { history.pushState({ dr: id }, ''); } catch (_) { /* sin history */ } } // no se pudo cerrar (p. ej. a mitad de una acción): se queda
  });

  // deslizar hacia abajo desde la parte superior de la pantalla para cerrarla
  const coarse = matchMedia('(pointer:coarse)').matches;
  if (coarse) {
    let g = null;
    const panelOf = (t) => t.closest('.dy-panel,.lg-panel,.panel');
    addEventListener('touchstart', (e) => {
      const o = e.target.closest && e.target.closest('.overlay'); if (!o || !SHEETS[o.id] || o.id === 'leagues' || e.touches.length !== 1) return; // de las ligas solo se sale con la flecha
      const p = panelOf(e.target); if (!p || e.target.closest('input,textarea,select,canvas,.dy-cv,[data-noswipe]')) return;
      for (let n = e.target; n && n !== o.parentElement; n = n.parentElement) { if (n.scrollTop > 0) return; if (n.scrollWidth > n.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return; }
      g = { o, p, x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, on: false, t: Date.now() };
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (!g) return; const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.on) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { g = null; return; } if (dy > 14 && dy > Math.abs(dx) * 1.4) { g.on = true; g.p.style.transition = 'none'; } else if (dy < -10) { g = null; return; } else return; }
      g.dy = Math.max(0, dy); g.p.style.transform = `translateY(${g.dy * .9}px)`; g.p.style.opacity = String(1 - Math.min(.5, g.dy / 700));
    }, { passive: true });
    const end = () => {
      if (!g) return; const { o, p, dy, on, t } = g; g = null; if (!on) return;
      const fast = dy / Math.max(1, Date.now() - t) > .6; p.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s';
      if (dy > 120 || (fast && dy > 50)) { p.style.transform = 'translateY(100%)'; p.style.opacity = '0'; setTimeout(() => { const b = closeBtn(o.id); if (b) b.click(); p.style.transition = ''; p.style.transform = ''; p.style.opacity = ''; }, reduced() ? 0 : 190); }
      else { p.style.transform = ''; p.style.opacity = ''; setTimeout(() => { p.style.transition = ''; }, 240); }
    };
    addEventListener('touchend', end, { passive: true }); addEventListener('touchcancel', end, { passive: true });
  }

  // ----- imágenes: aparecen desde un desenfoque con el fondo de carga, sin saltos -----
  const prep = (img) => {
    if (img.classList.contains('ld') || img.dataset.noblur != null) return;
    if (!img.getAttribute('decoding')) img.decoding = 'async';
    if (img.complete && img.naturalWidth) img.classList.add('ld'); else { img.classList.add('lz'); img.addEventListener('load', () => img.classList.add('ld'), { once: true }); img.addEventListener('error', () => img.classList.add('ld'), { once: true }); }
  };
  document.querySelectorAll('img').forEach(prep);
  new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; if (n.tagName === 'IMG') prep(n); else if (n.querySelectorAll) n.querySelectorAll('img').forEach(prep); }); }).observe(document.body, { childList: true, subtree: true });

  // ----- precarga en segundo plano: lo siguiente que el jugador va a abrir ya está listo -----
  let warmed = 0;
  const warm = () => {
    if (!acc.loggedIn || Date.now() - warmed < 60000 || document.hidden) return; warmed = Date.now();
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 600));
    idle(async () => {
      try { const l = await acc.swr('my_leagues', {}, () => {}); if (Array.isArray(l) && l[0]) acc.swr('league_state', { p_league: l[0].id, p_season: null }, () => {}).catch(() => {}); acc.swr('my_streak', {}, () => {}).catch(() => {}); } catch (_) { /* sin red */ }
    });
  };
  acc.onChange(() => setTimeout(warm, 1200)); setTimeout(warm, 2500); document.addEventListener('visibilitychange', () => { if (!document.hidden) warm(); });
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#hmLeagues,#hmNav [data-go="leagues"]')) { warmed = 0; warm(); } }, { passive: true });

  return {};
}
