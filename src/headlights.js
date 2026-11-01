// Faros de los coches para cuando está oscuro (noche o lluvia fuerte). Cuatro estilos que valen para cualquier modelo:
// se colocan solos según las medidas de cada coche. Haz de luz sobre la carretera (falso, barato), destellos y, para el coche del jugador, un foco real.
import * as THREE from 'three';

const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
let glowT = null, flareT = null, beamT = null;
const glowTex = () => glowT || (glowT = mkTex(64, 64, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }));
const flareTex = () => flareT || (flareT = mkTex(128, 32, (g, w, h) => { const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, h / 2 - 2, w, 4); const v = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2); v.addColorStop(0, 'rgba(255,255,255,.9)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(w / 2 - h / 2, 0, h, h); }));
// haz: arriba (lejos) transparente, abajo (cerca) intenso; bordes suaves
const beamTex = () => beamT || (beamT = mkTex(64, 128, (g, w, h) => {
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.5, 'rgba(255,255,255,.3)'); v.addColorStop(0.88, 'rgba(255,255,255,.85)'); v.addColorStop(1, 'rgba(255,255,255,.35)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in'; const u = g.createLinearGradient(0, 0, w, 0); u.addColorStop(0, 'rgba(0,0,0,0)'); u.addColorStop(0.3, 'rgba(0,0,0,1)'); u.addColorStop(0.7, 'rgba(0,0,0,1)'); u.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = u; g.fillRect(0, 0, w, h);
}));

// cuatro estilos de iluminación
export const HEAD_STYLES = {
  halogen: { name: 'Halógeno clásico', color: 0xffdfa0, beams: [{ len: 24, w0: 0.9, w1: 8, op: 0.5 }], glow: 1.0, spread: 1 },
  led: { name: 'LED afilado', color: 0xeef6ff, beams: [{ len: 34, w0: 1.1, w1: 6.5, op: 0.55 }], glow: 0.55, strip: true, spread: 1 },
  xenon: { name: 'Xenón azulado', color: 0xbcd6ff, beams: [{ len: 30, w0: 1, w1: 8, op: 0.5 }, { len: 46, w0: 0.6, w1: 3.4, op: 0.32 }], glow: 1.15, flare: true, spread: 1 },
  rally: { name: 'Faros de rally', color: 0xffd070, beams: [{ len: 26, w0: 1.2, w1: 11, op: 0.42 }, { len: 48, w0: 0.5, w1: 3, op: 0.5 }], glow: 0.85, extra: true, spread: 1 },
};
// qué estilo lleva cada coche (los clásicos, halógeno; los modernos, LED o xenón; los más bestias, rally)
const STYLE_OF = { mini: 'halogen', minitoon: 'halogen', golf: 'halogen', mx5: 'halogen', mustang: 'halogen', stradale: 'halogen', clubman: 'halogen',
  gtr: 'xenon', bora: 'xenon', s4: 'xenon', m3: 'xenon', slr: 'xenon', qashqai: 'led', cupra: 'led', f360: 'led', mclaren: 'led', lotus: 'led', aston: 'led', z240: 'rally', cobra: 'rally', porsche: 'rally' };
export const headStyleOf = (id) => HEAD_STYLES[STYLE_OF[id]] || HEAD_STYLES[['halogen', 'led', 'xenon', 'rally'][[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4]];

function beamMesh(len, w0, w1, color, op) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w0 / 2, 0, 0, w0 / 2, 0, 0, -w1 / 2, 0, len, w1 / 2, 0, len], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); g.setIndex([0, 1, 2, 1, 3, 2]);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: beamTex(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 4; m.frustumCulled = false; return m;
}
const sprite = (tex, color, size, op, sx = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.set(size * sx, size, 1); s.renderOrder = 5; return s; };

// añade los faros al coche (mesh = { root, tilt, flames }); k = cuánta oscuridad hay (0-1)
export function addHeadlights(mesh, carId, k, real) {
  if (!mesh || mesh.hl || k <= 0.01) return;
  const st = headStyleOf(carId), box = new THREE.Box3();
  mesh.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(mesh.tilt.matrixWorld).invert();
  for (const ch of mesh.tilt.children) { if (ch === mesh.flames) continue; const b = new THREE.Box3().setFromObject(ch); if (!b.isEmpty()) box.union(b.applyMatrix4(inv)); }
  if (box.isEmpty()) return;
  const W = box.max.x - box.min.x, Hh = box.max.y, zf = box.max.z, zr = box.min.z, ly = Math.max(0.35, Hh * 0.46), lx = W * 0.31;
  const group = new THREE.Group(), tails = [];
  const col = new THREE.Color(st.color);
  for (const s of [-1, 1]) {
    const x = s * lx;
    { const g1 = sprite(glowTex(), col, 0.5 * st.glow + 0.2, 0.9 * k); g1.position.set(x, ly, zf + 0.05); group.add(g1); }
    if (st.flare) { const f1 = sprite(flareTex(), col, 0.35, 0.7 * k, 3.4); f1.position.set(x, ly, zf + 0.08); group.add(f1); }
    if (st.strip) { const bar = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 * k, fog: false })); bar.position.set(x, ly + 0.17, zf + 0.04); group.add(bar); }
    if (st.extra) { const e = sprite(glowTex(), col, 0.5, 0.9 * k); e.position.set(s * W * 0.14, ly + 0.02, zf + 0.06); group.add(e); }
    // haces sobre la carretera, uno por faro
    for (const bm of st.beams) { const b = beamMesh(bm.len, bm.w0 * 1.2, bm.w1 * 0.8, col, bm.op * k * 0.75); b.position.set(x, 0.07, zf - 0.1); b.rotation.x = 0.01; b.rotation.y = s * 0.035; group.add(b); }
    // piloto trasero: brilla más al frenar
    const t = sprite(glowTex(), 0xff2a1a, 0.7, 0.45 * k); t.position.set(s * lx * 0.95, ly + 0.03, zr - 0.04); group.add(t); tails.push(t);
  }
  mesh.tilt.add(group);
  let spot = null;
  if (real) {
    spot = new THREE.SpotLight(st.color, 55 * k, 60, 0.55, 0.65, 1.2); spot.position.set(0, ly + 0.1, zf - 0.3);
    const tg = new THREE.Object3D(); tg.position.set(0, 0, zf + 16); mesh.tilt.add(tg); spot.target = tg; mesh.tilt.add(spot);
  }
  mesh.hl = { group, tails, spot, k };
}
// cada fotograma: pilotos traseros según el freno
export function updateHeadlights(mesh, brake) {
  const h = mesh && mesh.hl; if (!h) return;
  const b = brake > 0.1 ? 1 : 0, o = (0.4 + 0.55 * b) * h.k, sz = 0.7 + 0.55 * b;
  for (const t of h.tails) { t.material.opacity = o; t.scale.set(sz, sz, 1); }
}
