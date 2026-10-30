// Uso: instalar en una carpeta aparte  npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer  y ajustar SRC.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, simplify, prune, dedup, getBounds, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const SRC = '/mnt/user-data/uploads/e05a5986-volkswagen_borajetta_mk4_2005.glb';
const KEEP = new Set(['BoraVR6_body','BoraVR6_door_FL','BoraVR6_door_FR','BoraVR6_door_RL','BoraVR6_door_RR','BoraVR6_hood','BoraVR6_trunk','BoraVR6_bumper_F','BoraVR6_bumper_R','BoraVR6_fender_L','BoraVR6_fender_R','BoraVR6_roof_plain','BoraVR6_mirror_L','BoraVR6_mirror_R','BoraVR6_headlightframe_L','BoraVR6_headlightframe_R','BoraVR6_taillightframe_L','BoraVR6_taillightframe_R','BoraVR6_windshield','BoraVR6_backlight','BoraVR6_doorglass_FL','BoraVR6_doorglass_FR','BoraVR6_doorglass_RL','BoraVR6_doorglass_RR','BoraVR6_headlightglass_L','BoraVR6_headlightglass_R','BoraVR6_taillightglass_L','BoraVR6_taillightglass_R','BoraVR6_exhaust','BoraVR6_dno','BoraVR6_brakedisc_FL','BoraVR6_brakedisc_FR','BoraVR6_brakedisc_RL','BoraVR6_brakedisc_RR']);
const ROLE = { BoraVR6: 'PAINT', BoraVR6_chrome: 'CHROME', etk_wheel_03a: 'CHROME', BoraVR6_nodamage: 'CHROME', BoraVR6_mirrors: 'CHROME', BoraVR6_lights_misc: 'CHROME', etk800_glass: 'GLASS', BoraVR6_lights_glass: 'LENS', material: 'LENS', etk800: 'UNDER', black: 'BLACK', 'black.001': 'BLACK', BoraVR6_black: 'BLACK', BoraVR6_frame: 'BLACK', BoraVR6_signal_L: 'SIGNAL', BoraVR6_signal_R: 'SIGNAL', BoraVR6_chmsl: 'TAIL', BoraVR6_taillight: 'TAIL', BoraVR6_reverselight: 'REVERSE', BoraVR6_headlight: 'HEAD', BoraVR6_highbeam: 'HEAD', BoraVR6_wheel: 'RIM' };
const COLORS = { PAINT: [0.02, 0.2, 0.12], CHROME: [0.8, 0.8, 0.82], GLASS: [0.03, 0.05, 0.07], LENS: [0.9, 0.9, 0.95], UNDER: [0.06, 0.06, 0.07], BLACK: [0.02, 0.02, 0.02], SIGNAL: [1, 0.5, 0], TAIL: [0.8, 0, 0], REVERSE: [0.85, 0.85, 0.85], HEAD: [1, 1, 0.9], RIM: [0.78, 0.8, 0.84] };

async function build(kind, ratio, outName) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const collada = root.listNodes().find((n) => n.getName().startsWith('Collada'));
  const keepName = kind === 'wheel' ? new Set(['BoraVR6_wheel_17x8']) : KEEP;
  for (const ch of collada.listChildren()) if (!keepName.has(ch.getName())) ch.dispose();
  // materiales por rol
  const roleMat = {};
  const getMat = (r) => roleMat[r] || (roleMat[r] = doc.createMaterial(r).setBaseColorFactor([...COLORS[r], 1]).setDoubleSided(r === 'LENS' || r === 'GLASS' || r === 'CHROME'));
  for (const n of collada.listChildren()) for (const c of n.listChildren()) {
    const mesh = c.getMesh(); if (!mesh) continue;
    for (const p of mesh.listPrimitives()) {
      const mn = p.getMaterial() ? p.getMaterial().getName() : 'etk800';
      let role = ROLE[mn] || 'UNDER';
      if (/glass/.test(n.getName()) && !/doorglass|windshield|backlight/.test(n.getName())) role = 'LENS';
      p.setMaterial(getMat(role));
      for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL'].includes(sem)) p.setAttribute(sem, null);
    }
  }
  for (const m of root.listMaterials()) if (!Object.values(roleMat).includes(m)) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(flatten(), join({ keepMeshes: false, keepNamed: false }), weld({ tolerance: 0.0006, toleranceNormal: 0.6 }), prune());
  if (ratio < 1) {
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
      const idx = p.getIndices(); const pos = p.getAttribute('POSITION');
      const src = Uint32Array.from(idx.getArray()), P = new Float32Array(pos.getArray());
      const role = p.getMaterial() ? p.getMaterial().getName() : 'UNDER';
      const big = role === 'PAINT' || role === 'UNDER' || role === 'BLACK';
      const r = big ? ratio : Math.min(1, ratio * 4), errTol = big ? 0.05 : 0.008;
      const target = Math.max(60, Math.round((src.length * r) / 3) * 3);
      let [out, err] = MeshoptSimplifier.simplify(src, P, 3, target, errTol, []);
      if (big && out.length > target * 1.6) [out, err] = MeshoptSimplifier.simplifySloppy(src, P, 3, null, target, 0.1);
      idx.setArray(out.length < 65535 * 3 && pos.getCount() < 65535 ? Uint16Array.from(out) : Uint32Array.from(out));
    }
    await doc.transform(prune());
  }
  await doc.transform(weld({ tolerance: 0 }), reorder({ encoder: MeshoptEncoder }), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  // ejes: dejar la escena sin la rotación de Sketchfab (ya aplicada por flatten); contar
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  const b = getBounds(doc.getRoot().listScenes()[0]);
    await io.write(outName, doc);
  const sz = (await import('node:fs')).statSync(outName).size;
  console.log(outName, 'tris', tris, 'meshes', root.listMeshes().length, 'KB', (sz / 1024) | 0, 'min', b.min.map((v) => +v.toFixed(2)), 'max', b.max.map((v) => +v.toFixed(2)));
}
await build('body', 0.25, 'bora_body_hi.glb');
await build('body', 0.07, 'bora_body_lo.glb');
await build('wheel', 0.3, 'bora_wheel_hi.glb');
await build('wheel', 0.08, 'bora_wheel_lo.glb');
