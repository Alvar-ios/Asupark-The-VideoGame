// Coches 3D preparados con tools/prep-car.mjs: nodo "body" + wheel_FL/FR/RL/RR, materiales originales
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseGlb } from './glbload.js';
export const MODEL = {
  m3: { hi: './assets/car_m3_hi.glb.gz', lo: './assets/car_m3_lo.glb.gz', paint: /^Material$/ },
  qashqai: { hi: './assets/car_qashqai_hi.glb.gz', lo: './assets/car_qashqai_lo.glb.gz', paint: /carpaint/i, paintMat: { metalness: 0.08, roughness: 0.22, envMapIntensity: 0.85, clearcoat: 1, clearcoatRoughness: 0.05 } },
  cupra: { hi: './assets/car_cupra_hi.glb.gz', lo: './assets/car_cupra_lo.glb.gz', paint: /^body$/i, paintMat: { metalness: 0.08, roughness: 0.22, envMapIntensity: 0.85, clearcoat: 1, clearcoatRoughness: 0.05 } },
  golf: { hi: './assets/car_golf_hi.glb.gz', lo: './assets/car_golf_lo.glb.gz', paint: /^vM_CarPaint_Max1$/ },
  mx5: { hi: './assets/car_mx5_hi.glb.gz', lo: './assets/car_mx5_lo.glb.gz', paint: /^Material\.002$/, tails: [[0.5, 0.665, -1.9, 0.3, 0.11]] },
  z240: { hi: './assets/car_z240_hi.glb.gz', lo: './assets/car_z240_lo.glb.gz', paint: /^Material\.001$/ },
  mustang: { hi: './assets/car_mustang_hi.glb.gz', lo: './assets/car_mustang_lo.glb.gz', paint: /^Color_04$/ },
  s4: { hi: './assets/car_s4_hi.glb.gz', lo: './assets/car_s4_lo.glb.gz', paint: /^CarPaint$/ },
  cobra: { hi: './assets/car_cobra_hi.glb.gz', lo: './assets/car_cobra_lo.glb.gz', paint: /^Color_M01$/, doubleSide: true, tyre: [0.255, 0.335, 0.22] },
  stradale: { hi: './assets/car_stradale_hi.glb.gz', lo: './assets/car_stradale_lo.glb.gz', paint: /mi_car_paint_phen2/ },
  slr: { hi: './assets/car_slr_hi.glb.gz', lo: './assets/car_slr_lo.glb.gz', paint: /^1[12]Mtl$/, keepSides: true, paintMat: { metalness: 0.78, roughness: 0.2, envMapIntensity: 1.15, clearcoat: 1, clearcoatRoughness: 0.04, transparent: false, opacity: 1 } },
  minitoon: { hi: './assets/car_minitoon_hi.glb.gz', lo: './assets/car_minitoon_lo.glb.gz', paint: /Bodymat/ },
  gtr: { hi: './assets/car_gtr_hi.glb.gz', lo: './assets/car_gtr_lo.glb.gz', paint: /^bayside_blue$/ },
  f360: { hi: './assets/car_f360_hi.glb.gz', lo: './assets/car_f360_lo.glb.gz', paint: /^AMH7852-CARPAINT$/ },
  aston: { hi: './assets/car_aston_hi.glb.gz', lo: './assets/car_aston_lo.glb.gz', paint: /(?!)/ },
  lotus: { hi: './assets/car_lotus_hi.glb.gz', lo: './assets/car_lotus_lo.glb.gz', paint: /^COOPER$/, length: 3.7 },
  mclaren: { hi: './assets/car_mclaren_hi.glb.gz', lo: './assets/car_mclaren_lo.glb.gz', paint: /(?!)/, length: 3.5, keepSides: true, mats: [[/^(Body21|Chassis1|Meshpart[12])Mtl/, { metalness: 0.4, roughness: 0.28, envMapIntensity: 1.0, colorScale: 1.55 }]] },
  fordgt: { hi: './assets/car_fordgt_hi.glb.gz', lo: './assets/car_fordgt_lo.glb.gz', paint: /(?!)/, length: 4.2 },
  z8: { hi: './assets/car_z8_hi.glb.gz', lo: './assets/car_z8_lo.glb.gz', paint: /(?!)/, length: 4.4 },
  f312t: { hi: './assets/car_f312t_hi.glb.gz', lo: './assets/car_f312t_lo.glb.gz', paint: /(?!)/, length: 3.9 },
  f550: { hi: './assets/car_f550_hi.glb.gz', lo: './assets/car_f550_lo.glb.gz', paint: /(?!)/, length: 4.5 },
  etype: { hi: './assets/car_etype_hi.glb.gz', lo: './assets/car_etype_lo.glb.gz', paint: /(?!)/, length: 4.5, rotation: [0, -Math.PI / 2, 0] },
  xj13: { hi: './assets/car_xj13_hi.glb.gz', lo: './assets/car_xj13_lo.glb.gz', paint: /(?!)/, length: 4.8, rotation: [0, Math.PI, 0] },
  e30: { hi: './assets/car_e30_hi.glb.gz', lo: './assets/car_e30_lo.glb.gz', paint: /(?!)/, length: 4.3, rotation: [0, -Math.PI / 2, 0], keepSides: true, mats: [[/^Body$/, { metalness: 0.05, roughness: 0.3, envMapIntensity: 0.8, color: 0xe7e3d8 }]] },
  r24: { hi: './assets/car_r24_hi.glb.gz', lo: './assets/car_r24_lo.glb.gz', paint: /(?!)/, length: 4.3, rotation: [0, Math.PI, 0] },
  fordgt06: { hi: './assets/car_fordgt06_hi.glb.gz', lo: './assets/car_fordgt06_lo.glb.gz', paint: /(?!)/, length: 4.64 },
  mp423: { hi: './assets/car_mp423_hi.glb.gz', lo: './assets/car_mp423_lo.glb.gz', paint: /(?!)/, length: 4.4 },
  brawngp: { hi: './assets/car_brawngp_hi.glb.gz', lo: './assets/car_brawngp_lo.glb.gz', paint: /(?!)/, length: 4.7 },
  rx7toon: { hi: './assets/car_rx7toon_hi.glb.gz', lo: './assets/car_rx7toon_lo.glb.gz', paint: /(?!)/, length: 4.2, rotation: [0, Math.PI / 2, 0] },
  mp45: { hi: './assets/car_mp45_hi.glb.gz', lo: './assets/car_mp45_lo.glb.gz', paint: /(?!)/, length: 4.1 },
  kart: { hi: './assets/car_kart_hi.glb.gz', lo: './assets/car_kart_lo.glb.gz', paint: /^body_color$/, length: 2.1, kart: true },
  minis: { hi: './assets/car_minis_hi.glb.gz', lo: './assets/car_minis_lo.glb.gz', paint: /^COOPER$/, length: 3.7 },
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

export function buildModelCar(id, color, lod = 'hi', num = 7) {
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
    m.side = m.transparent || cfg.doubleSide || (m.side === THREE.DoubleSide && cfg.keepSides) ? THREE.DoubleSide : THREE.FrontSide;
    o.castShadow = !m.transparent;
    // brillos contenidos: los cromados y plásticos no deben deslumbrar; la pintura lleva laca suave
    m.envMapIntensity = isPaint ? 1.0 : 0.62;
    if (!isPaint && m.isMeshStandardMaterial) { m.metalness = Math.min(m.metalness, 0.8); m.roughness = Math.max(m.roughness, m.metalness > 0.5 ? 0.28 : 0.4); }
    if (isPaint && cfg.kart) { m.color = new THREE.Color(color); m.metalness = 0; m.roughness = 0.55; paints.add(m); }
    else if (isPaint) { m.color = new THREE.Color(color); if (m.map) m.map = null; m.metalness = 0.32; m.roughness = 0.34; if ('clearcoat' in m) { m.clearcoat = 0.7; m.clearcoatRoughness = 0.12; } if (cfg.paintMat) Object.assign(m, cfg.paintMat); paints.add(m); }
  });
  if (cfg.tails) for (const [x, y, z, w, h] of cfg.tails) for (const sd of [-1, 1]) { // pilotos traseros que el modelo no trae (se encienden al frenar)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), tail); lamp.position.set(sd * x, y, z); model.add(lamp);
  }
  if (cfg.mats) model.traverse((o) => { // retoques de materiales concretos (brillo, color)
    if (!o.isMesh) return;
    for (const [re, props] of cfg.mats) if (re.test(o.material.name)) { const { color: c, colorScale: k, ...rest } = props; Object.assign(o.material, rest); if (c != null) o.material.color = new THREE.Color(c); if (k) o.material.color.multiplyScalar(k); o.material.needsUpdate = true; }
  });
  const found = {};
  model.traverse((o) => { const k = /^wheel_(FL|FR|RL|RR)$/.exec(o.name); if (k) found[k[1]] = o; });
  const wheels = [], box = new THREE.Box3(), c = new THREE.Vector3(), tyreMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  for (const k of ['FL', 'FR', 'RL', 'RR']) {
    const w = found[k]; if (!w) continue;
    box.setFromObject(w); box.getCenter(c); orientation.worldToLocal(c);
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.copy(c); orientation.add(pivot); pivot.add(spin); spin.attach(w);
    if (cfg.tyre) { // neumático propio cuando el modelo solo trae la llanta
      const [ri, ro, wd] = cfg.tyre, prof = [[ri, -wd / 2], [ro - 0.03, -wd / 2], [ro, -wd / 2 + 0.03], [ro, wd / 2 - 0.03], [ro - 0.03, wd / 2], [ri, wd / 2]].map(([r, y]) => new THREE.Vector2(r, y));
      const t = new THREE.Mesh(new THREE.LatheGeometry(prof, 24).rotateZ(Math.PI / 2), tyreMat); t.castShadow = true; spin.add(t);
    }
    wheels.push({ pivot, spin, front: k[0] === 'F' });
  }
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 8).rotateX(-Math.PI / 2).translate(s * flameX, flameY, flameZ), fm));
  if (cfg.kart) { // llama pequeña del tubo de escape (se enciende al petardear)
    flames.clear(); const fm2 = new THREE.MeshBasicMaterial({ color: 0xffa530, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 7).rotateX(-Math.PI / 2).translate(0, 0, -0.21), fm2), core = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.24, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.12), new THREE.MeshBasicMaterial({ color: 0xfff3b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flames.add(cone, core); flames.position.set(-0.12, 0.2, -1.02);
  }
  flames.visible = false; tilt.add(flames);
  if (cfg.kart) addKartNumber(orientation, num);
  return { root, tilt, wheels, tail, flames, W, paint: [...paints][0] || { color: new THREE.Color() }, paints };
}

// dorsal del kart: placa blanca con el número en el morro y a cada lado (coordenadas en metros, morro +Z)
const plateCache = {};
function plateTex(n) {
  if (plateCache[n]) return plateCache[n];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#f6f6f2'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#16181d'; x.stroke();
  x.fillStyle = '#16181d'; x.font = `900 ${String(n).length > 1 ? 70 : 88}px Impact,Arial Black,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (plateCache[n] = t);
}
function addKartNumber(parent, n) {
  const m = new THREE.MeshBasicMaterial({ map: plateTex(n), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const d of KART_PLATES) { const nrm = new THREE.Vector3(...d.n).normalize(), q = new THREE.Mesh(new THREE.PlaneGeometry(d.s, d.s), m); q.position.set(...d.p).addScaledVector(nrm, 0.012); q.rotation.set(-Math.asin(nrm.y), Math.atan2(nrm.x, nrm.z), 0, 'YXZ'); parent.add(q); }
}
// justo encima de los dorsales pintados en la textura original (morro y trasera)
const KART_PLATES = [{ p: [0, 0.455, 0.5], n: [0.01, 0.85, 0.44], s: 0.27 }, { p: [0, 0.155, -1.036], n: [0, 0.33, -0.84], s: 0.27 }];
