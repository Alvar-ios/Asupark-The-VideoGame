// Generación y consulta de pistas (sin dependencias de three)
import { rngFromSeed, shuffle } from './rng.js';

export let ROAD_HALF = 7.5;   // semianchura del asfalto (cada circuito puede fijar la suya: tr.half)
export let WALL = 11.5;       // distancia lateral de las vallas
export function setRoad(tr) { if (tr && tr.half && (tr.half !== ROAD_HALF || tr.wall !== WALL)) { ROAD_HALF = tr.half; WALL = tr.wall; } }
export const DS = 1;            // metros entre muestras
const TAU = Math.PI * 2;
export const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function catmullClosed(pts, per) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
function resampleClosed(P, ds) {
  const n = P.length, cum = [0];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const len = cum[n], N = Math.round(len / ds), out = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const t = (k * len) / N;
    while (cum[j + 1] < t) j++;
    const a = P[j], b = P[(j + 1) % n];
    const u = (t - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}
function smoothClosed(P, iters) {
  for (let it = 0; it < iters; it++) {
    const n = P.length, Q = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = P[(i - 2 + n) % n], b = P[(i - 1 + n) % n], c = P[i], d = P[(i + 1) % n], e = P[(i + 2) % n];
      Q[i] = [(a[0] + 4 * b[0] + 6 * c[0] + 4 * d[0] + e[0]) / 16, (a[1] + 4 * b[1] + 6 * c[1] + 4 * d[1] + e[1]) / 16];
    }
    P = Q;
  }
  return P;
}
function curvatureOf(P, ds) {
  const n = P.length, th = new Float64Array(n), k = new Float64Array(n), ks = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    th[i] = Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  for (let i = 0; i < n; i++) k[i] = wrapPi(th[(i + 1) % n] - th[(i - 1 + n) % n]) / (2 * ds);
  for (let i = 0; i < n; i++) { // suavizado ±5
    let s = 0;
    for (let d = -5; d <= 5; d++) s += k[(i + d + n) % n];
    ks[i] = s / 11;
  }
  return ks;
}

function generate(seed, style, attempt) {
  const rng = rngFromSeed(seed + ':' + attempt);
  const n = style.fixedNodes ? style.fixedNodes.length : style.nodes, nodes = [];
  const phase = rng() * TAU, sx = 0.8 + rng() * 0.45, sz = 1 / sx;
  if (style.fixedNodes) for (const q of style.fixedNodes) nodes.push([q[0], q[1]]);
  else for (let i = 0; i < n; i++) {
    const th = phase + ((i + (rng() - 0.5) * style.angJit) / n) * TAU;
    let r = 1 + (rng() * 2 - 1) * style.wobble;
    if (rng() < style.pinch) r *= 0.45 + rng() * 0.2;
    nodes.push([Math.cos(th) * r * sx, Math.sin(th) * r * sz]);
  }
  let dense = catmullClosed(nodes, 40);
  let len0 = 0;
  for (let i = 0; i < dense.length; i++) { const a = dense[i], b = dense[(i + 1) % dense.length]; len0 += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const sc = style.fixedNodes ? style.scale || 1 : style.length / len0;
  dense = dense.map((p) => [p[0] * sc, p[1] * sc]);
  let P = resampleClosed(dense, DS);
  P = smoothClosed(P, 3);
  // chicanes (eses) sobre rectas
  let k0 = curvatureOf(P, DS);
  const N0 = P.length;
  for (let c = 0; c < style.chicanes; c++) {
    const per = 110, W = style.chicaneW || 220, amp = 7.5 + rng() * 2;
    const cand = [];
    for (let s = 0; s < N0; s += 10) {
      let ok = true;
      for (let d = 0; d < W + 60; d += 6) if (Math.abs(k0[(s + d) % N0]) > (style.chicaneThr || 0.0035)) { ok = false; break; }
      if (ok) cand.push(s);
    }
    if (!cand.length) break;
    const s0 = cand[Math.floor(rng() * cand.length)], dir = rng() < 0.5 ? 1 : -1;
    const Q = P.map((p) => p.slice());
    for (let d = 0; d < W; d++) {
      const i = (s0 + 30 + d) % N0, a = P[(i - 1 + N0) % N0], b = P[(i + 1) % N0];
      const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
      const u = d / W, env = Math.sin(Math.PI * u) ** 2, off = dir * amp * env * Math.sin(TAU * u * 2);
      Q[i][0] += (-tz / tl) * off; Q[i][1] += (tx / tl) * off;
    }
    P = Q;
    k0 = curvatureOf(P, DS);
  }
  P = smoothClosed(P, 2);
  P = resampleClosed(P, DS);
  const N = P.length, ds = DS;
  const kap = curvatureOf(P, ds);
  let maxK = 0;
  for (let i = 0; i < N; i++) maxK = Math.max(maxK, Math.abs(kap[i]));
  if (1 / maxK < (style.minR || 30)) return null;
  // separación entre tramos no contiguos
  for (let i = 0; i < N; i += 2) {
    for (let j = i + 1; j < N; j += 2) {
      const gap = Math.min(j - i, N - (j - i)) * ds;
      if (gap < 90) continue;
      const dx = P[i][0] - P[j][0], dz = P[i][1] - P[j][1];
      const sp = style.sep || 55;
      if (dx * dx + dz * dz < sp * sp) return null;
    }
  }
  return { P, kap, rng };
}

export function buildTrack(seed, style) {
  let g = null, attempt = 0, st = style;
  while (!g && attempt < 120) {
    if (attempt === 25) st = { ...style, pinch: style.pinch * 0.5, wobble: style.wobble * 0.85, length: style.length * 1.1 };
    if (attempt === 55) st = { ...style, pinch: 0.05, wobble: style.wobble * 0.7, chicanes: 1, length: style.length * 1.25 };
    if (attempt === 85) st = { ...style, pinch: 0, wobble: 0.2, chicanes: 0, length: style.length * 1.4 };
    g = generate(seed, st, attempt++);
  }
  if (!g) throw new Error('No se pudo generar la pista ' + seed);
  let { P, kap } = g;
  const rng = g.rng, N = P.length, ds = DS, len = N * ds;
  // elegir la salida en la recta más limpia
  let bestI = 0, bestV = 1e9;
  for (let i = 0; i < N; i += 5) {
    let m = 0;
    for (let d = -60; d <= 150; d += 5) m = Math.max(m, Math.abs(kap[(i + d + N) % N]));
    if (m < bestV) { bestV = m; bestI = i; }
  }
  if (style.startNear) { const sx = style.startNear[0] * (style.scale || 1), sz = style.startNear[1] * (style.scale || 1); let bd = 1e18; for (let i = 0; i < N; i++) { const d = (P[i][0] - sx) ** 2 + (P[i][1] - sz) ** 2; if (d < bd) { bd = d; bestI = i; } } }
  P = P.slice(bestI).concat(P.slice(0, bestI));
  kap = Float64Array.from({ length: N }, (_, i) => kap[(i + bestI) % N]);

  const X = new Float64Array(N), Z = new Float64Array(N), Y = new Float64Array(N);
  const TX = new Float64Array(N), TZ = new Float64Array(N), absK = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = P[i][0]; Z[i] = P[i][1];
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
    const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
    TX[i] = tx / tl; TZ[i] = tz / tl;
    absK[i] = Math.abs(kap[i]);
  }
  const tr = { seed, N, ds, len, X, Z, Y, TX, TZ, kap, absK, ramps: [], pads: [], rollers: [], half: style.half || 7.5, wall: style.wall || 11.5 };

  // --- elementos divertidos ---
  const straight = (s0, s1, thr) => {
    for (let s = s0; s <= s1; s += 4) if (absK[((Math.floor(s / ds) % N) + N) % N] > thr) return false;
    return true;
  };
  const cands = [];
  for (const thr of style.thr || [0.0045, 0.007, 0.01]) {
    for (let s = style.candFrom || 200; s < len - (style.candTo || 260); s += 15) if (straight(s - 30, s + (style.rampRun || 120), thr) && !cands.includes(s)) cands.push(s);
    if (cands.length > 12) break;
  }
  shuffle(cands, rng);
  for (const sep of [300, 200, 120, 80]) {
    for (const s of cands) {
      if (tr.ramps.length >= style.ramps) break;
      if (tr.ramps.every((r) => Math.abs(r.s0 - s) > sep)) tr.ramps.push({ s0: s, len: 17, h: 1.15 });
    }
  }
  const rn = style.rollerN || 5, rl = rn * 32 + 15;
  for (const thr of style.thr2 || [0.006, 0.01, 0.015]) {
    for (let s = style.candFrom || 220; s < len - (style.candTo || 300); s += 10) {
      if (tr.rollers.length >= style.rollers) break;
      if (!straight(s, s + rl, thr)) continue;
      if (tr.ramps.some((r) => s < r.s0 + 70 && s + rl > r.s0 - 40)) continue;
      if (tr.rollers.every((r) => Math.abs(r.s0 - s) > 200)) tr.rollers.push({ s0: s, n: rn, wl: 32, amp: 0.32 });
    }
  }
  const blocked = (s) => tr.ramps.some((r) => s > r.s0 - 40 && s < r.s0 + 60) || tr.rollers.some((r) => s > r.s0 - 30 && s < r.s0 + r.n * r.wl + 30) || s < 60 || s > len - 60;
  for (let i = 0; i < N && tr.pads.length < style.pads; i += 1) {
    if (absK[i] < 0.012) continue;
    let peak = true;
    for (let d = -60; d <= 60; d += 5) if (absK[(i + d + N) % N] > absK[i]) { peak = false; break; }
    if (!peak) continue;
    const s = i * ds + 52 + rng() * 20;
    if (!blocked(s) && tr.pads.every((p) => Math.abs(p.s - s) > (style.padSep || 120))) tr.pads.push({ s, lat: (rng() * 2 - 1) * 3.2, len: 12, w: 5 });
  }
  for (const s of cands) {
    if (tr.pads.length >= style.pads) break;
    const sp = s + 40;
    if (!blocked(sp) && tr.pads.every((p) => Math.abs(p.s - sp) > (style.padSep || 150))) tr.pads.push({ s: sp, lat: (rng() * 2 - 1) * 3.2, len: 12, w: 5 });
  }
  tr.pads.sort((a, b) => a.s - b.s);

  // --- rasgos propios de cada circuito: rampas a medida, túneles y curvas peraltadas ---
  if (style.rampList) tr.ramps = style.rampList.map((r) => ({ s0: r.u * len, len: (r.len || 12) * 1.5, h: (r.h || 1.6) * 0.7 }));
  tr.zones = (style.zones || []).map(([u0, u1, type]) => ({ s0: u0 * len, s1: u1 * len, type }));
  if (style.autoZones && !tr.zones.length) { // circuitos del día: dos tramos de otra superficie en puntos al azar
    const k = style.autoZones; let u = 0.12 + rng() * 0.15;
    for (let n = 0; n < 2; n++) { const w = 0.05 + rng() * 0.04; tr.zones.push({ s0: u * len, s1: (u + w) * len, type: k[Math.floor(rng() * k.length)] }); u += 0.38 + rng() * 0.2; if (u + w > 0.95) break; }
  }
  tr.tunnels = (style.tunnels || []).map(([u0, u1]) => ({ s0: u0 * len, s1: u1 * len }));
  tr.bank = new Float32Array(N); // ángulo de peralte (rad) en cada muestra; positivo = sube el lado derecho
  for (const [u0, u1, deg] of style.banks || []) {
    const a = Math.floor(u0 * N), b = Math.floor(u1 * N); let km = 0; for (let i = a; i < b; i++) km += kap[i % N]; const sg = km >= 0 ? 1 : -1;
    for (let i = a; i < b; i++) { const u = (i - a) / (b - a); tr.bank[i % N] = Math.sin(Math.PI * u) ** 2 * (deg * 0.72 * Math.PI / 180) * sg; } // entrada y salida graduales
  }
  // --- perfil de altura ---
  const A1 = style.hill || 0, ph = [rng() * TAU, rng() * TAU, rng() * TAU];
  const k1 = 1 + Math.floor(rng() * 2), k2 = 3 + Math.floor(rng() * 2), k3 = 6 + Math.floor(rng() * 2);
  let minBase = 1e9;
  const base = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const u = (i * ds) / len;
    base[i] = A1 * Math.sin(TAU * k1 * u + ph[0]) + A1 * 0.45 * Math.sin(TAU * k2 * u + ph[1]) + A1 * 0.15 * Math.sin(TAU * k3 * u + ph[2]);
    if (style.hillPts) { // perfil de altura explícito [fracción de vuelta, altura], interpolado con coseno
      const pts = style.hillPts; let a = pts[pts.length - 1], b = pts[0], uu = u;
      for (let q = 0; q < pts.length - 1; q++) if (u >= pts[q][0] && u <= pts[q + 1][0]) { a = pts[q]; b = pts[q + 1]; break; }
      const t = b[0] === a[0] ? 0 : (uu - a[0]) / (b[0] - a[0]); base[i] = a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t))));
    }
    minBase = Math.min(minBase, base[i]);
  }
  // fuera de la salida la pista es llana (primeros metros)
  for (let i = 0; i < N; i++) {
    let h = base[i] - minBase + 0.8;
    const s = i * ds;
    for (const r of tr.rollers) {
      const u = s - r.s0;
      if (u >= 0 && u < r.n * r.wl) h += r.amp * (0.5 - 0.5 * Math.cos((TAU * u) / r.wl));
    }
    for (const r of tr.ramps) {
      const u = s - r.s0;
      if (u >= 0 && u < r.len) h += r.h * (u / r.len);
    }
    Y[i] = h;
  }
  return tr;
}

// Proyección de un punto sobre la pista. hint<0 => búsqueda completa.
export function locate(tr, x, z, hint, out) {
  const { N, X, Z, Y, TX, TZ, ds } = tr;
  let best = 0, bd = 1e18;
  if (hint < 0) {
    for (let i = 0; i < N; i += 2) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    for (let k = -3; k <= 3; k++) { const i = (best + k + N) % N, dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  } else {
    for (let k = -48; k <= 48; k++) { const i = (hint + k + N) % N, dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  }
  const seg = (a) => {
    const b = (a + 1) % N, ex = X[b] - X[a], ez = Z[b] - Z[a];
    let t = ((x - X[a]) * ex + (z - Z[a]) * ez) / (ex * ex + ez * ez);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = X[a] + ex * t, pz = Z[a] + ez * t;
    return { a, b, t, px, pz, d: (x - px) ** 2 + (z - pz) ** 2, ex, ez };
  };
  const s1 = seg(best), s0 = seg((best - 1 + N) % N);
  const sg = s1.d <= s0.d ? s1 : s0;
  const el = Math.hypot(sg.ex, sg.ez) || 1, tx = sg.ex / el, tz = sg.ez / el;
  out.i = sg.a; out.t = sg.t;
  out.s = (sg.a + sg.t) * ds;
  out.h = Y[sg.a] + (Y[sg.b] - Y[sg.a]) * sg.t;
  out.tx = tx; out.tz = tz;
  out.bank = tr.bank ? tr.bank[sg.a] + (tr.bank[sg.b] - tr.bank[sg.a]) * sg.t : 0;
  out.lat = (x - sg.px) * -tz + (z - sg.pz) * tx; // + = derecha
  if (out.bank) out.h += Math.tan(out.bank) * (out.lat > WALL ? WALL : out.lat < -WALL ? -WALL : out.lat); // la superficie peraltada sube hacia fuera
  return out;
}

export function pointAt(tr, s, lat, out) {
  const { N, X, Z, Y, TX, TZ, ds, len } = tr;
  s = ((s % len) + len) % len;
  const f = s / ds, i = Math.floor(f) % N, j = (i + 1) % N, t = f - Math.floor(f);
  const tx = TX[i] + (TX[j] - TX[i]) * t, tz = TZ[i] + (TZ[j] - TZ[i]) * t, tl = Math.hypot(tx, tz) || 1;
  out.tx = tx / tl; out.tz = tz / tl;
  out.x = X[i] + (X[j] - X[i]) * t + -out.tz * lat;
  out.z = Z[i] + (Z[j] - Z[i]) * t + out.tx * lat;
  out.y = Y[i] + (Y[j] - Y[i]) * t;
  return out;
}
