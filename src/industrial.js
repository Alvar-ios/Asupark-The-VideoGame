// Exterior de polígono industrial para los kartings urbanos (Asupark y Fórmula 0): naves, calles, valla, aparcamientos y tendido.
// Sin vegetación. Todo va instanciado (pocas llamadas de dibujo) y sin sombras para que el móvil aguante.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL } from './track.js';
import { backdrop } from './filler.js';

const paint = (geo, hex) => {
  const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
};
const B = (w, h, d, x, y, z, hex) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const Cy = (r, h, x, y, z, hex, n = 8) => paint(new THREE.CylinderGeometry(r, r, h, n).translate(x, y, z), hex);

// cubierta a dos aguas muy tendida: prisma triangular a lo largo del eje X
function gable(w, rise, d, y, hex) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, rise); s.closePath();
  return paint(new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, y, 0), hex);
}
// cubierta en diente de sierra (naves antiguas)
function sawtooth(w, d, y, hex, glass) {
  const parts = [], n = 4, step = w / n;
  for (let k = 0; k < n; k++) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(step, 0); s.lineTo(0, 2.1); s.closePath();
    parts.push(paint(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(-w / 2 + k * step, y, -d / 2), hex));
    parts.push(B(0.08, 1.7, d - 0.8, -w / 2 + k * step - 0.04, y + 0.95, 0, glass));
  }
  return parts;
}
// nave tipo de 30 × 22 m con la fachada hacia +Z
function nave(wall, trim, roof, kind) {
  const W = 30, H = 8, D = 22, F = D / 2 + 0.06, p = [B(W, H, D, 0, H / 2, 0, wall), B(W + 0.1, 0.9, D + 0.1, 0, 0.45, 0, 0x77767a), B(W + 0.16, 0.55, D + 0.16, 0, H - 0.5, 0, trim)];
  if (kind === 'saw') p.push(...sawtooth(W, D, H, roof, 0x4b6272));
  else if (kind === 'flat') p.push(B(W + 0.6, 0.35, D + 0.6, 0, H + 0.17, 0, roof), B(3, 1, 2.4, -7, H + 0.85, -3, 0xb9bbbd), B(2, 0.8, 2, 6, H + 0.75, 4, 0xa6a9ac));
  else p.push(gable(W + 0.5, 2.2, D + 0.8, H, roof));
  for (let x = -W / 2 + 1.25; x < W / 2; x += 2.5) p.push(B(0.12, H - 1.4, 0.06, x, H / 2 + 0.2, F, 0x000000 + ((wall >> 1) & 0x7f7f7f) + 0x303030)); // nervios de chapa
  for (const dx of [-9, 0]) { // portones enrollables
    p.push(B(5.2, 4.8, 0.14, dx, 2.4, F + 0.02, 0x4a4d53), B(4.7, 4.5, 0.16, dx, 2.25, F + 0.04, kind === 'saw' ? 0x2f5b8f : 0x8d9196));
    for (let y = 0.6; y < 4.4; y += 0.6) p.push(B(4.7, 0.07, 0.18, dx, y, F + 0.05, 0x666a70));
    p.push(B(0.25, 0.9, 0.5, dx - 3, 0.45, F + 0.3, 0xf2b705), B(0.25, 0.9, 0.5, dx + 3, 0.45, F + 0.3, 0xf2b705));
  }
  p.push(B(1.5, 2.4, 0.14, 7, 1.2, F + 0.02, 0x2c3138), B(7.4, 1.3, 0.2, 9, 5.9, F + 0.05, trim));
  for (let x = 9.6; x <= 13.2; x += 1.8) p.push(B(1.3, 1.2, 0.12, x, 2.4, F + 0.02, 0x34495a));
  for (let x = -12; x <= 12; x += 6) p.push(B(2.6, 0.7, 0.1, x, 6.9, -F, 0x34495a));
  return mergeGeometries(p);
}
const truck = () => {
  const p = [B(2.5, 2.7, 9.4, 0, 2.45, -1.6, 0xffffff), B(2.4, 2.5, 2.4, 0, 1.95, 4.7, 0xffffff), B(2.22, 0.95, 0.1, 0, 2.5, 5.93, 0x26323c), B(2.3, 0.35, 12.4, 0, 0.92, 0, 0x25272b)];
  for (const z of [-5.2, -3.8, 2.2, 4.9]) for (const x of [-1.12, 1.12]) p.push(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10).rotateZ(Math.PI / 2).translate(x, 0.55, z), 0x141518));
  return mergeGeometries(p);
};
const van = () => mergeGeometries([B(2, 1.55, 4.8, 0, 1.35, -0.2, 0xffffff), B(1.96, 0.95, 1.2, 0, 1.05, 2.7, 0xffffff), B(1.84, 0.62, 0.1, 0, 1.75, 2.24, 0x26323c), B(1.9, 0.4, 5.6, 0, 0.48, 0.2, 0x1a1b1f)]);
const car = () => mergeGeometries([B(1.85, 0.7, 4.3, 0, 0.68, 0, 0xffffff), B(1.7, 0.58, 2.15, 0, 1.31, -0.25, 0x26323c), B(1.74, 0.12, 1.9, 0, 1.62, -0.28, 0xffffff), B(1.95, 0.34, 3.1, 0, 0.34, 0, 0x16171a)]);
const container = () => {
  const p = [B(6.1, 2.6, 2.45, 0, 1.3, 0, 0xffffff)];
  for (let x = -2.7; x <= 2.7; x += 0.6) p.push(B(0.16, 2.3, 2.52, x, 1.3, 0, 0xcfcfcf));
  return mergeGeometries(p);
};
const lamp = () => mergeGeometries([Cy(0.12, 8, 0, 4, 0, 0x6d7278), B(0.12, 0.12, 2, 0, 8, 0.95, 0x6d7278), B(0.45, 0.18, 0.8, 0, 7.94, 2, 0xd9dde2)]);
const pole = () => mergeGeometries([Cy(0.18, 11, 0, 5.5, 0, 0x8d877c, 6), B(2.6, 0.14, 0.14, 0, 10.4, 0, 0x5e5952), B(2, 0.12, 0.12, 0, 9.6, 0, 0x5e5952)]);
const tyres = () => mergeGeometries([0, 1, 2].map((k) => paint(new THREE.TorusGeometry(0.46, 0.19, 6, 12).rotateX(Math.PI / 2).translate(0, 0.2 + k * 0.38, 0), k === 2 ? 0xc92a22 : 0x16171a)));
const pallets = () => mergeGeometries([0, 1, 2, 3].map((k) => B(1.2, 0.16, 1, (k % 2) * 0.07, 0.1 + k * 0.22, 0, k % 2 ? 0xb08d5e : 0x9a7a50)));

function chainTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(150,156,164,1)'; x.lineWidth = 3;
  for (let k = -64; k <= 128; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke(); x.beginPath(); x.moveTo(k, 64); x.lineTo(k + 64, 0); x.stroke(); }
  x.fillStyle = '#7c828a'; x.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function industrialDecor(tr, th, scene, rng, q, clearance, cxm, czm, R) {
  const dens = q.density, D = new THREE.Object3D(), tint = new THREE.Color();
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < tr.N; i++) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  // parcela del karting: deja sitio a boxes y gradas
  const P = WALL + 31, x0 = minX - P, x1 = maxX + P, z0 = minZ - P, z1 = maxZ + P, pick = (a) => a[Math.floor(rng() * a.length)];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const put = (geo, list, colors) => { // list: [x, z, giro, escalaX, escalaY, escalaZ, y]
    if (!list.length) { geo.dispose(); return; }
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, k) => { D.position.set(s[0], s[6] || 0, s[1]); D.rotation.set(0, s[2], 0); D.scale.set(s[3] || 1, s[4] || 1, s[5] || 1); D.updateMatrix(); m.setMatrixAt(k, D.matrix); if (colors) m.setColorAt(k, tint.setHex(colors[Math.floor(rng() * colors.length)])); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m);
  };
  const flat = (w, d, x, z, y, color) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); scene.add(m); };

  // ---- calles: un anillo junto a la parcela y una segunda manzana detrás, prolongadas hasta el horizonte ----
  const EXT = 300, dashes = [], kerbsList = [];
  const street = (horizontal, at, from, to, y) => {
    const len = to - from, mid = (from + to) / 2;
    flat(horizontal ? len : 11, horizontal ? 11 : len, horizontal ? mid : at, horizontal ? at : mid, y, 0x3d3f44);
    for (const s of [-1, 1]) kerbsList.push(horizontal ? [mid, at + s * 6.8, 0, len, 1, 1, 0] : [at + s * 6.8, mid, Math.PI / 2, len, 1, 1, 0]);
    for (let u = from + 3; u < to; u += 9) dashes.push(horizontal ? [u, at, 0, 1, 1, 1, y + 0.03] : [at, u, Math.PI / 2, 1, 1, 1, y + 0.03]);
  };
  const RING = 11, BACK = 74;
  [RING, BACK].forEach((o, k) => {
    const y = 0.05 + k * 0.006;
    street(true, z0 - o, x0 - o - (k ? EXT : 120), x1 + o + (k ? EXT : 120), y); street(true, z1 + o, x0 - o - (k ? EXT : 120), x1 + o + (k ? EXT : 120), y + 0.002);
    street(false, x0 - o, z0 - o - (k ? EXT : 120), z1 + o + (k ? EXT : 120), y + 0.004); street(false, x1 + o, z0 - o - (k ? EXT : 120), z1 + o + (k ? EXT : 120), y + 0.001);
  });
  put(B(1, 0.14, 2.4, 0, 0.07, 0, 0xb9b6ae), kerbsList.filter(([x, z]) => !(x > x0 && x < x1 && z > z0 && z < z1)));
  put(B(3.4, 0.02, 0.18, 0, 0, 0, 0xe8e6df), dashes);

  // ---- naves: filas mirando a la calle ----
  const defs = [[0xdedcd4, 0x1d4f91, 0x9ea3a8, 'gable'], [0xb9bec4, 0xc4291f, 0x7f858c, 'flat'], [0xd9c9a8, 0x3a3e45, 0xa9a49a, 'saw'], [0x8f9aa6, 0xf2b705, 0x6f757d, 'gable'], [0xcfcac0, 0x2e6e62, 0x8c8c8e, 'flat'], [0xa65a43, 0xe7e3da, 0x77706a, 'saw']];
  const rows = defs.map(() => []);
  const crossStreet = (a, b, u, half) => Math.abs(u - a) < half + 8 || Math.abs(u - b) < half + 8; // hueco donde pasan las calles perpendiculares
  const line = (side, off, extra, skip) => { // side: 0 norte, 1 sur, 2 oeste, 3 este
    const horizontal = side < 2, a = horizontal ? x0 : z0, b = horizontal ? x1 : z1;
    for (let u = a - extra; u < b + extra;) {
      const sx = 0.72 + rng() * 0.75, w = 30 * sx, sz = 0.75 + rng() * 0.35, sy = 0.8 + rng() * 0.5, cu = u + w / 2; u += w + 3 + rng() * 8;
      if (crossStreet(a - RING, b + RING, cu, w / 2) || crossStreet(a - BACK, b + BACK, cu, w / 2) || rng() < skip) continue;
      const d = off + 11 * sz, x = horizontal ? cu : side === 2 ? x0 - d : x1 + d, z = horizontal ? (side === 0 ? z0 - d : z1 + d) : cu;
      rows[Math.floor(rng() * rows.length)].push([x, z, [0, Math.PI, Math.PI / 2, -Math.PI / 2][side], sx, sy, sz]);
    }
  };
  for (let s = 0; s < 4; s++) {
    line(s, RING + 19, 8, 0.08);          // primera fila, con patio de carga delante
    line(s, BACK + 17, 150, 0.16);        // segunda manzana
    line(s, BACK + 62, 190, 0.34);
    if (dens >= 1) line(s, BACK + 118, 230, 0.5);
  }
  defs.forEach((d, k) => put(nave(...d), rows[k]));

  // ---- patios de las naves: camiones, furgonetas, contenedores y palés ----
  const trucks = [], vans = [], boxes = [], pals = [];
  rows.forEach((r) => r.forEach(([x, z, ry, sx, , sz]) => {
    const fx = Math.sin(ry), fz = Math.cos(ry), ax = Math.cos(ry), az = -Math.sin(ry), front = 11 * sz + 5;
    const at = (a, f) => [x + ax * a + fx * f, z + az * a + fz * f];
    const near = Math.hypot(x - cxm, z - czm) < R + 140;
    if (rng() < 0.45) { const p = at(-9 * sx, front + 1.2); trucks.push([p[0], p[1], ry + Math.PI / 2]); }
    if (near && rng() < 0.55) { const p = at(8 * sx, front - 1.6); vans.push([p[0], p[1], ry + Math.PI / 2]); }
    if (rng() < 0.3) { const p = at(15 * sx - 2, front - 3); boxes.push([p[0], p[1], ry]); if (rng() < 0.5) boxes.push([p[0], p[1], ry, 1, 1, 1, 2.62]); }
    if (near && rng() < 0.5) { const p = at(2 * sx, front - 3.4); pals.push([p[0], p[1], ry + rng() * 0.4]); }
  }));

  // ---- aparcamiento y calle: coches junto al bordillo ----
  const cars = [], lamps = [], poles = [];
  const along = (side, off, step, fn) => { const horizontal = side < 2, a = horizontal ? x0 : z0, b = horizontal ? x1 : z1; for (let u = a - off; u <= b + off; u += step) { const x = horizontal ? u : side === 2 ? x0 - off : x1 + off, z = horizontal ? (side === 0 ? z0 - off : z1 + off) : u; fn(x, z, horizontal); } };
  for (let s = 0; s < 4; s++) {
    along(s, RING + 4.2, 5.6, (x, z, h) => { if (rng() < 0.3 * dens) cars.push([x, z, h ? Math.PI / 2 : 0]); });
    along(s, RING - 6.4, 24, (x, z) => lamps.push([x, z, [Math.PI, 0, Math.PI / 2, -Math.PI / 2][s] + Math.PI]));
    along(s, BACK + 8, 38, (x, z, h) => poles.push([x, z, h ? Math.PI / 2 : 0]));
  }

  // ---- dentro de la parcela, lejos de boxes y gradas: aparcamiento, palés y pilas de neumáticos ----
  const tyreList = [];
  for (let g = 0; tyreList.length < Math.round(170 * dens) && g < 2600; g++) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, l = WALL + 2 + rng() * 5, x = tr.X[i] - tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
    if (tr.Y[i] < 0.4 && clearance(x, z, WALL + 1.4)) tyreList.push([x, z, rng() * 6.28]);
  }
  for (let s = 0; s < 4; s++) along(s, -3.2, 3.2, (x, z, h) => { if (x > x0 + 1 && x < x1 - 1 && z > z0 + 1 && z < z1 - 1 && rng() < 0.4 * dens && clearance(x, z, WALL + 22)) cars.push([x, z, h ? 0 : Math.PI / 2]); });

  put(truck(), trucks, [0xf2f2ef, 0xd8d9dc, 0xc4291f, 0x2159a6, 0xe3a21a]);
  put(van(), vans, [0xf4f4f1, 0xf4f4f1, 0xb9bec4, 0x2159a6]);
  put(container(), boxes, [0xa8322a, 0x1f4f86, 0x2e6e52, 0xc98a1c, 0x75787d]);
  put(pallets(), pals);
  put(car(), cars, [0xc41e22, 0x22477f, 0xe9eaec, 0x1e2126, 0xadb1b8, 0x6d7076]);
  put(lamp(), lamps);
  put(pole(), poles);
  put(tyres(), tyreList);

  // ---- cables del tendido ----
  { const pts = []; for (let k = 1; k < poles.length; k++) { const a = poles[k - 1], b = poles[k]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 45) continue; for (const y of [10.45, 9.65]) pts.push(a[0], y, a[1], b[0], y, b[1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2b2d31 }))); }

  // ---- valla metálica de la parcela ----
  { const tex = chainTex(), posts = [];
    const fence = (w, x, z, ry) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 2.4, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.3, side: THREE.DoubleSide })); m.position.set(x, 1.2, z); m.rotation.y = ry; scene.add(m); };
    fence(x1 - x0, (x0 + x1) / 2, z0, 0); fence(x1 - x0, (x0 + x1) / 2, z1, 0); fence(z1 - z0, x0, (z0 + z1) / 2, Math.PI / 2); fence(z1 - z0, x1, (z0 + z1) / 2, Math.PI / 2);
    for (let x = x0; x <= x1; x += 4.8) posts.push([x, z0, 0], [x, z1, 0]);
    for (let z = z0; z <= z1; z += 4.8) posts.push([x0, z, 0], [x1, z, 0]);
    put(Cy(0.07, 2.7, 0, 1.35, 0, 0x6d7278, 5), posts); }

  // ---- chimeneas y depósitos a media distancia ----
  { const stacks = [], tanks = [];
    for (let k = 0; k < 5; k++) { const a = rng() * 6.283, d = R + P + BACK + 90 + rng() * 130; stacks.push([cxm + Math.cos(a) * d, czm + Math.sin(a) * d, 0, 1, 0.8 + rng() * 0.6, 1]); }
    for (let k = 0; k < 6; k++) { const a = rng() * 6.283, d = R + P + BACK + 60 + rng() * 150; tanks.push([cxm + Math.cos(a) * d, czm + Math.sin(a) * d, 0, 0.8 + rng() * 0.6, 0.8 + rng() * 0.8, 0.8 + rng() * 0.6]); }
    put(mergeGeometries([Cy(1.6, 34, 0, 17, 0, 0xc9c4ba, 12), Cy(1.72, 2.4, 0, 31, 0, 0xc4291f, 12), Cy(1.72, 2.4, 0, 26, 0, 0xc4291f, 12)]), stacks);
    put(mergeGeometries([Cy(7, 11, 0, 5.5, 0, 0xd6d8da, 16), paint(new THREE.ConeGeometry(7.2, 1.8, 16).translate(0, 11.9, 0), 0xa9adb2)]), tanks);
  }
  backdrop(scene, pick(['poligono']), cxm, czm, R, 520);
}
