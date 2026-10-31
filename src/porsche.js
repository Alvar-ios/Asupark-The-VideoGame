// Porsche 911 (964) Turbo S: modelo con texturas originales; ruedas independientes que giran y se orientan
import * as THREE from 'three';
import { parseGlb } from './glbload.js';
const cache = { ready: false };
const src = { hi: './assets/porsche_hi.glb.gz', lo: './assets/porsche_lo.glb.gz' };
export const porscheReady = (lod) => lod ? !!cache[lod] : cache.ready;
export async function loadPorsche(lods = ['hi', 'lo']) {
  for (const l of lods) cache[l] = (await parseGlb(src[l])).scene;
  cache.ready = true;
}
const WHEEL_NAMES = { '3DWheel Front L': 'FL', '3DWheel Front R': 'FR', '3DWheel Rear L': 'RL', '3DWheel Rear R': 'RR' };

export function buildPorsche(color, lod = 'hi') {
  const src = cache[lod] || cache.hi || cache.lo;
  const model = src.clone(true);
  model.scale.multiplyScalar(100); // el archivo viene en centímetros/100
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt); tilt.add(model);
  root.updateMatrixWorld(true);
  const paintMats = new Set();
  const tail = new THREE.MeshBasicMaterial({ color: 0x8a0f0f });
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !(o.material.transparent);
    const m = o.material.clone(); o.material = m;
    m.envMapIntensity = 1.2;
    if (/Porsche_964_Turbo_Base1/.test(m.name)) { m.color = new THREE.Color(color); m.envMapIntensity = 1.35; paintMats.add(m); }
  });
  // ruedas: sacar los 4 grupos y colgarlos de un pivote en el centro de cada rueda
  const found = {};
  model.traverse((o) => { if (WHEEL_NAMES[o.name]) found[WHEEL_NAMES[o.name]] = o; });
  const wheels = [];
  for (const k of ['FL', 'FR', 'RL', 'RR']) {
    const w = found[k]; if (!w) continue;
    const wp = new THREE.Vector3(); w.getWorldPosition(wp); tilt.worldToLocal(wp);
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.copy(wp); tilt.add(pivot); pivot.add(spin);
    spin.attach(w); w.position.set(0, 0, 0); // conserva su orientación (las del lado derecho van espejadas)
    wheels.push({ pivot, spin, front: k[0] === 'F' });
  }
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.4, 8).rotateX(-Math.PI / 2).translate(s * 0.45, 0.45, -2.9), fm));
  flames.visible = false; tilt.add(flames);
  return { root, tilt, wheels, tail, flames, W: 1.8, paint: [...paintMats][0] || { color: new THREE.Color() }, paints: paintMats };
}
