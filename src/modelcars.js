// Coches 3D preparados con tools/prep-car.mjs: nodo "body" + wheel_FL/FR/RL/RR, materiales originales
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseGlb } from './glbload.js';
export const MODEL = {
  m3: { hi: './assets/car_m3_hi.glb.gz', lo: './assets/car_m3_lo.glb.gz', paint: /^Material$/ },
  qashqai: { hi: './assets/car_qashqai_hi.glb.gz', lo: './assets/car_qashqai_lo.glb.gz', paint: /carpaint/i },
  mini: { hi: './assets/car_mini_hi.glb.gz', lo: './assets/car_mini_lo.glb.gz', paint: /carpaint/i },
  cupra: { hi: './assets/car_cupra_hi.glb.gz', lo: './assets/car_cupra_lo.glb.gz', paint: /^body$/i },
};
const cache = {}, pending = {};
export const modelCarReady = (id, lod = 'hi') => !!(cache[id] && cache[id][lod]);
export function loadModelCar(id, lods = ['hi', 'lo']) {
  const key = id + lods.join();
  if (pending[key]) return pending[key];
  pending[key] = (async () => {
    cache[id] = cache[id] || {};
    for (const l of lods) {
      if (cache[id][l]) continue;
      const g = await parseGlb(MODEL[id][l]);
      g.scene.traverse((o) => { if (!o.isMesh) return; try { const n = toCreasedNormals(o.geometry, Math.PI / 4); o.geometry.dispose(); o.geometry = n; } catch (e) { o.geometry.computeVertexNormals(); } });
      cache[id][l] = g.scene;
    }
  })();
  return pending[key];
}

export function buildModelCar(id, color, lod = 'hi') {
  const src = cache[id][lod] || cache[id].lo || cache[id].hi, cfg = MODEL[id];
  const model = src.clone(true);
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt); tilt.add(model);
  root.updateMatrixWorld(true);
  const paints = new Set(), tail = new THREE.MeshBasicMaterial({ color: 0x8a0f0f });
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone(); o.material = m;
    m.envMapIntensity = 1.15; m.side = m.transparent ? THREE.DoubleSide : THREE.FrontSide;
    o.castShadow = !m.transparent;
    if (cfg.paint.test(m.name)) { m.color = new THREE.Color(color); m.metalness = Math.max(m.metalness, 0.35); m.roughness = Math.min(m.roughness, 0.3); m.envMapIntensity = 1.3; paints.add(m); }
  });
  const found = {};
  model.traverse((o) => { const k = /^wheel_(FL|FR|RL|RR)$/.exec(o.name); if (k) found[k[1]] = o; });
  const wheels = [], box = new THREE.Box3(), c = new THREE.Vector3();
  for (const k of ['FL', 'FR', 'RL', 'RR']) {
    const w = found[k]; if (!w) continue;
    box.setFromObject(w); box.getCenter(c); tilt.worldToLocal(c);
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.copy(c); tilt.add(pivot); pivot.add(spin); spin.attach(w);
    wheels.push({ pivot, spin, front: k[0] === 'F' });
  }
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.4, 8).rotateX(-Math.PI / 2).translate(s * 0.5, 0.45, -3.0), fm));
  flames.visible = false; tilt.add(flames);
  return { root, tilt, wheels, tail, flames, W: 1.8, paint: [...paints][0] || { color: new THREE.Color() }, paints };
}
