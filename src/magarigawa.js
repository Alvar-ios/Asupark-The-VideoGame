// Entorno del Magarigawa Club: montañas con bosque cerrado, escapatoria azul, vallas, taludes de celosía, club blanco y boxes.
// Las posiciones van en coordenadas de la foto aérea con la que se calcó el trazado.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL } from './track.js';
import { spriteField } from './filler.js';
import { MPP, WIDE } from './magarigawa-data.js';

const P = (x, y) => [(20 + x / 3.2) * MPP, (50 + y / 3.2) * MPP];
const SERVICE = [[950, 272], [1003, 304], [998, 384], [939, 437], [811, 469], [747, 464], [640, 544], [501, 565], [448, 501], [320, 475], [256, 533], [251, 608], [309, 768], [363, 821]];
const PITLANE = [[590, 226], [630, 242], [683, 280], [747, 288], [820, 280]];
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), l = (p, q, t) => p + (q - p) * t; return l(l(hash(xi, yi), hash(xi + 1, yi), a), l(hash(xi, yi + 1), hash(xi + 1, yi + 1), a), b); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 11, y * 4.3 + 5) * 0.15;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function canvas(w, h, paint, rx = 1, ry = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
const canopy = () => canvas(512, 512, (x, W, H) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, W, H); const c = ['#a4a4a4', '#dcdcdc', '#f4f4f4', '#b6b6b6', '#ffffff', '#969696']; for (let k = 0; k < 2600; k++) { x.fillStyle = c[k % c.length]; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 3 + Math.random() * 9, 0, 6.283); x.fill(); } });
const lattice = () => canvas(128, 128, (x, W, H) => { x.fillStyle = '#7f9a58'; x.fillRect(0, 0, W, H); x.fillStyle = '#ece8da'; x.fillRect(0, 0, W, 12); x.fillRect(0, 0, 12, H); });
const wire = () => canvas(64, 64, (x, W) => { x.clearRect(0, 0, W, W); x.strokeStyle = 'rgba(225,230,232,.75)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, W); x.moveTo(W, 0); x.lineTo(0, W); x.stroke(); });
const glassTex = () => canvas(256, 64, (x, W, H) => { x.fillStyle = '#23465a'; x.fillRect(0, 0, W, H); x.fillStyle = '#6ea3bd'; for (let k = 0; k < 16; k++) x.fillRect(k * 16 + 2, 4, 12, H - 8); });

export function magarigawaDecor(tr, th, scene, q) {
  const N = tr.N, L = WALL, mobile = q.density < 1, E = tr.wallEdge, G = new THREE.Group(); scene.add(G);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < N; i += 4) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, HALF = 1500, step = mobile ? 16 : 10, n = Math.ceil((2 * HALF) / step) + 1, x0 = cx - HALF, z0 = cz - HALF, id = (a, b) => b * n + a;
  const H = new Float32Array(n * n).fill(1e9), fixed = new Uint8Array(n * n), D = new Float32Array(n * n).fill(1e9);
  const mark = (x, z, y) => { const a = Math.round((x - x0) / step), b = Math.round((z - z0) / step); for (const [p, r] of [[a, b], [a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) { if (p < 0 || r < 0 || p >= n || r >= n) continue; const k = id(p, r); fixed[k] = 1; D[k] = 0; if (y < H[k]) H[k] = y; } };
  for (let i = 0; i < N; i += 2) for (const sd of [0, 1]) { const s = sd ? 1 : -1, w = E[sd][i] + 2; for (let l = 0; l <= w; l += step * 0.55) mark(tr.X[i] - tr.TZ[i] * l * s, tr.Z[i] + tr.TX[i] * l * s, tr.Y[i] - 1.4); }
  // explanadas de los edificios
  let iClub = 0, bd = 1e18; { const [px, pz] = P(470, 150); for (let i = 0; i < N; i++) { const d = (tr.X[i] - px) ** 2 + (tr.Z[i] - pz) ** 2; if (d < bd) { bd = d; iClub = i; } } }
  let iPit = 0; bd = 1e18; { const [px, pz] = P(700, 880); for (let i = 0; i < N; i++) { const d = (tr.X[i] - px) ** 2 + (tr.Z[i] - pz) ** 2; if (d < bd) { bd = d; iPit = i; } } }
  const clubY = tr.Y[iClub] - 1.2, pitY = tr.Y[iPit] - 0.4;
  const pad = (ax, ay, bx, by, y) => { const [a, b] = P(ax, ay), [c, d] = P(bx, by); for (let x = a; x <= c; x += step * 0.6) for (let z = b; z <= d; z += step * 0.6) mark(x, z, y); };
  pad(345, 180, 640, 345, clubY); pad(630, 300, 720, 380, clubY - 1); pad(565, 720, 625, 815, pitY); pad(590, 790, 840, 925, pitY);
  // el resto se extiende desde la pista y se levanta en colinas al alejarse
  const relax = (a, b, c, dd) => { if (D[b] + dd < D[a]) { D[a] = D[b] + dd; if (!fixed[a]) H[a] = H[b]; } };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = id(c, r); if (c) relax(k, k - 1, 0, step); if (r) { relax(k, k - n, 0, step); if (c) relax(k, k - n - 1, 0, step * 1.414); if (c < n - 1) relax(k, k - n + 1, 0, step * 1.414); } }
  for (let r = n - 1; r >= 0; r--) for (let c = n - 1; c >= 0; c--) { const k = id(c, r); if (c < n - 1) relax(k, k + 1, 0, step); if (r < n - 1) { relax(k, k + n, 0, step); if (c < n - 1) relax(k, k + n + 1, 0, step * 1.414); if (c) relax(k, k + n - 1, 0, step * 1.414); } }
  const smooth = (it) => { for (let t = 0; t < it; t++) for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) { const k = id(c, r); if (!fixed[k]) H[k] = (H[k] + H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) / 5; } };
  smooth(mobile ? 16 : 30);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = id(c, r); if (fixed[k]) continue; const x = x0 + c * step, z = z0 + r * step, d = D[k]; H[k] += sstep(10, 300, d) * (35 + 110 * fbm(x / 340, z / 340)) + sstep(8, 70, d) * 9 * (fbm(x / 70, z / 70) - 0.25) + sstep(350, 1300, d) * 190 * fbm(x / 520 + 4, z / 520 + 9); }
  smooth(2);
  const hAt = (x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / step)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / step)), a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, k = id(a, b); return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n] * (1 - u) + H[k + n + 1] * u) * v; };
  const dAt = (x, z) => { const a = Math.min(n - 1, Math.max(0, Math.round((x - x0) / step))), b = Math.min(n - 1, Math.max(0, Math.round((z - z0) / step))); return D[id(a, b)]; };
  { // malla del terreno
    const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), col = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6), cF = new THREE.Color(0x4f8f3f), cE = new THREE.Color(0xa89a70), cS = new THREE.Color(0x8f8c80), c = new THREE.Color();
    for (let r = 0; r < n; r++) for (let q2 = 0; q2 < n; q2++) { const k = id(q2, r), x = x0 + q2 * step, z = z0 + r * step; pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z; uv[k * 2] = x / 45; uv[k * 2 + 1] = z / 45; const a1 = Math.min(n - 1, q2 + 1), b1 = Math.min(n - 1, r + 1), sl = Math.hypot(H[id(a1, r)] - H[k], H[id(q2, b1)] - H[k]) / step; c.copy(cE).lerp(cF, sstep(6, 28, D[k])).lerp(cS, sstep(0.55, 0.95, sl)).multiplyScalar(0.86 + 0.28 * fbm(x / 120, z / 120)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    let t = 0; for (let r = 0; r < n - 1; r++) for (let q2 = 0; q2 < n - 1; q2++) { const k = id(q2, r); idx[t++] = k; idx[t++] = k + n; idx[t++] = k + 1; idx[t++] = k + 1; idx[t++] = k + n; idx[t++] = k + n + 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: canopy(), vertexColors: true })); m.frustumCulled = false; m.receiveShadow = !!q.shadows; G.add(m);
  }
  // escapatoria azul, valla y talud, tramo a tramo
  const stride = mobile ? 3 : 2, blue = { p: [], c: [] }, wall = { p: [], c: [] }, net = { p: [], u: [] }, slope = { p: [], u: [] }, cB = new THREE.Color(th.runoffCol), c2 = new THREE.Color(), cW = new THREE.Color(0xd9d8cf), cR = new THREE.Color(0xc42a2a);
  const pt = (i, s, l, y) => [tr.X[i] - tr.TZ[i] * l * s, y, tr.Z[i] + tr.TX[i] * l * s];
  const quad = (o, a, b, c, d) => o.p.push(...a, ...c, ...b, ...b, ...c, ...d);
  const paint = (o, col, n2 = 6) => { for (let k = 0; k < n2; k++) o.c.push(col.r, col.g, col.b); };
  const posts = [];
  const cs = 24, gridT = new Map(); for (let i = 0; i < N; i += 3) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (gridT.get(k) || gridT.set(k, []).get(k)).push(i); }
  const hitsOther = (x, z, i) => { const a = Math.floor(x / cs), b = Math.floor(z / cs), lim = (L + 3) ** 2; for (let p = -1; p <= 1; p++) for (let r = -1; r <= 1; r++) { const l = gridT.get((a + p) + ',' + (b + r)); if (l) for (const j of l) { const g = Math.abs(j - i); if (Math.min(g, N - g) > 70 && (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < lim) return true; } } return false; };
  const room = (i, s, w, max) => { for (let d = 2; d <= max; d += 2) { const p = pt(i, s, w + d, 0); if (hitsOther(p[0], p[2], i)) return d - 2; } return max; };
  for (const sd of [0, 1]) { const s = sd ? 1 : -1;
    for (let i = 0; i < N; i += stride) { const j = (i + stride) % N, wi = E[sd][i], wj = E[sd][j], yi = tr.Y[i], yj = tr.Y[j];
      quad(blue, pt(i, s, L - 0.1, yi - 0.03), pt(i, s, wi, yi - 0.03), pt(j, s, L - 0.1, yj - 0.03), pt(j, s, wj, yj - 0.03)); paint(blue, c2.copy(cB).multiplyScalar(0.7 + 0.06 * vnoise(i * 0.06, sd * 9)));
      quad(wall, pt(i, s, wi, yi - 0.05), pt(i, s, wi, yi + 0.85), pt(j, s, wj, yj - 0.05), pt(j, s, wj, yj + 0.85)); paint(wall, cW);
      quad(wall, pt(i, s, wi, yi + 0.85), pt(i, s, wi, yi + 1.05), pt(j, s, wj, yj + 0.85), pt(j, s, wj, yj + 1.05)); paint(wall, cR);
      const u0 = i * tr.ds / 0.8, u1 = u0 + stride * tr.ds / 0.8, a = pt(i, s, wi, yi + 1.05), b = pt(i, s, wi, yi + 4.2), c = pt(j, s, wj, yj + 1.05), d = pt(j, s, wj, yj + 4.2);
      net.p.push(...a, ...c, ...b, ...b, ...c, ...d); net.u.push(u0, 0, u1, 0, u0, 3.9, u0, 3.9, u1, 0, u1, 3.9);
      const R = 1 / Math.max(tr.absK[i], 1e-4), inner = tr.kerb[i] === s, u = i / N, wide = u > WIDE[0] && u < WIDE[1], want = wide ? 9 : 3, sw = room(i, s, wi, inner ? Math.max(0, Math.min(want, R * 0.92 - wi)) : want), swj = room(j, s, wj, sw); // celosía ancha solo en el terraplén de las rectas
      if (sw > 1 && swj > 1) { const ea = pt(i, s, wi + sw, 0), eb = pt(j, s, wj + swj, 0); ea[1] = Math.min(yi + 3, hAt(ea[0], ea[2]) + 0.2); eb[1] = Math.min(yj + 3, hAt(eb[0], eb[2]) + 0.2); const fa = pt(i, s, wi, yi - 0.05), fb = pt(j, s, wj, yj - 0.05); slope.p.push(...fa, ...fb, ...ea, ...ea, ...fb, ...eb); const v0 = u0 / 6, v1 = u1 / 6; slope.u.push(v0, 0, v1, 0, v0, 2.4, v0, 2.4, v1, 0, v1, 2.4); }
      if (i % 8 < stride) posts.push(pt(i, s, wi, yi));
    } }
  const up = (g) => { g.computeVertexNormals(); const nr = g.attributes.normal; let v = 0; for (let k = 0; k < nr.count; k += 9) v += nr.getY(k); if (v < 0) for (let k = 0; k < nr.count; k++) nr.setXYZ(k, -nr.getX(k), -nr.getY(k), -nr.getZ(k)); return g; };
  const buf = (p, c, u) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); if (c) g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); if (u) g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); return up(g); };
  const add = (g, mat) => { const m = new THREE.Mesh(g, mat); m.frustumCulled = false; G.add(m); return m; };
  add(buf(blue.p, blue.c), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })).receiveShadow = !!q.shadows;
  add(buf(wall.p, wall.c), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  add(buf(slope.p, null, slope.u), new THREE.MeshLambertMaterial({ map: lattice(), side: THREE.DoubleSide }));
  add(buf(net.p, null, net.u), new THREE.MeshBasicMaterial({ map: wire(), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  { const D3 = new THREE.Object3D(), m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 4.3, 0.12).translate(0, 2.15, 0), new THREE.MeshLambertMaterial({ color: 0xd7dadd }), posts.length); posts.forEach((p, k) => { D3.position.set(p[0], p[1], p[2]); D3.updateMatrix(); m.setMatrixAt(k, D3.matrix); }); m.frustumCulled = false; G.add(m); }
  // caminos de servicio y calle de boxes, asentados en el terreno
  const road = (list, w, color) => { const p = [], pts = list.map(([x, y]) => P(x, y)); for (let k = 0; k < pts.length - 1; k++) { const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len * w / 2, nz = (bx - ax) / len * w / 2, st = Math.ceil(len / 8); for (let q2 = 0; q2 < st; q2++) { const t0 = q2 / st, t1 = (q2 + 1) / st, v = (t, sgn) => { const x = ax + (bx - ax) * t + nx * sgn, z = az + (bz - az) * t + nz * sgn; return [x, hAt(x, z) + 0.3, z]; }; p.push(...v(t0, -1), ...v(t1, -1), ...v(t0, 1), ...v(t0, 1), ...v(t1, -1), ...v(t1, 1)); } } add(buf(p), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); };
  road(SERVICE, 4, 0xb9bcbd); road(PITLANE, 5, 0x3b3a3c);
  const onService = (x, z) => { for (const list of [SERVICE, PITLANE]) for (let k = 0; k < list.length - 1; k++) { const [ax, az] = P(...list[k]), [bx, bz] = P(...list[k + 1]), ex = bx - ax, ez = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); if ((ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2 < 25) return true; } return false; };
  // edificios
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c }), white = lam(0xf4f3ee), slate = lam(0x4a4f57), concrete = lam(0xb4b6b4), glass = new THREE.MeshLambertMaterial({ map: glassTex() }), shadow = !!q.shadows;
  const box = (ax, ay, bx, by, y, h, mat) => { const [a, b] = P(ax, ay), [c, d] = P(bx, by), m = new THREE.Mesh(new THREE.BoxGeometry(c - a, h, d - b), mat); m.position.set((a + c) / 2, y + h / 2, (b + d) / 2); m.castShadow = shadow; G.add(m); return m; };
  const gable = (ax, ay, bx, by, y, h, mat) => { const [a, b] = P(ax, ay), [c, d] = P(bx, by), w = d - b, sh = new THREE.Shape([new THREE.Vector2(-w / 2 - 1, 0), new THREE.Vector2(w / 2 + 1, 0), new THREE.Vector2(0, h)]), g = new THREE.ExtrudeGeometry(sh, { depth: c - a + 2, bevelEnabled: false }).rotateY(Math.PI / 2), m = new THREE.Mesh(g, mat); m.position.set(a - 1, y, (b + d) / 2); m.castShadow = shadow; G.add(m); };
  const y = clubY + 1.2;
  box(345, 180, 640, 345, clubY, 1.25, concrete); // explanada
  box(360, 195, 585, 300, y, 5.5, white); box(358, 193, 587, 197, y + 1.2, 3.2, glass); box(358, 298, 587, 302, y + 1.2, 3.2, glass); // planta baja acristalada
  box(440, 175, 585, 225, y + 5.5, 6, white); box(438, 173, 587, 177, y + 7, 3.4, glass); box(446, 183, 480, 205, y + 11.5, 0.5, lam(0x79a55a)); // bloque blanco con cubierta verde
  box(360, 205, 525, 245, y + 5.5, 4, white); gable(360, 205, 525, 245, y + 9.5, 5, slate); gable(525, 215, 585, 250, y + 5.5, 5, slate); gable(460, 248, 530, 282, y + 5.5, 5, slate); // cubiertas de pizarra
  { const [a, b] = P(395, 248), [c, d] = P(450, 268), w = new THREE.Mesh(new THREE.BoxGeometry(c - a, 0.3, d - b), new THREE.MeshBasicMaterial({ color: 0x3aa7d8 })); w.position.set((a + c) / 2, y + 5.65, (b + d) / 2); G.add(w); } // piscina
  { const pts = [P(640, 318), P(706, 322), P(672, 376)], sh = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz))), m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2), white); m.position.y = clubY + 6; G.add(m); for (const [px, pz] of pts) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), white); c.position.set(px, clubY + 3, pz); G.add(c); } } // marquesina triangular
  box(575, 725, 615, 800, pitY, 7, slate);
  { const [a, b] = P(600, 812), [c, d] = P(825, 915), ang = Math.atan2(d - b, c - a), len = Math.hypot(c - a, d - b), g = new THREE.Group(); g.position.set((a + c) / 2, pitY, (b + d) / 2); g.rotation.y = -ang; const part = (w, h, dp, py, pz, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), mat); m.position.set(0, py, pz); m.castShadow = shadow; g.add(m); }; part(len, 6, 16, 3, 0, white); part(len + 2, 0.7, 19, 6.3, 0, slate); part(len - 3, 3.4, 0.3, 2.4, 8.1, glass); G.add(g); } // boxes
  // bosque cerrado
  const slopeAt = (x, z) => Math.hypot(hAt(x + 6, z) - hAt(x - 6, z), hAt(x, z + 6) - hAt(x, z - 6)) / 12;
  const trees = { broad: [], jungle: [], poplar: [], bush: [] }, cell = mobile ? 20 : 12, reach = mobile ? 560 : 820;
  for (let x = x0; x < x0 + 2 * HALF; x += cell) for (let z = z0; z < z0 + 2 * HALF; z += cell) { const px = x + (hash(x, z) - 0.5) * cell, pz = z + (hash(z, x) - 0.5) * cell, d = dAt(px, pz); if (d < 6 || d > reach) continue; if (hash(px * 0.3, pz * 0.7) > (d < 200 ? 1 : d < 420 ? 0.85 : 0.5) || onService(px, pz) || slopeAt(px, pz) > 0.8) continue; const r = hash(px, pz + 9), k = r < 0.78 ? 'broad' : r < 0.86 ? 'jungle' : 'poplar'; trees[k].push([px, pz, hAt(px, pz), r]); if (d < 70) for (const [ox, oz] of [[3, -2], [-4, 3]]) if (hash(pz + ox, px + oz) < 0.8) trees.bush.push([px + ox, pz + oz, hAt(px + ox, pz + oz), r]); }
  spriteField(G, 'broad', trees.broad, 14, 24); spriteField(G, 'jungle', trees.jungle, 20, 34); spriteField(G, 'poplar', trees.poplar, 16, 26, 0.9); spriteField(G, 'bush', trees.bush, 3.5, 7, 1.5);
}
