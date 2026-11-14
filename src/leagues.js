// Ligas de amigos: temporadas de 14 días sobre el reto diario, puntos como en la F1, intentos por día y chat.
// Toda la lógica vive en funciones RPC (supabase/leagues.sql) que identifican al jugador con auth.uid().
import { waShare, baseUrl, waBtn } from './share.js';
import { ic } from './icons.js';
import { sk, vt, undoable } from './ux.js';
import { isUi2, onUi } from './uimode.js';

const PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const leagueUrl = (code) => baseUrl() + '?liga=' + encodeURIComponent(code);

export function initLeagues(ctx) {
  const { $, acc, esc, fmt, flagSvg, helmetSvg, toast, dailyFor, daily } = ctx;
  const S = { view: 'list', id: null, tab: 'tabla', season: null, state: null, list: null, msg: '', chatSig: '', rx: null, recap: undefined, poll: null, busy: false, hidden: new Set(), pend: [], msgs: [], over: new Map() };
  const body = () => $('lgBody');
  // Escritura de la vista: transición suave al cambiar de pantalla/pestaña, directa en refrescos; conserva lo que se está escribiendo.
  const paint = { set innerHTML(h) {
    const el = body(), key = S.view + '|' + S.tab + '|' + S.id + '|' + S.season, nav = key !== S.paintKey; S.paintKey = key; $('leagues').dataset.v = S.view; $('leagues').dataset.t = S.tab;
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
    const card = (l) => `<button class="lg-card" data-open="${l.id}" type="button"><div class="lg-pos">${l.pos ? 'P' + l.pos : '–'}</div><div class="lg-info"><b>${esc(l.name)}</b><small>Temporada ${l.season}${l.days ? ` · día ${Math.min(l.day || 1, l.days)} de ${l.days}` : ''} · ${l.members} piloto${l.members === 1 ? '' : 's'}</small>${l.days ? `<u class="lgb"><s style="width:${Math.max(4, Math.min(100, Math.round((l.day || 1) / l.days * 100)))}%"></s></u>` : ''}</div><div class="lg-pts"><b>${l.pts}</b><small>PTS</small></div></button>`;
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
    const draw = () => (isUi2() ? (S.tab === 'cal' ? calView() : S.tab === 'dias' ? daysView() : v2View()) : S.tab === 'chat' ? chatView() : S.tab === 'cal' ? calView() : S.tab === 'dias' ? daysView() : tableView());
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
    paint.innerHTML = `${isUi2() ? v2Head(L) + v2Seg() : head(L)}${seasonNav(L)}<div class="lg-cal">${out.join('')}</div>`;
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
    paint.innerHTML = `${isUi2() ? v2Head(L) + v2Seg() : head(L)}${seasonNav(L)}${days.length ? days.map(dayHtml).join('') : '<p class="lg-note">Aún no hay tiempos en esta temporada. Corre el reto diario y aparecerás aquí.</p>'}`;
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
    if (isUi2()) { const sc = $('leagues'), near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90; box.innerHTML = all.length ? all.map(msg2).join('') : '<p class="l2-empty">Aún no hay mensajes. Rompe el hielo.</p>'; if (near && !first) sc.scrollTop = sc.scrollHeight; return; }
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

  // ---------- interfaz nueva: todo en una pantalla (cabecera de temporada, podio de hoy, chat o puntuación) ----------
  const COLS = ['#E10600', '#111111', '#F5A623', '#2F80ED', '#18A957', '#8B5CF6', '#EC4899', '#7A7F87', '#0EA5A4', '#A0522D'];
  const colorMap = () => { const m = {}; let k = 1; for (const s of S.state.standings) m[s.user_id] = s.user_id === me() ? COLS[0] : COLS[k++ % COLS.length]; for (const x of S.state.members) if (!m[x.user_id]) m[x.user_id] = x.user_id === me() ? COLS[0] : COLS[k++ % COLS.length]; return m; };
  const av = (m, col, cls = '') => `<span class="av ${cls}" style="--c:${col || '#111'}">${helmetSvg ? helmetSvg((m && m.helmet) || 'e63946|ffffff|111827|1') : ''}</span>`;
  const dd = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const leftTxt = (L) => { if (L.season < L.current) return 'Terminada'; const n = Math.round((Date.parse(L.to) - Date.parse(L.today)) / 864e5); return n <= 0 ? 'Último día' : `Quedan ${n} día${n === 1 ? '' : 's'}`; };
  // Identidad Daily Lapp: placas inclinadas como el logo, bordillos rojo y blanco, bandera a cuadros y torre de tiempos.
  const flagChk = `<svg class="chk" viewBox="0 0 30 22" aria-hidden="true"><path d="M3 2v19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? '' : `<rect x="${5 + c * 6}" y="${2 + r * 5}" width="6" height="5" fill="currentColor"/>`)).join('')).join('')}<rect x="5" y="2" width="24" height="15" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
  const plate = (txt, cls = '') => `<span class="l2-plate ${cls}"><b>${txt}</b></span>`;
  function v2Head(L) {
    const live = L.season === L.current, N = L.season_days, cur = live ? Math.min(N, Math.round((Date.parse(L.today) - Date.parse(L.from)) / 864e5) + 1) : N;
    const segs = Array.from({ length: N }, (_, i) => `<i class="${i + 1 < cur || !live ? 'd' : i + 1 === cur ? 'n' : ''}"></i>`).join('');
    return `<div class="l2-top"><button class="l2-ic" data-a="back" type="button" aria-label="Volver">${ic('back')}</button><span class="l2-sp"></span><button class="l2-ic${S.tab === 'cal' ? ' on' : ''}" data-t="cal" type="button" aria-label="Calendario">${ic('calendar')}</button><button class="l2-ic${S.tab === 'dias' ? ' on' : ''}" data-t="dias" type="button" aria-label="Tiempos por día">${ic('history')}</button><button class="l2-ic" data-a="invite" type="button" aria-label="Invitar">${ic('share')}</button></div>
      <div class="l2-title"><b class="l2-name">${esc(L.name)}</b><div class="l2-ss"><b>TEMPORADA ${L.season}</b><span class="l2-lap">${live ? `DÍA <b>${cur}</b>/${N}` : 'FINAL'}</span></div>
      <div class="l2-days" aria-label="Día ${cur} de ${N}">${segs}</div><small class="l2-left">${leftTxt(L)} · ${dd(L.from)} – ${dd(L.to)}</small></div>`;
  }
  const v2Seg = () => `<div class="l2-seg" role="tablist"><button type="button" role="tab" data-t="chat" class="${S.tab === 'chat' ? 'on' : ''}"><span>Chat</span></button><button type="button" role="tab" data-t="tabla" class="${S.tab === 'tabla' ? 'on' : ''}"><span>Puntuación</span></button></div>`;
  // podio de verdad (cajones 2-1-3) con los tiempos de hoy o, si la temporada acabó, los puntos finales
  function v2Podium(L, mm, col) {
    const live = L.season === L.current, mine = S.state.standings.find((s) => s.user_id === me()), myPos = S.state.standings.indexOf(mine) + 1;
    let top = [], who = [], label = 'Vuelta más rápida de hoy';
    if (live) {
      const d = S.state.days.find((x) => x.day === L.today), rows = d ? d.rows : [];
      top = rows.slice(0, 3).map((r, i) => ({ m: mm[r.user_id] || { username: '?' }, id: r.user_id, v: fmt(r.ms / 1000), gap: i ? '+' + ((r.ms - rows[0].ms) / 1000).toFixed(3) : '' }));
      who = rows.map((r) => r.user_id);
    } else {
      top = S.state.standings.filter((x) => x.days > 0).slice(0, 3).map((x) => ({ m: mm[x.user_id] || { username: '?' }, id: x.user_id, v: x.pts + ' pts', gap: '' }));
      label = 'Campeón de la temporada';
    }
    const stack = who.slice(0, 6).map((id) => av(mm[id], col[id], 'xs')).join('') + (who.length > 6 ? `<span class="av xs more">+${who.length - 6}</span>` : '');
    const status = `<div class="l2-hero"><div class="l2-hl"><small>${live ? 'Hoy han corrido' : 'Temporada cerrada'}</small>${stack ? `<div class="l2-stack">${stack}</div>` : `<b class="l2-none">${live ? 'Nadie todavía' : '—'}</b>`}</div><div class="l2-hr">${plate('P' + (myPos || '–'), 'big')}<span><b>${mine ? mine.pts : 0}</b><small>puntos</small></span></div></div>`;
    if (!top.length) return status + (live ? `<div class="l2-nobody"><p>Sé el primero en marcar tiempo hoy.</p><button class="l2-cta" data-a="daily" type="button">${ic('play')} Correr el reto</button></div>` : '');
    const ord = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
    const pods = ord.map((i) => { const x = top[i]; return `<div class="l2-pod p${i + 1}${x.id === me() ? ' me' : ''}">${av(x.m, col[x.id], i === 0 ? 'xl' : 'lg')}<b class="l2-pn">${esc(x.m.username)}</b><span class="l2-tp">${esc(x.v)}</span>${x.gap ? `<small class="l2-gap">${x.gap}</small>` : ''}<div class="l2-step"><b>${i + 1}</b></div></div>`; }).join('');
    const best = top[0];
    return `${status}<div class="l2-pods">${pods}</div><div class="l2-best">${flagChk}<span><small>${label}</small><b>${esc(best.m.username)}</b></span><em>${esc(best.v)}</em></div>`;
  }
  // chat: los avisos de tiempos parecen una torre de cronometraje; los mensajes, globos con esquina recta
  const msg2 = (m) => {
    const mm = S.memo || {}, col = S.cols || {}, u = mm[m.user_id] || { username: m.username };
    if (m.kind === 'sys') {
      const body = String(m.body || '').replace(/^[^\p{L}@]+/u, ''), t = (body.match(/\d+:\d{2}\.\d{2,3}/) || [])[0], lead = /l[ií]der/i.test(body), pos = (body.match(/\(P(\d+)\)/) || [])[1];
      const what = lead ? 'líder del día' : pos ? 'marca P' + pos : 'ha corrido';
      return `<div class="l2-m sys${lead ? ' gold' : ''}"><div class="l2-tw" style="--c:${col[m.user_id] || '#111'}"><i></i>${lead ? `<span class="l2-twb">${ic('crown')}</span>` : ''}<b>${esc(u.username)}</b><small>${what}</small><em>${esc(t || '')}</em><time>${tm(m)}</time></div>${rxHtml(m)}</div>`;
    }
    const mine = m.user_id === me();
    return `<div class="l2-m${mine ? ' me' : ''}${m.pending ? ' pend' : ''}">${mine ? '' : av(u, col[m.user_id], 'sm')}<div class="l2-b">${mine ? '' : `<b class="l2-who" style="color:${col[m.user_id]}">${esc(u.username)}</b>`}<span><span>${esc(m.body)}</span><small>${tm(m)}</small></span></div>${rxHtml(m)}</div>`;
  };
  // gráfica sobre asfalto: líneas por piloto, la tuya en rojo; al final de cada línea, su posición
  function v2Chart(L, col) {
    const st = S.state, dayIdx = (d) => Math.round((Date.parse(d) - Date.parse(L.from)) / 864e5) + 1;
    const upto = L.season < L.current ? L.season_days : Math.min(L.season_days, dayIdx(L.today)), N = Math.min(L.season_days, Math.max(upto, 5));
    const per = {}; for (const s of st.standings) per[s.user_id] = new Array(upto + 1).fill(0);
    for (const d of st.days) { const i = dayIdx(d.day); if (i < 1 || i > upto) continue; d.rows.forEach((r, k) => { if (per[r.user_id]) per[r.user_id][i] += PTS[k] || 0; }); }
    for (const id in per) { const a = per[id]; for (let i = 1; i <= upto; i++) a[i] += a[i - 1]; const s = st.standings.find((x) => x.user_id === id); if (s && s.pts > a[upto]) a[upto] = s.pts; }
    const max = Math.max(25, ...Object.values(per).map((a) => a[upto])), top = Math.ceil(max / 50) * 50 || 50;
    const W = 330, H = 180, x0 = 10, x1 = 300, y0 = 160, y1 = 14, X = (i) => x0 + (x1 - x0) * i / N, Y = (v) => y0 - (y0 - y1) * v / top;
    const grid = [0, top / 2, top].map((v) => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${x0}" y="${Y(v) - 4}">${v}</text>`).join('');
    const fin = `<g class="fin">${Array.from({ length: 12 }, (_, r) => `<rect x="${x1 + 4 + (r % 2) * 5}" y="${y1 + r * ((y0 - y1) / 12)}" width="5" height="${(y0 - y1) / 12}"/>`).join('')}</g>`;
    const order = st.standings.map((s) => s.user_id), ids = Object.keys(per).sort((a, b) => (a === me()) - (b === me()));
    const lines = ids.map((id) => { const a = per[id], pts = a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`), ex = X(upto), ey = Y(a[upto]); return `<g style="--c:${col[id]}"${id === me() ? ' class="me"' : ''}><polyline points="${pts.join(' ')}"/><rect class="tag" x="${ex - 9}" y="${ey - 8}" width="18" height="16" rx="3" transform="skewX(-12) translate(${(ey * Math.tan(12 * Math.PI / 180)).toFixed(1)} 0)"/><text class="tg" x="${ex}" y="${ey + 4}">${order.indexOf(id) + 1}</text></g>`; }).join('');
    return `<div class="l2-chart"><div class="l2-ch"><b>Puntos por día</b><small>${L.season < L.current ? 'Temporada completa' : 'Hasta hoy · día ' + upto}</small></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Puntos acumulados por día">${grid}${fin}${lines}</svg></div>`;
  }
  function v2Points(L, mm, col) {
    const { standings } = S.state, yl = S.state.lentorro, lead = standings[0] ? standings[0].pts : 0;
    const cards = standings.map((s, i) => { const m = mm[s.user_id] || { username: '?' }, mine = s.user_id === me();
      return `<div class="l2-card${mine ? ' me' : ''}${i < 3 ? ' p' + (i + 1) : ''}" style="--c:${col[s.user_id]}"><span class="l2-pos"><b>${i + 1}</b></span>${av(m, col[s.user_id], 'md')}<div class="l2-ci"><b>${esc(m.username)}${mine ? '<em class="l2-you">TÚ</em>' : ''}${s.user_id === yl ? `<span class="l2-snail" title="Lentorro">${ic('snail')}</span>` : ''}${m.streak > 1 ? `<span class="l2-fire">${ic('flame')}${m.streak}</span>` : ''}</b><small>${s.wins} día${s.wins === 1 ? '' : 's'} ganado${s.wins === 1 ? '' : 's'}${s.best ? ' · ' + fmt(s.best / 1000) : ''}</small></div><div class="l2-pt"><b>${s.pts}</b><small>${i ? '−' + (lead - s.pts) : 'PTS'}</small></div></div>`; }).join('');
    return `${L.current > 1 ? seasonNav(L) : ''}${v2Chart(L, col)}<div class="l2-cards">${cards}</div>
      ${yl && mm[yl] && L.season === L.current ? `<p class="l2-len">${ic('snail')} Lentorro: ${esc(mm[yl].username)} · hoy puede elegir coche</p>` : ''}
      <div class="l2-inv"><div><small>Código de la liga</small><b>${esc(L.code)}</b></div><button class="l2-pill" data-a="copy" type="button">Copiar enlace</button></div>
      <details class="l2-info"><summary>${ic('info')} Reglas</summary><p>Cada día se reparten 25-18-15-12-10-8-6-4-2-1 puntos según el mejor tiempo del reto. Acertar quién gana el día suma +1. El Lentorro es quien menos puntos lleva y hoy puede elegir coche. La temporada dura ${L.season_days} días.</p><button class="l2-pill danger" data-a="leave" type="button">Salir de la liga</button></details>`;
  }
  async function v2View() {
    const L = S.state.league, mm = Object.fromEntries(S.state.members.map((m) => [m.user_id, m])), col = colorMap(); S.memo = mm; S.cols = col;
    const pred = predHtml(L, mm), top = `${v2Head(L)}${v2Podium(L, mm, col)}${v2Seg()}`;
    if (S.tab !== 'chat') { stopPoll(); paint.innerHTML = `${top}${v2Points(L, mm, col)}<div class="lg-msg" id="lgMsg">${esc(S.msg)}</div>`; S.msg = ''; return; }
    S.chatSig = ''; S.rxOpen = null; S.msgs = S.msgs && S.msgsFor === S.id ? S.msgs : []; S.msgsFor = S.id; S.pend = S.pend || [];
    paint.innerHTML = `${top}${pred}<div id="lgFeed" class="l2-feed"></div><div class="l2-in"><input id="lgMsgIn" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="Tu chat" aria-label="Mensaje para la liga"><button data-a="send" type="button" aria-label="Enviar">${ic('send')}</button></div>`;
    await S.p; if (S.msgs.length) paintFeed(true); else $('lgFeed').innerHTML = sk.rows(4);
    await pull(true); stopPoll(); S.poll = setInterval(() => pull(false), 4000);
  }
  onUi(() => { if (!open()) return; if (S.view === 'league' && S.state) leagueView(); else listView(); });

  // ---------- acciones ----------
  async function enter(id, season) { S.id = id; S.state = null; S.tab = isUi2() ? 'chat' : 'tabla'; S.season = null; S.recap = undefined; if (season) { try { await load(season); } catch (_) { /* se carga la actual */ } } await leagueView(); }
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
    if (b.dataset.open) { S.fromList = true; return enter(b.dataset.open); }
    if (b.dataset.t) { S.tab = b.dataset.t; return leagueView(); }
    if (b.dataset.rx) return react(b.dataset.id, b.dataset.rx);
    if (b.dataset.more) { S.rxOpen = S.rxOpen === +b.dataset.more ? null : +b.dataset.more; return pull(true); }
    if (b.dataset.pick) { const old = S.state.pred; S.state.pred = { ...(old || {}), pick: b.dataset.pick, can: false }; leagueView(); try { await acc.rpc('league_predict', { p_league: S.id, p_pick: b.dataset.pick }); toast('Apuesta guardada'); load().catch(() => {}); } catch (er) { S.state.pred = old; toast(err(er)); } return leagueView(); }
    if (b.dataset.ghost) { try { const g = await acc.rpc('daily_ghost', { p_player: b.dataset.ghost }); if (!g || !g.ghost) { toast('Todavía no tiene fantasma guardado'); return; } close(); daily().runGhost(g); } catch (er) { toast(err(er)); } return; }
    if (b.dataset.s) { try { await load(+b.dataset.s); } catch (er) { toast(err(er)); } return leagueView(); }
    const a = b.dataset.a;
    if (a === 'back') { S.state = null; if (isUi2() && !S.fromList) return close(); return listView(); }
    if (a === 'create') return create();
    if (a === 'join') return doJoin($('lgCode').value);
    if (a === 'send') return send();
    if (a === 'daily') { close(); const dc = $('dailyCard'); if (dc) dc.click(); return; }
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
  return { open: () => { show(); S.state = null; S.list = null; listView(); }, openLeague: async (id, season) => { show(); S.fromList = false; await enter(id, season); } };
}
