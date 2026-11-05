// Uso (desde una carpeta con @gltf-transform/core+extensions y sharp): node prep-kart.mjs <src.glb> <outdir>
// Kart 125cc: 4096px -> 1024/256, separa las 4 ruedas (nodo wheel_XX), escala a 2.1 m, morro +Z, y deja la carrocería
// naranja en gris neutro para que el juego la tiñe con el color elegido.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
const [src, outdir = '.'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const LEN = 2.1, S = LEN / 272, ZC = -136;
const groups = {}; // clave: body|FL.. + material
const comp = (T, id) => { const par = id.map((_, i) => i); const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }; for (const t of T) { const r = f(id[t[0]]); for (const k of [1, 2]) { const s = f(id[t[k]]); if (s !== r) par[s] = r; } } return f; };
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh(); if (!m) continue; const M = n.getWorldMatrix();
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices(), mat = p.getMaterial().getName();
    const cnt = pos.getCount(), P = [], N = [], U = [], a = [0, 0, 0];
    for (let i = 0; i < cnt; i++) {
      pos.getElement(i, a); P.push([M[0] * a[0] + M[4] * a[1] + M[8] * a[2] + M[12], M[1] * a[0] + M[5] * a[1] + M[9] * a[2] + M[13], M[2] * a[0] + M[6] * a[1] + M[10] * a[2] + M[14]]);
      nor.getElement(i, a); N.push([M[0] * a[0] + M[4] * a[1] + M[8] * a[2], M[1] * a[0] + M[5] * a[1] + M[9] * a[2], M[2] * a[0] + M[6] * a[1] + M[10] * a[2]]);
      const b = [0, 0]; uv.getElement(i, b); U.push([b[0], b[1]]);
    }
    const ia = idx ? Array.from(idx.getArray()) : [...Array(cnt).keys()], T = []; for (let i = 0; i < ia.length; i += 3) T.push([ia[i], ia[i + 1], ia[i + 2]]);
    const key = new Map(), id = P.map((q, i) => { const k = q.map((v) => Math.round(v * 20)).join(','); if (!key.has(k)) key.set(k, i); return key.get(k); });
    const f = comp(T, id), cinfo = new Map();
    for (const t of T) { const r = f(id[t[0]]); if (!cinfo.has(r)) cinfo.set(r, { sx: 0, sz: 0, n: 0 }); const c = cinfo.get(r); c.n++; for (const v of t) { c.sx += P[v][0]; c.sz += P[v][2]; } }
    for (const c of cinfo.values()) { c.cx = c.sx / (c.n * 3); c.cz = c.sz / (c.n * 3); }
    for (const t of T) {
      const c = cinfo.get(f(id[t[0]])); let g = 'body';
      if (mat === 'chassis_color' && Math.abs(c.cx) > 60 && c.cz < -40 && c.cz > -250 && p.getAttribute('POSITION').getCount() > 0 && m.listPrimitives().length) g = (c.cx < 0 ? 'L' : 'R'); // provisional
      if (g !== 'body') g = (c.cz > -150 ? 'F' : 'R') + g;
      const k = g + '|' + mat; const G = groups[k] || (groups[k] = { g, mat, P: [], N: [], U: [] });
      for (const v of t) { G.P.push(P[v]); G.N.push(N[v]); G.U.push(U[v]); }
    }
  }
}
// el criterio de rueda solo vale para la malla de los neumáticos: comprobación de tamaños
for (const G of Object.values(groups)) console.log(G.g, G.mat, G.P.length / 3, 'tris');
// centros de rueda
const centers = {}; for (const G of Object.values(groups)) if (G.g !== 'body') { const c = centers[G.g] || (centers[G.g] = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] }); for (const q of G.P) for (let k = 0; k < 3; k++) { c.mn[k] = Math.min(c.mn[k], q[k]); c.mx[k] = Math.max(c.mx[k], q[k]); } }
const toM = (q) => [q[0] * S, q[1] * S, (q[2] - ZC) * S];
const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene();
const sz = { chassis_color: 1024, body_color: 1024, engine_bake: 256 };
const mats = {};
for (const m of doc.getRoot().listMaterials()) {
  const nm = m.getName(), nm2 = out.createMaterial(nm).setMetallicFactor(1).setRoughnessFactor(1);
  const R = sz[nm], tex = async (t, name, fmt = 'jpeg', recolor) => {
    let img = sharp(Buffer.from(t.getImage())).resize(R, R); let b;
    if (recolor) { const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true }); for (let i = 0; i < data.length; i += 3) { const r = data[i], g = data[i + 1], bl = data[i + 2]; if (r > 110 && r > g && g > bl && r - bl > 55 && g / r > 0.3 && g / r < 0.82) { const L = 0.3 * r + 0.59 * g + 0.11 * bl, v = Math.min(255, L * 1.7 + 12); data[i] = data[i + 1] = data[i + 2] = v; } } img = sharp(data, { raw: info }); }
    b = await img.jpeg({ quality: 84 }).toBuffer(); return out.createTexture(name).setImage(new Uint8Array(b)).setMimeType('image/jpeg');
  };
  nm2.setBaseColorTexture(await tex(m.getBaseColorTexture(), nm + '_bc', 'jpeg', nm === 'body_color'));
  if (nm !== 'engine_bake') { nm2.setMetallicRoughnessTexture(await tex(m.getMetallicRoughnessTexture(), nm + '_mr')); nm2.setNormalTexture(await tex(m.getNormalTexture(), nm + '_n')); }
  mats[nm] = nm2;
}
const addMesh = (name, list, origin) => {
  const mesh = out.createMesh(name);
  for (const G of list) {
    const n = G.P.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    G.P.forEach((q, i) => { const w = toM(q); pos.set([w[0] - origin[0], w[1] - origin[1], w[2] - origin[2]], i * 3); const l = Math.hypot(...G.N[i]) || 1; nor.set([G.N[i][0] / l, G.N[i][1] / l, G.N[i][2] / l], i * 3); uv.set(G.U[i], i * 2); });
    mesh.addPrimitive(out.createPrimitive().setMaterial(mats[G.mat]).setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf)).setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf)).setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf)));
  }
  return mesh;
};
scene.addChild(out.createNode('body').setMesh(addMesh('body', Object.values(groups).filter((G) => G.g === 'body'), [0, 0, 0])));
for (const k of ['FL', 'FR', 'RL', 'RR']) {
  const c = centers[k]; if (!c) { console.log('FALTA rueda', k); continue; }
  const o = toM([(c.mn[0] + c.mx[0]) / 2, (c.mn[1] + c.mx[1]) / 2, (c.mn[2] + c.mx[2]) / 2]);
  scene.addChild(out.createNode('wheel_' + k).setTranslation(o).setMesh(addMesh('wheel_' + k, Object.values(groups).filter((G) => G.g === k), o)));
  console.log(k, 'centro', o.map((v) => +v.toFixed(3)), 'radio', +((c.mx[1] - c.mn[1]) / 2 * S).toFixed(3));
}
await io.write(`${outdir}/car_kart_hi.glb`, out);
execSync(`gzip -9 -f -k ${outdir}/car_kart_hi.glb`);
