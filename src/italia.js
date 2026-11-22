// Italia (prueba de estilo PS2): paseo junto al lago, pueblo de piedra, cipreses, un coliseo y casas de colores en el acantilado.
// Pocos polígonos, color por vértice con sombreado "horneado", texturas pequeñas y luz cálida de tarde.
// Todo se fusiona en muy pocas mallas (una por material) o en instancias: rinde mejor que el resto de circuitos.
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

// ---------- texturas pequeñas (estilo consola: 64-256 px, filtradas) ----------
function tex(w, h, paint, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2; return t;
}
const rnd = (k) => hash(k * 1.37, k * 0.71);
// piedra de muro: sillares irregulares cálidos con llagas oscuras (blanco grisáceo: el color lo pone el vértice)
const stoneTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#6d6356'; x.fillRect(0, 0, W, H);
  let k = 0; for (let r = 0; r < 8; r++) { let px = (r % 2) * -9; const rh = H / 8; while (px < W) { const w = 14 + rnd(k++) * 20, v = 205 + rnd(k++) * 45 | 0; x.fillStyle = `rgb(${v},${v - 8},${v - 22})`; x.fillRect(px + 1, r * rh + 1, w - 2, rh - 2); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 1, r * rh + 1, w - 2, 2); px += w; } }
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(60,50,40,${0.05 + rnd(i + 900) * 0.1})`; x.fillRect(rnd(i + 300) * W, rnd(i + 600) * H, 2 + rnd(i) * 5, 2 + rnd(i + 1) * 4); }
});
// fachada: un piso y un vano; ventana con contraventanas verdes, alféizar y revoque gastado
const facadeTex = () => tex(64, 64, (x, W, H) => {
  x.fillStyle = '#f2ede2'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(150,120,90,${0.04 + rnd(i) * 0.08})`; x.fillRect(rnd(i + 50) * W, rnd(i + 70) * H, 3 + rnd(i + 3) * 8, 2 + rnd(i + 4) * 6); }
  x.fillStyle = 'rgba(120,90,60,.35)'; x.fillRect(0, 0, W, 3); // línea de forjado
  x.fillStyle = '#3e5b3a'; x.fillRect(15, 20, 8, 26); x.fillRect(41, 20, 8, 26); // contraventanas
  x.fillStyle = '#2f4a2c'; for (let y = 22; y < 46; y += 3) { x.fillRect(16, y, 6, 1); x.fillRect(42, y, 6, 1); }
  x.fillStyle = '#2a2520'; x.fillRect(23, 20, 18, 26); x.fillStyle = '#4a4038'; x.fillRect(31, 20, 2, 26);
  x.fillStyle = '#e8e0cf'; x.fillRect(13, 46, 38, 3); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(13, 49, 38, 2);
});
// coliseo: un orden de arcos de travertino con pilastras y cornisa; los vanos, en sombra cálida
const coloTex = () => tex(256, 64, (x, W, H) => {
  x.fillStyle = '#e4d3b0'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(120,95,60,${0.05 + rnd(i) * 0.12})`; x.fillRect(rnd(i + 10) * W, rnd(i + 20) * H, 2 + rnd(i + 3) * 10, 1 + rnd(i + 4) * 3); }
  x.fillStyle = '#c8b38a'; x.fillRect(0, 0, W, 7); x.fillRect(0, 7, W, 2);
  for (let a = 0; a < 4; a++) { const cx = a * 64 + 32; x.fillStyle = '#d9c49c'; x.fillRect(cx - 32, 9, 7, H); x.fillStyle = '#4a3726'; x.beginPath(); x.moveTo(cx - 18, H); x.lineTo(cx - 18, 30); x.arc(cx, 30, 18, Math.PI, 0); x.lineTo(cx + 18, H); x.fill(); x.fillStyle = '#6b5236'; x.fillRect(cx - 18, 30, 4, H - 30); x.strokeStyle = '#bfa77d'; x.lineWidth = 3; x.beginPath(); x.arc(cx, 30, 19.5, Math.PI, 0); x.stroke(); }
});
const leafTex = () => { const t = tex(64, 64, (x, W, H) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, W, H); for (let i = 0; i < 380; i++) { const v = 120 + rnd(i) * 135 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.arc(rnd(i + 3) * W, rnd(i + 8) * H, 1 + rnd(i + 5) * 2.6, 0, 6.3); x.fill(); } }); t.repeat.set(3, 5); return t; };
const groundTex = () => tex(64, 64, (x, W, H) => { x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, W, H); for (let i = 0; i < 500; i++) { const v = 170 + rnd(i) * 85 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd(i + 7) * W, rnd(i + 9) * H, 1 + rnd(i + 2) * 3, 1 + rnd(i + 5) * 3); } });

// ---------- utilidades de geometría ----------
const C = new THREE.Color();
// color por vértice con oclusión "horneada": la base de cada pieza más oscura que la cima
function paint(g, hex, ao = 0.3, jit = 0) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  C.set(hex); if (jit) C.offsetHSL(0, 0, jit);
  for (let i = 0; i < n; i++) { const t = y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1, k = 1 - ao * (1 - t); col[i * 3] = C.r * k; col[i * 3 + 1] = C.g * k; col[i * 3 + 2] = C.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
// caja con UV en metros (cada vano de fachada mide sx × sy); la tapa usa un trozo liso de la textura
function boxM(w, h, d, sx = 3.4, sy = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v, [fw, fh] = dims[f]; if (!fw) uv.setXY(k, 0.02, 0.6); else uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(fw / sx)), uv.getY(k) * Math.max(1, Math.round(fh / sy))); }
  return g;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), E = new THREE.Euler();
const place = (g, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S3.set(sx, sy, sz)));

export function italiaDecor(tr, th, scene, q) {
  const N = tr.N, L = WALL, mobile = q.density < 1, shadow = !!q.shadows, G = new THREE.Group(); scene.add(G);
  const bins = { plain: [], facade: [], stone: [], colo: [] };
  const add = (k, g) => bins[k].push(g);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < N; i += 4) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // rejilla de la pista para preguntar "¿qué cerca queda la carretera?"
  const cs = 16, gridT = new Map(); for (let i = 0; i < N; i += 2) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (gridT.get(k) || gridT.set(k, []).get(k)).push(i); }
  const roadDist = (x, z, r = 40) => { const a = Math.floor(x / cs), b = Math.floor(z / cs), rr = Math.ceil(r / cs); let best = r * r; for (let p = -rr; p <= rr; p++) for (let t = -rr; t <= rr; t++) { const l = gridT.get((a + p) + ',' + (b + t)); if (l) for (const j of l) { const d = (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2; if (d < best) best = d; } } return Math.sqrt(best); };

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
    return 0.6 + Math.min(s, 30) * 0.08 + 5 * fbm(x / 70, z / 70) * sstep(0, 40, s) + north + east;
  };
  const HALF = 900, step = mobile ? 16 : 10, n = Math.ceil((2 * HALF) / step) + 1, x0 = cx - HALF, z0 = cz - HALF, id = (a, b) => b * n + a;
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
    const e = ellD(x, z); if (e < 1.35) h = h + (PL - h) * sstep(1.35, 1.05, e); // explanada del coliseo
    H[k] = h;
  }
  for (let t = 0; t < (mobile ? 3 : 5); t++) for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) { const k = id(c, r); if (!fixed[k] && H[k] > SEA - 0.5) H[k] = (H[k] * 2 + H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) / 6; }
  const hAt = (x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / step)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / step)), a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, k = id(a, b); return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n] * (1 - u) + H[k + n + 1] * u) * v; };
  const slopeAt = (x, z) => Math.hypot(hAt(x + 4, z) - hAt(x - 4, z), hAt(x, z + 4) - hAt(x, z - 4)) / 8;
  {
    const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), col = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6);
    const cG = new THREE.Color(0x6f8a3c), cDry = new THREE.Color(0xb59b62), cRock = new THREE.Color(0x9a8a74), cSand = new THREE.Color(0xcdbb92), cWet = new THREE.Color(0x6d6450), c = new THREE.Color();
    for (let r = 0; r < n; r++) for (let q2 = 0; q2 < n; q2++) {
      const k = id(q2, r), x = x0 + q2 * step, z = z0 + r * step, y = H[k], sl = slopeAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 14; uv[k * 2 + 1] = z / 14;
      c.copy(cG).lerp(cDry, sstep(0.35, 0.75, fbm(x / 55, z / 55))).lerp(cRock, sstep(0.8, 1.6, sl));
      if (y < SEA + 0.9) c.lerp(y < SEA ? cWet : cSand, 0.85);
      c.multiplyScalar(0.82 + 0.28 * fbm(x / 23 + 4, z / 23));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    let t = 0; for (let r = 0; r < n - 1; r++) for (let q2 = 0; q2 < n - 1; q2++) { const k = id(q2, r); idx[t++] = k; idx[t++] = k + n; idx[t++] = k + 1; idx[t++] = k + 1; idx[t++] = k + n; idx[t++] = k + n + 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: groundTex(), vertexColors: true })); m.frustumCulled = false; m.receiveShadow = shadow; G.add(m);
  }
  // ---- lago: turquesa en la orilla, azul profundo mar adentro, con brillo del sol de tarde ----
  {
    const S = 3200, seg = mobile ? 40 : 64, g = new THREE.PlaneGeometry(S, S, seg, seg).rotateX(-Math.PI / 2).translate(cx, SEA, cz - 400), p = g.attributes.position, col = new Float32Array(p.count * 3), sh = new THREE.Color(0x58b3b0), deep = new THREE.Color(0x245f86), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const dep = SEA - hAt(p.getX(i), p.getZ(i)); c.copy(sh).lerp(deep, sstep(0.3, 5, dep)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x9a7a52, shininess: 70, transparent: true, opacity: 0.94 })); m.frustumCulled = false; m.renderOrder = 1; G.add(m);
  }

  // ---- muros de piedra a ambos lados: pretil junto al lago, muro de contención donde el monte sube ----
  {
    const pos = [], uvs = [], cols = [], stride = mobile ? 2 : 1, pt = (i, s, l, y) => [tr.X[i] - tr.TZ[i] * l * s, y, tr.Z[i] + tr.TX[i] * l * s];
    const quad = (a, b, c2, d, ua, ub, va, vb, va2, vb2, k0, k1) => { pos.push(...a, ...c2, ...b, ...b, ...c2, ...d); uvs.push(ua, va, ub, va2, ua, vb, ua, vb, ub, va2, ub, vb2); for (const k of [k0, k0, k1, k1, k0, k1]) cols.push(k * 0.92, k * 0.84, k * 0.7); };
    for (const s of [-1, 1]) for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, out = (k) => pt(k, s, L + 2.5, 0), hi = tr.Y[i], hj = tr.Y[j], oi = out(i), oj = out(j), gi = hAt(oi[0], oi[2]), gj = hAt(oj[0], oj[2]);
      const top = (y, g2) => Math.max(y + (g2 < SEA ? 0.85 : 1.05), Math.min(g2 + 0.5, y + 3.5)), foot = (y, g2) => Math.min(y - 0.3, g2 - 0.8);
      const ti = top(hi, gi), tj = top(hj, gj), fi = foot(hi, gi), fj = foot(hj, gj), u0 = (i * tr.ds) / 3, u1 = u0 + (stride * tr.ds) / 3;
      quad(pt(i, s, L, hi - 0.06), pt(i, s, L, ti), pt(j, s, L, hj - 0.06), pt(j, s, L, tj), u0, u1, hi / 3, ti / 3, hj / 3, tj / 3, 0.78, 1); // cara hacia la pista
      quad(pt(i, s, L + 0.55, ti), pt(i, s, L + 0.55, fi), pt(j, s, L + 0.55, tj), pt(j, s, L + 0.55, fj), u0, u1, ti / 3, fi / 3, tj / 3, fj / 3, 0.95, 0.55); // cara exterior (se hunde en el agua)
      quad(pt(i, s, L - 0.08, ti + 0.12), pt(i, s, L + 0.63, ti + 0.12), pt(j, s, L - 0.08, tj + 0.12), pt(j, s, L + 0.63, tj + 0.12), u0, u1, 0.1, 0.25, 0.1, 0.25, 1.12, 1.12); // albardilla
      quad(pt(i, s, L - 0.08, ti), pt(i, s, L - 0.08, ti + 0.12), pt(j, s, L - 0.08, tj), pt(j, s, L - 0.08, tj + 0.12), u0, u1, 0.1, 0.14, 0.1, 0.14, 1.05, 1.05);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: stoneTex(), vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; m.receiveShadow = shadow; m.castShadow = shadow; G.add(m);
  }

  // ---- aceras de losa clara entre el asfalto y el muro ----
  {
    const pos = [], uvs = [], stride = mobile ? 2 : 1, P = (i, l, y) => [tr.X[i] - tr.TZ[i] * l, y, tr.Z[i] + tr.TX[i] * l];
    for (const s of [-1, 1]) for (let i = 0; i < N; i += stride) { const j = (i + stride) % N, hw = (k) => (tr.hw ? tr.hw[k] : ROAD_HALF) + 0.04, a = P(i, s * hw(i), tr.Y[i] + 0.035), b = P(i, s * (L + 0.02), tr.Y[i] + 0.035), c2 = P(j, s * hw(j), tr.Y[j] + 0.035), d = P(j, s * (L + 0.02), tr.Y[j] + 0.035), u0 = i * tr.ds / 2.2, u1 = (i + stride) * tr.ds / 2.2, w = (L - ROAD_HALF) / 2.2;
      pos.push(...a, ...c2, ...b, ...b, ...c2, ...d); uvs.push(0, u0, 0, u1, w, u0, w, u0, 0, u1, w, u1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
    const pave = tex(64, 64, (x, W, H) => { x.fillStyle = '#8f877a'; x.fillRect(0, 0, W, H); for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const v = 205 + rnd(r * 2 + c) * 35 | 0; x.fillStyle = `rgb(${v},${v - 6},${v - 16})`; x.fillRect(c * 32 + 1, r * 32 + 1, 30, 30); } for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(90,80,65,${0.06 + rnd(i) * 0.1})`; x.fillRect(rnd(i + 2) * W, rnd(i + 4) * H, 2, 2); } });
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: pave, color: 0xeadcc2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.frustumCulled = false; m.receiveShadow = shadow; G.add(m);
  }

  // ---- coliseo ----
  {
    const seg = mobile ? 40 : 64, full = 30, tiers = 4, th0 = full / tiers, base = PL - 3, top = (a) => { // lado sur derruido, en escalones de un orden
      const r = sstep(0.2, 0.9, Math.max(0, -Math.sin(a + 0.5))); return r > 0.05 ? Math.max(1, Math.round((full - r * 2.2 * th0) / th0 * 2) / 2) * th0 : full; };
    const pos = [], uv = [], ring = (rx, rz, k) => { const a = (k / seg) * Math.PI * 2; return [CX + Math.cos(a) * rx, CZ + Math.sin(a) * rz, a]; };
    const per = Math.PI * (3 * (CA + CB) - Math.sqrt((3 * CA + CB) * (CA + 3 * CB))), arch = per / (seg * 1.0);
    const wall = (rx, rz, hmul) => { for (let k = 0; k < seg; k++) { const [xa, za, aa] = ring(rx, rz, k), [xb, zb, ab] = ring(rx, rz, k + 1), ta = Math.min(top(aa), top(ab)) * hmul, u0 = k * arch / 28, u1 = (k + 1) * arch / 28, y0 = base, v0 = (y0 - PL) / th0, v1 = (PL + ta - PL) / th0; pos.push(xa, y0, za, xa, PL + ta, za, xb, y0, zb, xb, y0, zb, xa, PL + ta, za, xb, PL + ta, zb); uv.push(u0, v0, u0, v1, u1, v0, u1, v0, u0, v1, u1, v1); } };
    wall(CA, CB, 1); wall(CA * 0.86, CB * 0.82, 0.78);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); paint(g, 0xffffff, 0.35);
    add('colo', g);
    // gradas (anillo inclinado), coronación y arena
    const steps = [], sp = [];
    for (let k = 0; k < seg; k++) { const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, t = Math.min(top(a0), top(a1)) * 0.78, P = (rx, rz, a, y) => [CX + Math.cos(a) * rx, PL + y, CZ + Math.sin(a) * rz];
      const A = P(CA * 0.86, CB * 0.82, a0, t), B = P(CA * 0.86, CB * 0.82, a1, t), Ci = P(CA * 0.5, CB * 0.42, a0, 2.5), Di = P(CA * 0.5, CB * 0.42, a1, 2.5); steps.push(...A, ...Ci, ...B, ...B, ...Ci, ...Di);
      const t2 = Math.min(top(a0), top(a1)), A2 = P(CA, CB, a0, t2), B2 = P(CA, CB, a1, t2), A3 = P(CA * 0.86, CB * 0.82, a0, t2 * 0.78), B3 = P(CA * 0.86, CB * 0.82, a1, t2 * 0.78); sp.push(...A2, ...A3, ...B2, ...B2, ...A3, ...B3); }
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(steps.concat(sp), 3)); gs.computeVertexNormals(); add('plain', paint(gs, 0xb7a17a, 0.4));
    add('plain', paint(place(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), CX, PL + 2.4, CZ, 0, CA * 0.5, 1, CB * 0.42), 0xc9a878, 0));
    // arco de triunfo junto al coliseo
    const ax = CX + CA * 1.25, az = CZ - CB * 0.25; if (roadDist(ax, az) > L + 8) { const ay = hAt(ax, az) - 1; add('colo', paint(place(boxM(16, 16, 6, 16, 16), ax, ay + 8, az, 0.5), 0xf2e6cc, 0.35)); add('plain', paint(place(new THREE.BoxGeometry(17, 2.5, 6.6), ax, ay + 17, az, 0.5), 0xcab48c, 0.2)); }
  }

  // ---- casas: pueblo a lo largo de la pista y casas de colores apiladas en el promontorio (Cinque Terre) ----
  const houses = [], free = (x, z, r) => houses.every((h) => Math.hypot(h[0] - x, h[1] - z) > r + h[2]);
  const roofC = [0xb5532f, 0xc0643a, 0xa84a2c, 0xc77a4a, 0x9e4430], wallsT = [0xe2b56c, 0xeed39a, 0xe8a77e, 0xd98d5f, 0xf0e2c4, 0xe0a59a, 0xd9c08a], wallsC = [0xe05a3f, 0xf2b33d, 0xe98b3a, 0xf0d36b, 0xd76767, 0xe8a25a, 0x9fb7c9, 0xf1e1c0];
  const house = (x, z, yaw, w, d, floors, wallHex, roofHex, k) => {
    const g0 = hAt(x, z), gmin = Math.min(g0, hAt(x + w * 0.5, z + d * 0.5), hAt(x - w * 0.5, z - d * 0.5), hAt(x + w * 0.5, z - d * 0.5), hAt(x - w * 0.5, z + d * 0.5)), gmax = Math.max(g0, hAt(x + w * 0.5, z + d * 0.5), hAt(x - w * 0.5, z - d * 0.5));
    const h = floors * 3, y0 = gmin - 1.2, hh = gmax - y0 + h;
    add('facade', paint(place(boxM(w, hh, d), x, y0 + hh / 2, z, yaw), wallHex, 0.42, (hash(k, 3) - 0.5) * 0.08));
    const rh = 1.2 + hash(k, 4) * 1.3, flat = hash(k, 6) < 0.12;
    if (flat) add('plain', paint(place(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), x, y0 + hh + 0.2, z, yaw), 0xd8cfbf, 0.1));
    else add('plain', paint(place(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), x, y0 + hh, z, yaw, w + 0.8, rh, d + 0.8), roofHex, 0.35, (hash(k, 5) - 0.5) * 0.08));
    if (hash(k, 7) < 0.35) add('plain', paint(place(new THREE.BoxGeometry(0.7, 1.4, 0.7), x + w * 0.22, y0 + hh + rh * 0.4 + 0.5, z, yaw), 0xc98d63, 0.3)); // chimenea
    houses.push([x, z, Math.max(w, d) * 0.6]);
  };
  const cypress = [], pines = [], bushes = [], lamps = [];
  const yawAt = (i) => Math.atan2(tr.TX[i], tr.TZ[i]);
  for (let i = 0, k = 0; i < N; i += 5) for (const s of [-1, 1]) {
    k++; if (hash(i, s * 3) < (mobile ? 0.62 : 0.45)) continue;
    const w = 6 + hash(k, 1) * 5, d = 6 + hash(k, 2) * 4, l = L + 2.2 + d / 2 + hash(k, 8) * 14, x = tr.X[i] - tr.TZ[i] * l * s, z = tr.Z[i] + tr.TX[i] * l * s;
    if (z - shoreZ(x) < 8 || roadDist(x, z) < L + 1.2 + Math.max(w, d) * 0.72 || ellD(x, z) < 1.5 || !free(x, z, Math.max(w, d) * 0.6 + 0.8) || slopeAt(x, z) > 0.6) continue;
    house(x, z, yawAt(i) + (s > 0 ? Math.PI : 0), w, d, 2 + Math.floor(hash(k, 9) * 2.6), wallsT[k % wallsT.length], roofC[k % roofC.length], k);
  }
  // Cinque Terre: fachadas estrechas y altas, mirando a la bahía, escalonadas sobre el acantilado
  { const want = mobile ? 45 : 95; let placed = 0;
    for (let g2 = 0; g2 < 4000 && placed < want; g2++) { const x = 225 + hash(g2, 11) * 200, z = shoreZ(x) + 4 + Math.pow(hash(g2, 12), 1.4) * 95, s = z - shoreZ(x); if (s < 4 || x < 215) continue; if (roadDist(x, z) < L + 8) continue;
      const w = 5.5 + hash(g2, 13) * 3, d = 7 + hash(g2, 14) * 3; if (!free(x, z, w * 0.55)) continue; placed++;
      house(x, z, -Math.PI / 2 + (hash(g2, 15) - 0.5) * 0.3, w, d, 2 + Math.floor(hash(g2, 16) * 2.4), wallsC[g2 % wallsC.length], roofC[(g2 + 2) % roofC.length], g2 + 500); }
    // campanario
    const bx = 262, bz = shoreZ(262) + 22, by = hAt(bx, bz) - 1; add('facade', paint(place(boxM(4.2, 26, 4.2, 4.2, 4.5), bx, by + 13, bz), 0xe8c48a, 0.4)); add('plain', paint(place(new THREE.ConeGeometry(3.3, 5, 4).rotateY(Math.PI / 4).translate(0, 2.5, 0), bx, by + 26, bz), 0xa94a2c, 0.3)); houses.push([bx, bz, 4]);
  }

  // ---- vegetación: cipreses en hilera, pinos piñoneros, matas de olivo ----
  for (let i = 0; i < N; i += 7) for (const s of [-1, 1]) { const l = L + 1.6 + hash(i, s) * 1.2, x = tr.X[i] - tr.TZ[i] * l * s, z = tr.Z[i] + tr.TX[i] * l * s; if (z - shoreZ(x) < 4 || !free(x, z, 1.2) || ellD(x, z) < 1.1 || hash(i, s + 9) < 0.35) continue; cypress.push([x, z, hAt(x, z), hash(i, s + 4)]); }
  const cell = mobile ? 20 : 13;
  for (let x = cx - 480; x < cx + 480; x += cell) for (let z = cz - 300; z < cz + 560; z += cell) {
    const px = x + (hash(x, z) - 0.5) * cell, pz = z + (hash(z, x) - 0.5) * cell, s = pz - shoreZ(px), d = roadDist(px, pz, 60); if (s < 3 || d < L + 2.5 || ellD(px, pz) < 1.12 || !free(px, pz, 2)) continue;
    const r = hash(px * 0.3, pz * 0.7), dens = d < 60 ? 0.6 : pz > 300 ? 0.32 : 0.18; if (r > dens || slopeAt(px, pz) > 1.6) continue;
    const kind = hash(pz, px + 3), y = hAt(px, pz); if (kind < 0.42) cypress.push([px, pz, y, r]); else if (kind < 0.62) pines.push([px, pz, y, r]); else bushes.push([px, pz, y, r]);
  }
  // alrededor del coliseo, pinos de Roma
  for (let k = 0; k < 16; k++) { const a = hash(k, 31) * 6.283, rr = 1.25 + hash(k, 32) * 0.35, x = CX + Math.cos(a) * CA * rr, z = CZ + Math.sin(a) * CB * rr; if (roadDist(x, z) > L + 3 && free(x, z, 3)) pines.push([x, z, hAt(x, z), hash(k, 33)]); }
  const D3 = new THREE.Object3D(), inst = (geo, list, sc, col, mat) => {
    if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length), c = new THREE.Color();
    list.forEach((p, k) => { const [h, wr] = sc(p[3]); D3.position.set(p[0], p[2] - 0.3, p[1]); D3.rotation.set(0, p[3] * 6.283, 0); D3.scale.set(wr, h, wr); D3.updateMatrix(); m.setMatrixAt(k, D3.matrix); m.setColorAt(k, c.set(col).offsetHSL((hash(k, 2) - 0.5) * 0.03, 0, (hash(k, 1) - 0.5) * 0.1)); });
    m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; G.add(m);
  };
  const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: leafTex() });
  const cyGeo = mergeGeometries([paint(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 5).translate(0, 0.06, 0), 0x4a3828, 0), paint(new THREE.LatheGeometry([[0, 0.06], [0.66, 0.2], [0.62, 0.55], [0.3, 0.85], [0, 1]].map(([a, b]) => new THREE.Vector2(a, b)), 6), 0xffffff, 0.55)]);
  inst(cyGeo, cypress, (r) => [8 + r * 8, 1.1 + r * 0.6], 0x3d5a2c, leafMat);
  const pineCan = new THREE.DodecahedronGeometry(1, 0); pineCan.scale(1, 0.32, 1); pineCan.translate(0, 1, 0);
  const pnGeo = mergeGeometries([paint(new THREE.CylinderGeometry(0.035, 0.06, 1, 5).translate(0.04, 0.5, 0), 0x5a4430, 0.2), paint(pineCan, 0xffffff, 0.5)]);
  pnGeo.scale(1, 1, 1);
  inst(pnGeo, pines, (r) => [9 + r * 5, 4.5 + r * 2.5], 0x4f6b32, leafMat);
  inst(paint(new THREE.IcosahedronGeometry(1, 0).translate(0, 0.6, 0), 0xffffff, 0.5), bushes, (r) => [1.6 + r * 1.6, 1.8 + r * 1.5], 0x7d8a55, leafMat);

  // ---- farolas en el paseo del lago y barcas ----
  for (let i = 0; i < N; i += 16) for (const s of [-1, 1]) { const o = [tr.X[i] - tr.TZ[i] * (L + 2.5) * s, tr.Z[i] + tr.TX[i] * (L + 2.5) * s]; if (hAt(o[0], o[1]) > SEA + 0.2) continue; lamps.push([tr.X[i] - tr.TZ[i] * (L + 0.28) * s, tr.Z[i] + tr.TX[i] * (L + 0.28) * s, tr.Y[i] + 1.05, 0]); }
  { const pole = paint(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 5).translate(0, 1.8, 0), 0x1d1f22, 0.1), head = paint(new THREE.CylinderGeometry(0.3, 0.16, 0.6, 4).translate(0, 3.85, 0), 0x2a2c2e, 0), glass = paint(new THREE.BoxGeometry(0.34, 0.36, 0.34).translate(0, 3.55, 0), 0xffe6a8, 0);
    if (lamps.length) inst(mergeGeometries([pole, head, glass]), lamps, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true })); }
  { const boats = []; for (let k = 0; k < (mobile ? 6 : 12); k++) { const x = cx - 300 + hash(k, 41) * 700, z = shoreZ(x) - 30 - hash(k, 42) * 260; if (hAt(x, z) < SEA - 1) boats.push([x, z, SEA + 0.35, hash(k, 43)]); }
    const hull = mergeGeometries([paint(new THREE.CylinderGeometry(0.5, 0.35, 1, 6, 1).rotateX(Math.PI / 2).scale(1.6, 0.9, 4.2), 0xf2efe6, 0.5), paint(new THREE.BoxGeometry(1.2, 0.7, 1.4).translate(0, 0.7, -0.4), 0x2d5c8a, 0.2)]);
    inst(hull, boats, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true })); }

  // ---- montañas lejanas: al otro lado del lago y detrás de las colinas ----
  { const geos = []; for (let k = 0; k < 26; k++) { const north = k < 9, a = north ? 0.3 + (k / 9) * 2.5 : Math.PI + 0.1 + ((k - 9) / 17) * (Math.PI - 0.2), r = north ? 900 + hash(k, 51) * 500 : 1000 + hash(k, 52) * 650, R = 260 + hash(k, 53) * 260, hgt = 220 + hash(k, 54) * 300;
      const g = new THREE.ConeGeometry(R, hgt, 9, 4), p = g.attributes.position; for (let v = 0; v < p.count; v++) { const y = p.getY(v); if (y < hgt / 2 - 1) { p.setX(v, p.getX(v) * (0.85 + hash(v, k) * 0.3)); p.setZ(v, p.getZ(v) * (0.85 + hash(k, v) * 0.3)); p.setY(v, y + (hash(v + 3, k) - 0.5) * hgt * 0.08); } }
      g.translate(cx + Math.cos(a) * r, hgt / 2 - 30, cz + Math.sin(a) * r); const gn = g.toNonIndexed(), q3 = gn.attributes.position, col = new Float32Array(q3.count * 3), lo = new THREE.Color(0x3b573d), hi = new THREE.Color(0x6c7469), c = new THREE.Color();
      for (let v = 0; v < q3.count; v++) { const t = (q3.getY(v) + 30) / hgt; c.copy(lo).lerp(hi, sstep(0.45, 0.85, t)); if (t > 0.97 && hgt > 430) c.set(0xe9e4da); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; }
      gn.setAttribute('color', new THREE.BufferAttribute(col, 3)); gn.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q3.count * 2), 2)); geos.push(gn); }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.frustumCulled = false; G.add(m); }

  // ---- fusión: una malla por material ----
  const mats = {
    plain: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }),
    facade: new THREE.MeshLambertMaterial({ vertexColors: true, map: facadeTex() }),
    stone: new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTex() }),
    colo: new THREE.MeshLambertMaterial({ vertexColors: true, map: coloTex(), side: THREE.DoubleSide }),
  };
  for (const k in bins) { if (!bins[k].length) continue; const list = bins[k].map((g) => { const o = g.index ? g.toNonIndexed() : g; if (!o.attributes.normal) o.computeVertexNormals(); return o; });
    const keep = ['position', 'normal', 'uv', 'color']; for (const g of list) for (const a of Object.keys(g.attributes)) if (!keep.includes(a)) g.deleteAttribute(a);
    const m = new THREE.Mesh(mergeGeometries(list), mats[k]); m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; G.add(m); }
}
