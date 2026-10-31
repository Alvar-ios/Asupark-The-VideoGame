import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THEMES, THEME_LIST, dailyInfo } from './themes.js';
import { buildTrack, ROAD_HALF, WALL, wrapPi, pointAt } from './track.js';
import { CARS, GROUPS, AI_COLORS, makeCar, placeCar, stepCar, resetToTrack, gearInfo } from './car.js';
import { hashStr } from './rng.js';
import { buildSpeedProfile, aiInput, benchmark } from './ai.js';
import { buildWorld, disposeScene } from './world.js';
import { Sound } from './audio.js';
import { Leaderboard } from './leaderboard.js';
import { loadBora, buildBora, boraReady } from './bora.js';
import { loadPorsche, buildPorsche, porscheReady } from './porsche.js';
import { loadModelCar, buildModelCar, modelCarReady, MODEL } from './modelcars.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const LAPS = 3, H = 1 / 120, CS = 1; // Los modelos ya están preparados en escala aproximada real.
const MOBILE = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
document.body.classList.toggle('mobile', MOBILE);
const sound = new Sound();

// ---------- almacenamiento (puede no estar disponible) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('dr.' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('dr.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
};
const fmtS = (t) => (t == null ? '--' : t >= 60 ? fmt(t) : t.toFixed(3));
const fmt = (t) => { if (t == null || !isFinite(t)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const QUAL = { shadows: true };
function applyGfx() {
  const g = sel.gfx;
  pixelRatio = g === 'low' ? Math.min(BASE_PR, 0.75) : g === 'medium' ? Math.min(BASE_PR, 1.1) : BASE_PR;
  setShadows(g === 'low' ? false : true); resize();
}
function setShadows(on) {
  QUAL.shadows = on; renderer.shadowMap.enabled = on;
  if (S.scene) S.scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = on; if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
}
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const BASE_PR = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.75 : 2);
let pixelRatio = BASE_PR;
renderer.setPixelRatio(pixelRatio);
const camera = new THREE.PerspectiveCamera(65, 1, 0.5, 4000);
camera.up.set(0, 1, 0);
function resize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- pistas ----------
const tracks = [];
function addTrack(key, name, sub, seed, style, th) { const tr = buildTrack(seed, style); tracks.push({ key, name, sub, tr, th }); }
const daily = dailyInfo();
addTrack('pruebas', THEMES.pruebas.name, THEMES.pruebas.sub, THEMES.pruebas.seed, THEMES.pruebas.style, THEMES.pruebas);
addTrack('monaco', THEMES.monaco.name, THEMES.monaco.sub, THEMES.monaco.seed, THEMES.monaco.style, THEMES.monaco);
addTrack('spa', THEMES.spa.name, THEMES.spa.sub, THEMES.spa.seed, THEMES.spa.style, THEMES.spa);
addTrack('daily', daily.name, daily.sub, daily.seed, daily.style, daily.theme);
for (const k of THEME_LIST) if (k !== 'pruebas' && k !== 'monaco' && k !== 'spa') addTrack(k, THEMES[k].name, THEMES[k].sub, THEMES[k].seed, THEMES[k].style, THEMES[k]);

const DEFAULT_CAR = Math.max(0, CARS.findIndex((car) => car.id === 'porsche'));
const sel = { track: Math.max(0, tracks.findIndex((t) => t.key === 'daily')), mode: 'tt', diff: 1, car: DEFAULT_CAR, autoGas: false, colors: {}, vol: { master: 1, music: 0.7, engine: 0.65 }, gfx: 'auto' };
const paintOf = (c) => { const v = sel.colors[c.id]; if (v && c.paints && c.paints.some((p) => p[1].toLowerCase() === String(v).toLowerCase())) return v; return '#' + new THREE.Color(c.color).getHexString(); };
const saved = store.get('sel'); if (saved) { const savedCar = saved.carId ? CARS.findIndex((car) => car.id === saved.carId) : -1; sel.car = savedCar >= 0 ? savedCar : (saved.car === 0 ? DEFAULT_CAR : clamp(saved.car | 0, 0, CARS.length - 1)); sel.diff = clamp(saved.diff | 0, 0, 2); if (saved.mode) sel.mode = saved.mode; if (saved.track < tracks.length) sel.track = saved.track | 0; sel.autoGas = !!saved.autoGas; sel.mute = !!saved.mute; sel.colors = saved.colors || {}; }
if (saved) { sel.raceMusic = !!saved.raceMusic; if (saved.vol) sel.vol = { ...sel.vol, ...saved.vol }; if (['auto', 'high', 'medium', 'low'].includes(saved.gfx)) sel.gfx = saved.gfx; }

// ----- banderas (SVG propio: los emojis de bandera no se ven en Windows) -----
const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; return (cx + k * Math.cos(a)).toFixed(2) + ',' + (cy + k * Math.sin(a)).toFixed(2); }).join(' ');
const FLAGS = {
  es: '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>',
  mc: '<rect width="30" height="10" fill="#ce1126"/><rect y="10" width="30" height="10" fill="#f4f4f4"/>',
  be: '<rect width="10" height="20" fill="#1b1b1b"/><rect x="10" width="10" height="20" fill="#fdda24"/><rect x="20" width="10" height="20" fill="#ef3340"/>',
  at: '<rect width="30" height="20" fill="#ed2939"/><rect y="6.67" width="30" height="6.67" fill="#f4f4f4"/>',
  ma: '<rect width="30" height="20" fill="#c1272d"/><polygon points="' + starPts(15, 10.4, 5.6, 2.2) + '" fill="none" stroke="#006233" stroke-width="1.1"/>',
  jp: '<rect width="30" height="20" fill="#f4f4f4"/><circle cx="15" cy="10" r="5.6" fill="#bc002d"/>',
  ch: '<rect width="30" height="20" fill="#da291c"/><rect x="13" y="4" width="4" height="12" fill="#f4f4f4"/><rect x="9" y="8" width="12" height="4" fill="#f4f4f4"/>',
};
const flagSvg = (c) => `<svg viewBox="0 0 30 20" aria-hidden="true">${FLAGS[c] || FLAGS.es}</svg>`;
const COUNTRY = { pruebas: ['es', 'España'], monaco: ['mc', 'Mónaco'], spa: ['be', 'Bélgica'], valle: ['at', 'Austria'], desierto: ['ma', 'Marruecos'], neon: ['jp', 'Japón'], nieve: ['ch', 'Suiza'] };
const countryOf = (t) => COUNTRY[t.th.id] || COUNTRY[t.key] || COUNTRY.pruebas;
function drawPreview(cv, tr, th) {
  const w = 300, h = 130, dpr = Math.min(window.devicePixelRatio || 1, 2), x = cv.getContext('2d');
  cv.width = w * dpr; cv.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (let i = 0; i < tr.N; i += 4) { mnx = Math.min(mnx, tr.X[i]); mxx = Math.max(mxx, tr.X[i]); mnz = Math.min(mnz, tr.Z[i]); mxz = Math.max(mxz, tr.Z[i]); }
  const sc = Math.min((w - 24) / (mxx - mnx), (h - 24) / (mxz - mnz));
  const ox = (w - (mxx - mnx) * sc) / 2 - mnx * sc, oz = (h - (mxz - mnz) * sc) / 2 - mnz * sc;
  x.lineJoin = x.lineCap = 'round';
  const path = () => { x.beginPath(); for (let i = 0; i < tr.N; i += 3) { const px = tr.X[i] * sc + ox, pz = tr.Z[i] * sc + oz; i ? x.lineTo(px, pz) : x.moveTo(px, pz); } x.closePath(); };
  x.strokeStyle = '#000'; x.lineWidth = 9; path(); x.stroke();
  x.strokeStyle = '#' + new THREE.Color(th.night ? th.kerb1 : th.road).lerp(new THREE.Color(0xffffff), 0.55).getHexString(); x.lineWidth = 6; path(); x.stroke();
  x.fillStyle = '#ffc928'; x.beginPath(); x.arc(tr.X[0] * sc + ox, tr.Z[0] * sc + oz, 4.5, 0, 7); x.fill();
  for (const r of tr.ramps) { const i = Math.floor(r.s0) % tr.N; x.fillStyle = '#ff8a00'; x.fillRect(tr.X[i] * sc + ox - 3, tr.Z[i] * sc + oz - 3, 6, 6); }
}

const groupOf = (c) => GROUPS.find((g) => g.id === c.group) || GROUPS[1];
const envLabel = (t) => (t.th.weather === 'rain' ? 'lluvia' : t.th.surface === 'snow' ? 'nieve' : t.th.surface === 'dirt' ? 'tierra' : 'asfalto seco');
const narrowMenu = () => window.innerWidth <= 760;
function setView(v) {
  $('menu').dataset.view = v;
  $('flyout').hidden = v === 'home';
  $('viewTracks').hidden = v !== 'tracks'; $('viewGarage').hidden = v !== 'garage';
  $('flyTitle').textContent = v === 'garage' ? 'Coche' : 'Circuito';
  $('pickTrack').classList.toggle('on', v === 'tracks'); $('pickCar').classList.toggle('on', v === 'garage');
  $('flyout').scrollTop = 0; $('menu').querySelector('.menu-scroll').scrollTop = 0;
}
$('pickTrack').onclick = () => setView($('menu').dataset.view === 'tracks' ? 'home' : 'tracks');
$('pickCar').onclick = () => { if ($('menu').dataset.view === 'garage') { setView('home'); return; } sel.group = groupOf(CARS[sel.car]).id; buildMenu(); setView('garage'); };
$('flyClose').onclick = () => setView('home');
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && S.state === 'menu' && $('menu').dataset.view !== 'home') { setView('home'); e.stopPropagation(); } }, true);
function buildMenu() {
  { const t0 = tracks[sel.track], c0 = CARS[sel.car]; if (!sel.group) sel.group = groupOf(c0).id;
    $('pickTrackName').textContent = t0.key === 'daily' ? 'Pista del día' : t0.name; $('pickTrackSub').textContent = `${countryOf(t0)[1]} · ${(t0.tr.len / 1000).toFixed(1)} km · ${envLabel(t0)}`; $('pickTrackFlag').innerHTML = flagSvg(countryOf(t0)[0]);
    $('pickCarName').textContent = c0.name; $('pickCarSub').textContent = groupOf(c0).name; $('pickCarImg').src = `./assets/thumbs/${c0.id}.webp`; }
  const tl = $('trackList'); tl.innerHTML = '';
  const dailyTrack = tracks.find((t) => t.key === 'daily');
  tracks.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'card track-card' + (i === sel.track ? ' on' : '');
    const environment = t.th.weather === 'rain' ? ['rain', 'Lluvia'] : t.th.surface === 'snow' ? ['snow', 'Nieve'] : t.th.surface === 'dirt' ? ['dirt', 'Tierra'] : ['dry', 'Asfalto seco'];
    let best = null; for (const cc of CARS) { const r = store.get('pb.' + t.key + '.' + t.tr.seed + '.' + cc.id); if (r && r.lap != null && (!best || r.lap < best.lap)) best = { ...r, car: cc }; }
    const [cc, cname] = countryOf(t), st = streakInfo();
    d.innerHTML = `<div class="tc-head"><span class="flag">${flagSvg(cc)}</span><span class="cty">${cname}</span><span class="tc-len">${(t.tr.len / 1000).toFixed(1)} km</span></div><canvas></canvas><b>${t.name}</b><small class="track-sub">${t.sub}</small><div class="tc-foot"><span class="track-env ${environment[0]}">${environment[1]}</span>${t.key === 'daily' ? `<span class="tag-daily">${st.done ? 'Hecho hoy' : st.n ? 'Racha ' + st.n + ' d' : 'Reto de hoy'}</span>` : ''}</div><div class="rec">${best ? medalTag(best.lap, (benchFor(t, best.car) || {}).lap) + 'Mejor ' + fmt(best.lap) + ' · ' + best.car.name.split(' ')[0] : '&nbsp;'}</div>`;
    drawPreview(d.querySelector('canvas'), t.tr, t.th);
    d.onclick = () => { sel.track = i; sel.carId = CARS[sel.car].id; store.set('sel', sel); buildMenu(); if (narrowMenu()) setView('home'); };
    tl.appendChild(d);
  });
  const gt = $('groupTabs'); gt.innerHTML = '';
  for (const g of GROUPS) { const b = document.createElement('button'); b.type = 'button'; b.textContent = g.name; b.className = g.id === sel.group ? 'on' : ''; b.onclick = () => { sel.group = g.id; buildMenu(); }; gt.appendChild(b); }
  const cl = $('carList'); cl.innerHTML = '';
  CARS.forEach((c, i) => {
    if (c.group !== sel.group) return;
    const d = document.createElement('div'); d.className = 'card car-card' + (i === sel.car ? ' on' : '');
    const hex = new THREE.Color(paintOf(c)).lerp(new THREE.Color(0xffffff), 0.32).getStyle();
    d.innerHTML = `<img class="cthumb" src="./assets/thumbs/${c.id}.webp" alt=""><em class="brand">${c.brand || ''}</em><b style="color:${hex}">${c.name}</b><small>${c.desc}</small>` + [['VEL', (c.vmax - 44) / 32], ['ACEL', (c.accel - 11) / 11], ['GIRO', (c.yaw - 1.9) / 1.3], ['DESLIZ.', (15 - c.grip) / 5]].map(([n, v]) => `<div class="stat">${n}<i><s style="width:${clamp(v, 0.1, 1) * 100}%;background:${hex}"></s></i></div>`).join('');
    d.querySelector('img').onerror = (e) => { e.target.style.display = 'none'; };
    d.onclick = () => { sel.car = i; sel.carId = c.id; store.set('sel', sel); buildMenu(); };
    cl.appendChild(d);
  });
  if (!cl.children.length) cl.innerHTML = '<p class="soon">Próximamente: nuevos coches en este grupo.</p>';
  $('diffWrap').style.display = sel.mode === 'race' ? '' : 'none';
  for (const b of $('modeSel').children) b.classList.toggle('on', b.dataset.v === sel.mode);
  for (const b of $('diffSel').children) b.classList.toggle('on', +b.dataset.v === sel.diff);
  buildPaints(); sound.setMuted(!!sel.mute); $('sndBtn').classList.toggle('on', !sel.mute); $('sndBtn').textContent = 'Sonido: ' + (sel.mute ? 'NO' : 'SÍ');
  $('raceMusicBtn').classList.toggle('on', !!sel.raceMusic); $('raceMusicBtn').textContent = 'Música al conducir: ' + (sel.raceMusic ? 'SÍ' : 'NO');
  $('autoGas').classList.toggle('on', sel.autoGas); $('autoGas').textContent = 'Acelerador automático: ' + (sel.autoGas ? 'SÍ' : 'NO');
}
$('raceMusicBtn').onclick = () => { sel.raceMusic = !sel.raceMusic; store.set('sel', sel); buildMenu(); };
$('sndBtn').onclick = () => { sel.mute = !sel.mute; store.set('sel', sel); buildMenu(); };
function buildPaints() {
  const box = $('paints'); box.innerHTML = '';
  const car = CARS[sel.car], cur = paintOf(car).toLowerCase();
  if (car.nopaint || !car.paints) { $('paintName').textContent = 'Librea original'; return; }
  car.paints.forEach(([n, hex]) => { const b = document.createElement('button'); b.className = 'sw' + (hex.toLowerCase() === cur ? ' on' : ''); b.style.background = hex; b.title = n; b.setAttribute('aria-label', n); b.onclick = () => { sel.colors[car.id] = hex; store.set('sel', sel); buildMenu(); }; box.appendChild(b); });
  $('paintName').textContent = (car.paints.find((p) => p[1].toLowerCase() === cur) || car.paints[0])[0];
}
$('autoGas').onclick = () => { sel.autoGas = !sel.autoGas; buildMenu(); };
$('fsBtn').onclick = () => { try { const e = document.documentElement; (e.requestFullscreen || e.webkitRequestFullscreen).call(e); } catch (_) {} try { screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} };
$('modeSel').onclick = (e) => { if (e.target.dataset.v) { sel.mode = e.target.dataset.v; buildMenu(); } };
$('diffSel').onclick = (e) => { if (e.target.dataset.v) { sel.diff = +e.target.dataset.v; buildMenu(); } };

// ---------- modelos de coche ----------
function buildCarMesh(color, kind, lod = 'lo') {
  let b;
  if (MODEL[kind]) {
    if (!modelCarReady(kind, lod)) throw new Error(`El modelo ${kind} (${lod}) no est? cargado`);
    b = buildModelCar(kind, color, lod);
  } else if (kind === 'porsche') {
    if (!porscheReady(lod)) throw new Error(`El modelo Porsche (${lod}) no est? cargado`);
    b = buildPorsche(color, lod);
  } else if (kind === 'bora') {
    if (!boraReady(lod)) throw new Error(`El modelo VW Bora (${lod}) no est? cargado`);
    b = buildBora(color, lod);
  } else throw new Error(`No existe un modelo real para ${kind}`);
  b.root.scale.setScalar(CS * (kind === 'bora' ? 0.97 : 0.98));
  return b;
}

// fantasma: una sola silueta translúcida. Un pase previo escribe la profundidad sin pintar y el pase de color solo pinta la superficie más cercana,
// así no se transparenta el interior (asientos, motor, cristales) de ningún modelo.
function makeGhost(root) {
  const color = new THREE.MeshLambertMaterial({ color: 0xbfe4ff, emissive: 0x2a4a66, transparent: true, opacity: 0.4, depthWrite: false });
  const pre = new THREE.MeshBasicMaterial({ colorWrite: false });
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    o.castShadow = false; o.receiveShadow = false;
    const d = new THREE.Mesh(o.geometry, pre); d.renderOrder = 1; d.castShadow = false; d.position.copy(o.position); d.quaternion.copy(o.quaternion); d.scale.copy(o.scale); o.parent.add(d);
    o.material = color; o.renderOrder = 2;
  }
}

// ---------- partículas ----------
class Particles {
  constructor(scene, max = MOBILE ? 260 : 600) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { k: { value: 600 } },
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float k; void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize = size*k/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.12,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC,a); }',
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
    for (let k = 0; k < max; k++) { this.life[k] = 0; this.pos[k * 3 + 1] = -999; }
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 0.6, drag = 1.5, grav = 0) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.life[k] = this.maxLife[k] = life; this.s0[k] = s0; this.s1[k] = s1; this.col[k * 3] = r; this.col[k * 3 + 1] = g; this.col[k * 3 + 2] = b; this.a0[k] = a; this.drag[k] = drag; this.grav[k] = grav;
  }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; this.size[k] = 0; continue; }
      this.life[k] -= dt;
      const t = 1 - this.life[k] / this.maxLife[k], dm = Math.exp(-this.drag[k] * dt);
      this.vel[k * 3] *= dm; this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * dm - this.grav[k] * dt; this.vel[k * 3 + 2] *= dm;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.size[k] = lerp(this.s0[k], this.s1[k], t); this.alpha[k] = this.a0[k] * (1 - t) * (t < 0.1 ? t * 10 : 1);
    }
    const g = this.pts.geometry;
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
  }
}

// ---------- estado de la carrera ----------
const S = {
  state: 'menu', trackInfo: null, tr: null, th: null, world: null, scene: null, cars: [], player: null, prof: {}, acc: 0, t: 0, cd: 0, lastCount: 4,
  shake: 0, camKick: 0, camYaw: 0, camY: 0, camMode: 0, particles: null, skid: null, skidI: 0, mini: null, ghostMesh: null, ghostRec: [], ghostBest: null, bestLap: null, finishOrder: [], msgT: 0, wrongT: 0, step: 0, flash: 0, raceNo: 0,
};
const input = { keys: new Set(), touch: { l: 0, r: 0, g: 0, b: 0, d: 0 } };
const inp = { steer: 0, throttle: 0, brake: 0, drift: false };
const tmpP = { x: 0, y: 0, z: 0, tx: 0, tz: 1 };

function clearRace() {
  if (S.scene) { disposeScene(S.scene); S.scene = null; }
  S.cars = []; S.player = null; S.particles = null; S.skid = null; S.ghostMesh = null; S.world = null; S.raceScene = false;
}
// ----- escenario vivo del menú: la pista elegida con el coche girando -----
const _sunV = new THREE.Vector3();
function followSun(world, x, y, z) {
  const sun = world && world.sun; if (!sun || !sun.castShadow) return;
  sun.target.position.set(x, y, z); sun.position.copy(sun.userData.dir).multiplyScalar(110).add(sun.target.position);
  sun.target.updateMatrixWorld();
}

// ----- medallas, racha diaria y clasificación (local; preparado para sustituir por servidor) -----
const todayKey = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const yesterdayKey = () => { const d = new Date(Date.now() - 864e5); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
function medalFor(t, bench) { if (t == null || !bench) return ''; const r = t / bench; return r <= 1.05 ? 'ORO' : r <= 1.12 ? 'PLATA' : r <= 1.25 ? 'BRONCE' : ''; }
const medalTag = (t, bench) => { const m = medalFor(t, bench); return m ? `<span class="medal ${m.toLowerCase()}">${m}</span>` : ''; };
function streakInfo() { const st = store.get('streak') || { last: null, n: 0 }; if (st.last !== todayKey() && st.last !== yesterdayKey()) return { n: 0, done: false }; return { n: st.n, done: st.last === todayKey() }; }
function markDaily() {
  if (S.trackInfo.key !== 'daily') return;
  const st = store.get('streak') || { last: null, n: 0 }, t = todayKey();
  if (st.last === t) return;
  store.set('streak', { last: t, n: st.last === yesterdayKey() ? st.n + 1 : 1 });
  showMsg('Reto diario completado', 1800, 'cy');
}
const lb = new Leaderboard();
const trackIdOf = (ti) => (ti.key === 'daily' ? 'daily:' + ti.tr.seed : ti.key);
const carName = (id) => (CARS.find((c) => c.id === id) || { name: id }).name;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const groupIdOfCar = (id) => { const c = CARS.find((x) => x.id === id); return c ? c.group : 'otros'; };
const groupName = (id) => (GROUPS.find((g) => g.id === id) || { name: 'Otros' }).name;
// tus mejores tiempos guardados en este dispositivo, por coche
function localRows(ti) {
  const rows = [];
  for (const c of CARS) { const r = store.get('pb.' + ti.key + '.' + ti.tr.seed + '.' + c.id); if (r && r.lap != null) rows.push({ key: 'yo', name: lb.name, carId: c.id, ms: Math.round(r.lap * 1000), you: true }); }
  return rows;
}
// mejor tiempo de cada piloto dentro del conjunto filtrado
function rankRows(rows, pred) {
  const seen = new Set(), out = [];
  for (const r of rows.filter(pred).sort((a, b) => a.ms - b.ms)) { if (seen.has(r.key)) continue; seen.add(r.key); out.push({ ...r }); }
  out.forEach((r, i) => { r.rank = i + 1; }); return out;
}
const boardRow = (r) => `<tr class="${r.you ? 'me' : ''}"><td>${r.rank}º</td><td>${esc(r.name)}</td><td class="car">${esc(carName(r.carId))}</td><td>${fmt(r.ms / 1000)}</td></tr>`;
async function getRows(ti) {
  const res = await lb.all(trackIdOf(ti));
  if (!res.remote || res.error) return { rows: localRows(ti), online: false, error: !!res.error };
  return { rows: res.rows, online: true };
}
const topWithMe = (list, n) => list.filter((r) => r.rank <= n || r.you);
const benchFor = (ti, type) => benchmark(ti.tr, type, ti.th, ti.key + '.' + ti.tr.seed + '.' + type.id);

// Cargar modelos reales antes de empezar; un error de red nunca se convierte en un coche genérico.
function loadCarAsset(type, player) {
  const lods = player && !MOBILE ? ['hi', 'lo'] : ['lo'];
  if (MODEL[type.kind]) return loadModelCar(type.kind, lods);
  if (type.kind === 'porsche') return loadPorsche(lods);
  if (type.kind === 'bora') return loadBora(lods);
  return Promise.reject(new Error(`No hay un modelo real registrado para ${type.name}`));
}
function carAssetReady(type, lod) {
  if (MODEL[type.kind]) return modelCarReady(type.kind, lod);
  if (type.kind === 'porsche') return porscheReady(lod);
  if (type.kind === 'bora') return boraReady(lod);
  return false;
}
async function ensureModels(types, playerType) {
  const unique = [...new Map(types.map((type) => [type.id, type])).values()];
  await Promise.all(unique.map((type) => loadCarAsset(type, type === playerType)));
  for (const type of unique) {
    const required = type === playerType && !MOBILE ? ['hi', 'lo'] : ['lo'];
    for (const lod of required) if (!carAssetReady(type, lod)) throw new Error(`No se pudo preparar el modelo ${type.name}`);
  }
}
async function startRace(restart = false) {
  sound.init(CARS[sel.car].id);
  const button = $('startBtn'), previousLabel = button.textContent, status = $('modelStatus');
  button.disabled = true; button.textContent = 'CARGANDO COCHES…'; status.hidden = true;
  const pt = CARS[sel.car], pool = CARS.filter((_, i) => i !== sel.car);
  const need = [pt, ...(sel.mode === 'race' ? pool.slice(0, 3) : [])];
  try { await ensureModels(need, pt); }
  catch (e) {
    console.error('No se pudo cargar un modelo de coche', e);
    status.textContent = `No se inició la carrera: no se pudo cargar ${e.message.replace(/^.*modelo /i, '')}. Revisa la conexión y vuelve a intentarlo.`;
    status.hidden = false; button.disabled = false; button.textContent = previousLabel; return;
  }
  button.disabled = false; button.textContent = previousLabel;
  menuWorldFree();
  const ti = tracks[sel.track], tr = ti.tr, type = CARS[sel.car];
  const sig = [sel.track, sel.car, sel.mode, sel.diff].join('|');
  const reuse = !!(restart && S.raceScene && S.sig === sig && S.scene);
  S.trackInfo = ti; S.tr = tr; S.th = ti.th;
  const weatherName = { rain: 'LLUVIA · PISTA MOJADA', snow: 'NIEVE · BAJA ADHERENCIA', dust: 'TIERRA · POLVO', dirt: 'TIERRA · POLVO', clear: 'ASFALTO · SECO' };
  $('weatherLabel').textContent = weatherName[ti.th.weather || ti.th.surface] || 'ASFALTO · SECO';
  $('weatherBadge').className = ti.th.weather || ti.th.surface || '';
  store.set('sel', sel);
  if (!reuse) {
    clearRace();
    const world = buildWorld(tr, ti.th, { mobile: MOBILE, shadows: QUAL.shadows, renderer }); S.world = world; S.scene = world.scene;
    const scene = S.scene;
    S.prof = {}; for (const c of CARS) S.prof[c.id] = buildSpeedProfile(tr, c);
    S.particles = new Particles(scene);
    const sg = new THREE.PlaneGeometry(0.34, 1.45, 1, 1).rotateX(-Math.PI / 2);
    S.skidN = MOBILE ? 300 : 900;
    const markColor = ti.th.weather === 'rain' ? 0x202d39 : ti.th.surface === 'snow' ? 0x71859a : ti.th.surface === 'dirt' ? 0x765238 : 0x14171b;
    const tread = document.createElement('canvas'); tread.width = 64; tread.height = 128;
    const tx = tread.getContext('2d');
    const fade = tx.createLinearGradient(0, 0, 64, 0);
    fade.addColorStop(0, 'rgba(255,255,255,0)'); fade.addColorStop(0.16, 'rgba(255,255,255,.42)'); fade.addColorStop(0.5, 'rgba(255,255,255,.72)'); fade.addColorStop(0.84, 'rgba(255,255,255,.42)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
    const ends = tx.createLinearGradient(0, 0, 0, 128);
    ends.addColorStop(0, 'rgba(255,255,255,0)'); ends.addColorStop(0.12, '#fff'); ends.addColorStop(0.88, '#fff'); ends.addColorStop(1, 'rgba(255,255,255,0)');
    tx.fillStyle = ends; tx.fillRect(0, 0, 64, 128); tx.globalCompositeOperation = 'destination-in'; tx.fillStyle = fade; tx.fillRect(0, 0, 64, 128);
    const treadTex = new THREE.CanvasTexture(tread); treadTex.colorSpace = THREE.SRGBColorSpace;
    S.skid = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: treadTex, color: markColor, transparent: true, opacity: ti.th.weather === 'rain' ? 0.54 : 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), S.skidN);
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < S.skidN; i++) S.skid.setMatrixAt(i, z);
    S.skid.frustumCulled = false; scene.add(S.skid); S.skidI = 0;
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bx = bc.getContext('2d');
    const gr = bx.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); bx.fillStyle = gr; bx.fillRect(0, 0, 64, 64);
    const blobTex = new THREE.CanvasTexture(bc), blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mkCar = (ct, color, name, isPlayer) => {
      const c = makeCar(ct, name, isPlayer);
      c.color = color; c.mesh = buildCarMesh(color, ct.kind, isPlayer ? (MOBILE ? 'lo' : 'hi') : 'lo'); scene.add(c.mesh.root);
      c.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      c.blob.scale.set(3.6 * CS, 1, 5.4 * CS); scene.add(c.blob);
      return c;
    };
    const player = mkCar(type, paintOf(type), 'TÚ', true);
    S.player = player; S.cars = [player];
    if (sel.mode === 'race') {
      const gi = (c) => GROUPS.findIndex((g) => g.id === c.group), pg = gi(CARS[sel.car]), pool = CARS.filter((_, i) => i !== sel.car).sort((a, b) => Math.abs(gi(a) - pg) - Math.abs(gi(b) - pg)), rivals = [pool[0], pool[1], pool[2]];
      const base = [0.955, 0.94, 0.925], diff = [0.88, 0.95, 1.01][sel.diff], names = ['Nova', 'Rayo', 'Duna'];
      rivals.forEach((rt, i) => { const c = mkCar(rt, AI_COLORS[i], names[i], false); c.ai = { lane: [-3, 3, -1.5][i], skill: base[i] * diff, base: base[i] * diff }; S.cars.push(c); });
    } else {
      S.ghostMesh = buildCarMesh(0xffffff, type.kind, 'lo'); makeGhost(S.ghostMesh.root);
      S.ghostMesh.root.visible = false; scene.add(S.ghostMesh.root);
    }
    // minimapa
    const mc = document.createElement('canvas'); mc.width = mc.height = 300; const mx = mc.getContext('2d');
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (let i = 0; i < tr.N; i += 4) { mnx = Math.min(mnx, tr.X[i]); mxx = Math.max(mxx, tr.X[i]); mnz = Math.min(mnz, tr.Z[i]); mxz = Math.max(mxz, tr.Z[i]); }
    const sc = Math.min(260 / (mxx - mnx), 260 / (mxz - mnz)), ox = (300 - (mxx - mnx) * sc) / 2 - mnx * sc, oz = (300 - (mxz - mnz) * sc) / 2 - mnz * sc;
    mx.lineJoin = mx.lineCap = 'round';
    const path = () => { mx.beginPath(); for (let i = 0; i < tr.N; i += 3) { const px = tr.X[i] * sc + ox, pz = tr.Z[i] * sc + oz; i ? mx.lineTo(px, pz) : mx.moveTo(px, pz); } mx.closePath(); };
    mx.strokeStyle = 'rgba(0,0,0,.7)'; mx.lineWidth = 12; path(); mx.stroke(); mx.strokeStyle = 'rgba(255,255,255,.85)'; mx.lineWidth = 6; path(); mx.stroke();
    mx.fillStyle = '#ffc928'; mx.fillRect(tr.X[0] * sc + ox - 5, tr.Z[0] * sc + oz - 5, 10, 10);
    for (const f of [1 / 3, 2 / 3]) { const i = Math.floor(tr.N * f); mx.fillStyle = '#66e8ff'; mx.fillRect(tr.X[i] * sc + ox - 4, tr.Z[i] * sc + oz - 4, 8, 8); }
    S.mini = { cv: mc, sc, ox, oz };
    S.sig = sig; S.raceScene = true;
  }
  // ---- colocar coches y reiniciar estado ----
  const player = S.player;
  S.finishOrder = []; S.t = 0; S.acc = 0; S.lastCount = 9; S.msgT = 0; S.wrongT = 0; S.step = 0; S.shake = 0; S.camKick = 0; S.lapInvalid = false;
  if (sel.mode === 'race') {
    const grid = [[-7, -3.4], [-7, 3.4], [-18, -3.4], [-18, 3.4]], slots = [grid[0], grid[1], grid[3]];
    placeCar(player, tr, grid[2][0], grid[2][1], 0);
    for (let i = 1; i < S.cars.length; i++) { const c = S.cars[i]; c.ai.skill = c.ai.base; placeCar(c, tr, slots[i - 1][0], slots[i - 1][1], 0); }
    S.ghostBest = null;
  } else {
    placeCar(player, tr, 2, 0, 0);
    const rec = store.get('best.' + ti.key + '.' + tr.seed + '.' + type.id);
    S.ghostBest = rec && rec.ghost ? Float32Array.from(rec.ghost) : null;
    if (S.ghostMesh) S.ghostMesh.root.visible = false;
  }
  S.ghostRec = [];
  const skey = ti.key + '.' + tr.seed + '.' + type.id;
  S.skey = skey;
  const bench = benchFor(ti, type); S.bench = bench;
  const pb = store.get('pb.' + skey);
  S.pbRec = pb && Array.isArray(pb.sec) ? pb : { lap: null, sec: [null, null, null], prof: null };
  S.lapPB = S.pbRec.lap; S.secPB = S.pbRec.sec.slice();
  S.bestLap = sel.mode === 'tt' ? S.lapPB : null;
  computeRecords(ti, type, bench);
  S.refProf = S.pbRec.prof && S.pbRec.prof.length ? S.pbRec.prof : bench ? bench.prof : null; S.refFill = fillProf(S.refProf); S.deltaS = null;
  S.refName = S.pbRec.prof && S.pbRec.prof.length ? 'PB' : 'RÉCORD';
  S.curProf = new Float32Array(Math.ceil(tr.len / 10) + 2).fill(-1);
  S.secIdx = -1; S.secStart = 0; S.secInvalid = false;
  for (let k = 0; k < 3; k++) { const e = $('s' + k); e.className = 'sec'; e.lastElementChild.textContent = '--'; }
  document.body.classList.toggle('tt', sel.mode === 'tt'); $('h-rec').style.display = sel.mode === 'tt' ? '' : 'none'; $('endBtn').style.display = sel.mode === 'tt' ? '' : 'none';
  for (const c of S.cars) { c.lapStart = 0; c.lapsDone = 0; c.finished = false; c.bestLap = null; c.bounce = 0; c.bounceV = 0; c.visPitch = 0; c.visRoll = 0; c.impact = 0; c.impactSide = 0; }
  S.camYaw = player.psi; S.camY = player.y + 3; S.fovT = 0;
  S.cd = 3.6; S.state = 'countdown'; S.raceNo++;
  $('menu').classList.add('hidden'); $('results').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('pbtn').classList.remove('hidden'); $('rbtn').classList.remove('hidden'); document.body.classList.add('racing');
  if (MOBILE) $('touch').classList.remove('hidden');
  $('delta').textContent = ''; $('msg').className = ''; setLights(0);
  $('help').style.opacity = 1; clearTimeout(S.helpT); S.helpT = setTimeout(() => { $('help').style.opacity = 0; }, 9000);
  $('pos').nextElementSibling.textContent = '/' + S.cars.length;
  $('h-pos').style.display = sel.mode === 'race' ? '' : 'none';
  updateCamera(0, true);
}
function setLights(n) { const l = $('lights').children; for (let i = 0; i < l.length; i++) l[i].classList.toggle('on', i < n); $('lights').classList.toggle('hidden', n < 0); }

// ---------- entrada ----------
const KEYMAP = { ArrowLeft: 1, KeyA: 1, ArrowRight: 1, KeyD: 1, ArrowUp: 1, KeyW: 1, ArrowDown: 1, KeyS: 1, Space: 1 };
window.addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { if (e.code === 'Enter') e.target.blur(); return; }
  if (KEYMAP[e.code] || e.code === 'Escape' || e.code === 'KeyR' || e.code === 'KeyC') e.preventDefault();
  if (e.repeat) return;
  input.keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (S.state === 'racing')) doReset();
  if (e.code === 'KeyC') S.camMode = (S.camMode + 1) % 2;
  if (e.code === 'KeyT' && S.raceScene && S.state !== 'menu') startRace(true);
  if (e.code === 'KeyM') { sel.mute = !sel.mute; sound.setMuted(sel.mute); store.set('sel', sel); showMsg(sel.mute ? 'Sonido desactivado' : 'Sonido activado', 900, 'cy'); }
  if (e.code === 'Enter' && S.state === 'menu') $('startBtn').click();
  sound.init(CARS[sel.car].id);
});
window.addEventListener('keyup', (e) => { if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return; input.keys.delete(e.code); });
window.addEventListener('blur', () => { input.keys.clear(); if (S.state === 'racing') togglePause(true); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
// botones táctiles
const holdBtn = (id, key) => {
  const el = $(id);
  const on = (e) => { e.preventDefault(); input.touch[key] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) {} sound.init(CARS[sel.car].id); };
  const off = () => { input.touch[key] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
};
holdBtn('tG', 'g'); holdBtn('tB', 'b'); holdBtn('tD', 'd');
holdBtn('tL', 'l'); holdBtn('tR', 'r');

function readInput(o) {
  const k = input.keys, t = input.touch;
  let steer = (k.has('ArrowRight') || k.has('KeyD') || t.r ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') || t.l ? 1 : 0);
  let thr = k.has('ArrowUp') || k.has('KeyW') || t.g ? 1 : 0, brk = k.has('ArrowDown') || k.has('KeyS') || t.b ? 1 : 0;
  let drift = k.has('Space') || !!t.d;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = clamp((ax - Math.sign(ax) * 0.12) / 0.88, -1, 1);
    const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
    if (rt > 0.05 || (p.buttons[0] && p.buttons[0].pressed)) thr = Math.max(thr, rt || 1);
    if (lt > 0.05 || (p.buttons[1] && p.buttons[1].pressed)) brk = Math.max(brk, lt || 1);
    if ((p.buttons[4] && p.buttons[4].pressed) || (p.buttons[2] && p.buttons[2].pressed)) drift = true;
    const rs = p.buttons[8] && p.buttons[8].pressed;
    if (rs && S.state === 'racing' && !S.padReset) { S.padReset = true; doReset(); }
    if (!rs) S.padReset = false;
  }
  if (sel.autoGas && brk < 0.05) thr = 1;
  o.steer = steer; o.throttle = thr; o.brake = brk; o.drift = drift;
}

function togglePause(force) {
  if (S.state === 'racing' || S.state === 'countdown') { S.state = S.state === 'countdown' ? 'pausedcd' : 'paused'; $('pause').classList.remove('hidden'); }
  else if (S.state === 'paused' || S.state === 'pausedcd') { S.state = S.state === 'pausedcd' ? 'countdown' : 'racing'; $('pause').classList.add('hidden'); }
}
$('pbtn').onclick = () => togglePause(); $('endBtn').onclick = () => { $('pause').classList.add('hidden'); if (S.state === 'paused' || S.state === 'racing') { S.state = 'finished'; showResults(); } };
$('resumeBtn').onclick = () => togglePause();
$('restartBtn').onclick = () => { $('pause').classList.add('hidden'); startRace(true); };
$('rbtn').onclick = () => { if (S.raceScene) startRace(true); };
$('startBtn').onclick = () => { sound.init(CARS[sel.car].id); startRace(false); };
$('dailyBtn').onclick = () => { sel.track = tracks.findIndex((t) => t.key === 'daily'); sel.mode = 'tt'; buildMenu(); sound.init(CARS[sel.car].id); startRace(false); };
$('againBtn').onclick = () => startRace(true);
const toMenu = () => { setView('home'); S.state = 'menu'; document.body.classList.remove('racing'); $('pause').classList.add('hidden'); $('results').classList.add('hidden'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('pbtn').classList.add('hidden'); $('rbtn').classList.add('hidden'); clearRace(); buildMenu(); $('menu').classList.remove('hidden'); $('menu').querySelector('.menu-scroll').scrollTop = 0; };
$('menuBtn').onclick = toMenu; $('menuBtn2').onclick = toMenu;

function doReset() { const p = S.player; if (!p || p.finished) return; resetToTrack(p, S.tr); S.secInvalid = true; S.lapInvalid = true; S.flash = 0.4; sound.play('land', 2); }

// ---------- mensajes ----------
let msgTimer = 0;
function showMsg(text, ms = 1100, cls = '') {
  const el = $('msg'); el.textContent = text; el.className = 'show ' + cls; clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { el.className = ''; }, ms);
}
let bannerTimer = 0;
function showRaceBanner(label, value, detail = '', cls = '') {
  const card = $('raceBanner');
  $('bannerLabel').textContent = label; $('bannerTime').textContent = value; $('bannerDelta').textContent = detail;
  card.className = 'show ' + cls; clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { card.className = ''; }, 2700);
}

// ---------- simulación ----------
function carCollide(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, min = 1.9;
  if (d2 >= min * min || d2 < 1e-6 || Math.abs(a.y - b.y) > 1.6) return;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, over = min - d;
  a.x -= nx * over * 0.5; a.z -= nz * over * 0.5; b.x += nx * over * 0.5; b.z += nz * over * 0.5;
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rv < 0) {
    const invA = 1 / (a.mass || 1450), invB = 1 / (b.mass || 1450), j = -(1 + 0.18) * rv / (invA + invB);
    a.vx -= j * invA * nx; a.vz -= j * invA * nz; b.vx += j * invB * nx; b.vz += j * invB * nz;
    a.yawRate += (nz * a.steer - nx * a.vl * 0.015) * Math.min(0.7, -rv * 0.025);
    b.yawRate -= (nz * b.steer - nx * b.vl * 0.015) * Math.min(0.7, -rv * 0.025);
    if (-rv > 3) { a.events.push({ t: 'bump', v: -rv, side: -Math.sign(a.vl || a.steer || 1) }); b.events.push({ t: 'bump', v: -rv, side: Math.sign(b.vl || b.steer || 1) }); }
  }
}

function stepAll() {
  const tr = S.tr, env = S.th;
  const p = S.player;
  if (p.finished) { inp.throttle = 0.4; inp.brake = 0; inp.steer = 0;  }
  // los rivales
  const aiIn = S.aiIn || (S.aiIn = { steer: 0, throttle: 0, brake: 0, drift: false });
  for (const c of S.cars) {
    if (c === p) {
      if (p.finished) { aiInput(p, tr, S.prof[p.type.id], { lane: 0, skill: 0.7 }, aiIn); stepCar(p, aiIn, H, tr, env); }
      else stepCar(p, inp, H, tr, env);
    } else {
      const rb = clamp((p.D - c.D) / 320, -0.035, 0.06);
      c.ai.skill = c.ai.base * (1 + rb);
      aiInput(c, tr, S.prof[c.type.id], c.ai, aiIn);
      stepCar(c, aiIn, H, tr, env);
      if (c.stuckT > 3) { resetToTrack(c, tr); }
    }
  }
  for (let i = 0; i < S.cars.length; i++) for (let j = i + 1; j < S.cars.length; j++) carCollide(S.cars[i], S.cars[j]);
  S.t += H; S.step++;
  // vueltas y meta
  for (const c of S.cars) {
    const done = Math.max(0, Math.floor(c.D / tr.len));
    if (done > c.lapsDone && !c.finished) {
      const lt = S.t - c.lapStart; c.lapStart = S.t; c.lapsDone = done;
      if (c.isPlayer) onPlayerLap(c, lt, done);
      if (sel.mode === 'race' && done >= LAPS) { c.finished = true; c.finishTime = S.t; S.finishOrder.push(c); if (c.isPlayer) onPlayerFinish(); }
    }
  }
  trackSectors(p);
  if (!p.finished && p.D >= 0) { const k = Math.floor((p.D % tr.len) / 10); if (S.curProf[k] < 0) S.curProf[k] = S.t - p.lapStart; }
  if (sel.mode === 'tt' && !p.finished && S.step % 3 === 0) S.ghostRec.push(p.x, p.y, p.z, p.psi);
  // eventos del jugador
  for (const c of S.cars) {
    for (const e of c.events) {
      if (e.t === 'wall' || e.t === 'bump') { c.impact = Math.max(c.impact, e.v); c.impactSide = e.side || Math.sign(c.vl || c.steer || 1); }
      if (c.isPlayer) {
        if (e.t === 'wall') { S.shake = Math.max(S.shake, clamp(e.v / 180, 0.04, 0.18)); S.camKick = clamp(S.camKick + (e.side || Math.sign(c.vl || 1)) * Math.min(0.035, e.v * 0.0007), -0.06, 0.06); sound.play('wall', e.v); }
        else if (e.t === 'bump') { S.shake = Math.max(S.shake, clamp(e.v / 150, 0.025, 0.11)); S.camKick = clamp(S.camKick + Math.sign(c.vl || c.steer || 1) * Math.min(0.025, e.v * 0.0004), -0.06, 0.06); sound.play('bump', e.v); }
        else if (e.t === 'land') { S.shake = Math.max(S.shake, clamp(e.v / 100, 0.025, 0.12)); sound.play('land', e.v); }
        else if (e.t === 'takeoff') { S.shake = Math.max(S.shake, 0.025); sound.play('takeoff', e.v); }
        else if (e.t === 'drift') { sound.play('drift'); showMsg('DERRAPE', 520, 'cy'); }
      }
      if (e.t === 'land') { c.bounceV = -Math.min(2.4, e.v * 0.12); }
      if (e.t === 'wall' || e.t === 'bump') sparks(c, e);
      if (e.t === 'land' && e.v > 5) dust(c, e.v);
    }
    c.events.length = 0;
  }
}

// naranja = peor que tu mejor, verde = mejora tu mejor, morado = récord de la pista
function classify(t, pb, rec) {
  if (t < rec - 1e-6) return 'purple';
  if (pb == null) return '';
  return t < pb - 1e-6 ? 'green' : 'orange';
}
const CLS_MSG = { purple: 'purple', green: 'green', orange: 'orange', '': '' };
function trackSectors(p) {
  const tr = S.tr;
  if (p.finished) return;
  const frac = p.D >= 0 ? (p.D % tr.len) / tr.len : -1;
  const idx = frac < 0 ? -1 : Math.min(2, Math.floor(frac * 3));
  if (idx === S.secIdx) return;
  if (S.secIdx >= 0 && idx === (S.secIdx + 1) % 3) sectorDone(S.secIdx, S.t - S.secStart);
  S.secIdx = idx; S.secStart = S.t;
  if (idx >= 0) { for (let k = 0; k < 3; k++) $('s' + k).classList.toggle('cur', k === idx); }
}
// récord de la pista del grupo del coche (tus tiempos en este dispositivo + clasificación online); si aún no hay, la referencia de la IA
function computeRecords(ti, type, bench) {
  const g = type.group; let lap = null; const sec = [null, null, null];
  for (const c of CARS) {
    if (c.group !== g) continue;
    const r = store.get('pb.' + ti.key + '.' + ti.tr.seed + '.' + c.id); if (!r) continue;
    if (r.lap != null && (lap == null || r.lap < lap)) lap = r.lap;
    if (Array.isArray(r.sec)) r.sec.forEach((v, i) => { if (v != null && (sec[i] == null || v < sec[i])) sec[i] = v; });
  }
  S.recReal = lap != null; S.recWho = lap != null ? 'Tú' : '';
  S.lapRec = lap != null ? lap : bench ? bench.lap : 1e9;
  S.secRec = sec.map((v, i) => (v != null ? v : bench ? bench.sec[i] : 1e9));
  updateRecPanel();
  const no = S.raceNo + 1;
  getRows(ti).then((res) => {
    if (!res.online || S.raceNo !== no) return;
    const list = rankRows(res.rows, (r) => groupIdOfCar(r.carId) === g); if (!list.length) return;
    const t = list[0].ms / 1000;
    if (!S.recReal || t < S.lapRec) { S.lapRec = t; S.recReal = true; S.recWho = list[0].you ? 'Tú' : list[0].name; updateRecPanel(); }
  }).catch(() => {});
}
function updateRecPanel() {
  const g = groupName((S.player ? S.player.type : CARS[sel.car]).group).toUpperCase();
  setText('recLabel', 'RÉCORD · ' + g); setText('recLap', S.lapRec < 1e8 ? fmt(S.lapRec) : '--'); setText('recWho', S.recReal ? S.recWho : 'REFERENCIA');
  for (let k = 0; k < 3; k++) setText('rs' + k, S.secRec && S.secRec[k] < 1e8 ? fmtS(S.secRec[k]) : '--');
}
function sectorDone(i, t) {
  if (S.secInvalid) { S.secInvalid = false; return; }
  const pbB = S.secPB[i], recB = S.secRec[i], cls = classify(t, pbB, recB), sg = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3) + ' s';
  let head, detail;
  if (cls === 'purple') { head = 'Récord de sector'; detail = recB < 1e8 ? sg(t - recB) + ' sobre el récord' : 'Primer tiempo'; }
  else if (cls === 'green') { head = 'Mejor marca personal'; detail = sg(t - pbB) + ' sobre tu mejor'; }
  else if (cls === 'orange') { head = 'Sector más lento'; detail = sg(t - pbB) + ' sobre tu mejor'; }
  else { head = 'Primer tiempo'; detail = 'Ya tienes referencia'; }
  if (cls === 'purple') { S.secRec[i] = t; sound.play('purple'); updateRecPanel(); } else sound.play('sector');
  if (S.secPB[i] == null || t < S.secPB[i]) { S.secPB[i] = t; S.pbRec.sec[i] = t; store.set('pb.' + S.skey, S.pbRec); }
  const el = $('s' + i); el.className = 'sec ' + cls + (S.secIdx === i ? ' cur' : '');
  el.lastElementChild.textContent = fmtS(t);
  showRaceBanner(`SECTOR ${i + 1} · ${head.toUpperCase()}`, fmtS(t), detail, cls);
}

function onPlayerLap(c, lt, done) {
  S.deltaS = null;
  const key = 'best.' + S.trackInfo.key + '.' + S.tr.seed + '.' + c.type.id;
  const valid = !S.lapInvalid && (sel.mode === 'tt' || done > 1) && (!S.bench || lt > S.bench.lap * 0.6);
  S.lapInvalid = false;
  const cls = valid ? classify(lt, S.lapPB, S.lapRec) : '';
  let newPB = false; const previousPB = S.lapPB;
  if (valid) {
    if (S.lapPB == null || lt < S.lapPB) {
      newPB = true; S.lapPB = lt; S.bestLap = lt;
      lb.submit(trackIdOf(S.trackInfo), c.type.id, Math.round(lt * 1000)).catch(() => {});
      S.pbRec.lap = lt; S.pbRec.prof = Array.from(S.curProf, (v) => (v < 0 ? -1 : Math.round(v * 1000) / 1000));
      store.set('pb.' + S.skey, S.pbRec);
      S.refProf = S.pbRec.prof; S.refName = 'PB'; S.refFill = fillProf(S.refProf);
      if (sel.mode === 'tt') {
        S.ghostBest = Float32Array.from(S.ghostRec);
        store.set(key, { time: lt, ghost: Array.from(S.ghostBest, (v) => Math.round(v * 100) / 100) });
      }
      markDaily();
    }
    if (lt < S.lapRec) { S.lapRec = lt; S.recReal = true; S.recWho = 'Tú'; updateRecPanel(); }
  }
  S.curProf.fill(-1);
  if (sel.mode === 'tt') S.ghostRec = [];
  c.bestLap = c.bestLap == null ? lt : Math.min(c.bestLap, lt);
  if (sel.mode === 'tt' || done < LAPS) {
    sound.play(cls === 'purple' ? 'purple' : 'lap');
    const md = newPB ? medalFor(lt, S.bench && S.bench.lap) : '';
    const gap = previousPB != null && previousPB < 1e8 ? `${newPB ? 'NUEVO RÉCORD' : `${lt - previousPB >= 0 ? '+' : '−'}${Math.abs(lt - previousPB).toFixed(3)} s vs. mejor`}` : 'Primera vuelta registrada';
    showRaceBanner(newPB ? 'MEJOR VUELTA PERSONAL' : `VUELTA ${done}${valid ? '' : ' · NO VÁLIDA'}`, fmtS(lt), `${gap}${md ? ' · ' + md : ''}`, CLS_MSG[cls]);
  }
}

function onPlayerFinish() {
  sound.play('finish');
  S.finishedAt = S.t;
  showMsg('¡META!', 2000);
  setTimeout(() => { if (S.state === 'racing' || S.state === 'paused') showResults(); }, 1600);
}

async function fillResultsBoard() {
  const ti = S.trackInfo, car = CARS[sel.car], res = await getRows(ti);
  if (S.state !== 'finished') return;
  const list = rankRows(res.rows, (r) => groupIdOfCar(r.carId) === car.group), me = list.find((r) => r.you);
  const shown = topWithMe(list, 5), out = [];
  shown.forEach((r, i) => { if (i && r.rank - shown[i - 1].rank > 1) out.push('<tr class="gap"><td colspan="4">···</td></tr>'); out.push(boardRow(r)); });
  $('rTable').innerHTML = out.join('') || '<tr class="gap"><td colspan="4">Aún no hay tiempos</td></tr>';
  const md = medalFor(S.lapPB, S.bench && S.bench.lap);
  $('rTitle').textContent = (md ? md + ' · ' : '') + (res.online && me ? `PUESTO ${me.rank} DE ${list.length} · ${groupName(car.group).toUpperCase()}` : `TU MEJOR VUELTA${res.online ? '' : ' · SOLO LOCAL'}`);
}
// rellena los huecos (-1) del perfil de tiempos para poder interpolar sin saltos
function fillProf(prof) {
  if (!prof || !prof.length) return null;
  const a = Float32Array.from(prof, (v) => (v >= 0 ? v : NaN)); let last = -1;
  for (let i = 0; i < a.length; i++) { if (!Number.isNaN(a[i])) { if (last >= 0 && i - last > 1) for (let k = last + 1; k < i; k++) a[k] = a[last] + (a[i] - a[last]) * ((k - last) / (i - last)); last = i; } }
  const first = a.findIndex((v) => !Number.isNaN(v)); if (first < 0) return null;
  for (let i = 0; i < first; i++) a[i] = a[first] * (i / first); for (let i = last + 1; i < a.length; i++) a[i] = a[last] + (i - last) * 0.1 * 0 + 0;
  return a;
}
function showResults() {
  S.state = 'finished';
  const p = S.player, rows = [];
  const order = S.finishOrder.slice();
  const rank = order.indexOf(p) + 1;
  const benchLap = S.bench ? S.bench.lap : null;
  let extra = '';
  if (sel.mode === 'race') {
    order.forEach((c, i) => rows.push(`<tr class="${c === p ? 'me' : ''}"><td>${i + 1}º</td><td>${c.name}</td><td>${fmt(c.finishTime)}</td></tr>`));
    const rest = S.cars.filter((c) => !c.finished).sort((a, b) => b.D - a.D);
    rest.forEach((c, i) => rows.push(`<tr><td>${order.length + i + 1}º</td><td>${c.name}</td><td>—</td></tr>`));
    $('rBig').textContent = rank + 'º'; $('rTitle').textContent = rank === 1 ? '¡VICTORIA!' : rank <= 3 ? '¡PODIO!' : 'META';
  } else {
    const md = medalFor(S.lapPB, benchLap);
    $('rBig').textContent = S.lapPB != null ? fmt(S.lapPB) : '—'; $('rTitle').textContent = S.lapPB != null ? (md ? md + ' · ' : '') + 'TU MEJOR VUELTA' : 'SESIÓN TERMINADA';
    rows.push('<tr class="gap"><td colspan="4">Cargando clasificación…</td></tr>'); fillResultsBoard();
    const st = streakInfo();
    if (S.trackInfo.key === 'daily') extra = `<div class="streak">Racha: ${st.n} día${st.n === 1 ? '' : 's'}</div>`;
  }
  $('rTable').innerHTML = rows.join('');
  const isRec = S.lapPB != null && S.bench && S.lapPB < S.bench.lap - 1e-6;
  $('rNew').innerHTML = (isRec ? '<span class="newrec">¡Récord de pista!</span>' : '') + extra;
  $('results').classList.remove('hidden'); $('touch').classList.add('hidden');
}

// ---------- efectos ----------
function wheelPos(c, sx, sz, out) {
  const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
  out.x = c.x + (-cs * sx * 0.95 + sn * sz * 1.35) * CS; out.z = c.z + (sn * sx * 0.95 + cs * sz * 1.35) * CS; out.y = c.loc.h;
}
const wp = { x: 0, y: 0, z: 0 };
function sparks(c, e) {
  const P = S.particles; if (!P) return;
  const n = clamp(Math.floor(e.v * 0.72), 4, 22), side = e.side || 1;
  const nx = -Math.cos(c.psi) * side, nz = Math.sin(c.psi) * side;
  const x = c.x + nx * 0.65, z = c.z + nz * 0.65;
  for (let i = 0; i < n; i++) P.emit(x, c.y + 0.28 + Math.random() * 0.55, z, nx * (2 + Math.random() * 7) + c.vx * 0.08, 1 + Math.random() * 5, nz * (2 + Math.random() * 7) + c.vz * 0.08, 0.28 + Math.random() * 0.32, 0.32, 0.06, 1, 0.68 + Math.random() * 0.25, 0.24, 0.95, 2.2, 13);
}
function dust(c, v) {
  const P = S.particles; if (!P) return;
  const th = S.th, col = new THREE.Color(th.dust || th.dirt);
  for (let i = 0; i < 10; i++) P.emit(c.x + (Math.random() - 0.5) * 2, c.loc.h + 0.2, c.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6, 0.7, 1, 3.5, col.r + 0.2, col.g + 0.2, col.b + 0.2, 0.5, 2);
}
function emitFx(dt) {
  const P = S.particles, tr = S.tr; if (!P) return;
  const pl = S.player;
  const th = S.th, cDirt = new THREE.Color(th.dirt), cGrass = new THREE.Color(th.grass);
  for (const c of S.cars) {
    const dxp = c.x - pl.x, dzp = c.z - pl.z;
    if (dxp * dxp + dzp * dzp > 110 * 110) continue;
    const slip = Math.abs(c.vl);
    if (!c.air && c.speed > 9 && (slip > 3.2 || (c.drifting && slip > 1.5))) {
      for (const sx of [-1, 1]) {
        wheelPos(c, sx, -1, wp);
        const snow = th.surface === 'snow', smokeRate = c.drifting ? 0.36 : 0.18;
        if (Math.random() < smokeRate) P.emit(wp.x, wp.y + 0.25, wp.z, c.vx * 0.045 + (Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.65, c.vz * 0.045 + (Math.random() - 0.5) * 1.2, snow ? 0.85 : (c.drifting ? 1.05 : 0.72), 0.65, snow ? 2.5 : (c.drifting ? 3.2 : 2.4), snow ? 0.78 : 0.76, snow ? 0.88 : 0.8, snow ? 0.98 : 0.86, c.drifting ? 0.4 : 0.27, 0.9);
        if (c.drifting && Math.random() < 0.16) P.emit(wp.x, wp.y + 0.12, wp.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 5, 0.26, 0.28, 0.03, 1, 0.68, 0.25, 0.92, 1.2, 11);
        // marcas
        markTire(c, 0.09);
      }
    }
    if (!c.air && c.brake > 0.68 && c.speed > 18) {
      for (const side of [-1, 1]) { wheelPos(c, side, -1, wp); markTire(c, th.surface === 'snow' ? 0.035 : 0.075); }
    }
    if (c.offroad && c.speed > 10 && !c.air) {
      const dustCol = new THREE.Color(th.dust || th.dirt), snow = th.surface === 'snow';
      for (const sx of [-1, 1]) { wheelPos(c, sx, -1, wp); markTire(c, snow ? 0.035 : 0.06); if (Math.random() < 0.6) P.emit(wp.x, wp.y + 0.2, wp.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, snow ? 0.9 : 0.7, 0.6, snow ? 3.4 : 2.4, dustCol.r + 0.04, dustCol.g + 0.04, dustCol.b + 0.04, 0.5, 2); }
    }
    if (th.weather === 'rain' && c.speed > 10 && !c.air) {
      const sn = Math.sin(c.psi), cs = Math.cos(c.psi), spray = Math.max(0.24, c.puddleWater || c.offroadFactor * 0.55 || (Math.abs(c.vl) > 2.5 ? 0.45 : 0));
      for (const side of [-1, 1]) { wheelPos(c, side, -1, wp); if (Math.random() < 0.72) P.emit(wp.x, wp.y + 0.12, wp.z, -sn * 1.5 + (Math.random() - 0.5) * 2, 1.4 + Math.random() * 2.4, -cs * 1.5 + (Math.random() - 0.5) * 2, 0.42, 0.5, 1.6, 0.62, 0.78, 0.9, 0.32 * spray, 1.4, 1.2); }
    }
    if (c.throttle > 0.52 && c.speed > 5 && Math.random() < 0.22) {
      const sn = Math.sin(c.psi), cs = Math.cos(c.psi), ex = c.x - sn * 2.7 * CS, ez = c.z - cs * 2.7 * CS;
      const tint = [0.42, 0.44, 0.48];
      P.emit(ex, c.y + 0.42, ez, -sn * 0.9 + (Math.random() - 0.5) * 0.35, 0.6 + Math.random() * 0.6, -cs * 0.9 + (Math.random() - 0.5) * 0.35, 0.32, 0.46, 1.6, tint[0], tint[1], tint[2], 0.22, 1.2);
    }
  }
  if (th.weather === 'rain' || th.surface === 'snow') {
    const rain = th.weather === 'rain', count = rain ? (MOBILE ? 4 : 7) : (MOBILE ? 5 : 9), tint = rain ? [0.68, 0.8, 0.96] : [0.88, 0.94, 1];
    for (let i = 0; i < count; i++) {
      const x = pl.x + (Math.random() - 0.5) * 34, z = pl.z + (Math.random() - 0.5) * 34;
      P.emit(x, pl.y + 7 + Math.random() * 11, z, rain ? -pl.vx * 0.1 : 0.1, rain ? -18 : -1.5 - Math.random() * 2.5, rain ? -pl.vz * 0.1 : 0.1, rain ? 0.36 : 1.8, rain ? 0.035 : 0.09, rain ? 0.022 : 0.045, tint[0], tint[1], tint[2], rain ? 0.25 : 0.52, rain ? 0.15 : 0.35, 0);
    }
  }
  P.mat.uniforms.k.value = (renderer.domElement.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
  P.update(dt);
}
const skidDummy = new THREE.Object3D();
function markTire(c, lift = 0.07) {
  if (!S.skid) return;
  const k = S.skidI; S.skidI = (S.skidI + 1) % S.skidN;
  skidDummy.position.set(wp.x, wp.y + lift, wp.z); skidDummy.rotation.set(0, c.psi, 0); skidDummy.scale.set(1, 1, 1); skidDummy.updateMatrix();
  S.skid.setMatrixAt(k, skidDummy.matrix); S.skid.instanceMatrix.needsUpdate = true;
}

// ---------- cámara ----------
function updateCamera(dt, snap) {
  const c = S.player; if (!c) return;
  const a = S.alpha == null ? 1 : S.alpha;
  const x = lerp(c.px, c.x, a), y = lerp(c.py, c.y, a), z = lerp(c.pz, c.z, a);
  // Camera follows the car heading in yaw only, with global up kept level.
  const psi = c.ppsi + wrapPi(c.psi - c.ppsi) * a;
  S.camYaw += wrapPi(psi - S.camYaw) * (snap ? 1 : 1 - Math.exp(-14 * dt));
  S.fovT = (S.fovT == null ? 0 : S.fovT); S.fovT += (0 - S.fovT) * (snap ? 1 : 1 - Math.exp(-5 * dt));
  const sn = Math.sin(S.camYaw), cs = Math.cos(S.camYaw);
  const speed = c.speed;
  let fov = 66 + clamp(speed / 62, 0, 1) * 12; if (camera.aspect < 1) fov += (1 - camera.aspect) * 38; // en vertical, más campo de visión
  S.camY += (y - S.camY) * (snap ? 1 : 1 - Math.exp(-9 * dt));
  const sh = S.shake, rx = Math.sin(S.t * 47 + 0.7) * sh * 0.42, ry = Math.sin(S.t * 61 + 2.1) * sh * 0.34;
  const far = S.camMode === 1 ? 1.38 : 1;
  const dist = (5.3 + speed * 0.02 + S.fovT * 0.7) * far, hgt = (3.6 + speed * 0.005) * far;
  camera.position.set(x - sn * dist + rx, S.camY + hgt + ry, z - cs * dist);
  camera.lookAt(x + sn * 4.2, y + 0.35, z + cs * 4.2);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  S.camKick *= Math.exp(-8 * dt);
  S.shake = Math.max(0, S.shake - dt * 2.6);
  if (S.world) S.world.sky.position.copy(camera.position);
}

// ---------- visuales de coche ----------
function updateCarVisual(c, dt) {
  const a = S.alpha, m = c.mesh;
  const x = lerp(c.px, c.x, a), y = lerp(c.py, c.y, a), z = lerp(c.pz, c.z, a), psi = c.ppsi + wrapPi(c.psi - c.ppsi) * a;
  m.root.position.set(x, y, z); m.root.rotation.set(0, psi, 0);
  const sf = clamp(c.speed / 40, 0, 1);
  const impact = clamp(c.impact / 22, 0, 1);
  let pitch = -Math.atan(c.grad) * 0.9;
  if (c.air) pitch = clamp(-Math.atan2(c.vy, Math.max(8, c.speed)) * 0.9, -0.45, 0.45);
  else pitch += c.brake * sf * 0.075 - c.throttle * (1 - Math.min(1, c.speed / c.type.vmax)) * 0.045 + impact * 0.055;
  const roll = -c.steer * sf * 0.075 - c.yawRate * 0.02 + clamp(c.vl * 0.022, -0.2, 0.2) + c.impactSide * impact * 0.11;
  c.impact *= Math.exp(-7 * dt);
  const kk = 1 - Math.exp(-8.5 * dt);
  c.visPitch += (pitch - c.visPitch) * kk; c.visRoll += (roll - c.visRoll) * kk;
  if (c.onKerb && c.speed > 10) c.bounceV += Math.sin(c.wheelSpin * 1.8 + c.psi) * Math.min(5, c.speed * 0.075) * dt;
  c.bounceV += (-c.bounce * 120 - c.bounceV * 9) * dt; c.bounce = clamp(c.bounce + c.bounceV * dt, -0.3, 0.3);
  m.tilt.rotation.set(c.visPitch, 0, c.visRoll); m.tilt.position.y = c.bounce;
  c.wheelSpin += (c.vf / 0.4) * dt;
  for (const w of m.wheels) { w.spin.rotation.x = c.wheelSpin; if (w.front) w.pivot.rotation.y = -c.steer * 0.4; }
  m.tail.color.setHex(c.brake > 0.1 ? 0xff2a2a : 0x8a0f0f);
  c.blob.visible = !QUAL.shadows; c.blob.position.set(x, c.loc.h + 0.09, z); c.blob.rotation.y = psi;
  const hh = Math.max(0, y - c.loc.h); const sc = Math.max(0.4, 1 - hh * 0.08); c.blob.scale.set(3.6 * sc * CS * 1.15, 1, 5.4 * sc * CS * 1.15);
  c.blob.material.opacity = Math.max(0.2, 1 - hh * 0.1);
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
const miniCtx = $('mini').getContext('2d');
const rpmSegs = [...$('rpmBar').children];
let miniT = 0, lastFx = -1, lastRpm = -1;
function updateHud(dt) {
  const p = S.player, tr = S.tr;
  setText('kmh', String(Math.round(p.speed * 3.6)));
  const gi = gearInfo(p.speed, p.type.vmax); p.gearNow = gi.gear; p.rpmNow = gi.rpm;
  setText('gear', p.speed < 1.5 ? 'N' : p.vf < -0.5 ? 'R' : String(gi.gear));
  const lit = Math.round(gi.rpm * rpmSegs.length);
  if (lit !== lastRpm) { lastRpm = lit; rpmSegs.forEach((e, i) => e.classList.toggle('on', i < lit)); }
  const done = Math.max(0, Math.floor(p.D / tr.len));
  setText('lap', sel.mode === 'tt' ? String(done + 1) : Math.min(LAPS, done + 1) + '/' + LAPS);
  setText('time', S.state === 'countdown' ? fmt(0) : fmt(p.finished ? p.finishTime - p.lapStart : S.t - p.lapStart));
  setText('best', (S.lapPB != null ? 'MEJOR ' + fmt(S.lapPB) : 'SIN TIEMPO'));
  if (S.refFill && S.state === 'racing' && !p.finished && p.D >= 0) {
    // diferencia con la vuelta de referencia: perfil interpolado y suavizado en el tiempo (como en la tele de F1)
    const F = S.refFill, dist = (p.D % tr.len) / 10, k = Math.min(F.length - 2, Math.floor(dist)), ref = F[k] + (F[k + 1] - F[k]) * (dist - k);
    const raw = (S.t - p.lapStart) - ref;
    S.deltaS = S.deltaS == null ? raw : S.deltaS + (raw - S.deltaS) * (1 - Math.exp(-dt * 3.5));
    const q = Math.round(S.deltaS * 100) / 100;
    if (q !== hudCache.dq) { hudCache.dq = q; const el = $('delta'); el.textContent = (q > 0 ? '+' : q < 0 ? '−' : '') + Math.abs(q).toFixed(2); el.className = q > 0.02 ? 'bad' : q < -0.02 ? 'good' : ''; }
  }
  if (sel.mode === 'race') { const rank = S.cars.slice().sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.D - a.D)).indexOf(p) + 1; setText('pos', String(rank)); }
  const sp = clamp((p.speed - 52) / 45, 0, 1) * 0.28;
  const spq = Math.round(sp * 25) / 25;
  if (spq !== lastFx) { lastFx = spq; $('fx-lines').style.opacity = spq; }
  if (S.flash > 0) { S.flash = Math.max(0, S.flash - 0.03); $('fx-flash').style.opacity = S.flash.toFixed(2); }
  // minimapa (20 Hz)
  miniT += dt; if (miniT < 0.05) return; miniT = 0;
  const m = S.mini; miniCtx.clearRect(0, 0, 300, 300); miniCtx.drawImage(m.cv, 0, 0);
  for (const c of S.cars) {
    miniCtx.fillStyle = c.isPlayer ? '#ffc928' : '#' + new THREE.Color(c.color).getHexString();
    miniCtx.beginPath(); miniCtx.arc(c.x * m.sc + m.ox, c.z * m.sc + m.oz, c.isPlayer ? 9 : 6.5, 0, 7); miniCtx.fill();
    if (c.isPlayer) { miniCtx.strokeStyle = '#000'; miniCtx.lineWidth = 3; miniCtx.stroke(); }
  }
}

// el navegador solo deja sonar tras un gesto del usuario: el primero activa el audio (y la música del menú)
const firstGesture = () => { sound.init(); S.musicOn = null; window.removeEventListener('pointerdown', firstGesture); window.removeEventListener('keydown', firstGesture); };
window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);

// ---------- clasificación ----------
async function renderBoard() {
  const ti = tracks[+$('boardTrack').value], f = $('boardCar').value, st = $('boardStatus');
  $('boardTable').innerHTML = '<tr><td>Cargando…</td></tr>'; st.textContent = '';
  const res = await getRows(ti);
  if (!res.online) st.textContent = res.error ? 'No se pudo conectar con la clasificación. Mostrando tus tiempos de este dispositivo.' : 'Clasificación online desactivada: aquí solo ves tus tiempos de este dispositivo.';
  const head = '<tr><th>#</th><th>Piloto</th><th>Coche</th><th>Tiempo</th></tr>';
  let html = '';
  if (!f) { // por categorías: el mejor tiempo de cada piloto dentro de cada grupo
    for (const g of GROUPS) { const list = rankRows(res.rows, (r) => groupIdOfCar(r.carId) === g.id); if (!list.length) continue; html += `<tr class="gh"><td colspan="4">${esc(g.name)}</td></tr>` + topWithMe(list, 8).map(boardRow).join(''); }
    if (res.online && html) st.textContent = 'Mejor tiempo de cada piloto en cada categoría';
  } else {
    const pred = f.startsWith('g:') ? (r) => groupIdOfCar(r.carId) === f.slice(2) : (r) => r.carId === f.slice(2);
    html = rankRows(res.rows, pred).map(boardRow).join('');
  }
  if (res.online && !html) st.textContent = 'Aún no hay tiempos en este circuito. ¡Pon el primero!';
  $('boardTable').innerHTML = head + html;
}
function openBoard(trackKey) {
  const bt = $('boardTrack'), bc = $('boardCar');
  bt.innerHTML = tracks.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  bc.innerHTML = '<option value="">Por categorías</option><optgroup label="Una categoría">' + GROUPS.map((g) => `<option value="g:${g.id}">${esc(g.name)}</option>`).join('') + '</optgroup><optgroup label="Un coche">' + CARS.map((c) => `<option value="c:${c.id}">${esc(c.name)}</option>`).join('') + '</optgroup>';
  bt.value = String(Math.max(0, tracks.findIndex((t) => t.key === (trackKey || tracks[sel.track].key)))); bc.value = '';
  $('board').classList.remove('hidden'); renderBoard();
}
$('boardTrack').onchange = renderBoard; $('boardCar').onchange = renderBoard;
$('boardBtn').onclick = () => openBoard(); $('boardBtn2').onclick = () => openBoard(S.trackInfo && S.trackInfo.key); $('boardClose').onclick = () => $('board').classList.add('hidden');
$('pname').onchange = (e) => { e.target.value = lb.setName(e.target.value); };
$('pname').onkeydown = (e) => e.stopPropagation();
lb.flush();

// ---------- ajustes ----------
function buildSettings() {
  $('pname').value = lb.name;
  for (const k of ['master', 'music', 'engine']) { $('v_' + k).value = Math.round(sel.vol[k] * 100); $('vt_' + k).textContent = Math.round(sel.vol[k] * 100) + '%'; }
  for (const b of $('gfxSel').children) b.classList.toggle('on', b.dataset.v === sel.gfx);
}
for (const k of ['master', 'music', 'engine']) $('v_' + k).oninput = (e) => { sel.vol[k] = e.target.value / 100; $('vt_' + k).textContent = e.target.value + '%'; sound.init(); sound.setVolumes(sel.vol); store.set('sel', sel); };
$('gfxSel').onclick = (e) => { if (e.target.dataset.v) { sel.gfx = e.target.dataset.v; store.set('sel', sel); applyGfx(); buildSettings(); } };
const openSettings = () => { buildSettings(); $('settings').classList.remove('hidden'); };
$('setBtn').onclick = openSettings; $('setBtn2').onclick = openSettings; $('setClose').onclick = () => $('settings').classList.add('hidden');

// ---------- coche de fondo en el menú ----------
const MP = { scene: null, car: null, key: '', ang: 0.6, loading: '', t: 0 };
function menuPreviewInit() {
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x1a2030, 0.8));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.0); key.position.set(4, 6, 3); sc.add(key);
  const rim = new THREE.DirectionalLight(0x7aa7ff, 1.1); rim.position.set(-5, 2, -4); sc.add(rim);
  const pm = new THREE.PMREMGenerator(renderer); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  pad.position.y = 0.01; sc.add(pad); MP.scene = sc;
}
// la pista elegida (o la del día) de fondo, con el coche en la línea de salida y la cámara girando alrededor
const MW = { sig: '', world: null, scene: null, pos: null, psi: 0, blob: null };
function menuWorldFree() {
  if (MP.car) MP.car.root.removeFromParent();
  if (MW.scene) { try { disposeScene(MW.scene); } catch (_) {} }
  MW.scene = null; MW.world = null; MW.sig = '';
}
function menuWorldEnsure() {
  if (sel.gfx === 'low' || /[?&]bg=0/.test(location.search)) { if (MW.scene) menuWorldFree(); return false; } // gráficos bajos: coche suelto sin pista de fondo
  const ti = tracks[sel.track], sig = ti.key + '|' + ti.tr.seed;
  if (MW.scene && MW.sig === sig) return true;
  menuWorldFree();
  try {
    const world = buildWorld(ti.tr, ti.th, { mobile: MOBILE, shadows: false, renderer });
    const P = { x: 0, y: 0, z: 0, tx: 0, tz: 1 }; pointAt(ti.tr, 4, 0, P);
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    blob.scale.set(3.6, 1, 5.6); blob.position.set(P.x, P.y + 0.03, P.z); blob.rotation.y = Math.atan2(P.tx, P.tz); world.scene.add(blob);
    MW.world = world; MW.scene = world.scene; MW.sig = sig; MW.pos = P; MW.psi = Math.atan2(P.tx, P.tz); return true;
  } catch (e) { console.warn('Fondo del menú no disponible', e); MW.scene = null; MW.sig = sig; return false; }
}
function menuPreviewFrame(dt) {
  if (!MP.scene) menuPreviewInit();
  MP.sk = !MP.sk; if (MP.sk && MP.car) return; // el menú se dibuja a 30 fps: menos batería y calor en el móvil
  const mpr = Math.min(pixelRatio, MOBILE ? 1.25 : 1.75); if (renderer.getPixelRatio() !== mpr) { renderer.setPixelRatio(mpr); renderer.setSize(window.innerWidth, window.innerHeight, false); }
  const hasWorld = menuWorldEnsure(), scn = hasWorld ? MW.scene : MP.scene;
  const type = CARS[sel.car], color = paintOf(type), lod = MOBILE ? 'lo' : 'hi', key = type.id + color + lod;
  if (MP.key !== key) {
    if (!carAssetReady(type, lod)) { if (MP.loading !== type.id) { MP.loading = type.id; loadCarAsset(type, true).then(() => { MP.loading = ''; }).catch(() => { MP.loading = ''; }); } }
    else { try { if (MP.car) MP.car.root.removeFromParent(); MP.car = buildCarMesh(color, type.kind, lod); MP.key = key; } catch (e) { MP.key = key; } }
  }
  if (MP.car && MP.car.root.parent !== scn) scn.add(MP.car.root);
  MP.ang += dt * 0.35; MP.t = (MP.t || 0) + dt;
  const W = window.innerWidth, H = window.innerHeight, open = $('menu').dataset.view !== 'home', fly = $('flyout');
  const left = narrowMenu() ? 0 : $('menuLeft').getBoundingClientRect().right;
  let r = W, t = 0, bt = H;
  if (open) { if (narrowMenu()) bt = fly.getBoundingClientRect().top; else r = fly.getBoundingClientRect().left; }
  else if (narrowMenu()) t = H * 0.42;
  const fw = Math.max(240, r - left), fh = Math.max(160, bt - t), cx = (left + r) / 2, cy = (t + bt) / 2;
  camera.aspect = W / H;
  let target = { x: 0, y: 0, z: 0 }, ang = MP.ang;
  if (hasWorld && MW.pos) {
    const P = MW.pos; target = { x: P.x, y: P.y, z: P.z };
    if (MP.car) { MP.car.root.position.set(P.x, P.y, P.z); MP.car.root.rotation.set(0, MW.psi, 0); for (const w of MP.car.wheels) w.spin.rotation.x += dt * 0.0; }
    ang = MW.psi + 1.2 + 0.75 * Math.sin(MP.t * 0.15);
  } else if (MP.car) { MP.car.root.rotation.y = MP.ang; for (const w of MP.car.wheels) w.spin.rotation.x += dt * 1.5; }
  const R = 10.5, aspect = W / H, need = 8.2 * W / fw;
  camera.fov = clamp(2 * Math.atan(need / (2 * R * aspect)) * 180 / Math.PI, 30, 62);
  camera.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H);
  camera.position.set(target.x + R * Math.sin(ang), target.y + 2.9, target.z + R * Math.cos(ang)); camera.lookAt(target.x, target.y + 0.55, target.z);
  if (hasWorld) { MW.world.sky.position.copy(camera.position); try { MW.world.updateWind(dt); MW.world.updateWeather(dt, target.x, target.y, target.z); } catch (_) {} }
  renderer.setClearColor(0x0b111c, 1); renderer.render(scn, camera);
}

// ---------- bucle principal ----------
let last = performance.now(), slowAcc = 0, slowN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  // calidad adaptativa
  slowAcc += dt; slowN++;
  if (slowAcc > 2.5) {
    const avg = slowAcc / slowN;
    if (sel.gfx === 'auto') {
      if (avg > 0.026 && pixelRatio > 0.8) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); resize(); }
      else if (avg > 0.03 && QUAL.shadows) setShadows(false);
    }
    slowAcc = 0; slowN = 0;
  }
  { const driving = S.state === 'racing' || S.state === 'countdown' || S.state === 'finished'; sound.setEngineActive(driving); const wantMusic = !sel.mute && sel.vol.music > 0.001 && (S.state === 'menu' || (!!sel.raceMusic && !!S.scene)); sound.setMusicDuck(S.state !== 'menu'); if (wantMusic !== S.musicOn) { S.musicOn = wantMusic; sound.setMusic(wantMusic); } }
  if (S.state === 'menu') { menuPreviewFrame(dt); return; }
  if (renderer.getPixelRatio() !== pixelRatio) resize();
  if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (!S.scene) { renderer.setClearColor(0x0a0d16); renderer.clear(); return; }
  const running = S.state === 'racing' || S.state === 'finished';
  if (S.state === 'countdown') {
    S.cd -= dt;
    const e = 3.6 - S.cd, n = Math.max(0, Math.min(5, Math.floor(e / 0.5)));
    if (n !== S.lastCount && S.cd > 0.6) { S.lastCount = n; setLights(n); if (n > 0) sound.play('count'); }
    if (S.cd <= 0.6 && S.lastCount !== 0) { S.lastCount = 0; setLights(-1); const el = $('count'); el.textContent = '¡YA!'; el.className = ''; void el.offsetWidth; el.className = 'pop'; sound.play('go'); S.state = 'racing'; S.t = 0; for (const c of S.cars) c.lapStart = 0; }
  }
  if (running) {
    readInput(inp);
    S.acc += dt;
    let steps = 0;
    while (S.acc >= H && steps < 8) { stepAll(); S.acc -= H; steps++; }
    if (steps === 8) S.acc = 0;
    S.alpha = S.acc / H;
  } else { S.alpha = 1; }
  const p = S.player;
  if (S.state !== 'paused' && S.state !== 'pausedcd') {
    for (const c of S.cars) updateCarVisual(c, dt);
    emitFx(dt);
    updateCamera(dt, false);
    S.world.sky.rotation.y += dt * 0.004;
    S.world.updateWind(dt);
    S.world.updateWeather(dt, p.x, p.y, p.z);
    if (p.onKerb && p.speed > 10) S.shake = Math.max(S.shake, 0.09);
    followSun(S.world, lerp(p.px, p.x, S.alpha), lerp(p.py, p.y, S.alpha), lerp(p.pz, p.z, S.alpha));
    // fantasma
    if (S.ghostMesh && !S.ghostBest) S.ghostMesh.root.visible = false;
    if (S.ghostMesh && S.ghostBest && running && !p.finished) {
      const t = (S.t - p.lapStart) * 40, n = S.ghostBest.length / 4, i = Math.floor(t);
      if (i >= 0 && i < n - 1) {
        const f = t - i, g = S.ghostBest, o = i * 4, q = o + 4;
        S.ghostMesh.root.visible = true;
        S.ghostMesh.root.position.set(lerp(g[o], g[q], f), lerp(g[o + 1], g[q + 1], f), lerp(g[o + 2], g[q + 2], f));
        S.ghostMesh.root.rotation.y = g[o + 3] + wrapPi(g[q + 3] - g[o + 3]) * f;
      } else S.ghostMesh.root.visible = false;
    }
    // contramano
    if (S.state === 'racing' && !p.finished) {
      const along = p.vx * p.loc.tx + p.vz * p.loc.tz;
      if (along < -4) { S.wrongT += dt; if (S.wrongT > 1.1) { showMsg('¡CONTRAMANO!', 800, 'warn'); S.wrongT = 0.6; } } else S.wrongT = 0;
      if (p.stuckT > 4) { showMsg('Pulsa R para volver a la pista', 1200, 'warn'); p.stuckT = 2; }
    }
    const gi = gearInfo(p.speed, p.type.vmax);
    if (S.lastAudioGear && gi.gear !== S.lastAudioGear && p.speed > 8) sound.play('shift');
    S.lastAudioGear = gi.gear;
    sound.update({ carId: p.type.id, speed: p.speed, vmax: p.type.vmax, throttle: S.state === 'countdown' ? (input.keys.has('ArrowUp') || input.keys.has('KeyW') || input.touch.g || sel.autoGas ? 1 : 0) : p.throttle, brake: p.brake, gear: gi.gear, rpm: S.state === 'countdown' ? 0.22 + (input.keys.has('ArrowUp') || input.touch.g ? 0.5 : 0) : gi.rpm, slip: Math.abs(p.vl), onKerb: p.onKerb, weather: S.th.weather, surface: S.th.surface, air: p.air, offroad: p.offroad, offroadFactor: p.offroadFactor, puddleWater: p.puddleWater });
    updateHud(dt);
  }
  renderer.render(S.scene, camera);
}
requestAnimationFrame(frame);

buildMenu();
applyGfx(); sound.setVolumes(sel.vol); sound.setMuted(!!sel.mute);
// miniaturas de los coches para el selector (se generan con tools/thumbs.cjs y se guardan en assets/thumbs)
async function renderThumb(id, w = 420, h = 250) {
  const type = CARS.find((c) => c.id === id); await loadCarAsset(type, true);
  const b = buildCarMesh(paintOf(type), type.kind, 'hi'), sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x303844, 0.9));
  const k = new THREE.DirectionalLight(0xfff2dd, 2.2); k.position.set(4, 6, 5); sc.add(k);
  const f = new THREE.DirectionalLight(0x9db8ff, 0.9); f.position.set(-6, 3, -3); sc.add(f);
  const pm = new THREE.PMREMGenerator(renderer); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  sc.add(b.root); b.root.rotation.y = 0.0;
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 100); cam.position.set(6.4, 2.4, 7.6); cam.lookAt(0, 0.62, 0);
  const prevT = renderer.getRenderTarget(), pc = new THREE.Color(); renderer.getClearColor(pc); const pa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(prevT); renderer.setClearColor(pc, pa); rt.dispose();
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  x.putImageData(img, 0, 0); return cv.toDataURL('image/png');
}
window.__dr = { renderThumb, showRaceBanner, pointAt, makeGhost, lb, S, sel, tracks, input, startRace, CARS, sound, QUAL, setShadows, boraReady, modelCarReady, loadModelCar };
