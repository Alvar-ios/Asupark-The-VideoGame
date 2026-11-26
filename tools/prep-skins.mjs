// Convierte los karts descargados en skins del juego: un .glb.gz por kart con nodos body, wheel_FL/FR/RL/RR y
// (si el modelo lo trae suelto) steer; morro hacia +Z, apoyado en el suelo, centrado y con texturas pequeñas.
// Uso: node tools/prep-skins.mjs <carpeta con los .glb descargados>
// Autoría y licencia de cada archivo en docs/CREDITOS.md.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) { console.log('Uso: node tools/prep-skins.mjs <carpeta>'); process.exit(1); }
const OUT = 'src/assets';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const LENGTH = 2.1, MAX_WIDTH = 1.62, TEX = 512;

// triángulos de una malla en coordenadas del mundo, con el nombre de los nodos que la contienen
function readTris(doc) {
  const out = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const M = n.getWorldMatrix(), chain = []; for (let p = n; p && p.getName; p = p.getParentNode()) chain.push(p.getName());
    for (const prim of m.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), a = [0, 0, 0], b = [0, 0];
      const V = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, a); const p = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2] + M[12], M[1] * a[0] + M[5] * a[1] + M[9] * a[2] + M[13], M[2] * a[0] + M[6] * a[1] + M[10] * a[2] + M[14]];
        let q = [0, 1, 0]; if (nor) { nor.getElement(i, a); q = [M[0] * a[0] + M[4] * a[1] + M[8] * a[2], M[1] * a[0] + M[5] * a[1] + M[9] * a[2], M[2] * a[0] + M[6] * a[1] + M[10] * a[2]]; }
        if (uv) uv.getElement(i, b);
        V.push({ p, n: q, uv: [b[0], b[1]] });
      }
      const idx = prim.getIndices() ? Array.from(prim.getIndices().getArray()) : V.map((_, i) => i);
      // piezas sueltas de esta malla (para recortar ruedas fundidas con el chasis)
      const seen = new Map(), id = V.map((v, i) => { const k = v.p.map((c) => Math.round(c * 2000)).join(); if (!seen.has(k)) seen.set(k, i); return seen.get(k); });
      const par = V.map((_, i) => i), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      for (let i = 0; i < idx.length; i += 3) { const r = find(id[idx[i]]); for (const k of [1, 2]) { const s = find(id[idx[i + k]]); if (s !== r) par[s] = r; } }
      const boxes = new Map();
      for (let i = 0; i < idx.length; i += 3) {
        const r = find(id[idx[i]]); let bx = boxes.get(r); if (!bx) boxes.set(r, (bx = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }));
        for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) { const v = V[idx[i + k]].p[c]; bx.mn[c] = Math.min(bx.mn[c], v); bx.mx[c] = Math.max(bx.mx[c], v); }
      }
      for (let i = 0; i < idx.length; i += 3) out.push({ v: [V[idx[i]], V[idx[i + 1]], V[idx[i + 2]]], mat: prim.getMaterial(), chain, piece: boxes.get(find(id[idx[i]])) });
    }
  }
  return out;
}
const bounds = (tris) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const t of tris) for (const v of t.v) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], v.p[c]); mx[c] = Math.max(mx[c], v.p[c]); } return { mn, mx, size: mx.map((v, c) => v - mn[c]), mid: mx.map((v, c) => (v + mn[c]) / 2) }; };

async function texture(out, src, name, cache) {
  if (!src) return null;
  if (cache.has(src)) return cache.get(src);
  const img = sharp(Buffer.from(src.getImage())), meta = await img.metadata(), size = Math.min(TEX, meta.width);
  const alpha = meta.hasAlpha && (await sharp(Buffer.from(src.getImage())).stats()).channels[3].min < 250;
  const base = sharp(Buffer.from(src.getImage())).resize(size, Math.round(size * meta.height / meta.width));
  const data = alpha ? await base.png({ compressionLevel: 9, palette: true }).toBuffer() : await base.flatten({ background: '#000' }).jpeg({ quality: 84 }).toBuffer();
  const tex = out.createTexture(name).setMimeType(alpha ? 'image/png' : 'image/jpeg').setImage(data);
  cache.set(src, tex); return tex;
}

// parts: { body: tris, wheel_FL: tris, ..., steer: tris } ya en las coordenadas del archivo original
async function write(id, parts, turn, size = 1) {
  const rot = (p) => (turn === 'x' ? [-p[2], p[1], p[0]] : [p[0], p[1], p[2]]); // 'x': el morro mira a +X y se gira a +Z
  const map = (t) => ({ ...t, v: t.v.map((v) => ({ p: rot(v.p), n: rot(v.n), uv: v.uv })) });
  const turned = Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, list.map(map)]));
  const all = bounds(Object.values(turned).flat()), s = size * Math.min(LENGTH / all.size[2], MAX_WIDTH / all.size[0]);
  const fit = (p) => [(p[0] - all.mid[0]) * s, (p[1] - all.mn[1]) * s, (p[2] - all.mid[2]) * s];

  const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene('kart');
  const mats = new Map(), cache = new Map();
  const material = async (m) => {
    if (mats.has(m)) return mats.get(m);
    const nm = out.createMaterial(m.getName()).setBaseColorFactor(m.getBaseColorFactor()).setMetallicFactor(m.getMetallicFactor()).setRoughnessFactor(m.getRoughnessFactor()).setDoubleSided(m.getDoubleSided()).setAlphaMode(m.getAlphaMode()).setAlphaCutoff(m.getAlphaCutoff()).setEmissiveFactor(m.getEmissiveFactor());
    mats.set(m, nm);
    nm.setBaseColorTexture(await texture(out, m.getBaseColorTexture(), m.getName() + '_c', cache));
    nm.setEmissiveTexture(await texture(out, m.getEmissiveTexture(), m.getName() + '_e', cache));
    return nm;
  };
  const centers = {}; let tris = 0;
  for (const [name, list] of Object.entries(turned)) {
    if (!list.length) continue;
    const byMat = new Map(); for (const t of list) { (byMat.get(t.mat) || byMat.set(t.mat, []).get(t.mat)).push(t); }
    const b = bounds(list), origin = name === 'body' ? [0, 0, 0] : fit(b.mid);
    if (name !== 'body') centers[name] = { c: origin.map((v) => +v.toFixed(3)), size: b.size.map((v) => +(v * s).toFixed(3)) };
    const mesh = out.createMesh(name);
    for (const [m, ts] of byMat) {
      const P = new Float32Array(ts.length * 9), N = new Float32Array(ts.length * 9), U = new Float32Array(ts.length * 6); let i = 0;
      for (const t of ts) for (const v of t.v) { const q = fit(v.p), l = Math.hypot(...v.n) || 1; P.set([q[0] - origin[0], q[1] - origin[1], q[2] - origin[2]], i * 3); N.set([v.n[0] / l, v.n[1] / l, v.n[2] / l], i * 3); U.set(v.uv, i * 2); i++; }
      tris += ts.length;
      mesh.addPrimitive(out.createPrimitive().setMaterial(await material(m))
        .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(P).setBuffer(buf))
        .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(N).setBuffer(buf))
        .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(U).setBuffer(buf)));
    }
    scene.addChild(out.createNode(name).setTranslation(origin).setMesh(mesh));
  }
  const glb = await io.writeBinary(out), gz = zlib.gzipSync(glb, { level: 9 });
  fs.writeFileSync(`${OUT}/skin_${id}.glb.gz`, gz);
  const info = { length: +(all.size[2] * s).toFixed(3), width: +(all.size[0] * s).toFixed(3), height: +(all.size[1] * s).toFixed(3), parts: centers };
  console.log(id.padEnd(14), String(tris).padStart(6), 'tris', (gz.length / 1024).toFixed(0).padStart(5), 'KB', 'ruedas', Object.keys(centers).filter((k) => k.startsWith('wheel')).length, centers.steer ? 'con volante' : '');
  return info;
}

const data = {};
const read = async (f) => readTris(await io.read(path.join(SRC, f)));

// ---------- kart estándar ----------
{
  const tris = await read('standard_kart.glb');
  const dot = (n) => 'normal_kart_root.' + n;
  const wheels = { wheel_FL: dot('polymsh_detached'), wheel_FR: dot('polymsh13'), wheel_RL: dot('polymsh_detached9'), wheel_RR: dot('polymsh_detached10') };
  const parts = { body: [], steer: [], wheel_FL: [], wheel_FR: [], wheel_RL: [], wheel_RR: [] };
  for (const t of tris) {
    const w = Object.keys(wheels).find((k) => t.chain.includes(wheels[k]));
    parts[w || (t.chain.includes(dot('torus')) ? 'steer' : 'body')].push(t);
  }
  data.estandar = await write('estandar', parts, 'z', 0.83);
}
// ---------- karts de caramelo (cinco, uno por sufijo) ----------
{
  const tris = await read('sugar_rush_karts__storybook.glb');
  const ids = { '': 'caramelo1', '.001': 'caramelo2', '.002': 'caramelo3', '.003': 'caramelo4', '.004': 'caramelo5' };
  for (const [suf, id] of Object.entries(ids)) {
    const pick = (n) => tris.filter((t) => t.chain.includes(n + suf));
    data[id] = await write(id, { body: [...pick('Base'), ...pick('Spoiler')], wheel_FL: pick('FL'), wheel_FR: pick('FR'), wheel_RL: pick('BL'), wheel_RR: pick('BR') }, 'z');
  }
}
// ---------- karts de pizzería (seis; las ruedas vienen fundidas con el chasis) ----------
{
  const tris = await read('fnaf_sb_go_karts.glb');
  const nodes = ['MOD_GoKart.mo', 'MOD_GoKart.mo.001', 'MOD_GoKart.mo.002', 'MOD_GoKart.mo.003', 'MOD_GoKart.mo.004', 'MOD_GoKart.mo.005'];
  for (let k = 0; k < nodes.length; k++) {
    const mine = tris.filter((t) => t.chain.includes(nodes[k])), mid = bounds(mine).mid[2];
    const parts = { body: [], steer: [], wheel_FL: [], wheel_FR: [], wheel_RL: [], wheel_RR: [] };
    for (const t of mine) {
      const b = t.piece, size = b.mx.map((v, c) => v - b.mn[c]), c = b.mx.map((v, i) => (v + b.mn[i]) / 2), side = Math.min(Math.abs(b.mn[2] - mid), Math.abs(b.mx[2] - mid));
      const axle = [0.66, -0.72].find((x) => Math.abs(c[0] - x) < 0.07);
      if (axle !== undefined && Math.abs(c[1] - 0.16) < 0.07 && size[0] <= 0.36 && size[1] <= 0.36 && side > 0.36 && (b.mn[2] - mid) * (b.mx[2] - mid) > 0) {
        // con el morro en +X, el lado -Z del archivo queda en +X (izquierda) al girar
        parts['wheel_' + (axle > 0 ? 'F' : 'R') + (c[2] < mid ? 'L' : 'R')].push(t);
      } else if (Math.abs(c[0] - 0.25) < 0.05 && Math.abs(c[1] - 0.54) < 0.05 && Math.abs(c[2] - mid) < 0.05) parts.steer.push(t);
      else parts.body.push(t);
    }
    data['pizza' + (k + 1)] = await write('pizza' + (k + 1), parts, 'x');
  }
}
fs.writeFileSync('src/skins-data.js', '// Generado por tools/prep-skins.mjs: medidas de cada kart y posición de sus ruedas y volante (metros, morro +Z)\nexport const SKIN_DATA = ' + JSON.stringify(data) + ';\n');
