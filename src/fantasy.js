// Circuitos de fantasía con decorado propio y animado:
//  - Bahía Lumen: paseo marítimo al anochecer, un ocho con puente, noria y tiovivo girando, faro con haz, barcas y fuegos artificiales.
//  - Valle Pop: colinas de dibujos animados, muros de bloques de colores, globos aerostáticos, molinos, molinillos y grada con público.
// Todo es geometría propia: color por vértice con sombreado horneado, texturas pequeñas pintadas en canvas, mallas fusionadas
// por material o repetidas por instancias. Lo que se mueve lo hace con funciones que se llaman cada fotograma (anim).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL } from './track.js';

import { LUMEN, POP } from './fantasy-data.js';
export { LUMEN, POP };

// ---------- ruido y utilidades ----------
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), l = (p, q, t) => p + (q - p) * t; return l(l(hash(xi, yi), hash(xi + 1, yi), a), l(hash(xi, yi + 1), hash(xi + 1, yi + 1), a), b); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 11, y * 4.3 + 5) * 0.15;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rnd = (k) => hash(k * 1.37, k * 0.71);
const TAU = Math.PI * 2;

function tex(w, h, paintFn, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paintFn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const speck = (x, W, H, n, rgba, s0 = 1, s1 = 4, seed = 0) => { for (let i = 0; i < n; i++) { x.fillStyle = rgba(i); x.fillRect(rnd(i + seed) * W, rnd(i + seed + 999) * H, s0 + rnd(i + seed + 3) * s1, s0 + rnd(i + seed + 7) * s1); } };
const grassTex = (base, dots) => tex(256, 256, (x, W, H) => { x.fillStyle = base; x.fillRect(0, 0, W, H); speck(x, W, H, 2600, (i) => dots[i % dots.length], 1, 3, 5); });
const stoneTex = () => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#6b6258'; x.fillRect(0, 0, W, H); let k = 0;
  for (let y = 0; y < H; y += 16) for (let px = (y / 16) % 2 ? -12 : 0; px < W; px += 24) { const v = 175 + rnd(k++) * 60 | 0; x.fillStyle = `rgb(${v},${v - 8},${v - 22})`; x.fillRect(px + 1.5, y + 1.5, 21, 13); }
});
const plasterTex = () => tex(64, 64, (x, W, H) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); speck(x, W, H, 260, (i) => `rgba(${i % 2 ? 0 : 90},${i % 2 ? 0 : 70},0,0.05)`, 1, 3); });
// fachada: ventanas con persianas; con luz, el cristal brilla (canal alfa = luz, lo usa el material emisivo)
const facadeTex = (lit) => tex(128, 128, (x, W, H) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); speck(x, W, H, 200, () => 'rgba(80,60,40,0.05)', 1, 3);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const px = 16 + c * 64, py = 18 + r * 64, on = lit && rnd(r * 7 + c * 3 + 1) > 0.25;
    x.fillStyle = '#7c6a58'; x.fillRect(px - 3, py - 3, 38, 40);
    x.fillStyle = on ? '#ffd27a' : '#3d4a5c'; x.fillRect(px, py, 32, 34);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px + 15, py, 2, 34); x.fillRect(px, py + 16, 32, 2);
  }
});
const roofTex = () => tex(64, 64, (x, W, H) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 8) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, y, W, 2); for (let px = (y / 8) % 2 ? 4 : 0; px < W; px += 8) x.fillRect(px, y, 1, 8); } });
function waterNormals() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S), h = (u, v) => Math.sin((u + v) * TAU * 3) * 0.5 + Math.sin((v * 2 - u) * TAU * 5 + 1) * 0.3 + Math.sin((u * 3 + v * 2) * TAU * 7) * 0.2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = i / S, v = j / S, e = 1 / S, dx = (h(u + e, v) - h(u - e, v)) * 2, dy = (h(u, v + e) - h(u, v - e)) * 2, l = Math.hypot(dx, dy, 1), k = (j * S + i) * 4; im.data[k] = (-dx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function softTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

// ---------- geometría ----------
const C = new THREE.Color();
// color por vértice con oclusión horneada: la base de cada pieza, más oscura
function paint(g, hex, ao = 0.3) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  C.set(hex);
  for (let i = 0; i < n; i++) { const t = y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1, k = 1 - ao * (1 - t); col[i * 3] = C.r * k; col[i * 3 + 1] = C.g * k; col[i * 3 + 2] = C.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// franjas de colores alrededor (globos, toldos, tiovivo): color según el ángulo
function stripes(g, cols, n = cols.length * 2, ao = 0.15) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, col = new Float32Array(p.count * 3);
  let y0 = 1e9, y1 = -1e9; for (let i = 0; i < p.count; i++) { y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
  for (let t = 0; t < p.count; t += 3) {
    let ax = 0, az = 0; for (let k = 0; k < 3; k++) { ax += p.getX(t + k); az += p.getZ(t + k); }
    const a = (Math.atan2(az, ax) + Math.PI) / TAU, c = cols[Math.floor(a * n) % cols.length];
    for (let k = 0; k < 3; k++) { C.set(c); const s = 1 - ao * (1 - (p.getY(t + k) - y0) / ((y1 - y0) || 1)); col[(t + k) * 3] = C.r * s; col[(t + k) * 3 + 1] = C.g * s; col[(t + k) * 3 + 2] = C.b * s; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2)); g.computeVertexNormals(); return g;
}
function boxM(w, h, d, sx = 3.4, sy = 3, round = true) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v, [fw, fh] = dims[f]; if (round && (f === 2 || f === 3)) { uv.setXY(k, 0.02, 0.6); continue; } const ru = round ? Math.max(1, Math.round(fw / sx)) : fw / sx, rv = round ? Math.max(1, Math.round(fh / sy)) : fh / sy; uv.setXY(k, uv.getX(k) * ru, uv.getY(k) * rv); }
  return g;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), E = new THREE.Euler();
const place = (g, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0) => g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, 0, 'YXZ')), S3.set(sx, sy, sz)));
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
function lumpy(g, amt, seed = 0) { g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (vnoise(x * 2.3 + seed, z * 2.3 + y * 1.7) - 0.5) * amt; p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.4), z * k); } g.computeVertexNormals(); return g; }
function hipRoof(W, D, rh) {
  const sw = W < D, A = sw ? D : W, Bd = sw ? W : D, rx = Math.max(0, (A - Bd) / 2), pos = [], uv = [];
  const tri = (p0, p1, p2, f) => { for (const p of [p0, p1, p2]) { pos.push(...p); uv.push(f ? p[2] / 2.4 : p[0] / 2.4, f ? p[0] / 2.4 : p[2] / 2.4); } };
  const e = [[-A / 2, 0, Bd / 2], [A / 2, 0, Bd / 2], [A / 2, 0, -Bd / 2], [-A / 2, 0, -Bd / 2]], r0 = [-rx, rh, 0], r1 = [rx, rh, 0];
  tri(e[0], e[1], r1, false); tri(e[0], r1, r0, false); tri(e[2], e[3], r0, false); tri(e[2], r0, r1, false); tri(e[1], e[2], r1, true); tri(e[3], e[0], r0, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  if (sw) g.rotateY(Math.PI / 2);
  return g;
}
const KEEP = ['position', 'normal', 'uv', 'color'];
function norm(g) { const o = g.index ? g.toNonIndexed() : g; if (!o.attributes.normal) o.computeVertexNormals(); if (!o.attributes.uv) o.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(o.attributes.position.count * 2), 2)); if (!o.attributes.color) paint(o, 0xffffff, 0); for (const a of Object.keys(o.attributes)) if (!KEEP.includes(a)) o.deleteAttribute(a); return o; }
const merge = (list) => mergeGeometries(list.map(norm));

// repetición por instancias: spots = [x, z, y, semilla, giro?]; size(r) => [ancho, alto]
function inst(G, geo, spots, size, color, mat, shadow = false, tint) {
  if (!spots.length) return null;
  const m = new THREE.InstancedMesh(norm(geo), mat, spots.length), d = new THREE.Object3D(), c = new THREE.Color();
  spots.forEach((s, k) => { const [w, h] = size(s[3]); d.position.set(s[0], s[2], s[1]); d.rotation.set(0, s[4] ?? s[3] * TAU, 0); d.scale.set(w, h, w); d.updateMatrix(); m.setMatrixAt(k, d.matrix); if (tint) m.setColorAt(k, c.set(tint(s[3], k))); else if (color != null) m.setColorAt(k, c.set(color)); });
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = shadow; G.add(m); return m;
}

// halos de luz que miran a cámara (aditivos)
function glowMesh(G, glows) {
  if (!glows.length) return null;
  const gm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vU; varying vec3 vC; varying float vF; void main(){ vU = uv; vC = instanceColor; vec3 ctr = instanceMatrix[3].xyz; float sz = length(instanceMatrix[0].xyz); vec4 mv = modelViewMatrix * vec4(ctr, 1.0); vF = 1.0 - 0.6 * smoothstep(260.0, 1200.0, -mv.z); mv.xy += position.xy * sz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vU; varying vec3 vC; varying float vF; void main(){ float d = clamp(1.0 - length(vU - 0.5) * 2.0, 0.0, 1.0); float a = pow(d, 2.2) + 0.5 * pow(d, 6.0); gl_FragColor = vec4(vC * vF, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const gl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), gm, glows.length), c3 = new THREE.Color();
  glows.forEach((g2, k) => { M4.compose(V.set(g2[0], g2[1], g2[2]), Q.identity(), S3.set(g2[3], g2[3], 1)); gl.setMatrixAt(k, M4); gl.setColorAt(k, c3.set(g2[4]).multiplyScalar(g2[5])); });
  gl.instanceColor.needsUpdate = true; gl.frustumCulled = false; gl.renderOrder = 3; G.add(gl); return gl;
}

// ---------- entorno común: distancia a la pista y terreno que respeta la calzada ----------
function trackTools(tr) {
  const N = tr.N, cs = 16, gridT = new Map();
  for (let i = 0; i < N; i += 2) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (gridT.get(k) || gridT.set(k, []).get(k)).push(i); }
  const nearest = (x, z, r = 60) => { const a = Math.floor(x / cs), b = Math.floor(z / cs), rr = Math.ceil(r / cs); let best = r * r, bi = -1; for (let p = -rr; p <= rr; p++) for (let t = -rr; t <= rr; t++) { const l = gridT.get((a + p) + ',' + (b + t)); if (l) for (const j of l) { const d = (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2; if (d < best) { best = d; bi = j; } } } return [Math.sqrt(best), bi]; };
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < N; i += 4) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  return { N, roadDist: (x, z, r) => nearest(x, z, r)[0], nearest, side: (i, s, l) => [tr.X[i] - tr.TZ[i] * l * s, tr.Z[i] + tr.TX[i] * l * s], yawAt: (i) => Math.atan2(tr.TX[i], tr.TZ[i]), cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}
// terreno: junto a la pista, a su altura; lejos, el relieve pedido (target). Devuelve hAt(x, z) y la malla
function terrain(tr, T, q, target, colorAt, map, HALF = 820, emissive = 0x000000) {
  const L = WALL, mobile = q.density < 1, step = mobile ? 14 : 8, n = Math.ceil((2 * HALF) / step) + 1, x0 = T.cx - HALF, z0 = T.cz - HALF, id = (a, b) => b * n + a;
  const H = new Float32Array(n * n).fill(1e9), fixed = new Uint8Array(n * n), D = new Float32Array(n * n).fill(1e9);
  const mark = (x, z, y) => { const a = Math.round((x - x0) / step), b = Math.round((z - z0) / step); if (a < 0 || b < 0 || a >= n || b >= n) return; const k = id(a, b); fixed[k] = 1; D[k] = 0; if (y < H[k]) H[k] = y; };
  for (let i = 0; i < tr.N; i += 2) for (let l = -L - 1.5; l <= L + 1.5; l += step * 0.5) mark(tr.X[i] - tr.TZ[i] * l, tr.Z[i] + tr.TX[i] * l, tr.Y[i] - 0.4);
  const relax = (a, b, dd) => { if (D[b] + dd < D[a]) { D[a] = D[b] + dd; if (!fixed[a]) H[a] = H[b]; } };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = id(c, r); if (c) relax(k, k - 1, step); if (r) { relax(k, k - n, step); if (c) relax(k, k - n - 1, step * 1.414); if (c < n - 1) relax(k, k - n + 1, step * 1.414); } }
  for (let r = n - 1; r >= 0; r--) for (let c = n - 1; c >= 0; c--) { const k = id(c, r); if (c < n - 1) relax(k, k + 1, step); if (r < n - 1) { relax(k, k + n, step); if (c < n - 1) relax(k, k + n + 1, step * 1.414); if (c) relax(k, k + n - 1, step * 1.414); } }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const k = id(c, r); if (fixed[k]) continue; const x = x0 + c * step, z = z0 + r * step, t = target(x, z); H[k] = H[k] + (t - H[k]) * (t < -0.5 ? sstep(0.5, 6, D[k]) : sstep(3, 40, D[k])); }
  for (let t = 0; t < (mobile ? 2 : 4); t++) for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) { const k = id(c, r); if (!fixed[k] && H[k] > -1) H[k] = (H[k] * 2 + H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) / 6; }
  const hAt = (x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / step)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / step)), a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, k = id(a, b); return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + n] * (1 - u) + H[k + n + 1] * u) * v; };
  const slopeAt = (x, z) => Math.hypot(hAt(x + 4, z) - hAt(x - 4, z), hAt(x, z + 4) - hAt(x, z - 4)) / 8;
  const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), col = new Float32Array(n * n * 3), idx = new Uint32Array((n - 1) * (n - 1) * 6), c = new THREE.Color();
  for (let r = 0; r < n; r++) for (let q2 = 0; q2 < n; q2++) {
    const k = id(q2, r), x = x0 + q2 * step, z = z0 + r * step, y = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 9; uv[k * 2 + 1] = z / 9;
    colorAt(c, x, z, y, slopeAt(x, z)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  let t = 0; for (let r = 0; r < n - 1; r++) for (let q2 = 0; q2 < n - 1; q2++) { const k = id(q2, r); idx[t++] = k; idx[t++] = k + n; idx[t++] = k + 1; idx[t++] = k + 1; idx[t++] = k + n; idx[t++] = k + n + 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive })); mesh.frustumCulled = false; mesh.receiveShadow = !!q.shadows;
  return { hAt, mesh };
}
function waterPlane(G, cx, cz, y, size, shallow, deep, hAt, specular, shininess) {
  const seg = 64, g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).translate(cx, y, cz), p = g.attributes.position, col = new Float32Array(p.count * 3), sh = new THREE.Color(shallow), dp = new THREE.Color(deep), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const d = y - hAt(p.getX(i), p.getZ(i)); c.copy(sh).lerp(dp, sstep(0.3, 7, d)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const nm = waterNormals(); nm.repeat.set(size / 22, size / 22);
  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, specular, shininess, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7), transparent: true, opacity: 0.94 }));
  m.frustumCulled = false; m.renderOrder = 1; m.onBeforeRender = () => { const t = performance.now() / 1000; nm.offset.set(t * 0.007, t * 0.005); }; G.add(m);
}
// montañas lejanas alrededor (conos deformados, con nieve si son altas)
function mountains(G, cx, cz, count, rMin, rMax, cols, skip) {
  const geos = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU + hash(k, 3) * 0.3; if (skip && skip(a)) continue;
    const r = rMin + hash(k, 5) * (rMax - rMin), R = 180 + hash(k, 7) * 220, hg = 140 + hash(k, 9) * 260, mx = cx + Math.cos(a) * r, mz = cz + Math.sin(a) * r;
    const g = new THREE.ConeGeometry(R, hg, 16, 7), p = g.attributes.position;
    for (let v = 0; v < p.count; v++) { const y = p.getY(v), t = (y + hg / 2) / hg; if (t < 0.999) { const an = Math.atan2(p.getZ(v), p.getX(v)), j = 1 + (fbm(Math.cos(an) * 1.8 + k, Math.sin(an) * 1.8 + t * 4) - 0.5) * 0.6; p.setX(v, p.getX(v) * j); p.setZ(v, p.getZ(v) * j); } }
    g.translate(mx, hg / 2 - 25, mz); g.computeVertexNormals(); const gn = g.toNonIndexed(), q3 = gn.attributes.position, col = new Float32Array(q3.count * 3), lo = new THREE.Color(cols[0]), hi = new THREE.Color(cols[1]), snow = new THREE.Color(cols[2]), c = new THREE.Color();
    for (let v = 0; v < q3.count; v++) { const t = (q3.getY(v) + 25) / hg; c.copy(lo).lerp(hi, sstep(0.2, 0.8, t + (fbm(q3.getX(v) / 50, q3.getZ(v) / 50) - 0.5) * 0.3)); if (t > 0.78 && hg > 280) c.lerp(snow, 0.85); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; }
    gn.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(gn);
  }
  if (!geos.length) return;
  const m = new THREE.Mesh(merge(geos), new THREE.MeshLambertMaterial({ vertexColors: true })); m.frustumCulled = false; G.add(m);
}
// puente del cruce: tablero, pretiles y pilas allí donde la pista queda en el aire
function bridgeParts(tr, T, hAt, bins, color) {
  const L = WALL;
  for (let i = 0; i < tr.N; i += 2) {
    const gap = tr.Y[i] - hAt(tr.X[i], tr.Z[i]); if (gap < 2.2) continue;
    const yaw = T.yawAt(i);
    // tablero bajo la calzada
    bins.stone.push(paint(place(boxM(2 * L + 1.2, 1.1, 2.3, 3, 1.1), tr.X[i], tr.Y[i] - 0.75, tr.Z[i], yaw), color, 0.35));
    // pilas fuera del paso de abajo
    if (i % 12 === 0) for (const l of [-L * 0.6, 0, L * 0.6]) { const [x, z] = T.side(i, 1, l), [dd, j] = T.nearest(x, z, 30); if (j >= 0 && Math.abs(tr.Y[j] - tr.Y[i]) > 3 && dd < L + 1.5) continue; const h = tr.Y[i] - 1.2 - hAt(x, z) + 1; if (h > 1) bins.stone.push(paint(place(boxM(1.8, h, 1.8, 2, 2), x, tr.Y[i] - 1.2 - h / 2, z, yaw), color, 0.45)); }
  }
}

// ============================================================================================
// Bahía Lumen
// ============================================================================================
export function lumenDecor(tr, th, scene, q, anim) {
  const L = WALL, mobile = q.density < 1, shadow = !!q.shadows, G = new THREE.Group(); scene.add(G);
  const T = trackTools(tr), N = tr.N, SEA = 0;
  const bins = { plain: [], stone: [], plaster: [], facade: [], roof: [], lit: [] }, glows = [];
  const glow = (x, y, z, size, hex, k) => glows.push([x, y, z, size, hex, k]);
  // costa: el mar al norte del paseo; promontorio del faro al este; el pueblo sube hacia el sur
  const shoreZ = (x) => -17 + 3 * Math.sin(x / 45) - Math.max(0, x - 140) * 0.9 + Math.max(0, -200 - x) * 0.6;
  const LH = [178, -52];
  const target = (x, z) => {
    const prom = 13 * (1 - sstep(10, 46, Math.hypot(x - LH[0], z - LH[1])));
    const s = z - shoreZ(x);
    if (s < 0 && prom < 1) return SEA - 1.5 - Math.min(-s, 50) * 0.16;
    return Math.max(prom, 0.8 + Math.min(Math.max(s, 0), 20) * 0.04 + sstep(150, 420, z) * (30 + 40 * fbm(x / 200, z / 200)) + 3 * fbm(x / 60, z / 60) * sstep(0, 40, s));
  };
  const cGrass = new THREE.Color(0x5f7d3b), cGrass2 = new THREE.Color(0x46642c), cSand = new THREE.Color(0xd9c49a), cRock = new THREE.Color(0x8b8378), cWet = new THREE.Color(0x6f6550);
  const cPave = new THREE.Color(0xd8c8ae);
  const { hAt, mesh } = terrain(tr, T, q, target, (c, x, z, y, sl) => { c.copy(cGrass).lerp(cGrass2, sstep(0.35, 0.7, fbm(x / 30, z / 30))).lerp(cRock, sstep(0.7, 1.4, sl)); if (y < 1.4) c.lerp(y < SEA ? cWet : cSand, 0.9); c.multiplyScalar(0.9 + 0.3 * fbm(x / 13 + 4, z / 13)); if (Math.hypot(x + 25, z - 172) < 26 || Math.hypot(x - 18, z - 178) < 12) c.copy(cPave); }, grassTex('#9a9a94', ['#8a8a82', '#aaaaa2', '#7e7e76']), 820, 0x1c1a20);
  G.add(mesh);
  waterPlane(G, T.cx, T.cz - 500, SEA, 2600, 0x3a8f9a, 0x173a63, hAt, 0xffa868, 60);

  // ---- pretil del paseo: zócalo de piedra con barandilla blanca, en todo el borde (ahí está el muro de la física) ----
  {
    const rail = paint(merge([paint(boxM(2.1, 0.75, 0.55, 2, 0.75).translate(0, 0.37, 0), 0xc9bba4, 0.35), paint(B(2.12, 0.12, 0.62).translate(0, 0.8, 0), 0xf1ece2, 0), paint(B(0.16, 0.55, 0.16).translate(-0.7, 1.1, 0), 0xf6f2ea, 0.1), paint(B(0.16, 0.55, 0.16).translate(0.7, 1.1, 0), 0xf6f2ea, 0.1), paint(B(2.1, 0.09, 0.14).translate(0, 1.38, 0), 0xf6f2ea, 0)]), 0xffffff, 0);
    const spots = [];
    for (const s of [-1, 1]) for (let i = 0; i < N; i += 2) { const [x, z] = T.side(i, s, L + 0.3); spots.push([x, z, tr.Y[i] - 0.05, 0, T.yawAt(i) + Math.PI / 2]); }
    inst(G, rail, spots, () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTex() }), shadow);
  }
  bridgeParts(tr, T, hAt, bins, 0xb9a88e);

  // ---- farolas a lo largo de toda la pista y guirnaldas de bombillas en el paseo ----
  const lampPts = [];
  for (const s of [-1, 1]) for (let i = (s > 0 ? 0 : 13); i < N; i += 26) { const [x, z] = T.side(i, s, L + 1.1); lampPts.push([x, z, tr.Y[i], i, s]); }
  {
    const post = merge([paint(cyl(0.09, 0.13, 4.6, 6).translate(0, 2.3, 0), 0x2b3340, 0.3), paint(cyl(0.22, 0.26, 0.35, 8).translate(0, 0.17, 0), 0x2b3340, 0.2), paint(B(0.9, 0.07, 0.07).translate(0.35, 4.5, 0), 0x2b3340, 0)]);
    inst(G, post, lampPts.map((p) => [p[0], p[1], p[2], 0, T.yawAt(p[3]) + (p[4] < 0 ? Math.PI : 0)]), () => [1, 1], 0xffffff, new THREE.MeshLambertMaterial({ vertexColors: true }), shadow);
    for (const p of lampPts) { const [x, z] = T.side(p[3], p[4], L + 0.4); bins.lit.push(paint(place(new THREE.SphereGeometry(0.28, 8, 6), x, p[2] + 4.3, z), 0xffe3a8, 0)); glow(x, p[2] + 4.3, z, 7, 0xffb259, 0.85); glow(x, p[2] + 2, z, 16, 0xff9a3a, 0.16); }
  }
  // guirnaldas: catenarias entre farolas del lado del mar en la recta, con bombillas de colores que parpadean
  const bulbs = [], bulbCol = [0xff5a5a, 0xffd34d, 0x5ad1ff, 0x8cff6b, 0xff7ae0];
  {
    const sea = lampPts.filter((p) => tr.Z[p[3]] < 30 && tr.Y[p[3]] < 3).sort((a, b) => a[4] - b[4] || a[3] - b[3]);
    for (let k = 0; k + 1 < sea.length; k++) { const a = sea[k], b = sea[k + 1]; if (b[3] - a[3] > 30 || a[4] !== b[4]) continue; for (let t = 1; t < 12; t++) { const u = t / 12, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, y = a[2] + (b[2] - a[2]) * u + 4.1 - Math.sin(Math.PI * u) * 1.1; bulbs.push([x, y, z, bulbCol[(k * 11 + t) % bulbCol.length]]); } }
  }
  if (bulbs.length) {
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length), c = new THREE.Color();
    bulbs.forEach((b, k) => { M4.makeTranslation(b[0], b[1], b[2]); bm.setMatrixAt(k, M4); bm.setColorAt(k, c.set(b[3])); }); bm.frustumCulled = false; G.add(bm);
    let tt = 0; anim.push((dt) => { tt += dt; if (Math.floor(tt * 4) === Math.floor((tt - dt) * 4)) return; for (let k = 0; k < bulbs.length; k++) bm.setColorAt(k, c.set(bulbs[k][3]).multiplyScalar(hash(k, Math.floor(tt * 4)) > 0.82 ? 0.25 : 1)); bm.instanceColor.needsUpdate = true; });
    for (let k = 0; k < bulbs.length; k += 3) glow(bulbs[k][0], bulbs[k][1], bulbs[k][2], 1.8, bulbs[k][3], 0.5);
  }

  // ---- palmeras en el paseo y el pueblo ----
  const palms = [];
  for (let i = 6; i < N; i += mobile ? 22 : 13) for (const s of [-1, 1]) { const [x, z] = T.side(i, s, L + 3.5 + hash(i, s) * 3); if (hAt(x, z) < 0.6 || T.roadDist(x, z) < L + 2.5) continue; if (hash(i * 3, s) < 0.55) palms.push([x, z, hAt(x, z) - 0.2, hash(i, s * 7)]); }
  {
    const trunk = []; for (let k = 0; k < 7; k++) trunk.push(paint(place(cyl(0.2 - k * 0.012, 0.24 - k * 0.012, 1.25, 7), Math.sin(k / 7 * 1.2) * 0.9, 0.62 + k * 1.2, 0), k % 2 ? 0x8a6a48 : 0x7a5c3d, 0.2));
    const frond = (a) => { const g = new THREE.BufferGeometry(), pts = [], len = 3.6; for (let t = 0; t < 6; t++) { const u0 = t / 6, u1 = (t + 1) / 6, w0 = Math.sin(Math.PI * u0) * 0.55 + 0.05, w1 = Math.sin(Math.PI * u1) * 0.55 + 0.05, y0 = -u0 * u0 * 1.6, y1 = -u1 * u1 * 1.6; pts.push(u0 * len, y0, -w0, u1 * len, y1, -w1, u0 * len, y0 + 0.15, 0, u0 * len, y0 + 0.15, 0, u1 * len, y1, -w1, u1 * len, y1 + 0.15, 0, u0 * len, y0, w0, u0 * len, y0 + 0.15, 0, u1 * len, y1, w1, u1 * len, y1, w1, u0 * len, y0 + 0.15, 0, u1 * len, y1 + 0.15, 0); } g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return paint(place(g, 0.9, 8.9, 0, a), 0x3f8a3a, 0.5); };
    const leaves = []; for (let k = 0; k < 8; k++) leaves.push(frond((k / 8) * TAU + 0.2));
    const all = merge([...trunk, ...leaves, paint(new THREE.SphereGeometry(0.45, 7, 5).translate(0.9, 8.8, 0), 0x6b4a2a, 0.3)]);
    inst(G, all, palms, (r) => [0.85 + r * 0.35, 0.85 + r * 0.35], null, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), shadow);
  }

  // ---- casas del pueblo: fachadas de colores con ventanas encendidas y tejados de teja ----
  {
    const pal = [0xf4c7a1, 0xf6e3a8, 0xb9dcd2, 0xf2b5b5, 0xc9c1e8, 0xf9f0de, 0xa8cfe8], roofs = [0xb5532f, 0xc8693a, 0x8f4a32];
    const want = mobile ? 90 : 190, taken = []; let made = 0;
    for (let k = 0; k < 4000 && made < want; k++) {
      const near = k % 4 !== 3, j0 = Math.floor(hash(k, 1) * N), sd = hash(k, 2) < 0.5 ? -1 : 1, [px, pz] = T.side(j0, sd, L + 9 + hash(k, 3) * 26);
      const x = near ? px : T.cx - 300 + hash(k, 9) * 600, z = near ? pz : 120 + hash(k, 10) * 380, y = hAt(x, z); if (y < 1.4) continue;
      const d = T.roadDist(x, z, 40); if (d < L + 6) continue; if (Math.hypot(x + 15, z - 172) < 52 || Math.hypot(x - LH[0], z - LH[1]) < 22) continue;
      if (taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < 10)) continue; taken.push([x, z]);
      const [, j] = T.nearest(x, z, 60); const yaw = j >= 0 ? T.yawAt(j) : Math.round(hash(k, 4) * 4) * Math.PI / 2;
      const w = 6 + hash(k, 5) * 5, dd = 6 + hash(k, 6) * 4, h = 5 + Math.floor(hash(k, 7) * 3) * 3, base = y - 1;
      bins.facade.push(paint(place(boxM(w, h + 1, dd, 3.2, 3.2), x, base + (h + 1) / 2, z, yaw), pal[k % pal.length], 0.25));
      bins.roof.push(paint(place(hipRoof(w + 0.8, dd + 0.8, 2.2 + hash(k, 8)), x, base + h + 1, z, yaw), roofs[k % 3], 0.2));
      made++;
    }
  }

  // ---- noria (gira) y tiovivo (gira y sus caballitos suben y bajan) en el interior del ocho ----
  {
    const WX = -25, WZ = 172, wy = hAt(WX, WZ), R = mobile ? 15 : 17, hub = wy + R + 3.5;
    const legs = []; for (const s of [-1, 1]) for (const f of [-1, 1]) legs.push(paint(place(cyl(0.3, 0.42, Math.hypot(R + 3.5, 7), 6), WX + s * 1.6, wy + (R + 3.5) / 2, WZ + f * 3.5, 0, 1, 1, 1, f * Math.atan2(7, R + 3.5) * 0.5), 0xe8e4dc, 0.2));
    bins.plain.push(merge(legs));
    const wheel = new THREE.Group(); wheel.position.set(WX, hub, WZ); G.add(wheel);
    const parts = [], cars = [];
    for (const s of [-1.3, 1.3]) parts.push(paint(new THREE.TorusGeometry(R, 0.22, 6, 48).translate(0, 0, 0).rotateY(Math.PI / 2).translate(s, 0, 0), 0xf3efe6, 0));
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; for (const s of [-1.3, 1.3]) parts.push(paint(place(cyl(0.07, 0.07, R, 4), s, Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 1, 1, 1, a), 0xf3efe6, 0)); }
    wheel.add(new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true })));
    const bulbG = []; for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; for (const s of [-1.3, 1.3]) bulbG.push(paint(place(new THREE.SphereGeometry(0.16, 5, 4), s, Math.sin(a) * R, Math.cos(a) * R), [0xfff0a0, 0xff7ae0, 0x7ae8ff][k % 3], 0)); }
    const bulbMesh = new THREE.Mesh(merge(bulbG), new THREE.MeshBasicMaterial({ vertexColors: true })); wheel.add(bulbMesh);
    const gcol = [0xe84a5f, 0xffc93c, 0x4ab3e8, 0x6ad06a, 0xb070e0, 0xff8a3c];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, c = new THREE.Group(); c.position.set(0, Math.sin(a) * R, Math.cos(a) * R); const cab = new THREE.Mesh(merge([paint(B(1.6, 1.3, 1.8).translate(0, -1.7, 0), gcol[k % gcol.length], 0.35), paint(cyl(1.05, 1.15, 0.35, 8).translate(0, -0.9, 0), 0xf3efe6, 0), paint(B(0.08, 1, 0.08).translate(0, -0.5, 0), 0xdddddd, 0)]), new THREE.MeshLambertMaterial({ vertexColors: true })); c.add(cab); wheel.add(c); cars.push(c); }
    glow(WX, hub, WZ, 10, 0xffd98a, 0.5);
    let a = 0; anim.push((dt) => { a += dt * 0.12; wheel.rotation.x = a; for (const c of cars) c.rotation.x = -a; });
    // tiovivo
    const KX = 18, KZ = 178, ky = hAt(KX, KZ), car = new THREE.Group(); car.position.set(KX, ky, KZ); G.add(car);
    const base = merge([paint(cyl(6.2, 6.4, 0.7, 24).translate(0, 0.35, 0), 0xf3e2c0, 0.3), paint(cyl(0.5, 0.5, 5.2, 10).translate(0, 3, 0), 0xffd34d, 0.1)]);
    car.add(new THREE.Mesh(base, new THREE.MeshLambertMaterial({ vertexColors: true })));
    car.add(new THREE.Mesh(stripes(new THREE.ConeGeometry(7.2, 2.6, 24, 1, true).translate(0, 6.7, 0), [0xe84a5f, 0xfff3e0]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const horses = []; for (let k = 0; k < 8; k++) { const an = (k / 8) * TAU, h = new THREE.Group(); h.position.set(Math.cos(an) * 4.4, 1.6, Math.sin(an) * 4.4); h.rotation.y = -an; h.add(new THREE.Mesh(merge([paint(B(0.5, 0.7, 1.6), gcol[k % gcol.length], 0.2), paint(B(0.4, 0.7, 0.4).translate(0, 0.55, 0.7), gcol[k % gcol.length], 0.2), paint(cyl(0.05, 0.05, 4.4, 4).translate(0, 1.3, 0), 0xffd34d, 0)]), new THREE.MeshLambertMaterial({ vertexColors: true }))); car.add(h); horses.push(h); }
    const rimB = []; for (let k = 0; k < 24; k++) { const an = (k / 24) * TAU; rimB.push(paint(place(new THREE.SphereGeometry(0.15, 5, 4), Math.cos(an) * 7.1, 5.4, Math.sin(an) * 7.1), 0xfff0a0, 0)); }
    car.add(new THREE.Mesh(merge(rimB), new THREE.MeshBasicMaterial({ vertexColors: true })));
    glow(KX, ky + 4, KZ, 14, 0xffc070, 0.35);
    let b = 0; anim.push((dt) => { b += dt; car.rotation.y = b * 0.5; horses.forEach((h, k) => { h.position.y = 1.6 + Math.sin(b * 2.4 + k * 1.3) * 0.45; }); });
  }

  // ---- faro en el promontorio: haz que barre la bahía ----
  {
    const fy = hAt(LH[0], LH[1]);
    for (let k = 0; k < 5; k++) bins.plain.push(paint(cyl(3.2 - (k + 1) * 0.2, 3.2 - k * 0.2, 4, 16).translate(LH[0], fy + 2 + k * 4, LH[1]), k % 2 ? 0xd8463c : 0xf6f1e6, 0.12));
    bins.plain.push(paint(cyl(2.8, 2.8, 0.5, 16).translate(LH[0], fy + 20.2, LH[1]), 0x2b3340, 0));
    bins.lit.push(paint(cyl(1.6, 1.6, 2.2, 12).translate(LH[0], fy + 21.6, LH[1]), 0xfff2c0, 0));
    bins.plain.push(paint(new THREE.ConeGeometry(2.1, 1.8, 12).translate(LH[0], fy + 23.6, LH[1]), 0xd8463c, 0.2));
    const cone = new THREE.ConeGeometry(5, 120, 16, 1, true).translate(0, -60, 0).rotateZ(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Group(); beam.position.set(LH[0], fy + 21.6, LH[1]); beam.add(new THREE.Mesh(cone, beamMat), new THREE.Mesh(cone.clone().rotateY(Math.PI), beamMat)); G.add(beam);
    glow(LH[0], fy + 21.6, LH[1], 22, 0xfff0b0, 0.9);
    anim.push((dt) => { beam.rotation.y += dt * 0.7; });
  }

  // ---- barcas que se mecen en la bahía ----
  {
    const boats = [], hull = (len) => paint(lumpy(new THREE.SphereGeometry(1, 10, 5, 0, TAU, Math.PI / 2, Math.PI / 2), 0.04, 3).scale(1, 0.75, len), 0xf4f0e6, 0.5);
    const kinds = [merge([hull(3.2), paint(B(1.2, 0.8, 1.6).translate(0, 0.4, -0.6), 0x2d6ca0, 0.2)]), merge([hull(3.6), paint(cyl(0.05, 0.06, 8, 5).translate(0, 4, 0.3), 0xdddddd, 0), paint(new THREE.ConeGeometry(1.8, 6.5, 3).scale(0.08, 1, 1).translate(0, 4.4, -0.8), 0xfbf6ea, 0)])];
    for (let k = 0; k < (mobile ? 8 : 16); k++) { const x = T.cx - 260 + hash(k, 41) * 480, z = -45 - hash(k, 42) * 220; if (hAt(x, z) > SEA - 1.2) continue; const m = new THREE.Mesh(kinds[k % 2], new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.position.set(x, SEA + 0.3, z); m.rotation.y = hash(k, 43) * TAU; m.userData.p = hash(k, 44) * TAU; G.add(m); boats.push(m); glow(x, SEA + 2.5, z, 2.5, 0xffd080, 0.5); }
    let t = 0; anim.push((dt) => { t += dt; for (const m of boats) { m.position.y = SEA + 0.25 + Math.sin(t * 1.1 + m.userData.p) * 0.18; m.rotation.z = Math.sin(t * 0.9 + m.userData.p) * 0.06; m.rotation.x = Math.sin(t * 0.7 + m.userData.p * 2) * 0.04; } });
  }

  // ---- fuegos artificiales sobre el mar ----
  {
    const P = mobile ? 70 : 120, bursts = [], ptex = softTex();
    for (let b = 0; b < (mobile ? 3 : 5); b++) {
      const geo = new THREE.BufferGeometry(), pos = new Float32Array(P * 3), dir = new Float32Array(P * 3);
      for (let k = 0; k < P; k++) { const u = rnd(k + b * 300) * 2 - 1, a = rnd(k * 3 + b * 77) * TAU, r = Math.sqrt(1 - u * u), sp = 0.8 + rnd(k * 7 + b) * 0.25; dir[k * 3] = r * Math.cos(a) * sp; dir[k * 3 + 1] = u * sp; dir[k * 3 + 2] = r * Math.sin(a) * sp; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ size: 3.2, map: ptex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; G.add(pts);
      bursts.push({ pts, pos, dir, mat, t: -b * 1.3 - 0.5, c: new THREE.Vector3() });
    }
    const fcol = [0xff4d6d, 0xffd84d, 0x59d0ff, 0x8dff6a, 0xff8ae8, 0xffffff];
    let n = 0;
    anim.push((dt) => {
      for (const b of bursts) {
        b.t += dt; if (b.t < 0) { b.pts.visible = false; continue; }
        if (b.t > 2.6) { b.t = -0.4 - rnd(n++) * 1.6; b.c.set(T.cx - 180 + rnd(n++) * 360, 55 + rnd(n++) * 45, -130 - rnd(n++) * 120); b.mat.color.set(fcol[n % fcol.length]); continue; }
        if (b.c.y === 0) b.c.set(T.cx - 180 + rnd(b.t * 99) * 360, 70, -170);
        const t = b.t, R = 26 * (1 - Math.exp(-t * 2.2)), drop = 3.5 * t * t;
        for (let k = 0; k < P; k++) { b.pos[k * 3] = b.c.x + b.dir[k * 3] * R; b.pos[k * 3 + 1] = b.c.y + b.dir[k * 3 + 1] * R - drop; b.pos[k * 3 + 2] = b.c.z + b.dir[k * 3 + 2] * R; }
        b.pts.geometry.attributes.position.needsUpdate = true; b.pts.visible = true; b.mat.opacity = Math.max(0, 1 - t / 2.6) ** 1.4; b.mat.size = 3.2 + t * 0.8;
      }
    });
  }

  mountains(G, T.cx, T.cz, 22, 950, 1400, [0x2f4a4a, 0x56637a, 0xe8e2da], (a) => Math.sin(a) < -0.55 && Math.abs(Math.cos(a)) < 0.6);
  flush(G, bins, glows, shadow, true);
}

// ============================================================================================
// Valle Pop
// ============================================================================================
export function popDecor(tr, th, scene, q, anim) {
  const L = WALL, mobile = q.density < 1, shadow = !!q.shadows, G = new THREE.Group(); scene.add(G);
  const T = trackTools(tr), N = tr.N;
  const bins = { plain: [], stone: [], plaster: [], facade: [], roof: [], lit: [] }, glows = [];
  const POND = [92, 188, 24];
  const target = (x, z) => {
    const pd = Math.hypot(x - POND[0], z - POND[1]); if (pd < POND[2] + 8) return -3.5 * (1 - sstep(POND[2] - 6, POND[2] + 8, pd)) + 1 * sstep(POND[2] - 6, POND[2] + 8, pd);
    const d = Math.hypot(x - T.cx, z - T.cz);
    return 1 + 16 * fbm(x / 160 + 3, z / 160) * sstep(30, 200, d) + sstep(380, 760, d) * (60 + 70 * fbm(x / 140, z / 140));
  };
  const cG = new THREE.Color(0x63b13d), cG2 = new THREE.Color(0x48982f), cLight = new THREE.Color(0x9bd457), cRock = new THREE.Color(0x9a8f7c), cSand = new THREE.Color(0xe9d59c), flowers = [0xff6b8a, 0xffe14d, 0xffffff, 0xb98cff].map((h) => new THREE.Color(h));
  const { hAt, mesh } = terrain(tr, T, q, target, (c, x, z, y, sl) => {
    c.copy(cG).lerp(cG2, sstep(0.35, 0.7, fbm(x / 40, z / 40))).lerp(cLight, sstep(0.55, 0.85, fbm(x / 23 + 5, z / 23))).lerp(cRock, sstep(0.9, 1.6, sl));
    if (y < 0.7) c.lerp(cSand, 0.9);
  }, grassTex('#9a9a94', ['#8a8a84', '#aaaaa2', '#808078']));
  G.add(mesh);
  { const g = new THREE.CircleGeometry(POND[2] + 2, 48).rotateX(-Math.PI / 2).translate(POND[0], 0.3, POND[1]), nm = waterNormals(); nm.repeat.set(6, 6);
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x3aa7d8, specular: 0x4a6a88, shininess: 40, normalMap: nm, normalScale: new THREE.Vector2(0.25, 0.25) })); m.onBeforeRender = () => { const t = performance.now() / 1000; nm.offset.set(t * 0.02, t * 0.015); }; G.add(m);
    const lily = []; for (let k = 0; k < 14; k++) { const a = hash(k, 71) * TAU, r = hash(k, 72) * POND[2] * 0.8; lily.push(paint(place(cyl(0.9, 0.9, 0.06, 10), POND[0] + Math.cos(a) * r, 0.36, POND[1] + Math.sin(a) * r), 0x4fae3a, 0)); if (k % 3 === 0) lily.push(paint(place(new THREE.SphereGeometry(0.3, 6, 4), POND[0] + Math.cos(a) * r, 0.5, POND[1] + Math.sin(a) * r), 0xff8fd0, 0)); }
    bins.plain.push(merge(lily)); }

  // ---- muros de bloques de juguete: colores alternos, con la cara superior más clara ----
  {
    const blk = merge([paint(boxM(2, 1.1, 0.9, 2, 1.1).translate(0, 0.55, 0), 0xffffff, 0.35), paint(B(1.9, 0.12, 0.8).translate(0, 1.16, 0), 0xffffff, 0)]);
    const spots = [], cols = [0xe94b4b, 0xffcc33, 0x3b8cf0, 0x55c24a, 0xff8f3a, 0xb46cf0];
    for (const s of [-1, 1]) for (let i = 0; i < N; i += 2) { const [x, z] = T.side(i, s, L + 0.45); spots.push([x, z, tr.Y[i] - 0.05, (Math.floor(i / 2) + (s > 0 ? 3 : 0)) % cols.length, T.yawAt(i) + Math.PI / 2]); }
    inst(G, blk, spots, () => [1, 1], null, new THREE.MeshLambertMaterial({ vertexColors: true }), shadow, (r) => cols[r]);
  }

  // ---- árboles de dibujos: copa redonda o en cono, en tonos de verde ----
  const trees = [], cones = [];
  for (let k = 0; k < (mobile ? 700 : 1500); k++) {
    const x = T.cx - 520 + hash(k, 11) * 1040, z = T.cz - 520 + hash(k, 12) * 1040, y = hAt(x, z); if (y < 0.5) continue; if (fbm(x / 70, z / 70) < 0.5 && hash(k, 15) < 0.8) continue;
    if (T.roadDist(x, z, 30) < L + 4) continue; if (Math.hypot(x - POND[0], z - POND[1]) < POND[2] + 4) continue;
    (hash(k, 13) < 0.65 ? trees : cones).push([x, z, y - 0.2, hash(k, 14)]);
  }
  {
    const round = merge([paint(cyl(0.35, 0.5, 3, 7).translate(0, 1.5, 0), 0x8a5a34, 0.3), paint(lumpy(new THREE.IcosahedronGeometry(2.6, 2), 0.18, 4).translate(0, 4.8, 0), 0xffffff, 0.45)]);
    inst(G, round, trees, (r) => [1.1 + r * 0.9, 1.1 + r * 0.9], null, new THREE.MeshLambertMaterial({ vertexColors: true }), shadow, (r) => [0x6cc04a, 0x4fae3a, 0x8fd456, 0x3f9a3a][Math.floor(r * 4)]);
    const cone = merge([paint(cyl(0.3, 0.4, 2, 6).translate(0, 1, 0), 0x8a5a34, 0.3), paint(new THREE.ConeGeometry(2.2, 5.5, 9).translate(0, 4.2, 0), 0xffffff, 0.45), paint(new THREE.ConeGeometry(1.6, 3.6, 9).translate(0, 6.6, 0), 0xffffff, 0.3)]);
    inst(G, cone, cones, (r) => [1 + r * 0.7, 1 + r * 1], null, new THREE.MeshLambertMaterial({ vertexColors: true }), shadow, (r) => [0x2f8f4a, 0x3fa05a, 0x23803c][Math.floor(r * 3)]);
  }

  // ---- macizos de flores y matas junto a la pista ----
  {
    const fl = [], fcols = [0xff5c8a, 0xffe14d, 0xffffff, 0xb98cff, 0xff8f3a];
    for (let i = 0; i < N; i += mobile ? 9 : 5) for (const s of [-1, 1]) { if (hash(i, s * 3) < 0.4) continue; const c = Math.floor(hash(i, s) * fcols.length); for (let k = 0; k < 6; k++) { const [x, z] = T.side((i + Math.floor(hash(i, k) * 4)) % N, s, L + 1.8 + hash(k, i) * 5); if (T.roadDist(x, z, 20) < L + 1.2) continue; fl.push([x, z, hAt(x, z), (c + (k === 5 ? 2 : 0)) % fcols.length + hash(i, k) * 0.5]); } }
    const flower = merge([paint(cyl(0.04, 0.04, 0.6, 3).translate(0, 0.3, 0), 0x3f8a3a, 0), paint(new THREE.IcosahedronGeometry(0.22, 0).translate(0, 0.65, 0), 0xffffff, 0.1), paint(new THREE.IcosahedronGeometry(0.09, 0).translate(0, 0.72, 0.12), 0xffe14d, 0)]);
    inst(G, flower, fl, () => [1.4, 1.4], null, new THREE.MeshLambertMaterial({ vertexColors: true }), false, (r) => fcols[Math.floor(r) % fcols.length]);
    const bush = paint(lumpy(new THREE.IcosahedronGeometry(1.2, 1), 0.25, 2).scale(1, 0.7, 1).translate(0, 0.5, 0), 0xffffff, 0.4), bushes = [];
    for (let i = 3; i < N; i += mobile ? 14 : 8) for (const s of [-1, 1]) { const [x, z] = T.side(i, s, L + 2.6 + hash(i, s) * 3); if (T.roadDist(x, z, 20) > L + 1.5 && hash(i * 5, s) < 0.5) bushes.push([x, z, hAt(x, z), hash(i, s * 9)]); }
    inst(G, bush, bushes, (r) => [0.9 + r * 0.8, 0.9 + r * 0.8], null, new THREE.MeshLambertMaterial({ vertexColors: true }), shadow, (r) => [0x4fae3a, 0x6cc04a, 0x3f9a3a][Math.floor(r * 3)]);
  }
  // ---- casitas de colores con tejado redondeado en el valle ----
  {
    const pal = [0xffb3c7, 0xfff0a8, 0xa8e6ff, 0xc9f0a8, 0xe2c9ff], roofs = [0xe94b4b, 0x3b8cf0, 0xff8f3a, 0xb46cf0], taken = [];
    for (let k = 0, made = 0; k < 1500 && made < (mobile ? 14 : 28); k++) {
      const j0 = Math.floor(hash(k, 81) * N), sd = hash(k, 82) < 0.5 ? -1 : 1, [x, z] = T.side(j0, sd, L + 14 + hash(k, 83) * 40), y = hAt(x, z);
      if (y < 0.8 || T.roadDist(x, z, 30) < L + 10 || Math.hypot(x - POND[0], z - POND[1]) < POND[2] + 8 || taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < 16)) continue; taken.push([x, z]);
      const yaw = T.yawAt(j0), w = 6 + hash(k, 84) * 2, d = 5 + hash(k, 85) * 2;
      bins.facade.push(paint(place(boxM(w, 4.5, d, 3, 3), x, y + 1.6, z, yaw), pal[k % pal.length], 0.2));
      bins.plain.push(paint(place(cyl(d / 2 + 0.4, d / 2 + 0.4, w + 0.6, 12).rotateZ(Math.PI / 2).scale(1, 0.75, 1), x, y + 3.9, z, yaw), roofs[k % roofs.length], 0.3));
      bins.plain.push(paint(place(cyl(0.4, 0.45, 2, 8), x + 1.5, y + 6, z, yaw), 0xd96a4a, 0.2)); made++;
    }
  }
  // ---- grada con público que salta en la recta de salida y banderines sobre la pista ----
  {
    const i0 = Math.round(30 / tr.ds), len = 70, s = 1, people = [];
    for (let k = 0; k < len; k += 2) {
      const i = (i0 + k) % N, yaw = T.yawAt(i);
      for (let r = 0; r < 4; r++) { const [x, z] = T.side(i, s, L + 3 + r * 1.6), y = tr.Y[i] + r * 1.1; bins.plain.push(paint(place(B(2.1, 1.1 + r * 1.1, 1.6), x, tr.Y[i] - 0.5 + (1.1 + r * 1.1) / 2, z, yaw), r % 2 ? 0xe8e4dc : 0xf6f2ea, 0.3)); people.push([x, z, y + 0.6, hash(k, r)]); }
      if (k % 10 === 0) { const [x, z] = T.side(i, s, L + 9.4); bins.plain.push(paint(place(cyl(0.12, 0.12, 9, 6), x, tr.Y[i] + 4.5, z), 0xdddddd, 0.2)); }
    }
    { const [x, z] = T.side((i0 + len / 2) % N, s, L + 6.5); const roof = paint(place(boxM(len + 2, 0.4, 9, 4, 1), x, tr.Y[(i0 + len / 2) % N] + 9, z, T.yawAt((i0 + len / 2) % N) + Math.PI / 2), 0xe94b4b, 0.1); bins.plain.push(roof); }
    const body = merge([paint(B(0.6, 0.8, 0.4).translate(0, 0.4, 0), 0xffffff, 0.2), paint(new THREE.SphereGeometry(0.26, 7, 5).translate(0, 1.05, 0), 0xf1c9a5, 0.1)]);
    const crowd = inst(G, body, people.flatMap((p) => [[p[0] - 0.5, p[1], p[2], p[3]], [p[0] + 0.5, p[1], p[2], (p[3] * 7) % 1]]), () => [1, 1], null, new THREE.MeshLambertMaterial({ vertexColors: true }), false, (r) => [0xe94b4b, 0x3b8cf0, 0xffcc33, 0x55c24a, 0xff8f3a, 0xffffff][Math.floor(r * 6)]);
    if (crowd && !mobile) { const base = []; const d = new THREE.Object3D(); for (let k = 0; k < crowd.count; k++) { crowd.getMatrixAt(k, M4); base.push(new THREE.Vector3().setFromMatrixPosition(M4)); } let t = 0; anim.push((dt) => { t += dt; if (Math.floor(t * 20) === Math.floor((t - dt) * 20)) return; for (let k = 0; k < base.length; k++) { const j = Math.max(0, Math.sin(t * 7 + k * 1.7)) * 0.25; d.position.copy(base[k]); d.position.y += j; d.rotation.set(0, (k * 0.37) % 1 - 0.5, 0); d.updateMatrix(); crowd.setMatrixAt(k, d.matrix); } crowd.instanceMatrix.needsUpdate = true; }); }
    // banderines de colores cruzando la pista
    const flagCols = [0xe94b4b, 0xffcc33, 0x3b8cf0, 0x55c24a, 0xff8f3a, 0xb46cf0], lines = [];
    for (const k of [10, 40, 70]) {
      const i = (i0 + k) % N, [ax, az] = T.side(i, -1, L + 0.8), [bx, bz] = T.side(i, 1, L + 0.8), y = tr.Y[i] + 7.5, g = [];
      for (const [x, z] of [[ax, az], [bx, bz]]) bins.plain.push(paint(place(cyl(0.15, 0.18, 8, 6), x, tr.Y[i] + 4, z), 0xf6f2ea, 0.2));
      for (let t = 0; t < 14; t++) { const u = (t + 0.5) / 14, x = ax + (bx - ax) * u, z = az + (bz - az) * u, yy = y - Math.sin(Math.PI * u) * 1.2; const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute([-0.45, 0, 0, 0.45, 0, 0, 0, -0.9, 0], 3)); f.computeVertexNormals(); g.push(paint(place(f, x, yy, z, T.yawAt(i)), flagCols[t % flagCols.length], 0)); }
      const m = new THREE.Mesh(merge(g), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; G.add(m); lines.push(m);
    }
    let t = 0; anim.push((dt) => { t += dt; lines.forEach((m, k) => { m.position.y = Math.sin(t * 2 + k) * 0.06; }); });
  }

  // ---- globos aerostáticos que flotan y derivan despacio ----
  {
    const sets = [[0xe94b4b, 0xffcc33], [0x3b8cf0, 0xffffff], [0x55c24a, 0xffcc33], [0xb46cf0, 0xff8fd0], [0xff8f3a, 0x3b8cf0], [0xffffff, 0xe94b4b]], balloons = [];
    for (let k = 0; k < (mobile ? 4 : 7); k++) {
      const env = stripes(new THREE.SphereGeometry(7, 16, 12).scale(1, 1.18, 1), sets[k % sets.length], 12, 0.25);
      const basket = paint(B(2.2, 1.6, 2.2).translate(0, -12.5, 0), 0x9a6a3a, 0.4), ropes = []; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ropes.push(paint(place(cyl(0.04, 0.04, 6, 3), a * 1.6, -9, b * 1.6), 0x553a22, 0));
      const g = new THREE.Group(); g.add(new THREE.Mesh(env, new THREE.MeshLambertMaterial({ vertexColors: true })), new THREE.Mesh(merge([basket, ...ropes]), new THREE.MeshLambertMaterial({ vertexColors: true })));
      const a = (k / 7) * TAU, r = 150 + hash(k, 21) * 220; g.userData = { a, r, h: 55 + hash(k, 22) * 50, p: hash(k, 23) * TAU, w: (hash(k, 24) - 0.5) * 0.02 }; G.add(g); balloons.push(g);
    }
    let t = 0; anim.push((dt) => { t += dt; for (const g of balloons) { const u = g.userData, a = u.a + t * u.w; g.position.set(T.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.35 + u.p) * 4, T.cz + Math.sin(a) * u.r); g.rotation.y = t * 0.05 + u.p; } });
  }

  // ---- molinos en las colinas y molinillos gigantes junto a la pista ----
  {
    const mills = [], wheels = [];
    for (let k = 0, made = 0; k < 400 && made < (mobile ? 4 : 7); k++) {
      const x = T.cx - 380 + hash(k, 31) * 760, z = T.cz - 380 + hash(k, 32) * 760, y = hAt(x, z); if (y < 6 || T.roadDist(x, z, 60) < 45) continue;
      const g = new THREE.Group(); g.position.set(x, y - 0.5, z); g.rotation.y = Math.atan2(T.cx - x, T.cz - z);
      g.add(new THREE.Mesh(merge([paint(cyl(2.4, 3.6, 12, 10).translate(0, 6, 0), 0xf6f2ea, 0.35), paint(new THREE.ConeGeometry(3, 3.4, 10).translate(0, 13.6, 0), 0xe94b4b, 0.2), paint(B(1.4, 2.2, 0.2).translate(0, 1.1, 3.4), 0x7a5232, 0.2)]), new THREE.MeshLambertMaterial({ vertexColors: true })));
      const bl = new THREE.Group(); bl.position.set(0, 11.5, 3.3); const bg = []; for (let b = 0; b < 4; b++) bg.push(paint(place(B(1.6, 9, 0.15).translate(0, 5, 0), 0, 0, 0, 0, 1, 1, 1, 0).rotateZ((b / 4) * TAU), 0xfdf6e3, 0.1)); bg.push(paint(cyl(0.5, 0.5, 0.6, 8).rotateX(Math.PI / 2), 0x7a5232, 0)); bl.add(new THREE.Mesh(merge(bg), new THREE.MeshLambertMaterial({ vertexColors: true }))); g.add(bl); G.add(g); mills.push(bl); made++;
    }
    for (let i = 60; i < N; i += Math.round(N / (mobile ? 6 : 12))) {
      const s = hash(i, 5) < 0.5 ? -1 : 1, [x, z] = T.side(i, s, L + 5); if (T.roadDist(x, z, 20) < L + 3) continue; const y = hAt(x, z);
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = T.yawAt(i) + Math.PI / 2 * s;
      g.add(new THREE.Mesh(paint(cyl(0.18, 0.22, 6, 6).translate(0, 3, 0), 0xf6f2ea, 0.3), new THREE.MeshLambertMaterial({ vertexColors: true })));
      const w = new THREE.Group(); w.position.set(0, 6, 0.3); const cols = [0xe94b4b, 0xffcc33, 0x3b8cf0, 0x55c24a], vg = [];
      for (let b = 0; b < 4; b++) { const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 2.4, 0, 0, 2.4, 2.4, 0, 0, 0, 0, 2.4, 2.4, 0, 0, 2.4, 0.4], 3)); f.computeVertexNormals(); vg.push(paint(f.rotateZ((b / 4) * TAU), cols[b], 0)); }
      w.add(new THREE.Mesh(merge(vg), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))); g.add(w); G.add(g); wheels.push(w);
    }
    anim.push((dt) => { for (const m of mills) m.rotation.z += dt * 0.8; for (const w of wheels) w.rotation.z -= dt * 2.6; });
  }

  // ---- nubes esponjosas que pasan despacio ----
  {
    const puff = merge([0, 1, 2, 3, 4].map((k) => paint(new THREE.IcosahedronGeometry(6 + hash(k, 2) * 4, 1).translate((k - 2) * 7, hash(k, 3) * 3, hash(k, 4) * 4), 0xffffff, 0.12)));
    const clouds = []; for (let k = 0; k < (mobile ? 6 : 12); k++) { const m = new THREE.Mesh(puff, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa6b8 })); m.position.set(T.cx - 600 + hash(k, 61) * 1200, 120 + hash(k, 62) * 70, T.cz - 600 + hash(k, 63) * 1200); m.scale.setScalar(1 + hash(k, 64) * 1.2); G.add(m); clouds.push(m); }
    anim.push((dt) => { for (const m of clouds) { m.position.x += dt * 3; if (m.position.x > T.cx + 650) m.position.x = T.cx - 650; } });
  }

  mountains(G, T.cx, T.cz, 26, 900, 1300, [0x4f8a4a, 0x7a9a6a, 0xffffff]);
  flush(G, bins, glows, shadow, false);
}

// una malla por material + halos
function flush(G, bins, glows, shadow, dusk) {
  const mats = {
    plain: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    stone: new THREE.MeshLambertMaterial({ vertexColors: true, map: stoneTex() }),
    plaster: new THREE.MeshLambertMaterial({ vertexColors: true, map: plasterTex() }),
    facade: new THREE.MeshLambertMaterial({ vertexColors: true, map: facadeTex(false), emissive: dusk ? 0xffffff : 0x000000, emissiveMap: dusk ? facadeTex(true) : null, emissiveIntensity: dusk ? 0.55 : 0 }),
    roof: new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTex(), side: THREE.DoubleSide }),
    lit: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  if (dusk) { // el emisivo solo en las ventanas: el resto de la fachada no brilla
    const em = mats.facade.emissiveMap; const c = em.image, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height); for (let k = 0; k < d.data.length; k += 4) { const warm = d.data[k] > 200 && d.data[k + 1] > 170 && d.data[k + 2] < 160; if (!warm) { d.data[k] = d.data[k + 1] = d.data[k + 2] = 0; } } x.putImageData(d, 0, 0); em.needsUpdate = true;
  }
  for (const k in bins) { if (!bins[k].length) continue; const m = new THREE.Mesh(merge(bins[k]), mats[k]); m.frustumCulled = false; m.castShadow = shadow && k !== 'lit'; m.receiveShadow = shadow; G.add(m); }
  glowMesh(G, glows);
}
