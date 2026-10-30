// Uso: en una carpeta con  npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp ; node prep-car.mjs <m3|qashqai|mini|cupra> [tris_hi] [tris_lo]  (ajusta las rutas SRC)
// Prepara un coche .glb (cientos de miles de triángulos, sin ruedas separadas) para el juego:
// orienta (Y arriba, morro +Z), escala a metros reales, separa las 4 ruedas y simplifica por niveles.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, weld, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
await MeshoptSimplifier.ready;

const CARS = {
  m3: { src: '/mnt/user-data/uploads/50841c5c-bmw_m3_e46.glb', len: 4.49, tire: /rubber/i, red: /taillight/i, paint: /^Material$/ },
  qashqai: { src: '/mnt/user-data/uploads/nissan_qashqai_2010.glb', len: 4.33, tire: /^tire$/i, red: /redglass/i, paint: /carpaint/i },
  mini: { src: '/mnt/user-data/uploads/mini__cooper_s_clubman_2011.glb', len: 3.96, tire: /^tire$/i, red: /redglass/i, paint: /carpaint/i },
  cupra: { src: '/mnt/user-data/uploads/2025_cupra_leon.glb', len: 4.45, tire: /^Iron_Clean_Distorted$/i, rmul: 1.77, red: /GlassRed1|Red_Light/i, paint: /^body$/i },
};
const id = process.argv[2], cfg = CARS[id];
const budgets = { hi: +process.argv[3] || 100000, lo: +process.argv[4] || 14000 };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(cfg.src);
const root = doc.getRoot();

// 1) recolectar triángulos en coordenadas de mundo
const prims = [];
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const M = n.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), idx = p.getIndices(), uvA = p.getAttribute('TEXCOORD_0');
    const cnt = pos.getCount(), P = new Float64Array(cnt * 3), N = new Float32Array(cnt * 3), a = [0, 0, 0];
    for (let i = 0; i < cnt; i++) {
      pos.getElement(i, a);
      P[i * 3] = M[0] * a[0] + M[4] * a[1] + M[8] * a[2] + M[12]; P[i * 3 + 1] = M[1] * a[0] + M[5] * a[1] + M[9] * a[2] + M[13]; P[i * 3 + 2] = M[2] * a[0] + M[6] * a[1] + M[10] * a[2] + M[14];
      if (nor) { nor.getElement(i, a); const x = M[0] * a[0] + M[4] * a[1] + M[8] * a[2], y = M[1] * a[0] + M[5] * a[1] + M[9] * a[2], z = M[2] * a[0] + M[6] * a[1] + M[10] * a[2], l = Math.hypot(x, y, z) || 1; N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l; }
    }
    let I; if (idx) I = Uint32Array.from(idx.getArray()); else { I = new Uint32Array(cnt); for (let i = 0; i < cnt; i++) I[i] = i; }
    let UV = null; if (uvA) { UV = new Float32Array(cnt * 2); const b = [0, 0]; for (let i = 0; i < cnt; i++) { uvA.getElement(i, b); UV[i * 2] = b[0]; UV[i * 2 + 1] = b[1]; } }
    prims.push({ mat: p.getMaterial(), name: p.getMaterial() ? p.getMaterial().getName() : '', P, N, I, UV });
  }
}
// 2) ejes con las ruedas
const ext = (re, ax) => { let mn = 1e18, mx = -1e18; for (const q of prims) if (re.test(q.name)) for (let i = ax; i < q.P.length; i += 3) { const v = q.P[i]; if (v < mn) mn = v; if (v > mx) mx = v; } return [mn, mx]; };
const tireExt = [0, 1, 2].map((ax) => { const [a, b] = ext(cfg.tire, ax); return b - a; });
const up = tireExt.indexOf(Math.min(...tireExt));
const rest = [0, 1, 2].filter((k) => k !== up);
const len = tireExt[rest[0]] > tireExt[rest[1]] ? rest[0] : rest[1], wid = rest.find((k) => k !== len);
// extensión global
const gmn = [1e18, 1e18, 1e18], gmx = [-1e18, -1e18, -1e18];
for (const q of prims) for (let i = 0; i < q.P.length; i += 3) for (let k = 0; k < 3; k++) { const v = q.P[i + k]; if (v < gmn[k]) gmn[k] = v; if (v > gmx[k]) gmx[k] = v; }
// signo de "arriba": las ruedas están más cerca del suelo que del techo
let [tu0, tu1] = ext(cfg.tire, up); const tireMid = (tu0 + tu1) / 2;
if (cfg.rmul) { const rr = (tu1 - tu0) / 2; tu0 -= rr * (cfg.rmul - 1); tu1 += rr * (cfg.rmul - 1); }
const upSign = (tireMid - gmn[up]) < (gmx[up] - tireMid) ? 1 : -1;
// signo del morro: la luz trasera roja queda atrás
let rs = 0, rc = 0; for (const q of prims) if (cfg.red.test(q.name)) for (let i = len; i < q.P.length; i += 3) { rs += q.P[i]; rc++; }
const lenMid = (gmn[len] + gmx[len]) / 2, lenSign = (rs / rc) > lenMid ? -1 : 1;
// determinante (mapa wid,up,len -> x,y,z con signos)
const perm = [wid, up, len];
const parity = (() => { let inv = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (perm[i] > perm[j]) inv++; return inv % 2 ? -1 : 1; })();
let widSign = 1; const det = parity * widSign * upSign * lenSign; if (det < 0) widSign = -1;
const scale = cfg.len / (gmx[len] - gmn[len]);
console.log(id, 'up', up, upSign, 'len', len, lenSign, 'wid', wid, widSign, 'scale', scale.toFixed(5), 'tris', prims.reduce((s, q) => s + q.I.length / 3, 0));
// transformar a canónico: x=wid, y=up, z=len ; y=0 en el suelo (parte baja de los neumáticos) ; z centrado en el eje medio
const T = (q) => { const P = q.P, N = q.N, n = P.length / 3, P2 = new Float32Array(n * 3), N2 = new Float32Array(n * 3);
  const gw = (gmn[wid] + gmx[wid]) / 2;
  const ground = upSign > 0 ? tu0 : tu1;
  for (let i = 0; i < n; i++) {
    P2[i * 3] = (P[i * 3 + wid] - gw) * widSign * scale; P2[i * 3 + 1] = (P[i * 3 + up] - ground) * upSign * scale; P2[i * 3 + 2] = (P[i * 3 + len] - lenMid) * lenSign * scale;
    N2[i * 3] = N[i * 3 + wid] * widSign; N2[i * 3 + 1] = N[i * 3 + up] * upSign; N2[i * 3 + 2] = N[i * 3 + len] * lenSign;
  } q.P2 = P2; q.N2 = N2; };
prims.forEach(T);
// 3) ruedas por cuadrantes (neumáticos) con percentiles robustos
const quad = { FL: [], FR: [], RL: [], RR: [] };
for (const q of prims) if (cfg.tire.test(q.name)) for (let t = 0; t < q.I.length; t += 3) {
  let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += q.P2[q.I[t + k] * 3]; cz += q.P2[q.I[t + k] * 3 + 2]; }
  cx /= 3; cz /= 3; const cy = (q.P2[q.I[t] * 3 + 1] + q.P2[q.I[t + 1] * 3 + 1] + q.P2[q.I[t + 2] * 3 + 1]) / 3;
  if (cy < 0.03 && false) continue;
  (quad[(cz > 0 ? 'F' : 'R') + (cx > 0 ? 'L' : 'R')]).push([q.P2[q.I[t] * 3], q.P2[q.I[t] * 3 + 1], q.P2[q.I[t] * 3 + 2], cx, cy, cz]);
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))]; };
const W = {};
for (const [k, tr] of Object.entries(quad)) {
  const xs = tr.map((r) => r[0]), ys = tr.map((r) => r[1]), zs = tr.map((r) => r[2]);
  const y0 = pct(ys, 0.01), y1 = pct(ys, 0.99), z0 = pct(zs, 0.01), z1 = pct(zs, 0.99);
  const R = Math.min((y1 - y0) / 2, (z1 - z0) / 2);
  W[k] = { cx: pct(xs, 0.5), cy: (y0 + y1) / 2, cz: (z0 + z1) / 2, R: R * (cfg.rmul || 1), hw: Math.abs(pct(xs, 0.97) - pct(xs, 0.03)) / 2 };
  // el centro lateral es el de la rueda completa: ancho aproximado por los neumáticos
  const xmin = pct(xs, 0.01), xmax = pct(xs, 0.99); W[k].cx = (xmin + xmax) / 2; W[k].hw = cfg.rmul ? Math.max(0.12, (xmax - xmin) / 2 * 1.25) : (xmax - xmin) / 2;
}
console.log('ruedas', JSON.stringify(Object.fromEntries(Object.entries(W).map(([k, w]) => [k, [w.cx, w.cy, w.cz, w.R, w.hw].map((v) => +v.toFixed(3))]))));
// 4) clasificar triángulos: rueda k o carrocería
const skipWheel = /glass|paint|light|mirror/i;
const bodyTris = new Map(), wheelTris = { FL: new Map(), FR: new Map(), RL: new Map(), RR: new Map() };
const push = (m, q, t) => { let l = m.get(q); if (!l) m.set(q, (l = [])); l.push(q.I[t], q.I[t + 1], q.I[t + 2]); };
for (const q of prims) {
  const isTire = cfg.tire.test(q.name), noWheel = (skipWheel.test(q.name) || cfg.paint.test(q.name)) && !isTire;
  for (let t = 0; t < q.I.length; t += 3) {
    let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { const v = q.I[t + k] * 3; cx += q.P2[v]; cy += q.P2[v + 1]; cz += q.P2[v + 2]; }
    cx /= 3; cy /= 3; cz /= 3;
    let hit = null;
    if (!noWheel) for (const [k, w] of Object.entries(W)) if (Math.abs(cx - w.cx) <= w.hw * 1.12 && Math.hypot(cy - w.cy, cz - w.cz) <= w.R * 1.02) { hit = k; break; }
    if (hit) push(wheelTris[hit], q, t); else push(bodyTris, q, t);
  }
}
// 5) construir LODs
const total = [...bodyTris.values()].reduce((s, l) => s + l.length / 3, 0);
console.log('triángulos carrocería', total, 'por rueda', Object.fromEntries(Object.entries(wheelTris).map(([k, m]) => [k, [...m.values()].reduce((s, l) => s + l.length / 3, 0)])));
const wgt = (name) => cfg.paint.test(name) ? 1.0 : /glass/i.test(name) ? 0.35 : /light|chrome|mirror|logo|steel|iron/i.test(name) ? 0.15 : /interior/i.test(name) ? 0.08 : 0.05;
function build(tag, budget, wheelBudget) {
  // limpiar escena
  for (const sc of root.listScenes()) for (const c of sc.listChildren()) c.dispose();
  for (const m of root.listMeshes()) m.dispose(); for (const a of root.listAccessors()) a.dispose();
  const scene = root.listScenes()[0];
  const mk = (map, ratioFor) => { const mesh = doc.createMesh(); for (const [q, tris] of map) {
      const want = ratioFor(q, tris.length / 3); let I = Uint32Array.from(tris);
      // compactar vértices usados
      const remap = new Map(), used = []; const I2 = new Uint32Array(I.length); for (let i = 0; i < I.length; i++) { let r = remap.get(I[i]); if (r === undefined) { r = used.length; remap.set(I[i], r); used.push(I[i]); } I2[i] = r; }
      let P = new Float32Array(used.length * 3), N = new Float32Array(used.length * 3), UV = q.UV ? new Float32Array(used.length * 2) : null; for (let i = 0; i < used.length; i++) { for (let k = 0; k < 3; k++) { P[i * 3 + k] = q.P2[used[i] * 3 + k]; N[i * 3 + k] = q.N2[used[i] * 3 + k]; } if (UV) { UV[i * 2] = q.UV[used[i] * 2]; UV[i * 2 + 1] = q.UV[used[i] * 2 + 1]; } }
      let out = I2;
      if (want < 1 && I2.length > 90) { const target = Math.max(60, Math.round((I2.length * want) / 3) * 3); const [o] = MeshoptSimplifier.simplify(I2, P, 3, target, 0.06, []); out = o; if (out.length > target * 2.2) { const [o2] = MeshoptSimplifier.simplifySloppy(I2, P, 3, null, target, 0.1); out = o2; } }
      const prim = doc.createPrimitive().setMaterial(q.mat)
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P)).setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(out)));
      if (UV) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(UV));
      mesh.addPrimitive(prim); } return mesh; };
  // reparto de presupuesto de la carrocería
  const wsum = [...bodyTris].reduce((s, [q, l]) => s + (l.length / 3) * wgt(q.name), 0);
  const k = Math.min(1, budget / wsum);
  const bodyMesh = mk(bodyTris, (q, n) => Math.min(1, k * wgt(q.name)));
  scene.addChild(doc.createNode('body').setMesh(bodyMesh));
  for (const [kname, map] of Object.entries(wheelTris)) {
    const w = W[kname]; const n = [...map.values()].reduce((s, l) => s + l.length / 3, 0);
    // la rueda se re-centra en su eje
    const cmap = new Map(); for (const [q, tris] of map) { const q2 = { ...q, P2: Float32Array.from(q.P2) }; for (let i = 0; i < q2.P2.length; i += 3) { q2.P2[i] -= w.cx; q2.P2[i + 1] -= w.cy; q2.P2[i + 2] -= w.cz; } cmap.set(q2, tris); }
    const wm = mk(cmap, () => Math.min(1, wheelBudget / Math.max(1, n)));
    scene.addChild(doc.createNode('wheel_' + kname).setTranslation([w.cx, w.cy, w.cz]).setMesh(wm));
  }
  return tag;
}
for (const [tag, budget, wb] of [['hi', budgets.hi, 9000], ['lo', budgets.lo, 700]]) {
  build(tag, budget, wb);
  // guardar una copia: clonar documento leyendo/escribiendo a memoria
  const clone = await io.readBinary(await io.writeBinary(doc));
  await clone.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: tag === 'hi' ? 82 : 60, resize: tag === 'hi' ? [1024, 1024] : [256, 256] }), weld({ tolerance: 0 }), prune(), quantize({ quantizePosition: 15, quantizeNormal: 10, quantizeTexcoord: 13 }));
  let tris = 0; for (const m of clone.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  const out = `car_${id}_${tag}.glb`; await io.write(out, clone); execSync(`gzip -9 -f -k ${out}`);
  console.log(out, 'tris', tris, 'KB', (statSync(out).size / 1024) | 0, 'gz', (statSync(out + '.gz').size / 1024) | 0);
}
console.log('paint regex', cfg.paint, 'materiales', [...new Set(prims.map((q) => q.name))].join(','));
