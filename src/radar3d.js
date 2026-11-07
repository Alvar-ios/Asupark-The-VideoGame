// Escena 3D del radar del reto: una calzada elevada sobre el agua, vista desde un lateral y en altura.
// El tráfico va a velocidad normal con los modelos 3D reales y, desde atrás, el coche del reto pasa a toda velocidad por delante del radar.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const rnd = (a, b) => a + Math.random() * (b - a);
function labelTex(draw, w = 256, h = 256) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function createRadar3D(cv, o) {
  // o: { traffic: [mesh], fast: mesh, kmh, cb: { onFlash, onTick, onEnd }, ac, vol }
  const w = cv.clientWidth || 360, h = cv.clientHeight || 480;
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); R.setSize(w, h, false);
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
  const FOG = 0xa7bbd1, scene = new THREE.Scene(); scene.background = new THREE.Color(FOG); scene.fog = new THREE.Fog(FOG, 55, 430);
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.5, 800);
  const camBase = new THREE.Vector3(-6.6, 6.4, -15), look = new THREE.Vector3(0.6, 0.6, 38); cam.position.copy(camBase); cam.lookAt(look);
  scene.add(new THREE.HemisphereLight(0xe3edf9, 0x5f7690, 1.05));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.5); sun.position.set(-40, 60, -30); scene.add(sun);
  const flashLight = new THREE.PointLight(0xffffff, 0, 60, 1.6); scene.add(flashLight);

  // agua
  const wt = labelTex((g, W, H) => { g.fillStyle = '#6f8fae'; g.fillRect(0, 0, W, H); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(255,255,255,${rnd(0.04, 0.13)})`; g.lineWidth = rnd(1, 2.5); const x = rnd(0, W), y = rnd(0, H), l = rnd(14, 50); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + rnd(-2, 2)); g.stroke(); } }, 256, 256);
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.6, metalness: 0, envMapIntensity: 0.15, color: 0x7f9fbe })); water.rotation.x = -Math.PI / 2; water.position.set(0, -1.1, 200); scene.add(water);

  // calzada
  const L = 520, Z0 = -80, midZ = Z0 + L / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.0, L), new THREE.MeshStandardMaterial({ color: 0x4a4d57, roughness: 0.55, metalness: 0.05 })); deck.position.set(0, -0.5, midZ); scene.add(deck);
  const paint = (x, wd, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, L), new THREE.MeshBasicMaterial({ color: col, fog: true })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, midZ); scene.add(m); };
  paint(-4.75, 0.16, 0xe9ecf3); paint(4.75, 0.16, 0xe9ecf3);
  const dashG = new THREE.PlaneGeometry(0.16, 2.4), dashM = new THREE.MeshBasicMaterial({ color: 0xf0e7b8 }), dashes = new THREE.InstancedMesh(dashG, dashM, Math.floor(L / 7));
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); for (let i = 0; i < dashes.count; i++) { m4.compose(new THREE.Vector3(0, 0.014, Z0 + i * 7), q, new THREE.Vector3(1, 1, 1)); dashes.setMatrixAt(i, m4); } scene.add(dashes); }
  // vallas oscuras a ambos lados
  const postN = Math.floor(L / 3), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.15, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.8 }), postN * 2);
  { const m4 = new THREE.Matrix4(); let k = 0; for (const sx of [-5.1, 5.1]) for (let i = 0; i < postN; i++) { m4.makeTranslation(sx, 0.57, Z0 + i * 3); posts.setMatrixAt(k++, m4); } scene.add(posts); }
  for (const sx of [-5.1, 5.1]) for (const y of [0.55, 1.02]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, L), new THREE.MeshStandardMaterial({ color: 0x3a322b, roughness: 0.8 })); r.position.set(sx, y, midZ); scene.add(r); }
  // «50» pintado y señales de límite integradas en la vía
  const t50 = labelTex((g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '800 190px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('50', W / 2, H / 2); }, 256, 256);
  for (const z of [10, 70, 140]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: t50, transparent: true, side: THREE.DoubleSide, depthWrite: false })); m.rotation.set(-Math.PI / 2, 0, Math.PI); m.position.set(2.4, 0.02, z); scene.add(m); }
  const signTex = labelTex((g, W, H) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, 120, 0, 7); g.fill(); g.strokeStyle = '#e2283c'; g.lineWidth = 26; g.beginPath(); g.arc(W / 2, H / 2, 106, 0, 7); g.stroke(); g.fillStyle = '#111'; g.font = '800 118px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('50', W / 2, H / 2 + 6); });
  const pole = (x, z, h2) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h2, 8), new THREE.MeshStandardMaterial({ color: 0x8a92a6, metalness: 0.5, roughness: 0.4 })); p.position.set(x, h2 / 2, z); scene.add(p); return p; };
  for (const z of [22, 95, 170]) { pole(5.9, z, 3.4); const d = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })); d.position.set(5.9, 3.4, z - 0.06); d.rotation.y = Math.PI; scene.add(d); }
  // cabina del radar a la izquierda, mirando a la calzada
  const RZ = 26; pole(-5.9, RZ, 3.2);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0xcfd5e2, metalness: 0.3, roughness: 0.4 })); box.position.set(-5.9, 3.45, RZ); scene.add(box);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), new THREE.MeshBasicMaterial({ color: 0x0d0f16 })); lens.position.set(-5.9 + 0.45 + 0.01, 3.45, RZ); lens.rotation.y = Math.PI / 2; scene.add(lens);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), new THREE.MeshBasicMaterial({ color: 0x7a1520 })); led.position.set(-5.9, 3.7, RZ - 0.32); scene.add(led);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex((g, W, H) => { const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(9, 9, 1); glow.position.set(-5.4, 3.45, RZ); scene.add(glow);
  // isla con pabellón al fondo
  { const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: 0x7c8493, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x242833, roughness: 0.8 });
    const isl = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 22), stone); isl.position.y = -0.2; g.add(isl);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(7.5 - i * 1.8, 2.8, 4), dark); r.rotation.y = Math.PI / 4; r.position.y = 5.5 + i * 3.4; g.add(r); const s = new THREE.Mesh(new THREE.BoxGeometry(5 - i * 1.2, 1.8, 5 - i * 1.2), dark); s.position.y = 3.6 + i * 3.4; g.add(s); }
    g.position.set(-6, 0, 300); scene.add(g); }

  // coches: tráfico (en fila, un carril) y el coche del reto (otro carril, adelanta desde atrás)
  const blobTex = labelTex((g, W, H) => { const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }, 128, 128);
  const place = (m, x, z) => { m.root.position.set(x, 0, z); m.root.rotation.y = 0; scene.add(m.root); const b = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.03, z); scene.add(b); return b; };
  const V_T = 13.9, V_F = o.kmh / 3.6, FZ0 = -19 - V_F * 1.55;
  const cars = (o.traffic || []).map((m, i) => { const c = { m, z: 6 + i * 15.5 + rnd(-1.5, 1.5), x: 2.4, v: V_T * rnd(0.95, 1.05), fast: false }; c.b = place(m, c.x, c.z); return c; });
  const F = { m: o.fast, z: FZ0, x: -2.4, v: V_F, fast: true }; F.b = place(F.m, F.x, F.z); cars.push(F);

  // audio
  const ac = o.ac; let master = null, noiseBuf = null, fastV = null, trafV = null;
  if (ac) {
    master = ac.createGain(); master.gain.value = 0.55 * (o.vol == null ? 1 : o.vol); master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const voice = (fast) => { if (!ac) return null; const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), gn = ac.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = fast ? 2400 : 700; gn.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(master); o1.start(); o2.start(); return { set(f, v) { const t = ac.currentTime; o1.frequency.setTargetAtTime(f, t, 0.03); o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); gn.gain.setTargetAtTime(v, t, 0.05); }, stop() { try { gn.gain.setTargetAtTime(0, ac.currentTime, 0.06); setTimeout(() => { try { o1.stop(); o2.stop(); } catch (e) { /* parado */ } }, 500); } catch (e) { /* sin audio */ } } }; };
  const burst = (dur, f0, f1, v, type) => { if (!ac) return; const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const bp = ac.createBiquadFilter(), gn = ac.createGain(); bp.type = type || 'bandpass'; bp.frequency.setValueAtTime(f0, ac.currentTime); bp.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur); bp.Q.value = 0.8; gn.gain.setValueAtTime(v, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur); n.connect(bp); bp.connect(gn); gn.connect(master); n.start(); n.stop(ac.currentTime + dur + 0.05); };
  const tone = (f, dur, v, type) => { if (!ac) return; const x = ac.createOscillator(), gn = ac.createGain(); x.type = type || 'sine'; x.frequency.value = f; gn.gain.setValueAtTime(v, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur); x.connect(gn); gn.connect(master); x.start(); x.stop(ac.currentTime + dur + 0.02); };
  if (ac) { fastV = voice(true); trafV = voice(false); }

  let t = 0, last = performance.now(), raf = 0, stopped = false, flashed = false, ended = false, slow = 1, flashT = 0, tickAt = 0, passed = false;
  const tmp = new THREE.Vector3();
  function frame(now) {
    if (stopped) return; raf = requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (flashed && slow < 1) slow = Math.min(1, slow + dt / 0.9); dt *= slow; t += dt;
    for (const c of cars) {
      const dz = c.v * dt; c.z += dz; c.m.root.position.z = c.z; c.b.position.z = c.z;
      for (const wh of c.m.wheels || []) if (wh.spin) wh.spin.rotation.x += dz / 0.33;
    }
    // radar: salta cuando el coche del reto cruza la cabina
    if (!flashed && F.z >= RZ - 1) {
      flashed = true; slow = 0.16; flashT = t; o.cb.onFlash(); led.material.color.set(0xff4357);
      burst(0.14, 6000, 3000, 0.9, 'highpass'); tone(130, 0.12, 0.7); tone(1800, 0.09, 0.2, 'square'); setTimeout(() => tone(900, 0.2, 0.18, 'square'), 160);
    }
    // destello
    const fl = flashed ? Math.max(0, 1 - (t - flashT) / 0.35) : 0; glow.material.opacity = fl; flashLight.intensity = fl * 900; flashLight.position.set(-4.5, 3.6, RZ + 2); R.toneMappingExposure = 1 + fl * 0.9;
    // cámara: ligera sacudida cuando pasa cerca
    const dn = Math.abs(F.z - camBase.z); const near = Math.max(0, 1 - dn / 26) * 0.12;
    cam.position.set(camBase.x + (Math.random() - 0.5) * near, camBase.y + (Math.random() - 0.5) * near, camBase.z); cam.lookAt(look);
    // sonido
    if (ac) {
      const dop = (car, k) => { tmp.set(camBase.x - car.x, camBase.y - 0.8, camBase.z - car.z); const dist = tmp.length(); const vr = car.v * (tmp.z / dist); return { f: 343 / (343 - vr * k), dist }; };
      const a = dop(F, 4.2); fastV.set((150 + o.kmh * 0.9) * a.f * (1 + 0.03 * Math.sin(t * 38)), 0.36 * Math.min(1.7, 14 / Math.max(5, a.dist)) * (F.z > 150 ? Math.max(0, 1 - (F.z - 150) / 60) : 1));
      let best = 1e9, bz = 0; for (const c of cars) if (!c.fast) { const d = Math.hypot(c.z - camBase.z, c.x - camBase.x); if (d < best) { best = d; bz = c.z; } }
      trafV.set(78 + Math.sin(t * 7) * 2, 0.07 * Math.min(1.3, 30 / Math.max(10, best)));
      if (!passed && F.z > camBase.z) { passed = true; burst(0.6, 2500, 350, 0.55); }
    }
    if (now - tickAt > 170) { tickAt = now; o.cb.onTick(46 + Math.round(Math.random() * 8)); }
    R.render(scene, cam);
    if (flashed && !ended && t - flashT > 0.9 + 0.5) { ended = true; o.cb.onEnd(); }
  }
  raf = requestAnimationFrame(frame);
  const ro = new ResizeObserver(() => { const W2 = cv.clientWidth, H2 = cv.clientHeight; if (!W2 || !H2) return; R.setSize(W2, H2, false); cam.aspect = W2 / H2; cam.updateProjectionMatrix(); }); ro.observe(cv);
  return {
    stop() { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); fastV && fastV.stop(); trafV && trafV.stop(); scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); pm.dispose(); R.dispose(); try { R.forceContextLoss(); } catch (e) { /* ya cerrado */ } },
    printSound() { if (!ac) return; const x = ac.createOscillator(), l = ac.createOscillator(), gn = ac.createGain(), lg = ac.createGain(); x.type = 'sawtooth'; x.frequency.value = 95; l.frequency.value = 26; l.type = 'square'; lg.gain.value = 0.09; gn.gain.value = 0.1; l.connect(lg); lg.connect(gn.gain); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; x.connect(f); f.connect(gn); gn.connect(master); x.start(); l.start(); x.frequency.setValueAtTime(95, ac.currentTime); x.frequency.linearRampToValueAtTime(130, ac.currentTime + 1.2); const e = ac.currentTime + 1.25; x.stop(e); l.stop(e); setTimeout(() => { tone(1100, 0.08, 0.15, 'square'); burst(0.25, 3000, 800, 0.25); }, 1200); },
  };
}
