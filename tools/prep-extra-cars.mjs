import { gzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const sourceDir = path.resolve('Carmodels');
const outputDir = path.resolve('src/assets');
const cars = [
  { id: 'r24', file: '2004_renault_r24.glb', high: 50000, low: 14000 },
  { id: 'fordgt06', file: '2006_ford_gt_heritage_edition.glb', high: 50000, low: 14000 },
  { id: 'mp423', file: '2008_mclaren_mp423.glb', high: 50000, low: 14000 },
  { id: 'brawngp', file: '2009_brawn_gp.glb', high: 35000, low: 12000 },
  { id: 'rx7toon', file: 'mazda_rx7_stylised.glb', high: 6000, low: 4000 },
  { id: 'mp45', file: 'mclaren_mp45_formula_one.glb', high: 55000, low: 15000 },
  { id: 'minis', file: 'mini_cooper_s.glb', high: 45000, low: 12000 },
  { id: 'fordgt', file: '2020_ford_gt_heritage_edition.glb', high: 50000, low: 12000 },
  { id: 'z8', file: 'bmw_z8__www.vecarz.com.glb', high: 50000, low: 12000 },
  { id: 'f312t', file: 'ferrari_312t_1976__www.vecarz.com.glb', high: 50000, low: 12000 },
  { id: 'f550', file: 'ferrari_550_barchetta_2000_azzurro_hyperion.glb', high: 50000, low: 12000 },
  { id: 'etype', file: 'jaguar_e_type.glb', high: 50000, low: 12000 },
  { id: 'xj13', file: 'jaguar_xj13_1959__www.vecarz.com.glb', high: 50000, low: 12000 },
  { id: 'e30', file: 'low_poly_car_-_bmw_e30_1985_white.glb', high: 16000, low: 8000 },
];
const requested = new Set(process.argv.slice(2));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
await fs.mkdir(outputDir, { recursive: true });

function triangleCount(doc) {
  let count = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    const positions = primitive.getAttribute('POSITION');
    count += (indices ? indices.getCount() : positions?.getCount() || 0) / 3;
  }
  return Math.round(count);
}

function removeGroundPlanes(doc) {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const names = [node.getName(), ...mesh.listPrimitives().map((primitive) => primitive.getMaterial()?.getName() || '')];
    if (names.some((name) => /^(?:floor|ground|ground[_\s-]*plane|floor[_\s-]*plane)$/i.test(name.trim()))) node.setMesh(null);
  }
}

for (const car of cars.filter((entry) => requested.size === 0 || requested.has(entry.id))) {
  const source = path.join(sourceDir, car.file);
  const exists = await fs.access(source).then(() => true, () => false);
  if (!exists) continue;
  const original = await io.read(source);
  removeGroundPlanes(original);
  const originalTriangles = triangleCount(original);
  for (const [lod, budget, maxTexture, quality, error] of [
    ['hi', car.high, 1024, 84, 0.004],
    ['lo', car.low, 512, 78, 0.025],
  ]) {
    const doc = await io.read(source);
    removeGroundPlanes(doc);
    const before = triangleCount(doc);
    const transforms = [flatten(), weld(), join()];
    if (before > budget) transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error }));
    transforms.push(
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTexture, maxTexture], quality, effort: 5 }),
      prune(),
      dedup(),
    );
    await doc.transform(...transforms);
    const output = Buffer.from(await io.writeBinary(doc));
    const compressed = gzipSync(output, { level: 9 });
    const target = path.join(outputDir, `car_${car.id}_${lod}.glb.gz`);
    await fs.writeFile(target, compressed);
    console.log(`${car.id} ${lod}: ${before.toLocaleString()} -> ${triangleCount(doc).toLocaleString()} tris, ${(compressed.length / 1024).toFixed(0)} KB`);
  }
  console.log(`${car.id} source: ${originalTriangles.toLocaleString()} tris`);
}
