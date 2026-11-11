// Reto del día: día de 4:00 a 4:00 (Madrid), circuito y coche aleatorios, práctica 5 vueltas + clasificación 3 vueltas.
// Los intentos se controlan en el servidor (supabase/daily.sql) y se cachean en local. Sin servidor, solo local.
import { hashStr } from './rng.js';
import { createRadar3D } from './radar3d.js';
import { waShare, inviteUrl, waBtn } from './share.js';

const KEY = 'dr.daily';
const mad = (ts) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(ts).map((x) => [x.type, +x.value]));
export const dailyKeyNow = (ts = Date.now()) => { const p = mad(ts); return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour - 4, p.minute)).toISOString().slice(0, 10); };
export const msToReset = (ts = Date.now()) => { const p = mad(ts); let d = 4 * 3600 - (p.hour * 3600 + p.minute * 60 + p.second); if (d <= 0) d += 86400; return d * 1000; };
const prevKey = (k) => new Date(Date.parse(k + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
const pick1 = (key, salt, arr) => { let i = hashStr(salt + key) % arr.length; if (arr.length > 1 && i === hashStr(salt + prevKey(key)) % arr.length) i = (i + 1) % arr.length; return arr[i]; }; // nunca repite el de ayer
export function pickDaily(key, themeIds, carPool) { const theme = pick1(key, 'dtheme-', themeIds); return { theme, car: pick1(key, 'dcar-', carPool(theme)) }; }

// Estreno de Madring: ese día el reto es Madring y se entra con contraseña (una vez por dispositivo). Se compara su huella, no el texto.
export const DAILY_LOCK_DAY = '2026-11-09';
const LOCK_HASH = 2404629177, OPEN_KEY = 'dr.dailyOpen';
export const PRACTICE_LAPS = 5, OFFICIAL_LAPS = 3;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const pad = (n) => String(n).padStart(2, '0');
const hms = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export function createDaily(ctx) {
  const { $, lb, acc, esc, fmt, fmtS } = ctx;
  const key = ctx.key;
  let st = load(); if (!st || st.day !== key) { st = { day: key, pr: 0, pa: 0, or: 0, oa: 0, best: null }; save(st); }
  if (st.pick && st.pick !== 'base') ctx.setCar(st.pick);
  const rem = () => lb.remote;
  const rpc = (name, args) => lb.call('rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
  const pid = () => lb.player.id;
  let tab = 'global', last = null, introTimer = null, boardRows = null;

  // ---- Lentorro: el último de ayer en su liga elige coche (el del día o 1 de 3 de una categoría superior)
  const CHAIN = ['cv100', 'cv150', 'cv200', 'rally', 'competicion', 'f1'];
  const canPick = () => !!(st.ud && !st.pick && !st.pr && !st.or);
  const upgrades = () => { // 3 coches de la categoría siguiente; si ésta no tiene 3, se completa con las superiores
    const b = ctx.baseCar, i = CHAIN.indexOf(b.group), out = [];
    for (let k = i < 0 ? 0 : Math.min(i + 1, CHAIN.length - 1); k < CHAIN.length && out.length < 3; k++) out.push(...ctx.cars.filter((c) => c.group === CHAIN[k] && c.id !== b.id).sort((x, y) => hashStr(key + pid() + x.id) - hashStr(key + pid() + y.id)));
    if (out.length < 3 && i >= 0) out.push(...ctx.cars.filter((c) => c.group === b.group && c.id !== b.id && !out.includes(c)));
    return out.slice(0, 3); };
  function pickCar(id) { st.pick = id; ctx.setCar(id === 'base' ? ctx.baseCar.id : id); carsP = null; save(st); renderHero(); }
  const lentorroHtml = () => { const b = ctx.baseCar, opt = (c, base) => `<button type="button" class="dy-ud" data-pick="${base ? 'base' : c.id}"><img src="./assets/thumbs/${c.id}.webp" alt=""><b>${esc(c.name)}</b><small>${base ? 'Coche del día' : esc(ctx.groupName(c.group))}</small></button>`;
    return `<div class="dy-card dy-lentorro"><h3>🐌 PREMIO LENTORRO</h3><p>Ayer fuiste el último en ${esc(st.ud.join(', '))}. Hoy puedes seguir con el coche del día o elegir uno de categoría superior.</p><div class="dy-udg">${opt(b, true)}${upgrades().map((c) => opt(c, false)).join('')}</div></div>`; };
  function lentorro() {
    cancelAnimationFrame(spinRaf); clearTimeout(introTimer); stopRadar();
    setStage('lentorro', `${head('Premio Lentorro')}${lentorroHtml()}`);
  }
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
    if (acc.loggedIn && !st.pick && !st.ud) { try { const u = await acc.rpc('daily_underdog'); if (u && u.length) { st.ud = u; save(st); renderHero(); if (isOpen() && stage === 'hub') hub(); } } catch (e) { /* sin liga o sin red */ } }
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
  let carsP = null;
  const prefetch = () => { if (carsP) return carsP; const c = ctx.car, pool = ctx.cars.filter((x) => x.id !== c.id && x.group !== 'karts').sort(() => Math.random() - 0.5).slice(0, 6); carsP = ctx.radarCars(c, pool).catch(() => null); return carsP; };
  let openedNow = false;
  const locked = () => { if (key !== DAILY_LOCK_DAY || openedNow) return false; try { return localStorage.getItem(OPEN_KEY) !== key; } catch (e) { return true; } };
  function lockScreen(skipIntro) {
    setStage('lock', `${head('Reto con contraseña')}<div class="dy-card"><label for="dyPass" style="display:block;margin-bottom:10px">Introduce la contraseña para desbloquear el circuito de hoy</label><input id="dyPass" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" style="box-sizing:border-box;width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.35);color:#fff;font-size:16px;letter-spacing:.08em;-webkit-user-select:text;user-select:text"><p id="dyPassErr" style="min-height:18px;margin:8px 0 0;color:#ff8a8a;font-size:13px"></p></div><button id="dyPassGo" class="dy-btn">DESBLOQUEAR</button>`);
    const input = $('dyPass'), go = () => {
      if (hashStr(input.value.trim().toUpperCase()) !== LOCK_HASH) { $('dyPassErr').textContent = 'Contraseña incorrecta'; input.select(); return; }
      openedNow = true; try { localStorage.setItem(OPEN_KEY, key); } catch (e) { /* vale para esta sesión */ }
      open(skipIntro);
    };
    $('dyPassGo').onclick = go; input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); };
  }
  function open(skipIntro) {
    prefetch();
    ctx.onOpen && ctx.onOpen();
    $('daily').classList.remove('hidden'); document.body.classList.add('in-daily'); sync();
    if (locked()) lockScreen(skipIntro); else if (skipIntro) hub(); else intro();
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
    ctx.drawPreview($('dyCv'), t.tr, t.th, 560, 300, 1.5); $('dyNext').onclick = () => (canPick() ? lentorro() : radar());
  }
  // 3) radar: escena en perspectiva sobre una carretera de verdad; tráfico normal y, de pronto, el coche del reto a toda velocidad
  let rad = null;
  const stopRadar = () => { if (rad) { rad.stop(); rad = null; } };
  let actx = null; const audioOk = () => { if (ctx.muted && ctx.muted()) return null; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } };
  const loadImg = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  async function radar() {
    stopRadar(); const ac = audioOk();
    const c = ctx.car;
    setStage('radar', `${head('Control de velocidad')}<div class="dy-radar"><canvas id="dyRc"></canvas><div class="dy-gun"><small>RADAR</small><b id="dySpd">--</b><em>km/h</em></div><div class="dy-flash"></div></div><div id="dyTk"></div>`);
    const cars = await prefetch(); carsP = null;
    if (stage !== 'radar') return;
    const cb = {
      onFlash() { const f = document.querySelector('.dy-flash'); f && f.classList.add('on'); const sp = $('dySpd'); if (sp) { sp.textContent = Math.round(c.vmax * 3.6); sp.classList.add('hot'); sp.dataset.hit = 1; } },
      onTick(v) { const sp = $('dySpd'); if (sp && !sp.dataset.hit) sp.textContent = v; },
      onEnd() { ticket(); },
    };
    if (!cars) { setTimeout(() => stage === 'radar' && ticket(), 600); return; }
    rad = createRadar3D($('dyRc'), { traffic: cars.traffic, fast: cars.fast, kmh: Math.round(c.vmax * 3.6), cb, ac, vol: ctx.volume ? ctx.volume() : 1 });
  }
  function ticket() {
    const c = ctx.car, bar = (n, v, num) => `<div class="tk-st"><span>${n}</span><i><s style="width:${Math.min(100, Math.max(6, v * 100))}%"></s></i><b>${num}</b></div>`;
    const h = hashStr('tk' + key + c.id) >>> 0, plate = `${1000 + h % 9000} ${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 4) % 20]}${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 9) % 20]}${'BCDFGHJKLMNPRSTVWXYZ'[(h >>> 14) % 20]}`;
    const hh = 6 + h % 15, mm = pad((h >>> 5) % 60), ss = pad((h >>> 11) % 60), exp = `RD-${key.slice(2).replace(/-/g, '')}-${String(h % 10000).padStart(4, '0')}`;
    const kmh = Math.round(c.vmax * 3.6);
    $('dyTk').innerHTML = `<div class="dy-printer"><i></i></div><div class="dy-tkwrap"><div class="dy-ticket print"><div class="tk-claim">TU COCHE PARA EL RETO</div><div class="tk-car"><img src="./assets/thumbs/${c.id}.webp" alt=""><div><em>${esc(c.brand || '')}</em><b>${esc(c.name)}</b></div></div><div class="tk-inf"><span>Medido <b class="big">${kmh} km/h</b></span><span>Límite <b>50</b></span></div>${bar('VEL', c.vmax / 70, kmh)}${bar('ACEL', c.accel / 18, c.accel.toFixed(1))}${bar('GIRO', c.yaw / 4.2, c.yaw.toFixed(1))}${bar('AGARRE', c.grip / 20, c.grip.toFixed(1))}<div class="tk-sum"><span>MULTA <b>600 €</b></span><span class="tk-pl">${plate}</span></div></div></div><button id="dyGo" class="dy-btn">EMPEZAR PRÁCTICA · ${PRACTICE_LAPS} VUELTAS</button><button id="dyHubB" class="dy-btn ghost">Ver clasificación y opciones</button>`;
    rad && rad.printSound(); setTimeout(() => { const st = $('dyStage'); st && (stage === 'radar') && $('dyTk').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
    $('dyGo').onclick = () => startKind('practice'); $('dyHubB').onclick = hub;
  }

  // 4) panel principal: pasos, anuncios y clasificación F1
  const btnP = () => left('p') > 0 ? `<button class="dy-btn" data-act="practice">${st.pr ? 'PRÁCTICA EXTRA' : 'EMPEZAR PRÁCTICA'} · ${PRACTICE_LAPS} VUELTAS</button>` : adAvail('p') ? `<button class="dy-btn ad" data-act="ad-practice">▶ VER ANUNCIO · OTRAS ${PRACTICE_LAPS} DE PRÁCTICA</button>` : `<p class="dy-done">Práctica agotada hasta las 4:00</p>`;
  const btnO = () => left('o') > 0 ? `<button class="dy-btn gold" data-act="official">${st.or ? 'OTRA OPORTUNIDAD' : 'CLASIFICACIÓN'} · ${OFFICIAL_LAPS} VUELTAS</button>` : adAvail('o') ? `<button class="dy-btn ad" data-act="ad-official">▶ VER 2 ANUNCIOS · OTRA OPORTUNIDAD</button>` : `<p class="dy-done">Clasificación cerrada: no se puede repetir más hoy</p>`;
  const acc_user = () => (ctx.acc && ctx.acc.username) || '';
  function lastHtml() {
    if (!last || !last.laps.length) return '';
    const best = Math.min(...last.laps.map((l) => l.t));
    return `<div class="dy-card dy-last"><h3>${last.kind === 'official' ? 'CLASIFICACIÓN' : 'PRÁCTICA'} · TUS VUELTAS</h3><table class="dy-t"><tr><th>V</th><th>S1</th><th>S2</th><th>S3</th><th>TIEMPO</th></tr>${last.laps.map((l, i) => `<tr class="${l.t === best ? 'best' : ''}"><td>${i + 1}</td><td>${l.s[0] != null ? fmtS(l.s[0]) : '–'}</td><td>${l.s[1] != null ? fmtS(l.s[1]) : '–'}</td><td>${l.s[2] != null ? fmtS(l.s[2]) : '–'}</td><td>${fmt(l.t)}</td></tr>`).join('')}</table></div>`;
  }
  function hub() {
    clearTimeout(introTimer); cancelAnimationFrame(spinRaf); stopRadar();
    const t = ctx.track, c = ctx.car;
    setStage('hub', `${head(esc(t.th.name.replace(/ · .*$/, '')))}<div class="dy-card dy-sum"><canvas id="dyCv2" class="dy-cv sm"></canvas><div class="dy-sc"><img src="./assets/thumbs/${c.id}.webp" alt=""><b>${esc(c.name)}</b><small>${st.pick && st.pick !== 'base' ? '🐌 Elegido con el premio Lentorro' : 'Mismo coche y circuito para todos'}</small></div></div>${canPick() ? lentorroHtml() : ''}${lastHtml()}<div class="dy-wa">${st.best ? waBtn('Compartir mi tiempo', 'data-act="wa-result"', 'dy-btn wa') : ''}${waBtn('Retar a un amigo', 'data-act="wa-challenge"', 'dy-btn wa ghost')}</div><div class="dy-steps"><div class="dy-step"><h3>1 · PRÁCTICA</h3><p>${PRACTICE_LAPS} vueltas. La 1ª sin referencia; después ves tu mejor vuelta (fantasma y diferencial).</p><div id="dyBP">${btnP()}</div></div><div class="dy-step"><h3>2 · CLASIFICACIÓN</h3><p>${OFFICIAL_LAPS} vueltas que cuentan. Cuenta tu mejor vuelta; corres contra tu mejor marca de libres + clasificación.</p><div id="dyBO">${btnO()}</div></div></div><div class="dy-card"><div class="dy-tabs"><button data-tab="friends" class="${tab === 'friends' ? 'on' : ''}">Amigos</button><button data-tab="global" class="${tab === 'global' ? 'on' : ''}">Global</button></div><div id="dyBoard"><p class="dy-empty">Cargando…</p></div></div>`);
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
    { id: 'palomapp', logo: 'palomapp', name: 'PalomApp', url: 'https://urlife-zeta.vercel.app/', kick: '🚨 ALERTA FINANCIERA', h: '¡TU SUELDO SE ESCAPA VOLANDO Y PALOMA LO SABE!', p: 'PalomApp: la única Paloma que vigila tus euros. Gastos, tareas y cuentas claras, sin que nadie te pique.', cta: 'ABRIR PALOMAPP ›', foot: '*El 100 % de los usuarios deja de preguntarse a dónde fue el dinero. Estudio realizado por Paloma.' },
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
    if (b.dataset.pick) { if (canPick()) { pickCar(b.dataset.pick); } return stage === 'lentorro' ? radar() : hub(); }
    const a = b.dataset.act; if (!a) return;
    if (a === 'practice' || a === 'official') return startKind(a);
    if (a === 'wa-result' || a === 'wa-challenge') {
      const t = ctx.track, c = ctx.car, circ = t.th.name.replace(/ · .*$/, ''), u = acc_user();
      const txt = a === 'wa-result' && st.best ? `🏁 Reto del día de Drift Rush: ${fmt(st.best.ms / 1000)} en ${circ} con el ${c.name}. ¿Me ganas? Mismo coche y circuito para todos, solo un intento oficial.` : `🏎️ Hoy el reto de Drift Rush es ${circ} con el ${c.name}. Mismo coche para todos: ¡a ver quién hace mejor tiempo!`;
      waShare(txt, inviteUrl(u)); return;
    }
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

