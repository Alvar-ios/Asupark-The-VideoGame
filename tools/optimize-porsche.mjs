import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
await MeshoptSimplifier.ready;
const SRC = '/mnt/user-data/uploads/c8fea0a8-1992_porsche_911_964_turbo_s_3.6.glb';
async function build(out, ratio) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  if (ratio < 1) {
    await doc.transform(weld({ tolerance: 0.0000002, toleranceNormal: 0.6 }));
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
      const idx = p.getIndices(), pos = p.getAttribute('POSITION'); if (!idx) continue;
      const src = Uint32Array.from(idx.getArray()), P = new Float32Array(pos.getArray());
      const target = Math.max(36, Math.round((src.length * ratio) / 3) * 3);
      const [o] = MeshoptSimplifier.simplify(src, P, 3, target, 0.05, []);
      idx.setArray(o.length < 65535 * 3 && pos.getCount() < 65535 ? Uint16Array.from(o) : Uint32Array.from(o));
    }
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: ratio < 1 ? 55 : 82, resize: ratio < 1 ? [256, 256] : [1024, 1024] }), weld({ tolerance: 0 }), prune(), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 12 }));
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  await io.write(out, doc); execSync(`gzip -9 -f -k ${out}`);
  console.log(out, 'tris', tris, 'KB', (statSync(out).size / 1024) | 0, 'gz', (statSync(out + '.gz').size / 1024) | 0);
}
await build('porsche_hi.glb', 1);
await build('porsche_lo.glb', 0.25);
