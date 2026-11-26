// Convierte un circuito descargado en circuito jugable:
//  1) src/assets/track_<id>.glb.gz: el modelo en metros del juego, unido por materiales y con texturas pequeñas;
//  2) src/tracks-data.js: la línea central (x, z, altura) sacada de la propia calzada y, si hay barreras, dónde están.
// El trazado se da con unos puntos aproximados leídos en un plano cenital; la herramienta los centra en la calzada.
// Uso: node tools/prep-tracks.mjs <carpeta con los .glb descargados>
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) { console.log('Uso: node tools/prep-tracks.mjs <carpeta>'); process.exit(1); }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const TRACKS = {
  misty: {
    file: 'boom_karts_misty_cliffs.glb',
    scale: 26, half: 5.3,
    dropNodes: /^(DynamicProps|LightmapCube|SceneReferences|Camera)/,
    road: { node: /^CliffsRoad(.00[123])?$/ }, // la franja de hormigón (CliffsRoad) también es calzada
    keep: [[4.95, 6.0, 6.5, 9.3]], // ahí el camino va partido por la roca: se respetan los puntos dados [x0, x1, z0, z1]
    startY: -0.11,
    // plano de 900 px: x = 2.5 + px/150, z = 3.8 + py/150
    map: (px, py) => [2.5 + px / 150, 3.8 + py / 150],
    path: [[300, 994], [260, 999], [215, 985], [170, 955], [140, 910], [122, 860], [118, 810], [130, 765], [165, 735], [220, 722], [275, 712], [305, 690], [316, 650], [311, 600], [308, 550], [320, 515], [350, 503], [378, 480], [390, 440], [396, 400], [398, 365], [425, 335], [470, 310], [520, 305], [565, 318], [600, 345], [625, 375], [650, 405], [680, 422], [712, 415], [745, 395], [775, 360], [790, 325], [790, 295], [770, 268], [730, 255], [690, 248], [660, 222], [625, 180], [590, 140], [560, 118], [525, 108], [490, 118], [465, 145], [458, 185], [470, 225], [500, 250], [525, 265], [525, 292], [515, 330], [487, 380], [467, 422], [468, 478], [460, 525], [443, 570], [428, 600], [413, 630], [406, 660], [402, 690], [407, 720], [423, 750], [450, 780], [495, 806], [538, 826], [565, 865], [570, 915], [550, 955], [520, 992], [480, 1003], [440, 1000], [400, 996], [350, 993]],
    wallExtra: 0.25, // los bordes son precipicios: el muro invisible va en el borde de la calzada
    stepTol: 0.55, // un escalón mayor que esto (m) ya no es la misma calzada
    edgeFromRoad: true,
    solids: true, // las rocas, paredes y demás decorado que invade la pista se pueden chocar
  },
  mario3: {
    file: 'mario_kart_8_deluxe_-_snes_mario_circuit_3.glb',
    scale: 0.0342, half: 5.5, flat: true,
    dropNodes: /^Object_(29|30|31|32|33)$/, // vienen repetidos
    dropMaterials: ['material_12', 'material_13', 'material_15'], // fondos gigantes que tapaban el cielo del juego
    road: { materials: ['material_18'] },
    barriers: ['material_0', 'material_8'],
    tile: ['material_0', 'material_1', 'material_8'],
    ratio: { material_0: 0.08, material_8: 0.08, '*': 0.3 },
    error: 0.01,
    // plano de 1000 px: x = -2600 + px*5.2, z = -2300 + py*5.198
    map: (px, py) => [-2600 + px * 5.2, -2300 + py * 5.198],
    path: [[129, 330], [129, 250], [129, 175], [135, 135], [155, 95], [190, 72], [240, 63], [290, 72], [330, 100], [355, 140], [385, 190], [410, 225], [440, 238], [500, 240], [560, 238], [590, 220], [605, 190], [620, 145], [640, 105], [670, 85], [715, 72], [760, 72], [805, 85], [845, 115], [865, 155], [872, 205], [868, 255], [845, 290], [805, 312], [740, 328], [660, 347], [580, 364], [500, 382], [430, 400], [395, 412], [378, 434], [382, 462], [405, 483], [445, 490], [520, 487], [600, 486], [700, 486], [775, 487], [825, 500], [860, 530], [870, 580], [862, 640], [830, 678], [785, 698], [730, 706], [660, 706], [620, 700], [598, 685], [588, 655], [578, 628], [555, 617], [500, 617], [465, 619], [440, 635], [400, 672], [360, 710], [310, 732], [250, 737], [200, 726], [172, 705], [155, 670], [138, 625], [129, 590], [129, 500], [129, 420]],
  },
};

// ---------- lectura: triángulos en coordenadas del archivo ----------
function readTris(doc, cfg) {
  const out = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const M = n.getWorldMatrix(), chain = []; for (let p = n; p && p.getName; p = p.getParentNode()) chain.push(p.getName());
    if (cfg.dropNodes && chain.some((c) => cfg.dropNodes.test(c))) continue;
    for (const prim of m.listPrimitives()) {
      if (cfg.dropMaterials && cfg.dropMaterials.includes(prim.getMaterial().getName())) continue;
      const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), col = prim.getAttribute('COLOR_0'), a = [0, 0, 0, 1], b = [0, 0];
      const V = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, a); const p = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2] + M[12], M[1] * a[0] + M[5] * a[1] + M[9] * a[2] + M[13], M[2] * a[0] + M[6] * a[1] + M[10] * a[2] + M[14]];
        let q = [0, 1, 0]; if (nor) { nor.getElement(i, a); q = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2], M[1] * a[0] + M[5] * a[1] + M[9] * a[2], M[2] * a[0] + M[6] * a[1] + M[10] * a[2]]; const l = Math.hypot(...q) || 1; q = q.map((v) => v / l); }
        if (uv) uv.getElement(i, b);
        let c = null; if (col) { const e = [1, 1, 1, 1]; col.getElement(i, e); c = e.slice(0, 3); }
        V.push({ p, n: q, uv: [b[0], b[1]], c });
      }
      const idx = prim.getIndices() ? prim.getIndices().getArray() : V.map((_, i) => i);
      for (let i = 0; i < idx.length; i += 3) out.push({ v: [V[idx[i]], V[idx[i + 1]], V[idx[i + 2]]], mat: prim.getMaterial(), chain });
    }
  }
  return out;
}

// ---------- consultas sobre la calzada ----------
function makeGrid(tris, cell) {
  const g = new Map();
  for (const t of tris) {
    const xs = t.v.map((v) => v.p[0]), zs = t.v.map((v) => v.p[2]);
    for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++) for (let j = Math.floor(Math.min(...zs) / cell); j <= Math.floor(Math.max(...zs) / cell); j++) { const k = i + ',' + j; (g.get(k) || g.set(k, []).get(k)).push(t); }
  }
  // alturas de la calzada en (x, z)
  return (x, z) => {
    const out = [];
    for (const t of g.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) || []) {
      const [A, B, C] = t.v.map((v) => v.p), den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-12) continue;
      const a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den, c = 1 - a - b;
      if (a >= -1e-5 && b >= -1e-5 && c >= -1e-5) out.push(a * A[1] + b * B[1] + c * C[1]);
    }
    return out;
  };
}
const catmull = (pts, per) => { const n = pts.length, out = []; for (let i = 0; i < n; i++) { const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((d) => pts[(i + d + n) % n]); for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } } return out; };
const resample = (P, step) => { const n = P.length, cum = [0]; for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(P[(i + 1) % n][0] - P[i][0], P[(i + 1) % n][1] - P[i][1])); const N = Math.round(cum[n] / step), out = []; let j = 0; for (let k = 0; k < N; k++) { const t = k * cum[n] / N; while (cum[j + 1] < t) j++; const u = (t - cum[j]) / (cum[j + 1] - cum[j] || 1), a = P[j], b = P[(j + 1) % n]; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } return out; };
const average = (arr, w) => arr.map((_, i) => { let s = 0; for (let d = -w; d <= w; d++) s += arr[(i + d + arr.length) % arr.length]; return s / (2 * w + 1); });

function centreLine(cfg, hit) {
  const S = cfg.scale, W = cfg.half * 2 / S, tol = 3 / S; // 3 m de margen en altura entre muestras seguidas
  let P = resample(catmull(cfg.path.map(([a, b]) => cfg.map(a, b)), 20), 2.5 / S);
  const heights = (Q) => { let y = cfg.startY ?? null, miss = 0; return Q.map(([x, z]) => { const hs = hit(x, z); if (!hs.length) { miss++; return y; } if (y == null) y = Math.max(...hs); else { const near = hs.reduce((a, c) => (Math.abs(c - y) < Math.abs(a - y) ? c : a)); y = near; } return y; }); };
  for (let it = 0; it < 3; it++) {
    const Y = heights(P);
    const shift = P.map(([x, z], i) => {
      const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      const on = (t) => hit(x + nx * t, z + nz * t).some((h) => Y[i] == null || Math.abs(h - Y[i]) < (cfg.stepTol ? cfg.stepTol / S : tol));
      if (!on(0) || (cfg.keep && cfg.keep.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1))) return 0;
      let lo = 0, hi = 0; while (lo > -W && on(lo - W / 40)) lo -= W / 40; while (hi < W && on(hi + W / 40)) hi += W / 40;
      const wd = hi - lo; if (wd < W * 0.65 || wd > W * 1.35) return 0; // cruces y bifurcaciones: se respeta el punto dado
      return Math.max(-W * 0.3, Math.min(W * 0.3, (lo + hi) / 2));
    });
    const soft = average(shift, 3);
    P = P.map(([x, z], i) => { const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [x - tz / l * soft[i] * 0.8, z + tx / l * soft[i] * 0.8]; });
    P = resample(P, 2.5 / S);
  }
  return { P, Y: average(heights(P), 2) };
}

// ---------- obstáculos: el decorado que invade la pista se vuelve sólido ----------
// Se corta cada cara empinada del modelo con un plano a la altura del kart (la de la calzada más cercana). Lo que
// queda dentro del pasillo de la pista son segmentos contra los que se choca.
const SOFT = /grass|plant|vegetation|shrub|wire|decal|water|ocean|beam|finishline/i; // hierba, cables, agua y luces no frenan
function solidSegments(cfg, line, tris, road) {
  const S = cfg.scale, out = [], isRoad = new Set(road), reach = (cfg.half + 2.5) / S, L = line.P.length;
  const slope = line.P.map((p, i) => Math.abs(line.Y[(i + 1) % L] - line.Y[i]) / (Math.hypot(line.P[(i + 1) % L][0] - p[0], line.P[(i + 1) % L][1] - p[1]) || 1));
  const steep = slope.map((_, i) => { for (let d = -5; d <= 5; d++) if (slope[(i + d + L) % L] > 0.25) return true; return false; });
  for (const t of tris) {
    if (isRoad.has(t) || SOFT.test(t.mat.getName()) || t.mat.getAlphaMode() === 'BLEND' || t.chain.some((c) => SOFT.test(c))) continue;
    const [A, B, C] = t.v.map((v) => v.p), u = B.map((v, k) => v - A[k]), w = C.map((v, k) => v - A[k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], len = Math.hypot(...n);
    if (!len || Math.abs(n[1]) / len > 0.6) continue; // los suelos y rampas suaves no son paredes
    const lo = Math.min(A[1], B[1], C[1]), hi = Math.max(A[1], B[1], C[1]);
    // alturas de la calzada que pasan por delante de esta cara (puede haber dos niveles: puentes)
    const cuts = [];
    for (let i = 0; i < L; i++) {
      if (steep[i]) continue; // en el gran descenso la pared del cortado queda «dentro» de la bajada
      const y = line.Y[i] + 1.1 / S; if (y <= lo || y >= hi) continue; // los escalones bajos no cuentan: de ellos se ocupa el muro lateral
      const hit = []; for (const [a, b] of [[A, B], [B, C], [C, A]]) if ((a[1] - y) * (b[1] - y) < 0) { const k = (y - a[1]) / (b[1] - a[1]); hit.push([a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k]); }
      if (hit.length !== 2) continue;
      const mx = (hit[0][0] + hit[1][0]) / 2, mz = (hit[0][1] + hit[1][1]) / 2, d = Math.hypot(line.P[i][0] - mx, line.P[i][1] - mz);
      if (d > reach || cuts.some((c) => Math.abs(c.y - line.Y[i]) < 2 / S && c.d <= d)) continue;
      const same = cuts.findIndex((c) => Math.abs(c.y - line.Y[i]) < 2 / S); const cut = { y: line.Y[i], d, hit };
      if (same >= 0) cuts[same] = cut; else cuts.push(cut);
    }
    for (const c of cuts) if (Math.hypot(c.hit[1][0] - c.hit[0][0], c.hit[1][1] - c.hit[0][1]) * S > 0.05) out.push({ a: c.hit[0], b: c.hit[1], y: c.y });
  }
  return out;
}
// punto de un segmento más cercano a (x, z)
const closest = (s, x, z) => { const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], k = Math.max(0, Math.min(1, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / (ex * ex + ez * ez || 1))); return [s.a[0] + ex * k, s.a[1] + ez * k]; };
// aparta la línea central de los obstáculos, sin sacarla de la calzada: por ella conduce el piloto automático
function steerClear(cfg, line, solids, hit) {
  const S = cfg.scale, clear = 2.1 / S, start = line.P.map((p) => p.slice());
  for (let it = 0; it < 14; it++) {
    const shift = line.P.map(([x, z], i) => {
      const P = line.P, a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      let push = 0;
      for (const s of solids) {
        if (Math.abs(s.y - line.Y[i]) > 1.5 / S) continue;
        const [cx, cz] = closest(s, x, z), d = Math.hypot(x - cx, z - cz); if (d >= clear) continue;
        const side = Math.sign((x - cx) * nx + (z - cz) * nz) || 1, amount = (clear - d) * side;
        if (Math.abs(amount) > Math.abs(push)) push = amount;
      }
      return push;
    });
    if (!shift.some((v) => v)) break;
    const soft = average(average(shift, 2), 2);
    line.P = line.P.map(([x, z], i) => {
      const P = line.P, a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
      const nx = x - tz / l * soft[i] * 0.9, nz = z + tx / l * soft[i] * 0.9;
      if (Math.hypot(nx - start[i][0], nz - start[i][1]) * S > 5 || !hit(nx, nz).some((h) => Math.abs(h - line.Y[i]) < 0.8 / S)) return [x, z];
      return [nx, nz];
    });
  }
  return line;
}

// distancia (m) desde el eje hasta donde se acaba la calzada (precipicio, pared o escalón), a cada lado
function roadEdges(cfg, line, hit) {
  const S = cfg.scale, max = cfg.half + cfg.wallExtra;
  return [-1, 1].map((side) => line.P.map(([x, z], i) => {
    const P = line.P, a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l * side, nz = tx / l * side;
    let y = line.Y[i];
    for (let d = 0.3; d <= cfg.half + 0.3; d += 0.3) {
      const near = hit(x + nx * d / S, z + nz * d / S).filter((h) => Math.abs(h - y) < cfg.stepTol / S);
      if (!near.length) return Math.max(2.4, d - 0.3 + cfg.wallExtra);
      y = near.reduce((p, c) => (Math.abs(c - y) < Math.abs(p - y) ? c : p));
    }
    return max;
  }));
}

// distancia (m) desde el eje hasta la primera barrera, a cada lado
function barrierEdges(cfg, line, tris) {
  const S = cfg.scale, cell = 0.6 / S, occ = new Set();
  for (const t of tris) {
    if (!cfg.barriers.includes(t.mat.getName())) continue;
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) { const c = 6 - a - b, x = (a * t.v[0].p[0] + b * t.v[1].p[0] + c * t.v[2].p[0]) / 6, z = (a * t.v[0].p[2] + b * t.v[1].p[2] + c * t.v[2].p[2]) / 6; occ.add(Math.round(x / cell) + ',' + Math.round(z / cell)); }
  }
  const min = cfg.half + 0.9, max = cfg.half + 9;
  return [-1, 1].map((side) => line.P.map(([x, z], i) => {
    const P = line.P, a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l * side, nz = tx / l * side;
    for (let d = cfg.half; d < max; d += 0.4) if (occ.has(Math.round((x + nx * d / S) / cell) + ',' + Math.round((z + nz * d / S) / cell))) return Math.max(min, d - 0.5);
    return max;
  }));
}

async function writeModel(id, cfg, tris, place) {
  const out = new Document(), buf = out.createBuffer(), scene = out.createScene('track');
  const perMat = new Map(); for (const t of tris) perMat.set(t.mat, (perMat.get(t.mat) || 0) + 1);
  // los materiales pesados repartidos por la pista se parten en parcelas de 55 m: la cámara descarta las que no ve
  const groups = new Map(); for (const t of tris) { const c = [0, 1, 2].map((q) => place(t.v[q].p)); const cell = (cfg.tile || []).includes(t.mat.getName()) ? Math.floor((c[0][0] + c[1][0] + c[2][0]) / 3 / 55) + ',' + Math.floor((c[0][2] + c[1][2] + c[2][2]) / 3 / 55) : ''; const key = t.mat.getName() + '|' + cell; (groups.get(key) || groups.set(key, []).get(key)).push(t); }
  const matCache = new Map();
  const texCache = new Map();
  const texture = async (src) => {
    if (!src) return null; if (texCache.has(src)) return texCache.get(src);
    const meta = await sharp(Buffer.from(src.getImage())).metadata(), w = Math.min(512, meta.width), h = Math.max(1, Math.round(w * meta.height / meta.width));
    const alpha = meta.hasAlpha && !(await sharp(Buffer.from(src.getImage())).stats()).isOpaque;
    const base = sharp(Buffer.from(src.getImage())).resize(w, h);
    const data = alpha ? await base.png({ compressionLevel: 9, palette: true }).toBuffer() : await base.flatten({ background: '#000' }).jpeg({ quality: 82 }).toBuffer();
    const tex = out.createTexture().setMimeType(alpha ? 'image/png' : 'image/jpeg').setImage(data); texCache.set(src, tex); return tex;
  };
  let k = 0;
  for (const list of groups.values()) {
    const m = list[0].mat;
    const name = m.getName(), P = new Float32Array(list.length * 9), N = new Float32Array(list.length * 9), U = new Float32Array(list.length * 6), C = list[0].v[0].c ? new Float32Array(list.length * 9) : null;
    let i = 0; for (const t of list) for (const v of t.v) { P.set(place(v.p), i * 3); if (!cfg.ratio) N.set(v.n, i * 3); U.set(v.uv, i * 2); if (C) C.set(v.c || [1, 1, 1], i * 3); i++; }
    let nm = matCache.get(m); if (!nm) { nm = out.createMaterial(name).setBaseColorFactor(m.getBaseColorFactor()).setMetallicFactor(0).setRoughnessFactor(0.95).setDoubleSided(m.getDoubleSided()).setAlphaMode(m.getAlphaMode()).setAlphaCutoff(m.getAlphaCutoff()).setEmissiveFactor(m.getEmissiveFactor());
    matCache.set(m, nm); nm.setBaseColorTexture(await texture(m.getBaseColorTexture())); nm.setEmissiveTexture(await texture(m.getEmissiveTexture())); }
    const prim = out.createPrimitive().setMaterial(nm).setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(P).setBuffer(buf)).setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(U).setBuffer(buf));
    if (!cfg.ratio) prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(N).setBuffer(buf));
    if (C) prim.setAttribute('COLOR_0', out.createAccessor().setType('VEC3').setArray(C).setBuffer(buf));
    const mesh = out.createMesh(name + '_' + k++).addPrimitive(prim); scene.addChild(out.createNode(name).setMesh(mesh));
  }
  await out.transform(weld());
  if (cfg.ratio) { // aligerar: cada material con su proporción
    await MeshoptSimplifier.ready;
    const { simplifyPrimitive } = await import('@gltf-transform/functions');
    for (const mesh of out.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) { const r = cfg.ratio[prim.getMaterial().getName()] ?? cfg.ratio['*']; if (prim.getIndices().getCount() > 900) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: r, error: cfg.error }); }
    await out.transform(prune());
    // sin normales de origen (así se pueden fusionar los vértices): se calculan suaves después de aligerar
    for (const mesh of out.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray(), nor = new Float32Array(pos.length);
      for (let i = 0; i < idx.length; i += 3) { const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3]; const u = [0, 1, 2].map((q) => pos[b + q] - pos[a + q]), w = [0, 1, 2].map((q) => pos[c + q] - pos[a + q]); const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; for (const v of [a, b, c]) for (let q = 0; q < 3; q++) nor[v + q] += f[q]; }
      for (let i = 0; i < nor.length; i += 3) { const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1; nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l; }
      prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf));
    }
  }
  const count = out.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0), 0);
  const gz = zlib.gzipSync(await io.writeBinary(out), { level: 9 });
  fs.writeFileSync(`src/assets/track_${id}.glb.gz`, gz);
  console.log(id, 'triángulos', Math.round(count), 'materiales', perMat.size, 'mallas', groups.size, 'KB', Math.round(gz.length / 1024));
}

const data = {};
for (const [id, cfg] of Object.entries(TRACKS)) {
  const tris = readTris(await io.read(path.join(SRC, cfg.file)), cfg);
  const road = tris.filter((t) => (cfg.road.node ? t.chain.some((c) => cfg.road.node.test(c)) : cfg.road.materials.includes(t.mat.getName())));
  const hit = makeGrid(road, cfg.half * 2 / cfg.scale);
  const line = centreLine(cfg, hit);
  if (cfg.flat) { const mid = [...line.Y].sort((a, b) => a - b)[line.Y.length >> 1]; line.Y = line.Y.map(() => mid); }
  const S = cfg.scale;
  const solids = cfg.solids ? solidSegments(cfg, line, tris, road) : null;
  if (solids) {
    steerClear(cfg, line, solids, hit);
    // por la línea central siempre se puede pasar: lo que aún la pise (arcos, remates) no se hace sólido
    const crosses = (q) => line.P.some((p, i) => { if (Math.abs(q.y - line.Y[i]) > 1.5 / S) return false; const n = line.P[(i + 1) % line.P.length]; for (let k = 0; k <= 4; k++) { const x = p[0] + (n[0] - p[0]) * k / 4, z = p[1] + (n[1] - p[1]) * k / 4, [cx, cz] = closest(q, x, z); if (Math.hypot(x - cx, z - cz) * S < 1.05) return true; } return false; });
    const before = solids.length; for (let i = solids.length - 1; i >= 0; i--) if (crosses(solids[i])) solids.splice(i, 1);
    console.log(id, 'segmentos quitados por pisar el paso libre:', before - solids.length);
  }
  const cx = line.P.reduce((n, p) => n + p[0], 0) / line.P.length, cz = line.P.reduce((n, p) => n + p[1], 0) / line.P.length, y0 = Math.min(...line.Y);
  const place = (p) => [(p[0] - cx) * S, (p[1] - y0) * S + 2, (p[2] - cz) * S]; // el punto más bajo de la calzada queda a 2 m
  const nodes = line.P.map(([x, z], i) => [+((x - cx) * S).toFixed(2), +((z - cz) * S).toFixed(2), +((line.Y[i] - y0) * S + 2).toFixed(2)]);
  // cuántas muestras caen fuera de la calzada (control de calidad del trazado)
  const off = line.P.filter(([x, z]) => !hit(x, z).length).length;
  let len = 0; for (let i = 0; i < nodes.length; i++) { const a = nodes[i], b = nodes[(i + 1) % nodes.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const step = 3, every = nodes.filter((_, i) => i % step === 0);
  data[id] = { half: cfg.half, wall: +(cfg.half + (cfg.wallExtra ?? 2.5)).toFixed(2), nodes: every.map((n) => [n[0], n[1]]), profile: every, start: [nodes[0][0], nodes[0][1]] };
  if (solids) {
    // [x1, z1, x2, z2, altura de la calzada] en metros del juego
    data[id].solids = solids.map((s) => [...[s.a, s.b].flatMap(([x, z]) => [+((x - cx) * S).toFixed(2), +((z - cz) * S).toFixed(2)]), +((s.y - y0) * S + 2).toFixed(1)]);
    const tight = line.P.filter(([x, z], i) => solids.some((s) => Math.abs(s.y - line.Y[i]) < 1.5 / S && (() => { const [px, pz] = closest(s, x, z); return Math.hypot(x - px, z - pz) * S < 1.1; })())).length;
    console.log(id, 'obstáculos', data[id].solids.length, 'segmentos; muestras a menos de 1,1 m de uno:', tight);
  }
  if (cfg.barriers || cfg.edgeFromRoad) data[id].edges = (cfg.barriers ? barrierEdges(cfg, line, tris) : roadEdges(cfg, line, hit)).map((e) => average(e, 2).filter((_, i) => i % step === 0).map((v) => +v.toFixed(2)));
  console.log(id, 'vuelta', Math.round(len), 'm, desnivel', (Math.max(...nodes.map((n) => n[2])) - 2).toFixed(1), 'm, puntos fuera de la calzada', off, 'de', line.P.length);
  await writeModel(id, cfg, tris, place);
}
fs.writeFileSync('src/tracks-data.js', '// Generado por tools/prep-tracks.mjs: línea central de los circuitos importados (metros)\nexport const TRACK_DATA = ' + JSON.stringify(data) + ';\n');
