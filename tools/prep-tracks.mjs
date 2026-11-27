// Convierte un circuito descargado en circuito jugable:
//  1) src/assets/track_<id>.glb.gz: el modelo en metros del juego, unido por materiales y con texturas pequeñas;
//  2) src/tracks-data.js: la línea central (x, z, altura) sacada de la propia calzada y, si hay barreras, dónde están.
// El trazado se da con unos puntos aproximados leídos en un plano cenital; la herramienta los centra en la calzada.
// Uso: node tools/prep-tracks.mjs <carpeta con los .glb descargados>
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import crypto from 'node:crypto';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { reshapeProfile, steerAway, rebuild, deckMaterials, aprons, ground, steps } from './track-rebuild.mjs';

const SRC = process.argv[2];
if (!SRC) { console.log('Uso: node tools/prep-tracks.mjs <carpeta>'); process.exit(1); }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const TRACKS = {
  misty: {
    file: 'boom_karts_misty_cliffs.glb',
    scale: 26, half: 5.3,
    dropNodes: /^(DynamicProps|LightmapCube|SceneReferences|Camera|StartLine|Ocean)/,
    road: { node: /^CliffsRoad(.00[123])?$/ }, // la franja de hormigón (CliffsRoad) también es calzada
    keep: [[4.95, 6.0, 6.5, 9.3]], // ahí el camino va partido por la roca: se respetan los puntos dados [x0, x1, z0, z1]
    startY: -0.11,
    // plano de 900 px: x = 2.5 + px/150, z = 3.8 + py/150
    map: (px, py) => [2.5 + px / 150, 3.8 + py / 150],
    path: [[300, 994], [260, 999], [215, 985], [170, 955], [140, 910], [122, 860], [118, 810], [130, 765], [165, 735], [220, 722], [275, 712], [305, 690], [316, 650], [311, 600], [308, 550], [320, 515], [350, 503], [378, 480], [390, 440], [396, 400], [398, 365], [425, 335], [470, 310], [520, 305], [565, 318], [600, 345], [625, 375], [650, 405], [680, 422], [712, 415], [745, 395], [775, 360], [790, 325], [790, 295], [770, 268], [730, 255], [690, 248], [660, 222], [625, 180], [590, 140], [560, 118], [525, 108], [490, 118], [465, 145], [458, 185], [470, 225], [500, 250], [525, 265], [525, 292], [515, 330], [487, 380], [467, 422], [468, 478], [460, 525], [443, 570], [428, 600], [413, 630], [406, 660], [402, 690], [407, 720], [423, 750], [450, 780], [495, 806], [538, 826], [565, 865], [570, 915], [550, 955], [520, 992], [480, 1003], [440, 1000], [400, 996], [350, 993]],
    wallExtra: 0.25, // los bordes son precipicios: el muro invisible va en el borde de la calzada
    stepTol: 0.55, // un escalón mayor que esto (m) ya no es la misma calzada
    solids: true, // las rocas, paredes y demás decorado que invade la pista se pueden chocar
    // calzada reconstruida: sin gran salto ni escalones (distancias en metros desde el primer punto del trazado)
    rebuild: {
      // alturas en metros sobre la recta de abajo. El trampolín original sube hasta 15,3 m en el metro 495: se sube
      // con él hasta el mismo borde y la rampa baja desde allí, ya en el aire, sin atravesar la montaña
      base: 82, lip: [490, 508],
      profile: [
        { from: 456, to: 495, a: 12.35, b: 15.3 },
        { from: 495, to: 58, a: 15.3, b: 0 },
        { from: 58, to: 82, a: 0, b: 0 }, // recta de meta llana
      ],
      startAt: 70,
      fixed: [[318, 352]], // bajada del faro: se respeta el camino original
      sides: [[352, 446, -1]], // la pared de la bajada cruza el camino en diagonal: se esquiva siempre por el mismo lado
      keep: /lighthouse/i, boulder: /^Rock_|TriPlanar/i, clear: 3.3, pass: 1.7, // la calzada se aparta hasta dejar las paredes a 3,3 m del eje; solo se corta lo que quede a menos de 1,7
      floor: /CliffsGround|concrete|FinishLine/i, soft: /grass|plant|shrub|decal/i, remove: /RoadBlock|Trafficbarrier|FinishLine/i,
      deck: /CliffsGround\.00|concrete/, skirt: 'DarkGreyCliff',
    },
  },
  lider: {
    file: 'karting_club_lider__outdoor_race_track_ready.glb',
    scale: 1.2, half: 4, gameHalf: 4, step: 1, // a escala real se quedaba pequeño para el kart: un 20 % más grande; // curvas muy cerradas: un punto cada 2,5 m; // pista de unos 6,5 m
    dropNodes: /^(sky|LEP500|kart_model)/, // cielo, tendido eléctrico lejano y un kart de exposición
    road: { materials: ['racetrack', 'conc_plates_clever', 'kerb_with_rubber'] },
    // asfalto, placas de hormigón (se corre por ellas), pianos, líneas pintadas y marcas de goma: todo lo demás frena
    paved: ['racetrack', 'kerb_with_rubber', 'conc_plates_clever', 'conc_plates_darkgrey', 'conc_plates_grey', 'conc_plates_lightgrey', 'conc', 'conc2', 'conc_t3', 'conc_t4', 'conc_t9', 'conc_t89_1', 'conc_t89_2', 'road_marking_lined', 'road_marking_plane', 'Material_12932', 'GROOVE_3', 'skids', 'dust', 'decal_concrete_patch_1', 'decal_concrete_patch_2', 'Cracks1', 'Material_5034', 'Material_12663'],
    kerbs: ['kerb_with_rubber'], // pianos altos: sacuden el kart
    pavedExcept: /green|grass|Trees/i, // se corre por todo lo que no sea hierba (mirando la superficie de arriba)
    solids: true, solidH: 0.45, // neumáticos, muros, vallas y edificios se chocan (cortados a la altura de un neumático)
    edgeMax: 7, // a más de 7 m del eje, muro: no se puede atajar por la hierba
    barriers: ['black_tyre', 'blue_tyre', 'red_tyre', 'white_tyre', 'Material_4867', 'Material_4879', 'Material_3906', 'Material_3925', 'grey_armc', 'blue_armco', 'white_metal_barrier', 'red_metal_barrier', 'black_armco', 'black_armco_0', 'armco_orange', 'Material_5073', 'fence'],
    tile: ['racetrack', 'green', 'grass_terrain', 'black_tyre', 'blue_tyre', 'red_tyre', 'conc_plates_clever', 'kerb_with_rubber', 'Trees_Sheet'],
    texBig: ['racetrack', 'kerb_with_rubber', 'conc_plates_clever', 'green', 'grass_terrain', 'road_marking_lined', 'Trees_Sheet'], // se ven de cerca: más resolución
    // camiones, remolques y neumáticos traen muchísimo detalle que no se ve desde el kart
    ratio: { trailer_base: 0.04, truck_blue: 0.05, Body: 0.08, trailer_big: 0.2, Tires: 0.15, black_tyre: 0.22, blue_tyre: 0.22, red_tyre: 0.22, white_tyre: 0.3, conc_plates_clever: 0.25, green: 0.12, material: 0.2, Pillar: 0.3, Ladder_Metallic: 0.25, Vertical_Tank_Metallic: 0.3, racetrack: 1, kerb_with_rubber: 1, road_marking_lined: 1, road_marking_plane: 1, Trees_Sheet: 1, '*': 0.5 },
    sloppy: { trailer_base: 0.04, truck_blue: 0.06, Body: 0.12, trailer_big: 0.25, Tires: 0.2 },
    error: 0.02, errorFor: { racetrack: 0.001, kerb_with_rubber: 0.001, conc_plates_clever: 0.012, road_marking_lined: 0.001, black_tyre: 0.01, blue_tyre: 0.01, red_tyre: 0.01 }, // decorado lejano: más simple
    // plano de 900 px (9 px por metro): x = -40 + px/9, z = -52 + py/9. Salida junto al edificio azul, hacia el norte
    map: (px, py) => [-40 + px / 9, -52 + py / 9],
    path: [[792, 463], [795, 380], [795, 300], [790, 230], [775, 160], [740, 100], [690, 72], [620, 62], [560, 62], [500, 70], [455, 90], [420, 125], [395, 175], [370, 225], [345, 270], [320, 310], [295, 345], [260, 358], [232, 330], [228, 290], [240, 250], [255, 200], [255, 150], [245, 100], [215, 68], [170, 62], [130, 80], [110, 120], [105, 180], [102, 250], [100, 330], [98, 420], [105, 490], [130, 540], [175, 565], [230, 565], [285, 540], [320, 490], [350, 440], [380, 390], [410, 330], [440, 280], [480, 235], [530, 205], [590, 200], [640, 215], [680, 250], [695, 300], [698, 360], [695, 430], [680, 490], [650, 540], [600, 585], [540, 610], [460, 628], [380, 645], [300, 662], [220, 680], [160, 700], [115, 740], [100, 800], [115, 860], [160, 895], [220, 905], [280, 885], [340, 845], [400, 805], [460, 770], [520, 745], [590, 735], [660, 738], [720, 728], [770, 690], [795, 630], [795, 550]],
  },
  mario3: {
    file: 'mario_kart_8_deluxe_-_snes_mario_circuit_3.glb',
    scale: 0.0342, half: 5.5, flat: true,
    dedupe: true, // el archivo trae todo el modelo dos veces, una copia encima de la otra
    road: { materials: ['material_18'] },
    paved: ['material_18', 'material_19'], // asfalto y pianos del modelo: todo lo demás frena
    barriers: ['material_0', 'material_8'],
    tile: ['material_0', 'material_1', 'material_8'],
    // las colinas, el llano del fondo y sus árboles (4, 12, 13, 14, 15, 20) van sin aligerar: simplificados se rompían
    ratio: { material_0: 0.16, material_8: 0.16, material_4: 1, material_12: 1, material_13: 1, material_14: 1, material_15: 1, material_20: 1, '*': 0.45 },
    error: 0.004,
    // plano de 1000 px: x = -2600 + px*5.2, z = -2300 + py*5.198
    map: (px, py) => [-2600 + px * 5.2, -2300 + py * 5.198],
    path: [[129, 330], [129, 250], [129, 175], [135, 135], [155, 95], [190, 72], [240, 63], [290, 72], [330, 100], [355, 140], [385, 190], [410, 225], [440, 238], [500, 240], [560, 238], [590, 220], [605, 190], [620, 145], [640, 105], [670, 85], [715, 72], [760, 72], [805, 85], [845, 115], [865, 155], [872, 205], [868, 255], [845, 290], [805, 312], [740, 328], [660, 347], [580, 364], [500, 382], [430, 400], [395, 412], [378, 434], [382, 462], [405, 483], [445, 490], [520, 487], [600, 486], [700, 486], [775, 487], [825, 500], [860, 530], [870, 580], [862, 640], [830, 678], [785, 698], [730, 706], [660, 706], [620, 700], [598, 685], [588, 655], [578, 628], [555, 617], [500, 617], [465, 619], [440, 635], [400, 672], [360, 710], [310, 732], [250, 737], [200, 726], [172, 705], [155, 670], [138, 625], [129, 590], [129, 500], [129, 420]],
  },
};

// ---------- lectura: triángulos en coordenadas del archivo ----------
function readTris(doc, cfg) {
  const out = [], seen = new Set();
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
      for (let i = 0; i < idx.length; i += 3) {
        const v = [V[idx[i]], V[idx[i + 1]], V[idx[i + 2]]];
        if (cfg.dedupe) { const key = prim.getMaterial().getName() + v.map((q) => q.p.map(Math.round).join(',')).sort().join('|'); if (seen.has(key)) continue; seen.add(key); }
        out.push({ v, mat: prim.getMaterial(), chain });
      }
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
  const steep = slope.map((_, i) => { for (let d = -5; d <= 5; d++) if (slope[(i + d + L) % L] > 0.4) return true; return false; });
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
      const y = line.Y[i] + (cfg.solidH ?? 1.1) / S; if (y <= lo || y >= hi) continue; // los escalones bajos no cuentan: de ellos se ocupa el muro lateral
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
// distancia (m) desde el eje hasta la primera barrera, a cada lado
function barrierEdges(cfg, line, tris) {
  const S = cfg.scale, cell = 0.6 / S, occ = new Set();
  for (const t of tris) {
    if (!cfg.barriers.includes(t.mat.getName())) continue;
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) { const c = 6 - a - b, x = (a * t.v[0].p[0] + b * t.v[1].p[0] + c * t.v[2].p[0]) / 6, z = (a * t.v[0].p[2] + b * t.v[1].p[2] + c * t.v[2].p[2]) / 6; occ.add(Math.round(x / cell) + ',' + Math.round(z / cell)); }
  }
  const min = cfg.half + 0.9, max = cfg.edgeMax ?? cfg.half + 9;
  return [-1, 1].map((side) => line.P.map(([x, z], i) => {
    const P = line.P, a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1, nx = -tz / l * side, nz = tx / l * side;
    for (let d = cfg.half; d < max; d += 0.4) if (occ.has(Math.round((x + nx * d / S) / cell) + ',' + Math.round((z + nz * d / S) / cell))) return Math.max(min, d - 0.5);
    return max;
  }));
}

// mapa del suelo en celdas de 30 cm: un bit a 1 donde hay asfalto o piano
function pavedGrid(cfg, tris, place, nodes, list = cfg.paved) {
  const cell = 0.3, xs = nodes.map((n) => n[0]), zs = nodes.map((n) => n[1]), x0 = Math.floor(Math.min(...xs) - 16), z0 = Math.floor(Math.min(...zs) - 16);
  const w = Math.ceil((Math.max(...xs) + 16 - x0) / cell), h = Math.ceil((Math.max(...zs) + 16 - z0) / cell), bits = new Uint8Array(Math.ceil(w * h / 8));
  for (const t of tris) {
    if (!list.includes(t.mat.getName())) continue;
    const [A, B, C] = t.v.map((v) => place(v.p)), den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.max(0, Math.floor((Math.min(A[2], B[2], C[2]) - z0) / cell)); j <= Math.min(h - 1, Math.floor((Math.max(A[2], B[2], C[2]) - z0) / cell)); j++) for (let i = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - x0) / cell)); i <= Math.min(w - 1, Math.floor((Math.max(A[0], B[0], C[0]) - x0) / cell)); i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
      if (a >= -0.02 && b >= -0.02 && a + b <= 1.02) bits[(j * w + i) >> 3] |= 1 << ((j * w + i) & 7);
    }
  }
  return { x: x0, z: z0, w, h, cell, data: Buffer.from(bits).toString('base64') };
}

// mapa del suelo mirando desde arriba: en cada celda manda la superficie más alta (cerca del nivel de la pista)
function topGrid(cfg, tris, place, nodes, except) {
  const cell = 0.3, xs = nodes.map((n) => n[0]), zs = nodes.map((n) => n[1]), ys = nodes.map((n) => n[2]), x0 = Math.floor(Math.min(...xs) - 16), z0 = Math.floor(Math.min(...zs) - 16), ylo = Math.min(...ys) - 1.5, yhi = Math.max(...ys) + 1;
  const w = Math.ceil((Math.max(...xs) + 16 - x0) / cell), h = Math.ceil((Math.max(...zs) + 16 - z0) / cell), top = new Float32Array(w * h).fill(-1e9), ok = new Uint8Array(w * h);
  for (const t of tris) {
    const [A, B, C] = t.v.map((v) => place(v.p)), u = B.map((v, k) => v - A[k]), q = C.map((v, k) => v - A[k]), ny = u[2] * q[0] - u[0] * q[2], l = Math.hypot(u[1] * q[2] - u[2] * q[1], ny, u[0] * q[1] - u[1] * q[0]);
    if (!l || Math.abs(ny) / l < 0.7 || Math.max(A[1], B[1], C[1]) > yhi || Math.min(A[1], B[1], C[1]) < ylo) continue;
    const good = except.test(t.mat.getName()) ? 0 : 1, den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.max(0, Math.floor((Math.min(A[2], B[2], C[2]) - z0) / cell)); j <= Math.min(h - 1, Math.floor((Math.max(A[2], B[2], C[2]) - z0) / cell)); j++) for (let i = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - x0) / cell)); i <= Math.min(w - 1, Math.floor((Math.max(A[0], B[0], C[0]) - x0) / cell)); i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
      if (a < -0.02 || b < -0.02 || a + b > 1.02) continue;
      const y = a * A[1] + b * B[1] + (1 - a - b) * C[1], n = j * w + i; if (y > top[n] - 0.005) { top[n] = y; ok[n] = good; }
    }
  }
  const bits = new Uint8Array(Math.ceil(w * h / 8)); for (let n = 0; n < w * h; n++) if (ok[n]) bits[n >> 3] |= 1 << (n & 7);
  return { x: x0, z: z0, w, h, cell, data: Buffer.from(bits).toString('base64') };
}

async function writeModel(id, cfg, tris, place, rev) {
  const out = new Document(), buf = out.createBuffer(), scene = out.createScene('track').setExtras({ rev });
  const perMat = new Map(); for (const t of tris) perMat.set(t.mat, (perMat.get(t.mat) || 0) + 1);
  // los materiales pesados repartidos por la pista se parten en parcelas de 55 m: la cámara descarta las que no ve
  const groups = new Map(); for (const t of tris) { const c = [0, 1, 2].map((q) => place(t.v[q].p)); const cell = (cfg.tile || []).includes(t.mat.getName()) ? Math.floor((c[0][0] + c[1][0] + c[2][0]) / 3 / 55) + ',' + Math.floor((c[0][2] + c[1][2] + c[2][2]) / 3 / 55) : ''; const key = t.mat.getName() + '|' + cell; (groups.get(key) || groups.set(key, []).get(key)).push(t); }
  const matCache = new Map();
  const texCache = new Map();
  const texture = async (src) => {
    if (!src) return null; if (texCache.has(src)) return texCache.get(src);
    const meta = await sharp(Buffer.from(src.getImage())).metadata(), w = Math.min(src.big ? 1024 : 512, meta.width), h = Math.max(1, Math.round(w * meta.height / meta.width));
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
    matCache.set(m, nm); if ((cfg.texBig || []).includes(name)) { for (const t of [m.getBaseColorTexture(), m.getEmissiveTexture()]) if (t) t.big = true; }
    nm.setBaseColorTexture(await texture(m.getBaseColorTexture())); nm.setEmissiveTexture(await texture(m.getEmissiveTexture())); }
    const prim = out.createPrimitive().setMaterial(nm).setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(P).setBuffer(buf)).setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(U).setBuffer(buf));
    if (!cfg.ratio) prim.setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(N).setBuffer(buf));
    if (C) prim.setAttribute('COLOR_0', out.createAccessor().setType('VEC3').setArray(C).setBuffer(buf));
    const mesh = out.createMesh(name + '_' + k++).addPrimitive(prim); scene.addChild(out.createNode(name).setMesh(mesh));
  }
  await out.transform(weld());
  if (cfg.ratio) { // aligerar: cada material con su proporción
    await MeshoptSimplifier.ready;
    const { simplifyPrimitive } = await import('@gltf-transform/functions');
    for (const mesh of out.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) { const r = cfg.ratio[prim.getMaterial().getName()] ?? cfg.ratio['*']; if (r < 1 && prim.getIndices().getCount() > 900) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: r, error: (cfg.errorFor || {})[prim.getMaterial().getName()] ?? cfg.error });
      // piezas sueltas muy detalladas (camiones, neumáticos): se simplifican sin respetar bordes, a lo bruto
      const sl = (cfg.sloppy || {})[prim.getMaterial().getName()];
      if (sl && prim.getIndices().getCount() > 900) { const idx = prim.getIndices(), pos = prim.getAttribute('POSITION'), src = new Uint32Array(idx.getArray()), target = Math.floor(src.length * sl / 3) * 3; const [res] = MeshoptSimplifier.simplifySloppy(src, pos.getArray(), 3, null, target, 1); idx.setArray(new Uint32Array(res)); }
    }
    const { compactPrimitive } = await import('@gltf-transform/functions');
    for (const mesh of out.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) compactPrimitive(prim); // fuera los vértices que ya no usa nadie
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
  let tris = readTris(await io.read(path.join(SRC, cfg.file)), cfg);
  const road = tris.filter((t) => (cfg.road.node ? t.chain.some((c) => cfg.road.node.test(c)) : cfg.road.materials.includes(t.mat.getName())));
  const hit = makeGrid(road, cfg.half * 2 / cfg.scale);
  const line = centreLine(cfg, hit);
  if (cfg.flat) { const mid = [...line.Y].sort((a, b) => a - b)[line.Y.length >> 1]; line.Y = line.Y.map(() => mid); }
  const S = cfg.scale;
  let deck = null, ramp = null, apron = null, plinth = null, under = null, walled = null, wallPoints = null;
  if (cfg.rebuild) {
    reshapeProfile(cfg, line);
    steerAway(cfg, line, solidSegments({ ...cfg, half: cfg.half + 4 }, line, tris, tris.filter((t) => cfg.rebuild.floor.test(t.mat.getName()))));
    deck = deckMaterials(cfg, line, tris);
    { // la rampa es toda de tierra
      const op = cfg.rebuild.profile[1], a = line.index(op.from + 4), b = line.index(op.to), dirt = deck.find((m) => /Ground/.test(m)), n = deck.length;
      for (let k = 0; k <= (b - a + n) % n; k++) deck[(a + k) % n] = dirt;
    }
    const walls = solidSegments({ ...cfg, half: cfg.half + 9 }, line, tris, tris.filter((t) => cfg.rebuild.floor.test(t.mat.getName())));
    const before = tris;
    tris = rebuild(cfg, line, tris);
    ({ apron, plinth } = aprons(cfg, line, tris, walls, before));
    under = ground(cfg, line, tris, cfg.half + (cfg.wallExtra ?? 0.25) + 0.4);
    walled = steps(cfg, line, tris, cfg.half + (cfg.wallExtra ?? 0.25));
    wallPoints = walls;
    // la meta se lleva al tramo llano: se gira la lista para que empiece allí
    const k = line.index(cfg.rebuild.startAt), turn = (a) => a.slice(k).concat(a.slice(0, k));
    const op = cfg.rebuild.profile[1], from = line.index(op.from), to = line.index(op.to), n = line.P.length;
    ramp = [(from - k + n) % n, (to - k + n) % n];
    line.P = turn(line.P); line.Y = turn(line.Y); deck = turn(deck); apron = apron.map(turn); plinth = plinth.map(turn); under = under.map(turn); walled = walled.map(turn);
  }
  const solids = cfg.solids ? solidSegments(cfg, line, tris, cfg.rebuild ? tris.filter((t) => cfg.rebuild.floor.test(t.mat.getName())) : road) : null;
  if (solids) {
    // por la línea central siempre se puede pasar: lo que aún la pise (arcos, remates) no se hace sólido
    const crosses = (q) => line.P.some((p, i) => { if (Math.abs(q.y - line.Y[i]) > 1.5 / S) return false; const n = line.P[(i + 1) % line.P.length]; for (let k = 0; k <= 4; k++) { const x = p[0] + (n[0] - p[0]) * k / 4, z = p[1] + (n[1] - p[1]) * k / 4, [cx, cz] = closest(q, x, z); if (Math.hypot(x - cx, z - cz) * S < 2.2) return true; } return false; });
    const before = solids.length; for (let i = solids.length - 1; i >= 0; i--) if (crosses(solids[i])) solids.splice(i, 1);
    console.log(id, 'segmentos quitados por pisar el paso libre:', before - solids.length);
    if (cfg.rebuild) { // pegados al borde ya los cubre el muro lateral; sueltos ahí forman rincones donde el kart se encaja
      const far = (cfg.half + (cfg.wallExtra ?? 0.25) - 1.0) / S, off = (x, z, y) => Math.min(...line.P.map(([px, pz], i) => (Math.abs(line.Y[i] - y) < 1.5 / S ? Math.hypot(px - x, pz - z) : 1e9)));
      for (let i = solids.length - 1; i >= 0; i--) { const q = solids[i]; if (off(q.a[0], q.a[1], q.y) > far && off(q.b[0], q.b[1], q.y) > far) solids.splice(i, 1); }
    }
  }
  const cx = line.P.reduce((n, p) => n + p[0], 0) / line.P.length, cz = line.P.reduce((n, p) => n + p[1], 0) / line.P.length, y0 = Math.min(...line.Y);
  const place = (p) => [(p[0] - cx) * S, (p[1] - y0) * S + 2, (p[2] - cz) * S]; // el punto más bajo de la calzada queda a 2 m
  if (process.env.FRAME) console.log(id, 'FRAME', JSON.stringify({ cx, cz, y0, S }));
  const nodes = line.P.map(([x, z], i) => [+((x - cx) * S).toFixed(2), +((z - cz) * S).toFixed(2), +((line.Y[i] - y0) * S + 2).toFixed(2)]);
  // cuántas muestras caen fuera de la calzada (control de calidad del trazado)
  const off = line.P.filter(([x, z]) => !hit(x, z).length).length;
  let len = 0; for (let i = 0; i < nodes.length; i++) { const a = nodes[i], b = nodes[(i + 1) % nodes.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const step = cfg.step ?? 3, every = nodes.filter((_, i) => i % step === 0);
  data[id] = { half: cfg.half, wall: +(cfg.half + (cfg.wallExtra ?? 2.5)).toFixed(2), nodes: every.map((n) => [n[0], n[1]]), profile: cfg.rebuild ? nodes : every, start: [nodes[0][0], nodes[0][1]] };
  if (deck) {
    const names = [...new Set(deck)];
    data[id].deck = { materials: names, skirt: cfg.rebuild.skirt, index: every.map((_, i) => names.indexOf(deck[i * step])), ramp: ramp.map((v) => +(v / nodes.length).toFixed(4)), apron: apron.map((w) => every.map((_, i) => +w[i * step].toFixed(1))), ground: under.map((w) => every.map((_, i) => +w[i * step].toFixed(2))), plinth: plinth.map((w) => every.map((_, i) => +w[i * step])) };
    console.log(id, 'suelo bajo el borde, media (m):', data[id].deck.ground.map((w) => (w.filter((v) => v >= 0).reduce((a, b) => a + b, 0) / w.filter((v) => v >= 0).length).toFixed(2)).join(' y '), '| con zócalo:', data[id].deck.plinth.map((w) => w.filter(Boolean).length).join(' y '));
    console.log(id, 'tramos con arcén de relleno:', data[id].deck.apron.map((w) => w.filter(Boolean).length).join(' y '), 'de', every.length);
  }
  if (solids) {
    // [x1, z1, x2, z2, altura de la calzada] en metros del juego
    data[id].solids = solids.map((s) => [...[s.a, s.b].flatMap(([x, z]) => [+((x - cx) * S).toFixed(2), +((z - cz) * S).toFixed(2)]), +((s.y - y0) * S + 2).toFixed(1)]);
    const tight = line.P.filter(([x, z], i) => solids.some((s) => Math.abs(s.y - line.Y[i]) < 1.5 / S && (() => { const [px, pz] = closest(s, x, z); return Math.hypot(x - px, z - pz) * S < 1.1; })())).length;
    console.log(id, 'obstáculos', data[id].solids.length, 'segmentos; muestras a menos de 1,1 m de uno:', tight);
  }
  if (cfg.barriers) data[id].edges = barrierEdges(cfg, line, tris).map((e) => average(e, 2).filter((_, i) => i % step === 0).map((v) => +v.toFixed(2)));
  console.log(id, 'vuelta', Math.round(len), 'm, desnivel', (Math.max(...nodes.map((n) => n[2])) - 2).toFixed(1), 'm, puntos fuera de la calzada', off, 'de', line.P.length);
  if (cfg.rebuild) data[id].edges = walled.map((w) => every.map((_, i) => +w[i * step].toFixed(2)));
  if (cfg.paved) {
    data[id].paved = cfg.pavedExcept ? topGrid(cfg, tris, place, nodes, cfg.pavedExcept) : pavedGrid(cfg, tris, place, nodes);
    if (cfg.kerbs) data[id].kerbs = pavedGrid(cfg, tris, place, nodes, cfg.kerbs);
    if (cfg.gameHalf) data[id].gameHalf = cfg.gameHalf;
    const g = data[id].paved, bits = Buffer.from(g.data, 'base64'), on = (x, z) => { const n = Math.floor((z - g.z) / g.cell) * g.w + Math.floor((x - g.x) / g.cell); return (bits[n >> 3] >> (n & 7)) & 1; };
    console.log(id, 'mapa del suelo', g.w + 'x' + g.h, '| puntos del eje fuera del asfalto:', nodes.filter((n) => !on(n[0], n[1])).length, 'de', nodes.length);
  }
  if (wallPoints) { // un punto [x, z, altura] cada metro y medio de pared cercana a la pista
    const seen = new Set(), out = [];
    for (const q of wallPoints) for (let k = 0; k <= 2; k++) {
      const x = (q.a[0] + (q.b[0] - q.a[0]) * k / 2 - cx) * S, z = (q.a[1] + (q.b[1] - q.a[1]) * k / 2 - cz) * S, y = (q.y - y0) * S + 2, key = Math.round(x / 1.5) + ',' + Math.round(z / 1.5) + ',' + Math.round(y / 2);
      if (!seen.has(key) && nodes.some((n) => Math.abs(n[2] - y) < 2.2 && Math.hypot(n[0] - x, n[1] - z) < 9)) { seen.add(key); out.push([+x.toFixed(1), +z.toFixed(1), +y.toFixed(1)]); }
    }
    data[id].deck.walls = out;
  }
  // sello: el juego no usa un modelo que no sea el de estos datos
  data[id].rev = crypto.createHash('sha1').update(JSON.stringify(data[id])).update(fs.readFileSync(new URL('./track-rebuild.mjs', import.meta.url))).update(fs.readFileSync(new URL(import.meta.url))).digest('hex').slice(0, 10);
  await writeModel(id, cfg, tris, place, data[id].rev);
}
fs.writeFileSync('src/tracks-data.js', '// Generado por tools/prep-tracks.mjs: línea central de los circuitos importados (metros)\nexport const TRACK_DATA = ' + JSON.stringify(data) + ';\n');
