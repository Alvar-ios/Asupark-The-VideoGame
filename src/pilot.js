// Piloto propio, hecho por piezas: mono, guantes, botas y casco se cambian por separado. Brazos y piernas se
// doblan solos hasta el volante y los pedales de cada kart (ver PILOT_FIT), y se anima con la conducción.
// Medidas en metros dentro del kart: morro +Z, izquierda +X, suelo en y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_DATA } from './skins-data.js';

// dónde va el piloto en cada kart: cadera, centro y radio del volante, inclinación del aro y apoyo de los pies.
// `cockpit`: la carrocería tapa las piernas, así que no se dibujan.
const FIT = {
  kart: { hip: [0, 0.215, -0.24], wheel: [0, 0.49, 0.17], r: 0.13, tilt: 0.6, foot: [0.19, 0.19, 0.6] },
  pizza: { hip: [0, 0.225, -0.24], wheel: [0, 0.525, 0.15], r: 0.12, tilt: 0.6, foot: [0.19, 0.2, 0.58] },
  estandar: { hip: [0, 0.285, -0.22], wheel: [0, 0.475, 0.11], r: 0.15, tilt: 0.55, foot: [0.165, 0.22, 0.38], size: 0.8, crouch: 0.34 },
  caramelo1: { hip: [0, 0.24, -0.2], wheel: [0, 0.47, 0.11], r: 0.085, tilt: 0.6, cockpit: true, size: 0.84, crouch: 0.24 },
  caramelo2: { hip: [0, 0.15, -0.2], wheel: [0, 0.36, 0.1], r: 0.075, tilt: 0.6, cockpit: true, size: 0.76, crouch: 0.34 },
  caramelo3: { hip: [0, 0.17, -0.16], wheel: [0, 0.39, 0.13], r: 0.08, tilt: 0.6, cockpit: true, size: 0.78, crouch: 0.32 },
  caramelo4: { hip: [0, 0.255, -0.2], wheel: [0, 0.48, 0.11], r: 0.085, tilt: 0.6, cockpit: true, size: 0.84, crouch: 0.24 },
  caramelo5: { hip: [0, 0.4, -0.12], wheel: [0, 0.63, 0.17], r: 0.085, tilt: 0.6, cockpit: true, size: 0.84, crouch: 0.2 },
};
export function pilotFit(skin) {
  if (!skin) return FIT.kart;
  const base = FIT[skin] || (skin.startsWith('pizza') ? FIT.pizza : FIT.kart);
  const st = SKIN_DATA[skin] && SKIN_DATA[skin].parts.steer; // si el modelo trae el volante suelto, manda su sitio
  return st ? { ...base, wheel: st.c } : base;
}
export const STEER_TURN = 1.15; // radianes de volante a tope
export const steerAxis = (tilt) => new THREE.Vector3(0, Math.sin(tilt), -Math.cos(tilt)); // perpendicular al aro, hacia el piloto

export const SUIT_DEFAULT = { main: '2b303a', accent: 'ffc400', extra: '121317' };

const hex = (h) => '#' + h;
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// casco: la misma «base|dibujo|visera|patrón» del perfil, pintada sobre la esfera (el frente cae en u = 0,25)
const helmetCache = new Map();
function helmetTex(code) {
  if (helmetCache.has(code)) return helmetCache.get(code);
  const m = /^([0-9a-f]{6})\|([0-9a-f]{6})\|([0-9a-f]{6})\|([0-9])$/i.exec(code) || [null, 'ffc400', '111827', '111827', '1'];
  const [, base, ink, , pat] = m;
  const t = canvasTex(512, 256, (x) => {
    x.fillStyle = hex(base); x.fillRect(0, 0, 512, 256); x.fillStyle = hex(ink);
    const sides = (draw) => { for (const [cx, dir] of [[256, -1], [0, 1], [512, 1]]) { x.save(); x.translate(cx, 130); x.scale(dir, 1); draw(); x.restore(); } };
    const star = (r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.42 : r; x.lineTo(Math.cos(a) * k, Math.sin(a) * k); } x.fill(); };
    if (+pat === 1) for (const cx of [128, 384]) x.fillRect(cx - 26, 0, 52, 256);
    else if (+pat === 2) { x.fillRect(0, 150, 512, 22); x.fillRect(0, 62, 512, 12); }
    else if (+pat === 3) sides(() => { x.beginPath(); x.moveTo(-58, -80); x.lineTo(-18, -80); x.lineTo(46, 70); x.lineTo(6, 70); x.fill(); });
    else if (+pat === 4) for (let i = 0; i < 32; i++) for (let j = 0; j < 3; j++) { if ((i + j) % 2 === 0) x.fillRect(i * 16, 68 + j * 16, 16, 16); }
    else if (+pat === 5) sides(() => { x.beginPath(); x.moveTo(-62, 40); x.quadraticCurveTo(-10, 46, 4, 20); x.quadraticCurveTo(10, 34, 60, 18); x.quadraticCurveTo(26, 6, 34, -8); x.quadraticCurveTo(16, 0, 62, -34); x.quadraticCurveTo(2, -22, -4, -4); x.quadraticCurveTo(-14, -30, 10, -56); x.quadraticCurveTo(-54, -34, -62, 40); x.fill(); });
    else if (+pat === 6) sides(() => { x.beginPath(); [[38, -70], [-30, 6], [0, 6], [-40, 74], [52, -12], [20, -12], [60, -70]].forEach(([a, b]) => x.lineTo(a, b)); x.fill(); });
    else if (+pat === 7) x.fillRect(128, 0, 256, 256);
    else if (+pat === 8) { sides(() => star(40)); x.fillRect(0, 168, 512, 16); }
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 214, 512, 42); // faldón inferior
  });
  helmetCache.set(code, t); return t;
}

const suitCache = new Map();
function suitTex(s) {
  const key = s.main + s.accent + (s.style || '');
  if (suitCache.has(key)) return suitCache.get(key);
  // torso: u da la vuelta al cuerpo (frente en 0,25 del lienzo girado) y v sube de la cadera a los hombros
  const t = canvasTex(256, 256, (x) => {
    x.fillStyle = hex(s.main); x.fillRect(0, 0, 256, 256);
    x.fillStyle = hex(s.accent);
    for (const u of [0, 128, 256]) x.fillRect(u - 11, 0, 22, 256); // franjas de los costados
    x.fillRect(0, 74, 256, 20); x.fillRect(0, 104, 256, 5);
    if (s.style === 'flames') { x.beginPath(); x.moveTo(0, 256); for (let i = 0; i <= 16; i++) { x.lineTo(i * 16 - 8, 150 + (i % 2) * 34); x.lineTo(i * 16, 214); } x.lineTo(256, 256); x.fill(); }
    x.fillStyle = hex(s.extra || '121317'); x.fillRect(0, 236, 256, 20); // cinturón
    x.fillStyle = 'rgba(0,0,0,.28)'; for (const u of [32, 96, 160, 224]) x.fillRect(u, 0, 2, 256);
    x.fillStyle = 'rgba(255,255,255,.22)'; for (const u of [34, 98, 162, 226]) for (let y = 4; y < 256; y += 8) x.fillRect(u, y, 1, 4); // pespuntes
    x.fillStyle = 'rgba(0,0,0,.5)'; for (const u of [64, 192]) x.fillRect(u - 1, 0, 3, 236); x.fillStyle = '#c9ced8'; for (const u of [64, 192]) x.fillRect(u - 3, 62, 7, 9); // cremallera
    for (let i = 0; i < 2600; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; x.fillRect((i * 97) % 256, (i * 57 + (i >> 4)) % 256, 2, 2); } // trama
  });
  suitCache.set(key, t); return t;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

// junta en una sola malla las piezas rígidas de un grupo que comparten material (menos órdenes de dibujo)
function builder() {
  const bins = new Map();
  return {
    add(group, mat, geo, { p, r, s } = {}) {
      if (s) geo.scale(...s);
      if (r) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r)));
      if (p) geo.translate(...p);
      const byMat = bins.get(group) || bins.set(group, new Map()).get(group);
      (byMat.get(mat) || byMat.set(mat, []).get(mat)).push(geo);
    },
    flush() {
      for (const [group, byMat] of bins) for (const [mat, list] of byMat) {
        const m = new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], mat); m.castShadow = true; group.add(m);
        if (list.length > 1) list.forEach((g) => g.dispose());
      }
    },
  };
}

// tramo de brazo o pierna: más grueso arriba que abajo, con algo de volumen en medio y puntas redondeadas
function tapered(r0, rm, r1, len) {
  const h = len / 2, pts = [[0.001, -h - r0 * 0.75], [r0 * 0.7, -h - r0 * 0.52], [r0, -h], [(r0 + rm) / 2, -h * 0.65], [rm, -h * 0.2], [(rm + r1) / 2, h * 0.35], [r1, h], [r1 * 0.7, h + r1 * 0.52], [0.001, h + r1 * 0.75]];
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14);
}

// brazo o pierna: dos tramos de longitud fija entre el hombro (o cadera) y la mano (o pie); `pole` dice hacia dónde dobla
function limb(parent, mat, radii, lenUp, lenLow) {
  const seg = (r, len) => { const m = new THREE.Mesh(tapered(r[0], r[1], r[2], len), mat); m.castShadow = true; parent.add(m); return m; };
  const up = seg(radii[0], lenUp), low = seg(radii[1], lenLow);
  const place = (m, a, b) => { m.position.copy(a).add(b).multiplyScalar(0.5); tmpD.copy(b).sub(a).normalize(); m.quaternion.setFromUnitVectors(UP, tmpD); };
  const elbow = new THREE.Vector3(), end = new THREE.Vector3();
  return (from, to, pole) => {
    const dir = tmpA.copy(to).sub(from), d = Math.min(dir.length(), lenUp + lenLow - 1e-3); dir.normalize();
    end.copy(from).addScaledVector(dir, d);
    const a = (lenUp * lenUp - lenLow * lenLow + d * d) / (2 * d), h = Math.sqrt(Math.max(0, lenUp * lenUp - a * a));
    const side = tmpB.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    elbow.copy(from).addScaledVector(dir, a).addScaledVector(side, h);
    place(up, from, elbow); place(low, elbow, end);
    return end;
  };
}

// forma de casco integral a partir de una esfera: mentonera adelantada, laterales recogidos abajo y base plana
const HR = 0.128;
function helmetShape(geo) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = v.length() || 1, y = v.y / r, z = v.z / r, low = Math.max(0, -y - 0.12);
    if (z > 0) v.z *= 1.07 + low * 0.34 * z; else v.z *= 1.1 - low * 0.42; // morro del casco y nuca recogida
    v.x *= 0.98 - low * 0.16;
    v.y *= y > 0 ? 1.0 - Math.max(0, z) * 0.04 : 1.04;
    const floor = -HR * (0.86 - Math.max(0, z) * 0.06); if (v.y < floor) v.y = floor + (v.y - floor) * 0.14;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // la esfera tiene una costura: se igualan las normales de los vértices repetidos para que no se marque
  const n = geo.attributes.normal, seen = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4); const j = seen.get(k); if (j == null) { seen.set(k, i); continue; } a.fromBufferAttribute(n, i).add(b.fromBufferAttribute(n, j)).normalize(); n.setXYZ(i, a.x, a.y, a.z); n.setXYZ(j, a.x, a.y, a.z); }
  return geo;
}
// franja de la superficie del casco: `grow` la separa de la carcasa, `wide` es media anchura en radianes
const helmetPatch = (grow, wide, top, height) => helmetShape(new THREE.SphereGeometry(HR + grow, 36, 8, Math.PI / 2 - wide, wide * 2, top, height));
// borde redondeado que sigue la curva del casco a una altura (para enmarcar la visera)
function helmetRim(theta, wide, thick) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const phi = Math.PI / 2 - wide + (wide * 2 * i) / 24; pts.push(new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(HR + 0.003)); }
  const tmp = new THREE.BufferGeometry().setFromPoints(pts); helmetShape(tmp);
  const shaped = pts.map((_, i) => new THREE.Vector3().fromBufferAttribute(tmp.attributes.position, i)); tmp.dispose();
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shaped), 36, thick, 6, false);
}

let visorMap = null;
function visorTex() {
  if (visorMap) return visorMap;
  return (visorMap = canvasTex(256, 64, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#b9bdc6'); g.addColorStop(1, '#5d616b'); x.fillStyle = g; x.fillRect(0, 0, 256, 64);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.moveTo(52, 6); x.lineTo(96, 6); x.lineTo(64, 40); x.lineTo(44, 40); x.fill(); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(108, 6, 10, 18); // reflejo
  }));
}

// guante cerrado sobre el aro. Ejes: X hacia fuera del volante, Y a lo largo del aro, Z hacia el piloto
function glove(b, group, gear, trim) {
  b.add(group, gear, new THREE.CapsuleGeometry(0.024, 0.034, 4, 10), { s: [0.95, 1, 0.8], p: [0.004, 0, 0.027] }); // palma
  for (let k = 0; k < 4; k++) { const finger = new THREE.TorusGeometry(0.022, 0.0088, 7, 12, Math.PI * 1.25); finger.rotateZ(-Math.PI * 0.66); b.add(group, gear, finger, { r: [Math.PI / 2, 0, 0], p: [0, -0.024 + k * 0.016, 0] }); }
  b.add(group, gear, new THREE.CapsuleGeometry(0.0095, 0.03, 4, 8), { r: [0, 0, -0.55], p: [-0.022, 0.018, 0.016] }); // pulgar
  b.add(group, trim, new THREE.BoxGeometry(0.014, 0.058, 0.012), { r: [0, 0.7, 0], p: [0.022, 0, 0.034] }); // protección de nudillos
}

// helmet: «base|dibujo|visera|patrón»; suit: { main, accent, extra, style, metal }; fit: pilotFit(skin)
export function buildPilot({ helmet, suit = SUIT_DEFAULT, fit = FIT.kart }) {
  const root = new THREE.Group(); root.name = 'pilot';
  const metal = suit.metal ? { metalness: 0.75, roughness: 0.32 } : { metalness: 0, roughness: 0.8 };
  const cloth = new THREE.MeshStandardMaterial({ color: hex(suit.main), ...metal });
  const chest = new THREE.MeshStandardMaterial({ map: suitTex(suit), ...metal });
  const trim = new THREE.MeshStandardMaterial({ color: hex(suit.accent), ...metal });
  const gear = new THREE.MeshStandardMaterial({ color: hex(suit.extra || '121317'), roughness: 0.55, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.45, metalness: 0.2 });
  const parts = String(helmet).split('|');
  const visorColor = parts[2] || '111827', inkColor = parts[1] || '111827';
  const shell = new THREE.MeshStandardMaterial({ map: helmetTex(String(helmet)), roughness: 0.2, metalness: 0.14, envMapIntensity: 1.15 });
  const wing = new THREE.MeshStandardMaterial({ color: hex(inkColor), roughness: 0.22, metalness: 0.14, envMapIntensity: 1.15 });
  const visor = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex(visorColor)).lerp(new THREE.Color(0x35507a), 0.35), map: visorTex(), roughness: 0.05, metalness: 0.9, envMapIntensity: 1.9 });
  const materials = [cloth, chest, trim, gear, dark, shell, wing, visor];
  const b = builder();

  // en los karts pequeños el piloto se encoge desde la cadera: sus puntos de apoyo se pasan a su propia escala
  const size = fit.size || 1, crouch = fit.crouch || 0;
  const hip = new THREE.Vector3(...fit.hip);
  root.scale.setScalar(size); root.position.copy(hip).multiplyScalar(1 - size);
  const local = (v) => new THREE.Vector3(...v).sub(hip).multiplyScalar(1 / size).add(hip);
  const wheelR = fit.r / size;
  const torso = new THREE.Group(); torso.position.copy(hip); root.add(torso);
  const RECLINE = -0.2 + crouch; // agazapado: el tronco se echa hacia delante

  // tronco: cintura estrecha, pecho adelantado y espalda más recta
  const profile = [[0.001, -0.025], [0.1, -0.012], [0.108, 0.03], [0.1, 0.1], [0.116, 0.18], [0.138, 0.255], [0.146, 0.3], [0.13, 0.345], [0.092, 0.372], [0.05, 0.39], [0.001, 0.392]].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 28); bodyGeo.rotateY(-Math.PI / 2);
  { const p = bodyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i), upper = Math.max(0, Math.min(1, (y - 0.12) / 0.2)); p.setXYZ(i, p.getX(i) * (1.04 + upper * 0.13), y, z > 0 ? z * (0.76 + upper * 0.08) : z * 0.68); } bodyGeo.computeVertexNormals(); }
  b.add(torso, chest, bodyGeo);
  b.add(torso, cloth, new THREE.SphereGeometry(0.112, 18, 12), { s: [1.1, 0.66, 0.9], p: [0, 0.004, 0] }); // caderas
  for (const side of [-1, 1]) {
    b.add(torso, cloth, new THREE.SphereGeometry(0.062, 16, 12), { s: [1.05, 0.82, 0.92], p: [side * 0.145, 0.303, 0] }); // hombro
    b.add(torso, trim, new THREE.CapsuleGeometry(0.012, 0.062, 4, 8), { r: [0, 0, side * 1.16], p: [side * 0.118, 0.357, 0.012] }); // hombrera cosida
  }
  // peto de costillas de karting, con sus correas
  const vest = new THREE.CylinderGeometry(0.128, 0.114, 0.12, 28, 3, true);
  b.add(torso, dark, vest, { s: [1.1, 1, 0.8], p: [0, 0.135, 0.002] });
  for (const y of [0.1, 0.17]) b.add(torso, trim, new THREE.TorusGeometry(0.122 + (y - 0.1) * 0.14, 0.0045, 6, 36), { r: [Math.PI / 2, 0, 0], s: [1.1, 1, 0.82], p: [0, y, 0.002] });
  b.add(torso, gear, new THREE.TorusGeometry(0.105, 0.013, 8, 36), { r: [Math.PI / 2, 0, 0], s: [1.06, 1, 0.84], p: [0, 0.012, 0] }); // cinturón
  // collarín: abierto por delante
  const collar = new THREE.TorusGeometry(0.074, 0.024, 10, 28, Math.PI * 1.6); collar.rotateZ(Math.PI / 2 + Math.PI * 0.2);
  b.add(torso, gear, collar, { r: [Math.PI / 2 + 0.12, 0, 0], p: [0, 0.382, 0.004] });
  b.add(torso, dark, new THREE.CylinderGeometry(0.042, 0.05, 0.075, 16), { p: [0, 0.405, 0.006] }); // cuello

  const neck = new THREE.Group(); neck.position.set(0, 0.43 - crouch * 0.07, 0.01 + crouch * 0.05); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.088 - crouch * 0.06, 0.012 + crouch * 0.03); neck.add(head);
  head.scale.setScalar(0.93);
  b.add(head, shell, helmetShape(new THREE.SphereGeometry(HR, 48, 36)));
  b.add(head, visor, helmetPatch(0.0028, 1.1, 1.16, 0.5));
  b.add(head, dark, helmetRim(1.15, 1.15, 0.0052));
  b.add(head, dark, helmetRim(1.67, 1.15, 0.0052));
  for (const side of [-1, 1]) {
    b.add(head, dark, new THREE.CylinderGeometry(0.021, 0.021, 0.013, 16), { r: [0, 0, Math.PI / 2], p: [side * 0.122, 0.004, 0.036] }); // eje de la visera
    b.add(head, dark, new THREE.BoxGeometry(0.007, 0.012, 0.024), { r: [0, side * 0.45, 0], p: [side * 0.062, -0.068, 0.107] }); // rejillas laterales
  }
  for (const y of [-0.063, -0.079]) b.add(head, dark, new THREE.CapsuleGeometry(0.0042, 0.04, 4, 6), { r: [0, 0, Math.PI / 2], p: [0, y, y < -0.07 ? 0.119 : 0.129] }); // toma de aire de la barbilla
  b.add(head, dark, helmetShape(new THREE.SphereGeometry(HR + 0.0018, 48, 3, 0, Math.PI * 2, 2.43, 0.2))); // ribete inferior
  b.add(head, wing, new THREE.CapsuleGeometry(0.012, 0.085, 4, 10), { r: [0, 0, Math.PI / 2], s: [1, 0.62, 2.1], p: [0, 0.084, -0.118] }); // alerón
  for (const side of [-1, 1]) b.add(head, wing, new THREE.BoxGeometry(0.008, 0.03, 0.034), { r: [-0.5, 0, 0], p: [side * 0.036, 0.072, -0.108] });
  b.add(head, dark, new THREE.CapsuleGeometry(0.007, 0.03, 4, 8), { r: [Math.PI / 2 - 0.3, 0, 0], p: [0, 0.124, 0.03] }); // toma superior

  // brazos hasta el aro del volante
  const wheel = local(fit.wheel), n = steerAxis(fit.tilt), right = new THREE.Vector3(-1, 0, 0), upW = new THREE.Vector3().crossVectors(n, right);
  const shoulderLocal = (s) => new THREE.Vector3(s * 0.158, 0.303, 0.004);
  const restShoulder = shoulderLocal(1).applyEuler(new THREE.Euler(RECLINE, 0, 0)).add(hip);
  const reach = restShoulder.distanceTo(tmpC.copy(wheel).add(new THREE.Vector3(wheelR, 0, 0)));
  const armLen = Math.min(0.3, Math.max(0.2, reach * 0.54));
  const arms = [1, -1].map((s) => {
    const hand = new THREE.Group(), cuff = new THREE.Group(); root.add(hand, cuff);
    glove(b, hand, gear, trim);
    b.add(cuff, gear, new THREE.CylinderGeometry(0.033, 0.03, 0.052, 14));
    b.add(cuff, trim, new THREE.TorusGeometry(0.0335, 0.0055, 6, 18), { r: [Math.PI / 2, 0, 0], p: [0, 0.022, 0] });
    return { s, hand, cuff, move: limb(root, cloth, [[0.05, 0.046, 0.034], [0.037, 0.038, 0.026]], armLen, armLen) };
  });

  // piernas hasta los pedales (no en las carrocerías cerradas, que las tapan)
  if (!fit.cockpit) {
    const foot = local(fit.foot), legReach = new THREE.Vector3(0.09, hip.y, hip.z).distanceTo(foot);
    const legLen = Math.min(0.5, Math.max(0.28, legReach * 0.55));
    for (const s of [1, -1]) {
      const move = limb(root, cloth, [[0.072, 0.066, 0.047], [0.05, 0.048, 0.033]], legLen, legLen);
      const end = move(new THREE.Vector3(s * 0.082, hip.y + 0.022, hip.z + 0.03), new THREE.Vector3(s * foot.x, foot.y, foot.z), new THREE.Vector3(s * 0.25, 1, 0));
      const boot = new THREE.Group(); boot.position.copy(end).add(new THREE.Vector3(0, 0.032, 0.012)); boot.rotation.x = -0.95; root.add(boot); // punta hacia arriba, apoyada en el pedal
      b.add(boot, gear, new THREE.CapsuleGeometry(0.037, 0.082, 5, 12), { r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1], p: [0, 0, 0.028] });
      b.add(boot, gear, new THREE.CylinderGeometry(0.035, 0.039, 0.07, 14), { p: [0, 0.03, -0.026] });
      b.add(boot, dark, new THREE.BoxGeometry(0.07, 0.014, 0.158), { p: [0, -0.034, 0.028] });
      b.add(boot, trim, new THREE.TorusGeometry(0.036, 0.0045, 6, 18), { r: [Math.PI / 2, 0, 0], p: [0, 0.058, -0.026] });
    }
  }
  b.flush();

  // ----- animación: el cuerpo tiene peso (muelles), la cabeza se adelanta a la curva -----
  const st = { steer: 0, t: 0, cheer: 0, hit: 0 };
  const spring = (stiff, damp) => ({ x: 0, v: 0, to(target, dt) { const h = Math.min(dt, 1 / 30); this.v += ((target - this.x) * stiff - this.v * damp) * h; this.x += this.v * h; return this.x; } });
  const lean = spring(90, 13), pitch = spring(110, 14), look = spring(150, 21), tilt = spring(70, 11), bob = spring(260, 15);
  const hand = new THREE.Vector3(), shoulder = new THREE.Vector3(), pole = new THREE.Vector3(), euler = new THREE.Euler(), basis = new THREE.Matrix4(), up = new THREE.Vector3();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3(), turnQ = new THREE.Quaternion();
  function pose(turn, breath = 0) {
    euler.set(RECLINE + pitch.x, -st.steer * 0.07, lean.x); torso.rotation.copy(euler); torso.position.set(hip.x, hip.y + bob.x, hip.z);
    for (const a of arms) {
      const th = (a.s > 0 ? Math.PI - 0.1 : 0.1) - turn; // a las nueve y a las tres; al girar, las manos van con el aro
      hand.copy(wheel).addScaledVector(right, Math.cos(th) * wheelR).addScaledVector(upW, Math.sin(th) * wheelR);
      ax.copy(hand).sub(wheel).normalize(); az.copy(n); ay.crossVectors(az, ax).normalize();
      // al girar, el hombro de fuera se adelanta y el de dentro se recoge
      shoulder.copy(shoulderLocal(a.s)); shoulder.z += -a.s * st.steer * 0.018; shoulder.y += breath * 0.004; shoulder.applyEuler(euler).add(torso.position);
      const cheer = a.s < 0 ? st.cheer : 0; // brazo derecho arriba al cruzar la meta
      if (cheer > 0.001) hand.lerp(up.set(shoulder.x - 0.13, shoulder.y + armLen * 1.55 + Math.sin(st.t * 9) * 0.05, shoulder.z + 0.06), cheer);
      const end = a.move(shoulder, hand, pole.set(a.s * (0.85 + cheer), -0.7 + cheer * 0.5, -0.2));
      a.hand.position.copy(end);
      basis.makeBasis(ax, ay, az); a.hand.quaternion.setFromRotationMatrix(basis);
      if (cheer > 0.001) a.hand.quaternion.slerp(turnQ.setFromUnitVectors(UP, tmpC.copy(end).sub(shoulder).normalize()), cheer);
      tmpD.copy(shoulder).sub(end).normalize(); a.cuff.position.copy(end).addScaledVector(tmpD, 0.052); a.cuff.quaternion.setFromUnitVectors(UP, tmpD);
    }
  }
  pose(0);
  return {
    root,
    // steer -1..1 (derecha positiva), sf = velocidad relativa 0..1, bump = golpe, cheer = ha terminado
    update(dt, { steer = 0, sf = 0, brake = 0, throttle = 0, bump = 0, cheer = false }) {
      st.t += dt;
      st.steer += (steer - st.steer) * (1 - Math.exp(-12 * dt));
      st.cheer += ((cheer ? 1 : 0) - st.cheer) * (1 - Math.exp(-5 * dt));
      const jolt = Math.abs(bump);
      if (jolt > st.hit + 0.04) { pitch.v += jolt * 5; lean.v += (Math.sin(st.t * 91) > 0 ? 1 : -1) * jolt * 4; bob.v += jolt * 0.9; }
      st.hit = jolt;
      const still = Math.max(0, 1 - sf * 8), breath = Math.sin(st.t * 2.3) * still;
      lean.to(-st.steer * (0.05 + sf * 0.19), dt);
      pitch.to(brake * sf * 0.2 - throttle * (1 - sf * 0.6) * 0.075 + sf * sf * 0.06, dt); // frenando se va adelante; acelerando, contra el asiento; a fondo, se agacha
      look.to(-st.steer * 0.62 + still * Math.sin(st.t * 0.7) * 0.22 + st.cheer * 0.35, dt);
      tilt.to(st.steer * sf * 0.16, dt); // la cabeza se queda más derecha que el cuerpo
      bob.to(Math.sin(st.t * 37) * 0.0035 * sf + breath * 0.002, dt);
      pose(st.steer * STEER_TURN, breath);
      const shake = sf * 0.007;
      neck.rotation.set(-RECLINE - pitch.x * 0.55 + Math.sin(st.t * 31) * shake + throttle * (1 - sf) * -0.05, look.x, -lean.x * 0.72 + tilt.x + Math.sin(st.t * 23) * shake);
      return st.steer;
    },
    dispose() { root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); for (const m of materials) m.dispose(); root.removeFromParent(); },
  };
}
