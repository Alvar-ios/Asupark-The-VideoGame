// Ligas de amigos: temporadas de 14 días sobre el reto diario, puntos como en la F1, intentos por día y chat.
// Toda la lógica vive en funciones RPC (supabase/leagues.sql) que identifican al jugador con auth.uid().
import { waShare, baseUrl, waBtn } from './share.js';
import { ic } from './icons.js';
import { sk, vt, undoable } from './ux.js';

const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const leagueUrl = (code) => baseUrl() + '?liga=' + encodeURIComponent(code);

export function initLeagues(ctx) {
  const { $, acc, esc, fmt, flagSvg, toast, dailyFor, daily } = ctx;
  const S = { view: 'list', id: null, tab: 'tabla', season: null, state: null, list: null, msg: '', chatSig: '', rx: null, recap: undefined, poll: null, busy: false, hidden: new Set(), pend: [], msgs: [], over: new Map() };
  const body = () => $('lgBody');
  // Escritura de la vista: transición suave al cambiar de pantalla/pestaña, directa en refrescos; conserva lo que se está escribiendo.
  const paint = { set innerHTML(h) {
    const el = body(), key = S.view + '|' + S.tab + '|' + S.id + '|' + S.season, nav = key !== S.paintKey; S.paintKey = key;
    const keep = ['lgName', 'lgCode', 'lgMsgIn'].map((id) => [id, $(id) && $(id).value]);
    const put = () => { el.innerHTML = h; for (const [id, v] of keep) if (v && $(id)) $(id).value = v; };
    if (nav && el.firstElementChild) S.p = vt(put); else { S.p = null; put(); }
  } };
  const open = () => !$('leagues').classList.contains('hidden');
  const me = () => (acc.profile && acc.profile.user_id) || (acc.session && acc.session.user && acc.session.user.id);
  const dayTxt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  const flag = (f) => `<span class="flag sm">${flagSvg(f || 'es')}</span>`;
  const err = (e) => acc.explain(e);
  const stopPoll = () => { clearInterval(S.poll); S.poll = null; };

  const needLogin = () => { paint.innerHTML = `<p class="lg-note">Entra en tu perfil para crear una liga o unirte a la de tus amigos. Solo hace falta un usuario y una contraseña.</p><button class="lg-btn" data-a="profile" type="button">Abrir perfil</button>`; };

  // ---------- listado de mis ligas ----------
  const listHtml = () => {
    const card = (l) => `<button class="lg-card" data-open="${l.id}" type="button"><div class="lg-pos">${l.pos ? 'P' + l.pos : '–'}</div><div class="lg-info"><b>${esc(l.name)}</b><small>Temporada ${l.season} · ${l.members} piloto${l.members === 1 ? '' : 's'}</small></div><div class="lg-pts"><b>${l.pts}</b><small>PTS</small></div></button>`;
    const L = S.list.filter((l) => !S.hidden.has(l.id));
    return `${L.length ? L.map(card).join('') : '<p class="lg-note">Todavía no estás en ninguna liga. Crea una e invita a tus amigos: cada día puntúa el reto diario como un Gran Premio de F1.</p>'}
      <h3 class="lg-h">Crear una liga</h3><div class="lg-row"><input id="lgName" class="lg-in" maxlength="30" placeholder="Nombre (ej. Los del Grupo)"><button class="lg-btn sm" data-a="create" type="button">Crear</button></div>
      <h3 class="lg-h">Unirme con un código</h3><div class="lg-row"><input id="lgCode" class="lg-in" maxlength="6" autocapitalize="characters" spellcheck="false" placeholder="Código de 6 letras"><button class="lg-btn sm ghost" data-a="join" type="button">Unirme</button></div>
      <div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`;
  };
  async function listView() {
    stopPoll(); S.view = 'list';
    if (!acc.loggedIn) return needLogin();
    const c = acc.cached('my_leagues'); if (!S.list && Array.isArray(c)) S.list = c;
    if (S.list) { paint.innerHTML = listHtml(); S.msg = ''; } else paint.innerHTML = sk.cards(2);
    try { await acc.swr('my_leagues', {}, (d, cached) => { if (cached) return; S.list = d || []; if (S.view === 'list' && open()) paint.innerHTML = listHtml(); }); if (!S.list) { S.list = []; paint.innerHTML = listHtml(); } }
    catch (e) { S.list = S.list || []; S.msg = err(e); if (S.view === 'list') paint.innerHTML = listHtml(); }
    S.msg = '';
  }

  // ---------- liga ----------
  async function load(season) {
    const st = await acc.swr('league_state', { p_league: S.id, p_season: season || null }, () => {});
    S.state = st; S.season = st.league.season; return st;
  }
  const head = (L) => `<div class="lg-head"><button class="lg-back" data-a="back" type="button">‹</button><div><b>${esc(L.name)}</b><small>Temporada ${L.season} · ${dayTxt(L.from)} – ${dayTxt(L.to)}</small></div></div>
    <div class="lg-inv"><div><small>CÓDIGO DE INVITACIÓN</small><b>${esc(L.code)}</b></div>${waBtn('Invitar', 'data-a="invite"', 'lg-btn sm wa')}<button class="lg-btn sm ghost" data-a="copy" type="button">Copiar enlace</button></div>
    <div class="lg-tabs">${[['tabla', 'Tabla'], ['dias', 'Días'], ['cal', 'Calendario'], ['chat', 'Chat']].map(([k, n]) => `<button type="button" data-t="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  async function leagueView() {
    S.view = 'league'; stopPoll();
    if (!S.state || S.state.league.id !== S.id) {
      const c = acc.cached('league_state', { p_league: S.id, p_season: S.season || null });
      if (c && c.league && c.league.id === S.id) { S.state = c; S.season = c.league.season; S.fromCache = true; }
      else { paint.innerHTML = sk.league(); try { await load(); } catch (e) { S.msg = err(e); return listView(); } }
    }
    const draw = () => (S.tab === 'chat' ? chatView() : S.tab === 'cal' ? calView() : S.tab === 'dias' ? daysView() : tableView());
    const first = draw();
    if (S.fromCache) {   // se enseña lo guardado y se refresca en segundo plano
      S.fromCache = false; const id = S.id;
      acc.swr('league_state', { p_league: id, p_season: S.season || null }, () => {}).then((st) => { if (S.id !== id || S.view !== 'league' || !open() || !st || !st.league) return; const same = JSON.stringify(st) === JSON.stringify(S.state); S.state = st; S.season = st.league.season; if (!same && S.tab !== 'chat') draw(); }).catch(() => {});
    }
    return first;
  }
  const seasonNav = (L) => `<div class="lg-sn"><button type="button" data-s="${L.season - 1}" ${L.season <= 1 ? 'disabled' : ''}>‹</button><span>Temporada ${L.season}${L.season === L.current ? ' · en curso' : ''}</span><button type="button" data-s="${L.season + 1}" ${L.season >= L.current ? 'disabled' : ''}>›</button></div>`;
  const fms = (ms) => fmt(ms / 1000);

  // ---------- resumen de ayer ----------
  async function recapHtml(L) {
    if (L.season !== L.current) return '';
    if (S.recapFor !== L.id) { S.recapFor = L.id; const c = acc.cached('league_recap', { p_league: L.id }); S.recap = c === undefined ? undefined : c; }
    if (S.recap === undefined || S.recapAt !== L.id) {   // se pinta con lo guardado y se actualiza sin bloquear la tabla
      S.recapAt = L.id; const id = L.id;
      acc.swr('league_recap', { p_league: id }, () => {}).then((r) => { const same = JSON.stringify(r) === JSON.stringify(S.recap); S.recap = r; if (!same && S.id === id && S.tab === 'tabla' && S.view === 'league' && open() && S.state) tableView(); }).catch(() => { if (S.recap === undefined) S.recap = null; });
    }
    const r = S.recap; if (!r) return '';
    const line = (k, t) => `<li><i>${ic(k)}</i><span>${t}</span></li>`;
    return `<div class="lg-recap"><div class="lg-rh"><b>${ic('sun')} RESUMEN DE AYER</b><small>${esc(dayTxt(r.day))} · ${r.players} piloto${r.players === 1 ? '' : 's'}</small></div><ul>
      ${line('trophy', `<b>@${esc(r.winner.username)}</b> ganó con ${fms(r.winner.ms)}${r.second ? ` · <em>+${(r.second.gap / 1000).toFixed(3)}</em> sobre @${esc(r.second.username)}` : ''}`)}
      ${r.me ? line('target', `Tú: <b>P${r.me.pos}</b> (${fms(r.me.ms)}) · +${r.me.pts} pts`) : line('none', 'Ayer no corriste el reto')}
      ${r.climber ? line('trend', `<b>@${esc(r.climber.username)}</b> sube de P${r.climber.from} a P${r.climber.to}`) : ''}
      ${r.leader ? line('crown', `Líder: <b>@${esc(r.leader.username)}</b> (${r.leader.pts} pts)`) : ''}
    </ul><button class="lg-btn sm ghost" data-a="recap" type="button">Compartir resumen</button></div>`;
  }
  async function shareRecap() {
    const L = S.state.league, r = S.recap; if (!r) return;
    const mm = Object.fromEntries(S.state.members.map((m) => [m.user_id, m]));
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0a12'); g.addColorStop(0.5, '#0a0d16'); g.addColorStop(1, '#0a0d16'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#e10600'; c.fillRect(0, 0, W, 18); const k = 54; for (let i = 0; i < W / k; i++) { c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(i * k, H - 36, k, 18); c.fillStyle = i % 2 ? '#111' : '#fff'; c.fillRect(i * k, H - 18, k, 18); }
    const T = (t, x, y, sz, col, w = 800, al = 'left') => { c.font = `italic ${w} ${sz}px "Jersey 10", Impact, sans-serif`; c.fillStyle = col; c.textAlign = al; c.fillText(t, x, y); };
    T('DAILY LAPP · RESUMEN', 70, 120, 44, '#ffd34e'); T(L.name.toUpperCase(), 70, 210, 84, '#fff'); T(dayTxt(r.day).toUpperCase(), 70, 270, 40, '#9fb0cf');
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(70, 330, W - 140, 330); T('GANADOR DEL DÍA', 110, 400, 40, '#ffd34e'); T('@' + r.winner.username, 110, 500, 100, '#fff'); T(fms(r.winner.ms) + (r.second ? `   +${(r.second.gap / 1000).toFixed(3)} sobre @${r.second.username}` : ''), 110, 600, 46, '#c8d2e6', 700);
    const rows = []; if (r.climber) rows.push(['SUBE', `@${r.climber.username} sube de P${r.climber.from} a P${r.climber.to}`]); if (r.leader) rows.push(['LÍDER', `Líder: @${r.leader.username} · ${r.leader.pts} pts`]); if (r.lentorro && mm[r.lentorro]) rows.push(['LENTORRO', `Lentorro de hoy: @${mm[r.lentorro].username}`]); if (r.me) rows.push(['YO', `Yo: P${r.me.pos} · ${fms(r.me.ms)}`]);
    rows.forEach((x, i) => { T(x[0], 70, 790 + i * 120, 34, '#ffd34e'); T(x[1], 290, 790 + i * 120, 50, '#eef2ff', 700); });
    T('¿Te atreves con el reto de hoy?', 70, H - 120, 46, '#ffd34e'); T(location.host + location.pathname.replace(/\/$/, ''), 70, H - 70, 36, '#9fb0cf', 700);
    const text = `Resumen de «${L.name}» (${dayTxt(r.day)}): ganó @${r.winner.username} con ${fms(r.winner.ms)}${r.leader ? ` · líder @${r.leader.username} (${r.leader.pts} pts)` : ''}. ¿Te atreves con el reto de hoy?`;
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
    if (pk) return `<div class="lg-pred">${ic('target')} <b>Tu apuesta de hoy:</b> @${esc((mm[pk] || {}).username || '?')} · +1 punto si gana el reto</div>`;
    if (!P.can) return '';
    return `<div class="lg-pred"><b>${ic('target')} ¿Quién gana hoy?</b><small>Apuesta antes de correr: +1 punto si aciertas</small><div class="lg-chips">${S.state.members.map((m) => `<button type="button" data-pick="${m.user_id}">${flag(m.flag)} ${esc(m.username)}${m.user_id === me() ? ' (yo)' : ''}</button>`).join('')}</div></div>`;
  }

  // ---------- podio de temporada cerrada ----------
  function podiumHtml(L, mm, standings) {
    if (L.season >= L.current) return '';
    const pl = standings.filter((x) => x.days > 0); if (pl.length < 2) return '';
    const top = pl.slice(0, 3), order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0], hs = [100, 70, 50], cs = ['#ffd34e', '#d5dbe6', '#e0955a'];
    const last = pl.length >= 3 ? pl[pl.length - 1] : null;
    return `<div class="lg-podium"><b class="lg-pt">${ic('trophy')} TEMPORADA ${L.season} TERMINADA</b><div class="lg-pods">${order.map((i) => { const x = top[i], m = mm[x.user_id] || { username: '?' }; return `<div class="pod p${i + 1}"><span>${i === 0 ? ic('crown') : ''}${esc(m.username)}</span><div class="bar" style="--h:${hs[i]}px;background:${cs[i]}"><b>${i + 1}</b><small>${x.pts} pts</small></div></div>`; }).join('')}</div>${last ? `<p class="lg-note sm" style="text-align:center">${ic('snail')} Lentorro de la temporada: <b>@${esc((mm[last.user_id] || {}).username || '?')}</b></p>` : ''}</div>`;
  }

  async function tableView() {
    const { league: L, members, standings } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const rows = standings.map((s, i) => { const m = mm[s.user_id] || { username: '?' }; return `<tr class="${s.user_id === me() ? 'me' : ''}${i < 3 ? ' p' + (i + 1) : ''}"><td class="po">${i + 1}</td><td class="nm">${flag(m.flag)}<span>${esc(m.username)}${s.user_id === S.state.lentorro ? ' ' + ic('snail') : ''}</span>${m.streak > 1 ? `<small class="fire">${ic('flame')}${m.streak}</small>` : ''}</td><td>${s.wins}</td><td>${s.podiums}</td><td>${s.best ? fmt(s.best / 1000) : '–'}</td><td class="pt">${s.pts}${s.bonus ? `<small class="bn">${ic('target')}${s.bonus}</small>` : ''}</td></tr>`; }).join('');
    const yl = S.state.lentorro;
    const ban = yl && mm[yl] && L.season === L.current ? `<div class="lg-len">${ic('snail')} <b>Lentorro de hoy:</b> @${esc(mm[yl].username)}${yl === me() ? ' (¡eres tú! Hoy puedes elegir coche en el reto)' : ' · hoy puede elegir coche en el reto'}</div>` : '';
    const rec = await recapHtml(L); if (S.tab !== 'tabla' || S.view !== 'league') return;
    paint.innerHTML = `${head(L)}${rec}${seasonNav(L)}${podiumHtml(L, mm, standings)}${ban}${predHtml(L, mm)}<table class="lg-t"><thead><tr><th>POS</th><th>PILOTO</th><th>VIC</th><th>POD</th><th>MEJOR</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="lg-note sm">Cada día se reparten 25-18-15-12-10-8-6-4-2-1 puntos según el mejor tiempo del reto entre los miembros. Acertar quién gana el día suma +1 punto. El Lentorro es quien menos puntos lleva (si ayer corrió) y hoy puede elegir coche. La temporada dura ${L.season_days} días.</p>
      <button class="lg-btn ghost danger" data-a="leave" type="button">Salir de la liga</button><div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`;
    S.msg = '';
  }

  // ---------- calendario de la temporada (cada día es un GP) ----------
  function calView() {
    const { league: L, days, members } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m])), byDay = Object.fromEntries(days.map((d) => [d.day, d]));
    const out = [];
    for (let i = 0; i < L.season_days; i++) {
      const day = new Date(Date.parse(L.from + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10), fut = day > L.today, isToday = day === L.today, info = !fut && dailyFor ? dailyFor(day) : null, d = byDay[day], w = d && d.rows[0];
      out.push(`<div class="lg-gp${isToday ? ' now' : ''}${fut ? ' fut' : ''}"><div class="gpn"><small>GP</small><b>${i + 1}</b></div><div class="gpi">${fut ? '<b>? ? ?</b><small>Se revela ese día</small>' : `<b>${info ? `<span class="flag sm">${flagSvg(info.flag)}</span> ${esc(info.name)}` : 'Reto del día'}</b><small>${esc(dayTxt(day))}${info ? ' · ' + esc(info.car) : ''}</small>`}</div><div class="gpw">${isToday ? '<span class="live">HOY</span>' : ''}${w ? `<small>${ic('trophy')}</small><b>${esc((mm[w.user_id] || {}).username || '?')}</b>` : fut ? '' : '<small>sin tiempos</small>'}</div></div>`);
    }
    paint.innerHTML = `${head(L)}${seasonNav(L)}<div class="lg-cal">${out.join('')}</div>`;
  }
  function daysView() {
    const { league: L, members, days } = S.state, mm = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const dayHtml = (d) => {
      const lead = d.rows[0].ms, live = d.day === L.today, played = new Set(d.rows.map((r) => r.user_id));
      const rows = d.rows.map((r, i) => { const m = mm[r.user_id] || { username: '?' }, pts = PTS[i] || 0;
        const at = (r.attempts && r.attempts.length) ? r.attempts.map((a, k) => `<i${a === r.ms ? ' class="b"' : ''}>${k + 1}º ${fmt(a / 1000)}</i>`).join('') : '';
        const sec = r.s1 ? `<small class="sec">${[r.s1, r.s2, r.s3].map((x) => fmt(x / 1000)).join(' · ')}</small>` : '';
        return `<div class="lg-dr${r.user_id === me() ? ' me' : ''}"><div class="lg-d1"><i class="po">${i + 1}</i>${flag(m.flag)}<b>${esc(m.username)}</b><em>${fmt(r.ms / 1000)}</em><small class="gp">${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : 'LÍDER'}</small><span class="pp">+${pts}</span></div>${d.day === L.today && r.user_id !== me() && m.ghost ? `<div class="lg-d2"><button type="button" class="lg-gh" data-ghost="${r.user_id}">${ic('ghost')} Correr contra su fantasma</button></div>` : ''}${at || sec ? `<div class="lg-d2">${at}${at ? '' : sec}</div>` : ''}</div>`; }).join('');
      const miss = members.filter((m) => !played.has(m.user_id)).map((m) => esc(m.username));
      return `<div class="lg-day"><div class="lg-dh"><b>${esc(dayTxt(d.day))}</b>${live ? '<span class="live">HOY · PROVISIONAL</span>' : ''}</div>${rows}${miss.length ? `<p class="lg-miss">Sin tiempo: ${miss.join(', ')}</p>` : ''}</div>`;
    };
    paint.innerHTML = `${head(L)}${seasonNav(L)}${days.length ? days.map(dayHtml).join('') : '<p class="lg-note">Aún no hay tiempos en esta temporada. Corre el reto diario y aparecerás aquí.</p>'}`;
  }

  // ---------- chat ----------
  const RX = ['🔥', '😂', '🐌', '👏', '😱'], tm = (m) => new Date(m.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const rxHtml = (m) => { const e = Object.entries(m.rx || {}); return `<div class="lg-rx">${e.map(([k, v]) => `<button type="button" class="${v.me ? 'me' : ''}" data-rx="${k}" data-id="${m.id}">${k} ${v.n}</button>`).join('')}<button type="button" class="add" data-more="${m.id}" aria-label="Reaccionar">+</button></div>${S.rxOpen === m.id ? `<div class="lg-rxp">${RX.map((k) => `<button type="button" data-rx="${k}" data-id="${m.id}">${k}</button>`).join('')}</div>` : ''}`; };
  const msgHtml = (m) => m.kind === 'sys'
    ? `<div class="lg-m sys"><span>${esc(m.body.replace(/^[^\p{L}@]+/u, '')).replace(/@(\S+)/g, '<b>@$1</b>')}</span><small>${tm(m)}</small>${rxHtml(m)}</div>`
    : `<div class="lg-m${m.user_id === me() ? ' me' : ''}"><b>${m.user_id === me() ? 'Tú' : '@' + esc(m.username)}</b><span>${esc(m.body)}</span><small>${tm(m)}</small>${rxHtml(m)}</div>`;
  const feedHtml = (r) => (r.length ? r.map(msgHtml).join('') : '<p class="lg-note">Rompe el hielo: escribe el primer mensaje.</p>');
  function paintFeed(first) {
    const box = $('lgFeed'); if (!box) return; const all = (S.msgs || []).concat(S.pend || []);
    const stick = first || box.scrollHeight - box.scrollTop - box.clientHeight < 70, top = box.scrollTop;
    box.innerHTML = feedHtml(all); box.scrollTop = stick ? box.scrollHeight : top;
  }
  // reacciones aún sin confirmar por el servidor: se mantienen encima de lo que llegue de una consulta anterior
  const withOver = (r) => { if (!S.over.size) return r; r = JSON.parse(JSON.stringify(r)); for (const [k, on] of S.over) { const [id, e] = k.split('|'), m = r.find((x) => String(x.id) === id); if (!m) continue; m.rx = m.rx || {}; const c = m.rx[e], has = !!(c && c.me); if (on && !has) m.rx[e] = { n: (c ? c.n : 0) + 1, me: true }; else if (!on && has) { c.n -= 1; c.me = false; if (c.n <= 0) delete m.rx[e]; } } return r; };
  async function pull(first) {
    if (!open() || S.view !== 'league' || S.tab !== 'chat') return stopPoll();
    try {
      const r = (await acc.rpc('league_chat', { p_league: S.id, p_after: 0 })) || [], sig = JSON.stringify(r) + '|' + S.rxOpen + '|' + (S.pend || []).length;
      if (!first && sig === S.chatSig) return; S.chatSig = sig; S.msgs = withOver(r); paintFeed(first);
    } catch (e) { /* sin red: se reintenta */ }
  }
  async function chatView() {
    S.chatSig = ''; S.rxOpen = null; S.msgs = S.msgs && S.msgsFor === S.id ? S.msgs : []; S.msgsFor = S.id; S.pend = S.pend || [];
    paint.innerHTML = `${head(S.state.league)}<div id="lgFeed" class="lg-feed"></div><div class="lg-row"><input id="lgMsgIn" class="lg-in" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="Escribe a la liga…"><button class="lg-btn sm" data-a="send" type="button">Enviar</button></div>`;
    await S.p; if (S.msgs.length) paintFeed(true); else $('lgFeed').innerHTML = sk.rows(5);
    await pull(true); stopPoll(); S.poll = setInterval(() => pull(false), 4000);
  }
  // Enviar: el mensaje aparece al instante (atenuado) y lleva un identificador, así un reintento o doble toque no lo duplica.
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  async function send() {
    const el = $('lgMsgIn'); if (!el) return; const t = el.value.trim(); if (!t) return; el.value = '';
    const cid = uid(), tmp = { id: 'p' + cid, user_id: me(), username: acc.username || '', body: t, at: new Date().toISOString(), kind: 'msg', rx: {}, pending: true };
    (S.pend = S.pend || []).push(tmp); paintFeed(true); el.focus();
    try { await acc.rpc('league_post', { p_league: S.id, p_body: t, p_cid: cid }); S.pend = S.pend.filter((m) => m !== tmp); await pull(true); }
    catch (e) { S.pend = S.pend.filter((m) => m !== tmp); paintFeed(true); toast(err(e)); const el2 = $('lgMsgIn'); if (el2 && !el2.value) el2.value = t; }
  }
  // Reaccionar: se refleja ya; si el servidor falla se deshace. Se envía el estado deseado (no «alternar»), así repetirlo no lo invierte.
  async function react(id, emoji) {
    S.rxOpen = null; const m = (S.msgs || []).find((x) => String(x.id) === String(id)); if (!m) return;
    const prev = JSON.stringify(m.rx || {}); m.rx = JSON.parse(prev); const cur = m.rx[emoji], on = !(cur && cur.me);
    if (on) m.rx[emoji] = { n: (cur ? cur.n : 0) + 1, me: true }; else { cur.n -= 1; cur.me = false; if (cur.n <= 0) delete m.rx[emoji]; }
    const ok = id + '|' + emoji; S.over.set(ok, on); paintFeed(false);
    try { await acc.rpc('league_react', { p_msg: +id, p_emoji: emoji, p_on: on }); S.over.delete(ok); pull(true); }
    catch (e) { S.over.delete(ok); m.rx = JSON.parse(prev); paintFeed(false); toast(err(e)); }
  }

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
    if (b.dataset.pick) { const old = S.state.pred; S.state.pred = { ...(old || {}), pick: b.dataset.pick, can: false }; leagueView(); try { await acc.rpc('league_predict', { p_league: S.id, p_pick: b.dataset.pick }); toast('Apuesta guardada'); load().catch(() => {}); } catch (er) { S.state.pred = old; toast(err(er)); } return leagueView(); }
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
    if (a === 'invite') { const L = S.state.league; return waShare(`Te invito a mi liga «${L.name}» de Daily Lapp: cada día se puntúa el reto diario como un GP de F1 y hay chat para picarnos. Entra con este enlace y te unes al instante (código ${L.code}):`, leagueUrl(L.code)); }
    if (a === 'leave') { const id = S.id, nm = S.state.league.name; S.hidden.add(id); S.state = null; undoable('Has salido de «' + nm + '»', async () => { try { await acc.rpc('league_leave', { p_league: id }); S.hidden.delete(id); S.list = null; try { Object.keys(localStorage).filter((k) => k.startsWith('dr.c.')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* nada */ } } catch (er) { S.hidden.delete(id); toast(err(er)); S.list = null; } if (open() && S.view === 'list') listView(); }, { ms: 6000, onUndo: () => { S.hidden.delete(id); if (open()) listView(); } }); return listView(); }
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
      paint.innerHTML = `<p class="lg-note">${name ? `Te han invitado a la liga <b>${esc(name)}</b>.` : 'Te han invitado a una liga.'} Entra o crea tu cuenta (solo usuario y contraseña) y te unirás automáticamente.</p><button class="lg-btn" data-a="profile" type="button">Entrar / crear cuenta</button>`;
    }, 1800);
    acc.onChange(tryJoin);
  }
  return { open: () => { show(); S.state = null; S.list = null; listView(); }, openLeague: async (id, season) => { show(); await enter(id, season); } };
}
