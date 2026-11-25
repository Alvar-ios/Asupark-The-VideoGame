// Visor de repeticiones de liga: todos los fantasmas de un día a la vez (cámara cinemática) o la vuelta de un solo piloto.
// Dibuja la trazada de cada piloto como una cinta sobre el asfalto. Usa su propia escena: no toca la carrera ni el menú.
import * as THREE from 'three';
import { waShare, baseUrl } from './share.js';

const PALETTE = [0xff3b4e, 0x2e9bff, 0xffd34e, 0x3be08a, 0xb36bff, 0xff8a2a, 0x2de2e6, 0xff5fc8, 0xa8e63c, 0xffffff, 0x8a93ff, 0xd98c5f];
const HZ = 40, wrap = (a) => { a %= Math.PI * 2; return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(3)}`; };

export function createReplay(ctx) {
  const { $, esc, renderer, camera, buildWorld, disposeScene, buildCar, ensureModels, carList, trackFor, followSun, ps2View, MOBILE, freeMenu, toast, flagSvg } = ctx;
  let R = null, el = null;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();

  // ---------- datos de un piloto ----------
  function prep(d, i, solo) {
    const g = Float32Array.from(d.ghost), n = Math.floor(g.length / 4), cum = new Float32Array(n), spd = new Float32Array(n);
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(g[k * 4] - g[k * 4 - 4], g[k * 4 + 1] - g[k * 4 - 3], g[k * 4 + 2] - g[k * 4 - 2]);
    let top = 1;
    for (let k = 0; k < n; k++) { const a = Math.max(0, k - 3), b = Math.min(n - 1, k + 3); spd[k] = (cum[b] - cum[a]) / ((b - a) / HZ); if (spd[k] > top) top = spd[k]; }
    return { ...d, g, n, T: (n - 1) / HZ, cum, spd, top, color: PALETTE[i % PALETTE.length], solo };
  }
  function pose(d, t, out) {
    const f = clamp(t * HZ, 0, d.n - 1), i = Math.min(Math.floor(f), d.n - 2), k = f - i, o = i * 4, q = o + 4, g = d.g;
    out.x = g[o] + (g[q] - g[o]) * k; out.y = g[o + 1] + (g[q + 1] - g[o + 1]) * k; out.z = g[o + 2] + (g[q + 2] - g[o + 2]) * k; out.psi = g[o + 3] + wrap(g[q + 3] - g[o + 3]) * k;
    out.cum = d.cum[i] + (d.cum[i + 1] - d.cum[i]) * k; out.spd = d.spd[i] + (d.spd[i + 1] - d.spd[i]) * k;
    const j = Math.min(d.n - 1, i + 4), p = Math.max(0, i - 1); let dx = g[j * 4] - g[p * 4], dz = g[j * 4 + 2] - g[p * 4 + 2]; const l = Math.hypot(dx, dz) || 1; out.fx = dx / l; out.fz = dz / l;
    return out;
  }

  // ---------- trazada: cinta sobre el asfalto ----------
  function ribbon(d, speedColor) {
    const step = 2, m = Math.ceil(d.n / step), pos = new Float32Array(m * 6), col = new Float32Array(m * 6), idx = new Uint32Array((m - 1) * 6), c = new THREE.Color(), half = 0.34;
    for (let p = 0; p < m; p++) {
      const i = Math.min(d.n - 1, p * step), a = Math.max(0, i - 2), b = Math.min(d.n - 1, i + 2);
      let dx = d.g[b * 4] - d.g[a * 4], dz = d.g[b * 4 + 2] - d.g[a * 4 + 2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const x = d.g[i * 4], y = d.g[i * 4 + 1] + 0.1, z = d.g[i * 4 + 2];
      pos.set([x - dz * half, y, z + dx * half, x + dz * half, y, z - dx * half], p * 6);
      if (speedColor) c.setHSL(0.36 * clamp((d.spd[i] / d.top - 0.3) / 0.7, 0, 1), 0.95, 0.5); else c.setHex(d.color);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], p * 6);
      if (p < m - 1) { const v = p * 2; idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], p * 6); }
    }
    const g1 = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(pos, 3), ca = new THREE.BufferAttribute(col, 3);
    g1.setAttribute('position', pa); g1.setAttribute('color', ca); g1.setIndex(new THREE.BufferAttribute(idx, 1));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', pa); g2.setAttribute('color', ca); g2.setIndex(g1.index);
    const mat = (o) => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const faint = new THREE.Mesh(g1, mat(speedColor ? 0.5 : 0.28)), bright = new THREE.Mesh(g2, mat(0.95));
    faint.frustumCulled = bright.frustumCulled = false; faint.renderOrder = 4; bright.renderOrder = 5; g2.setDrawRange(0, 0);
    return { faint, bright, segs: m - 1, step };
  }

  function label(d, pos) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(8,12,22,.72)'; x.beginPath(); x.roundRect(2, 8, 252, 48, 24); x.fill();
    x.fillStyle = '#' + new THREE.Color(d.color).getHexString(); x.beginPath(); x.arc(30, 32, 11, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = '700 28px system-ui,sans-serif'; x.textBaseline = 'middle'; x.fillText(String(d.username || '?').slice(0, 12).toUpperCase(), 52, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    sp.renderOrder = 9; sp.position.set(0, 2.4, 0); return sp;
  }

  // ---------- interfaz ----------
  function ui() {
    if (el) return el;
    el = document.createElement('div'); el.id = 'replay'; el.className = 'rp hidden';
    el.innerHTML = `<div class="rp-flash"></div>
      <div class="rp-top"><button type="button" class="rp-x" data-rp="exit">‹ Salir</button><div class="rp-title"><b id="rpTitle"></b><small id="rpSub"></small></div><div class="rp-clock" id="rpClock">0:00.000</div></div>
      <div class="rp-tower" id="rpTower"></div>
      <div class="rp-bot"><div class="rp-scrub"><button type="button" class="rp-pl" data-rp="play" id="rpPlay">❚❚</button><input id="rpSeek" type="range" min="0" max="1000" value="0" aria-label="Línea de tiempo"></div>
      <div class="rp-row"><div class="rp-seg" id="rpCams"><button type="button" data-cam="auto" class="on">Cinemática</button><button type="button" data-cam="chase">Perseguir</button><button type="button" data-cam="heli">Aérea</button><button type="button" data-cam="cock">A bordo</button><button type="button" data-cam="top">Cenital</button></div>
      <div class="rp-seg" id="rpSpd"><button type="button" data-sp="0.5">½×</button><button type="button" data-sp="1" class="on">1×</button><button type="button" data-sp="2">2×</button></div><button type="button" class="rp-tr on" data-rp="trace" id="rpTrace">Trazadas</button><button type="button" class="rp-tr rp-sh" data-rp="share" id="rpShare">Compartir</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !R) return;
      if (b.dataset.rp === 'exit') return close();
      if (b.dataset.rp === 'play') { if (R.t >= R.maxT + 2) R.t = 0; R.playing = !R.playing; R.ended = false; return sync(); }
      if (b.dataset.rp === 'share') return share();
      if (b.dataset.rp === 'trace') { R.trace = !R.trace; b.classList.toggle('on', R.trace); return; }
      if (b.dataset.cam) { R.cam = b.dataset.cam; R.shot = null; [...$('rpCams').children].forEach((x) => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.sp) { R.speed = +b.dataset.sp; [...$('rpSpd').children].forEach((x) => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.drv != null) { R.focus = +b.dataset.drv; if (R.cam === 'auto') { R.cam = 'chase'; [...$('rpCams').children].forEach((x) => x.classList.toggle('on', x.dataset.cam === 'chase')); } R.shot = null; }
    });
    el.addEventListener('input', (e) => { if (e.target.id === 'rpSeek' && R) { R.t = (+e.target.value / 1000) * (R.maxT + 2); R.ended = false; } });
    return el;
  }
  const sync = () => { $('rpPlay').textContent = R.playing ? '❚❚' : (R.t >= R.maxT + 2 ? '↻' : '▶'); };

  // ---------- cámara ----------
  const SHOTS = [['chase', 'leader', 6], ['side', 'leader', 5], ['chase', 'battle', 6], ['heli', 'pack', 6], ['cock', 'leader', 5], ['side', 'battle', 5]];
  function pickFocus(rule, states, active) {
    let best = -1;
    if (rule === 'battle') { let bd = 1e9; active.forEach((i) => { active.forEach((j) => { if (i !== j) { const dd = Math.hypot(states[i].x - states[j].x, states[i].z - states[j].z); if (dd < bd) { bd = dd; best = i; } } }); }); if (best >= 0) return best; }
    let bc = -1; active.forEach((i) => { if (states[i].cum > bc) { bc = states[i].cum; best = i; } }); return best < 0 ? 0 : best;
  }
  function direct(dt, states, active) {
    const mode = R.cam; let type = mode, focus = R.focus;
    if (mode === 'auto') {
      if (!R.shot || R.t >= R.shot.until || !active.includes(R.shot.focus)) {
        const intro = R.t < 0.05 && !R.shot; const s = intro ? ['top', 'leader', 4] : SHOTS[R.shotN++ % SHOTS.length];
        R.shot = { type: s[0], rule: s[1], until: R.t + s[2], focus: pickFocus(s[1], states, active.length ? active : [0]), fresh: true };
        if (!intro && R.t > 0.1) flash();
      }
      type = R.shot.type; focus = R.shot.focus;
    } else if (mode !== 'top' && mode !== 'heli' && !active.includes(focus)) focus = pickFocus('leader', states, active.length ? active : [0]);
    const s = states[focus] || states[0], want = V, look = V2; let k = 6, fov = 62;
    if (type === 'chase') { want.set(s.x - s.fx * 8 + 0, s.y + 3.1, s.z - s.fz * 8); look.set(s.x + s.fx * 9, s.y + 0.9, s.z + s.fz * 9); fov = 64; k = 5; }
    else if (type === 'cock') { want.set(s.x + s.fx * 0.3, s.y + 1.25, s.z + s.fz * 0.3); look.set(s.x + s.fx * 14, s.y + 1.1, s.z + s.fz * 14); fov = 78; k = 14; }
    else if (type === 'side') {
      if (R.shot && R.shot.fresh || mode !== 'auto' && !R.sidePos) {
        const d = R.drivers[focus], ahead = pose(d, Math.min(d.T, R.t + 2.6), V3), side = (R.shotN % 2 ? 1 : -1) * 10;
        R.sidePos = new THREE.Vector3(ahead.x - ahead.fz * side, ahead.y + 1.7, ahead.z + ahead.fx * side);
      }
      want.copy(R.sidePos); look.set(s.x + s.fx * 2, s.y + 0.8, s.z + s.fz * 2); fov = 38; k = 40;
    } else if (type === 'heli') {
      let cx = 0, cz = 0, cy = 0, nn = 0; active.forEach((i) => { cx += states[i].x; cz += states[i].z; cy += states[i].y; nn++; }); nn = nn || 1; cx /= nn; cz /= nn; cy /= nn;
      const a = R.t * 0.22; want.set(cx + Math.sin(a) * 46, cy + 30, cz + Math.cos(a) * 46); look.set(cx, cy, cz); fov = 52; k = 2.2;
    } else { // cenital
      const b = R.box; want.set(b.cx, b.size * 0.95 + 20, b.cz + b.size * 0.12); look.set(b.cx, 0, b.cz); fov = 55; k = 3;
    }
    if (R.shot) R.shot.fresh = false;
    if (R.camInit && type === R.lastType) { const a = 1 - Math.exp(-dt * k); camera.position.lerp(want, a); R.look.lerp(look, 1 - Math.exp(-dt * Math.max(k, 6))); }
    else { camera.position.copy(want); R.look.copy(look); }
    R.camInit = true; R.lastType = type;
    camera.up.set(0, 1, 0); camera.lookAt(R.look);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
  }
  const flash = () => { const f = el.firstElementChild; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };

  // ---------- compartir: enlace para ver la repetición (WhatsApp o cualquier app) ----------
  async function share() {
    const uid = R.drivers.length === 1 ? R.drivers[0].user_id : null, url = baseUrl() + '?rp=' + R.league + '_' + R.day + '_' + (uid || 'all');
    const text = `${R.title} · mira la repetición en Daily Lapp`;
    try { if (navigator.share) { await navigator.share({ title: R.title, text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    waShare(text, url);
  }

  // ---------- abrir / cerrar ----------
  async function open({ day, drivers, title, onClose, league }) {
    if (R) close(true);
    const list = (drivers || []).filter((d) => d && Array.isArray(d.ghost) && d.ghost.length > 40);
    if (!list.length) { toast('Esa repetición ya no está disponible'); return false; }
    ui(); toast('Preparando repetición…');
    const tk = trackFor(day); if (!tk) { toast('No se pudo cargar el circuito'); return false; }
    try { await ensureModels([...new Map(list.map((d) => [d.car, carList.find((c) => c.id === d.car) || carList[0]])).values()]); } catch (e) { toast('No se pudo cargar un coche'); return false; }
    freeMenu();
    const solo = list.length === 1, world = buildWorld(tk.tr, tk.th, { mobile: MOBILE, shadows: !MOBILE && ctx.shadowsOn(), renderer, flagSvg: tk.flag });
    const ds = list.map((d, i) => prep(d, i, solo)), scene = world.scene;
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    ds.forEach((d, i) => {
      for (let k = 0; k < d.n; k += 8) { minx = Math.min(minx, d.g[k * 4]); maxx = Math.max(maxx, d.g[k * 4]); minz = Math.min(minz, d.g[k * 4 + 2]); maxz = Math.max(maxz, d.g[k * 4 + 2]); }
      const rb = ribbon(d, solo); d.rb = rb; scene.add(rb.faint, rb.bright);
      const ct = carList.find((c) => c.id === d.car) || carList[0];
      d.mesh = buildCar(d.solo ? 0xe8edf7 : d.color, ct.kind, 'lo', 2 + (i * 17) % 90); scene.add(d.mesh.root);
      if (ds.length > 1) { d.label = label(d, i); d.mesh.root.add(d.label); }
    });
    R = { league, title: title || 'Repetición', day, drivers: ds, tk, world, scene, th: tk.th, t: 0, maxT: Math.max(...ds.map((d) => d.T)), playing: true, ended: false, speed: 1, cam: 'auto', shot: null, shotN: 0, focus: 0, trace: true, look: new THREE.Vector3(), camInit: false, lastType: '', onClose, acc: 0,
      box: { cx: (minx + maxx) / 2, cz: (minz + maxz) / 2, size: Math.max(maxx - minx, maxz - minz, 80) }, st: ds.map(() => ({})) };
    $('rpTitle').textContent = title || 'Repetición'; $('rpSub').textContent = solo ? `@${ds[0].username} · ${fmtT(ds[0].ms / 1000)}` : `${ds.length} pilotos · vuelta rápida de cada uno`;
    el.classList.toggle('solo', solo); el.classList.remove('hidden'); document.body.classList.add('in-replay');
    $('rpCams').querySelector('[data-cam="auto"]').textContent = solo ? 'Cinemática' : 'Cinemática'; $('rpTrace').classList.add('on'); sync(); R.tick = 1e9;
    return true;
  }
  function close(silent) {
    if (!R) return; const r = R; R = null;
    try { disposeScene(r.scene); } catch (_) { /* nada */ }
    camera.fov = 65; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0);
    if (el) { el.classList.add('hidden'); } document.body.classList.remove('in-replay');
    if (!silent && r.onClose) r.onClose();
  }

  // ---------- cada fotograma ----------
  function frame(dt) {
    if (!R) return;
    if (R.playing) { R.t += dt * R.speed; if (R.t >= R.maxT + 2) { R.t = R.maxT + 2; R.playing = false; R.ended = true; sync(); } }
    const states = R.st, active = [];
    R.drivers.forEach((d, i) => {
      const s = pose(d, Math.min(R.t, d.T), states[i]), done = R.t > d.T + 0.4;
      d.mesh.root.visible = !done; d.mesh.root.position.set(s.x, s.y, s.z); d.mesh.root.rotation.y = s.psi;
      if (!done) { active.push(i); if (d.mesh.wheels) for (const w of d.mesh.wheels) w.spin.rotation.x += s.spd * dt * R.speed / 0.33; }
      const seg = Math.min(d.rb.segs, Math.floor(Math.min(R.t, d.T) * HZ / d.rb.step)); d.rb.bright.geometry.setDrawRange(0, seg * 6);
      d.rb.faint.visible = d.rb.bright.visible = R.trace;
      if (d.label) { const dist = camera.position.distanceTo(d.mesh.root.position); d.label.visible = !done && dist < 420; const sc = clamp(dist / 20, 1.1, 14); d.label.scale.set(3.6 * sc / 1.1 * 0.62, 0.9 * sc / 1.1 * 0.62, 1); }
    });
    direct(dt, states, active);
    R.world.sky.position.copy(camera.position); try { R.world.updateWind(dt); R.world.updateWeather(dt, camera.position.x, camera.position.y, camera.position.z); } catch (_) { /* nada */ }
    if (R.world.sun && R.world.sun.castShadow) { const s = states[R.focus] || states[0]; followSun(R.world, s.x, s.y, s.z); }
    $('rpClock').textContent = fmtT(Math.min(R.t, R.maxT));
    R.tick += dt; if (R.tick > 0.15) { R.tick = 0; tower(states); $('rpSeek').value = Math.round(R.t / (R.maxT + 2) * 1000); }
    if (camera.view && camera.view.enabled) camera.clearViewOffset();
    ps2View(R.th); renderer.render(R.scene, camera);
  }
  function tower(states) {
    const rows = R.drivers.map((d, i) => ({ d, i, s: states[i], done: R.t > d.T })).sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : a.done ? a.d.T - b.d.T : b.s.cum - a.s.cum));
    const lead = rows.find((r) => !r.done), ld = lead ? lead.s.cum : 0;
    $('rpTower').innerHTML = rows.map((r, n) => `<button type="button" class="rp-r${r.i === R.focus && R.cam !== 'auto' ? ' f' : ''}" data-drv="${r.i}"><i class="po">${n + 1}</i><i class="dot" style="background:#${new THREE.Color(r.d.color).getHexString()}"></i><b>${esc(r.d.username || '?')}</b><em>${r.done ? fmtT(r.d.ms / 1000) : (R.drivers.length > 1 ? (r === lead ? 'LÍDER' : '+' + Math.round(ld - r.s.cum) + ' m') : '') + `<small>${Math.round(r.s.spd * 3.6)} km/h</small>`}</em></button>`).join('');
  }

  return { open, close, frame, get active() { return !!R; } };
}
