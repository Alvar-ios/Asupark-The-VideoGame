// Ligas de amigos: temporadas de 14 días sobre el reto diario, puntos como en la F1, intentos por día y chat.
// Toda la lógica vive en funciones RPC (supabase/leagues.sql) que identifican al jugador con auth.uid().
import { waShare, baseUrl, waBtn } from './share.js';

const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const leagueUrl = (code) => baseUrl() + '?liga=' + encodeURIComponent(code);

export function initLeagues(ctx) {
  const { $, acc, esc, fmt, flagSvg, toast, dailyFor, daily } = ctx;
  const S = { view: 'list', id: null, tab: 'tabla', season: null, state: null, list: null, msg: '', chatSig: '', rx: null, recap: undefined, poll: null, busy: false };
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
    <div class="lg-tabs">${[['tabla', 'Tabla'], ['dias', 'Días'], ['cal', 'Calendario'], ['chat', 'Chat']].map(([k, n]) => `<button type="button" data-t="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  async function leagueView() {
    S.view = 'league'; stopPoll();
    if (!S.state || S.state.league.id !== S.id) { body().innerHTML = '<p class="lg-note">Cargando liga…</p>'; try { await load(); } catch (e) { S.msg = err(e); return listView(); } }
    if (S.tab === 'chat') return chatView();
    if (S.tab === 'cal') return calView();
    return S.tab === 'dias' ? daysView() : tableView();
  }
  const seasonNav = (L) => `<div class="lg-sn"><button type="button" data-s="${L.season - 1}" ${L.season <= 1 ? 'disabled' : ''}>‹</button><span>Temporada ${L.season}${L.season === L.current ? ' · en curso' : ''}</span><button type="button" data-s="${L.season + 1}" ${L.season >= L.current ? 'disabled' : ''}>›</button></div>`;
  const fms = (ms) => fmt(ms / 1000);

  // ---------- resumen de ayer ----------
  async function recapHtml(L) {
    if (L.season !== L.current) return '';
    if (S.recap === undefined || S.recapFor !== L.id) { S.recapFor = L.id; try { S.recap = await acc.rpc('league_recap', { p_league: L.id }); } catch (e) { S.recap = null; } }
    const r = S.recap; if (!r) return '';
    const line = (ic, t) => `<li><i>${ic}</i><span>${t}</span></li>`;
    return `<div class="lg-recap"><div class="lg-rh"><b>☀️ RESUMEN DE AYER</b><small>${esc(dayTxt(r.day))} · ${r.players} piloto${r.players === 1 ? '' : 's'}</small></div><ul>
      ${line('🏆', `<b>@${esc(r.winner.username)}</b> ganó con ${fms(r.winner.ms)}${r.second ? ` · <em>+${(r.second.gap / 1000).toFixed(3)}</em> sobre @${esc(r.second.username)}` : ''}`)}
      ${r.me ? line('🎯', `Tú: <b>P${r.me.pos}</b> (${fms(r.me.ms)}) · +${r.me.pts} pts`) : line('😴', 'Ayer no corriste el reto')}
      ${r.climber ? line('📈', `<b>@${esc(r.climber.username)}</b> sube de P${r.climber.from} a P${r.climber.to}`) : ''}
      ${r.leader ? line('👑', `Líder: <b>@${esc(r.leader.username)}</b> (${r.leader.pts} pts)`) : ''}
    </ul><button class="lg-btn sm ghost" data-a="recap" type="button">Compartir resumen</button></div>`;
  }
  async function shareRecap() {
    const L = S.state.league, r = S.recap; if (!r) return;
    const mm = Object.fromEntries(S.state.members.map((m) => [m.user_id, m]));
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0a12'); g.addColorStop(0.5, '#0a0d16'); g.addColorStop(1, '#0a0d16'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e10600'; c.fillRect(0, 0, W, 18); const k = 54; for (let i = 0; i < W / k; i++) { c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(i * k, H - 36, k, 18); c.fillStyle = i % 2 ? '#111' : '#fff'; c.fillRect(i * k, H - 18, k, 18); }
    const T = (t, x, y, sz, col, w = 800, al = 'left') => { c.font = `italic ${w} ${sz}px "Jersey 10", Impact, sans-serif`; c.fillStyle = col; c.textAlign = al; c.fillText(t, x, y); };
    T('DRIFT RUSH · RESUMEN', 70, 120, 44, '#ffd34e'); T(L.name.toUpperCase(), 70, 210, 84, '#fff'); T(dayTxt(r.day).toUpperCase(), 70, 270, 40, '#9fb0cf');
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(70, 330, W - 140, 330); T('🏆 GANADOR DEL DÍA', 110, 400, 40, '#ffd34e'); T('@' + r.winner.username, 110, 500, 100, '#fff'); T(fms(r.winner.ms) + (r.second ? `   +${(r.second.gap / 1000).toFixed(3)} sobre @${r.second.username}` : ''), 110, 600, 46, '#c8d2e6', 700);
    const rows = []; if (r.climber) rows.push(['📈', `@${r.climber.username} sube de P${r.climber.from} a P${r.climber.to}`]); if (r.leader) rows.push(['👑', `Líder: @${r.leader.username} · ${r.leader.pts} pts`]); if (r.lentorro && mm[r.lentorro]) rows.push(['🐌', `Lentorro de hoy: @${mm[r.lentorro].username}`]); if (r.me) rows.push(['🎯', `Yo: P${r.me.pos} · ${fms(r.me.ms)}`]);
    rows.forEach((x, i) => { T(x[0], 90, 790 + i * 120, 62, '#fff'); T(x[1], 190, 790 + i * 120, 54, '#eef2ff', 700); });
    T('¿Te atreves con el reto de hoy?', 70, H - 120, 46, '#ffd34e'); T(location.host + location.pathname.replace(/\/$/, ''), 70, H - 70, 36, '#9fb0cf', 700);
    const text = `☀️ Resumen de «${L.name}» (${dayTxt(r.day)}): ganó @${r.winner.username} con ${fms(r.winner.ms)}${r.leader ? ` · líder @${r.leader.username} (${r.leader.pts} pts)` : ''}. ¿Te atreves con el reto de hoy?`;
    try {
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png')), f = new File([blob], 'resumen-drift-rush.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    waShare(text, leagueUrl(L.code));
  }

  // ---------- predicción ----------
  function predHtml(L, mm) {
    if (L.season !== L.current) return '';
    const P = S.state.pred || {}, pk = P.pick;
    if (pk) return `<div class="lg-pred">🎯 <b>Tu apuesta de hoy:</b> @${esc((mm[pk] || {}).username || '?')} · +1 punto si gana el reto</div>`;
    if (!P.can) return '';
    return `<div class="lg-pred"><b>🎯 ¿Quién gana hoy?</b><small>Apuesta antes de correr: +1 punto si aciertas</small><div class="lg-chips">${S.state.members.map((m) => `<button type="button" data-pick="${m.user_id}">${flag(m.flag)} ${esc(m.username)}${m.user_id === me() ? ' (yo)' : ''}</button>`).join('')}</div></div>`;
  }

  // ---------- podio de temporada cerrada ----------
  function podiumHtml(L, mm, standings) {
    if (L.season >= L.current) return '';
    const pl = standings.filter((x) => x.days > 0); if (pl.length < 2) return '';
    const top = pl.slice(0, 3), order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0], hs = [100, 70, 50], cs = ['#ffd34e', '#d5dbe6', '#e0955a'];
    const last = pl.length >= 3 ? pl[pl.length - 1] : null;
    return `<div class="lg-podium"><b class="lg-pt">🏆 TEMPORADA ${L.season} TERMINADA</b><div class="lg-pods">${order.map((i) => { const x = top[i], m = mm[x.user_id] || { username: '?' }; return `<div class="pod p${i + 1}"><span>${i === 0 ? '👑' : ''}${esc(m.username)}</span><div class="bar" style="--h:${hs[i]}px;background:${cs[i]}"><b>${i + 1}</b><small>${x.pts} pts</small></div></div>`; }).join('')}</div>${last ? `<p class="lg-note sm" style="text-align:center">🐌 Lentorro de la temporada: <b>@${esc((mm[last.user_id] || {}).username || '?')}</b></p>` : ''}</div>`;
  }

  async function tableView() {
    const { league: L, members, standings } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const rows = standings.map((s, i) => { const m = mm[s.user_id] || { username: '?' }; return `<tr class="${s.user_id === me() ? 'me' : ''}${i < 3 ? ' p' + (i + 1) : ''}"><td class="po">${i + 1}</td><td class="nm">${flag(m.flag)}<span>${esc(m.username)}${s.user_id === S.state.lentorro ? ' 🐌' : ''}</span>${m.streak > 1 ? `<small class="fire">🔥${m.streak}</small>` : ''}</td><td>${s.wins}</td><td>${s.podiums}</td><td>${s.best ? fmt(s.best / 1000) : '–'}</td><td class="pt">${s.pts}${s.bonus ? `<small class="bn">🎯${s.bonus}</small>` : ''}</td></tr>`; }).join('');
    const yl = S.state.lentorro;
    const ban = yl && mm[yl] && L.season === L.current ? `<div class="lg-len">🐌 <b>Lentorro de hoy:</b> @${esc(mm[yl].username)}${yl === me() ? ' (¡eres tú! Hoy puedes elegir coche en el reto)' : ' · hoy puede elegir coche en el reto'}</div>` : '';
    const rec = await recapHtml(L); if (S.tab !== 'tabla' || S.view !== 'league') return;
    body().innerHTML = `${head(L)}${rec}${seasonNav(L)}${podiumHtml(L, mm, standings)}${ban}${predHtml(L, mm)}<table class="lg-t"><thead><tr><th>POS</th><th>PILOTO</th><th>VIC</th><th>POD</th><th>MEJOR</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="lg-note sm">Cada día se reparten 25-18-15-12-10-8-6-4-2-1 puntos según el mejor tiempo del reto entre los miembros. 🎯 Acertar quién gana el día suma +1. 🐌 El Lentorro es quien menos puntos lleva (si ayer corrió) y hoy puede elegir coche. La temporada dura ${L.season_days} días.</p>
      <button class="lg-btn ghost danger" data-a="leave" type="button">Salir de la liga</button><div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`;
    S.msg = '';
  }

  // ---------- calendario de la temporada (cada día es un GP) ----------
  function calView() {
    const { league: L, days, members } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m])), byDay = Object.fromEntries(days.map((d) => [d.day, d]));
    const out = [];
    for (let i = 0; i < L.season_days; i++) {
      const day = new Date(Date.parse(L.from + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10), fut = day > L.today, isToday = day === L.today, info = !fut && dailyFor ? dailyFor(day) : null, d = byDay[day], w = d && d.rows[0];
      out.push(`<div class="lg-gp${isToday ? ' now' : ''}${fut ? ' fut' : ''}"><div class="gpn"><small>GP</small><b>${i + 1}</b></div><div class="gpi">${fut ? '<b>? ? ?</b><small>Se revela ese día</small>' : `<b>${info ? `<span class="flag sm">${flagSvg(info.flag)}</span> ${esc(info.name)}` : 'Reto del día'}</b><small>${esc(dayTxt(day))}${info ? ' · ' + esc(info.car) : ''}</small>`}</div><div class="gpw">${isToday ? '<span class="live">HOY</span>' : ''}${w ? `<small>🏆</small><b>${esc((mm[w.user_id] || {}).username || '?')}</b>` : fut ? '' : '<small>sin tiempos</small>'}</div></div>`);
    }
    body().innerHTML = `${head(L)}${seasonNav(L)}<div class="lg-cal">${out.join('')}</div>`;
  }
  function daysView() {
    const { league: L, members, days } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const dayHtml = (d) => {
      const lead = d.rows[0].ms, live = d.day === L.today, played = new Set(d.rows.map((r) => r.user_id));
      const rows = d.rows.map((r, i) => { const m = mm[r.user_id] || { username: '?' }, pts = PTS[i] || 0;
        const at = (r.attempts && r.attempts.length) ? r.attempts.map((a, k) => `<i${a === r.ms ? ' class="b"' : ''}>${k + 1}º ${fmt(a / 1000)}</i>`).join('') : '';
        const sec = r.s1 ? `<small class="sec">${[r.s1, r.s2, r.s3].map((x) => fmt(x / 1000)).join(' · ')}</small>` : '';
        return `<div class="lg-dr${r.user_id === me() ? ' me' : ''}"><div class="lg-d1"><i class="po">${i + 1}</i>${flag(m.flag)}<b>${esc(m.username)}</b><em>${fmt(r.ms / 1000)}</em><small class="gp">${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : 'LÍDER'}</small><span class="pp">+${pts}</span></div>${d.day === L.today && r.user_id !== me() && m.ghost ? `<div class="lg-d2"><button type="button" class="lg-gh" data-ghost="${r.user_id}">👻 Correr contra su fantasma</button></div>` : ''}${at || sec ? `<div class="lg-d2">${at}${at ? '' : sec}</div>` : ''}</div>`; }).join('');
      const miss = members.filter((m) => !played.has(m.user_id)).map((m) => esc(m.username));
      return `<div class="lg-day"><div class="lg-dh"><b>${esc(dayTxt(d.day))}</b>${live ? '<span class="live">HOY · PROVISIONAL</span>' : ''}</div>${rows}${miss.length ? `<p class="lg-miss">Sin tiempo: ${miss.join(', ')}</p>` : ''}</div>`;
    };
    body().innerHTML = `${head(L)}${seasonNav(L)}${days.length ? days.map(dayHtml).join('') : '<p class="lg-note">Aún no hay tiempos en esta temporada. Corre el reto diario y aparecerás aquí.</p>'}`;
  }

  // ---------- chat ----------
  const RX = ['🔥', '😂', '🐌', '👏', '😱'], tm = (m) => new Date(m.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const rxHtml = (m) => { const e = Object.entries(m.rx || {}); return `<div class="lg-rx">${e.map(([k, v]) => `<button type="button" class="${v.me ? 'me' : ''}" data-rx="${k}" data-id="${m.id}">${k} ${v.n}</button>`).join('')}<button type="button" class="add" data-more="${m.id}" aria-label="Reaccionar">☺</button></div>${S.rxOpen === m.id ? `<div class="lg-rxp">${RX.map((k) => `<button type="button" data-rx="${k}" data-id="${m.id}">${k}</button>`).join('')}</div>` : ''}`; };
  const msgHtml = (m) => m.kind === 'sys'
    ? `<div class="lg-m sys"><span>${esc(m.body).replace(/@(\S+)/g, '<b>@$1</b>')}</span><small>${tm(m)}</small>${rxHtml(m)}</div>`
    : `<div class="lg-m${m.user_id === me() ? ' me' : ''}"><b>${m.user_id === me() ? 'Tú' : '@' + esc(m.username)}</b><span>${esc(m.body)}</span><small>${tm(m)}</small>${rxHtml(m)}</div>`;
  async function pull(first) {
    if (!open() || S.view !== 'league' || S.tab !== 'chat') return stopPoll();
    try {
      const r = (await acc.rpc('league_chat', { p_league: S.id, p_after: 0 })) || [], sig = JSON.stringify(r) + '|' + S.rxOpen;
      if (!first && sig === S.chatSig) return; S.chatSig = sig;
      const box = $('lgFeed'); if (!box) return; const stick = first || box.scrollHeight - box.scrollTop - box.clientHeight < 70, top = box.scrollTop;
      box.innerHTML = r.length ? r.map(msgHtml).join('') : '<p class="lg-note">Rompe el hielo: escribe el primer mensaje.</p>';
      box.scrollTop = stick ? box.scrollHeight : top;
    } catch (e) { /* sin red: se reintenta */ }
  }
  async function chatView() {
    S.chatSig = ''; S.rxOpen = null; body().innerHTML = `${head(S.state.league)}<div id="lgFeed" class="lg-feed"></div><div class="lg-row"><input id="lgMsgIn" class="lg-in" maxlength="300" autocomplete="off" placeholder="Escribe a la liga…"><button class="lg-btn sm" data-a="send" type="button">Enviar</button></div>`;
    await pull(true); stopPoll(); S.poll = setInterval(() => pull(false), 4000);
  }
  async function send() {
    const el = $('lgMsgIn'); if (!el) return; const t = el.value.trim(); if (!t || S.busy) return; S.busy = true; el.value = '';
    try { await acc.rpc('league_post', { p_league: S.id, p_body: t }); await pull(true); } catch (e) { toast(err(e)); el.value = t; } finally { S.busy = false; }
  }
  async function react(id, emoji) { S.rxOpen = null; try { await acc.rpc('league_react', { p_msg: +id, p_emoji: emoji }); } catch (e) { toast(err(e)); } await pull(true); }

  // ---------- acciones ----------
  async function enter(id, season) { S.id = id; S.state = null; S.tab = 'tabla'; S.season = null; S.recap = undefined; if (season) { try { await load(season); } catch (_) { /* se carga la actual */ } } await leagueView(); }
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
    if (b.dataset.rx) return react(b.dataset.id, b.dataset.rx);
    if (b.dataset.more) { S.rxOpen = S.rxOpen === +b.dataset.more ? null : +b.dataset.more; return pull(true); }
    if (b.dataset.pick) { try { await acc.rpc('league_predict', { p_league: S.id, p_pick: b.dataset.pick }); toast('Apuesta guardada 🎯'); await load(); } catch (er) { toast(err(er)); } return leagueView(); }
    if (b.dataset.ghost) { try { const g = await acc.rpc('daily_ghost', { p_player: b.dataset.ghost }); if (!g || !g.ghost) { toast('Todavía no tiene fantasma guardado'); return; } close(); daily().runGhost(g); } catch (er) { toast(err(er)); } return; }
    if (b.dataset.s) { try { await load(+b.dataset.s); } catch (er) { toast(err(er)); } return leagueView(); }
    const a = b.dataset.a;
    if (a === 'back') { S.state = null; return listView(); }
    if (a === 'create') return create();
    if (a === 'join') return doJoin($('lgCode').value);
    if (a === 'send') return send();
    if (a === 'recap') return shareRecap();
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
  return { open: () => { show(); S.state = null; S.list = null; listView(); }, openLeague: async (id, season) => { show(); await enter(id, season); } };
}
