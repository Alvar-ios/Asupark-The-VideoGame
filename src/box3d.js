// Apertura de cajas: la caja cae en mitad de la pista, rebota con las solapas sueltas y, al abrirla, salta, gira y
// revienta las solapas. Después una ruleta horizontal frena hasta el premio (ya decidido y guardado).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSet, canvasTex, rngFrom } from './boxprops.js';
import { CARTONS, faceTex, flapTex, innerTex, edgeTex, tapeTex } from './boxart.js';
import { BOXES, RARITY } from './economy.js';
import { prizeCard, prizeLabel, amount, itemArt, itemKind, oddsList } from './rewards.js';

const W = 1.5, H = 1.1, T = 0.05; // ancho, alto y grosor de la caja
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildBox(skin) {
  const root = new THREE.Group(), tilt = new THREE.Group(), squash = new THREE.Group();
  root.add(tilt); tilt.add(squash);
  const card = (o) => new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, envMapIntensity: 0.4, ...o });
  const front = card({ map: faceTex(skin, false, 11) }), side = card({ map: faceTex(skin, true, 23) }), back = card({ map: faceTex(skin, false, 41) });
  const inner = card({ map: innerTex(skin, 5), emissive: skin.glow, emissiveIntensity: 0.1 });
  const edge = card({ map: edgeTex(skin) }), crease = card({ color: skin.shade });
  const tape = new THREE.MeshStandardMaterial({ map: tapeTex(skin), roughness: 0.38, metalness: 0.05, envMapIntensity: 0.9 });
  const add = (geo, m, x, y, z, parent = squash) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const wallGeo = new THREE.BoxGeometry(W, H, T);
  // materiales por cara de cada pared: [+x, -x, +y, -y, +z (fuera), -z (dentro)]
  const wall = (outer) => [crease, crease, edge, edge, outer, inner];
  [front, side, back, side].forEach((outer, i) => { const a = i * Math.PI / 2, w = add(wallGeo, wall(outer), Math.sin(a) * (W - T) / 2, H / 2, Math.cos(a) * (W - T) / 2); w.rotation.y = a; });
  add(new THREE.BoxGeometry(W - 0.02, T, W - 0.02), inner, 0, T / 2, 0);
  // aristas dobladas: un listón apenas redondeado en cada esquina
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.026, 0.026, H - 0.004, 8), crease, sx * (W / 2 - 0.022), H / 2, sz * (W / 2 - 0.022));
  // precinto del fondo, que sube un poco por los lados
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.008, 0.2, 0.2), tape, sx * (W / 2 + 0.002), 0.1, 0);
  // cuatro solapas con bisagra en el borde de arriba
  const flaps = [];
  for (let i = 0; i < 4; i++) {
    const yaw = new THREE.Group(); yaw.rotation.y = i * Math.PI / 2; squash.add(yaw);
    const upper = i % 2 === 0;
    const hinge = new THREE.Group(); hinge.position.set(0, H + (upper ? 0.04 : 0.012), W / 2 - 0.012); yaw.add(hinge);
    const depth = upper ? W * 0.488 : W * 0.46;
    add(new THREE.BoxGeometry(W - 0.05, 0.028, depth), [edge, edge, card({ map: flapTex(skin, 51 + i) }), inner, edge, edge], 0, 0, -depth / 2, hinge);
    add(new THREE.CylinderGeometry(0.016, 0.016, W - 0.08, 8).rotateZ(Math.PI / 2), crease, 0, -0.004, 0, hinge);
    if (upper) { // media tira de precinto en cada solapa de arriba: al abrir, se parte por la junta
      add(new THREE.BoxGeometry(W - 0.04, 0.006, 0.115), tape, 0, 0.018, -depth + 0.058, hinge);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.006, 0.17, 0.115), tape, sx * (W / 2 - 0.018), -0.07, -depth + 0.058, hinge);
    }
    flaps.push({ hinge, a: 0, v: 0, rest: 0 });
  }
  return { root, tilt, squash, flaps, inner };
}

export function createBoxShow(ctx) {
  const { renderer, eco, helmetSvg, loadKarts, sfx, muted, equip, MOBILE } = ctx;
  const el = document.getElementById('boxui'), $q = (s) => el.querySelector(s);
  let active = false, scene = null, camera = null, set = null, box = null, fx = null, id = 'daily', prize = null;
  let phase = 'drop', t = 0, phaseT = 0, spinning = null, shake = 0, look = 0.8;
  const P = { y: 7, vy: 0, rx: 0, rz: 0, wx: 0, wz: 0, s: 0, sv: 0, yaw: -0.5, yawV: 0, nextHop: 2 };

  // ---------- sonido de la ruleta ----------
  let actx = null;
  function tick(freq = 1500, dur = 0.03, vol = 0.06) {
    if (muted()) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime; o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur); o.connect(g); g.connect(actx.destination); o.start(now); o.stop(now + dur); } catch (_) { /* sin audio */ }
  }

  // ---------- escena ----------
  function build() {
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x4a3a52, 16, 48);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
    set = buildSet(scene, rngFrom(20261126));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5;
    scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x3a2a20, 0.85));
    const sun = new THREE.DirectionalLight(0xffd9ae, 2.3); sun.position.set(3.5, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
    const c = sun.shadow.camera; c.left = -5; c.right = 5; c.top = 5; c.bottom = -5; c.far = 22; sun.shadow.bias = -0.0006; sun.shadow.radius = 4; scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7fa0ff, 1.3); rim.position.set(-4, 3, -5); scene.add(rim);
    const flood = new THREE.PointLight(0xfff0cc, 22, 14, 1.8); flood.position.set(0, 3.8, 1.6); scene.add(flood);
    loadKarts().then((karts) => {
      if (!scene) return;
      const put = (k, x, z, ry, y = 0) => { if (!k) return; k.position.set(x, y, z); k.rotation.y = ry; k.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(k); };
      put(karts[0], -1.05, -5.3, 1.05); put(karts[1], 1.2, -6.9, -1.0);
    }).catch((e) => { console.warn('Karts de la escena no disponibles', String(e && e.stack || e)); });
  }
  function buildFx(skin) {
    const g = new THREE.Group(); scene.add(g);
    // haz de luz que sale de la caja
    const beamTex = canvasTex(8, 256, (x) => { const gr = x.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 256); });
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: skin.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.55, 4.6, 32, 1, true), beamMat); beam.position.y = H + 2.2; g.add(beam);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: set.glowTex, color: skin.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.y = H; halo.scale.setScalar(3.4); g.add(halo);
    const light = new THREE.PointLight(skin.glow, 0, 7, 1.6); light.position.y = H + 0.1; g.add(light);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x) => { const gr = x.createRadialGradient(64, 64, 8, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false }));
    shadow.position.y = 0.012; g.add(shadow);
    // confeti y polvo
    const N = MOBILE ? 150 : 260, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N), bits = [], col = new THREE.Color();
    for (let i = 0; i < N; i++) { conf.setColorAt(i, col.set([0xffc400, 0xdc1f17, 0xffffff, 0x2f9dff, skin.glow][i % 5])); bits.push({ p: new THREE.Vector3(0, -9, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), on: false }); }
    conf.frustumCulled = false; g.add(conf); conf.visible = false;
    const dustTex = canvasTex(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(190,175,160,.8)'); gr.addColorStop(1, 'rgba(190,175,160,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
    const dust = Array.from({ length: 22 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0, depthWrite: false })); g.add(s); return { s, v: new THREE.Vector3(), life: 0 }; });
    return { g, beam, beamMat, halo, light, shadow, conf, bits, dust, power: 0, target: 0 };
  }
  function puff(power) {
    let n = 0;
    for (const d of fx.dust) { if (d.life > 0) continue; const a = Math.random() * 6.28; d.s.position.set(Math.cos(a) * 0.8, 0.08, Math.sin(a) * 0.8); d.v.set(Math.cos(a) * (0.8 + Math.random()) * power, 0.25 + Math.random() * 0.4, Math.sin(a) * (0.8 + Math.random()) * power); d.life = 1; if (++n > 12) break; }
  }
  function confetti() {
    fx.conf.visible = true;
    for (const b of fx.bits) { const a = Math.random() * 6.28, s = 0.5 + Math.random() * 2.1; b.p.set(Math.cos(a) * 0.35, H + 0.1, Math.sin(a) * 0.35); b.v.set(Math.cos(a) * s, 3.2 + Math.random() * 4.2, Math.sin(a) * s * 0.7); b.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); b.w.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6); b.on = true; }
  }

  // ---------- física ----------
  const kickFlaps = (power) => { for (const f of box.flaps) f.v += (0.35 + Math.random() * 0.65) * power; };
  function land(speed) {
    const k = Math.min(1, speed / 9);
    P.sv -= k * 3.4; P.wx += (Math.random() - 0.5) * k * 5; P.wz += (Math.random() - 0.5) * k * 5; shake = Math.max(shake, k * 0.1);
    kickFlaps(k * 9); puff(0.5 + k * 1.2); sfx('land', 1 + k * 6);
  }
  function physics(dt) {
    const air = P.y > 0.001 || P.vy > 0;
    if (air) {
      P.vy -= 15 * dt; P.y += P.vy * dt;
      if (P.y <= 0) { const sp = -P.vy; P.y = 0; if (sp > 1.4) { land(sp); P.vy = sp * 0.36; } else P.vy = 0; }
    }
    // inclinación: muelle amortiguado (más suelto en el aire)
    const k = P.y > 0.05 ? 14 : 75, c = P.y > 0.05 ? 1.2 : 6.5;
    P.wx += (-k * P.rx - c * P.wx) * dt; P.wz += (-k * P.rz - c * P.wz) * dt; P.rx += P.wx * dt; P.rz += P.wz * dt;
    // aplastamiento y estirón
    P.sv += (-240 * P.s - 13 * P.sv) * dt; P.s = Math.max(-0.28, Math.min(0.25, P.s + P.sv * dt));
    P.yaw += P.yawV * dt;
    // solapas: muelle hacia su reposo, con la gravedad y la inercia de la caja; nunca entran en la caja
    for (const f of box.flaps) {
      const open = f.rest > 1;
      f.v += ((f.rest - f.a) * (open ? 70 : 34) - f.v * (open ? 5.5 : 3.2) - (open ? 0 : 5) - (P.vy < -2 && !open ? P.vy * 1.5 : 0)) * dt;
      f.a += f.v * dt;
      if (f.a < 0) { f.a = 0; f.v = Math.abs(f.v) > 0.8 ? -f.v * 0.45 : 0; }
      if (f.a > 2.85) { f.a = 2.85; f.v = -f.v * 0.4; }
    }
  }
  function applyBox() {
    box.root.position.y = P.y + (Math.abs(Math.sin(P.rx)) + Math.abs(Math.sin(P.rz))) * W * 0.45; // al inclinarse apoya en la arista
    box.root.rotation.y = P.yaw;
    box.tilt.rotation.set(P.rx, 0, P.rz);
    box.squash.scale.set(1 - P.s * 0.5, 1 + P.s, 1 - P.s * 0.5);
    box.flaps.forEach((f) => { f.hinge.rotation.x = f.a; });
  }

  // ---------- fases ----------
  const go = (name) => { phase = name; phaseT = 0; };
  function logic(dt) {
    phaseT += dt;
    if (phase === 'drop' && P.y === 0 && P.vy === 0 && phaseT > 0.5) { go('idle'); P.nextHop = 0.9; }
    if (phase === 'idle') {
      P.yaw += ((-0.5 + Math.sin(t * 0.8) * 0.14) - P.yaw) * Math.min(1, dt * 2);
      if (phaseT > P.nextHop && !reduced()) { // saltitos para llamar la atención
        P.vy = 2.1 + Math.random() * 1.3; P.wx += (Math.random() - 0.5) * 3; P.wz += (Math.random() - 0.5) * 3.4; kickFlaps(3.5); P.sv += 1.2; phaseT = 0; P.nextHop = 1.3 + Math.random() * 1.1;
      }
    }
    if (phase === 'windup') {
      const u = Math.min(1, phaseT / 1.25);
      P.wx += (Math.random() - 0.5) * 46 * u * dt * 4; P.wz += (Math.random() - 0.5) * 46 * u * dt * 4; P.s = -0.16 * u; P.sv = 0; kickFlaps(u * 26 * dt); fx.target = u * 0.35; shake = Math.max(shake, u * 0.025);
      if (u >= 1) { go('jump'); P.vy = 7.2; P.sv = 4.2; P.yawV = (Math.PI * 2) / (2 * 7.2 / 15); kickFlaps(6); puff(1.3); sfx('shift'); }
    }
    if (phase === 'jump' && phaseT > 0.4 && P.y < 0.03) {
      go('burst'); P.yawV = 0; P.yaw = ((P.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      for (const f of box.flaps) { f.rest = 2.25 + Math.random() * 0.25; f.v = 17 + Math.random() * 6; }
      fx.target = 1; shake = 0.16; confetti(); sfx('purple');
      const flash = $q('.bx-flash'); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    }
    if (phase === 'burst') { P.yaw += (-0.5 - P.yaw) * Math.min(1, dt * 5); if (phaseT > 1.15) { go('reel'); startReel(); } }
    if (phase === 'reel' || phase === 'prize') P.yaw += ((-0.5 + Math.sin(t * 0.5) * 0.1) - P.yaw) * Math.min(1, dt * 2);
  }
  function effects(dt) {
    fx.power += (fx.target - fx.power) * Math.min(1, dt * 7);
    const flick = 0.9 + Math.sin(t * 17) * 0.05 + Math.sin(t * 7.3) * 0.05, dim = phase === 'reel' || phase === 'prize' ? 0.6 : 1;
    fx.beamMat.opacity = fx.power * 0.55 * flick * dim * (phase === 'windup' ? 0.4 : 1); fx.beam.rotation.y += dt * 0.7;
    fx.halo.material.opacity = fx.power * 0.75 * dim; fx.light.intensity = fx.power * 16 * flick; box.inner.emissiveIntensity = 0.1 + fx.power * 1.1;
    fx.beam.position.y = P.y + H + 2.2; fx.halo.position.y = P.y + H; fx.light.position.y = P.y + H + 0.1;
    const sh = Math.max(0.25, 1 - P.y * 0.22); fx.shadow.scale.setScalar(0.7 + sh * 0.35); fx.shadow.material.opacity = sh;
    for (const d of fx.dust) { if (d.life <= 0) { d.s.material.opacity = 0; continue; } d.life -= dt * 1.5; d.s.position.addScaledVector(d.v, dt); d.v.multiplyScalar(Math.pow(0.12, dt)); d.s.scale.setScalar(0.25 + (1 - d.life) * 1.1); d.s.material.opacity = Math.max(0, d.life) * 0.6; }
    if (fx.conf.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
      fx.bits.forEach((b, i) => {
        if (b.on) { b.v.y -= 9 * dt; b.v.multiplyScalar(Math.pow(0.45, dt)); if (b.v.y < -1.1) b.v.y = -1.1; b.p.addScaledVector(b.v, dt); b.p.x += Math.sin(t * 5 + i) * dt * 0.25; b.r.x += b.w.x * dt; b.r.y += b.w.y * dt; b.r.z += b.w.z * dt; if (b.p.y < 0.015) { b.p.y = 0.015; b.on = false; b.r.set(-Math.PI / 2, 0, b.r.z); } }
        q.setFromEuler(b.r); m.compose(b.p, q, one); fx.conf.setMatrixAt(i, m);
      });
      fx.conf.instanceMatrix.needsUpdate = true;
    }
    set.pennants.forEach((f, i) => { f.rotation.x = Math.sin(t * 2.2 + i * 0.7) * 0.28; });
  }
  function frame(dt) {
    if (!scene || !box) return;
    dt = Math.min(dt, 0.05); t += dt;
    const steps = Math.ceil(dt / 0.008);
    for (let i = 0; i < steps; i++) physics(dt / steps);
    logic(dt); applyBox(); effects(dt);
    const wpx = window.innerWidth, hpx = window.innerHeight, aspect = wpx / hpx;
    camera.aspect = aspect;
    // en vertical se abre el objetivo para que quepan los lados; con la ruleta la caja sube en pantalla
    camera.fov = Math.max(40, Math.min(70, 2 * Math.atan(Math.tan(21 * Math.PI / 180) / aspect) * 180 / Math.PI));
    camera.updateProjectionMatrix();
    const open = phase === 'reel' || phase === 'prize';
    look += ((open ? (aspect < 1 ? 0.05 : 0.45) : 0.95) - look) * Math.min(1, dt * 2.5);
    const push = phase === 'windup' ? Math.min(1, phaseT / 1.25) * 0.55 : open || phase === 'burst' ? 0.2 : 0;
    shake *= Math.pow(0.02, dt);
    camera.position.set(Math.sin(t * 0.23) * 0.16 + (Math.random() - 0.5) * shake, 2.55 + (Math.random() - 0.5) * shake, (aspect < 1 ? 6.3 : 5.9) - push);
    camera.lookAt(0, look, 0);
    renderer.setRenderTarget(null); renderer.setClearColor(0x15131a, 1); renderer.render(scene, camera);
  }

  // ---------- ruleta ----------
  const AT = 40;
  function startReel() {
    const items = eco.reel(id, prize, 48, AT), reel = $q('.bx-reel'), strip = $q('.bx-strip');
    strip.innerHTML = items.map((p) => prizeCard(p, helmetSvg)).join('');
    reel.classList.remove('hidden', 'done'); $q('.bx-skip').classList.remove('hidden');
    const step = strip.children[1].offsetLeft - strip.children[0].offsetLeft, cw = strip.children[0].offsetWidth;
    const centre = () => reel.clientWidth / 2;
    const jitter = (Math.random() - 0.5) * cw * 0.7; // no siempre para en el centro de la tarjeta
    const end = AT * step + cw / 2 + jitter - centre(), from = 2 * step + cw / 2 - centre();
    const DUR = reduced() ? 900 : 6200, t0 = performance.now();
    let last = -1;
    const place = (x) => { strip.style.transform = `translate3d(${-x}px,0,0)`; const i = Math.floor((x + centre()) / step); if (i !== last) { last = i; tick(1300 + Math.random() * 120); if (navigator.vibrate) navigator.vibrate(4); } };
    const run = (now) => {
      const u = Math.min(1, (now - t0) / DUR), e = 1 - Math.pow(1 - u, 4.2);
      place(from + (end - from) * e);
      if (u < 1) spinning.raf = requestAnimationFrame(run); else finish();
    };
    const finish = () => {
      if (!spinning) return; cancelAnimationFrame(spinning.raf); spinning = null;
      place(end); strip.children[AT].classList.add('win'); reel.classList.add('done'); $q('.bx-skip').classList.add('hidden');
      sfx(prize.rarity === 'legendary' || prize.rarity === 'epic' ? 'finish' : 'lap');
      if (prize.rarity === 'legendary' || prize.rarity === 'epic') confetti();
      timers.push(setTimeout(showPrize, reduced() ? 100 : 750));
    };
    spinning = { raf: requestAnimationFrame(run), finish };
  }
  let timers = [];
  function showPrize() {
    if (!active) return; go('prize');
    const r = RARITY[prize.rarity], card = $q('.bx-prize'), item = prize.kind === 'item' ? prize.item : null;
    const sub = item ? `${itemKind(item)} ${r.name.toLowerCase()}` : 'Sumado a tu saldo';
    card.style.setProperty('--rc', r.color);
    card.innerHTML = `<span class="bx-big">${item ? itemArt(item, helmetSvg) : prizeCard(prize, helmetSvg)}</span><small>${sub}</small><h3>${prizeLabel(prize)}</h3>
      ${prize.dup ? `<p>Ya lo tenías: te damos ${amount({ pts: prize.dup })} a cambio.</p>` : ''}
      <div class="bx-actions">${item && !prize.dup ? '<button type="button" class="kx-cta" data-bx="equip">Equipar</button>' : ''}<button type="button" class="kx-cta${item && !prize.dup ? ' alt' : ''}" data-bx="close">Continuar</button></div>`;
    $q('.bx-reel').classList.add('hidden'); card.classList.remove('hidden');
  }

  // ---------- abrir y cerrar ----------
  function disposeAll() {
    if (!scene) return;
    scene.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } });
    if (scene.environment) scene.environment.dispose();
    scene = null; box = null; fx = null;
  }
  async function open(boxId) {
    id = boxId; const skin = CARTONS[id];
    try { await document.fonts.load('italic 800 60px KartDisplay'); } catch (_) { /* se dibuja con la fuente de reserva */ }
    build(); box = buildBox(skin); scene.add(box.root); fx = buildFx(skin);
    Object.assign(P, { y: reduced() ? 0 : 5.6, vy: 0, rx: 0.22, rz: -0.28, wx: 1.5, wz: -1.2, s: 0, sv: 0, yaw: -2.6, yawV: 2.6 });
    setTimeout(() => { P.yawV = 0; }, 800);
    prize = null; t = 0; look = 0.95; go('drop'); active = true;
    const pr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2); renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight, false);
    $q('.bx-title b').textContent = BOXES[id].name;
    $q('.bx-odds-list').innerHTML = oddsList(BOXES[id]); $q('.bx-odds').open = false; $q('.bx-odds').classList.remove('hidden');
    $q('.bx-open').classList.remove('hidden'); $q('.bx-open').disabled = false; $q('.bx-open').textContent = BOXES[id].cost ? 'Pagar y abrir' : 'Abrir caja';
    for (const s of ['.bx-reel', '.bx-prize', '.bx-skip']) $q(s).classList.add('hidden');
    el.classList.remove('hidden'); document.body.classList.add('in-box');
  }
  function close() {
    if (!active) return;
    active = false; if (spinning) { cancelAnimationFrame(spinning.raf); spinning = null; }
    timers.forEach(clearTimeout); timers = [];
    el.classList.add('hidden'); document.body.classList.remove('in-box'); disposeAll();
    ctx.onClose();
  }
  function openNow() {
    if (!active || prize || (phase !== 'idle' && phase !== 'drop')) return;
    prize = eco.openBox(id); if (!prize) return close(); // se cobra y se decide aquí; la animación solo lo enseña
    $q('.bx-open').classList.add('hidden'); $q('.bx-odds').classList.add('hidden');
    for (const f of box.flaps) f.rest = 0;
    sfx('count'); go('windup');
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === el || e.target.classList.contains('bx-hit')) openNow(); return; }
    if (b.classList.contains('bx-open')) openNow();
    else if (b.classList.contains('bx-skip')) { if (spinning) spinning.finish(); }
    else if (b.dataset.bx === 'equip') { equip(prize.item.id); close(); }
    else if (b.dataset.bx === 'close' || b.classList.contains('bx-x')) close();
  });
  return { open, close, frame, get active() { return active; }, get phase() { return phase; } };
}
