// Coches 3D preparados con tools/prep-car.mjs: nodo "body" + wheel_FL/FR/RL/RR, materiales originales
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseGlb } from './glbload.js';
export const MODEL = {
  m3: { hi: './assets/car_m3_hi.glb.gz', lo: './assets/car_m3_lo.glb.gz', paint: /^Material$/ },
  qashqai: { hi: './assets/car_qashqai_hi.glb.gz', lo: './assets/car_qashqai_lo.glb.gz', paint: /carpaint/i },
  mini: { hi: './assets/car_mini_hi.glb.gz', lo: './assets/car_mini_lo.glb.gz', paint: /carpaint/i },
  cupra: { hi: './assets/car_cupra_hi.glb.gz', lo: './assets/car_cupra_lo.glb.gz', paint: /^body$/i },
  golf: { hi: './assets/car_golf_hi.glb.gz', lo: './assets/car_golf_lo.glb.gz', paint: /^vM_CarPaint_Max1$/ },
  mx5: { hi: './assets/car_mx5_hi.glb.gz', lo: './assets/car_mx5_lo.glb.gz', paint: /^Material\.002$/ },
  z240: { hi: './assets/car_z240_hi.glb.gz', lo: './assets/car_z240_lo.glb.gz', paint: /^Material\.001$/ },
  mustang: { hi: './assets/car_mustang_hi.glb.gz', lo: './assets/car_mustang_lo.glb.gz', paint: /^Color_04$/ },
  s4: { hi: './assets/car_s4_hi.glb.gz', lo: './assets/car_s4_lo.glb.gz', paint: /^CarPaint$/ },
  cobra: { hi: './assets/car_cobra_hi.glb.gz', lo: './assets/car_cobra_lo.glb.gz', paint: /^Color_M01$/ },
  stradale: { hi: './assets/car_stradale_hi.glb.gz', lo: './assets/car_stradale_lo.glb.gz', paint: /mi_car_paint_phen2/ },
  slr: { hi: './assets/car_slr_hi.glb.gz', lo: './assets/car_slr_lo.glb.gz', paint: /^1[12]Mtl$/ },
  minitoon: { hi: './assets/car_minitoon_hi.glb.gz', lo: './assets/car_minitoon_lo.glb.gz', paint: /Bodymat/ },
  gtr: { hi: './assets/car_gtr_hi.glb.gz', lo: './assets/car_gtr_lo.glb.gz', paint: /^bayside_blue$/ },
  f360: { hi: './assets/car_f360_hi.glb.gz', lo: './assets/car_f360_lo.glb.gz', paint: /^AMH7852-CARPAINT$/ },
  aston: { hi: './assets/car_aston_hi.glb.gz', lo: './assets/car_aston_lo.glb.gz', paint: /(?!)/ },
  lotus: { hi: './assets/car_lotus_hi.glb.gz', lo: './assets/car_lotus_lo.glb.gz', paint: /(?!)/ },
  mclaren: { hi: './assets/car_mclaren_hi.glb.gz', lo: './assets/car_mclaren_lo.glb.gz', paint: /(?!)/ },
  fordgt: { hi: './assets/car_fordgt_hi.glb.gz', lo: './assets/car_fordgt_lo.glb.gz', paint: /(?!)/, length: 4.7 },
  z8: { hi: './assets/car_z8_hi.glb.gz', lo: './assets/car_z8_lo.glb.gz', paint: /(?!)/, length: 4.4 },
  f312t: { hi: './assets/car_f312t_hi.glb.gz', lo: './assets/car_f312t_lo.glb.gz', paint: /(?!)/, length: 4.4 },
  f550: { hi: './assets/car_f550_hi.glb.gz', lo: './assets/car_f550_lo.glb.gz', paint: /(?!)/, length: 4.5 },
  etype: { hi: './assets/car_etype_hi.glb.gz', lo: './assets/car_etype_lo.glb.gz', paint: /(?!)/, length: 4.5, rotation: [0, Math.PI / 2, 0] },
  xj13: { hi: './assets/car_xj13_hi.glb.gz', lo: './assets/car_xj13_lo.glb.gz', paint: /(?!)/, length: 4.8, rotation: [0, Math.PI, 0] },
  e30: { hi: './assets/car_e30_hi.glb.gz', lo: './assets/car_e30_lo.glb.gz', paint: /(?!)/, length: 4.3, rotation: [0, Math.PI / 2, 0] },
  r24: { hi: './assets/car_r24_hi.glb.gz', lo: './assets/car_r24_lo.glb.gz', paint: /(?!)/, length: 4.65 },
  fordgt06: { hi: './assets/car_fordgt06_hi.glb.gz', lo: './assets/car_fordgt06_lo.glb.gz', paint: /(?!)/, length: 4.64 },
  mp423: { hi: './assets/car_mp423_hi.glb.gz', lo: './assets/car_mp423_lo.glb.gz', paint: /(?!)/, length: 4.8 },
  brawngp: { hi: './assets/car_brawngp_hi.glb.gz', lo: './assets/car_brawngp_lo.glb.gz', paint: /(?!)/, length: 4.7 },
  rx7toon: { hi: './assets/car_rx7toon_hi.glb.gz', lo: './assets/car_rx7toon_lo.glb.gz', paint: /(?!)/, length: 4.2, rotation: [0, -Math.PI / 2, 0] },
  mp45: { hi: './assets/car_mp45_hi.glb.gz', lo: './assets/car_mp45_lo.glb.gz', paint: /(?!)/, length: 4.5 },
  minis: { hi: './assets/car_minis_hi.glb.gz', lo: './assets/car_minis_lo.glb.gz', paint: /(?!)/, length: 3.7, rotation: [0, Math.PI, 0] },
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
  const root = new THREE.Group(), tilt = new THREE.Group(), orientation = new THREE.Group();
  root.add(tilt); tilt.add(orientation); orientation.add(model);
  if (cfg.rotation) orientation.rotation.set(...cfg.rotation);
  root.updateMatrixWorld(true);
  let W = 1.8, H = 1.2, L = cfg.length || 4.5;
  let flameX = 0.45, flameY = 0.42, flameZ = -L * 0.5 - 0.7;
  if (cfg.length) {
    const bounds = new THREE.Box3().setFromObject(orientation), size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.z) || size.z <= 0) throw new Error(`El modelo ${id} no tiene una longitud válida`);
    const fit = cfg.length / size.z, center = bounds.getCenter(new THREE.Vector3());
    orientation.scale.setScalar(fit);
    orientation.position.set(-center.x * fit, -bounds.min.y * fit, -center.z * fit);
    root.updateMatrixWorld(true);
    W = size.x * fit;
    H = size.y * fit;
    flameX = Math.min(0.48, W * 0.23);
    flameY = Math.max(0.24, Math.min(0.48, H * 0.32));
    flameZ = -cfg.length * 0.5 - 0.7;
  } else {
    const bounds = new THREE.Box3().setFromObject(orientation), size = bounds.getSize(new THREE.Vector3());
    if (Number.isFinite(size.z) && size.z > 0) {
      W = size.x;
      H = size.y;
      L = size.z;
      flameX = Math.min(0.48, W * 0.23);
      flameY = Math.max(0.24, Math.min(0.48, H * 0.32));
      flameZ = -L * 0.5 - 0.7;
    }
  }
  const paints = new Set(), tail = new THREE.MeshBasicMaterial({ color: 0x8a0f0f });
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone(); o.material = m;
    const isPaint = cfg.paint.test(m.name);
    m.side = m.transparent ? THREE.DoubleSide : THREE.FrontSide;
    o.castShadow = !m.transparent;
    // brillos contenidos: los cromados y plásticos no deben deslumbrar; la pintura lleva laca suave
    m.envMapIntensity = isPaint ? 1.0 : 0.62;
    if (!isPaint && m.isMeshStandardMaterial) { m.metalness = Math.min(m.metalness, 0.8); m.roughness = Math.max(m.roughness, m.metalness > 0.5 ? 0.28 : 0.4); }
    if (isPaint) { m.color = new THREE.Color(color); if (m.map) m.map = null; m.metalness = 0.32; m.roughness = 0.34; if ('clearcoat' in m) { m.clearcoat = 0.7; m.clearcoatRoughness = 0.12; } paints.add(m); }
  });
  const found = {};
  model.traverse((o) => { const k = /^wheel_(FL|FR|RL|RR)$/.exec(o.name); if (k) found[k[1]] = o; });
  const wheels = [], box = new THREE.Box3(), c = new THREE.Vector3();
  for (const k of ['FL', 'FR', 'RL', 'RR']) {
    const w = found[k]; if (!w) continue;
    box.setFromObject(w); box.getCenter(c); orientation.worldToLocal(c);
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.copy(c); orientation.add(pivot); pivot.add(spin); spin.attach(w);
    wheels.push({ pivot, spin, front: k[0] === 'F' });
  }
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 8).rotateX(-Math.PI / 2).translate(s * flameX, flameY, flameZ), fm));
  flames.visible = false; tilt.add(flames);
  return { root, tilt, wheels, tail, flames, W, paint: [...paints][0] || { color: new THREE.Color() }, paints };
}
