// Paso de peatones propio de cada circuito: franja a la altura de la pista detrás de la valla y talud de hierba hasta el terreno
import * as THREE from 'three';
import { WALL } from './track.js';

const STYLE = {
  madring: { w: 6, a: 0xbcb9ae, b: 0xaeaba0, step: 2.4, curb: 0xe4e1d8 }, // acera de baldosa
  monaco: { w: 3, a: 0xcdc3b2, b: 0xbfb5a4, step: 1.6, curb: 0xe6dfd2 }, // losa de piedra
  pruebas: { w: 4, a: 0xa98d64, b: 0x9c8159, step: 3.4 }, // camino de tierra
  spa: { w: 4, a: 0x6e5d46, b: 0x63533e, step: 3 },
  valle: { w: 4, a: 0xb58e5e, b: 0xa68152, step: 3.4 },
  desierto: { w: 4, a: 0xcda676, b: 0xc09a6b, step: 4 }, // arena pisada
  neon: { w: 5, a: 0x2c2e3c, b: 0x24262f, step: 2, curb: 0x19e3ff }, // acera oscura con borde de luz
  nieve: { w: 4, a: 0xe3ebf3, b: 0xd5dfe9, step: 3 }, // nieve pisada
  amazonas: { w: 3.5, a: 0x8d6c47, b: 0x7c5d3b, step: 0.9 }, // pasarela de tablones
  prisma: { w: 4, a: 0xf3e3b0, b: 0xe8d398, step: 2.4, curb: 0xff9d2e }, // baldosa de juguete
  karting: { w: 3.5, a: 0xaa9c82, b: 0x9d8f76, step: 2.6 },
  asupark: { w: 3.5, a: 0xb39f80, b: 0xa59174, step: 2.6 },
  kartlos: { w: 4, a: 0xdac9a9, b: 0xcdbc9c, step: 3 },
};

// tr.walk = { W: [izq, der], E: [izq, der] }: ancho del paso y distancia a la que el talud llega al suelo, por muestra de pista
export function computeWalk(tr, th) {
  tr.walk = null; const st = STYLE[th.id]; if (!st) { tr.stand = findStand(tr); return; }
  const N = tr.N, cs = 12, grid = new Map(), rr = Math.ceil((WALL + 1) / cs);
  for (let i = 0; i < N; i += 2) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const hitsOther = (x, z, i) => { const cx = Math.floor(x / cs), cz = Math.floor(z / cs), r2 = (WALL + 0.8) ** 2; for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) { const l = grid.get((cx + a) + ',' + (cz + b)); if (l) for (const j of l) { const g = Math.abs(j - i); if (Math.min(g, N - g) > 40 && (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < r2) return true; } } return false; };
  const closed = (i) => (tr.tunnels || []).some((t) => i > t.s0 / tr.ds - 8 && i < t.s1 / tr.ds + 8) || (tr.bridge && Math.min(Math.abs(i - tr.bridge.i), N - Math.abs(i - tr.bridge.i)) < tr.bridge.span + 12);
  const W = [], E = [];
  for (const sd of [0, 1]) {
    const side = sd ? 1 : -1, w = new Float32Array(N), e = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (closed(i)) continue;
      const full = st.w + 2.5 + 1.1 * tr.Y[i]; let avail = full + 1;
      for (let d = 1; d <= full + 1; d += 1.5) if (hitsOther(tr.X[i] - tr.TZ[i] * (WALL + d) * side, tr.Z[i] + tr.TX[i] * (WALL + d) * side, i)) { avail = d - 1; break; }
      w[i] = Math.max(0, Math.min(st.w, avail)); e[i] = Math.max(w[i], Math.min(full, avail));
    }
    // sin escalones: mínimo y media móvil, para que el ancho cambie poco a poco
    const smooth = (src) => { let out = new Float32Array(N); for (let i = 0; i < N; i++) { let m = 1e9; for (let d = -8; d <= 8; d++) m = Math.min(m, src[(i + d + N) % N]); out[i] = m; } const o2 = new Float32Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let d = -8; d <= 8; d++) s += out[(i + d + N) % N]; o2[i] = s / 17; } return o2; };
    const ws = smooth(w), es = smooth(e); for (let i = 0; i < N; i++) { if (ws[i] < 1.2) ws[i] = 0; es[i] = Math.max(ws[i], es[i]); }
    W.push(ws); E.push(es);
  }
  tr.walk = { W, E };
  tr.stand = findStand(tr);
}

// Sitio de la tribuna principal: el primero cerca de la salida cuyo rectángulo no toque ningún tramo de pista ni el paso de peatones
function findStand(tr) {
  const N = tr.N, half = 28, depth = 7, reach = Math.ceil(half / tr.ds), lim = (WALL + 0.6) ** 2;
  const closed = (i) => (tr.tunnels || []).some((t) => i * tr.ds > t.s0 - half && i * tr.ds < t.s1 + half) || (tr.bridge && Math.min(Math.abs(i - tr.bridge.i), N - Math.abs(i - tr.bridge.i)) < tr.bridge.span + reach);
  const free = (x, z) => { for (let j = 0; j < N; j += 3) if ((tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < lim) return false; return true; };
  for (const side of [1, -1]) for (let k = 0; k <= 26; k++) {
    const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10, i = ((Math.floor((44 + off) / tr.ds) % N) + N) % N; if (closed(i)) continue;
    let w = 1; if (tr.walk) for (let d = -reach; d <= reach; d++) w = Math.max(w, tr.walk.W[side > 0 ? 1 : 0][(i + d + N) % N]);
    const lat = WALL + w + 0.8; let ok = true;
    for (let a = -half; a <= half && ok; a += 4) for (let b = 0; b <= depth && ok; b += 1.75) ok = free(tr.X[i] - tr.TZ[i] * (lat + b) * side + tr.TX[i] * a, tr.Z[i] + tr.TX[i] * (lat + b) * side + tr.TZ[i] * a);
    if (ok) return { i, side, lat };
  }
  return null;
}

export function walkwayMesh(tr, th, stride, safe) {
  const st = STYLE[th.id]; if (!st || !tr.walk) return null;
  const N = tr.N, L = WALL, pos = [], cols = [], ca = new THREE.Color(st.a), cb = new THREE.Color(st.b), cu = st.curb != null ? new THREE.Color(st.curb) : null, g0 = new THREE.Color(th.grass), g1 = new THREE.Color(th.ground);
  const bk = (i, side) => (tr.bank ? Math.tan(tr.bank[i]) * side * L : 0);
  for (const sd of [0, 1]) {
    const side = sd ? 1 : -1, W = tr.walk.W[sd], E = tr.walk.E[sd];
    const P = (i, l, y) => { const q = safe(i, side, l); return q ? [q[0], y, q[1]] : [tr.X[i] - tr.TZ[i] * l * side, y, tr.Z[i] + tr.TX[i] * l * side]; };
    const quad = (a, b, c, d, c0, c1) => { pos.push(...a, ...c, ...b, ...b, ...c, ...d); for (const k of [c0, c1, c0, c0, c1, c1]) cols.push(k.r, k.g, k.b); };
    for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N; if (W[i] < 0.1 && W[j] < 0.1) continue;
      const yi = tr.Y[i] + bk(i, side) - 0.03, yj = tr.Y[j] + bk(j, side) - 0.03, top = (i2, y) => [P(i2, L + 0.3, y), P(i2, L + W[i2], y)];
      const [ai, bi] = top(i, yi), [aj, bj] = top(j, yj), c = Math.floor((i * tr.ds) / st.step) % 2 ? ca : cb;
      quad(ai, bi, aj, bj, c, c);
      const lip = cu ? 0.28 : 0;
      if (cu) { const ci = P(i, L + W[i] + lip, yi + 0.02), cj = P(j, L + W[j] + lip, yj + 0.02); quad(bi, ci, bj, cj, cu, cu); }
      const end = (i2) => { const h = tr.Y[i2] + bk(i2, side), rest = E[i2] - W[i2], fall = 2.5 + 1.1 * tr.Y[i2]; return P(i2, L + E[i2] + lip, Math.max(0, h * (1 - rest / fall)) - 0.03); };
      const li = cu ? P(i, L + W[i] + lip, yi + 0.02) : bi, lj = cu ? P(j, L + W[j] + lip, yj + 0.02) : bj;
      quad(li, end(i), lj, end(j), g0, g1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  const n = g.attributes.normal; let up = 0; for (let k = 0; k < n.count; k++) up += n.getY(k); if (up < 0) for (let k = 0; k < n.count; k++) n.setXYZ(k, -n.getX(k), -n.getY(k), -n.getZ(k));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; m.receiveShadow = true;
  return m;
}
