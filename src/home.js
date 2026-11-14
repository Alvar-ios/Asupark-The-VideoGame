// Pantalla de inicio tipo app: reto del día y ligas arriba, contrarreloj y clasificación debajo, Racing (carreras y Gran Premio) discreto,
// y barra inferior con Inicio / Ligas / Ranking / Amigos / Perfil. Los ajustes y la música quedan arriba a la derecha.
import { sk, vt } from './ux.js';
import { ic } from './icons.js';
export function initHome(ctx) {
  const { $, acc, esc, LG, PF } = ctx;
  const menu = $('menu');
  let screen = 'main';
  const setScreen = (s, kind) => { if (s === screen && !kind) return; vt(() => setScreenNow(s, kind)); };
  const setScreenNow = (s, kind) => {
    screen = s; menu.dataset.screen = s;
    if (kind) {
      menu.dataset.play = kind;
      const on = $('modeSel').querySelector('button.on'), cur = on && on.dataset.v;
      if (kind === 'tt' && cur !== 'tt') $('modeSel').querySelector('[data-v=tt]').click();
      if (kind === 'racing' && (!cur || cur === 'tt')) $('modeSel').querySelector('[data-v=race]').click();
      $('hmPlayTitle').textContent = kind === 'tt' ? 'Contrarreloj' : 'Racing';
    }
    const sc = $('menuLeft').querySelector('.menu-scroll'); if (sc) sc.scrollTop = 0;
  };
  setScreenNow('main');

  $('hmTT').onclick = () => setScreen('play', 'tt');
  $('hmRacing').onclick = () => setScreen('play', 'racing');
  $('hmRank').onclick = () => $('boardBtn').click();
  $('hmBack').onclick = () => setScreen('main');
  $('hmMusic').onclick = () => $('musicBtn').click();
  $('hmSet').onclick = () => $('setBtn').click();
  $('hmNav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const g = b.dataset.go;
    if (g === 'home') setScreen('main');
    else if (g === 'leagues') LG.open();
    else if (g === 'board') $('boardBtn').click();
    else if (g === 'friends') PF.open('amigos');
    else if (g === 'profile') PF.open('perfil');
  });

  // ---------- tarjeta de ligas ----------
  async function renderLeagues() {
    const box = $('hmLgBody'); if (!box) return;
    if (!acc.enabled) { box.innerHTML = '<p class="hm-lg-n">Las ligas necesitan conexión con el servidor.</p>'; return; }
    if (!acc.loggedIn) {
      box.innerHTML = `<p class="hm-lg-n">Compite con tus amigos en el reto diario por temporadas, con puntos como en la F1 y chat.</p><div class="hm-lg-cta"><button type="button" data-lg="create">Crear liga</button><button type="button" class="ghost" data-lg="join">Unirme con código</button></div>`;
      return;
    }
    let list = null, ud = null, shown = false;
    const cl = acc.cached('my_leagues'); if (Array.isArray(cl)) { shown = true; draw(box, cl, acc.cached('daily_underdog')); } else if (!box.querySelector('.hm-lg-r,.hm-lg-cta')) box.innerHTML = sk.rows(2);
    try { list = (await acc.swr('my_leagues', {}, () => {})) || []; } catch (e) { /* sin red */ }
    try { ud = await acc.swr('daily_underdog', {}, () => {}); } catch (e) { /* sin red */ }
    if (!list) { if (!shown) box.innerHTML = '<p class="hm-lg-n">No se han podido cargar tus ligas.</p>'; return; }
    draw(box, list, ud);
  }
  function draw(box, list, ud) {
    const prev = (l) => (l.last ? `<small class="prev">Temporada ${l.last.season}: campeón @${esc(l.last.champion || '?')}${l.last.me ? ` · tú P${l.last.me}` : ''}</small>` : '');
    const row = (l) => {
      const pct = l.days ? Math.max(4, Math.min(100, Math.round((l.day || 1) / l.days * 100))) : 0;
      return `<button type="button" class="hm-lg-r" data-lg-open="${l.id}"><i class="pos">${l.pos ? 'P' + l.pos : '–'}</i><span class="nm"><b>${esc(l.name)}</b><small>Temporada ${l.season}${l.days ? ` · día ${Math.min(l.day || 1, l.days)} de ${l.days}` : ''} · ${l.members} piloto${l.members === 1 ? '' : 's'}</small>${l.days ? `<u class="lgb"><s style="width:${pct}%"></s></u>` : ''}${prev(l)}</span><span class="pt"><b>${l.pts}</b><small>PTS</small>${l.ran === false ? '<em class="tg warn">Hoy sin correr</em>' : ''}</span></button>`;
    };
    const seen = (() => { try { return JSON.parse(localStorage.getItem('dr.seasonSeen') || '{}'); } catch (_) { return {}; } })();
    const fin = list.filter((l) => l.last && !seen[l.id + ':' + l.last.season])[0];
    const finHtml = fin ? `<button type="button" class="hm-fin" data-fin="${fin.id}" data-season="${fin.last.season}">${ic('trophy')} <span><b>Temporada ${fin.last.season} terminada</b> en ${esc(fin.name)}: campeón @${esc(fin.last.champion || '?')}${fin.last.me ? ` · tú P${fin.last.me}` : ''}</span></button>` : '';
    box.innerHTML = finHtml + (ud && ud.length ? `<div class="hm-len">${ic('snail')} <b>Eres el Lentorro</b> en ${esc(ud.join(', '))}: hoy puedes elegir coche en el reto</div>` : '')
      + (list.length ? list.map(row).join('') + `<div class="hm-lg-cta"><button type="button" data-lg="create">Crear liga</button><button type="button" data-lg="join">Unirme con código</button></div>`
        : `<p class="hm-lg-n">Todavía no estás en ninguna liga. Crea una e invita a tus amigos: cada día puntúa el reto como un Gran Premio.</p><div class="hm-lg-cta"><button type="button" data-lg="create">Crear liga</button><button type="button" data-lg="join">Unirme con código</button></div>`);
  }
  $('hmLeagues').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fin) { try { const k = JSON.parse(localStorage.getItem('dr.seasonSeen') || '{}'); k[b.dataset.fin + ':' + b.dataset.season] = 1; localStorage.setItem('dr.seasonSeen', JSON.stringify(k)); } catch (_) { /* sin almacenamiento */ } return LG.openLeague(b.dataset.fin, +b.dataset.season); }
    if (b.dataset.lgOpen) return LG.openLeague(b.dataset.lgOpen);
    LG.open(); // "ver todas", crear y unirme llevan a la pantalla de ligas, donde están los formularios
  });
  const label = () => { const t = $('hmNavUser'); if (t) t.textContent = acc.loggedIn && acc.username ? '@' + acc.username : 'Perfil'; };
  let tm = 0; const refresh = () => { clearTimeout(tm); tm = setTimeout(() => { label(); renderLeagues(); }, 250); };
  // accesos directos de la app instalada (?go=daily / ?go=leagues)
  try { const go = new URLSearchParams(location.search).get('go'); if (go) { const u = new URL(location.href); u.searchParams.delete('go'); history.replaceState(null, '', u.pathname + u.search + u.hash); setTimeout(() => { if (go === 'leagues') LG.open(); else if (go === 'daily') { const c = $('dailyCard'); if (c) c.click(); } }, 900); } } catch (_) { /* sin history */ }
  acc.onChange(refresh); label(); setTimeout(refresh, 1200);
  document.addEventListener('click', (e) => { if (e.target.closest('#lgClose,#dyClose,#profClose')) setTimeout(refresh, 400); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  return { refresh, setScreen };
}
