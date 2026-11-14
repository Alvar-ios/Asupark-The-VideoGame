// Pantalla de Perfil: entrar / crear cuenta, estadísticas, vitrina de logros, amigos, rivalidad y salón de la fama.
import { waShare, inviteUrl, waBtn } from './share.js';
import { ic } from './icons.js';
import { sk } from './ux.js';
export function initProfile(ctx) {
  const { $, acc, esc, tracks, groupName, drvIc, playerDrv, fmt } = ctx;
  const S = { tab: 'perfil', mode: 'in', msg: '', rival: null, busy: false };
  const trackName = (id) => { const t = tracks.find((x) => x.key === id); return t ? t.name.replace(/ · .*$/, '') : id; };
  const body = () => $('profBody');

  // —— logros calculados a partir de las estadísticas
  function achievements(st, hall) {
    const out = [], kings = st.kings || [];
    for (const k of kings.slice(0, 8)) out.push({ ic: 'crown', t: 'Rey de ' + trackName(k.track), s: groupName(k.grp) + ' · ' + fmt(k.ms / 1000), gold: true });
    if (kings.length > 8) out.push({ ic: 'crown', t: '+' + (kings.length - 8) + ' récords más', s: 'Mejor tiempo de la categoría', gold: true });
    if (hall && hall.records && hall.records[0] && hall.records[0].name === st.username && kings.length) out.push({ ic: 'bolt', t: 'El más rápido en contrarreloj', s: kings.length + ' récords: nadie tiene más', gold: true });
    if (st.wins_rank === 1) out.push({ ic: 'trophy', t: 'Jugador con más victorias', s: st.wins + ' victorias', gold: true });
    const m = (c, ic, t, s) => { if (c) out.push({ ic, t, s }); };
    m(st.wins >= 1, 'medal', 'Primera victoria', 'Ganaste una carrera');
    m(st.wins >= 10, 'medal', '10 victorias', 'Veterano de parrilla');
    m(st.podiums >= 10, 'medal', '10 podios', 'Siempre arriba');
    m(st.laps >= 25, 'stopwatch', '25 vueltas guardadas', 'Constante');
    m(st.laps >= 100, 'stopwatch', '100 vueltas guardadas', 'Incansable');
    m(st.tracks >= 5, 'globe', 'Trotamundos', st.tracks + ' circuitos con tiempo');
    m(st.tracks >= 9, 'globe', 'Vuelta al mundo', 'Todos los circuitos');
    return out;
  }
  const ach = (a) => `<div class="ach${a.gold ? ' gold' : ''}"><i>${ic(a.ic)}</i><b>${esc(a.t)}</b><small>${esc(a.s)}</small></div>`;

  function head(st) {
    return `<div class="pf-head"><div class="pf-ic">${drvIc(playerDrv(), 0)}</div><div><b class="pf-name">@${esc(st.username)}</b><small>Piloto desde ${esc(String(st.since || '').slice(0, 10))}</small></div><button id="pfOut" class="mini" type="button">Salir</button></div>`;
  }
  const tabs = () => `<div class="tabs pf-tabs">${[['perfil', 'Perfil'], ['amigos', 'Amigos'], ['salon', 'Salón de la fama']].map(([k, n]) => `<button type="button" data-t="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;

  function loginView() {
    const reg = S.mode === 'up';
    body().innerHTML = `<p class="keys" style="display:block">Crea una cuenta para guardar tu perfil, ver tus estadísticas, añadir amigos y competir por los récords. Es solo un usuario y una contraseña.</p>
      <div class="tabs pf-tabs"><button type="button" data-m="in" class="${reg ? '' : 'on'}">Entrar</button><button type="button" data-m="up" class="${reg ? 'on' : ''}">Crear cuenta</button></div>
      <label class="pf-l">Usuario<input id="pfUser" class="sel" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="3-20: letras, números, _"></label>
      <label class="pf-l">Contraseña<input id="pfPass" class="sel" type="password" maxlength="64" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="mínimo 6 caracteres"></label>
      <button id="pfGo" class="big" type="button">${reg ? 'CREAR CUENTA' : 'ENTRAR'}</button><div id="pfMsg" class="pf-msg">${esc(S.msg)}</div>`;
  }

  async function profileView() {
    const st = acc.profile; if (!st) { body().innerHTML = sk.rows(4); return; }
    if (!body().children.length) body().innerHTML = sk.rows(4);
    let hall = null; try { hall = await acc.hall(); } catch (e) { /* sin salón */ }
    try { const fresh = await acc.stats(st.user_id); if (fresh) Object.assign(st, fresh); } catch (e) { /* datos en caché */ }
    const A = achievements(st, hall);
    let tro = []; try { tro = (await acc.rpc('my_trophies')) || []; } catch (e) { /* sin trofeos */ }
    let stk = null; try { stk = await acc.rpc('my_streak'); } catch (e) { /* sin racha */ }
    for (const x of tro) A.unshift(x.kind === 'champion' ? { gold: true, ic: 'trophy', t: 'Campeón · Temporada ' + x.season, s: x.league + ' · ' + x.pts + ' pts' } : { ic: 'snail', t: 'Lentorro de la temporada ' + x.season, s: x.league });
    if (stk && stk.best >= 2) A.unshift({ gold: stk.streak >= 7, ic: 'flame', t: 'Racha de ' + stk.streak + (stk.streak === 1 ? ' día' : ' días'), s: 'Mejor racha: ' + stk.best + ' días' });
    body().innerHTML = `${head(st)}${tabs()}<div class="pf-stats">${[['Vueltas', st.laps], ['Circuitos', st.tracks], ['Carreras', st.races], ['Victorias', st.wins], ['Podios', st.podiums], ['Récords', (st.kings || []).length]].map(([n, v]) => `<div><b>${v}</b><small>${n}</small></div>`).join('')}</div>
      <h3 class="pf-h">Vitrina</h3><div class="pf-shelf">${A.length ? A.map(ach).join('') : '<p class="keys" style="display:block">Aún no hay logros: gana carreras y bate récords para llenar la vitrina.</p>'}</div>`;
  }

  async function friendsView() {
    const st = acc.profile; body().innerHTML = `${head(st)}${tabs()}${sk.rows(4)}`;
    let list = []; try { list = (await acc.friends()) || []; } catch (e) { S.msg = acc.explain(e); }
    const row = (f) => {
      const ic = `<span class="pf-fi">${drvIc({ flag: f.flag, helm: f.helmet }, 1)}</span>`;
      const act = f.status === 'amigo' ? `<button class="mini" data-riv="${f.user_id}" data-u="${esc(f.username)}">Rivalidad</button><button class="mini ghost" data-rm="${f.user_id}">Quitar</button>`
        : f.status === 'recibida' ? `<button class="mini" data-ok="${f.user_id}">Aceptar</button><button class="mini ghost" data-rm="${f.user_id}">Rechazar</button>`
        : `<small>Pendiente</small><button class="mini ghost" data-rm="${f.user_id}">Cancelar</button>`;
      return `<div class="pf-fr">${ic}<b>@${esc(f.username)}</b><span class="pf-act">${act}</span></div>`;
    };
    body().innerHTML = `${head(st)}${tabs()}<div class="pf-add"><input id="pfFriend" class="sel" maxlength="20" autocapitalize="none" spellcheck="false" placeholder="usuario de tu amigo"><button id="pfAdd" class="mini" type="button">Añadir</button></div><div class="pf-wa">${waBtn('Invitar a un amigo por WhatsApp', 'id="pfWa"')}</div><div id="pfMsg" class="pf-msg">${esc(S.msg)}</div>
      <div class="pf-list">${list.length ? list.map(row).join('') : '<p class="keys" style="display:block">Todavía no tienes amigos. Añade a alguien por su nombre de usuario.</p>'}</div>`;
  }

  async function rivalView(id, uname) {
    const st = acc.profile; body().innerHTML = `${head(st)}${sk.rows(3)}`;
    let rows = []; try { rows = (await acc.rivalry(id)) || []; } catch (e) { body().innerHTML = `${head(st)}<div class="pf-msg">${esc(acc.explain(e))}</div><button id="pfBack" class="big" type="button">VOLVER</button>`; return; }
    let me = 0, they = 0; const lines = rows.map((r) => {
      const a = r.my_ms, b = r.their_ms; let cls = '', gap = '';
      if (a != null && b != null) { if (a < b) { me++; cls = 'win'; } else if (b < a) { they++; cls = 'lose'; } gap = (a < b ? '−' : '+') + (Math.abs(a - b) / 1000).toFixed(2); }
      return `<tr class="${cls}"><td>${esc(trackName(r.track_id))}<small> ${esc(groupName(r.grp))}</small></td><td>${a != null ? fmt(a / 1000) : '—'}</td><td>${b != null ? fmt(b / 1000) : '—'}</td><td>${gap}</td></tr>`;
    });
    body().innerHTML = `${head(st)}<h3 class="pf-h">Tú vs @${esc(uname)}</h3><div class="pf-score"><div><b>${me}</b><small>Tú ganas</small></div><div><b>${they}</b><small>Gana @${esc(uname)}</small></div></div>
      <div class="lbwrap"><table class="lbt pf-riv"><tr class="gh"><td>Circuito</td><td>Tú</td><td>@${esc(uname)}</td><td>Dif.</td></tr>${lines.length ? lines.join('') : '<tr><td colspan="4">Aún no hay tiempos de ninguno de los dos.</td></tr>'}</table></div><button id="pfBack" class="big" type="button">VOLVER</button>`;
  }

  async function hallView() {
    const st = acc.profile; body().innerHTML = `${head(st)}${tabs()}${sk.rows(4)}`;
    let h = null; try { h = await acc.hall(); } catch (e) { /* vacío */ }
    const list = (a, unit) => (a && a.length ? a.map((x, i) => `<tr class="${x.name === st.username ? 'me' : ''}"><td class="rk">${i + 1}</td><td class="nm">${esc(x.name)}</td><td class="tm">${x.n} ${unit}</td></tr>`).join('') : '<tr><td colspan="3">Aún no hay datos.</td></tr>');
    body().innerHTML = `${head(st)}${tabs()}<h3 class="pf-h">${ic('crown')} Más récords</h3><table class="lbt">${list(h && h.records, 'récords')}</table><h3 class="pf-h">${ic('trophy')} Más victorias</h3><table class="lbt">${list(h && h.wins, 'victorias')}</table>`;
  }

  async function render() {
    if (!acc.enabled) { body().innerHTML = '<p class="keys" style="display:block">Las cuentas necesitan conexión con el servidor (no configurado).</p>'; return; }
    if (!acc.loggedIn) return loginView();
    if (!acc.profile) { try { await acc.refreshProfile(); } catch (e) { S.msg = acc.explain(e); } if (!acc.profile) { body().innerHTML = `<p class="keys" style="display:block">No se pudo cargar el perfil: ${esc(S.msg || 'sin conexión')}.</p><button id="pfOut" class="mini" type="button">Salir</button>`; return; } }
    if (S.rival) return rivalView(S.rival.id, S.rival.u);
    if (S.tab === 'amigos') return friendsView();
    if (S.tab === 'salon') return hallView();
    return profileView();
  }

  async function submit() {
    if (S.busy) return; const u = $('pfUser').value, p = $('pfPass').value; S.busy = true; $('pfGo').disabled = true; $('pfMsg').textContent = '';
    try { if (S.mode === 'up') await acc.signUp(u, p); else await acc.signIn(u, p); S.msg = ''; S.tab = 'perfil'; }
    catch (e) { S.msg = acc.explain(e); $('pfMsg').textContent = S.msg; }
    finally { S.busy = false; }
    render();
  }

  $('profBody').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'pfGo') return submit();
    if (b.dataset.m) { S.mode = b.dataset.m; S.msg = ''; return loginView(); }
    if (b.dataset.t) { S.tab = b.dataset.t; S.rival = null; S.msg = ''; return render(); }
    if (b.id === 'pfOut') { acc.signOut(); S.tab = 'perfil'; S.rival = null; return render(); }
    if (b.id === 'pfBack') { S.rival = null; return render(); }
    if (b.id === 'pfWa') { const u = acc.username; waShare(`Únete a Daily Lapp y compite conmigo.${u ? ` Soy @${u}: abre el enlace y me añades como amigo al instante.` : ''} Un juego de carreras gratis en el navegador, con reto diario y clasificación.`, inviteUrl(u)); return; }
    if (b.id === 'pfAdd') { const v = $('pfFriend').value; if (!v.trim()) return; try { S.msg = String(await acc.addFriend(v)); } catch (er) { S.msg = acc.explain(er); } return friendsView(); }
    if (b.dataset.riv) { S.rival = { id: b.dataset.riv, u: b.dataset.u }; return render(); }
    if (b.dataset.ok) { try { await acc.respond(b.dataset.ok, true); S.msg = ''; } catch (er) { S.msg = acc.explain(er); } return friendsView(); }
    if (b.dataset.rm) { try { await acc.respond(b.dataset.rm, false); S.msg = ''; } catch (er) { S.msg = acc.explain(er); } return friendsView(); }
  });
  $('profBody').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'pfUser' || e.target.id === 'pfPass')) submit(); if (e.key === 'Enter' && e.target.id === 'pfFriend') $('pfAdd').click(); });
  $('profBtn').onclick = () => { S.msg = ''; $('profile').classList.remove('hidden'); render(); };
  $('profClose').onclick = () => $('profile').classList.add('hidden');
  const api = { open(tab) { S.msg = ''; S.rival = null; S.tab = tab || 'perfil'; $('profile').classList.remove('hidden'); render(); } };
  acc.onChange(() => { const t = $('profBtnLabel'); if (t) t.textContent = acc.loggedIn && acc.username ? '@' + acc.username : 'Perfil'; });
  return api;
}
