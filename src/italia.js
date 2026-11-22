// Italia (estilo PS2): paseo junto al lago con balaustrada, pueblo de piedra, cipreses, un coliseo con arcos de verdad
// y casas de colores en el acantilado. Geometría detallada pero barata: color por vértice con sombreado "horneado",
// texturas pequeñas, todo fusionado en pocas mallas o repetido por instancias.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL, ROAD_HALF } from './track.js';

export const NODES = [[-130, 0], [-70, -3], [0, 2], [70, -2], [115, 4], [145, 28], [152, 62], [138, 98], [112, 124], [72, 138], [30, 146], [-15, 156], [-58, 150], [-92, 132], [-118, 104], [-146, 74], [-160, 40], [-152, 14]];
export const START = [-60, -2];
export const HILLS = [[0, 0], [0.12, 0], [0.3, 6], [0.45, 11], [0.6, 12], [0.75, 7], [0.9, 0.5], [1, 0]];

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), l = (p, q, t) => p + (q - p) * t; return l(l(hash(xi, yi), hash(xi + 1, yi), a), l(hash(xi, yi + 1), hash(xi + 1, yi + 1), a), b); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 11, y * 4.3 + 5) * 0.15;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SEA = -0.35;
const rnd = (k) => hash(k * 1.37, k * 0.71);

// ---------- texturas (64-256 px, filtradas, como en consola) ----------
function tex(w, h, paint, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const speck = (x, W, H, n, rgba, s0 = 1, s1 = 4, seed = 0) => { for (let i = 0; i < n; i++) { x.fillStyle = rgba(i); x.fillRect(rnd(i + seed) * W, rnd(i + seed + 999) * H, s0 + rnd(i + seed + 3) * s1, s0 + rnd(i + seed + 7) * s1 * 0.7); } };
const rrect = (x, a, b, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); x.fill(); };
// mampostería irregular: piedras de distintos tamaños y tonos, llagas hundidas
const stoneTex = () => tex(256, 256, (x, W, H) => {
  x.fillStyle = '#5e564b'; x.fillRect(0, 0, W, H); let k = 0;
  for (let y = 0; y < H;) { const rh = 14 + rnd(k++) * 16; let px = -rnd(k++) * 20; while (px < W) { const w = 18 + rnd(k++) * 34, v = 170 + rnd(k++) * 70 | 0, tint = rnd(k++) * 18 | 0, r = 3 + rnd(k++) * 6;
      x.fillStyle = `rgb(${v + tint},${v - 4},${v - 18 - tint})`; rrect(x, px + 2, y + 2 + rnd(k++) * 2, w - 4, rh - 4, r);
      x.fillStyle = 'rgba(255,248,230,.16)'; x.fillRect(px + 4, y + 3, w - 8, 2); x.fillStyle = 'rgba(40,30,20,.22)'; x.fillRect(px + 4, y + rh - 5, w - 8, 2); px += w; } y += rh; }
  speck(x, W, H, 900, (i) => `rgba(${50 + rnd(i) * 40 | 0},${45 + rnd(i) * 30 | 0},30,${0.05 + rnd(i + 5) * 0.12})`, 1, 3);
});
// enlucido: liso con manchas de humedad y desconchones (el color lo pone cada casa)
const plasterTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#f4efe6'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(rnd(i) * W, rnd(i + 3) * H, 0, rnd(i) * W, rnd(i + 3) * H, 8 + rnd(i + 5) * 26); g.addColorStop(0, `rgba(150,120,90,${0.06 + rnd(i + 7) * 0.1})`); g.addColorStop(1, 'rgba(150,120,90,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  speck(x, W, H, 260, (i) => `rgba(110,90,70,${0.04 + rnd(i) * 0.08})`, 1, 3, 40);
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(190,170,145,.55)'; x.fillRect(rnd(i + 70) * W, rnd(i + 80) * H, 6 + rnd(i) * 10, 4 + rnd(i + 1) * 6); }
});
// fachada lejana (Cinque Terre): un vano con contraventanas y alféizar
const facadeTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#f2ede2'; x.fillRect(0, 0, W, H); speck(x, W, H, 200, (i) => `rgba(150,120,90,${0.04 + rnd(i) * 0.08})`, 2, 10);
  x.fillStyle = 'rgba(120,90,60,.3)'; x.fillRect(0, 0, W, 5);
  x.fillStyle = '#e8dfcb'; x.fillRect(38, 34, 52, 64);
  x.fillStyle = '#3e5b3a'; x.fillRect(24, 38, 16, 54); x.fillRect(88, 38, 16, 54); x.fillStyle = '#2f4a2c'; for (let y = 41; y < 92; y += 4) { x.fillRect(26, y, 12, 1.5); x.fillRect(90, y, 12, 1.5); }
  x.fillStyle = '#231f1b'; x.fillRect(44, 40, 40, 52); x.fillStyle = '#4c4238'; x.fillRect(62, 40, 3, 52); x.fillRect(44, 62, 40, 2);
  x.fillStyle = '#efe7d6'; x.fillRect(36, 92, 56, 5); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(36, 97, 56, 3);
});
// tejas árabes en hileras (gris cálido; el tono terracota lo pone el vértice)
const roofTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#6a5a50'; x.fillRect(0, 0, W, H);
  for (let c = 0; c < 8; c++) for (let r = -1; r < 6; r++) { const px = c * 16, py = r * 22 + (c % 2) * 6, v = 200 + rnd(c * 9 + r + 20) * 50 | 0, g = x.createLinearGradient(px, 0, px + 16, 0);
    g.addColorStop(0, `rgb(${v - 70},${v - 80},${v - 85})`); g.addColorStop(0.5, `rgb(${v},${v - 8},${v - 14})`); g.addColorStop(1, `rgb(${v - 80},${v - 90},${v - 95})`); x.fillStyle = g; rrect(x, px + 1, py, 14, 24, 6);
    x.fillStyle = 'rgba(40,25,15,.35)'; x.fillRect(px + 1, py + 20, 14, 3); }
  speck(x, W, H, 160, (i) => `rgba(${rnd(i) < 0.5 ? '60,70,40' : '30,25,20'},${0.1 + rnd(i + 2) * 0.15})`, 1, 4, 300);
});
// travertino del coliseo: sillares horizontales porosos
const travTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#b9a98c'; x.fillRect(0, 0, W, H);
  for (let r = 0; r < 8; r++) { let px = (r % 2) * -20; while (px < W) { const w = 30 + rnd(r * 17 + px) * 26, v = 215 + rnd(r * 31 + px) * 35 | 0; x.fillStyle = `rgb(${v},${v - 10},${v - 30})`; x.fillRect(px + 1, r * 16 + 1, w - 2, 14); px += w; } }
  speck(x, W, H, 700, (i) => `rgba(${90 + rnd(i) * 40 | 0},${75 + rnd(i) * 30 | 0},50,${0.08 + rnd(i + 1) * 0.2})`, 1, 2.5, 500);
  for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(70,55,40,.18)'; x.fillRect(rnd(i + 800) * W, rnd(i + 820) * H, 1.5, 6 + rnd(i) * 14); }
});
// hierba seca y verde mezclada, con briznas
const grassTex = () => tex(256, 256, (x, W, H) => {
  x.fillStyle = '#9a9a8a'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const px = rnd(i) * W, py = rnd(i + 11) * H, v = 130 + rnd(i + 5) * 125 | 0, l = 3 + rnd(i + 9) * 7, a = (rnd(i + 13) - 0.5) * 1.2; x.strokeStyle = `rgb(${v},${v},${v - 20})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * l, py - Math.cos(a) * l); x.stroke(); }
  speck(x, W, H, 120, () => 'rgba(90,80,60,.25)', 3, 8, 77);
});
const leafTex = () => { const t = tex(128, 128, (x, W, H) => { x.fillStyle = '#7a7a74'; x.fillRect(0, 0, W, H); for (let i = 0; i < 1300; i++) { const v = 110 + rnd(i) * 145 | 0; x.fillStyle = `rgb(${v},${v},${v - 10})`; x.beginPath(); x.ellipse(rnd(i + 3) * W, rnd(i + 8) * H, 1.2 + rnd(i + 5) * 2.4, 0.8 + rnd(i + 6) * 1.4, rnd(i + 2) * 3, 0, 6.3); x.fill(); } }); t.repeat.set(3, 5); return t; };
const paveTex = () => tex(128, 128, (x, W, H) => { x.fillStyle = '#7d766a'; x.fillRect(0, 0, W, H); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = 200 + rnd(r * 4 + c) * 40 | 0, w = W / 3, o = (r % 2) * w / 2; x.fillStyle = `rgb(${v},${v - 6},${v - 18})`; x.fillRect(c * w - o + 1.5, r * 32 + 1.5, w - 3, 29); } speck(x, W, H, 500, (i) => `rgba(80,70,55,${0.05 + rnd(i) * 0.12})`, 1, 3, 60); });
// matas de hierba (con transparencia): cruz de dos planos
const tuftTex = () => tex(64, 64, (x, W, H) => { for (let i = 0; i < 40; i++) { const px = 6 + rnd(i) * 52, l = 22 + rnd(i + 4) * 38, a = (rnd(i + 9) - 0.5) * 0.7, v = 120 + rnd(i + 2) * 110 | 0; x.strokeStyle = `rgb(${v * 0.75 | 0},${v},${v * 0.45 | 0})`; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, H); x.quadraticCurveTo(px + Math.sin(a) * l * 0.5, H - l * 0.6, px + Math.sin(a) * l, H - l); x.stroke(); } }, false);
// normales del agua: ondas suaves que se desplazan
function waterNormals() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), h = (u, v) => Math.sin((u + v) * 6.283 * 3) * 0.5 + Math.sin((v * 2 - u) * 6.283 * 5 + 1) * 0.3 + Math.sin((u * 3 + v * 2) * 6.283 * 7) * 0.2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S, e = 1 / S, dx = (h(u + e, v) - h(u - e, v)) * 2, dy = (h(u, v + e) - h(u, v - e)) * 2, l = Math.hypot(dx, dy, 1), k = (j * S + i) * 4; im.data[k] = (-dx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- utilidades de geometría ----------
const C = new THREE.Color();
// color por vértice con oclusión "horneada": la base de cada pieza más oscura que la cima
function paint(g, hex, ao = 0.3, jit = 0) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  C.set(hex); if (jit) C.offsetHSL(0, 0, jit);
  for (let i = 0; i < n; i++) { const t = y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1, k = 1 - ao * (1 - t); col[i * 3] = C.r * k; col[i * 3 + 1] = C.g * k; col[i * 3 + 2] = C.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// caja con UV en metros: con round, cada cara repite un número entero de veces (vanos de fachada) y la tapa usa un trozo liso
function boxM(w, h, d, sx = 3.4, sy = 3, round = true) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v, [fw, fh] = dims[f]; if (round && (f === 2 || f === 3)) { uv.setXY(k, 0.02, 0.6); continue; } const ru = round ? Math.max(1, Math.round(fw / sx)) : fw / sx, rv = round ? Math.max(1, Math.round(fh / sy)) : fh / sy; uv.setXY(k, uv.getX(k) * ru, uv.getY(k) * rv); }
  return g;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), E = new THREE.Euler();
const place = (g, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0) => g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, 0, 'YXZ')), S3.set(sx, sy, sz)));
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// desplaza cada vértice con ruido: copas, rocas y flores dejan de ser sólidos perfectos
function lumpy(g, amt, seed = 0) { g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (vnoise(x * 2.3 + seed, z * 2.3 + y * 1.7) - 0.5) * amt; p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.4), z * k); } g.computeVertexNormals(); return g; }
// tejado a cuatro aguas con UV de tejas; la cumbrera va a lo largo del lado mayor
function hipRoof(W, D, rh) {
  const sw = W < D, A = sw ? D : W, Bd = sw ? W : D, rx = Math.max(0, (A - Bd) / 2), pos = [], uv = [];
  const tri = (p0, p1, p2, f) => { for (const p of [p0, p1, p2]) { pos.push(...p); uv.push(f ? p[2] / 2.4 : p[0] / 2.4, f ? p[0] / 2.4 : p[2] / 2.4); } };
  const e = [[-A / 2, 0, Bd / 2], [A / 2, 0, Bd / 2], [A / 2, 0, -Bd / 2], [-A / 2, 0, -Bd / 2]], r0 = [-rx, rh, 0], r1 = [rx, rh, 0];
  tri(e[0], e[1], r1, false); tri(e[0], r1, r0, false); tri(e[2], e[3], r0, false); tri(e[2], r0, r1, false); tri(e[1], e[2], r1, true); tri(e[3], e[0], r0, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const cap = boxM(rx * 2 + 0.3, 0.2, 0.32, 0.6, 0.6, false).translate(0, rh + 0.04, 0);
  if (sw) { g.rotateY(Math.PI / 2); cap.rotateY(Math.PI / 2); }
  return [g, cap];
}

function softTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
export function italiaDecor(tr, th, scene, q) {
  const N = tr.N, L = WALL, mobile = q.density < 1, shadow = !!q.shadows, G = new THREE.Group(); scene.add(G);
  const bins = { plain: [], plaster: [], facade: [], stone: [], trav: [], roof: [] };
  const add = (k, g) => bins[k].push(g);
  bins.lit = [];
  const dusk = !!th.dusk, glows = []; // luces con halo: [x, y, z, tamaño, color, intensidad]
  const glow = (x, y, z, size, hex, k) => glows.push([x, y, z, size, hex, k]);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < N; i += 4) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const cs = 16, gridT = new Map(); for (let i = 0; i < N; i += 2) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (gridT.get(k) || gridT.set(k, []).get(k)).push(i); }
  const roadDist = (x, z, r = 40) => { const a = Math.floor(x / cs), b = Math.floor(z / cs), rr = Math.ceil(r / cs); let best = r * r; for (let p = -rr; p <= rr; p++) for (let t = -rr; t <= rr; t++) { const l = gridT.get((a + p) + ',' + (b + t)); if (l) for (const j of l) { const d = (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2; if (d < best) best = d; } } return Math.sqrt(best); };
  const hw = (k) => (tr.hw ? tr.hw[k] : ROAD_HALF);
  const side = (i, s, l) => [tr.X[i] - tr.TZ[i] * l * s, tr.Z[i] + tr.TX[i] * l * s];
  const yawAt = (i) => Math.atan2(tr.TX[i], tr.TZ[i]);

  // ---- coliseo: en el interior del trazado, pegado a la carretera de arriba ----
  let CA = 46, CB = 36, CX = cx - 12, CZ = cz + 22;
  const ellD = (x, z, a = CA, b = CB) => Math.hypot((x - CX) / a, (z - CZ) / b);
  for (let it = 0; it < 30; it++) { let mind = 1e9; for (let i = 0; i < N; i += 3) { const r = ellD(tr.X[i], tr.Z[i]); if (r < mind) mind = r; } const gap = (mind - 1) * Math.min(CA, CB); if (gap > L + 7) break; CA *= 0.95; CB *= 0.95; }

  // ---- terreno: la pista manda cerca; lejos, lago al sur, colinas al norte y un promontorio al este ----
  const shoreZ = (x) => -10.5 + 1.5 * Math.sin(x / 60) - (x > 210 ? (x - 210) * 1.25 : 0) + (x < -230 ? (x + 230) * 0.5 : 0);
  const target = (x, z) => {
    const s = z - shoreZ(x);
    if (s < 0) return SEA - 1.6 - Math.min(-s, 60) * 0.12;
    const north = sstep(170, 700, z) * (60 + 80 * fbm(x / 260, z / 260)), east = x > 200 ? Math.min(85, Math.max(0, s) * 0.55) * sstep(200, 260, x) : 0;
    return 0.6 + Math.min(s, 30) * 0.08 + 5 * fbm(x / 70, z / 70) * sstep(0, 40, s) + north + east + 1.4 * (vnoise(x / 9, z / 9) - 0.5) * sstep(20, 60, s);
  };
  const HALF = 900, step = mobile ? 14 : 8, n = Math.ceil((2 * HALF) / step) + 1, x0 = cx - HALF, z0 = cz - HALF, id = (a, b) => b * n + a;
  const H = new Float32Array(n * n).fill(1e9), fixed = new Uint8Array(n * n), D = new Float32Array(n * n).fill(1e9);
  const mark = (x, z, y) => { const a = Math.round((x - x0) / step), b = Math.round((z - z0) / step); if (a < 0 || b < 0 || a >= n || b >= n) return; const k = id(a, b); fixed[k] = 1; D[k] = 0; if (y < H[k]) H[k] = y; };
  for (let i = 0; i < N; i += 2) for (let l = -L - 1; l <= L + 1; l += step * 0.5) mark(tr.X[i] - tr.TZ[i] * l, tr.Z[i] + tr.TX[i] * l, tr.Y[i] - 0.35);
  const relax = (a, b, dd) => { if (D[b] + dd < D[a]) { D[a] = D[b] + dd; if (!fixed[a]) H[a] = H[b]; } };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = id(c, r); if (c) relax(k, k - 1, step); if (r) { relax(k, k - n, step); if (c) relax(k, k - n - 1, step * 1.414); if (c < n - 1) relax(k, k - n + 1, step * 1.414); } }
  for (let r = n - 1; r >= 0; r--) for (let c = n - 1; c >= 0; c--) { const k = id(c, r); if (c < n - 1) relax(k, k + 1, step); if (r < n - 1) { relax(k, k + n, step); if (c < n - 1) relax(k, k + n + 1, step * 1.414); if (c) relax(k, k + n - 1, step * 1.414); } }
  let PL = 0; { const a = Math.round((CX - x0) / step), b = Math.round((CZ - z0) / step); PL = H[id(a, b)] - 0.2; }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const k = id(c, r); if (fixed[k]) continue; const x = x0 + c * step, z = z0 + r * step, T = target(x, z);
    let h = H[k] + (T - H[k]) * (T < SEA ? sstep(0.5, 6, D[k]) : sstep(3, 46, D[k]));
    const e = ellD(x, z); if (e < 1.35) h = h + (PL - h) * sstep(1.35, 1.05, e);
    H[k] = h;
  }
  for (let t = 0; t < (mobile ? 3 : 5); t++) for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) { const k = id(c, r); if (!fixed[k] && H[k] > SEA - 0.5) H[k] = (H[k] * 2 + H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) / 6; }
  const hAt = (x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / step)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / step)), a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, k = id(a, b); return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n] * (1 - u) + H[k + n + 1] * u) * v; };
  const slopeAt = (x, z) => Math.hypot(hAt(x + 4, z) - hAt(x - 4, z), hAt(x, z + 4) - hAt(x, z - 4)) / 8;
  {
    const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), col = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6);
    const cG = new THREE.Color(0x6a8a38), cG2 = new THREE.Color(0x4f6e2c), cDry = new THREE.Color(0xb39a5e), cRock = new THREE.Color(0x9a8b76), cSand = new THREE.Color(0xcdbb92), cWet = new THREE.Color(0x6d6450), c = new THREE.Color();
    for (let r = 0; r < n; r++) for (let q2 = 0; q2 < n; q2++) {
      const k = id(q2, r), x = x0 + q2 * step, z = z0 + r * step, y = H[k], sl = slopeAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
      c.copy(cG).lerp(cG2, sstep(0.4, 0.7, fbm(x / 30 + 9, z / 30))).lerp(cDry, sstep(0.38, 0.75, fbm(x / 55, z / 55))).lerp(cRock, sstep(0.8, 1.6, sl));
      if (y < SEA + 0.9) c.lerp(y < SEA ? cWet : cSand, 0.85);
      c.multiplyScalar(0.8 + 0.3 * fbm(x / 13 + 4, z / 13));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    let t = 0; for (let r = 0; r < n - 1; r++) for (let q2 = 0; q2 < n - 1; q2++) { const k = id(q2, r); idx[t++] = k; idx[t++] = k + n; idx[t++] = k + 1; idx[t++] = k + 1; idx[t++] = k + n; idx[t++] = k + n + 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: grassTex(), vertexColors: true })); m.frustumCulled = false; m.receiveShadow = shadow; G.add(m);
  }
  // ---- lago: turquesa en la orilla, azul profundo mar adentro; ondas que se mueven y reflejo del sol ----
  {
    const S = 3200, seg = mobile ? 48 : 80, g = new THREE.PlaneGeometry(S, S, seg, seg).rotateX(-Math.PI / 2).translate(cx, SEA, cz - 400), p = g.attributes.position, col = new Float32Array(p.count * 3), sh = new THREE.Color(dusk ? 0x4c9f9c : 0x5cb8b0), deep = new THREE.Color(dusk ? 0x1a3f6c : 0x1f5a84), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const dep = SEA - hAt(p.getX(i), p.getZ(i)); c.copy(sh).lerp(deep, sstep(0.3, 6, dep)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const nm = waterNormals(); nm.repeat.set(140, 140);
    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, specular: dusk ? 0xffa352 : 0xc29a62, shininess: dusk ? 46 : 110, normalMap: nm, normalScale: dusk ? new THREE.Vector2(0.8, 0.8) : new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.93 });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 1; m.onBeforeRender = () => { const t = performance.now() / 1000; nm.offset.set(t * 0.006, t * 0.004); }; G.add(m);
  }

  // ---- muros de piedra: pretil bajo con balaustrada junto al lago, muro con albardilla en el pueblo ----
  const lake = new Uint8Array(N * 2); // por lado: 1 si al otro lado del muro hay agua
  for (const s of [-1, 1]) for (let i = 0; i < N; i++) { const o = side(i, s, L + 2.5); lake[i * 2 + (s > 0 ? 1 : 0)] = hAt(o[0], o[1]) < SEA ? 1 : 0; }
  const isLake = (i, s) => lake[(((i % N) + N) % N) * 2 + (s > 0 ? 1 : 0)];
  const wallTop = (i, s) => { const y = tr.Y[i], o = side(i, s, L + 2.5), g2 = hAt(o[0], o[1]); return isLake(i, s) ? y + 0.42 : Math.max(y + 1.05, Math.min(g2 + 0.5, y + 3.5)); };
  {
    const pos = [], uvs = [], cols = [], stride = mobile ? 2 : 1, pt = (i, s, l, y) => [tr.X[i] - tr.TZ[i] * l * s, y, tr.Z[i] + tr.TX[i] * l * s];
    const quad = (a, b, c2, d, ua, ub, va, vb, va2, vb2, k0, k1) => { pos.push(...a, ...c2, ...b, ...b, ...c2, ...d); uvs.push(ua, va, ub, va2, ua, vb, ua, vb, ub, va2, ub, vb2); for (const k of [k0, k0, k1, k1, k0, k1]) cols.push(k * 0.92, k * 0.85, k * 0.72); };
    for (const s of [-1, 1]) for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, hi = tr.Y[i], hj = tr.Y[j], oi = side(i, s, L + 2.5), oj = side(j, s, L + 2.5), gi = hAt(oi[0], oi[1]), gj = hAt(oj[0], oj[1]), lk = isLake(i, s) || isLake(j, s);
      const top = (y, g2) => lk ? y + 0.42 : Math.max(y + 1.05, Math.min(g2 + 0.5, y + 3.5)), foot = (y, g2) => Math.min(y - 0.3, g2 - 0.8);
      const ti = top(hi, gi), tj = top(hj, gj), fi = foot(hi, gi), fj = foot(hj, gj), u0 = (i * tr.ds) / 3.2, u1 = u0 + (stride * tr.ds) / 3.2;
      quad(pt(i, s, L, hi - 0.06), pt(i, s, L, ti), pt(j, s, L, hj - 0.06), pt(j, s, L, tj), u0, u1, hi / 3.2, ti / 3.2, hj / 3.2, tj / 3.2, 0.72, 1);
      quad(pt(i, s, L + 0.55, ti), pt(i, s, L + 0.55, fi), pt(j, s, L + 0.55, tj), pt(j, s, L + 0.55, fj), u0, u1, ti / 3.2, fi / 3.2, tj / 3.2, fj / 3.2, 0.95, 0.5);
      quad(pt(i, s, L - 0.1, ti + 0.14), pt(i, s, L + 0.65, ti + 0.14), pt(j, s, L - 0.1, tj + 0.14), pt(j, s, L + 0.65, tj + 0.14), u0, u1, 0.05, 0.28, 0.05, 0.28, 1.18, 1.18);
      quad(pt(i, s, L - 0.1, ti), pt(i, s, L - 0.1, ti + 0.14), pt(j, s, L - 0.1, tj), pt(j, s, L - 0.1, tj + 0.14), u0, u1, 0.05, 0.1, 0.05, 0.1, 1.08, 1.08);
      quad(pt(i, s, L + 0.65, ti + 0.14), pt(i, s, L + 0.65, ti), pt(j, s, L + 0.65, tj + 0.14), pt(j, s, L + 0.65, tj), u0, u1, 0.05, 0.1, 0.05, 0.1, 1.02, 1.02);
      if (lk) { // pasamanos de la balaustrada
        const ri = hi + 1.02, rj = hj + 1.02;
        quad(pt(i, s, L - 0.02, ri + 0.13), pt(i, s, L + 0.57, ri + 0.13), pt(j, s, L - 0.02, rj + 0.13), pt(j, s, L + 0.57, rj + 0.13), u0, u1, 0.05, 0.25, 0.05, 0.25, 1.2, 1.2);
        quad(pt(i, s, L - 0.02, ri), pt(i, s, L - 0.02, ri + 0.13), pt(j, s, L - 0.02, rj), pt(j, s, L - 0.02, rj + 0.13), u0, u1, 0.05, 0.1, 0.05, 0.1, 1.05, 1.05);
        quad(pt(i, s, L + 0.57, ri + 0.13), pt(i, s, L + 0.57, ri), pt(j, s, L + 0.57, rj + 0.13), pt(j, s, L + 0.57, rj), u0, u1, 0.05, 0.1, 0.05, 0.1, 0.95, 0.95);
        quad(pt(i, s, L - 0.02, ri), pt(i, s, L + 0.57, ri), pt(j, s, L - 0.02, rj), pt(j, s, L + 0.57, rj), u0, u1, 0.05, 0.1, 0.05, 0.1, 0.7, 0.7);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: stoneTex(), vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; m.receiveShadow = shadow; m.castShadow = shadow; G.add(m);
  }
  // pilastras con remate cada pocos metros (y maceta de barro con flores en algunas)
  { const every = Math.max(2, Math.round(9 / tr.ds)); for (const s of [-1, 1]) for (let i = 0; i < N; i += every) { const lk = isLake(i, s), [x, z] = side(i, s, L + 0.27), y = tr.Y[i], yaw = yawAt(i), top = lk ? y + 1.15 : wallTop(i, s) + 0.14;
      add('stone', paint(place(boxM(0.85, top - y + 0.4, 0.85, 1.6, 1.6, false), x, (top + y - 0.4) / 2, z, yaw), 0xe0d2b8, 0.35));
      add('plain', paint(place(B(1.05, 0.16, 1.05), x, top + 0.08, z, yaw), 0xeadfca, 0.1)); add('plain', paint(place(B(0.75, 0.12, 0.75), x, top + 0.22, z, yaw), 0xe2d6bf, 0.1));
      if (!lk && hash(i, s) < 0.35) { add('plain', paint(place(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.2, 0.08], [0.3, 0.36], [0.33, 0.42], [0.3, 0.45], [0, 0.45]].map(([a, b]) => new THREE.Vector2(a, b)), 9), x, top + 0.28, z), 0xb8653c, 0.35)); add('plain', paint(place(lumpy(new THREE.IcosahedronGeometry(0.34, 1), 0.7, i), x, top + 0.8, z, 0, 1, 0.75, 1), hash(i, 2) < 0.4 ? 0xc94a7e : 0x4f7a34, 0.45)); }
    } }
  // balaustres entre pilastras del lado del lago (instancias)
  const balus = []; { const sp = mobile ? 0.5 : 0.34; for (const s of [-1, 1]) { let acc = 0; for (let i = 0; i < N; i++) { acc += tr.ds; if (acc < sp) continue; acc = 0; if (!isLake(i, s)) continue; const [x, z] = side(i, s, L + 0.27); balus.push([x, z, tr.Y[i] + 0.84, 0]); } } }

  // ---- aceras: bordillo de piedra y losas, un palmo por encima del asfalto ----
  {
    const pos = [], uvs = [], cols = [], stride = mobile ? 2 : 1, P = (i, l, y) => [tr.X[i] - tr.TZ[i] * l, y, tr.Z[i] + tr.TX[i] * l];
    const quad = (a, b, c2, d, u, k) => { pos.push(...a, ...c2, ...b, ...b, ...c2, ...d); uvs.push(u[0], u[1], u[2], u[3], u[4], u[5], u[4], u[5], u[2], u[3], u[6], u[7]); for (let t = 0; t < 6; t++) cols.push(k, k * 0.98, k * 0.94); };
    for (const s of [-1, 1]) for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, yi = tr.Y[i], yj = tr.Y[j], hi = hw(i) + 0.05, hj = hw(j) + 0.05, u0 = i * tr.ds / 2.4, u1 = (i + stride) * tr.ds / 2.4, kb = 0.3;
      quad(P(i, s * hi, yi + 0.01), P(i, s * hi, yi + 0.14), P(j, s * hj, yj + 0.01), P(j, s * hj, yj + 0.14), [0, u0, 0, u1, 0.06, u0, 0.06, u1], 0.78);
      quad(P(i, s * hi, yi + 0.14), P(i, s * (hi + kb), yi + 0.14), P(j, s * hj, yj + 0.14), P(j, s * (hj + kb), yj + 0.14), [0, u0, 0, u1, 0.12, u0, 0.12, u1], 1.12);
      quad(P(i, s * (hi + kb), yi + 0.13), P(i, s * (L + 0.02), yi + 0.13), P(j, s * (hj + kb), yj + 0.13), P(j, s * (L + 0.02), yj + 0.13), [0.15, u0, 0.15, u1, (L - hi) / 2.4, u0, (L - hj) / 2.4, u1], 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: paveTex(), color: 0xeadcc2, vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; m.receiveShadow = shadow; G.add(m);
  }

  // ---- coliseo: tres órdenes de arcos huecos con columnas adosadas, ático, galería interior y graderío ----
  {
    const nb = mobile ? 36 : 48, tierH = 8.2, depth = 2.6, ruin = (a) => sstep(0.25, 0.85, Math.max(0, -Math.sin(a + 0.5))), base = PL - 2.5;
    const ell = (a, s = 1) => [CX + Math.cos(a) * CA * s, CZ + Math.sin(a) * CB * s];
    const normalAt = (a) => { const nx = CB * Math.cos(a), nz = CA * Math.sin(a), l = Math.hypot(nx, nz); return [nx / l, nz / l]; };
    const per = Math.PI * (3 * (CA + CB) - Math.sqrt((3 * CA + CB) * (CA + 3 * CB))), bw = (per / nb) * 1.03;
    const bayGeo = (ow, sill, sp) => { // panel con arco hueco, extruido hacia dentro (z local)
      const s = new THREE.Shape(); s.moveTo(-bw / 2, 0); s.lineTo(bw / 2, 0); s.lineTo(bw / 2, tierH); s.lineTo(-bw / 2, tierH); s.lineTo(-bw / 2, 0);
      const hole = new THREE.Path(); hole.moveTo(-ow / 2, sill); hole.lineTo(ow / 2, sill); hole.lineTo(ow / 2, sp); hole.absarc(0, sp, ow / 2, 0, Math.PI, false); hole.lineTo(-ow / 2, sill); s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: mobile ? 4 : 7 }); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4); return g;
    };
    const bays = [bayGeo(bw * 0.56, 0.05, tierH * 0.5), bayGeo(bw * 0.52, 1.1, tierH * 0.52), boxM(bw, tierH * 0.75, depth, 4, 4, false).translate(0, tierH * 0.375, depth / 2)];
    const colG = mobile ? null : new THREE.CylinderGeometry(0.42, 0.46, tierH - 1.4, 8, 1, false, 0, Math.PI).rotateY(Math.PI / 2);
    for (let k = 0; k < nb; k++) {
      const a = (k + 0.5) / nb * Math.PI * 2, [px, pz] = ell(a), [nx, nz] = normalAt(a), yaw = Math.atan2(-nx, -nz), r = ruin(a);
      const tiers = r > 0.05 ? Math.max(1, Math.min(4, Math.round(4 - r * 2.6 - hash(k, 7) * 0.9))) : 4;
      for (let t = 0; t < tiers; t++) {
        const y = base + 2.5 + t * tierH, broken = t === tiers - 1 && tiers < 4, g = bays[t === 3 ? 2 : t === 0 ? 0 : 1].clone();
        if (broken) { const p = g.attributes.position; for (let v = 0; v < p.count; v++) if (p.getY(v) > tierH * 0.6) p.setY(v, tierH * (0.62 + hash(k, Math.round(p.getX(v) * 3)) * 0.3)); g.computeVertexNormals(); }
        add('trav', paint(place(g, px, y, pz, yaw), 0xf3e6cb, 0.32, (hash(k, t) - 0.5) * 0.05));
        if (t === 0) add('trav', paint(place(boxM(bw, 2.6, depth, 4, 4, false).translate(0, -1.3, depth / 2), px, y, pz, yaw), 0xe6d6b4, 0.45));
        if (!broken) add('plain', paint(place(B(bw + 0.05, 0.55, 0.6).translate(0, (t === 3 ? tierH * 0.75 : tierH) - 0.1, -0.05), px, y, pz, yaw), 0xeadcc0, 0.2));
        if (dusk && t < 3 && !broken && (k % 2 === 0 || !mobile)) glow(px - nx * 1.5, y + tierH * (t === 0 ? 0.36 : 0.4), pz - nz * 1.5, 6.5, 0xff9440, 0.55);
        if (dusk && t === 0 && !broken && k % 3 === 0) glow(px + nx * 3.2, y + 1.2, pz + nz * 3.2, 11, 0xffb464, 0.3);
        if (colG && t < 3 && !broken) add('trav', paint(place(colG.clone().translate(bw / 2, (tierH - 1.4) / 2 + 0.5, 0), px, y, pz, yaw), 0xf1e3c6, 0.3));
      }
      if (tiers === 4 && k % 2 === 0) add('plain', paint(place(B(1.1, 1.6, 0.2).translate(0, 3 * tierH + tierH * 0.42, -0.05), px, base + 2.5, pz, yaw), 0x3a2b1f, 0));
      // segundo anillo y forjados de la galería: se ven a través de los arcos
      const [ix, iz] = ell(a, 0.88), iT = Math.min(tiers, 3);
      for (let t = 0; t < iT; t++) add('trav', paint(place(bays[t === 0 ? 0 : 1].clone(), ix, base + 2.5 + t * tierH, iz, yaw, 0.88, 1, 1), 0xd9c9a8, 0.45));
      for (let t = 1; t <= iT; t++) { const a0 = k / nb * Math.PI * 2, a1 = (k + 1) / nb * Math.PI * 2, y = base + 2.5 + t * tierH - 0.3, o0 = ell(a0), o1 = ell(a1), i0 = ell(a0, 0.88), i1 = ell(a1, 0.88), g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([o0[0], y, o0[1], i0[0], y, i0[1], o1[0], y, o1[1], o1[0], y, o1[1], i0[0], y, i0[1], i1[0], y, i1[1]], 3)); g.computeVertexNormals(); add('plain', paint(g, 0xc9b591, 0)); }
    }
    // graderío escalonado desde el anillo interior hasta la arena
    const steps = mobile ? 5 : 9, seg = mobile ? 40 : 72, tp = [], P = (sc, a, y) => [CX + Math.cos(a) * CA * sc, y, CZ + Math.sin(a) * CB * sc];
    for (let k = 0; k < seg; k++) { const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, r = Math.max(ruin(a0), ruin(a1)), topH = (r > 0.3 ? 2 : 3) * tierH, yAt = (f) => base + 5 + (topH - 2.5) * (1 - f);
      for (let s2 = 0; s2 < steps; s2++) { const f0 = s2 / steps, f1 = (s2 + 1) / steps, s0 = 0.86 - f0 * 0.36, s1 = 0.86 - f1 * 0.36, yA = yAt(f0), yB = yAt(f1);
        const A = P(s0, a0, yA), Bq = P(s0, a1, yA), A2 = P(s0, a0, yB), B2 = P(s0, a1, yB), C2 = P(s1, a0, yB), D2 = P(s1, a1, yB);
        tp.push(...A, ...A2, ...Bq, ...Bq, ...A2, ...B2, ...A2, ...C2, ...B2, ...B2, ...C2, ...D2); } }
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); gs.computeVertexNormals(); add('plain', paint(gs, 0xc2ac85, 0.45));
    add('plain', paint(place(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), CX, base + 5.05, CZ, 0, CA * 0.5, 1, CB * 0.5), 0xcfae7c, 0));
    for (let k = 0; k < (mobile ? 0 : 12); k++) { const a = hash(k, 61) * 6.283, rr = 0.1 + hash(k, 62) * 0.3, x = CX + Math.cos(a) * CA * rr, z = CZ + Math.sin(a) * CB * rr; add('trav', paint(place(boxM(0.8 + hash(k, 63) * 1.5, 1 + hash(k, 64) * 2, 4 + hash(k, 65) * 5, 4, 4, false), x, base + 5.5, z, hash(k, 66) * 3), 0xd8c8a6, 0.5)); } // restos del hipogeo
    // arco de triunfo con tres vanos y columnas
    const ax = CX + CA * 1.28, az = CZ - CB * 0.3; if (roadDist(ax, az) > L + 9) { const ay = hAt(ax, az) - 0.8, yaw = 0.5, s = new THREE.Shape(); s.moveTo(-11, 0); s.lineTo(11, 0); s.lineTo(11, 15); s.lineTo(-11, 15); s.lineTo(-11, 0);
      const hole = (c2, w, h) => { const p = new THREE.Path(); p.moveTo(c2 - w / 2, 0.05); p.lineTo(c2 + w / 2, 0.05); p.lineTo(c2 + w / 2, h - w / 2); p.absarc(c2, h - w / 2, w / 2, 0, Math.PI, false); p.lineTo(c2 - w / 2, 0.05); s.holes.push(p); }; hole(0, 5.5, 11); hole(-7, 2.6, 6.5); hole(7, 2.6, 6.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: false, curveSegments: 8 }), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4); g.translate(0, 0, -3);
      add('trav', paint(place(g, ax, ay, az, yaw), 0xf2e4c6, 0.4)); add('trav', paint(place(boxM(23, 4, 6.8, 4, 4, false).translate(0, 17, 0), ax, ay, az, yaw), 0xe8dabb, 0.2)); add('plain', paint(place(B(23.6, 0.6, 7.2).translate(0, 15.2, 0), ax, ay, az, yaw), 0xf0e4cc, 0.1));
      for (const u of [-9.4, -4.4, 4.4, 9.4]) for (const sd of [-1, 1]) add('trav', paint(place(new THREE.CylinderGeometry(0.5, 0.55, 10.5, 10).translate(u, 5.25, sd * 3.45), ax, ay, az, yaw), 0xf5e9d0, 0.3));
    }
  }

  // ---- casas ----
  const houses = [], free = (x, z, r) => houses.every((h) => Math.hypot(h[0] - x, h[1] - z) > r + h[2]);
  const roofC = [0xc96a42, 0xd27a4a, 0xb85a36, 0xcf8455, 0xad4f30], wallsT = [0xe8bb72, 0xf0d9a0, 0xeeb08a, 0xdf9763, 0xf3e6ca, 0xe8ae9f, 0xddc490, 0xe7c7a6];
  const wallsC = [0xe2583f, 0xf3b63f, 0xeb8d3c, 0xf2d56d, 0xd96b69, 0xe9a45c, 0xa4bccd, 0xf2e2c2, 0xc95a4a];
  const shutC = [0x3f5f3b, 0x4a6e44, 0x5a4532, 0x6e8aa0, 0x2f4d3a], flowersC = [0xe0456b, 0xf28a3a, 0xd94f8a, 0xf4e04d];
  // casa detallada: zócalo, impostas, cornisa, tejado de tejas, ventanas con marco y contraventanas, balcones de forja, macetas, puerta, tiendas con toldo
  const houseD = (x, z, yaw, w, d, floors, wallHex, roofHex, k, rich) => {
    const corners = [[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].map(([a, b]) => hAt(x + Math.cos(yaw) * a + Math.sin(yaw) * b, z - Math.sin(yaw) * a + Math.cos(yaw) * b));
    const gmin = Math.min(...corners), gmax = Math.max(...corners), y0 = gmin - 1, gb = gmax - y0 + 0.25, fh = 3.1, Hh = gb + floors * fh + 0.3, parts = [], wins = [];
    const pc = (bin, g, hex, ao, px, py, pz, ry = 0, pitch = 0) => parts.push([bin, paint(place(g, px, py, pz, ry, 1, 1, 1, pitch), hex, ao)]);
    const shut = shutC[k % shutC.length], frameHex = 0xf1e8d6, shop = hash(k, 21) < 0.4;
    pc('plaster', boxM(w, Hh, d, 4, 4, false), wallHex, 0.28, 0, Hh / 2, 0);
    pc('stone', boxM(w + 0.14, gb + 0.7, d + 0.14, 1.6, 1.6, false), 0xd2c2a4, 0.35, 0, (gb + 0.7) / 2, 0);
    for (let f = 1; f < floors; f++) pc('plain', B(w + 0.16, 0.16, d + 0.16), frameHex, 0, 0, gb + f * fh, 0);
    pc('plain', B(w + 0.7, 0.28, d + 0.7), frameHex, 0.2, 0, Hh - 0.05, 0); pc('plain', B(w + 0.38, 0.22, d + 0.38), 0xe2d6bf, 0, 0, Hh - 0.28, 0);
    const rh = 1.4 + hash(k, 4) * 1.1, [rg, cap] = hipRoof(w + 1.0, d + 1.0, rh); pc('roof', rg, roofHex, 0.25, 0, Hh + 0.08, 0); pc('roof', cap, roofHex, 0, 0, Hh + 0.08, 0);
    if (hash(k, 7) < 0.55) { const ch = 1.6 + hash(k, 8), cy0 = Hh + rh * 0.45; pc('plaster', boxM(0.75, ch, 0.75, 1, 1, false), wallHex, 0.3, w * 0.22, cy0 + ch / 2, -d * 0.12); pc('plain', B(1.0, 0.14, 1.0), frameHex, 0, w * 0.22, cy0 + ch + 0.05, -d * 0.12); pc('roof', B(0.6, 0.3, 0.6), roofHex, 0, w * 0.22, cy0 + ch + 0.27, -d * 0.12); }
    pc('plain', B(0.14, Hh, 0.14), 0x8a8a84, 0, w / 2 + 0.07, Hh / 2, d / 2 - 0.2); pc('plain', B(0.14, Hh, 0.14), 0x8a8a84, 0, -w / 2 - 0.07, Hh / 2, d / 2 - 0.2);
    const faces = [[0, d / 2, w], [Math.PI / 2, w / 2, d], [Math.PI, d / 2, w], [-Math.PI / 2, w / 2, d]];
    faces.forEach(([fa, half, len], fi) => {
      if ((!rich && fi === 2) || (rich === 0 && fi !== 0)) return;
      const nb = Math.max(1, Math.floor((len - 0.6) / 2.9)), cosA = Math.cos(fa), sinA = Math.sin(fa), at = (u, out) => [cosA * u + sinA * (half + out), -sinA * u + cosA * (half + out)];
      for (let f = 0; f < floors; f++) for (let b = 0; b < nb; b++) {
        const u = -len / 2 + (b + 0.5) * len / nb, yb = gb + f * fh, cy = yb + 1.6, door = f === 0 && fi === 0 && b === Math.floor(nb / 2);
        let p;
        if (door) { p = at(u, 0.04); pc('plain', B(1.8, 2.9, 0.1), frameHex, 0.1, p[0], yb + 1.45, p[1], fa); p = at(u, 0.09); pc('plain', B(1.3, 2.5, 0.1), 0x5b3a24, 0.3, p[0], yb + 1.25, p[1], fa); p = at(u, 0.35); pc('stone', boxM(2, 0.22, 0.7, 1, 1, false), 0xcabba0, 0, p[0], yb + 0.11, p[1], fa); continue; }
        if (f === 0 && fi === 0 && shop) { p = at(u, 0.05); pc('plain', B(2.1, 2.5, 0.12), 0x2c2622, 0, p[0], yb + 1.25, p[1], fa); p = at(u, 0.6); pc('plain', B(2.5, 0.08, 1.3), [0x2f6b3c, 0xb8382f, 0xe9e1cc, 0x2c4f7a][k % 4], 0.1, p[0], yb + 2.75, p[1], fa, -0.35); continue; }
        if (f === 0 && hash(k * 7 + b, fi) < 0.35) continue;
        const closed = hash(k * 13 + b, f + fi * 5) < 0.3, bal = rich && f >= 1 && fi === 0 && hash(k * 3 + b, f) < 0.3, flower = !bal && hash(k * 5 + b, f + fi) < 0.25, wh = bal ? 2.2 : 1.5, wy = bal ? yb + 1.15 : cy;
        if (!mobile && rich !== 0) { p = at(u, 0.03); pc('plain', B(1.4, wh + 0.35, 0.06), frameHex, 0, p[0], wy + 0.02, p[1], fa); }
        const lit = dusk && !closed && hash(k * 17 + b, f * 3 + fi) < (mobile ? 0.3 : 0.45);
        p = at(u, 0.06); pc(lit ? 'lit' : 'plain', B(1.0, wh, 0.06), closed ? shut : lit ? 0xffc27a : 0x26211c, closed ? 0.35 : 0, p[0], wy, p[1], fa);
        if (lit) { p = at(u, 0.8); wins.push([p[0], wy, p[1]]); }
        if (!closed) for (const sgn of [-1, 1]) { p = at(u + sgn * 0.82, 0.07); pc('plain', B(0.52, wh, 0.05), shut, 0.35, p[0], wy, p[1], fa); }
        if (bal) { p = at(u, 0.5); pc('stone', boxM(1.9, 0.16, 0.95, 1, 1, false), 0xd8cab0, 0, p[0], yb + 0.08, p[1], fa); p = at(u, 0.95); pc('plain', B(1.9, 0.06, 0.06), 0x262626, 0, p[0], yb + 1.05, p[1], fa);
          for (let r = 0; r < 7; r++) { p = at(u - 0.9 + r * 0.3, 0.95); pc('plain', B(0.035, 0.95, 0.035), 0x262626, 0, p[0], yb + 0.6, p[1], fa); }
          for (const sgn of [-1, 1]) { p = at(u + sgn * 0.93, 0.5); pc('plain', B(0.06, 0.06, 0.9), 0x262626, 0, p[0], yb + 1.05, p[1], fa); }
          if (hash(k, b + 40) < 0.6) { p = at(u + 0.55, 0.55); pc('plain', lumpy(new THREE.IcosahedronGeometry(0.42, 1), 0.6, k + b), hash(k, b) < 0.5 ? 0xd94f8a : 0x5e8a3a, 0.4, p[0], yb + 0.5, p[1]); }
        } else { p = at(u, 0.14); pc('plain', B(1.45, 0.1, 0.28), frameHex, 0, p[0], cy - 0.8, p[1], fa);
          if (flower) { p = at(u, 0.24); pc('plain', B(1.0, 0.24, 0.26), 0xa8582f, 0.2, p[0], cy - 0.62, p[1], fa); p = at(u, 0.26); pc('plain', lumpy(B(1.05, 0.3, 0.32), 0.8, k + b + f), flowersC[(k + b) % 4], 0.3, p[0], cy - 0.38, p[1], fa); }
        }
      }
    });
    if (rich && hash(k, 30) < 0.3) for (let t = 0; t < 5; t++) pc('plain', lumpy(new THREE.IcosahedronGeometry(0.9, 1), 0.7, k + t).scale(0.6, 1, 1.3), t % 2 ? 0x3f6a2c : 0xd03f82, 0.4, -(w / 2 + 0.1), gb + 0.6 + t * 0.9, d * 0.1 + (hash(k, t) - 0.5) * 2); // buganvilla trepando
    const mat = new THREE.Matrix4().compose(V.set(x, y0, z), Q.setFromEuler(E.set(0, yaw, 0)), S3.set(1, 1, 1));
    for (const [bin, g] of parts) add(bin, g.applyMatrix4(mat));
    for (const w2 of wins) { V.set(w2[0], w2[1], w2[2]).applyMatrix4(mat); glow(V.x, V.y, V.z, 3.6, 0xffa347, 0.6); }
    houses.push([x, z, Math.max(w, d) * 0.6]);
  };
  // casa lejana (barata): caja con textura de vanos, cornisa y tejado de tejas
  const houseF = (x, z, yaw, w, d, floors, wallHex, roofHex, k) => {
    const g0 = hAt(x, z), gmin = Math.min(g0, hAt(x + w * 0.5, z + d * 0.5), hAt(x - w * 0.5, z - d * 0.5), hAt(x + w * 0.5, z - d * 0.5), hAt(x - w * 0.5, z + d * 0.5)), gmax = Math.max(g0, hAt(x + w * 0.5, z + d * 0.5), hAt(x - w * 0.5, z - d * 0.5));
    const hgt = floors * 3, y0 = gmin - 1.2, hh = gmax - y0 + hgt;
    add('facade', paint(place(boxM(w, hh, d), x, y0 + hh / 2, z, yaw), wallHex, 0.42, (hash(k, 3) - 0.5) * 0.08));
    add('plain', paint(place(B(w + 0.5, 0.25, d + 0.5), x, y0 + hh, z, yaw), 0xeee4d0, 0));
    const rh = 1.1 + hash(k, 4) * 1.1, [rg, cap] = hipRoof(w + 0.8, d + 0.8, rh); add('roof', paint(place(rg, x, y0 + hh + 0.1, z, yaw), roofHex, 0.25, (hash(k, 5) - 0.5) * 0.08)); add('roof', paint(place(cap, x, y0 + hh + 0.1, z, yaw), roofHex, 0));
    houses.push([x, z, Math.max(w, d) * 0.6]);
  };
  for (let i = 0, k = 0; i < N; i += 4) for (const s of [-1, 1]) {
    k++; if (hash(i, s * 3) < (mobile ? 0.6 : 0.38)) continue;
    const w = 7 + hash(k, 1) * 5, d = 7 + hash(k, 2) * 4, near = hash(k, 8) < 0.7, l = L + 1.6 + d / 2 + (near ? hash(k, 8) * 3 : 4 + hash(k, 18) * 14), [x, z] = side(i, s, l);
    if (z - shoreZ(x) < 8 || roadDist(x, z) < L + 1.0 + Math.max(w, d) * 0.72 || ellD(x, z) < 1.55 || !free(x, z, Math.max(w, d) * 0.6 + 0.5) || slopeAt(x, z) > 0.7) continue;
    houseD(x, z, Math.atan2(tr.TZ[i] * s, -tr.TX[i] * s), w, d, 2 + Math.floor(hash(k, 9) * 2.6), wallsT[k % wallsT.length], roofC[k % roofC.length], k, !mobile || hash(k, 5) < 0.5);
  }
  // Cinque Terre: fachadas estrechas y altas mirando a la bahía, escalonadas sobre el acantilado
  { const want = mobile ? 45 : 95; let placed = 0;
    for (let g2 = 0; g2 < 5000 && placed < want; g2++) { const x = 222 + hash(g2, 11) * 200, z = shoreZ(x) + 3 + Math.pow(hash(g2, 12), 1.5) * 95, s = z - shoreZ(x); if (s < 3 || x < 215 || roadDist(x, z) < L + 8) continue;
      const w = 5.5 + hash(g2, 13) * 3, d = 6.5 + hash(g2, 14) * 2.5; if (!free(x, z, w * 0.5)) continue; placed++;
      if (mobile && hash(g2, 17) < 0.5) houseF(x, z, -Math.PI / 2 + (hash(g2, 15) - 0.5) * 0.25, w, d, 3, wallsC[g2 % wallsC.length], roofC[(g2 + 2) % roofC.length], g2 + 500);
      else houseD(x, z, -Math.PI / 2 + (hash(g2, 15) - 0.5) * 0.25, w, d, 3 + Math.floor(hash(g2, 16) * 1.6), wallsC[g2 % wallsC.length], roofC[(g2 + 2) % roofC.length], g2 + 500, 0); }
    const bx = 262, bz = shoreZ(262) + 22, by = hAt(bx, bz) - 1; add('plaster', paint(place(boxM(4.4, 26, 4.4, 4, 4, false), bx, by + 13, bz), 0xe8c48a, 0.4));
    for (let fa = 0; fa < 4; fa++) add('plain', paint(place(B(1.4, 3.2, 0.1).translate(0, 22, 2.25), bx, by, bz, fa * Math.PI / 2), 0x2a221c, 0));
    add('plain', paint(place(B(5.2, 0.4, 5.2), bx, by + 26.2, bz), 0xf0e6d2, 0)); const [rg] = hipRoof(4.8, 4.8, 5); add('roof', paint(place(rg, bx, by + 26.4, bz), 0xb5532f, 0.3)); houses.push([bx, bz, 4]);
    add('stone', paint(place(boxM(40, 2, 6, 3, 3, false), 248, SEA - 0.6, shoreZ(248) - 2, 0.9), 0xcdbd9f, 0.4)); // muelle
  }

  // ---- terraza de café, coches aparcados detrás del muro y farolas ----
  const umbrellas = [], cars = [], lamps = [], pools = [];
  for (let i = 0; i < N; i += Math.max(2, Math.round(7 / tr.ds))) for (const s of [-1, 1]) { if (isLake(i, s)) continue; const [x, z] = side(i, s, L + 2.6 + hash(i, s) * 1.5); if (roadDist(x, z) < L + 1.3 || !free(x, z, 1.6) || ellD(x, z) < 1.3 || z - shoreZ(x) < 5) continue;
    const r = hash(i * 3, s); if (tr.Y[i] < 1.5 && r < 0.35) umbrellas.push([x, z, hAt(x, z), hash(i, 9)]); else if (r < 0.62) cars.push([x, z, hAt(x, z), yawAt(i) / 6.283 + (hash(i, 4) < 0.5 ? 0 : 0.5)]); }
  for (let i = 0; i < N; i += Math.max(2, Math.round(24 / tr.ds))) for (const s of [-1, 1]) { const [x, z] = side(i, s, L - 0.35), [px, pz] = side(i, s, L - 3.6); lamps.push([x, z, tr.Y[i] + 0.43, 0]); pools.push([px, pz, tr.Y[i] + 0.06]); }

  // ---- vegetación ----
  const cypress = [], pines = [], bushes = [], olives = [], flowers = [], tufts = [], rocks = [];
  for (let i = 0; i < N; i += 6) for (const s of [-1, 1]) { const [x, z] = side(i, s, L + 1.7 + hash(i, s) * 1.2); if (z - shoreZ(x) < 4 || !free(x, z, 1.2) || ellD(x, z) < 1.1 || hash(i, s + 9) < 0.3) continue; cypress.push([x, z, hAt(x, z), hash(i, s + 4)]); }
  const cell = mobile ? 18 : 11;
  for (let x = cx - 480; x < cx + 480; x += cell) for (let z = cz - 300; z < cz + 560; z += cell) {
    const px = x + (hash(x, z) - 0.5) * cell, pz = z + (hash(z, x) - 0.5) * cell, s = pz - shoreZ(px), d = roadDist(px, pz, 60); if (s < 3 || d < L + 2.5 || ellD(px, pz) < 1.12 || !free(px, pz, 2)) continue;
    const r = hash(px * 0.3, pz * 0.7), dens = d < 60 ? 0.62 : pz > 300 ? 0.36 : 0.22, sl = slopeAt(px, pz); if (sl > 1.2 && r < 0.3) { rocks.push([px, pz, hAt(px, pz), r]); continue; } if (r > dens || sl > 1.6) continue;
    const kind = hash(pz, px + 3), y = hAt(px, pz); if (kind < 0.36) cypress.push([px, pz, y, r]); else if (kind < 0.54) pines.push([px, pz, y, r]); else if (kind < 0.72) olives.push([px, pz, y, r]); else bushes.push([px, pz, y, r]);
  }
  for (let k = 0; k < 18; k++) { const a = hash(k, 31) * 6.283, rr = 1.25 + hash(k, 32) * 0.35, x = CX + Math.cos(a) * CA * rr, z = CZ + Math.sin(a) * CB * rr; if (roadDist(x, z) > L + 3 && free(x, z, 3)) pines.push([x, z, hAt(x, z), hash(k, 33)]); }
  for (let i = 0; i < N; i += 3) for (const s of [-1, 1]) { if (isLake(i, s)) continue; const [x, z] = side(i, s, L + 1.0 + hash(i, s + 2) * 0.6); if (hash(i, s + 5) < 0.55 || !free(x, z, 0.8)) continue; flowers.push([x, z, hAt(x, z), hash(i, s + 6)]); }
  { const want = mobile ? 1200 : 3500; for (let t = 0; t < want * 3 && tufts.length < want; t++) { const i = Math.floor(hash(t, 71) * N), s = hash(t, 72) < 0.5 ? -1 : 1, l = L + 0.8 + Math.pow(hash(t, 73), 1.6) * 55, [x, z] = side(i, s, l); if (z - shoreZ(x) < 2 || ellD(x, z) < 1.05 || !free(x, z, 0.3) || roadDist(x, z) < L + 0.7) continue; tufts.push([x, z, hAt(x, z) + 0.25, hash(t, 74)]); } }

  const D3 = new THREE.Object3D(), inst = (geo, list, sc, col, mat, cast = true, tilt = 0) => {
    if (!list.length) return null; const m = new THREE.InstancedMesh(geo, mat, list.length), c = new THREE.Color();
    list.forEach((p, k) => { const [h, wr] = sc(p[3]); D3.position.set(p[0], p[2] - 0.3, p[1]); D3.rotation.set((hash(k, 5) - 0.5) * tilt, p[3] * 6.283, (hash(k, 6) - 0.5) * tilt); D3.scale.set(wr, h, wr); D3.updateMatrix(); m.setMatrixAt(k, D3.matrix); m.setColorAt(k, c.set(col).offsetHSL((hash(k, 2) - 0.5) * 0.03, 0, (hash(k, 1) - 0.5) * 0.1)); });
    m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = shadow && cast; m.receiveShadow = shadow; G.add(m); return m;
  };
  const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: leafTex() });
  // ciprés: huso con bultos de follaje y tronco a la vista
  const cyBody = (() => { const segs = mobile ? 7 : 9, prof = [[0, 0.04], [0.5, 0.08], [0.7, 0.28], [0.62, 0.5], [0.44, 0.72], [0.24, 0.88], [0.08, 0.97], [0, 1]]; const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), segs).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + (vnoise(Math.cos(a) * 2 + 3, y * 9 + Math.sin(a) * 2) - 0.5) * 0.55; p.setXYZ(i, x * k, y, z * k); } g.computeVertexNormals(); return g; })();
  inst(mergeGeometries([paint(new THREE.CylinderGeometry(0.1, 0.14, 0.08, 6).translate(0, 0.04, 0), 0x4a3828, 0), paint(cyBody, 0xffffff, 0.6)]), cypress, (r) => [9 + r * 9, 1.2 + r * 0.6], 0x3b5a2a, leafMat);
  // pino piñonero: tronco que se abre en dos y copa en parasol hecha de varias masas
  const pnGeo = (() => { const parts = [paint(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 6).translate(0, 0.3, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.08)), 0x5a4430, 0.2), paint(new THREE.CylinderGeometry(0.018, 0.03, 0.35, 5).translate(0, 0.17, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.45)).translate(-0.02, 0.58, 0), 0x5a4430, 0.1), paint(new THREE.CylinderGeometry(0.018, 0.03, 0.35, 5).translate(0, 0.17, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.5)).translate(0.03, 0.58, 0), 0x5a4430, 0.1)];
    const clumps = mobile ? [[0, 0.9, 0, 0.75]] : [[0, 0.93, 0, 0.62], [0.45, 0.86, 0.15, 0.45], [-0.42, 0.87, -0.1, 0.48], [0.1, 0.85, 0.45, 0.42], [-0.12, 0.86, -0.45, 0.44]];
    for (const [a, b, c2, r] of clumps) { const g = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.45, a * 10 + c2); g.scale(r, r * 0.32, r); g.translate(a, b, c2); parts.push(paint(g, 0xffffff, 0.55)); }
    return mergeGeometries(parts); })();
  inst(pnGeo, pines, (r) => [10 + r * 5, 9 + r * 4], 0x4d6a30, leafMat);
  const olGeo = mergeGeometries([paint(new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6).translate(0, 0.25, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.15)), 0x6b5a45, 0.2), paint(lumpy(new THREE.IcosahedronGeometry(0.6, 1), 0.6, 4).scale(1, 0.7, 1).translate(0.05, 0.75, 0), 0xffffff, 0.5)]);
  inst(olGeo, olives, (r) => [3.5 + r * 2, 3 + r * 1.5], 0x7f8a5a, leafMat, true, 0.2);
  inst(paint(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.6, 2).translate(0, 0.55, 0), 0xffffff, 0.5), bushes, (r) => [1.4 + r * 1.6, 1.6 + r * 1.6], 0x667f45, leafMat, true);
  // adelfas: arbusto denso con textura de hoja; las flores son racimos pequeños por encima
  { const g = paint(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.55, 9).scale(1, 0.85, 1).translate(0, 0.75, 0), 0x4f7434, 0.55), pp = g.attributes.position, col = g.attributes.color, pk = new THREE.Color(0xf07aa8), c = new THREE.Color();
    for (let v = 0; v < col.count; v++) { const f = sstep(0.5, 0.68, vnoise(pp.getX(v) * 3 + 5, pp.getZ(v) * 3 + pp.getY(v) * 2)) * sstep(0.3, 0.8, pp.getY(v)); c.setRGB(col.getX(v), col.getY(v), col.getZ(v)).lerp(pk, f * 0.85); col.setXYZ(v, c.r, c.g, c.b); }
    inst(g, flowers, (r) => [1.3 + r * 0.7, 1.0 + r * 0.5], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTex() }), true); }
  inst(paint(lumpy(new THREE.DodecahedronGeometry(1, 0), 0.5, 7), 0x9d907c, 0.5), rocks, (r) => [1 + r * 1.5, 1.4 + r * 2], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: stoneTex() }), true, 0.6);
  inst(paint(mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]), 0xffffff, 0.45), tufts, (r) => [0.5 + r * 0.6, 0.7 + r * 0.7], 0x9aa860, new THREE.MeshLambertMaterial({ vertexColors: true, map: tuftTex(), alphaTest: 0.45, side: THREE.DoubleSide }), false);
  // sombrillas y mesas de la terraza
  inst(mergeGeometries([paint(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5).translate(0, 1.2, 0), 0x3a3a3a, 0), paint(new THREE.ConeGeometry(1.5, 0.5, 8, 1, true).translate(0, 2.55, 0), 0xffffff, 0), paint(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 10).translate(0, 0.75, 0), 0xe8e2d6, 0), paint(new THREE.CylinderGeometry(0.04, 0.06, 0.75, 5).translate(0, 0.37, 0), 0x2a2a2a, 0)]), umbrellas, () => [1, 1], 0xf2ead8, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  // utilitario italiano de los 60 (genérico, sin marca): carrocería redonda, techo, cristales y ruedas
  { const body = lumpy(new THREE.SphereGeometry(1, 10, 6), 0.05, 1).scale(0.75, 0.42, 1.45).translate(0, 0.62, 0), cab = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.62, 0.48, 0.78).translate(0, 0.86, -0.12), glass = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.64, 0.4, 0.8).translate(0, 0.9, -0.12);
    const wheel = (x, z) => paint(new THREE.CylinderGeometry(0.27, 0.27, 0.18, 10).rotateZ(Math.PI / 2).translate(x, 0.27, z), 0x1d1d1d, 0);
    const g = mergeGeometries([paint(body, 0xffffff, 0.35), paint(cab, 0xffffff, 0.1), paint(glass, 0x30363a, 0), wheel(0.62, 0.85), wheel(-0.62, 0.85), wheel(0.62, -0.9), wheel(-0.62, -0.9), paint(B(1.3, 0.1, 0.12).translate(0, 0.42, 1.42), 0xd8d8d8, 0), paint(B(1.3, 0.1, 0.12).translate(0, 0.42, -1.42), 0xd8d8d8, 0)]);
    const m = inst(g, cars, () => [1, 1], 0xffffff, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x444444 }));
    if (m) { const pal = [0xc8432f, 0xe9e3d3, 0x86b4c6, 0xe3c35a, 0x6f8f5a, 0xd9d4c8, 0x2f4f7a], c = new THREE.Color(); cars.forEach((_, k) => m.setColorAt(k, c.set(pal[k % pal.length]))); m.instanceColor.needsUpdate = true; }
  }
  // farolas: pie moldurado, fuste y farol de cuatro caras
  { const pole = paint(new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.22, 0.25], [0.14, 0.32], [0.1, 0.6], [0.07, 0.7], [0.06, 3.4], [0.1, 3.5], [0.12, 3.6], [0, 3.6]].map(([a, b]) => new THREE.Vector2(a, b)), 8), 0x1f2224, 0.2);
    const glass = paint(new THREE.CylinderGeometry(0.16, 0.24, 0.62, 4).rotateY(Math.PI / 4).translate(0, 3.95, 0), dusk ? 0xf2c58a : 0xffe3a0, 0), lan = mergeGeometries([paint(new THREE.ConeGeometry(0.36, 0.32, 4).rotateY(Math.PI / 4).translate(0, 4.42, 0), 0x1f2224, 0), paint(B(0.06, 0.66, 0.06).translate(0.2, 3.95, 0.2), 0x1f2224, 0), paint(B(0.06, 0.66, 0.06).translate(-0.2, 3.95, -0.2), 0x1f2224, 0), paint(new THREE.SphereGeometry(0.06, 5, 3).translate(0, 4.62, 0), 0x1f2224, 0)]);
    inst(mergeGeometries([pole, lan]), lamps, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true }), true);
    inst(glass, lamps, () => [1, 1], 0xffffff, new THREE.MeshBasicMaterial({ vertexColors: true }), false);
    if (dusk) { for (const l of lamps) { glow(l[0], l[2] + 3.78, l[1], 13, 0xffb25a, 0.14); glow(l[0], l[2] + 3.78, l[1], 34, 0xff9a48, 0.05); glow(l[0], l[2] + 3.78, l[1], 62, 0xff8e3a, 0.015); }
      // charco de luz cálida sobre el asfalto bajo cada farola
      const pt = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softTex(), color: 0xff9a4c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), pools.length), m4 = new THREE.Matrix4();
      pools.forEach((q2, k) => { m4.compose(V.set(q2[0], q2[2], q2[1]), Q.identity(), S3.set(22, 1, 22)); pt.setMatrixAt(k, m4); }); pt.frustumCulled = false; pt.renderOrder = 2; G.add(pt); } }
  // balaustres torneados del paseo
  inst(paint(new THREE.LatheGeometry([[0, 0], [0.1, 0], [0.1, 0.06], [0.06, 0.1], [0.075, 0.2], [0.12, 0.36], [0.07, 0.5], [0.06, 0.54], [0.1, 0.58], [0.1, 0.62], [0, 0.62]].map(([a, b]) => new THREE.Vector2(a, b)), mobile ? 5 : 7), 0xefe4cf, 0.35), balus, () => [0.75, 1.1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true }), false);

  // ---- montañas: al otro lado del lago y detrás de las colinas, con bosque, roca y bruma ----
  const mounts = [];
  { const geos = []; for (let k = 0; k < 30; k++) { const north = k < 10, a = north ? 0.25 + (k / 10) * 2.65 : Math.PI + 0.05 + ((k - 10) / 20) * (Math.PI - 0.1), r = north ? 900 + hash(k, 51) * 500 : 980 + hash(k, 52) * 600, R = 260 + hash(k, 53) * 280, hgt = 230 + hash(k, 54) * 320;
      if (dusk && Math.abs(((a - Math.atan2(th.sunDir[2], th.sunDir[0]) + 9.4248) % 6.2832) - 3.1416) < 0.55) continue; // hueco para ver ponerse el sol sobre el agua
      const mx = cx + Math.cos(a) * r, mz = (north ? cz : cz - 400) + Math.sin(a) * r; mounts.push([mx, mz, R, hgt, north]);
      const g = new THREE.ConeGeometry(R, hgt, mobile ? 12 : 20, mobile ? 5 : 9), p = g.attributes.position;
      for (let v = 0; v < p.count; v++) { const y = p.getY(v), t = (y + hgt / 2) / hgt; if (t < 0.999) { const ang = Math.atan2(p.getZ(v), p.getX(v)), j = 1 + (fbm(Math.cos(ang) * 1.8 + k, Math.sin(ang) * 1.8 + t * 4) - 0.5) * 0.7; p.setX(v, p.getX(v) * j); p.setZ(v, p.getZ(v) * j); p.setY(v, y + (fbm(Math.cos(ang) * 3 + k * 2, Math.sin(ang) * 3 + t * 6) - 0.5) * hgt * 0.12); } }
      g.translate(mx, hgt / 2 - 30, mz); g.computeVertexNormals(); const gn = g.toNonIndexed(), q3 = gn.attributes.position, col = new Float32Array(q3.count * 3), lo = new THREE.Color(0x34502f), mid = new THREE.Color(0x4e6640), hi = new THREE.Color(0x6f6c62), c = new THREE.Color();
      for (let v = 0; v < q3.count; v++) { const t = (q3.getY(v) + 30) / hgt, nz = fbm(q3.getX(v) / 60, q3.getZ(v) / 60); c.copy(lo).lerp(mid, nz).lerp(hi, sstep(0.55, 0.9, t + (nz - 0.5) * 0.2)); if (t > 0.93 && hgt > 500) c.lerp(new THREE.Color(0xe6e1d8), 0.7); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; }
      gn.setAttribute('color', new THREE.BufferAttribute(col, 3)); gn.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q3.count * 2), 2)); geos.push(gn); }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true })); m.frustumCulled = false; G.add(m); }

  // ---- barcas, veleros y pueblos blancos al pie de las montañas de la otra orilla ----
  { const boats = [], sails = []; for (let k = 0; k < (mobile ? 8 : 16); k++) { const x = cx - 300 + hash(k, 41) * 700, z = shoreZ(x) - 25 - hash(k, 42) * 300; if (hAt(x, z) < SEA - 1) (hash(k, 44) < 0.35 ? sails : boats).push([x, z, SEA + 0.35, hash(k, 43)]); }
    const hull = (L2) => paint(lumpy(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0.04, 3).scale(0.9, 0.7, L2), 0xf4f0e6, 0.5);
    inst(mergeGeometries([hull(3), paint(B(1.1, 0.6, 1.3).translate(0, 0.3, -0.5), 0x2d5c8a, 0.2), paint(B(1.6, 0.06, 5.4).translate(0, 0.02, 0), 0x8a6a4a, 0)]), boats, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0.2, 0, 8, 0.2, 0, 0.8, -3.2], 3)); sail.computeVertexNormals();
    inst(mergeGeometries([hull(3.4), paint(new THREE.CylinderGeometry(0.05, 0.06, 8.5, 5).translate(0, 4.3, 0.25), 0xdddddd, 0), paint(sail, 0xfbf6ea, 0)]), sails, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const far = [], lc = [cx, cz - 400];
    for (const [mx, mz, R, hgt, north] of mounts) { if (north) continue; const dx = lc[0] - mx, dz = lc[1] - mz, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
      for (let t = 0; t < (mobile ? 6 : 14); t++) { const rr = R * (0.84 + hash(mx, t) * 0.08), lat = (hash(mz, t) - 0.5) * R * 0.9, x = mx + ux * rr - uz * lat, z = mz + uz * rr + ux * lat, y = -30 + hgt * (1 - rr / R); far.push([x, z, Math.max(SEA + 0.6, y + 0.3), hash(t, mx)]); } }
    inst(mergeGeometries([paint(B(1, 1, 1).translate(0, 0.5, 0), 0xffffff, 0.3), paint(new THREE.ConeGeometry(0.8, 0.4, 4).rotateY(Math.PI / 4).translate(0, 1.2, 0), 0xb5532f, 0)]), far, (r) => [4 + r * 5, 5 + r * 4], 0xf1e6d2, new THREE.MeshLambertMaterial({ vertexColors: true }), false);
  }

  // ---- fusión: una malla por material ----
  const mats = {
    plain: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    plaster: new THREE.MeshLambertMaterial({ vertexColors: true, map: plasterTex() }),
    facade: new THREE.MeshLambertMaterial({ vertexColors: true, map: facadeTex() }),
    stone: new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTex() }),
    trav: new THREE.MeshLambertMaterial({ vertexColors: true, map: travTex(), side: THREE.DoubleSide }),
    roof: new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTex(), side: THREE.DoubleSide }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
  const keep = ['position', 'normal', 'uv', 'color'];
  for (const k in bins) { if (!bins[k].length) continue; const list = bins[k].map((g) => { const o = g.index ? g.toNonIndexed() : g; if (!o.attributes.normal) o.computeVertexNormals(); for (const a of Object.keys(o.attributes)) if (!keep.includes(a)) o.deleteAttribute(a); return o; });
    const m = new THREE.Mesh(mergeGeometries(list), mats[k]); m.frustumCulled = false; m.castShadow = shadow && k !== 'lit'; m.receiveShadow = shadow; G.add(m); }
  // halos de luz: un solo InstancedMesh de quads que miran a cámara, con caída suave y mezcla aditiva
  if (glows.length) {
    const gm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vU; varying vec3 vC; varying float vF; void main(){ vU = uv; vC = instanceColor; vec3 ctr = instanceMatrix[3].xyz; float sz = length(instanceMatrix[0].xyz); vec4 mv = modelViewMatrix * vec4(ctr, 1.0); vF = 1.0 - 0.6 * smoothstep(260.0, 1200.0, -mv.z); mv.xy += position.xy * sz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec2 vU; varying vec3 vC; varying float vF; void main(){ float d = clamp(1.0 - length(vU - 0.5) * 2.0, 0.0, 1.0); float a = pow(d, 2.2) + 0.5 * pow(d, 6.0); gl_FragColor = vec4(vC * vF, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const gl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), gm, glows.length), m4 = new THREE.Matrix4(), c3 = new THREE.Color();
    glows.forEach((g2, k) => { m4.compose(V.set(g2[0], g2[1], g2[2]), Q.identity(), S3.set(g2[3], g2[3], 1)); gl.setMatrixAt(k, m4); gl.setColorAt(k, c3.set(g2[4]).multiplyScalar(g2[5])); });
    gl.instanceColor.needsUpdate = true; gl.frustumCulled = false; gl.renderOrder = 3; G.add(gl);
  }
}
