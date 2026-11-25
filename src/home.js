// La app: cabecera y barra inferior fijas, y en medio una página por pestaña (Campeonatos, Garaje, Correr,
// Tiempos y Perfil). La pantalla de «Correr» tiene además la ficha de cada circuito antes de salir a pista.
import { sk } from './ux.js';
import { ic } from './icons.js';
import { initSanctions } from './sanctions.js';
import { initGarage } from './garage.js';
import { initTimes, timeRows } from './times.js';

const TABS = ['champs', 'garage', 'race', 'times', 'profile'];

export function initHome(ctx) {
  const { $, acc, esc, LG, PF, helmetSvg, circuits, circuit, rows, race, daily, fmt, carName, garage, buildHelmets } = ctx;
  const app = $('app'), main = $('kxMain');
  initSanctions({ $, acc, esc });
  let tab = 'race', trackKey = null;

  const GR = initGarage({ $, esc, garage });
  const TM = initTimes({ $, esc, fmt, carName, circuits, circuit, rows, openTrack: (k) => openTrack(k) });

  // ---------- pestañas ----------
  const navBtns = [...$('hmNav').querySelectorAll('button')];
  function go(next, opts = {}) {
    if (!$('leagues').classList.contains('hidden')) $('lgClose').click();
    tab = next;
    app.dataset.tab = next;
    for (const p of main.querySelectorAll('.kx-page')) p.hidden = p.dataset.page !== next;
    const i = TABS.indexOf(next === 'track' ? 'race' : next);
    navBtns.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('hmNav').style.setProperty('--i', i);
    main.scrollTop = 0;
    render(opts);
  }
  function render(opts = {}) {
    if (tab === 'race') { renderHomeLeagues(); renderCircuits(); if (opts.to) requestAnimationFrame(() => $(opts.to).scrollIntoView({ block: 'start' })); }
    else if (tab === 'champs') renderChamps(opts.msg);
    else if (tab === 'garage') GR.render();
    else if (tab === 'times') TM.render(opts.track);
    else if (tab === 'profile') { PF.enter(); buildHelmets(); }
    else if (tab === 'track') renderTrack();
  }
  const NAV = { leagues: 'champs', garage: 'garage', home: 'race', board: 'times', profile: 'profile' };
  $('hmNav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(NAV[b.dataset.go]); });
  $('hmMusic').onclick = () => $('musicBtn').click();
  $('hmSet').onclick = () => $('setBtn').click();
  app.addEventListener('keydown', (e) => { if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) e.stopPropagation(); });

  // ---------- correr: circuitos para entrenar ----------
  function renderCircuits() {
    $('hmTracks').innerHTML = circuits().map((c) => `<button type="button" class="kx-track" data-track="${c.key}">${c.art}<b>${esc(c.name)}</b><span>${esc(c.meta)}</span></button>`).join('');
  }
  $('hmTracks').addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (b) openTrack(b.dataset.track); });

  // ---------- ficha de circuito ----------
  function openTrack(key) { trackKey = key; go('track'); }
  async function renderTrack() {
    const c = circuit(trackKey), box = $('kxTrack'), k = garage.current(), key = trackKey;
    box.innerHTML = `<button type="button" class="kx-back" data-a="back">${ic('back')} Volver</button>
      <h2 class="kx-title">${esc(c.name)}</h2><p class="kx-lead">${esc(c.meta)}, ${esc(c.env)}</p>
      <div class="kx-map">${c.art}</div>
      <div class="kx-duo"><div><span>Tu mejor vuelta</span><b>${c.best != null ? fmt(c.best / 1000) : 'Sin tiempo'}</b></div><div><span>Récord</span><b id="kxRec">…</b><small id="kxRecWho"></small></div></div>
      <button type="button" class="kx-kartline" data-a="garage"><img id="kxLineImg" data-noblur alt=""><span><b>${esc(k.name)}</b><small>Dorsal ${garage.num()}</small></span><em>Cambiar</em></button>
      <button type="button" class="kx-cta" data-a="go">Salir a pista</button>
      <p class="kx-lead center">Salida lanzada y vueltas ilimitadas.</p>
      <div id="kxTrackRows" class="kx-rows"></div>`;
    garage.shot(k.id, 240, 150).then((u) => { const im = $('kxLineImg'); if (im && u) im.src = u; });
    const res = await rows(key); if (trackKey !== key || tab !== 'track') return;
    const first = res.rows[0];
    $('kxRec').textContent = first ? fmt(first.ms / 1000) : 'Libre';
    $('kxRecWho').textContent = first ? first.name : 'Sé el primero';
    $('kxTrackRows').innerHTML = first ? `<h3 class="kx-sub">Los más rápidos</h3>${timeRows(res.rows.slice(0, 5), { esc, fmt, carName })}` : '';
  }
  $('kxTrack').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'back') go('race');
    else if (b.dataset.a === 'garage') go('garage');
    else if (b.dataset.a === 'go') race(trackKey);
  });

  // aviso mientras se cargan los modelos antes de salir
  const startBtn = $('startBtn'), status = $('modelStatus');
  new MutationObserver(() => { app.classList.toggle('loading', startBtn.disabled); }).observe(startBtn, { attributes: true, attributeFilter: ['disabled'] });
  new MutationObserver(() => { if (!status.hidden && status.textContent) ctx.toast(status.textContent); }).observe(status, { attributes: true, attributeFilter: ['hidden'] });

  // ---------- campeonatos ----------
  const visibleList = (l) => (Array.isArray(l) ? l.filter((x) => !LG.isHidden(x.id)) : []);
  const dayNow = (l) => Math.min(l.day || 1, l.days || 1);
  const progress = (l) => (l.days ? `<span class="kx-days" aria-hidden="true">${Array.from({ length: Math.min(l.days, 31) }, (_, i) => `<i class="${i + 1 < dayNow(l) ? 'd' : i + 1 === dayNow(l) ? 'n' : ''}"></i>`).join('')}</span>` : '');
  async function myLeagues(draw) {
    let shown = false;
    const cached = acc.cached('my_leagues'); if (Array.isArray(cached)) { shown = true; draw(visibleList(cached)); }
    try { const l = await acc.swr('my_leagues', {}, () => {}); draw(visibleList(l)); }
    catch (e) { if (!shown) draw(null); }
  }
  const failed = '<p class="kx-note">No se han podido cargar tus campeonatos. Revisa la conexión.</p>';
  const guest = () => (!acc.enabled ? '<p class="kx-note">Los campeonatos necesitan conexión con el servidor.</p>'
    : '<p class="kx-note">Compite con tus amigos: cada día una carrera y gana la mejor vuelta.</p><button type="button" class="kx-cta" data-a="login">Entrar o crear cuenta</button>');

  // resumen en la pantalla de «Correr»
  function renderHomeLeagues() {
    const box = $('hmLgBody');
    if (!acc.enabled || !acc.loggedIn) { box.innerHTML = guest(); return; }
    if (!box.children.length) box.innerHTML = sk.rows(2);
    myLeagues((list) => {
      if (!list) { box.innerHTML = failed; return; }
      const seen = (() => { try { return JSON.parse(localStorage.getItem('dr.seasonSeen') || '{}'); } catch (_) { return {}; } })();
      const fin = list.find((l) => l.last && !seen[l.id + ':' + l.last.season]);
      const finHtml = fin ? `<button type="button" class="kx-fin" data-fin="${fin.id}" data-season="${fin.last.season}">${ic('trophy')}<span><b>Temporada ${fin.last.season} terminada</b>${esc(fin.name)}: gana ${esc(fin.last.champion || '?')}${fin.last.me ? `, tú ${fin.last.me}º` : ''}</span></button>` : '';
      box.innerHTML = finHtml + (list.length ? list.map((l) => `<button type="button" class="kx-lgrow" data-open="${l.id}">
          <i class="kx-pos${l.pos === 1 ? ' p1' : ''}">${l.pos ? l.pos + 'º' : '–'}</i>
          <span class="kx-lgn"><b>${esc(l.name)}</b><small>Día ${dayNow(l)} de ${l.days || '–'}${l.ran === false ? '<em>Te falta correr hoy</em>' : ''}</small></span>
          <span class="kx-pts"><b>${l.pts ?? 0}</b><small>puntos</small></span></button>`).join('')
        : '<p class="kx-note">Todavía no estás en ningún campeonato.</p><button type="button" class="kx-cta" data-a="champs">Crear o unirme</button>');
    });
  }
  $('hmLeagues').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'login') return PF.open('perfil');
    if (b.dataset.a === 'champs' || b.dataset.lg === 'all') return go('champs');
    if (b.dataset.fin) { try { const k = JSON.parse(localStorage.getItem('dr.seasonSeen') || '{}'); k[b.dataset.fin + ':' + b.dataset.season] = 1; localStorage.setItem('dr.seasonSeen', JSON.stringify(k)); } catch (_) { /* sin almacenamiento */ } return LG.openLeague(b.dataset.fin, +b.dataset.season); }
    if (b.dataset.open) return LG.openLeague(b.dataset.open);
  });

  // página de campeonatos: de cada uno, la carrera que toca, la clasificación resumida y el botón de correr
  function raceBlock(l) {
    const d = daily().today();
    const art = d.revealed ? d.art : '<span class="kx-unknown">?</span>';
    return `<div class="kx-next"><span class="kx-thumb">${art}</span><span class="kx-nxt"><small>Carrera de hoy</small><b>${d.revealed ? esc(d.name) : 'Circuito por descubrir'}</b></span></div>
      <button type="button" class="kx-cta" data-a="daily">${l.ran === false ? 'Correr' : 'Mejorar mi tiempo'}</button>`;
  }
  function standingsHtml(state) {
    if (!state || !state.standings) return sk.rows(3);
    const mm = Object.fromEntries(state.members.map((m) => [m.user_id, m])), myId = (acc.profile && acc.profile.user_id) || (acc.session && acc.session.user.id);
    const all = state.standings.map((s, i) => ({ ...s, rank: i + 1 }));
    const show = all.filter((s) => s.rank <= 3 || s.user_id === myId);
    return `<ol class="kx-table">${show.map((s) => { const m = mm[s.user_id] || {}; return `<li class="${s.user_id === myId ? 'me' : ''}"><i>${s.rank}</i><span class="kx-hel">${helmetSvg(m.helmet)}</span><b>${esc(m.username || '?')}</b><em>${s.pts}<small>pts</small></em></li>`; }).join('')}</ol>${all.length > show.length ? `<p class="kx-more">y ${all.length - show.length} piloto${all.length - show.length === 1 ? '' : 's'} más</p>` : ''}`;
  }
  const forms = (msg) => `<section class="kx-card"><h3>Crear un campeonato</h3><div class="kx-field"><input id="kxNewName" maxlength="30" placeholder="Nombre del campeonato" aria-label="Nombre del campeonato"><button type="button" data-a="create">Crear</button></div>
    <h3>Unirme con un código</h3><div class="kx-field"><input id="kxCode" maxlength="6" autocapitalize="characters" spellcheck="false" placeholder="Código de 6 letras" aria-label="Código de invitación"><button type="button" data-a="join">Unirme</button></div>
    <p class="kx-msg" id="kxChampMsg" role="status">${esc(msg || '')}</p></section>`;
  const rules = '<section class="kx-card"><h3>Cómo se puntúa</h3><p class="kx-note">La mejor vuelta del día reparte puntos como en la Fórmula 1:</p><ol class="kx-scale">' + [25, 18, 15, 12, 10, 8, 6, 4, 2, 1].map((p, i) => `<li><i>${i + 1}º</i><b>${p}</b></li>`).join('') + '</ol></section>';
  let champSig = '';
  function renderChamps(msg) {
    const box = $('kxChamps');
    if (!acc.enabled || !acc.loggedIn) { champSig = ''; box.innerHTML = `<section class="kx-card">${guest()}</section>${rules}`; return; }
    if (msg !== undefined) champSig = '';
    if (!box.querySelector('.kx-champ,.kx-field')) { champSig = ''; box.innerHTML = sk.cards(2); }
    myLeagues((list) => {
      if (tab !== 'champs') return;
      if (!list) { box.innerHTML = failed; champSig = ''; return; }
      const sig = JSON.stringify([list, daily().today().revealed]);
      if (sig !== champSig || !box.querySelector('.kx-field')) {
        champSig = sig;
        const typed = ['kxNewName', 'kxCode'].map((id) => [id, $(id) && $(id).value]);
        box.innerHTML = list.map((l) => `<article class="kx-champ"><header><h3>${esc(l.name)}</h3><span>Día ${dayNow(l)} de ${l.days || '–'}</span></header>${progress(l)}${raceBlock(l)}
            <div data-standings="${l.id}">${standingsHtml(acc.cached('league_state', { p_league: l.id, p_season: null }))}</div>
            <button type="button" class="kx-link" data-open="${l.id}">Chat, puntuación y vitrina</button></article>`).join('')
          + (list.length ? '' : '<p class="kx-note">Todavía no estás en ningún campeonato. Crea uno e invita a tus amigos, o entra con su código.</p>') + forms(msg);
        for (const [id, v] of typed) if (v && $(id)) $(id).value = v;
      }
      for (const l of list) acc.swr('league_state', { p_league: l.id, p_season: null }, () => {}).then((st) => { const el = box.querySelector(`[data-standings="${l.id}"]`); if (el && st) el.innerHTML = standingsHtml(st); }).catch(() => {});
    });
  }
  async function submit(kind) {
    const input = $(kind === 'create' ? 'kxNewName' : 'kxCode'), out = $('kxChampMsg'); if (!input) return;
    out.textContent = '';
    try { if (kind === 'create') await LG.createLeague(input.value); else await LG.joinCode(input.value); input.value = ''; champSig = ''; }
    catch (e) { out.textContent = acc.explain(e); }
  }
  $('kxChamps').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'login') return PF.open('perfil');
    if (b.dataset.a === 'daily') return $('dailyCard').click();
    if (b.dataset.a === 'create' || b.dataset.a === 'join') return submit(b.dataset.a);
    if (b.dataset.open) return LG.openLeague(b.dataset.open);
  });
  $('kxChamps').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'kxNewName') submit('create'); if (e.key === 'Enter' && e.target.id === 'kxCode') submit('join'); });
  $('kxChamps').addEventListener('input', (e) => { if (e.target.id === 'kxCode') e.target.value = e.target.value.toUpperCase(); });

  // ---------- puesta al día ----------
  let tm = 0; const refresh = (delay = 250) => { clearTimeout(tm); tm = setTimeout(() => { if (tab !== 'profile') render(); }, delay); };
  // accesos directos de la app instalada (?go=daily / ?go=leagues)
  try { const q = new URLSearchParams(location.search).get('go'); if (q) { const u = new URL(location.href); u.searchParams.delete('go'); history.replaceState(null, '', u.pathname + u.search + u.hash); setTimeout(() => { if (q === 'leagues') go('champs'); else if (q === 'daily') $('dailyCard').click(); }, 900); } } catch (_) { /* sin history */ }
  acc.onChange(() => { champSig = ''; $('hmLgBody').innerHTML = ''; refresh(); });
  document.addEventListener('click', (e) => { if (e.target.closest('#lgClose,#dyClose')) refresh(400); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('menu').classList.contains('hidden')) refresh(); });

  go('race');
  return { go, refresh: () => { champSig = ''; render(); } };
}
