// Relleno ligero de los exteriores: árboles-imagen (4 triángulos cada uno), fondos en anillo y objetos instanciados por circuito.
// Todo va en muy pocas llamadas de dibujo y sin sombras para no pesar en móvil.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL } from './track.js';
import { npcMesh, SHIRTS, WALK, CHEER, IDLE, crowdType } from './npc.js';

const cache = {};
function tex(key, w, h, paint, repeat) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; if (repeat) t.wrapS = THREE.RepeatWrapping;
  return (cache[key] = t);
}
const R0 = (a, b) => a + Math.random() * (b - a);
const blobs = (x, cols, n, cx, cy, rx, ry, r0, r1) => { for (let k = 0; k < n; k++) { const a = R0(0, 6.283), d = Math.sqrt(Math.random()); const px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d; x.fillStyle = cols[Math.min(cols.length - 1, Math.floor(((py - (cy - ry)) / (2 * ry)) * cols.length + R0(-0.6, 0.6)) < 0 ? 0 : Math.floor(((py - (cy - ry)) / (2 * ry)) * cols.length + R0(-0.6, 0.6)))]; x.beginPath(); x.arc(px, py, R0(r0, r1), 0, 6.283); x.fill(); } };
const trunk = (x, cx, y0, y1, w, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(cx - w, y1); x.lineTo(cx - w * 0.45, y0); x.lineTo(cx + w * 0.45, y0); x.lineTo(cx + w, y1); x.fill(); };
const tiers = (x, W, H, cols, snow) => { const n = 7; for (let k = 0; k < n; k++) { const u = k / n, y = H * 0.04 + u * H * 0.72, w = W * (0.1 + 0.36 * ((k + 1) / n)), h = H * 0.22; x.fillStyle = cols[k % cols.length]; x.beginPath(); x.moveTo(W / 2, y); for (let j = 0; j <= 8; j++) { const q = j / 8; x.lineTo(W / 2 + w * (1 - 2 * q), y + h * (j % 2 ? 0.86 : 1)); } x.fill(); if (snow) { x.fillStyle = 'rgba(248,252,255,.95)'; x.beginPath(); x.moveTo(W / 2, y); x.lineTo(W / 2 + w * 0.7, y + h * 0.62); x.lineTo(W / 2 + w * 0.2, y + h * 0.5); x.lineTo(W / 2 - w * 0.2, y + h * 0.66); x.lineTo(W / 2 - w * 0.7, y + h * 0.5); x.fill(); } } };
const SPRITES = {
  broad: (x, W, H) => { trunk(x, W / 2, H * 0.55, H, W * 0.06, '#5b4530'); blobs(x, ['#7fb04c', '#5d9440', '#477a35', '#376530'], 240, W / 2, H * 0.36, W * 0.4, H * 0.32, W * 0.05, W * 0.1); },
  olive: (x, W, H) => { trunk(x, W / 2, H * 0.6, H, W * 0.08, '#6a5a48'); blobs(x, ['#a8b58c', '#8ba078', '#6f8a66', '#5c7558'], 240, W / 2, H * 0.44, W * 0.44, H * 0.3, W * 0.04, W * 0.08); },
  poplar: (x, W, H) => { trunk(x, W / 2, H * 0.7, H, W * 0.05, '#6a5a44'); blobs(x, ['#8bb257', '#6d9a48', '#4f8038', '#3d6a30'], 260, W / 2, H * 0.44, W * 0.19, H * 0.42, W * 0.04, W * 0.075); },
  pine: (x, W, H) => { trunk(x, W / 2, H * 0.7, H, W * 0.05, '#4a3626'); tiers(x, W, H, ['#2c5a36', '#254e30', '#356a3c', '#1f452b']); },
  snowpine: (x, W, H) => { trunk(x, W / 2, H * 0.7, H, W * 0.05, '#4a3626'); tiers(x, W, H, ['#2c5a48', '#254e40', '#356a54', '#1f453a'], true); },
  palm: (x, W, H) => { x.strokeStyle = '#8a6c49'; x.lineWidth = W * 0.05; x.beginPath(); x.moveTo(W * 0.52, H); x.quadraticCurveTo(W * 0.42, H * 0.6, W * 0.5, H * 0.24); x.stroke(); x.lineCap = 'round'; for (let k = 0; k < 11; k++) { const a = -Math.PI * (0.02 + (k / 10) * 0.96), L = W * R0(0.36, 0.48), ex = W / 2 + Math.cos(a) * L, ey = H * 0.24 + Math.sin(a) * L * 0.5 + L * 0.42; x.strokeStyle = ['#4f9238', '#3f7f33', '#62a342'][k % 3]; x.lineWidth = W * 0.05; x.beginPath(); x.moveTo(W / 2, H * 0.24); x.quadraticCurveTo(W / 2 + Math.cos(a) * L * 0.6, H * 0.24 + Math.sin(a) * L * 0.9, ex, ey); x.stroke(); } },
  jungle: (x, W, H) => { trunk(x, W / 2, H * 0.3, H, W * 0.05, '#5a4632'); for (const [cy, rx] of [[H * 0.16, 0.46], [H * 0.3, 0.36]]) blobs(x, ['#4f9a44', '#2f7f38', '#256c32', '#1c5a2c'], 170, W / 2, cy, W * rx, H * 0.14, W * 0.04, W * 0.08); },
  saguaro: (x, W, H) => { x.strokeStyle = '#3f7a48'; x.lineCap = 'round'; x.lineWidth = W * 0.14; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, H * 0.1); x.stroke(); x.lineWidth = W * 0.09; for (const [d, y, t] of [[-1, 0.55, 0.28], [1, 0.42, 0.16]]) { x.beginPath(); x.moveTo(W / 2, H * y); x.lineTo(W / 2 + d * W * 0.26, H * y); x.lineTo(W / 2 + d * W * 0.26, H * t); x.stroke(); } x.strokeStyle = 'rgba(190,225,180,.35)'; x.lineWidth = 2; for (const d of [-0.03, 0.02]) { x.beginPath(); x.moveTo(W * (0.5 + d), H); x.lineTo(W * (0.5 + d), H * 0.1); x.stroke(); } },
  acacia: (x, W, H) => { x.strokeStyle = '#4a3a2a'; x.lineCap = 'round'; x.lineWidth = W * 0.05; x.beginPath(); x.moveTo(W * 0.5, H); x.quadraticCurveTo(W * 0.46, H * 0.62, W * 0.4, H * 0.38); x.stroke(); x.lineWidth = W * 0.03; x.beginPath(); x.moveTo(W * 0.47, H * 0.66); x.quadraticCurveTo(W * 0.6, H * 0.52, W * 0.72, H * 0.4); x.stroke(); blobs(x, ['#9aa84a', '#7f9440', '#6a8238', '#586f30'], 230, W * 0.52, H * 0.3, W * 0.5, H * 0.1, W * 0.04, W * 0.085); blobs(x, ['#8fa045', '#74893b'], 80, W * 0.38, H * 0.36, W * 0.2, H * 0.05, W * 0.03, W * 0.06); },
  baobab: (x, W, H) => { x.fillStyle = '#9a8468'; x.beginPath(); x.moveTo(W * 0.22, H); x.quadraticCurveTo(W * 0.34, H * 0.78, W * 0.36, H * 0.52); x.quadraticCurveTo(W * 0.37, H * 0.42, W * 0.4, H * 0.4); x.lineTo(W * 0.6, H * 0.4); x.quadraticCurveTo(W * 0.63, H * 0.42, W * 0.64, H * 0.52); x.quadraticCurveTo(W * 0.66, H * 0.78, W * 0.78, H); x.fill(); x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.moveTo(W * 0.55, H); x.quadraticCurveTo(W * 0.6, H * 0.7, W * 0.6, H * 0.42); x.lineTo(W * 0.64, H * 0.52); x.quadraticCurveTo(W * 0.68, H * 0.78, W * 0.78, H); x.fill(); x.strokeStyle = '#85715a'; x.lineCap = 'round'; x.lineWidth = W * 0.04; for (const [a, b, c, d] of [[0.44, 0.42, 0.2, 0.22], [0.5, 0.4, 0.5, 0.12], [0.56, 0.42, 0.8, 0.22], [0.46, 0.4, 0.32, 0.14], [0.54, 0.4, 0.68, 0.14]]) { x.beginPath(); x.moveTo(W * a, H * b); x.lineTo(W * c, H * d); x.stroke(); } blobs(x, ['#8fa24a', '#76903f', '#62793a'], 110, W / 2, H * 0.17, W * 0.4, H * 0.09, W * 0.03, W * 0.06); },
  flower: (x, W, H) => { x.lineCap = 'round'; for (let k = 0; k < 26; k++) { const px = W * R0(0.08, 0.92), top = H * R0(0.35, 0.8); x.strokeStyle = '#4f8a38'; x.lineWidth = 4; x.beginPath(); x.moveTo(px, H); x.lineTo(px, top); x.stroke(); x.fillStyle = ['#ffd23a', '#ff6b6b', '#ffffff', '#c79bff', '#ff9d2e'][k % 5]; x.beginPath(); x.arc(px, top, W * 0.05, 0, 6.283); x.fill(); } },
  bush: (x, W, H) => blobs(x, ['#79a84b', '#5b9140', '#447a36', '#34652e'], 150, W / 2, H * 0.62, W * 0.42, H * 0.34, W * 0.05, W * 0.11),
  dry: (x, W, H) => { x.lineCap = 'round'; for (let k = 0; k < 44; k++) { const a = -Math.PI * Math.random(), L = H * R0(0.3, 0.7); x.strokeStyle = ['#8d9a5c', '#a2905a', '#6f8450'][k % 3]; x.lineWidth = 3.5; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2 + Math.cos(a) * L * 0.7, H + Math.sin(a) * L); x.stroke(); } },
  fern: (x, W, H) => { x.lineCap = 'round'; for (let k = 0; k < 30; k++) { const a = -Math.PI * (k / 29), L = H * R0(0.5, 0.9); x.strokeStyle = ['#3f8a34', '#57a040', '#2f7a2c'][k % 3]; x.lineWidth = W * 0.05; x.beginPath(); x.moveTo(W / 2, H); x.quadraticCurveTo(W / 2 + Math.cos(a) * L * 0.5, H + Math.sin(a) * L, W / 2 + Math.cos(a) * L, H + Math.sin(a) * L * 0.55); x.stroke(); } },
  toytree: (x, W, H) => { trunk(x, W / 2, H * 0.55, H, W * 0.05, '#a3703c'); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(W / 2, H * 0.36, W * 0.36, 0, 6.283); x.fill(); x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.arc(W * 0.56, H * 0.42, W * 0.3, 0, 6.283); x.fill(); },
};
const spriteTex = (k) => tex('s:' + k, 192, 256, SPRITES[k]);

// ---- fondos en anillo: silueta continua pintada en una textura repetida ----
const bump = (x, W, base, y0, y1, cols, step) => { for (const c of cols) { x.fillStyle = c; for (let px = -20; px < W + 20; px += step * R0(0.5, 1.1)) { const r = step * R0(0.9, 1.7); x.beginPath(); x.arc(px, base - R0(y0, y1), r, 0, 6.283); x.fill(); } x.fillRect(0, base - y0, W, 256 - base + y0); base += 22; } };
const spikes = (x, W, base, y0, y1, cols, step, snow) => { for (const c of cols) { for (let px = -20; px < W + 20; px += step * R0(0.5, 1)) { const h = R0(y0, y1), w = step * R0(0.9, 1.3); x.fillStyle = c; x.beginPath(); x.moveTo(px - w, base); x.lineTo(px, base - h); x.lineTo(px + w, base); x.fill(); if (snow) { x.fillStyle = '#f4f9fd'; x.beginPath(); x.moveTo(px - w * 0.34, base - h * 0.66); x.lineTo(px, base - h); x.lineTo(px + w * 0.34, base - h * 0.66); x.fill(); } } x.fillStyle = c; x.fillRect(0, base - 2, W, 260 - base); base += 24; } };
const blocks = (x, W, H, walls, win, lit) => { for (let px = -10; px < W;) { const w = R0(30, 78), h = R0(60, H * 0.92); x.fillStyle = walls[Math.floor(Math.random() * walls.length)]; x.fillRect(px, H - h, w, h); for (let wy = H - h + 6; wy < H - 4; wy += 11) for (let wx = px + 4; wx < px + w - 6; wx += 9) { if (lit && Math.random() < 0.35) continue; x.fillStyle = win[Math.floor(Math.random() * win.length)]; x.fillRect(wx, wy, 5, 6); } px += w + R0(-6, 10); } };
const RINGS = {
  trees: (x, W) => bump(x, W, 150, 8, 44, ['#6f9a68', '#55844f', '#3f6e3c'], 22),
  pines: (x, W) => spikes(x, W, 160, 50, 130, ['#4a6a58', '#33523f', '#233f30'], 15),
  jungle: (x, W) => bump(x, W, 120, 10, 70, ['#4f8f56', '#2f7538', '#1e5a2a'], 26),
  snow: (x, W) => spikes(x, W, 165, 50, 140, ['#a4bcc8', '#6f8e92', '#47686a'], 16, true),
  mesa: (x, W) => { for (const [c, b] of [['#d8a06e', 90], ['#bf7f4f', 130], ['#a5683f', 175]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, 256); let px = 0, y = b; x.lineTo(0, y); while (px < W) { const w = R0(60, 190), top = b - R0(0, 44); x.lineTo(px + 22, top); x.lineTo(px + w - 22, top); x.lineTo(px + w, b + 30); px += w; y = top; } x.lineTo(W, 256); x.closePath(); x.fill(); } },
  city: (x, W, H) => blocks(x, W, H, ['#c9bda8', '#b39e86', '#d8d0c0', '#a8a39a', '#b98d72'], ['#31424f', '#425664', '#6d8089']),
  neon: (x, W, H) => blocks(x, W, H, ['#10141f', '#161a2a', '#0d1120', '#1b1730'], ['#ffd27a', '#5ff0ff', '#ff5fc4', '#fff4c8'], true),
  favela: (x, W, H) => { x.fillStyle = '#4f7a44'; x.beginPath(); x.moveTo(0, H); for (let px = 0; px <= W; px += 30) x.lineTo(px, 80 + Math.sin(px * 0.012) * 26 + Math.sin(px * 0.031) * 12); x.lineTo(W, H); x.fill(); const c = ['#d8795a', '#e7c26a', '#8fb4c9', '#e8e0d0', '#c95d5d', '#7fae7a', '#d39a4f']; for (let k = 0; k < 2600; k++) { const px = Math.random() * W, y0 = 90 + Math.sin(px * 0.012) * 26 + Math.sin(px * 0.031) * 12, py = y0 + Math.random() * (H - y0); x.fillStyle = c[Math.floor(Math.random() * c.length)]; x.fillRect(px, py, R0(6, 12), R0(5, 9)); } },
  karst: (x, W) => { for (const [c, base, h0, h1] of [['#a9c3c0', 150, 70, 130], ['#7ea096', 180, 50, 110], ['#55806a', 215, 30, 85]]) { x.fillStyle = c; for (let px = -30; px < W + 30; px += R0(26, 60)) { const h = R0(h0, h1), w = R0(18, 34); x.beginPath(); x.moveTo(px - w, 256); x.lineTo(px - w * 0.9, base - h * 0.5); x.quadraticCurveTo(px - w * 0.6, base - h, px, base - h); x.quadraticCurveTo(px + w * 0.6, base - h, px + w * 0.9, base - h * 0.5); x.lineTo(px + w, 256); x.fill(); } x.fillRect(0, base, W, 256 - base); } },
  toy: (x, W) => bump(x, W, 160, 20, 80, ['#ffd86b', '#7fe08a', '#5cc8ff'], 70),
  savanna: (x, W) => { // colinas de sabana con acacias en silueta, y un volcán al fondo
    for (const [c, b, h0, h1] of [['#d8b27c', 176, 14, 40], ['#c19a62', 196, 10, 28]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, 256); x.lineTo(0, b); for (let px = 0; px <= W; px += 32) x.lineTo(px, b - R0(h0, h1) * (0.6 + 0.4 * Math.sin(px * 0.011))); x.lineTo(W, 256); x.fill(); }
    x.fillStyle = '#b79269'; x.beginPath(); x.moveTo(W * 0.34, 200); x.lineTo(W * 0.43, 112); x.lineTo(W * 0.47, 104); x.lineTo(W * 0.52, 112); x.lineTo(W * 0.62, 200); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(W * 0.43, 112); x.lineTo(W * 0.47, 104); x.lineTo(W * 0.52, 112); x.lineTo(W * 0.49, 122); x.lineTo(W * 0.46, 118); x.fill();
    x.fillStyle = '#4a4a2a'; for (let px = 20; px < W; px += R0(60, 160)) { const h = R0(16, 30), w = h * R0(1.6, 2.4); x.fillRect(px - 1.5, 206 - h * 0.55, 3, h * 0.55); x.beginPath(); x.ellipse(px, 206 - h * 0.6, w / 2, h * 0.2, 0, 0, 6.283); x.fill(); }
  },
};
const lerp = (a, b) => R0(a, b);

function ring(scene, kind, r, cx, cz, h, tint, repeat, fog = true) {
  const t = tex('r:' + kind, 2048, 256, RINGS[kind], true); t.repeat.set(repeat, 1);
  const g = new THREE.CylinderGeometry(r, r, h, 72, 1, true).translate(0, h / 2 - 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, fog, color: tint }));
  m.position.set(cx, 0, cz); m.frustumCulled = false; scene.add(m);
}
// árboles-imagen sueltos para decorados propios: list = [x, z, y, azar]
export function spriteField(scene, kind, list, h0, h1, wf = 0.82) {
  if (!list.length) return; const D = new THREE.Object3D(), c = new THREE.Color(), a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), g = mergeGeometries([a, a.clone().rotateY(Math.PI / 2)]), m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: spriteTex(kind), alphaTest: 0.5, side: THREE.DoubleSide }), list.length);
  list.forEach((s, k) => { const h = h0 + s[3] * (h1 - h0), v = 0.78 + (k % 7) * 0.05; D.position.set(s[0], s[2] - 0.15, s[1]); D.rotation.set(0, s[3] * 6.283, 0); D.scale.set(h * wf, h, h * wf); D.updateMatrix(); m.setMatrixAt(k, D.matrix); m.setColorAt(k, c.setRGB(v, v, v * 0.95)); });
  m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m);
}
export function backdrop(scene, kind, cx, cz, R, near = 260, night = false) { ring(scene, kind, R + near + 240, cx, cz, 110, night ? 0xffffff : 0xdfe6ee, 5, !night); ring(scene, kind, R + near, cx, cz, 58, 0xffffff, 8, !night); }

// ---- objetos: geometrías con color por vértice, unidas en una sola malla por tipo ----
const C = (geo, hex) => { const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(hex); c.convertSRGBToLinear && 0; for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const B = (w, h, d, x, y, z, hex) => C(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const Cy = (r0, r1, h, n, x, y, z, hex) => C(new THREE.CylinderGeometry(r0, r1, h, n).translate(x, y, z), hex);
const merge = (l) => mergeGeometries(l);
const roof4 = (w, h, y, hex) => C(new THREE.ConeGeometry(w, h, 4).rotateY(Math.PI / 4).translate(0, y, 0), hex);
// casa-seta: tronco habitable con puerta, ventanas y chimenea, y un gran sombrero
const shroomHouse = (cap) => () => merge([Cy(3.2, 3.8, 4.6, 14, 0, 2.3, 0, 0xf4e6c4), Cy(5.8, 5.8, 0.3, 14, 0, 4.7, 0, 0xcdb88c), C(new THREE.SphereGeometry(6, 14, 8, 0, 6.283, 0, 1.6).scale(1, 0.72, 1).translate(0, 4.7, 0), cap), B(1.4, 2.4, 0.3, 0, 1.2, 3.55, 0x8a5a30), B(1, 1, 0.2, -2, 2.6, 2.95, 0xffd97a), B(1, 1, 0.2, 2, 2.6, 2.95, 0xffd97a), Cy(0.45, 0.55, 2.2, 8, 2.4, 9, 0.6, 0x9a8a78)]);
const PROPS = {
  shroomA: shroomHouse(0xf0a020), shroomB: shroomHouse(0x19a7a7), shroomC: shroomHouse(0x8a5fd8),
  house: () => merge([B(7, 3.4, 6, 0, 1.7, 0, 0xe8dfcf), roof4(5.4, 2.2, 4.5, 0xb5583a), B(1, 1.9, 0.1, 0, 0.95, 3.03, 0x5a3a26), B(1.1, 1.1, 0.1, -2.2, 2, 3.03, 0x2b3a46), B(1.1, 1.1, 0.1, 2.2, 2, 3.03, 0x2b3a46)]),
  barn: () => merge([B(11, 4.2, 7, 0, 2.1, 0, 0x9a3a2c), roof4(7.4, 2.6, 5.5, 0x4a4a48), B(2.4, 2.6, 0.1, 0, 1.3, 3.53, 0xe8e0d0)]),
  chalet: () => merge([B(8, 3.2, 7, 0, 1.6, 0, 0x7a5233), roof4(6.8, 3, 4.7, 0xf2f6fa), B(8.6, 0.25, 1.1, 0, 3, 3.8, 0x5a3a26), B(1.2, 1.2, 0.1, -2, 2, 3.53, 0x26323e), B(1.2, 1.2, 0.1, 2, 2, 3.53, 0x26323e)]),
  adobe: () => merge([B(7, 3, 7, 0, 1.5, 0, 0xcfa577), B(7.4, 0.3, 7.4, 0, 3.1, 0, 0xb98a5c), B(1.1, 2, 0.1, 0, 1, 3.53, 0x2f6fa0), B(0.9, 0.9, 0.1, 2.2, 2, 3.53, 0x2b3a46)]),
  hut: () => merge([Cy(3, 3.2, 2.2, 10, 0, 1.1, 0, 0x9a7a4e), C(new THREE.ConeGeometry(4.6, 3.6, 10).translate(0, 3.9, 0), 0xb59a55), C(new THREE.ConeGeometry(3.2, 2.2, 10).translate(0, 5, 0), 0x8f7a40), B(1.2, 1.7, 0.2, 0, 0.85, 3.05, 0x241a12), Cy(0.09, 0.09, 2.6, 5, -1, 1.3, 3.6, 0x5a3f24), Cy(0.09, 0.09, 2.6, 5, 1, 1.3, 3.6, 0x5a3f24)]),
  camper: () => merge([B(2.3, 2.4, 6, 0, 1.6, 0, 0xf0f0ea), B(2.34, 0.5, 6.04, 0, 1.2, 0, 0x2f6fb0), B(2.32, 0.8, 1.6, 0, 2.2, 2.1, 0x2b3a46), B(2.3, 0.5, 5, 0, 0.45, 0, 0x2a2c30)]),
  tent: () => merge([C(new THREE.ConeGeometry(2.6, 2.6, 4).rotateY(Math.PI / 4).translate(0, 1.3, 0), 0xe9e4d4), B(0.9, 1.3, 0.1, 0, 0.65, 1.82, 0x2c3340)]),
  car: () => merge([B(1.9, 0.75, 4.4, 0, 0.62, 0, 0xffffff), B(1.7, 0.62, 2.2, 0, 1.3, -0.2, 0x2b3a46)]),
  hay: () => C(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 12).rotateZ(Math.PI / 2).translate(0, 0.95, 0), 0xd7b45a),
  rock: () => C(new THREE.IcosahedronGeometry(1.2, 0).translate(0, 0.7, 0), 0x8d8a80),
  fence: () => merge([B(7, 0.12, 0.08, 0, 1.05, 0, 0x8a6c48), B(7, 0.12, 0.08, 0, 0.6, 0, 0x8a6c48), B(0.14, 1.3, 0.14, -3.4, 0.65, 0, 0x6f5638), B(0.14, 1.3, 0.14, 0, 0.65, 0, 0x6f5638), B(0.14, 1.3, 0.14, 3.4, 0.65, 0, 0x6f5638)]),
  pylon: () => merge([Cy(0.25, 2.2, 26, 4, 0, 13, 0, 0x8c9096), B(11, 0.3, 0.3, 0, 23, 0, 0x8c9096), B(8, 0.3, 0.3, 0, 26, 0, 0x8c9096)]),
  turbine: () => { const blade = (a) => C(new THREE.BoxGeometry(0.5, 15, 0.14).translate(0, 7.5, 0).rotateZ(a).translate(0, 42, 1.3), 0xf2f4f6); return merge([Cy(0.7, 1.6, 42, 8, 0, 21, 0, 0xeef0f2), B(1.5, 1.5, 3, 0, 42, 0, 0xe4e6e8), blade(0), blade(2.094), blade(4.188)]); },
  mushroom: () => merge([Cy(0.8, 1, 2.4, 10, 0, 1.2, 0, 0xfff1d6), C(new THREE.SphereGeometry(2.4, 12, 7, 0, 6.283, 0, 1.6).translate(0, 2.3, 0), 0xffffff)]),
  pipe: () => merge([Cy(1.7, 1.7, 3.6, 14, 0, 1.8, 0, 0x2fb04a), Cy(2.1, 2.1, 1, 14, 0, 4, 0, 0x37c455)]),
  block: () => merge([B(2.6, 2.6, 2.6, 0, 6, 0, 0xffc62e), B(0.8, 1.1, 2.7, 0, 6, 0, 0xc27a10)]),
  coin: () => C(new THREE.CylinderGeometry(1, 1, 0.22, 14).rotateX(Math.PI / 2).translate(0, 4.5, 0), 0xffd23a),
};

// [sprites por capa] near/mid/far = cantidad a densidad 1; sc = altura en metros; tint = variación de color
const CFG = {
  pruebas: { flower: 1, ring: 'trees', spr: [['pine', 13, 20], ['olive', 5, 8], ['poplar', 14, 22]], bush: 'bush', near: 460, mid: 950, far: 950, gr: [0x5c7a44, 0x75693f, 0x88844f], props: { house: 14, barn: 6, hay: 46, rock: 60, fence: 34, camper: 16, pylon: 6, turbine: 8, car: 18 }, crowd: 1, birds: 1 },
  monaco: { ring: 'city', urban: 1, spr: [['palm', 11, 15]], near: 0, mid: 120, far: 260, gr: [], props: {}, crowd: 0 },
  spa: { ring: 'pines', spr: [['pine', 18, 30], ['poplar', 16, 22]], bush: 'fern', near: 380, mid: 900, far: 900, gr: [0x2f4a2a, 0x3e3a26], props: { camper: 30, tent: 26, rock: 40, fence: 26, car: 20 }, crowd: 0.6, tint: 0.62 },
  valle: { flower: 1, ring: 'favela', spr: [['broad', 11, 17], ['palm', 10, 15]], bush: 'bush', near: 420, mid: 800, far: 750, gr: [0x63a052, 0x8b8a4c], props: { house: 80, car: 24, rock: 30, fence: 24, pylon: 6 }, houseTint: [0xf08a6a, 0xf0cc70, 0x9cc4dc, 0xf4ecdc, 0xdc6a6a, 0x90c08a], crowd: 1, birds: 1 },
  desierto: { ring: 'mesa', spr: [['saguaro', 5, 9]], bush: 'dry', near: 300, mid: 360, far: 380, gr: [0xc29a68, 0xb08458, 0xd2ad7e], props: { adobe: 26, rock: 170, tent: 10, car: 16, fence: 24, pylon: 5 }, rockTint: [0xb5835a, 0xa3714a, 0xc49468], crowd: 0.8, birds: 1 },
  neon: { ring: 'neon', night: 1, spr: [], near: 0, mid: 0, far: 0, gr: [], props: {}, crowd: 0.7, towers: 130 },
  nieve: { ring: 'snow', spr: [['snowpine', 14, 24]], bush: null, near: 380, mid: 900, far: 900, gr: [0xe4edf6, 0xd2deea], props: { chalet: 24, rock: 40, pylon: 8, car: 12, fence: 20 }, rockTint: [0xdbe6ef, 0xc4d0dc], crowd: 0.7, birds: 0 },
  prisma: { ring: 'toy', spr: [['toytree', 7, 12]], near: 220, mid: 420, far: 300, gr: [], tintList: [0xff6b6b, 0x6bc4ff, 0xffe06b, 0x7be08a, 0xc79bff, 0xffa66b], props: { shroomA: 16, shroomB: 16, shroomC: 16, mushroom: 60, pipe: 34, block: 34, coin: 50 }, mushTint: [0xe5352f, 0xf0a020, 0x3aa0e8, 0x46c060], crowd: 0.6, people: 'shroom', shirts: [0xf0a020, 0x19a7a7, 0x7a4fd0, 0x8fc23a, 0xe0689a, 0x3aa0e8] },
  amazonas: { flower: 1, ring: 'jungle', spr: [['jungle', 30, 58], ['palm', 14, 24], ['broad', 16, 28]], bush: 'fern', near: 700, mid: 1100, far: 900, gr: [0x2a5a2c, 0x3a4a26], props: { hut: 48, rock: 40 }, crowd: 0.55, people: 'tribe', shirts: [0xc2452d, 0xd9a13b, 0x3f8a4a, 0xe8d9b0, 0x2f7fa0, 0x9a6a30] },
  karting: { flower: 1, ring: 'trees', spr: [['broad', 10, 16], ['poplar', 13, 20]], bush: 'bush', near: 260, mid: 620, far: 700, gr: [0x5c8444, 0x6a7a44], props: { camper: 16, tent: 14, car: 26, hay: 22, fence: 16 }, crowd: 0.5, birds: 1 },
  asupark: { flower: 1, ring: 'trees', spr: [['olive', 6, 9], ['broad', 10, 15]], bush: 'bush', near: 240, mid: 560, far: 640, gr: [0x7a8050, 0x8a8354], props: { camper: 12, tent: 10, car: 24, hay: 18, house: 8 }, crowd: 0.5, birds: 1 },
  rally: { flower: 0, ring: 'savanna', spr: [['acacia', 8, 13], ['baobab', 8, 12]], bush: 'dry', near: 260, mid: 520, far: 520, gr: [0xb08a52, 0xa27a46, 0xc29a5e], props: { hut: 34, rock: 150, hay: 40, tent: 18, car: 22, fence: 22, adobe: 8 }, rockTint: [0xb5835a, 0xa3714a, 0xc9a37a], houseTint: [0xe8c9a0], crowd: 1.0, birds: 1, shirts: [0xe8332a, 0xffd23a, 0x1f9a4a, 0x2a6fd0, 0xf2f2f2, 0xff7a1a, 0xe8559a, 0x111111] },
  kartlos: { ring: 'city', spr: [['palm', 9, 14]], bush: 'dry', near: 180, mid: 360, far: 320, gr: [0xcbb48a, 0xd9c49a], props: { car: 26, tent: 10, adobe: 10, rock: 30 }, rockTint: [0xc7ad84], crowd: 0.5, birds: 1 },
};

export function fillWorld(tr, th, scene, rng, q, clearance, cxm, czm, R) {
  const cfg = CFG[th.id]; if (!cfg) return;
  const dens = q.density, n = (v) => Math.round(v * dens), D = new THREE.Object3D();
  const stand = !th.surround && th.deco !== 'kart' ? tr.stand : null;
  const inStand = (x, z) => { if (!stand) return false; const dx = x - tr.X[stand.i], dz = z - tr.Z[stand.i], ou = (-dx * tr.TZ[stand.i] + dz * tr.TX[stand.i]) * stand.side; return Math.abs(dx * tr.TX[stand.i] + dz * tr.TZ[stand.i]) < 32 && ou > stand.lat - 1 && ou < stand.lat + 10; };
  const harbor = (x, z) => inStand(x, z) || (th.harbor && Math.abs(x - 118) < 130 && Math.abs(z + 125) < 150);
  const walkW = (i, side) => (tr.walk ? tr.walk.W[side > 0 ? 1 : 0][i] : 0);
  const groundAt = (i, l, side) => Math.max(0, tr.Y[i] * (1 - (l - WALL - walkW(i, side)) / (2.5 + 1.1 * tr.Y[i])));
  const lMin = cfg.urban ? WALL + 30 : WALL + 1.5;
  const near = (count, a, b, r = 1.2) => { const out = []; for (let g = 0; out.length < count && g < count * 14; g++) { const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, l = Math.max(lMin, a + rng() * (b - a), WALL + walkW(i, side) + 0.8), x = tr.X[i] - tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side; if (!harbor(x, z) && clearance(x, z, WALL + r)) out.push([x, z, groundAt(i, l, side), rng()]); } return out; };
  const far = (count) => { const out = []; for (let g = 0; out.length < count && g < count * 6; g++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * (R + 230), x = cxm + Math.cos(a) * d, z = czm + Math.sin(a) * d; if (!harbor(x, z) && clearance(x, z, WALL + 14)) out.push([x, z, 0, rng()]); } return out; };
  backdrop(scene, cfg.ring, cxm, czm, R, 260, !!cfg.night);
  const plane = () => { const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), b = a.clone().rotateY(Math.PI / 2); return mergeGeometries([a, b]); };
  const base = new THREE.Color();
  const sprites = (kind, list, h0, h1, wf = 0.82) => {
    if (!list.length) return; const m = new THREE.InstancedMesh(plane(), new THREE.MeshBasicMaterial({ map: spriteTex(kind), alphaTest: 0.5, side: THREE.DoubleSide }), list.length), L = cfg.tint || 1;
    list.forEach((s, k) => { const h = h0 + s[3] * (h1 - h0); D.position.set(s[0], s[2] - 0.15, s[1]); D.rotation.set(0, s[3] * 6.283, 0); D.scale.set(h * wf, h, h * wf); D.updateMatrix(); m.setMatrixAt(k, D.matrix);
      if (cfg.tintList) m.setColorAt(k, base.setHex(cfg.tintList[k % cfg.tintList.length])); else { const v = L * (0.78 + (k % 7) * 0.05); m.setColorAt(k, base.setRGB(v, v * (0.97 + (k % 3) * 0.02), v * 0.95)); } });
    m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m);
  };
  const S = cfg.spr, each = S.length || 1;
  const LUSH = 1.6;
  S.forEach(([k, h0, h1]) => sprites(k, near(n((LUSH * cfg.near) / each), WALL + 3, WALL + 38, 2.5).concat(near(n((LUSH * cfg.mid) / each), WALL + 38, WALL + 190, 6), far(n((LUSH * cfg.far) / each))), h0, h1));
  if (cfg.bush) sprites(cfg.bush, near(n(cfg.near * 1.6), WALL + 1.2, WALL + 34), 0.9, 2.4, 1.3);
  if (cfg.flower) sprites('flower', near(n(520), WALL + 1, WALL + 70), 0.5, 1.1, 1.5);
  // manchas en el suelo: rompen el color liso sin geometría relevante
  if (cfg.gr.length) { const list = near(n(320), WALL + 6, WALL + 150, 22), m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    list.forEach((s, k) => { const r = 7 + s[3] * 20; D.position.set(s[0], 0.05 + k * 0.0004, s[1]); D.rotation.set(0, s[3] * 6, 0); D.scale.set(r, 1, r * (0.55 + s[3] * 0.4)); D.updateMatrix(); m.setMatrixAt(k, D.matrix); m.setColorAt(k, base.setHex(cfg.gr[k % cfg.gr.length])); });
    if (list.length) { m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m); } }
  // objetos
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const carCols = [0xc8102e, 0x2a4f9a, 0xe8e8ea, 0x23262c, 0xb9bcc2, 0xe0a020];
  for (const name in cfg.props) {
    const big = name === 'turbine' || name === 'pylon', list = big ? far(n(cfg.props[name])) : name === 'fence' || name === 'hay' || name === 'rock' ? near(n(cfg.props[name]), WALL + 3, WALL + 70, 3) : near(n(cfg.props[name]), WALL + 8, WALL + 140, 9);
    if (!list.length) continue;
    const tints = name === 'house' ? cfg.houseTint : name === 'rock' ? cfg.rockTint : name === 'mushroom' ? cfg.mushTint : name === 'car' ? carCols : null;
    const m = new THREE.InstancedMesh(PROPS[name](), propMat, list.length);
    list.forEach((s, k) => { const sc = name === 'rock' ? 0.5 + s[3] * 2.4 : name === 'turbine' || name === 'pylon' ? 1 : 0.85 + s[3] * 0.35; D.position.set(s[0], s[2], s[1]); D.rotation.set(0, name === 'turbine' ? 0.6 : s[3] * 6.283, 0); D.scale.setScalar(sc); D.updateMatrix(); m.setMatrixAt(k, D.matrix); if (tints) m.setColorAt(k, base.setHex(tints[k % tints.length])); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m);
  }
  // torres iluminadas de la ciudad nocturna
  if (cfg.towers) { const list = near(n(cfg.towers), WALL + 34, WALL + 210, 14), t = tex('towerN', 128, 256, (x, W, H) => { x.fillStyle = '#10141f'; x.fillRect(0, 0, W, H); const c = ['#ffd27a', '#5ff0ff', '#ff5fc4', '#fff4c8']; for (let wy = 4; wy < H; wy += 10) for (let wx = 4; wx < W; wx += 10) if (Math.random() < 0.55) { x.fillStyle = c[Math.floor(Math.random() * c.length)]; x.fillRect(wx, wy, 6, 6); } });
    const roof = new THREE.MeshBasicMaterial({ color: 0x0c0f18 }), side = new THREE.MeshBasicMaterial({ map: t }), m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [side, side, roof, roof, side, side], list.length);
    list.forEach((s, k) => { const w = 14 + s[3] * 16; D.position.set(s[0], 0, s[1]); D.rotation.set(0, s[3] * 3, 0); D.scale.set(w, 30 + (k % 9) * 13, w); D.updateMatrix(); m.setMatrixAt(k, D.matrix); });
    if (list.length) { m.frustumCulled = false; scene.add(m); } }
  // gente: grupos animando junto a las vallas, paseantes en distintas direcciones y, en la ciudad, gente en los balcones
  // gente sobre el paso de peatones: a la altura de la pista, nunca flotando
  const items = [], yawTo = (dx, dz) => Math.atan2(dx, dz), palette = cfg.shirts || SHIRTS, shirt = (k) => palette[k % palette.length];
  const bankY = (i, side) => (tr.bank ? Math.max(0, Math.tan(tr.bank[i]) * side * WALL) : 0) + Math.min(0, tr.bank ? Math.tan(tr.bank[i]) * side * WALL : 0);
  const onPath = (x, z, W) => clearance(x, z, WALL + 0.6) && !clearance(x, z, WALL + W - 0.15);
  if (cfg.crowd) {
    for (let g = 0; g < 34; g++) { const i0 = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, per = n(36 * cfg.crowd); for (let k = 0; k < per; k++) { const i = (i0 + Math.floor(rng() * 42)) % tr.N, W = walkW(i, side); if (W < 2) continue; const l = WALL + 0.8 + rng() * (W - 1.3), x = tr.X[i] - tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side; if (clearance(x, z, WALL + 0.6)) items.push([x, tr.Y[i] + bankY(i, side), z, yawTo(tr.TZ[i] * side, -tr.TX[i] * side) + (rng() - 0.5) * 0.7, crowdType(rng()), 0, 0, shirt(items.length)]); } }
    for (let g = 0, c = n(280 * cfg.crowd), tries = 0; g < c && tries < c * 14; tries++) { const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, W = walkW(i, side); if (W < 2) continue; const l = WALL + 0.8 + rng() * (W - 1.3), len = 8 + rng() * 26, x = tr.X[i] - tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side, yaw = Math.atan2(tr.TX[i], tr.TZ[i]) + (rng() < 0.5 ? Math.PI : 0), ex = Math.sin(yaw) * len * 0.5, ez = Math.cos(yaw) * len * 0.5; if (onPath(x + ex, z + ez, W) && onPath(x - ex, z - ez, W) && !harbor(x, z)) { items.push([x, tr.Y[i] + bankY(i, side), z, yaw, WALK, 1.1 + rng() * 0.8, len, shirt(items.length + 3)]); g++; } }
  }
  // tribuna principal llena
  if (stand) { const im = stand.i, sd = stand.side, tx = tr.TX[im], tz = tr.TZ[im], psi = Math.atan2(tx, tz), y0 = tr.Y[im] + bankY(im, sd); for (let k = 0, c = n(190); k < c; k++) { const t = Math.floor(rng() * 6), lx = stand.lat + t * 0.72, lz = (rng() - 0.5) * 50; items.push([tr.X[im] - tz * lx * sd + tx * lz, y0 + 0.42 * (t + 1), tr.Z[im] + tx * lx * sd + tz * lz, psi + (Math.PI / 2) * sd + (rng() - 0.5) * 0.5, rng() < 0.3 ? 2 : 1, 0, 0, shirt(k)]); } }
  if (q.urbanInfo) {
    const { items: blocks, balconies } = q.urbanInfo, wanted = n(170), every = Math.max(1, Math.floor(balconies.length / wanted));
    balconies.forEach((b, k) => { if (k % every) return; const fx = Math.cos(b.ry) * b.face, fz = -Math.sin(b.ry) * b.face; items.push([b.x, b.y + 0.1, b.z, yawTo(fx, fz), rng() < 0.5 ? CHEER : IDLE, 0, 0, shirt(k)]); });
    let g = 0; const cap = n(240); for (let s2 = 0; s2 < tr.len && g < cap; s2 += 4.5) { const i = Math.floor(s2 / tr.ds) % tr.N; for (const side of [-1, 1]) { const W = walkW(i, side); if (W < 1.8) continue; const l = WALL + 0.8 + rng() * (W - 1.2), x = tr.X[i] - tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side; if (!clearance(x, z, WALL + 0.6) || harbor(x, z) || blocks.some((b) => (b.x - x) ** 2 + (b.z - z) ** 2 < (Math.max(b.d, b.w) * 0.72 + 1) ** 2)) continue; const walk = rng() < 0.45, yaw = walk ? Math.atan2(tr.TX[i], tr.TZ[i]) + (rng() < 0.5 ? Math.PI : 0) : yawTo(tr.TZ[i] * side, -tr.TX[i] * side) + (rng() - 0.5) * 0.7; items.push([x, tr.Y[i] + bankY(i, side), z, yaw, walk ? WALK : crowdType(rng()), 1.1 + rng() * 0.7, walk ? 5 + rng() * 6 : 0, shirt(g)]); g++; } }
  }
  npcMesh(scene, items, cfg.people || 'human');

}
export const fillerBirds = (id) => !!(CFG[id] && CFG[id].birds);
