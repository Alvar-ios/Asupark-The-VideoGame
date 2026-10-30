// Volkswagen Bora VR6 (modelo .glb optimizado): carrocería + ruedas con neumáticos propios
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import bodyHi from './assets/bora_body_hi.glb';
import bodyLo from './assets/bora_body_lo.glb';
import wheelHi from './assets/bora_wheel_hi.glb';
import wheelLo from './assets/bora_wheel_lo.glb';

const cache = { ready: false };
export const boraReady = () => cache.ready;
export async function loadBora() {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const [bh, bl, wh, wl] = await Promise.all([bodyHi, bodyLo, wheelHi, wheelLo].map((u) => loader.loadAsync(u)));
  // normales suaves con aristas marcadas (la decimación las deja irregulares)
  for (const sc of [bh.scene, bl.scene, wh.scene, wl.scene]) sc.traverse((o) => {
    if (!o.isMesh) return;
    try { const g = toCreasedNormals(o.geometry, Math.PI / 4.2); o.geometry.dispose(); o.geometry = g; } catch (e) { o.geometry.computeVertexNormals(); }
  });
  cache.hi = { body: bh.scene, wheel: wh.scene }; cache.lo = { body: bl.scene, wheel: wl.scene };
  // perfil del neumático (revolución alrededor del eje X)
  const prof = [[0.205, -0.1], [0.262, -0.112], [0.292, -0.085], [0.298, -0.04], [0.298, 0.04], [0.292, 0.085], [0.262, 0.112], [0.205, 0.1]].map(([r, y]) => new THREE.Vector2(r, y));
  cache.tire = new THREE.LatheGeometry(prof, 22).rotateZ(Math.PI / 2);
  cache.ready = true;
}
export const BORA_WHEELS = [[0.769, 0.294, 1.345, true], [-0.769, 0.294, 1.345, true], [0.784, 0.294, -1.314, false], [-0.784, 0.294, -1.314, false]];

export function buildBora(color, lod = 'hi') {
  const src = cache[lod] || cache.hi, hi = lod === 'hi';
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const paintOpts = { color, metalness: 0.32, roughness: 0.3, envMapIntensity: 1.0 };
  const mats = {
    PAINT: hi ? new THREE.MeshPhysicalMaterial({ ...paintOpts, clearcoat: 1, clearcoatRoughness: 0.08 }) : new THREE.MeshStandardMaterial(paintOpts),
    CHROME: new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 1, roughness: 0.14, envMapIntensity: 1.2 }),
    GLASS: new THREE.MeshStandardMaterial({ color: 0x04070b, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.7 }),
    LENS: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.5 }),
    UNDER: new THREE.MeshLambertMaterial({ color: 0x111215 }),
    BLACK: new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.55, metalness: 0.1 }),
    SIGNAL: new THREE.MeshBasicMaterial({ color: 0xff8a00 }),
    TAIL: new THREE.MeshBasicMaterial({ color: 0x8a0f0f }),
    REVERSE: new THREE.MeshBasicMaterial({ color: 0xdddddd }),
    HEAD: new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
    RIM: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 }),
  };
  const apply = (obj) => obj.traverse((o) => { if (o.isMesh) { const m = mats[o.material.name] || mats.UNDER; o.material = m; o.castShadow = o.material !== mats.LENS; } });
  const body = src.body.clone(true); apply(body); tilt.add(body);
  const tire = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.85, metalness: 0 });
  const wheels = [];
  for (const [x, y, z, front] of BORA_WHEELS) {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.set(x, y, z); tilt.add(pivot); pivot.add(spin);
    const rim = src.wheel.clone(true); apply(rim); if (x < 0) rim.rotation.y = Math.PI; spin.add(rim);
    const t = new THREE.Mesh(cache.tire, tire); t.castShadow = true; spin.add(t);
    spin.scale.setScalar(1.1); // ruedas algo más grandes: toque de juguete
    wheels.push({ pivot, spin, front });
  }
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.5, 8).rotateX(-Math.PI / 2).translate(s * 0.5, 0.4, -3.1), fm));
  flames.visible = false; tilt.add(flames);
  return { root, tilt, wheels, tail: mats.TAIL, flames, W: 1.8, paint: mats.PAINT };
}
