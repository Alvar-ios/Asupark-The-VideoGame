// Piloto propio, hecho por piezas: mono, guantes, botas y casco se cambian por separado. Brazos y piernas se
// doblan solos hasta el volante y los pedales de cada kart (ver PILOT_FIT), y se anima con la conducción.
// Medidas en metros dentro del kart: morro +Z, izquierda +X, suelo en y = 0.
import * as THREE from 'three';
import { SKIN_DATA } from './skins-data.js';

// dónde va el piloto en cada kart: cadera, centro y radio del volante, inclinación del aro y apoyo de los pies.
// `cockpit`: la carrocería tapa las piernas, así que no se dibujan.
const FIT = {
  kart: { hip: [0, 0.215, -0.24], wheel: [0, 0.49, 0.17], r: 0.13, tilt: 0.6, foot: [0.19, 0.19, 0.6] },
  pizza: { hip: [0, 0.225, -0.24], wheel: [0, 0.525, 0.15], r: 0.12, tilt: 0.6, foot: [0.19, 0.2, 0.58] },
  estandar: { hip: [0, 0.35, -0.27], wheel: [0, 0.57, 0.135], r: 0.185, tilt: 0.55, foot: [0.2, 0.27, 0.46] },
  caramelo1: { hip: [0, 0.25, -0.2], wheel: [0, 0.5, 0.13], r: 0.095, tilt: 0.6, cockpit: true },
  caramelo2: { hip: [0, 0.14, -0.2], wheel: [0, 0.39, 0.13], r: 0.09, tilt: 0.6, cockpit: true },
  caramelo3: { hip: [0, 0.19, -0.16], wheel: [0, 0.45, 0.17], r: 0.09, tilt: 0.6, cockpit: true },
  caramelo4: { hip: [0, 0.255, -0.2], wheel: [0, 0.495, 0.14], r: 0.095, tilt: 0.6, cockpit: true },
  caramelo5: { hip: [0, 0.4, -0.12], wheel: [0, 0.66, 0.2], r: 0.095, tilt: 0.6, cockpit: true },
};
export function pilotFit(skin) {
  if (!skin) return FIT.kart;
  const base = FIT[skin] || (skin.startsWith('pizza') ? FIT.pizza : FIT.kart);
  const st = SKIN_DATA[skin] && SKIN_DATA[skin].parts.steer;
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
    for (const u of [64, 192]) x.fillRect(u - 9, 0, 18, 256); // franjas de los costados
    x.fillRect(0, 74, 256, 20); x.fillRect(0, 104, 256, 5);
    if (s.style === 'flames') { x.beginPath(); x.moveTo(0, 256); for (let i = 0; i <= 16; i++) { x.lineTo(i * 16 - 8, 150 + (i % 2) * 34); x.lineTo(i * 16, 214); } x.lineTo(256, 256); x.fill(); }
    x.fillStyle = hex(s.extra || '121317'); x.fillRect(0, 236, 256, 20); // cinturón
    x.fillStyle = 'rgba(0,0,0,.28)'; for (const u of [32, 96, 160, 224]) x.fillRect(u, 0, 2, 256);
  });
  suitCache.set(key, t); return t;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

// brazo o pierna: dos tramos de longitud fija entre el hombro (o cadera) y la mano (o pie); `pole` dice hacia dónde dobla
function limb(parent, matUp, matLow, rUp, rLow, lenUp, lenLow) {
  const seg = (mat, r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.castShadow = true; parent.add(m); return m; };
  const up = seg(matUp, rUp, lenUp), low = seg(matLow, rLow, lenLow), joint = new THREE.Mesh(new THREE.SphereGeometry(rUp * 0.98, 10, 8), matUp); parent.add(joint);
  const place = (m, a, b) => { m.position.copy(a).add(b).multiplyScalar(0.5); tmpD.copy(b).sub(a).normalize(); m.quaternion.setFromUnitVectors(UP, tmpD); };
  const elbow = new THREE.Vector3(), end = new THREE.Vector3();
  return (from, to, pole) => {
    const dir = tmpA.copy(to).sub(from), d = Math.min(dir.length(), lenUp + lenLow - 1e-3); dir.normalize();
    end.copy(from).addScaledVector(dir, d);
    const a = (lenUp * lenUp - lenLow * lenLow + d * d) / (2 * d), h = Math.sqrt(Math.max(0, lenUp * lenUp - a * a));
    const side = tmpB.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
    elbow.copy(from).addScaledVector(dir, a).addScaledVector(side, h);
    place(up, from, elbow); place(low, elbow, end); joint.position.copy(elbow);
    return end;
  };
}

// helmet: «base|dibujo|visera|patrón»; suit: { main, accent, extra, style, metal }; fit: pilotFit(skin)
export function buildPilot({ helmet, suit = SUIT_DEFAULT, fit = FIT.kart }) {
  const root = new THREE.Group(); root.name = 'pilot';
  const metal = suit.metal ? { metalness: 0.75, roughness: 0.32 } : { metalness: 0, roughness: 0.82 };
  const cloth = new THREE.MeshStandardMaterial({ color: hex(suit.main), ...metal });
  const chest = new THREE.MeshStandardMaterial({ map: suitTex(suit), ...metal });
  const trim = new THREE.MeshStandardMaterial({ color: hex(suit.accent), ...metal });
  const gear = new THREE.MeshStandardMaterial({ color: hex(suit.extra || '121317'), roughness: 0.6, metalness: 0.05 });
  const visorColor = (String(helmet).split('|')[2]) || '111827';
  const shell = new THREE.MeshStandardMaterial({ map: helmetTex(String(helmet)), roughness: 0.22, metalness: 0.12, envMapIntensity: 1.1 });
  const visor = new THREE.MeshStandardMaterial({ color: hex(visorColor), roughness: 0.06, metalness: 0.85, envMapIntensity: 1.6 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  const hip = new THREE.Vector3(...fit.hip);
  const torso = new THREE.Group(); torso.position.copy(hip); root.add(torso);
  const RECLINE = -0.2;
  // tronco: cintura estrecha y pecho ancho, un poco aplanado de delante atrás
  const profile = [[0.001, -0.02], [0.11, 0], [0.105, 0.09], [0.122, 0.2], [0.142, 0.29], [0.128, 0.345], [0.07, 0.385], [0.001, 0.39]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = mesh(new THREE.LatheGeometry(profile, 20), chest, torso); body.scale.set(1.08, 1, 0.78); body.rotation.y = -Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.115, 14, 10), cloth, torso, 0, 0.01, 0).scale.set(1.05, 0.7, 0.85); // caderas
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.066, 12, 10), trim, torso, s * 0.14, 0.31, 0); // hombreras
  mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.07, 14), gear, torso, 0, 0.395, 0.004); // protector de cuello
  const neck = new THREE.Group(); neck.position.set(0, 0.43, 0.01); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.085, 0.012); neck.add(head);
  mesh(new THREE.SphereGeometry(0.128, 32, 24), shell, head).scale.set(1, 1.03, 1.1);
  mesh(new THREE.SphereGeometry(0.1305, 28, 10, Math.PI / 2 - 1.08, 2.16, 1.2, 0.52), visor, head).scale.set(1, 1.03, 1.1); // visera
  mesh(new THREE.SphereGeometry(0.1315, 28, 4, Math.PI / 2 - 1.12, 2.24, 1.72, 0.07), gear, head).scale.set(1, 1.03, 1.1); // borde inferior de la visera
  mesh(new THREE.BoxGeometry(0.075, 0.018, 0.02), gear, head, 0, -0.065, 0.132); // toma de aire de la barbilla
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), gear, head, s * 0.128, 0.004, 0).rotation.z = Math.PI / 2; // tornillos de la visera

  // brazos hasta el aro del volante
  const wheel = new THREE.Vector3(...fit.wheel), n = steerAxis(fit.tilt), right = new THREE.Vector3(-1, 0, 0), upW = new THREE.Vector3().crossVectors(n, right);
  const shoulderLocal = (s) => new THREE.Vector3(s * 0.155, 0.305, 0);
  const restShoulder = shoulderLocal(1).applyEuler(new THREE.Euler(RECLINE, 0, 0)).add(hip);
  const reach = restShoulder.distanceTo(tmpC.copy(wheel).add(new THREE.Vector3(fit.r, 0, 0)));
  const armLen = Math.min(0.3, Math.max(0.2, reach * 0.54));
  const arms = [1, -1].map((s) => ({ s, move: limb(root, cloth, cloth, 0.043, 0.036, armLen, armLen), glove: mesh(new THREE.SphereGeometry(0.043, 12, 10), gear, root), cuff: mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.035, 12), trim, root) }));

  // piernas hasta los pedales (no en las carrocerías cerradas, que las tapan)
  let legs = [];
  if (!fit.cockpit) {
    const [fx, fy, fz] = fit.foot, legReach = new THREE.Vector3(0.09, hip.y, hip.z).distanceTo(new THREE.Vector3(fx, fy, fz));
    const legLen = Math.min(0.5, Math.max(0.28, legReach * 0.55));
    legs = [1, -1].map((s) => { const move = limb(root, cloth, cloth, 0.062, 0.048, legLen, legLen); const boot = mesh(new THREE.CapsuleGeometry(0.048, 0.085, 4, 10), gear, root); const end = move(new THREE.Vector3(s * 0.085, hip.y + 0.02, hip.z + 0.03), new THREE.Vector3(s * fx, fy, fz), new THREE.Vector3(s * 0.25, 1, 0)); boot.position.copy(end).add(new THREE.Vector3(0, 0.035, 0.015)); boot.rotation.x = 0.45; return boot; });
  }

  const st = { steer: 0, lean: 0, pitch: 0, look: 0, t: 0 };
  const hand = new THREE.Vector3(), shoulder = new THREE.Vector3(), pole = new THREE.Vector3(), euler = new THREE.Euler();
  function pose(turn) {
    euler.set(RECLINE + st.pitch, 0, st.lean); torso.rotation.copy(euler);
    for (const a of arms) {
      const th = (a.s > 0 ? Math.PI - 0.1 : 0.1) - turn; // a las nueve y a las tres; al girar, las manos van con el aro
      hand.copy(wheel).addScaledVector(right, Math.cos(th) * fit.r).addScaledVector(upW, Math.sin(th) * fit.r);
      shoulder.copy(shoulderLocal(a.s)).applyEuler(euler).add(hip);
      const end = a.move(shoulder, hand, pole.set(a.s * 0.8, -0.6, -0.15));
      a.glove.position.copy(end); a.cuff.position.copy(end).lerp(shoulder, 0.17); a.cuff.quaternion.setFromUnitVectors(UP, tmpC.copy(shoulder).sub(end).normalize());
    }
  }
  pose(0);
  return {
    root,
    // steer -1..1 (derecha positiva), sf = velocidad relativa 0..1
    update(dt, { steer = 0, sf = 0, brake = 0, throttle = 0, bump = 0 }) {
      st.t += dt;
      const k = 1 - Math.exp(-12 * dt), k2 = 1 - Math.exp(-6 * dt);
      st.steer += (steer - st.steer) * k;
      st.lean += (-st.steer * sf * 0.17 - st.lean) * k2; // el cuerpo se va hacia fuera de la curva
      st.pitch += (brake * sf * 0.12 - throttle * (1 - sf) * 0.05 - st.pitch) * k2;
      st.look += (-st.steer * 0.5 - st.look) * k2; // la cabeza mira hacia la curva antes que el cuerpo
      pose(st.steer * STEER_TURN);
      const shake = sf * 0.006 + Math.abs(bump) * 0.05;
      neck.rotation.set(-RECLINE - st.pitch * 0.4 + Math.sin(st.t * 31) * shake, st.look, -st.lean * 0.6 + Math.sin(st.t * 23) * shake);
      return st.steer;
    },
    dispose() { root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); for (const m of [cloth, chest, trim, gear, shell, visor]) m.dispose(); root.removeFromParent(); },
  };
}
