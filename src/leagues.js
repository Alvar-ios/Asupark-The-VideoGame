// Ligas de amigos: temporadas de 14 días sobre el reto diario, puntos como en la F1, intentos por día y chat.
// Toda la lógica vive en funciones RPC (supabase/leagues.sql) que identifican al jugador con auth.uid().
import { waShare, baseUrl, waBtn } from './share.js';

const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const leagueUrl = (code) => baseUrl() + '?liga=' + encodeURIComponent(code);

export function initLeagues(ctx) {
  const { $, acc, esc, fmt, flagSvg, toast } = ctx;
  const S = { view: 'list', id: null, tab: 'tabla', season: null, state: null, list: null, msg: '', last: 0, chat: [], poll: null, busy: false };
  const body = () => $('lgBody');
  const open = () => !$('leagues').classList.contains('hidden');
  const me = () => (acc.profile && acc.profile.user_id) || (acc.session && acc.session.user && acc.session.user.id);
  const dayTxt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  const flag = (f) => `<span class="flag sm">${flagSvg(f || 'es')}</span>`;
  const err = (e) => acc.explain(e);
  const stopPoll = () => { clearInterval(S.poll); S.poll = null; };

  const needLogin = () => { body().innerHTML = `<p class="lg-note">Entra en tu perfil para crear una liga o unirte a la de tus amigos. Solo hace falta un usuario y una contraseña.</p><button class="lg-btn" data-a="profile" type="button">Abrir perfil</button>`; };

  // ---------- listado de mis ligas ----------
  async function listView() {
    stopPoll(); S.view = 'list';
    if (!acc.loggedIn) return needLogin();
    if (!S.list) body().innerHTML = '<p class="lg-note">Cargando tus ligas…</p>';
    try { S.list = (await acc.rpc('my_leagues')) || []; } catch (e) { S.list = S.list || []; S.msg = err(e); }
    const card = (l) => `<button class="lg-card" data-open="${l.id}" type="button"><div class="lg-pos">${l.pos ? 'P' + l.pos : '–'}</div><div class="lg-info"><b>${esc(l.name)}</b><small>Temporada ${l.season} · ${l.members} piloto${l.members === 1 ? '' : 's'}</small></div><div class="lg-pts"><b>${l.pts}</b><small>PTS</small></div></button>`;
    body().innerHTML = `${S.list.length ? S.list.map(card).join('') : '<p class="lg-note">Todavía no estás en ninguna liga. Crea una e invita a tus amigos: cada día puntúa el reto diario como un Gran Premio de F1.</p>'}
      <h3 class="lg-h">Crear una liga</h3><div class="lg-row"><input id="lgName" class="lg-in" maxlength="30" placeholder="Nombre (ej. Los del Grupo)"><button class="lg-btn sm" data-a="create" type="button">Crear</button></div>
      <h3 class="lg-h">Unirme con un código</h3><div class="lg-row"><input id="lgCode" class="lg-in" maxlength="6" autocapitalize="characters" spellcheck="false" placeholder="Código de 6 letras"><button class="lg-btn sm ghost" data-a="join" type="button">Unirme</button></div>
      <div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`;
    S.msg = '';
  }

  // ---------- liga ----------
  async function load(season) {
    const st = await acc.rpc('league_state', { p_league: S.id, p_season: season || null });
    S.state = st; S.season = st.league.season; return st;
  }
  const head = (L) => `<div class="lg-head"><button class="lg-back" data-a="back" type="button">‹</button><div><b>${esc(L.name)}</b><small>Temporada ${L.season} · ${dayTxt(L.from)} – ${dayTxt(L.to)}</small></div></div>
    <div class="lg-inv"><div><small>CÓDIGO DE INVITACIÓN</small><b>${esc(L.code)}</b></div>${waBtn('Invitar', 'data-a="invite"', 'lg-btn sm wa')}<button class="lg-btn sm ghost" data-a="copy" type="button">Copiar enlace</button></div>
    <div class="lg-tabs">${[['tabla', 'Clasificación'], ['dias', 'Días'], ['chat', 'Chat']].map(([k, n]) => `<button type="button" data-t="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  async function leagueView() {
    S.view = 'league'; stopPoll();
    if (!S.state || S.state.league.id !== S.id) { body().innerHTML = '<p class="lg-note">Cargando liga…</p>'; try { await load(); } catch (e) { S.msg = err(e); return listView(); } }
    if (S.tab === 'chat') return chatView();
    return S.tab === 'dias' ? daysView() : tableView();
  }
  const seasonNav = (L) => `<div class="lg-sn"><button type="button" data-s="${L.season - 1}" ${L.season <= 1 ? 'disabled' : ''}>‹</button><span>Temporada ${L.season}${L.season === L.current ? ' · en curso' : ''}</span><button type="button" data-s="${L.season + 1}" ${L.season >= L.current ? 'disabled' : ''}>›</button></div>`;
  // Lentorro: el último de cada día cerrado (mínimo 2 pilotos con tiempo y sin empate)
  const lentorro = (d, L) => { if (d.day >= L.today || d.rows.length < 2) return null; const a = d.rows[d.rows.length - 1], b = d.rows[d.rows.length - 2]; return a.ms > b.ms ? a.user_id : null; };
  function tableView() {
    const { league: L, members, standings } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const rows = standings.map((s, i) => { const m = mm[s.user_id] || { username: '?' }; return `<tr class="${s.user_id === me() ? 'me' : ''}${i < 3 ? ' p' + (i + 1) : ''}"><td class="po">${i + 1}</td><td class="nm">${flag(m.flag)}<span>${esc(m.username)}</span></td><td>${s.wins}</td><td>${s.podiums}</td><td>${s.best ? fmt(s.best / 1000) : '–'}</td><td class="pt">${s.pts}</td></tr>`; }).join('');
    const yd = new Date(Date.parse(L.today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10), yday = S.state.days.find((d) => d.day === yd), yl = yday && lentorro(yday, L);
    const ban = yl && mm[yl] ? `<div class="lg-len">🐌 <b>Lentorro de ayer:</b> @${esc(mm[yl].username)}${yl === me() ? ' (¡eres tú! Hoy puedes elegir coche en el reto)' : ' · hoy puede elegir coche en el reto'}</div>` : '';
    body().innerHTML = `${head(L)}${seasonNav(L)}${ban}<table class="lg-t"><thead><tr><th>POS</th><th>PILOTO</th><th>VIC</th><th>POD</th><th>MEJOR</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="lg-note sm">🐌 El último de cada día es el Lentorro: al día siguiente puede elegir entre el coche del reto o uno de categoría superior. Cada día se reparten 25-18-15-12-10-8-6-4-2-1 puntos según el mejor tiempo del reto diario entre los miembros de la liga. La temporada dura ${L.season_days} días.</p>
      <button class="lg-btn ghost danger" data-a="leave" type="button">Salir de la liga</button><div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`;
    S.msg = '';
  }
  function daysView() {
    const { league: L, members, days } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const dayHtml = (d) => {
      const lead = d.rows[0].ms, len = lentorro(d, L), live = d.day === L.today, played = new Set(d.rows.map((r) => r.user_id));
      const rows = d.rows.map((r, i) => { const m = mm[r.user_id] || { username: '?' }, pts = PTS[i] || 0;
        const at = (r.attempts && r.attempts.length) ? r.attempts.map((a, k) => `<i${a === r.ms ? ' class="b"' : ''}>${k + 1}º ${fmt(a / 1000)}</i>`).join('') : '';
        const sec = r.s1 ? `<small class="sec">${[r.s1, r.s2, r.s3].map((x) => fmt(x / 1000)).join(' · ')}</small>` : '';
        return `<div class="lg-dr${r.user_id === me() ? ' me' : ''}"><div class="lg-d1"><i class="po">${i + 1}</i>${flag(m.flag)}<b>${esc(m.username)}${len === r.user_id ? '<span class="lg-tag">🐌</span>' : ''}</b><em>${fmt(r.ms / 1000)}</em><small class="gp">${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : 'LÍDER'}</small><span class="pp">+${pts}</span></div>${at || sec ? `<div class="lg-d2">${at}${at ? '' : sec}</div>` : ''}</div>`; }).join('');
      const miss = members.filter((m) => !played.has(m.user_id)).map((m) => esc(m.username));
      return `<div class="lg-day"><div class="lg-dh"><b>${esc(dayTxt(d.day))}</b>${live ? '<span class="live">HOY · PROVISIONAL</span>' : ''}</div>${rows}${miss.length ? `<p class="lg-miss">Sin tiempo: ${miss.join(', ')}</p>` : ''}</div>`;
    };
    body().innerHTML = `${head(L)}${seasonNav(L)}${days.length ? days.map(dayHtml).join('') : '<p class="lg-note">Aún no hay tiempos en esta temporada. Corre el reto diario y aparecerás aquí.</p>'}`;
  }

  // ---------- chat ----------
  const msgHtml = (m) => `<div class="lg-m${m.user_id === me() ? ' me' : ''}"><b>${m.user_id === me() ? 'Tú' : '@' + esc(m.username)}</b><span>${esc(m.body)}</span><small>${new Date(m.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></div>`;
  async function pull(first) {
    if (!open() || S.view !== 'league' || S.tab !== 'chat') return stopPoll();
    try {
      const r = (await acc.rpc('league_chat', { p_league: S.id, p_after: S.last })) || [];
      if (r.length || first) {
        const box = $('lgFeed'); if (!box) return; const stick = first || box.scrollHeight - box.scrollTop - box.clientHeight < 60;
        if (first) box.innerHTML = ''; if (r.length) S.last = r[r.length - 1].id;
        box.insertAdjacentHTML('beforeend', r.map(msgHtml).join('')); if (first && !r.length) box.innerHTML = '<p class="lg-note">Rompe el hielo: escribe el primer mensaje.</p>';
        else { const n = box.querySelector('.lg-note'); if (n && r.length) n.remove(); }
        if (stick) box.scrollTop = box.scrollHeight;
      }
    } catch (e) { /* sin red: se reintenta */ }
  }
  async function chatView() {
    S.last = 0; body().innerHTML = `${head(S.state.league)}<div id="lgFeed" class="lg-feed"></div><div class="lg-row"><input id="lgMsgIn" class="lg-in" maxlength="300" autocomplete="off" placeholder="Escribe a la liga…"><button class="lg-btn sm" data-a="send" type="button">Enviar</button></div>`;
    await pull(true); stopPoll(); S.poll = setInterval(() => pull(false), 4000);
  }
  async function send() {
    const el = $('lgMsgIn'); if (!el) return; const t = el.value.trim(); if (!t || S.busy) return; S.busy = true; el.value = '';
    try { await acc.rpc('league_post', { p_league: S.id, p_body: t }); await pull(false); } catch (e) { toast(err(e)); el.value = t; } finally { S.busy = false; }
  }

  // ---------- acciones ----------
  async function enter(id) { S.id = id; S.state = null; S.tab = 'tabla'; S.season = null; await leagueView(); }
  async function join(code) {
    const l = await acc.rpc('league_join', { p_code: code }); S.list = null; return l;
  }
  async function create() {
    const v = $('lgName').value.trim(); if (v.length < 2) { S.msg = 'Ponle un nombre a la liga'; return listView(); }
    try { const r = await acc.rpc('league_create', { p_name: v }); S.list = null; await enter(r.id); } catch (e) { S.msg = err(e); listView(); }
  }
  async function doJoin(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) { S.msg = 'El código tiene 6 caracteres'; return listView(); }
    try { const l = await join(code); toast('Te has unido a ' + l.name); await enter(l.id); } catch (e) { S.msg = err(e); listView(); }
  }
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Enlace copiado'); } catch (e) { prompt('Copia este enlace', t); } };

  $('lgBody').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) return enter(b.dataset.open);
    if (b.dataset.t) { S.tab = b.dataset.t; return leagueView(); }
    if (b.dataset.s) { try { await load(+b.dataset.s); } catch (er) { toast(err(er)); } return leagueView(); }
    const a = b.dataset.a;
    if (a === 'back') { S.state = null; return listView(); }
    if (a === 'create') return create();
    if (a === 'join') return doJoin($('lgCode').value);
    if (a === 'send') return send();
    if (a === 'profile') { $('leagues').classList.add('hidden'); stopPoll(); const pb = $('profBtn'); if (pb) pb.click(); return; }
    if (a === 'copy') return copy(leagueUrl(S.state.league.code));
    if (a === 'invite') { const L = S.state.league; return waShare(`🏁 Te invito a mi liga «${L.name}» de Drift Rush: cada día se puntúa el reto diario como un GP de F1 y hay chat para picarnos. Entra con este enlace y te unes al instante (código ${L.code}):`, leagueUrl(L.code)); }
    if (a === 'leave') { if (!confirm('¿Salir de la liga?')) return; try { await acc.rpc('league_leave', { p_league: S.id }); S.list = null; S.state = null; toast('Has salido de la liga'); } catch (er) { toast(err(er)); } return listView(); }
  });
  $('lgBody').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key !== 'Enter') return; if (e.target.id === 'lgMsgIn') send(); if (e.target.id === 'lgName') create(); if (e.target.id === 'lgCode') doJoin(e.target.value); });
  $('lgBody').addEventListener('keyup', (e) => e.stopPropagation());
  $('lgBody').addEventListener('input', (e) => { if (e.target.id === 'lgCode') e.target.value = e.target.value.toUpperCase(); });
  const show = () => { $('leagues').classList.remove('hidden'); };
  const close = () => { stopPoll(); $('leagues').classList.add('hidden'); };
  $('lgClose').onclick = close;
  const btn = $('leaguesBtn'); if (btn) btn.onclick = () => { show(); S.state = null; S.list = null; listView(); };

  // enlace de invitación ?liga=CODE: abre la liga y te une (o te pide iniciar sesión)
  const q = new URLSearchParams(location.search).get('liga'); let pend = q ? q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null;
  if (q) { try { const u = new URL(location.href); u.searchParams.delete('liga'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (_) { /* sin history */ } }
  async function tryJoin() {
    if (!pend || !acc.loggedIn) return; const code = pend; pend = null; show(); $('profile').classList.add('hidden');
    try { const l = await join(code); toast('Te has unido a ' + l.name); await enter(l.id); } catch (e) { S.msg = err(e); S.list = null; await listView(); }
  }
  if (pend) {
    setTimeout(async () => {
      if (acc.loggedIn) return tryJoin(); // sesión ya restaurada
      show(); let name = ''; try { const p = await acc.rpc('league_preview', { p_code: pend }, false); if (p) name = p.name; } catch (_) { /* sin red */ }
      body().innerHTML = `<p class="lg-note">${name ? `Te han invitado a la liga <b>${esc(name)}</b>.` : 'Te han invitado a una liga.'} Entra o crea tu cuenta (solo usuario y contraseña) y te unirás automáticamente.</p><button class="lg-btn" data-a="profile" type="button">Entrar / crear cuenta</button>`;
    }, 1800);
    acc.onChange(tryJoin);
  }
  return { open: () => { show(); S.state = null; S.list = null; listView(); } };
}
