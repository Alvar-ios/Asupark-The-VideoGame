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
    dropNodes: /^(DynamicProps|LightmapCube|SceneReferences|Camera|StartLine|Ocean|startFrame)/, // fuera también el arco de salida con el logo del juego original
    road: { node: /^CliffsRoad(.00[123])?$/ }, // la franja de hormigón (CliffsRoad) también es calzada
    keep: [[4.95, 6.0, 6.5, 9.3]], // ahí el camino va partido por la roca: se respetan los puntos dados [x0, x1, z0, z1]
    startY: -0.11,
    // plano de 900 px: x = 2.5 + px/150, z = 3.8 + py/150
    map: (px, py) => [2.5 + px / 150, 3.8 + py / 150],
    path: [[300, 994], [260, 999], [215, 985], [170, 955], [140, 910], [122, 860], [118, 810], [130, 765], [165, 735], [220, 722], [275, 712], [305, 690], [316, 650], [311, 600], [308, 550], [320, 515], [350, 503], [378, 480], [390, 440], [396, 400], [398, 365], [425, 335], [470, 310], [520, 305], [565, 318], [600, 345], [625, 375], [650, 405], [680, 422], [712, 415], [745, 395], [775, 360], [790, 325], [790, 295], [770, 268], [730, 255], [690, 248], [660, 222], [625, 180], [590, 140], [560, 118], [525, 108], [490, 118], [465, 145], [458, 185], [470, 225], [500, 250], [525, 265], [525, 292], [515, 330], [487, 380], [467, 422], [468, 478], [460, 525], [443, 570], [428, 600], [413, 630], [406, 660], [402, 690], [407, 720], [423, 750], [450, 780], [495, 806], [538, 826], [565, 865], [570, 915], [550, 955], [520, 992], [480, 1003], [440, 1000], [400, 996], [350, 993]],
    wallExtra: 0.4, // los bordes son precipicios: el muro invisible va en el borde de la calzada
    stepTol: 0.55, // un escalón mayor que esto (m) ya no es la misma calzada
    solids: true, // las rocas, paredes y demás decorado que invade la pista se pueden chocar
    // el modelo tal cual: el kart pisa la altura real del suelo (mapa de alturas) y el gran salto es un salto de verdad
    startAt: 70, gaps: true, heights: true, step: 1, walkEdges: true, // muros donde acaba el suelo
    noSolid: /^(directionsign|ArrowsignWood)/, // señales del borde del faro: no se chocan (el muro del borde ya frena)
    dropOk: [[248, 276]], // del hormigón del faro se baja a la tierra: el escalón no es muro
    flatten: [{ from: 276, to: 326, side: -1, inner: 0.6 }], // la rampita de tierra a la izquierda tras el faro, que llevaba contra la pared
  },
  lider: {
    file: 'karting_club_lider__outdoor_race_track_ready.glb',
    scale: 1.65, half: 5.4, gameHalf: 5.4, step: 1, // a escala real el kart parecía enorme: todo el recinto un 65 % más grande; // curvas muy cerradas: un punto cada 2,5 m; // pista de unos 6,5 m
    dropNodes: /^(sky|LEP500|kart_model)/, // cielo, tendido eléctrico lejano y un kart de exposición
    road: { materials: ['racetrack', 'conc_plates_clever', 'kerb_with_rubber'] },
    // asfalto, placas de hormigón (se corre por ellas), pianos, líneas pintadas y marcas de goma: todo lo demás frena
    paved: ['racetrack', 'kerb_with_rubber', 'conc_plates_clever', 'conc_plates_darkgrey', 'conc_plates_grey', 'conc_plates_lightgrey', 'conc', 'conc2', 'conc_t3', 'conc_t4', 'conc_t9', 'conc_t89_1', 'conc_t89_2', 'road_marking_lined', 'road_marking_plane', 'Material_12932', 'GROOVE_3', 'skids', 'dust', 'decal_concrete_patch_1', 'decal_concrete_patch_2', 'Cracks1', 'Material_5034', 'Material_12663'],
    kerbs: ['kerb_with_rubber'], // pianos altos: sacuden el kart
    pavedExcept: /green|grass|Trees/i, // se corre por todo lo que no sea hierba (mirando la superficie de arriba)
    // neumáticos, muros, vallas y edificios se chocan; donde la hierba no tiene barrera se pone una fila de neumáticos
    blockers: ['black_tyre', 'blue_tyre', 'red_tyre', 'white_tyre', 'Material_4867', 'Material_4879', 'Material_3906', 'Material_3925', 'grey_armc', 'blue_armco', 'white_metal_barrier', 'red_metal_barrier', 'black_armco', 'black_armco_0', 'armco_orange', 'Material_5073', 'fence', 'fence_pillar', 'Pillar', 'Concrete', 'trailer_base', 'truck_blue', 'Body', 'trailer_big', 'Vertical_Tank_Metallic', 'Metal_Support_Metallic'],
    tyreGap: 3, edgeMax: 40,
    barriers: ['black_tyre', 'blue_tyre', 'red_tyre', 'white_tyre', 'Material_4867', 'Material_4879', 'Material_3906', 'Material_3925', 'grey_armc', 'blue_armco', 'white_metal_barrier', 'red_metal_barrier', 'black_armco', 'black_armco_0', 'armco_orange', 'Material_5073', 'fence'],
    tile: ['racetrack', 'green', 'grass_terrain', 'black_tyre', 'blue_tyre', 'red_tyre', 'conc_plates_clever', 'kerb_with_rubber', 'Trees_Sheet'],
    texBig: ['racetrack', 'kerb_with_rubber', 'conc_plates_clever', 'green', 'grass_terrain', 'road_marking_lined', 'Trees_Sheet'], // se ven de cerca: más resolución
    // camiones, remolques y neumáticos traen muchísimo detalle que no se ve desde el kart
    ratio: { trailer_base: 0.04, truck_blue: 0.05, Body: 0.08, trailer_big: 0.2, Tires: 0.15, black_tyre: 0.22, blue_tyre: 0.22, red_tyre: 0.22, white_tyre: 0.3, conc_plates_clever: 0.25, green: 0.12, material: 0.2, Pillar: 0.3, Ladder_Metallic: 0.25, Vertical_Tank_Metallic: 0.3, racetrack: 1, kerb_with_rubber: 1, road_marking_lined: 1, road_marking_plane: 1, Trees_Sheet: 1, '*': 0.5 },
    sloppy: { trailer_base: 0.25 }, // más bajo, los camiones se deshacían
    error: 0.02, errorFor: { racetrack: 0.001, kerb_with_rubber: 0.001, conc_plates_clever: 0.012, road_marking_lined: 0.001, black_tyre: 0.01, blue_tyre: 0.01, red_tyre: 0.01 }, // decorado lejano: más simple
    // plano de 900 px (9 px por metro): x = -40 + px/9, z = -52 + py/9. Salida junto al edificio azul, hacia el norte
    map: (px, py) => [-40 + px / 9, -52 + py / 9],
    path: [[792, 463], [795, 380], [795, 300], [790, 230], [775, 160], [740, 100], [690, 72], [620, 62], [560, 62], [500, 70], [455, 90], [420, 125], [395, 175], [370, 225], [345, 270], [320, 310], [295, 345], [260, 358], [232, 330], [228, 290], [240, 250], [255, 200], [255, 150], [245, 100], [215, 68], [170, 62], [130, 80], [110, 120], [105, 180], [102, 250], [100, 330], [98, 420], [105, 490], [130, 540], [175, 565], [230, 565], [285, 540], [320, 490], [350, 440], [380, 390], [410, 330], [440, 280], [480, 235], [530, 205], [590, 200], [640, 215], [680, 250], [695, 300], [698, 360], [695, 430], [680, 490], [650, 540], [600, 585], [540, 610], [460, 628], [380, 645], [300, 662], [220, 680], [160, 700], [115, 740], [100, 800], [115, 860], [160, 895], [220, 905], [280, 885], [340, 845], [400, 805], [460, 770], [520, 745], [590, 735], [660, 738], [720, 728], [770, 690], [795, 630], [795, 550]],
  },
  lemans: {
    file: 'le_mans_karting_international_wet.glb',
    scale: 1.2, half: 5.1, gameHalf: 5.1, step: 1, // un poco más grande que la realidad, como el kartódromo
    road: { materials: ['ROAD_01.002', 'GROOVE.002', 'RMBL_01_WET.002', 'RMBL_EDGE.002'] },
    paved: [], pavedExcept: /GRASS|SAND|TREE|BRANCH|BARK|LONA/i, // se corre por todo lo que no sea hierba o arena
    kerbs: ['RMBL_01_WET.002', 'RMBL_EDGE.002'],
    barriers: ['BLOCK_YELLOW.002', 'BLOCK_BLACK.002', 'STOP_RAIL.002', 'TIRES_01.002', 'PITWALL.002', 'MARSHHUTFENCE.005'],
    blockers: ['BLOCK_YELLOW.002', 'BLOCK_BLACK.002', 'STOP_RAIL.002', 'TIRES_01.002', 'PITWALL.002', 'MARSHHUTFENCE.005', 'FENCE_GREEN.002', 'FENCE_GREY.002', 'GARAGE_WAVE_WALL1.002', 'TWR_WALL_1.002', 'CONTAINER.002', 'BUILDING_01.002', 'BUILDING_02.002', 'E_BOX.005', 'TENTFRAME.002', 'BLACK.007'],
    tyreGap: 3, edgeMax: 40,
    tile: ['ROAD_01.002', 'GRASS_OUT_IN.002', 'ROAD_OUTSIDE_01.002', 'RMBL_02.002', 'EDGELINE.002', 'LINES.002', 'GROOVE.002', 'BLOCK_YELLOW.002', 'METAL_BRIDGE1.005'],
    texBig: ['ROAD_01.002', 'RMBL_01_WET.002', 'RMBL_EDGE.002', 'GRASS_OUT_IN.002', 'LINES.002', 'EDGELINE.002', 'GROOVE.002', 'BLOCK_YELLOW.002'],
    ratio: { 'ROAD_01.002': 1, 'RMBL_01_WET.002': 1, 'RMBL_EDGE.002': 1, 'EDGELINE.002': 1, 'LINES.002': 1, 'GROOVE.002': 1, 'METAL_BRIDGE1.005': 0.3, '*': 0.6 },
    error: 0.01, errorFor: { 'ROAD_01.002': 0.001, 'BLOCK_YELLOW.002': 0.003 },
    // plano de 4 px por metro: x = -40 + px/4, z = -130 + py/4. Salida junto al semáforo de la recta de boxes, hacia él
    map: (px, py) => [-40 + px / 4, -130 + py / 4],
    path: [[155, 960], [170, 1050], [215, 1140], [290, 1225], [370, 1235], [415, 1180], [405, 1115], [340, 1060], [305, 1000], [290, 900], [275, 780], [262, 650], [258, 560], [285, 500], [400, 472], [540, 468], [605, 500], [628, 580], [600, 655], [540, 688], [480, 660], [430, 632], [372, 642], [360, 700], [378, 800], [430, 858], [495, 890], [528, 960], [530, 1060], [560, 1160], [640, 1255], [720, 1335], [782, 1350], [808, 1300], [770, 1230], [700, 1160], [662, 1100], [682, 1030], [745, 975], [762, 900], [762, 700], [762, 500], [760, 380], [740, 305], [690, 300], [600, 325], [520, 355], [470, 360], [440, 325], [420, 255], [385, 212], [330, 202], [230, 215], [178, 260], [155, 330], [155, 500], [155, 700], [155, 860]],
  },
  castle: {
    file: 'castle_circuit.glb',
    scale: 26, half: 6.5, // misma escala que Misty (mismos karts y decorado)
    dropNodes: /^(SceneReferences|StartLine|startFrame|castle_ads|IgnoreCombine|Audience)$/, // fuera los carteles con el logo del juego original, el dirigible y el arco de salida
    road: { node: /^(CastleRoad|trackTunnelCastle_driveable|trackCurbs)$/ }, // empedrado, grava, túnel y bordillos de piedra
    startY: -0.06,
    // plano de 120 px por unidad: x = -3.4 + px/120, z = -3.4 + py/120. Salida en la línea de meta, hacia el túnel
    map: (px, py) => [-3.4 + px / 120, -3.4 + py / 120],
    path: [[543, 546], [510, 508], [478, 468], [455, 425], [460, 380], [485, 340], [503, 295], [505, 245], [488, 200], [452, 172], [408, 166], [366, 186], [342, 230], [326, 278], [292, 314], [232, 325], [162, 332], [112, 352], [100, 392], [132, 424], [182, 452], [232, 482], [282, 510], [318, 540], [312, 585], [302, 640], [288, 700], [268, 755], [236, 792], [188, 803], [140, 788], [110, 748], [106, 698], [122, 650], [160, 616], [222, 604], [292, 604], [362, 604], [432, 610], [482, 636], [530, 660], [578, 664], [614, 638], [610, 600], [580, 572]],
    solids: true, heights: true, step: 1, walkEdges: true, // el modelo tal cual: muros donde acaba el suelo, paredes y setos se chocan
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
      const V = [], info = prim.getMaterial().getBaseColorTextureInfo(), tt = info && info.getExtension('KHR_texture_transform');
      const tOff = tt ? tt.getOffset() : [0, 0], tSc = tt ? tt.getScale() : [1, 1], tRot = tt ? tt.getRotation() : 0, cr = Math.cos(tRot), sr = Math.sin(tRot);
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, a); const p = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2] + M[12], M[1] * a[0] + M[5] * a[1] + M[9] * a[2] + M[13], M[2] * a[0] + M[6] * a[1] + M[10] * a[2] + M[14]];
        let q = [0, 1, 0]; if (nor) { nor.getElement(i, a); q = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2], M[1] * a[0] + M[5] * a[1] + M[9] * a[2], M[2] * a[0] + M[6] * a[1] + M[10] * a[2]]; const l = Math.hypot(...q) || 1; q = q.map((v) => v / l); }
        if (uv) uv.getElement(i, b);
        let c = null; if (col) { const e = [1, 1, 1, 1]; col.getElement(i, e); c = e.slice(0, 3); }
        const su = b[0] * tSc[0], sv = b[1] * tSc[1];
        V.push({ p, n: q, uv: tt ? [tOff[0] + cr * su + sr * sv, tOff[1] - sr * su + cr * sv] : [b[0], b[1]], c });
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
  const raw = heights(P);
  return { P, Y: average(raw, 2), raw };
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
    if (isRoad.has(t) || (cfg.noSolid && t.chain.some((c) => cfg.noSolid.test(c))) || SOFT.test(t.mat.getName()) || t.mat.getAlphaMode() === 'BLEND' || t.chain.some((c) => SOFT.test(c))) continue;
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
    for (const c of cuts) if (Math.hypot(c.hit[1][0] - c.hit[0][0], c.hit[1][1] - c.hit[0][1]) * S > 0.05) out.push({ a: c.hit[0], b: c.hit[1], y: c.y, src: t.chain[0] });
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

// alturas de la calzada cada 0,5 m (cm, -32768 = nada). Donde hay dos niveles se queda el más cercano al eje
function heightGrid(cfg, road, place, nodes) {
  const cell = 0.5, xs = nodes.map((n) => n[0]), zs = nodes.map((n) => n[1]), x0 = Math.floor(Math.min(...xs) - 12), z0 = Math.floor(Math.min(...zs) - 12);
  const w = Math.ceil((Math.max(...xs) + 12 - x0) / cell), h = Math.ceil((Math.max(...zs) + 12 - z0) / cell), out = new Int16Array(w * h).fill(-32768), want = new Float32Array(w * h).fill(NaN);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell; let bd = 1e9, y = NaN; for (const n of nodes) { const d = (n[0] - x) ** 2 + (n[1] - z) ** 2; if (d < bd) { bd = d; y = n[2]; } } if (bd < (cfg.half + 2) ** 2) want[j * w + i] = y; }
  for (const t of road) {
    const [A, B, C] = t.v.map((v) => place(v.p)), den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.max(0, Math.floor((Math.min(A[2], B[2], C[2]) - z0) / cell)); j <= Math.min(h - 1, Math.floor((Math.max(A[2], B[2], C[2]) - z0) / cell)); j++) for (let i = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - x0) / cell)); i <= Math.min(w - 1, Math.floor((Math.max(A[0], B[0], C[0]) - x0) / cell)); i++) {
      const n = j * w + i; if (Number.isNaN(want[n])) continue;
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
      if (a < -0.01 || b < -0.01 || a + b > 1.01) continue;
      const y = a * A[1] + b * B[1] + (1 - a - b) * C[1]; if (Math.abs(y - want[n]) > 2.5) continue;
      if (out[n] === -32768 || Math.abs(y - want[n]) < Math.abs(out[n] / 100 - want[n])) out[n] = Math.round(y * 100);
    }
  }
  console.log('  mapa de alturas', w + 'x' + h, 'celdas con suelo', out.filter((v) => v !== -32768).length);
  return { x: x0, z: z0, w, h, cell, data: Buffer.from(out.buffer).toString('base64') };
}

// barreras del modelo (neumáticos, vallas, muros) como obstáculos: se rasterizan en celdas de 0,35 m y su contorno son
// los tramos contra los que se choca. Donde la hierba no tiene barrera, una fila de neumáticos nueva cierra el atajo
function blockerSegments(cfg, tris, place, nodes, data) {
  const cell = 0.35, xs = nodes.map((n) => n[0]), zs = nodes.map((n) => n[1]), ys = nodes.map((n) => n[2]), x0 = Math.floor(Math.min(...xs) - 30), z0 = Math.floor(Math.min(...zs) - 30);
  const ylo = Math.min(...ys) - 1.2, yhi = Math.max(...ys) + 1.8, w = Math.ceil((Math.max(...xs) + 30 - x0) / cell), h = Math.ceil((Math.max(...zs) + 30 - z0) / cell), occ = new Uint8Array(w * h);
  const mark = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); if (i >= 0 && j >= 0 && i < w && j < h) occ[j * w + i] = 1; };
  for (const t of tris) {
    if (!cfg.blockers.includes(t.mat.getName())) continue;
    const P = t.v.map((v) => place(v.p)); if (Math.max(...P.map((p) => p[1])) < ylo || Math.min(...P.map((p) => p[1])) > yhi) continue;
    const span = Math.max(...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.hypot(P[b][0] - P[a][0], P[b][2] - P[a][2]))), k = Math.max(2, Math.ceil(span / (cell * 0.5)));
    for (let a = 0; a <= k; a++) for (let b = 0; b <= k - a; b++) { const c = k - a - b; mark((a * P[0][0] + b * P[1][0] + c * P[2][0]) / k, (a * P[0][2] + b * P[1][2] + c * P[2][2]) / k); }
  }
  // suelo de carrera (asfalto, hormigón, pianos)
  const g = data.paved, bits = Buffer.from(g.data, 'base64'), paved = (x, z) => { const i = Math.floor((x - g.x) / g.cell), j = Math.floor((z - g.z) / g.cell); if (i < 0 || j < 0 || i >= g.w || j >= g.h) return false; const n = j * g.w + i; return !!((bits[n >> 3] >> (n & 7)) & 1); };
  const blocked = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i >= 0 && j >= 0 && i < w && j < h && occ[j * w + i]; };
  const near = (x, z, r) => nodes.some((n) => (n[0] - x) ** 2 + (n[1] - z) ** 2 < r * r);
  // fila de neumáticos donde la hierba no tiene barrera
  const tyres = [], N = nodes.length, half = cfg.gameHalf ?? cfg.half;
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < N; i++) {
      const a = nodes[(i - 1 + N) % N], b = nodes[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * side, nz = (b[0] - a[0]) / l * side, [x, z, y] = nodes[i];
      let e = 0; while (e < 25 && paved(x + nx * e, z + nz * e)) e += 0.2;
      const open = e > half + 5; if (open) e = half + 2.5; // explanada (aparcamiento, boxes): la fila va sobre el asfalto
      // si al otro lado de la hierba vuelve a haber pista (otro tramo), la fila va por la mitad: así no se ataja de un tramo a otro
      let gap = 99; if (!open) for (let q = e + 0.2; q < e + 25; q += 0.2) if (paved(x + nx * q, z + nz * q)) { gap = q - e; break; }
      const d = e + Math.min(cfg.tyreGap ?? 2.5, gap / 2), px = x + nx * d, pz = z + nz * d;
      let ok = (open || (e < 25 && gap > 1.2 && !paved(px, pz))) && !near(px, pz, half + 0.4);
      for (let q = e; ok && q < d + 5; q += 0.3) if (blocked(x + nx * q, z + nz * q)) ok = false; // ya hay barrera
      // filas de neumáticos: polilíneas con un punto cada muestra (el juego pone los neumáticos y los muros entre puntos)
      if (ok) { if (!(prev && Math.hypot(prev[0] - px, prev[2] - pz) < 4)) tyres.push([]); tyres[tyres.length - 1].push([px, y, pz]); prev = [px, y, pz]; } else prev = null;
    }
  }
  // por la calzada siempre se pasa (neumáticos sueltos del modelo sobre la pista)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (occ[j * w + i] && near(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell, half - 0.4)) occ[j * w + i] = 0;
  // contorno: un tramo por cada lado de celda ocupada que da a una libre, unidos en línea recta
  const yAt = (x, z) => { let bd = 1e9, y = 0; for (const n of nodes) { const d = (n[0] - x) ** 2 + (n[1] - z) ** 2; if (d < bd) { bd = d; y = n[2]; } } return y; };
  const segs = [];
  for (let j = 0; j < h; j++) { let run = null; for (let i = 0; i <= w; i++) { const edge = i < w && j > 0 && occ[j * w + i] !== occ[(j - 1) * w + i]; if (edge && !run) run = i; if (!edge && run != null) { segs.push([x0 + run * cell, z0 + j * cell, x0 + i * cell, z0 + j * cell]); run = null; } } }
  for (let i = 0; i < w; i++) { let run = null; for (let j = 0; j <= h; j++) { const edge = j < h && i > 0 && occ[j * w + i] !== occ[j * w + i - 1]; if (edge && run == null) run = j; if (!edge && run != null) { segs.push([x0 + i * cell, z0 + run * cell, x0 + i * cell, z0 + j * cell]); run = null; } } }
  const out = segs.filter((q) => near((q[0] + q[2]) / 2, (q[1] + q[3]) / 2, 30)).map((q) => [...q.map((v) => +v.toFixed(2)), +yAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2).toFixed(1)]);
  const rows = tyres.filter((r) => r.length > 1);
  for (const r of rows) for (let k = 0; k + 1 < r.length; k++) out.push([r[k][0], r[k][2], r[k + 1][0], r[k + 1][2], r[k][1]].map((v) => +v.toFixed(2)));
  return { solids: out, tyres: rows.map((r) => r.map((p) => p.map((v) => +v.toFixed(1)))) };
}

// muros invisibles donde el suelo del modelo se acaba de verdad: un cortado o un escalón de más de 45 cm
function walkEdges(cfg, tris, place, nodes, step) {
  const cell = 0.5, xs = nodes.map((n) => n[0]), zs = nodes.map((n) => n[1]), x0 = Math.floor(Math.min(...xs) - 20), z0 = Math.floor(Math.min(...zs) - 20);
  const w = Math.ceil((Math.max(...xs) + 20 - x0) / cell), h = Math.ceil((Math.max(...zs) + 20 - z0) / cell), lv = [new Float32Array(w * h).fill(NaN), new Float32Array(w * h).fill(NaN)];
  // hasta dos niveles por celda (la pista pasa por debajo de sí misma)
  for (const t of tris) {
    const [A, B, C] = t.v.map((v) => place(v.p)), u = B.map((v, k) => v - A[k]), q = C.map((v, k) => v - A[k]), ny = u[2] * q[0] - u[0] * q[2], l = Math.hypot(u[1] * q[2] - u[2] * q[1], ny, u[0] * q[1] - u[1] * q[0]);
    if (!l || Math.abs(ny) / l < 0.6 || /water|ocean|grass|plant|shrub|decal/i.test(t.mat.getName())) continue;
    const den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.max(0, Math.floor((Math.min(A[2], B[2], C[2]) - z0) / cell)); j <= Math.min(h - 1, Math.floor((Math.max(A[2], B[2], C[2]) - z0) / cell)); j++) for (let i = Math.max(0, Math.floor((Math.min(A[0], B[0], C[0]) - x0) / cell)); i <= Math.min(w - 1, Math.floor((Math.max(A[0], B[0], C[0]) - x0) / cell)); i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
      if (a < -0.01 || b < -0.01 || a + b > 1.01) continue;
      const y = a * A[1] + b * B[1] + (1 - a - b) * C[1], n = j * w + i;
      // nivel 0 y 1: se guarda la superficie más alta de cada «piso» (separados más de 3 m)
      if (Number.isNaN(lv[0][n]) || Math.abs(y - lv[0][n]) < 3) { if (Number.isNaN(lv[0][n]) || y > lv[0][n]) lv[0][n] = y; } else if (Number.isNaN(lv[1][n]) || y > lv[1][n]) lv[1][n] = y;
    }
  }
  const at = (x, z, near) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); if (i < 0 || j < 0 || i >= w || j >= h) return NaN; const a = lv[0][j * w + i], b = lv[1][j * w + i]; const c = [a, b].filter((v) => !Number.isNaN(v)); if (!c.length) return NaN; return c.reduce((p, v) => (Math.abs(v - near) < Math.abs(p - near) ? v : p)); };
  const N = nodes.length, half = cfg.half, max = cfg.walkMax ?? 14;
  const raw = [-1, 1].map((side) => nodes.map((p, i) => {
    const a = nodes[(i - 1 + N) % N], b = nodes[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * side, nz = (b[0] - a[0]) / l * side;
    let prev = p[2], d = 1;
    { const c0 = at(p[0], p[1], p[2]); if (!Number.isNaN(c0) && Math.abs(c0 - p[2]) <= 1) prev = c0; } // se parte del suelo real del eje, no del perfil suavizado
    { const c0 = at(p[0], p[1], p[2]); if (Number.isNaN(c0) || Math.abs(c0 - p[2]) > 1) { if (process.env.DBG_EDGE && i * 2.5 >= 250 && i * 2.5 <= 272) console.log('  aire', i * 2.5, c0, p[2]); return half + 2.5; } } // en el aire del salto no hay suelo a la altura del eje: margen para volar
    const s = i * 2.5, drop = (cfg.dropOk || []).some(([a, b]) => s >= a && s <= b) ? 1.6 : 0.45;
    for (; d < max; d += 0.25) { const y = at(p[0] + nx * d, p[1] + nz * d, prev); if (Number.isNaN(y) || y - prev > 0.45 || prev - y > drop) { if (process.env.DBG_EDGE && s >= 250 && s <= 272) console.log('  borde', s, side, d.toFixed(2), 'y', y, 'prev', prev.toFixed(2)); break; } prev = y; }
    return Math.max(half * 0.6, d - 0.25);
  }));
  const out = raw.map((r) => r.map((_, i) => Math.min(...[-3, -2, -1, 0, 1, 2, 3].map((k) => r[(i + k + N) % N]))));
  console.log('  muros donde acaba el suelo: medio', (out.flat().reduce((a, b) => a + b, 0) / (2 * N)).toFixed(1), 'm, mínimo', Math.min(...out.flat()).toFixed(1));
  return out.map((r) => r.filter((_, i) => i % step === 0).map((v) => +v.toFixed(2)));
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

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const data = ONLY ? Object.fromEntries(Object.entries((await import(new URL('../src/tracks-data.js', import.meta.url))).TRACK_DATA).filter(([k]) => TRACKS[k])) : {};
for (const [id, cfg] of Object.entries(TRACKS)) {
  if (ONLY && !ONLY.includes(id)) continue;
  let tris = readTris(await io.read(path.join(SRC, cfg.file)), cfg);
  const road = tris.filter((t) => (cfg.road.node ? t.chain.some((c) => cfg.road.node.test(c)) : cfg.road.materials.includes(t.mat.getName())));
  const hit = makeGrid(road, cfg.half * 2 / cfg.scale);
  const line = centreLine(cfg, hit);
  if (cfg.gaps) {
    const n = line.P.length, miss = line.P.map(([x, z]) => !hit(x, z).length);
    for (let i = 0; i < n; i++) if (miss[i] && !miss[(i - 1 + n) % n]) {
      let j = i; while (miss[j % n] && j - i < n) j++;
      for (let k = 1; k <= 8; k++) { line.Y[(i - k + n) % n] = line.raw[(i - k + n) % n]; line.Y[(j + k - 1) % n] = line.raw[(j + k - 1) % n]; } // borde de la rampa y aterrizaje tal cual
      const low = Math.min(line.Y[(i - 1 + n) % n], line.Y[j % n]); for (let k = i; k < j; k++) line.Y[k % n] = low;
      console.log(id, 'hueco del salto:', ((j - i) * 2.5).toFixed(0), 'm');
    }
  }
  if (cfg.startAt && !cfg.rebuild) { const k = Math.round(cfg.startAt / 2.5), turn = (a) => a.slice(k).concat(a.slice(0, k)); line.P = turn(line.P); line.Y = turn(line.Y); line.raw = turn(line.raw); }
  if (cfg.heights) { // saltos: hasta el borde de la rampa, la altura real (sin suavizar); después, directamente la del aterrizaje
    const L = line.Y.length;
    for (let a = 0; a < L; a++) if (line.Y[a] - line.Y[(a + 1) % L] > 1 / cfg.scale && line.Y[(a - 1 + L) % L] - line.Y[a] <= 1 / cfg.scale) {
      let b = a + 1; while (line.Y[b % L] - line.Y[(b + 1) % L] > 0.3 / cfg.scale && b - a < 20) b++;
      for (let k = 0; k < 4; k++) line.Y[(a - k + L) % L] = Math.max(line.Y[(a - k + L) % L], line.raw[(a - k + L) % L]);
      for (let k = a + 1; k < b; k++) line.Y[k % L] = line.Y[b % L];
      console.log(cfg.file, 'salto: borde en', (a * 2.5).toFixed(0), 'm, cae', ((line.Y[a] - line.Y[b % L]) * cfg.scale).toFixed(1), 'm');
    }
  }
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
    if (cfg.dropOk) { // donde se baja un escalón, su cara de roca no es una pared
      const L = line.P.length, n0 = solids.length;
      for (let k = solids.length - 1; k >= 0; k--) { const g = solids[k]; if (!/Cliff/.test(g.src)) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; let bi = 0, bd = 1e9; for (let i = 0; i < L; i++) { const d = (line.P[i][0] - m[0]) ** 2 + (line.P[i][1] - m[1]) ** 2; if (d < bd && Math.abs(line.Y[i] - g.y) < 2 / S) { bd = d; bi = i; } } if (cfg.dropOk.some(([a, b]) => bi * 2.5 >= a && bi * 2.5 <= b) && Math.sqrt(bd) * S < cfg.half + 1.5) solids.splice(k, 1); }
      console.log(id, 'caras de escalón quitadas:', n0 - solids.length);
    }
    if (process.env.DBG_SOLID) { const [a, b, w] = process.env.DBG_SOLID.split(',').map(Number), L = line.P.length; for (let i = Math.round(a / 2.5); i <= Math.round(b / 2.5); i++) { const p = line.P[i % L], q = line.P[(i + 1) % L], l = Math.hypot(q[0] - p[0], q[1] - p[1]); const near = solids.filter((g) => Math.abs(g.y - line.Y[i]) < 1.5 / S).map((g) => { const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], dx = m[0] - p[0], dz = m[1] - p[1], al = (dx * (q[0] - p[0]) + dz * (q[1] - p[1])) / l, lat = (dx * -(q[1] - p[1]) + dz * (q[0] - p[0])) / l; return [al * S, lat * S, g.src]; }).filter(([al, lat]) => Math.abs(al) < 1.3 && Math.abs(lat) < w); if (near.length) console.log('  sólido', i * 2.5, [...new Set(near.map((n) => n[1].toFixed(1) + ' ' + n[2]))].join(' | ')); } }
    if (cfg.rebuild) { // pegados al borde ya los cubre el muro lateral; sueltos ahí forman rincones donde el kart se encaja
      const far = (cfg.half + (cfg.wallExtra ?? 0.25) - 1.0) / S, off = (x, z, y) => Math.min(...line.P.map(([px, pz], i) => (Math.abs(line.Y[i] - y) < 1.5 / S ? Math.hypot(px - x, pz - z) : 1e9)));
      for (let i = solids.length - 1; i >= 0; i--) { const q = solids[i]; if (off(q.a[0], q.a[1], q.y) > far && off(q.b[0], q.b[1], q.y) > far) solids.splice(i, 1); }
    }
  }
  const cx = line.P.reduce((n, p) => n + p[0], 0) / line.P.length, cz = line.P.reduce((n, p) => n + p[1], 0) / line.P.length, y0 = Math.min(...line.Y);
  const place = (p) => [(p[0] - cx) * S, (p[1] - y0) * S + 2, (p[2] - cz) * S]; // el punto más bajo de la calzada queda a 2 m
  if (process.env.FRAME) console.log(id, 'FRAME', JSON.stringify({ cx, cz, y0, S }));
  if (cfg.flatten) {
    const roadSet = new Set(road), done = new Set(), L = line.P.length;
    for (const t of tris) for (const v of t.v) { // calzada y lo que la toca (el pie de la roca baja con ella: sin huecos)
      if (done.has(v)) continue; done.add(v);
      const [x, , z] = v.p; let bi = -1, bd = 1e9; for (let i = 0; i < L; i++) { if (Math.abs(line.Y[i] - v.p[1]) > 3 / S) continue; const d = (line.P[i][0] - x) ** 2 + (line.P[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      if (bi < 0) continue;
      const a = line.P[(bi - 1 + L) % L], b = line.P[(bi + 1) % L], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lat = ((x - line.P[bi][0]) * -(b[1] - a[1]) + (z - line.P[bi][1]) * (b[0] - a[0])) / l * S, s = bi * 2.5;
      for (const f of cfg.flatten) if (s >= f.from && s <= f.to && lat * f.side > f.inner && lat * f.side < 10 && (v.p[1] - line.Y[bi]) * S > 0.12 && (v.p[1] - line.Y[bi]) * S < (roadSet.has(t) ? 3 : 1.4)) v.p[1] = line.Y[bi];
    }
  }
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
  if (cfg.walkEdges) data[id].edges = walkEdges(cfg, tris, place, nodes, every.length === nodes.length ? 1 : step);
  if (cfg.barriers) data[id].edges = barrierEdges(cfg, line, tris).map((e) => average(e, 2).filter((_, i) => i % step === 0).map((v) => +v.toFixed(2)));
  console.log(id, 'vuelta', Math.round(len), 'm, desnivel', (Math.max(...nodes.map((n) => n[2])) - 2).toFixed(1), 'm, puntos fuera de la calzada', off, 'de', line.P.length);
  if (cfg.rebuild) data[id].edges = walled.map((w) => every.map((_, i) => +w[i * step].toFixed(2)));
  if (cfg.heights) {
    data[id].heights = heightGrid(cfg, road, place, nodes);
    // saltos de verdad: donde el perfil cae más de 1 m en 2,5 m. Solo ahí puede despegar el kart
    const n = nodes.length, j = []; for (let i = 0; i < n; i++) if (nodes[i][2] - nodes[(i + 1) % n][2] > 1) j.push(i);
    data[id].jumps = j.map((i) => [+(((i - 6 + n) % n) / n).toFixed(4), +(((i + 2) % n) / n).toFixed(4)]);
    console.log(id, "saltos:", data[id].jumps.length);
  }
  if (cfg.paved) {
    data[id].paved = cfg.pavedExcept ? topGrid(cfg, tris, place, nodes, cfg.pavedExcept) : pavedGrid(cfg, tris, place, nodes);
    if (cfg.kerbs) data[id].kerbs = pavedGrid(cfg, tris, place, nodes, cfg.kerbs);
    if (cfg.gameHalf) data[id].gameHalf = cfg.gameHalf;
    if (cfg.blockers) {
      const { solids: segs, tyres } = blockerSegments(cfg, tris, place, nodes, data[id]);
      data[id].solids = segs; data[id].tyres = tyres;
      console.log(id, 'barreras:', segs.length, 'tramos de muro |', tyres.length, 'filas de neumáticos nuevas');
    }
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
