// Gente alrededor del circuito: una sola malla instanciada animada en la GPU (sin coste por fotograma en JavaScript).
// Tipos: 0 andando (va y vuelve por un tramo), 1 animando con los brazos arriba, 2 saltando, 3 mirando, 4 aplaudiendo.
// Variantes: human (público normal), tribe (guerreros con lanza de la selva), shroom (público-seta original del circuito de juguete).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const npcClock = { value: 0 };
export const WALK = 0, CHEER = 1, JUMP = 2, IDLE = 3, CLAP = 4;

const geos = {};
function peep(variant) {
  if (geos[variant]) return geos[variant];
  const part = (g, x, y, z, hex, id) => { g = (g.index ? g.toNonIndexed() : g).translate(x, y, z); const n = g.attributes.position.count, c = new THREE.Color(hex), a = new Float32Array(n * 3), p = new Float32Array(n); for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; p[k] = id; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(p, 1)); return g; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), head = () => new THREE.IcosahedronGeometry(0.135, 1), T = 0xffffff; // T: toma el color de cada persona
  const limbs = (leg, arm) => [part(box(0.14, 0.86, 0.16), -0.1, 0.43, 0, leg, 1), part(box(0.14, 0.86, 0.16), 0.1, 0.43, 0, leg, 2), part(box(0.095, 0.62, 0.11), -0.25, 1.2, 0, arm, 3), part(box(0.095, 0.62, 0.11), 0.25, 1.2, 0, arm, 4)];
  let parts;
  if (variant === 'tribe') {
    const skin = 0x7a4a2a;
    parts = [
      part(box(0.36, 0.58, 0.2), 0, 1.22, 0, skin, 0), part(head(), 0, 1.66, 0, skin, 0), part(box(0.27, 0.09, 0.27), 0, 1.77, -0.01, 0x17110d, 0),
      part(new THREE.CylinderGeometry(0.2, 0.3, 0.36, 8), 0, 0.8, 0, T, 0), // falda de fibras
      part(box(0.29, 0.05, 0.29), 0, 1.72, 0, T, 0), // cinta
      part(box(0.2, 0.03, 0.01), 0, 1.65, 0.135, 0xd8362a, 0), // pintura de guerra
      part(box(0.05, 0.34, 0.02), -0.1, 1.94, 0, 0xd8362a, 0), part(box(0.05, 0.42, 0.02), 0, 1.98, 0, 0xffc62e, 0), part(box(0.05, 0.34, 0.02), 0.1, 1.94, 0, 0x2f9a4a, 0), // plumas
      ...limbs(skin, skin),
      part(new THREE.CylinderGeometry(0.022, 0.022, 2.3, 5), 0.36, 1.15, 0.08, 0x6a4a28, 5), part(new THREE.ConeGeometry(0.07, 0.3, 5), 0.36, 2.44, 0.08, 0xb9bdc2, 5), // lanza
    ];
  } else if (variant === 'dove') {
    const wh = 0xf4f6f8;
    parts = [
      part(box(0.38, 0.62, 0.22), 0, 1.2, 0, T, 0), part(new THREE.IcosahedronGeometry(0.18, 1), 0, 1.7, 0.01, wh, 0), // cabeza de paloma
      part(new THREE.ConeGeometry(0.055, 0.19, 5).rotateX(Math.PI / 2), 0, 1.67, 0.22, 0xf0a030, 0), // pico
      part(box(0.04, 0.05, 0.03), -0.1, 1.74, 0.13, 0x14161a, 0), part(box(0.04, 0.05, 0.03), 0.1, 1.74, 0.13, 0x14161a, 0), // ojos
      part(new THREE.CylinderGeometry(0.16, 0.19, 0.07, 8), 0, 1.54, 0, 0x8f9db0, 0), // collar gris
      part(box(0.05, 0.14, 0.04), 0, 1.93, -0.04, wh, 0), // cresta
      ...limbs(0x2b3350, wh),
    ];
  } else if (variant === 'shroom') {
    const stem = 0xeadfbe;
    parts = [
      part(new THREE.CylinderGeometry(0.2, 0.27, 0.72, 10), 0, 1.22, 0, stem, 0),
      part(new THREE.ConeGeometry(0.58, 0.82, 12), 0, 2.0, 0, T, 0), // sombrero picudo sin motas
      part(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), 0, 1.58, 0, 0x8c7a58, 0),
      part(box(0.05, 0.1, 0.02), -0.08, 1.38, 0.21, 0x20180f, 0), part(box(0.05, 0.1, 0.02), 0.08, 1.38, 0.21, 0x20180f, 0),
      ...limbs(0x4f6b35, stem),
    ];
  } else {
    parts = [part(box(0.38, 0.62, 0.22), 0, 1.2, 0, T, 0), part(head(), 0, 1.66, 0, 0xd8a57e, 0), part(box(0.27, 0.1, 0.27), 0, 1.76, -0.01, 0x2a211c, 0), ...limbs(0x2b3350, T)];
  }
  return (geos[variant] = mergeGeometries(parts));
}

const PARS = `
attribute float aPart; attribute vec4 aN; uniform float uNpcT;
vec3 npcRot(vec3 p, float py, float a) { float c = cos(a), s = sin(a), y = p.y - py; return vec3(p.x, py + y * c - p.z * s, y * s + p.z * c); }
float npcDir() { if (aN.x > 0.5) return 1.0; float s = max(aN.w, 0.01), tt = mod((uNpcT + aN.y) * aN.z, 2.0 * s); return tt < s ? 1.0 : -1.0; }
`;
const MOVE = `
vec3 transformed = vec3(position);
{
  float T = uNpcT + aN.y, type = aN.x, armL = aPart > 2.5 && aPart < 3.5 ? 1.0 : 0.0;
  bool arm = aPart > 2.5 && aPart < 4.5;
  if (type < 0.5) {
    float s = max(aN.w, 0.01), v = aN.z, tt = mod(T * v, 2.0 * s), along = tt < s ? tt : 2.0 * s - tt, w = sin(T * v * 4.4);
    if (aPart > 0.5 && aPart < 2.5) transformed = npcRot(transformed, 0.85, (aPart < 1.5 ? w : -w) * 0.55);
    if (arm) transformed = npcRot(transformed, 1.5, (armL > 0.5 ? -w : w) * 0.45);
    transformed.xz *= npcDir(); transformed.z += along - s * 0.5; transformed.y += abs(w) * 0.035;
  } else if (type < 1.5) {
    float w = sin(T * 6.0);
    if (arm) transformed = npcRot(transformed, 1.5, -2.75 + (armL > 0.5 ? w : -w) * 0.32);
    transformed.y += abs(sin(T * 3.0)) * 0.1;
    if (aPart > 4.5) transformed.y += abs(sin(T * 5.0)) * 0.4; // agita la lanza
  } else if (type < 2.5) {
    float w = sin(T * 4.0);
    if (arm) transformed = npcRot(transformed, 1.5, -2.9 + w * 0.2);
    if (aPart > 0.5 && aPart < 2.5) transformed = npcRot(transformed, 0.85, -abs(w) * 0.3);
    transformed.y += abs(w) * 0.62;
  } else if (type < 3.5) {
    if (arm) transformed = npcRot(transformed, 1.5, sin(T * 1.1) * 0.08);
    transformed.y += sin(T * 1.2) * 0.012; transformed.x += sin(T * 0.7) * 0.03;
  } else {
    if (arm) { transformed = npcRot(transformed, 1.5, -1.35); transformed.x *= 0.5 + 0.34 * abs(sin(T * 9.0)); }
    transformed.y += abs(sin(T * 4.5)) * 0.03;
  }
}
`;

// items: [x, y, z, rumbo, tipo, velocidad, tramo, color]
export function npcMesh(scene, items, variant = 'human') {
  if (!items.length) return null;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNpcT = npcClock;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal.xz *= npcDir();')
      .replace('#include <begin_vertex>', MOVE)
      .replace('#include <color_vertex>', '#include <color_vertex>\nif (color.g < 0.99) vColor.rgb = color.rgb;');
  };
  mat.customProgramCacheKey = () => 'npc-v3';
  const g = peep(variant).clone(), n = items.length, aN = new Float32Array(n * 4);
  const m = new THREE.InstancedMesh(g, mat, n), D = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, k) => {
    D.position.set(it[0], it[1], it[2]); D.rotation.set(0, it[3], 0); const sc = 0.9 + ((k * 7) % 11) * 0.02; D.scale.setScalar(sc); D.updateMatrix(); m.setMatrixAt(k, D.matrix); m.setColorAt(k, c.setHex(it[7]));
    aN[k * 4] = it[4]; aN[k * 4 + 1] = (k * 2.399) % 50; aN[k * 4 + 2] = it[5]; aN[k * 4 + 3] = it[6];
  });
  g.setAttribute('aN', new THREE.InstancedBufferAttribute(aN, 4));
  m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = false; scene.add(m);
  return m;
}
export const SHIRTS = [0xc8102e, 0xf2f2f2, 0x2a6fd0, 0xffc62e, 0x2f9a4a, 0x23262c, 0xe8559a, 0xff7a1a, 0x7a4fd0, 0x19a7a7];
// reparto habitual de un grupo de espectadores
export const crowdType = (r) => (r < 0.42 ? CHEER : r < 0.56 ? JUMP : r < 0.74 ? CLAP : IDLE);
