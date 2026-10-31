// Drop stale specular/glossiness declarations from our Bora GLBs when no
// material actually uses that extension. The base PBR materials are intact.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const dir = path.resolve('src/assets');
const extension = 'KHR_materials_pbrSpecularGlossiness';
for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.glb.gz'))) {
  const file = path.join(dir, name), glb = gunzipSync(fs.readFileSync(file));
  if (glb.toString('ascii', 0, 4) !== 'glTF' || glb.readUInt32LE(4) !== 2) continue;
  const jsonLength = glb.readUInt32LE(12), jsonEnd = 20 + jsonLength;
  const json = JSON.parse(glb.toString('utf8', 20, jsonEnd));
  const usesExtension = json.extensionsUsed?.includes(extension) || json.extensionsRequired?.includes(extension);
  const hasPayload = json.materials?.some((material) => material.extensions?.[extension]);
  if (!usesExtension || hasPayload) continue;
  json.extensionsUsed = (json.extensionsUsed || []).filter((value) => value !== extension);
  json.extensionsRequired = (json.extensionsRequired || []).filter((value) => value !== extension);
  const compact = Buffer.from(JSON.stringify(json));
  const paddedLength = (compact.length + 3) & ~3, chunk = Buffer.alloc(paddedLength, 0x20);
  compact.copy(chunk);
  const tail = glb.subarray(jsonEnd), out = Buffer.alloc(20 + paddedLength + tail.length);
  glb.copy(out, 0, 0, 12); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(paddedLength, 12); out.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(out, 20); tail.copy(out, 20 + paddedLength);
  fs.writeFileSync(file, gzipSync(out, { level: 9 }));
  console.log(`Cleaned stale extension declaration: ${name}`);
}
