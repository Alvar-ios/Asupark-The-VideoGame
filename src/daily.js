// Reto del día: día de 4:00 a 4:00 (Madrid), circuito y coche aleatorios, práctica 5 vueltas + clasificación 3 vueltas.
// Los intentos se controlan en el servidor (supabase/daily.sql) y se cachean en local. Sin servidor, solo local.
import { hashStr } from './rng.js';

const KEY = 'dr.daily';
const mad = (ts) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(ts).map((x) => [x.type, +x.value]));
export const dailyKeyNow = (ts = Date.now()) => { const p = mad(ts); return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour - 4, p.minute)).toISOString().slice(0, 10); };
export const msToReset = (ts = Date.now()) => { const p = mad(ts); let d = 4 * 3600 - (p.hour * 3600 + p.minute * 60 + p.second); if (d <= 0) d += 86400; return d * 1000; };
const prevKey = (k) => new Date(Date.parse(k + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
const pick1 = (key, salt, arr) => { let i = hashStr(salt + key) % arr.length; if (arr.length > 1 && i === hashStr(salt + prevKey(key)) % arr.length) i = (i + 1) % arr.length; return arr[i]; }; // nunca repite el de ayer
export function pickDaily(key, themeIds, carPool) { const theme = pick1(key, 'dtheme-', themeIds); return { theme, car: pick1(key, 'dcar-', carPool(theme)) }; }

export const PRACTICE_LAPS = 5, OFFICIAL_LAPS = 3;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const pad = (n) => String(n).padStart(2, '0');
const hms = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export function createDaily(ctx) {
  const { $, lb, acc, esc, fmt, fmtS } = ctx;
  const key = ctx.key;
  let st = load(); if (!st || st.day !== key) { st = { day: key, pr: 0, pa: 0, or: 0, oa: 0, best: null }; save(st); }
  const rem = () => lb.remote;
  const rpc = (name, args) => lb.call('rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
  const pid = () => lb.player.id;
  let tab = 'global', last = null, introTimer = null, boardRows = null;

  const left = (k) => 1 + st[k + 'a'] - st[k + 'r']; // sesiones que quedan de ese tipo
  const adAvail = (k) => st[k + 'a'] < 1 && st[k + 'r'] >= 1;
  async function sync() {
    if (!rem()) return;
    try {
      const s = await rpc('daily_status', { p_player: pid() }); if (!s) return;
      st.pr = Math.max(st.pr, s.pr || 0); st.pa = Math.max(st.pa, s.pa || 0); st.or = Math.max(st.or, s.or || 0); st.oa = Math.max(st.oa, s.oa || 0);
      if (s.ms && (!st.best || s.ms < st.best.ms)) st.best = { ms: s.ms, s: [s.s1, s.s2, s.s3] };
      save(st); renderHero(); if (isOpen() && stage === 'hub') hub();
    } catch (e) { /* sin red: manda la caché local */ }
  }
  async function begin(kind) {
    const k = kind === 'practice' ? 'p' : 'o';
    if (left(k) <= 0) return false;
    if (rem()) { try { const ok = await rpc('daily_begin', { p_player: pid(), p_kind: kind }); if (ok === false) { st[k + 'r'] = Math.max(st[k + 'r'], 1 + st[k + 'a']); save(st); return false; } } catch (e) { /* offline: vale la caché */ } }
    st[k + 'r']++; save(st); return true;
  }
  async function grantAd(kind) {
    const k = kind === 'practice' ? 'p' : 'o';
    if (!adAvail(k)) return false;
    if (rem()) { try { const ok = await rpc('daily_ad', { p_player: pid(), p_kind: kind }); if (ok === false) return false; } catch (e) { /* offline */ } }
    st[k + 'a'] = 1; save(st); return true;
  }
  async function submit(r) { // r = { ms, s:[ms,ms,ms], car, track }
    if (!st.best || r.ms < st.best.ms) { st.best = { ms: r.ms, s: r.s }; save(st); }
    if (rem()) { try { await rpc('daily_submit', { p_player: pid(), p_name: lb.name, p_flag: lb.flag, p_helmet: lb.helmet, p_car: r.car, p_track: r.track, p_ms: r.ms, p_s1: r.s[0], p_s2: r.s[1], p_s3: r.s[2] }); } catch (e) { /* queda en local */ } }
    boardRows = null; renderMini();
  }
  async function board(mode) {
    const own = st.best ? [{ id: pid(), name: lb.name, flag: lb.flag, car: ctx.car.id, ms: st.best.ms, s: st.best.s, you: true }] : [];
    if (!rem()) return { rows: own, online: false };
    try {
      let ids = null;
      if (mode === 'friends') {
        if (!acc.loggedIn) return { rows: own, online: true, needLogin: true };
        const fr = (await acc.friends()) || []; ids = [pid()].concat(fr.filter((f) => f.status === 'amigo').map((f) => f.user_id));
      }
      const rows = (await rpc('daily_board', { p_ids: ids })) || [];
      return { rows: rows.map((r) => ({ id: r.player_id, name: r.name, flag: r.flag, car: r.car_id, ms: r.lap_ms, s: [r.s1, r.s2, r.s3], you: r.player_id === pid() })), online: true };
    } catch (e) { return { rows: own, online: false, error: true }; }
  }

  // ---------- tarjeta del menú ----------
  const dateTxt = () => new Date(key + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase().replace('.', '');
  const statusChips = () => {
    const p = st.pr ? `<span class="on">Práctica ✓</span>` : `<span>Práctica ${PRACTICE_LAPS} vueltas</span>`;
    const o = st.best ? `<span class="gold">Tu tiempo ${fmt(st.best.ms / 1000)}</span>` : st.or ? `<span class="on">Clasificación en curso</span>` : `<span>Clasificación ${OFFICIAL_LAPS} vueltas</span>`;
    return p + o;
  };
  function renderHero() {
    const t = ctx.track, c = ctx.car, [cc, cname] = ctx.countryOf(t);
    $('dyDate').textContent = dateTxt(); $('dyHeroTrack').innerHTML = `<span class="flag">${ctx.flagSvg(cc)}</span>${esc(t.th.name.replace(/ · .*$/, ''))}`; $('dyHeroSub').textContent = `${cname} · ${(t.tr.len / 1000).toFixed(1)} km`;
    $('dyHeroCar').textContent = c.name; $('dyHeroImg').src = `./assets/thumbs/${c.id}.webp`; $('dyHeroChips').innerHTML = statusChips();
    ctx.drawPreview($('dyHeroCv'), t.tr, t.th, 220, 120);
    renderMini();
  }
  async function renderMini() {
    const box = $('dyMini'); if (!box) return;
    if (!boardRows) { box.innerHTML = '<p class="dy-empty">Cargando clasificación…</p>'; boardRows = await board('global'); }
    const rows = boardRows.rows.slice(0, 3), lead = rows[0] && rows[0].ms;
    const me = boardRows.rows.findIndex((r) => r.you);
    box.innerHTML = `<div class="dy-mh"><b>CLASIFICACIÓN DE HOY</b><span>${boardRows.rows.length} piloto${boardRows.rows.length === 1 ? '' : 's'}</span></div>` +
      (rows.length ? rows.map((r, i) => `<div class="dy-mr${r.you ? ' me' : ''}"><i>${i + 1}</i><span class="flag sm">${ctx.flagSvg(r.flag || 'es')}</span><b>${esc(r.name)}</b><em>${fmt(r.ms / 1000)}</em><small>${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : 'LÍDER'}</small></div>`).join('') + (me >= 3 ? `<div class="dy-mr me"><i>${me + 1}</i><span class="flag sm">${ctx.flagSvg(lb.flag)}</span><b>${esc(lb.name)}</b><em>${fmt(boardRows.rows[me].ms / 1000)}</em><small>TÚ</small></div>` : '') : '<p class="dy-empty">Aún nadie ha marcado tiempo hoy. ¡Sé el primero!</p>');
  }

  // ---------- pantalla del reto ----------
  let stage = ''; const isOpen = () => !$('daily').classList.contains('hidden');
  const setStage = (n, html) => { stage = n; $('dyStage').className = 'st-' + n; $('dyStage').innerHTML = html; $('dyGlobe').classList.toggle('hidden', n !== 'globe'); };
  function open(skipIntro) {
    ctx.onOpen && ctx.onOpen();
    $('daily').classList.remove('hidden'); document.body.classList.add('in-daily'); sync();
    if (skipIntro) hub(); else intro();
  }
  function close() { clearTimeout(introTimer); cancelAnimationFrame(spinRaf); stopRadar(); $('daily').classList.add('hidden'); document.body.classList.remove('in-daily'); stage = ''; renderHero(); }
  const head = (sub) => `<div class="dy-head"><small>RETO DEL DÍA · ${dateTxt()}</small><h2>${sub}</h2><span class="dy-cd">Cambia en <b class="cdv">${hms(msToReset())}</b></span></div>`;

  // 1) globo girando hasta el circuito
  let dg = null, spinRaf = 0;
  function intro() {
    const t = ctx.track, ll = ctx.MAP_LL[t.th.id] || ctx.MAP_LL.pruebas, [cc, cname] = ctx.countryOf(t);
    setStage('globe', `${head('Sorteando el circuito…')}<div class="dy-skip">Toca para saltar</div>`);
    const host = $('dyGlobe'); if (!dg) dg = ctx.createGlobe(host);
    const others = ctx.tracks.filter((x) => x.key !== 'daily');
    dg.setPins(others.map((x) => { const l = ctx.MAP_LL[x.th.id] || ctx.MAP_LL.pruebas; return { lat: l[0], lon: l[1], on: x.th === t.th, title: x.th.name, html: ctx.flagSvg(ctx.countryOf(x)[0]), onClick() {} }; }));
    const T0 = performance.now(), DUR = 4300, lon0 = ll[1] + 760, lat0 = 14;
    const ease = (u) => 1 - Math.pow(1 - u, 3);
    const tick = (now) => {
      const u = Math.min(1, (now - T0) / DUR), e = ease(u);
      dg.focus(lat0 + (ll[0] - lat0) * e, lon0 + (ll[1] - lon0) * e, 4.6 - 2.1 * e);
      if (u < 1) spinRaf = requestAnimationFrame(tick); else introTimer = setTimeout(circuit, 900);
    };
    spinRaf = requestAnimationFrame(tick);
    $('daily').onclick = (e) => { if (stage === 'globe' && !e.target.closest('#dyClose')) { cancelAnimationFrame(spinRaf); clearTimeout(introTimer); circuit(); } };
  }
  // 2) el circuito del día
  function circuit() {
    cancelAnimationFrame(spinRaf); clearTimeout(introTimer);
    const t = ctx.track, [cc, cname] = ctx.countryOf(t), env = ctx.envLabel(t);
    setStage('circuit', `${head('Circuito de hoy')}<div class="dy-card dy-reveal"><div class="dy-ct"><span class="flag">${ctx.flagSvg(cc)}</span><div><em>${esc(cname)}</em><b>${esc(t.th.name)}</b></div>${t.th.logo ? `<img class="dy-logo" src="./assets/logos/${t.th.logo}.webp" alt="">` : ''}</div><canvas id="dyCv" class="dy-cv"></canvas><div class="dy-chips"><span>${(t.tr.len / 1000).toFixed(2)} km</span><span>${esc(env)}</span><span>${esc(t.sub || '')}</span></div></div><button id="dyNext" class="dy-btn">PILLAR COCHE ›</button>`);
    ctx.drawPreview($('dyCv'), t.tr, t.th, 560, 300, 1.5); $('dyNext').onclick = radar;
  }
  // 3) radar: escena en perspectiva sobre una carretera de verdad; tráfico normal y, de pronto, el coche del reto a toda velocidad
  let rad = null;
  const stopRadar = () => { if (rad) { rad.stop(); rad = null; } };
  let actx = null; const audioOk = () => { if (ctx.muted && ctx.muted()) return null; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } };
  const loadImg = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  async function radar() {
    stopRadar(); const ac = audioOk();
    const c = ctx.car, pool = ctx.cars.filter((x) => x.id !== c.id && x.group !== 'karts').sort(() => Math.random() - 0.5).slice(0, 6);
    setStage('radar', `${head('Control de velocidad')}<div class="dy-radar"><canvas id="dyRc"></canvas><div class="dy-gun"><small>RADAR</small><b id="dySpd">--</b><em>km/h</em></div><div class="dy-flash"></div></div><div id="dyTk"></div>`);
    const imgs = await Promise.all([c, ...pool].map((x) => loadImg(`./assets/thumbs/${x.id}.webp`)));
    if (stage !== 'radar') return;
    rad = radarScene($('dyRc'), imgs[0], imgs.slice(1).filter(Boolean), c, {
      onFlash() { const f = document.querySelector('.dy-flash'); f && f.classList.add('on'); const sp = $('dySpd'); if (sp) { sp.textContent = Math.round(c.vmax * 3.6); sp.classList.add('hot'); sp.dataset.hit = 1; } },
      onTick(v) { const sp = $('dySpd'); if (sp && !sp.dataset.hit) sp.textContent = v; },
      onEnd() { ticket(); },
    }, ac, ctx.volume ? ctx.volume() : 1);
  }
  function ticket() {
    const c = ctx.car, bar = (n, v, num) => `<div class="tk-st"><span>${n}</span><i><s style="width:${Math.min(100, Math.max(6, v * 100))}%"></s></i><b>${num}</b></div>`;
    const h = hashStr('tk' + key + c.id) >>> 0, plate = `${1000 + h % 9000} ${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 4) % 20]}${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 9) % 20]}${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 14) % 20]}`;
    const hh = 6 + h % 15, mm = pad((h >>> 5) % 60), ss = pad((h >>> 11) % 60), exp = `RD-${key.slice(2).replace(/-/g, '')}-${String(h % 10000).padStart(4, '0')}`;
    const kmh = Math.round(c.vmax * 3.6);
    $('dyTk').innerHTML = `<div class="dy-printer"><i></i></div><div class="dy-tkwrap"><div class="dy-ticket print"><div class="tk-top"><svg viewBox="0 0 24 28" class="tk-crest"><path d="M12 1 2 5v8c0 7 4.5 11.5 10 14 5.5-2.5 10-7 10-14V5z" fill="#1a3a8a"/><path d="M12 5 6 7.5V13c0 4 2.7 7 6 8.7 3.3-1.7 6-4.700 6-8.700V7.500z" fill="#f3c63c"/></svg><div>POLICÍA MUNICIPAL · DENUNCIA POR RADAR<b>BOLETÍN DE INFRACCIÓN</b></div></div><div class="tk-meta"><span>EXP. <b>${exp}</b></span><span>${key.split('-').reverse().join('/')} · ${hh}:${mm}:${ss}</span><span class="w">VÍA: Autovía de las Curvas · km 14,2 · Cabina RADAR 07</span></div><div class="tk-car"><img src="./assets/thumbs/${c.id}.webp" alt=""><div><em>${esc(c.brand || '')}</em><b>${esc(c.name)}</b><div class="tk-plate"><u>E</u>${plate}</div></div></div><div class="tk-inf"><span>Velocidad medida <b class="big">${kmh} km/h</b></span><span>Límite <b>50 km/h</b></span><span>Exceso <b class="red">+${kmh - 50} km/h</b></div>${bar('VEL', c.vmax / 70, kmh + ' km/h')}${bar('ACEL', c.accel / 18, c.accel.toFixed(1))}${bar('GIRO', c.yaw / 4.2, c.yaw.toFixed(1))}${bar('AGARRE', c.grip / 20, c.grip.toFixed(1))}<div class="tk-sum"><span>SANCIÓN <b>600 €</b></span><span>−6 PUNTOS</span></div><div class="tk-bar"></div><div class="tk-foot">${esc(c.desc || '')}</div><div class="tk-stamp">COCHE DEL RETO</div></div></div><button id="dyGo" class="dy-btn">EMPEZAR PRÁCTICA · ${PRACTICE_LAPS} VUELTAS</button><button id="dyHubB" class="dy-btn ghost">Ver clasificación y opciones</button>`;
    rad && rad.printSound(); setTimeout(() => { const st = $('dyStage'); st && (stage === 'radar') && $('dyTk').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
    $('dyGo').onclick = () => startKind('practice'); $('dyHubB').onclick = hub;
  }

  // 4) panel principal: pasos, anuncios y clasificación F1
  const btnP = () => left('p') > 0 ? `<button class="dy-btn" data-act="practice">${st.pr ? 'PRÁCTICA EXTRA' : 'EMPEZAR PRÁCTICA'} · ${PRACTICE_LAPS} VUELTAS</button>` : adAvail('p') ? `<button class="dy-btn ad" data-act="ad-practice">▶ VER ANUNCIO · OTRAS ${PRACTICE_LAPS} DE PRÁCTICA</button>` : `<p class="dy-done">Práctica agotada hasta las 4:00</p>`;
  const btnO = () => left('o') > 0 ? `<button class="dy-btn gold" data-act="official">${st.or ? 'OTRA OPORTUNIDAD' : 'CLASIFICACIÓN'} · ${OFFICIAL_LAPS} VUELTAS</button>` : adAvail('o') ? `<button class="dy-btn ad" data-act="ad-official">▶ VER 2 ANUNCIOS · OTRA OPORTUNIDAD</button>` : `<p class="dy-done">Clasificación cerrada: no se puede repetir más hoy</p>`;
  function lastHtml() {
    if (!last || !last.laps.length) return '';
    const best = Math.min(...last.laps.map((l) => l.t));
    return `<div class="dy-card dy-last"><h3>${last.kind === 'official' ? 'CLASIFICACIÓN' : 'PRÁCTICA'} · TUS VUELTAS</h3><table class="dy-t"><tr><th>V</th><th>S1</th><th>S2</th><th>S3</th><th>TIEMPO</th></tr>${last.laps.map((l, i) => `<tr class="${l.t === best ? 'best' : ''}"><td>${i + 1}</td><td>${l.s[0] != null ? fmtS(l.s[0]) : '–'}</td><td>${l.s[1] != null ? fmtS(l.s[1]) : '–'}</td><td>${l.s[2] != null ? fmtS(l.s[2]) : '–'}</td><td>${fmt(l.t)}</td></tr>`).join('')}</table></div>`;
  }
  function hub() {
    clearTimeout(introTimer); cancelAnimationFrame(spinRaf); stopRadar();
    const t = ctx.track, c = ctx.car;
    setStage('hub', `${head(esc(t.th.name.replace(/ · .*$/, '')))}<div class="dy-card dy-sum"><canvas id="dyCv2" class="dy-cv sm"></canvas><div class="dy-sc"><img src="./assets/thumbs/${c.id}.webp" alt=""><b>${esc(c.name)}</b><small>Mismo coche y circuito para todos</small></div></div>${lastHtml()}<div class="dy-steps"><div class="dy-step"><h3>1 · PRÁCTICA</h3><p>${PRACTICE_LAPS} vueltas. La 1ª sin referencia; después ves tu mejor vuelta (fantasma y diferencial).</p><div id="dyBP">${btnP()}</div></div><div class="dy-step"><h3>2 · CLASIFICACIÓN</h3><p>${OFFICIAL_LAPS} vueltas que cuentan. Cuenta tu mejor vuelta; corres contra tu mejor marca de libres + clasificación.</p><div id="dyBO">${btnO()}</div></div></div><div class="dy-card"><div class="dy-tabs"><button data-tab="friends" class="${tab === 'friends' ? 'on' : ''}">Amigos</button><button data-tab="global" class="${tab === 'global' ? 'on' : ''}">Global</button></div><div id="dyBoard"><p class="dy-empty">Cargando…</p></div></div>`);
    ctx.drawPreview($('dyCv2'), t.tr, t.th, 240, 130);
    renderBoard();
  }
  async function renderBoard() {
    const res = await board(tab), el = $('dyBoard'); if (!el || stage !== 'hub') return;
    if (tab === 'friends' && res.needLogin) { el.innerHTML = '<p class="dy-empty">Inicia sesión en tu Perfil para ver a tus amigos.</p><button class="dy-btn ghost" data-act="profile">Abrir perfil</button>'; return; }
    const rows = res.rows; if (!rows.length) { el.innerHTML = '<p class="dy-empty">Todavía no hay tiempos hoy.</p>'; return; }
    const lead = rows[0].ms, bestS = [0, 1, 2].map((k) => Math.min(...rows.map((r) => (r.s[k] != null ? r.s[k] : 1e12))));
    const sc = (r, k) => r.s[k] == null ? '–' : `<span class="${r.s[k] === bestS[k] ? 'pu' : ''}">${fmtS(r.s[k] / 1000)}</span>`;
    el.innerHTML = `<table class="dy-f1"><tr><th>P</th><th>PILOTO</th><th>S1</th><th>S2</th><th>S3</th><th>VUELTA</th><th>DIF</th></tr>${rows.slice(0, 30).map((r, i) => `<tr class="${r.you ? 'me' : ''}"><td>${i + 1}</td><td class="nm"><span class="flag sm">${ctx.flagSvg(r.flag || 'es')}</span>${esc(r.name)}</td><td>${sc(r, 0)}</td><td>${sc(r, 1)}</td><td>${sc(r, 2)}</td><td class="lp">${fmt(r.ms / 1000)}</td><td>${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : '—'}</td></tr>`).join('')}</table>${res.online ? '' : '<p class="dy-empty">Sin conexión: solo se ve tu tiempo en este dispositivo.</p>'}`;
  }
  async function startKind(kind) {
    const ok = await begin(kind); if (!ok) { ctx.toast('Sin intentos disponibles'); hub(); return; }
    $('daily').classList.add('hidden'); document.body.classList.remove('in-daily'); ctx.startSession(kind);
  }
  const ADS = [
    { id: 'traced', logo: 'traced', name: 'Traced', url: 'https://ro-di-tracker.vercel.app/', kick: '⚠ ÚLTIMA HORA · GOLF', h: '¡TU BOLA DESAPARECE EN PLENO VUELO Y NADIE SABE POR QUÉ!', p: 'Traced dibuja la trayectoria de tu golpe sobre tu propio vídeo. Por fin sabrás dónde acabó esa bola que «iba recta».', cta: 'PROBAR TRACED ›', foot: '*Traced no garantiza que tu bola llegue al green. Solo que verás con todo detalle cómo no llegó.' },
    { id: 'palomapp', logo: 'palomapp', name: 'PalomApp', url: 'https://urlife-zeta.vercel.app/', kick: '🚨 ALERTA FINANCIERA', h: '¡TU SUELDO SE ESCAPA VOLANDO Y LA PALOMA LO SABE!', p: 'PalomApp: la única paloma que vigila tus euros. Gastos, tareas y cuentas claras, sin que nadie te pique.', cta: 'ABRIR PALOMAPP ›', foot: '*El 100 % de los usuarios deja de preguntarse a dónde fue el dinero. Estudio realizado por una paloma.' },
  ];
  async function adFlow(n) {
    const o = $('dyAd'); o.classList.remove('hidden'); let prev = -1;
    for (let i = 1; i <= n; i++) {
      let k = Math.floor(Math.random() * ADS.length); if (k === prev) k = (k + 1) % ADS.length; prev = k; const a = ADS[k];
      const ok = await new Promise((res) => {
        o.innerHTML = `<div class="dy-adbox ad-${a.id}"><div class="ad-top"><small>ANUNCIO ${i}/${n}</small><button type="button" class="ad-x" id="adX" aria-label="Salir">✕</button></div><img class="ad-logo" src="./assets/logos/${a.logo}.webp" alt="${a.name}"><em>${a.kick}</em><b>${a.h}</b><p>${a.p}</p><a class="ad-cta" href="${a.url}" target="_blank" rel="noopener noreferrer">${a.cta}</a><small class="ad-foot">${a.foot}</small><button type="button" class="dy-btn ad-next" id="adNext" disabled>CONTINÚA EN 5</button></div>`;
        let left = 5; const nx = $('adNext'); const iv = setInterval(() => { left--; if (left > 0) nx.textContent = 'CONTINÚA EN ' + left; else { clearInterval(iv); nx.disabled = false; nx.textContent = i === n ? 'CONSEGUIR INTENTO EXTRA' : 'SIGUIENTE ANUNCIO'; } }, 1000);
        nx.onclick = () => { clearInterval(iv); res(true); }; $('adX').onclick = () => { clearInterval(iv); res(false); };
      });
      if (!ok) { o.classList.add('hidden'); return false; }
    }
    o.classList.add('hidden'); return true;
  }
  $('daily').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'dyClose') return close();
    if (b.dataset.tab) { tab = b.dataset.tab; hub(); return; }
    const a = b.dataset.act; if (!a) return;
    if (a === 'practice' || a === 'official') return startKind(a);
    if (a === 'profile') { close(); $('profBtn').click(); return; }
    if (a === 'ad-practice' || a === 'ad-official') { const kind = a.slice(3), n = kind === 'practice' ? 1 : 2; b.disabled = true; const okAd = await adFlow(n); if (okAd) await grantAd(kind); renderHero(); hub(); }
  });
  $('dailyCard').onclick = () => open(false); $('dailyBtn').onclick = () => open(false); $('dyAllBoard').onclick = () => { tab = 'global'; open(true); };
  acc.onChange(() => { boardRows = null; sync(); });
  setInterval(() => {
    if (dailyKeyNow() !== key && !document.body.classList.contains('racing')) { location.reload(); return; }
    const t = hms(msToReset()); document.querySelectorAll('.cdv').forEach((e) => { e.textContent = t; });
  }, 1000);
  renderHero(); sync();
  return {
    open, close, hub, submit, left, refresh: renderHero, key,
    sessionDone(l) { last = l; },
  };
}

// ---------- escena del radar (pseudo-3D en canvas) ----------
function radarScene(cv, fastImg, trafficImgs, car, cb, ac, vol) {
  const W = 360, H = 250, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const hz = H * 0.4, F = 200, CH = 1.6, XL = [-3.1, -1.05];
  const PX = (X, Z) => W / 2 + F * X / Z, PY = (Y, Z) => hz + F * (CH - Y) / Z; // Y = altura sobre la calzada
  // audio
  let master = null; const voices = [];
  if (ac) { master = ac.createGain(); master.gain.value = 0.55 * (vol == null ? 1 : vol); master.connect(ac.destination); }
  const noiseBuf = ac ? (() => { const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })() : null;
  const mkVoice = (fast) => {
    if (!ac) return null;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), gn = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = fast ? 2600 : 1000; gn.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(master); o1.start(); o2.start();
    return { set(f, v) { const t = ac.currentTime; o1.frequency.setTargetAtTime(f, t, 0.03); o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); gn.gain.setTargetAtTime(v, t, 0.04); }, stop() { try { gn.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) { /* ya parado */ } }, 400); } catch (e) { /* sin audio */ } } };
  };
  const burst = (dur, f0, f1, vol2, type) => { if (!ac) return; const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const bp = ac.createBiquadFilter(), gn = ac.createGain(); bp.type = type || 'bandpass'; bp.frequency.setValueAtTime(f0, ac.currentTime); bp.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur); bp.Q.value = 0.8; gn.gain.setValueAtTime(vol2, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur); n.connect(bp); bp.connect(gn); gn.connect(master); n.start(); n.stop(ac.currentTime + dur + 0.05); };
  const tone = (f, dur, v, type) => { if (!ac) return; const o = ac.createOscillator(), gn = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(v, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur); o.connect(gn); gn.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02); };
  // coches
  const cars = [];
  const spawnT = [0, 0.35, 0.85, 1.25, 1.7];
  trafficImgs.slice(0, 5).forEach((im, i) => cars.push({ img: im, X: i === 1 ? XL[1] : XL[0], Z0: 95, v: 24 + (i % 3) * 2, t0: spawnT[i], fast: false, voice: null, kmh: 50 }));
  const T_FAST = 3.1, V_FAST = 128;
  cars.push({ img: fastImg, X: XL[1], Z0: 95, v: V_FAST, t0: T_FAST, fast: true, voice: null, kmh: Math.round(car.vmax * 3.6) });
  let t0 = performance.now(), raf = 0, flashed = false, ended = false, tickAt = 0, stopped = false;
  const hill = (seed, col, base, amp) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 12) g.lineTo(x, hz - base - amp * (Math.sin(x * 0.021 + seed) * 0.5 + Math.sin(x * 0.047 + seed * 2) * 0.35 + 0.5)); g.lineTo(W, hz); g.closePath(); g.fill(); };
  function bg() {
    const sk = g.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, '#15163f'); sk.addColorStop(0.6, '#6a3a78'); sk.addColorStop(1, '#f79a52'); g.fillStyle = sk; g.fillRect(0, 0, W, hz + 2);
    const sun = g.createRadialGradient(W * 0.68, hz, 2, W * 0.68, hz, 70); sun.addColorStop(0, 'rgba(255,225,150,.95)'); sun.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = sun; g.fillRect(0, hz - 70, W, 72);
    hill(1, '#3a2a5c', 6, 22); hill(4, '#26204a', 2, 14);
    const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#2b3a2a'); gr.addColorStop(1, '#141c18'); g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
    // calzada
    const Zn = 2.0, Zf = 400; g.fillStyle = '#34363f'; g.beginPath(); g.moveTo(PX(-4.2, Zf), PY(0, Zf)); g.lineTo(PX(4.2, Zf), PY(0, Zf)); g.lineTo(PX(4.2, Zn), PY(0, Zn)); g.lineTo(PX(-4.2, Zn), PY(0, Zn)); g.closePath(); g.fill();
    const rd = g.createLinearGradient(0, hz, 0, H); rd.addColorStop(0, 'rgba(247,154,82,.35)'); rd.addColorStop(0.35, 'rgba(0,0,0,0)'); g.fillStyle = rd; g.fill();
    const line = (X, w, col, dash) => { g.strokeStyle = col; for (let Z = 2.4; Z < 140; Z += dash ? 6 : 140) { const z2 = dash ? Z + 3 : 140; g.lineWidth = Math.max(0.4, F * w / Z); g.beginPath(); g.moveTo(PX(X, Z), PY(0, Z)); g.lineTo(PX(X, z2), PY(0, z2)); g.stroke(); } };
    line(-4.05, 0.14, '#e9eaf0'); line(4.05, 0.14, '#e9eaf0'); line(-0.22, 0.08, '#f3c63c'); line(0.22, 0.08, '#f3c63c'); line(-2.1, 0.12, 'rgba(255,255,255,.85)', true); line(2.1, 0.12, 'rgba(255,255,255,.85)', true);
    // «50» pintado en el asfalto
    g.save(); const zc = 6.2, sx = PX(XL[0], zc), sy = PY(0, zc); g.translate(sx, sy); g.scale(1, 0.22); g.fillStyle = 'rgba(255,255,255,.78)'; g.font = `800 ${Math.round(F * 2.6 / zc)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('50', 0, 0); g.restore();
    // quitamiedos y farolas
    for (let Z = 150; Z > 2; Z -= 8) for (const sgn of [-1, 1]) { const X = sgn * 5; g.strokeStyle = '#8b93a6'; g.lineWidth = Math.max(0.5, F * 0.1 / Z); g.beginPath(); g.moveTo(PX(X, Z), PY(0, Z)); g.lineTo(PX(X, Z), PY(0.7, Z)); g.stroke(); }
    for (let Z = 140; Z > 4; Z -= 24) { const X = 5.9, bx = PX(X, Z), by = PY(5.2, Z); g.strokeStyle = '#59607a'; g.lineWidth = Math.max(0.6, F * 0.12 / Z); g.beginPath(); g.moveTo(bx, PY(0, Z)); g.lineTo(bx, by); g.lineTo(bx - F * 1.2 / Z, by); g.stroke(); const gl = g.createRadialGradient(bx - F * 1.2 / Z, by, 0, bx - F * 1.2 / Z, by, F * 2 / Z + 2); gl.addColorStop(0, 'rgba(255,220,150,.9)'); gl.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gl; g.fillRect(bx - F * 3.6 / Z, by - F * 2 / Z, F * 4.6 / Z, F * 4 / Z); }
    // señal de límite + cabina de radar
    { const Z = 8.5, X = 5.3, bx = PX(X, Z), r = F * 0.5 / Z * 1.6; g.strokeStyle = '#7c8499'; g.lineWidth = F * 0.1 / Z * 1.4; g.beginPath(); g.moveTo(bx, PY(0, Z)); g.lineTo(bx, PY(3.1, Z)); g.stroke();
      const cy = PY(2.7, Z); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, cy, r, 0, 7); g.fill(); g.strokeStyle = '#e2283c'; g.lineWidth = r * 0.24; g.beginPath(); g.arc(bx, cy, r * 0.86, 0, 7); g.stroke(); g.fillStyle = '#111'; g.font = `800 ${Math.round(r * 1.05)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('50', bx, cy + r * 0.04);
      const bz = 6.5, rx = PX(X - 0.1, bz), ry = PY(2.1, bz), bw = F * 0.7 / bz, bh = F * 0.55 / bz; g.strokeStyle = '#7c8499'; g.lineWidth = F * 0.1 / bz * 1.3; g.beginPath(); g.moveTo(rx, PY(0, bz)); g.lineTo(rx, ry); g.stroke(); g.fillStyle = '#d4d8e2'; g.fillRect(rx - bw / 2, ry - bh, bw, bh); g.fillStyle = '#15171f'; g.beginPath(); g.arc(rx - bw * 0.12, ry - bh / 2, bh * 0.32, 0, 7); g.fill(); g.fillStyle = flashed ? '#ff4357' : '#7a1520'; g.beginPath(); g.arc(rx + bw * 0.28, ry - bh * 0.7, bh * 0.1, 0, 7); g.fill(); }
  }
  function drawCar(c, Z, a) {
    if (!c.img || Z < 2.1) return;
    const s = F / Z, w = 3.0 * s, h = w * c.img.height / c.img.width, x = PX(c.X, Z) - w / 2, yb = PY(0, Z) + h * 0.07;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(x + w / 2, PY(0, Z) + h * 0.03, w * 0.46, Math.max(1, h * 0.08), 0, 0, 7); g.fill();
    g.globalAlpha = a; g.drawImage(c.img, x, yb - h, w, h); g.globalAlpha = 1;
    const hx = x + w * 0.3, hy = yb - h * 0.34, gl = g.createRadialGradient(hx, hy, 0, hx, hy, w * (c.fast ? 0.5 : 0.32)); gl.addColorStop(0, 'rgba(255,245,210,.85)'); gl.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gl; g.globalCompositeOperation = 'lighter'; g.fillRect(hx - w * 0.5, hy - w * 0.5, w, w); g.globalCompositeOperation = 'source-over';
  }
  function frame(now) {
    if (stopped) return; raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000; bg();
    const vis = cars.map((c) => { const tt = t - c.t0; if (tt < 0) return null; const Z = c.Z0 - c.v * tt; return { c, Z, tt }; }).filter(Boolean).sort((a, b) => b.Z - a.Z);
    for (const o of vis) {
      const { c, Z } = o;
      if (c.fast && Z < 40 && Z > 2.4) { for (let k = 3; k >= 1; k--) drawCar(c, Z + k * 5.5, 0.16); } // estela de velocidad
      drawCar(c, Z, 1);
      if (c.fast && !flashed && Z <= 6.6) { flashed = true; cb.onFlash(); burst(0.12, 6000, 3000, 0.9, 'highpass'); tone(130, 0.12, 0.7); tone(1800, 0.09, 0.2, 'square'); setTimeout(() => tone(900, 0.2, 0.18, 'square'), 140); }
    }
    // sonido de motores con efecto Doppler
    if (ac) for (const o of vis) {
      const { c, Z } = o, d = Math.max(1.2, Math.abs(Z)), pass = Z <= 2.1;
      if (!c.voice && !c.dead) { c.voice = mkVoice(c.fast); if (c.fast) burst(0.9, 500, 1800, 0.22); }
      if (c.voice) {
        const base = c.fast ? 150 + c.kmh * 1.15 : 85 + c.kmh * 0.9, dop = 1 + (c.kmh / 3.6 / 343) * (c.fast ? 4.4 : 3.2), f = base * (pass ? 1 / dop : dop) * (c.fast && !pass ? 1 + Math.min(0.35, (95 - Z) / 260) : 1);
        const dist = pass ? 2.1 + (c.v * (o.tt - (c.Z0 - 2.1) / c.v)) * 0.6 : Z; const vg = (c.fast ? 0.34 : 0.14) * Math.min(1.6, 9 / Math.max(2, dist));
        c.voice.set(f, vg * (Z > 95 ? 0 : 1));
        if (pass && !c.passed) { c.passed = true; if (c.fast) burst(0.5, 2500, 400, 0.6); else burst(0.35, 900, 300, 0.12); }
        if (pass && o.tt > (c.Z0 - 2.1) / c.v + 0.9 && !c.dead) { c.dead = true; c.voice.stop(); c.voice = null; }
      }
    }
    if (!tickAt || now - tickAt > 170) { tickAt = now; cb.onTick(46 + Math.round(Math.random() * 8)); }
    const tf = t - T_FAST - (95 - 2.1) / V_FAST;
    if (flashed && !ended && tf > 0.7) { ended = true; cb.onEnd(); }
  }
  raf = requestAnimationFrame(frame);
  return {
    stop() { stopped = true; cancelAnimationFrame(raf); cars.forEach((c) => c.voice && c.voice.stop()); },
    printSound() { if (!ac) return; const o = ac.createOscillator(), l = ac.createOscillator(), gn = ac.createGain(), lg = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = 95; l.frequency.value = 26; l.type = 'square'; lg.gain.value = 0.09; gn.gain.value = 0.1; l.connect(lg); lg.connect(gn.gain); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; o.connect(f); f.connect(gn); gn.connect(master); o.start(); l.start(); o.frequency.setValueAtTime(95, ac.currentTime); o.frequency.linearRampToValueAtTime(130, ac.currentTime + 1.5); const e = ac.currentTime + 1.55; o.stop(e); l.stop(e); setTimeout(() => { tone(1100, 0.08, 0.15, 'square'); burst(0.25, 3000, 800, 0.25); }, 1500); },
  };
}
