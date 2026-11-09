// Entorno del Madring: IFEMA, gradas del plano, M-11 sobre los túneles, skyline de Madrid, banderas y publicidad
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL } from './track.js';
import { npcMesh, SHIRTS, WALK, CHEER, JUMP, IDLE, crowdType } from './npc.js';
import { spriteField } from './filler.js';

const DATE = '01/02/2027', FONT = '"Segoe UI","Helvetica Neue",Arial,sans-serif', GAME = '"Jersey 10",Impact,sans-serif';
const gameFont = () => (document.fonts && document.fonts.load ? document.fonts.load('60px "Jersey 10"').catch(() => {}) : Promise.resolve());
const texCache = {};
function canvasTex(key, w, h, paint) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  paint(c.getContext('2d'), w, h, () => { t.needsUpdate = true; });
  return (texCache[key] = t);
}
function withLogo(name, draw, done) {
  let last = null; draw(null);
  gameFont().then(() => { draw(last); done(); });
  const img = new Image(); img.onload = () => { last = img; draw(img); done(); }; img.src = `./assets/logos/${name}.webp`;
}
// Traced: icono de la bola + palabra, con "MADRID 01/02/2027" debajo
const tracedTex = (w, h) => canvasTex(`traced${w}`, w, h, (x, W, H, done) => withLogo('traced', (img) => {
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#071022'); bg.addColorStop(1, '#0d2c52'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.fillStyle = '#22c8ff'; x.fillRect(0, 0, W, H * 0.03); x.fillRect(0, H * 0.97, W, H * 0.03);
  const fs = H * 0.5, ic = H * 0.62, gap = H * 0.05; x.font = `800 ${fs}px ${FONT}`; x.textBaseline = 'middle'; x.textAlign = 'left';
  const tw = x.measureText('traced').width, x0 = (W - ic - gap - tw) / 2, cy = H * 0.37;
  if (img) x.drawImage(img, x0, cy - ic / 2, ic, ic);
  x.fillStyle = '#ffffff'; x.fillText('traced', x0 + ic + gap, cy);
  x.textAlign = 'center'; x.font = `${H * 0.3}px ${GAME}`; x.fillStyle = '#7fe3ff'; x.fillText(`MADRID ${DATE}`, W / 2, H * 0.83);
}, done));
// Celonis: logotipo sobre blanco y la fecha debajo
const celonisTex = (w, h) => canvasTex(`celonis${w}`, w, h, (x, W, H, done) => withLogo('celonis', (img) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  if (img) { const lh = H * 0.66, lw = lh * img.naturalWidth / img.naturalHeight; x.drawImage(img, (W - lw) / 2, H * 0.02, lw, lh); }
  x.fillStyle = '#5cff4f'; x.fillRect(0, H * 0.7, W, H * 0.3);
  x.fillStyle = '#000000'; x.font = `${H * 0.31}px ${GAME}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(DATE, W / 2, H * 0.855);
}, done));
// Burger King: tres logotipos sobre crema con franjas rojas
const burgerTex = (w, h) => canvasTex(`bk${w}`, w, h, (x, W, H, done) => withLogo('burgerking', (img) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = '#d62300'; x.fillRect(0, 0, W, H * 0.05); x.fillRect(0, H * 0.95, W, H * 0.05);
  if (img) { const lh = H * 0.82, lw = lh * img.naturalWidth / img.naturalHeight; for (const c of [0.17, 0.5, 0.83]) x.drawImage(img, W * c - lw / 2, H * 0.09, lw, lh); }
}, done));
const textTex = (txt, bg, fg, w = 1024, h = 128) => canvasTex(`t:${txt}:${w}`, w, h, (x, W, H, done) => { const paint = () => {
  x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = fg; x.lineWidth = H * 0.05; x.strokeRect(H * 0.07, H * 0.07, W - H * 0.14, H - H * 0.14);
  // el texto se ajusta siempre al cartel: se reduce hasta caber y admite varias líneas
  const lines = txt.split('\n'), maxW = W * 0.9; let fs = (H * 0.8) / lines.length;
  x.font = `${fs}px ${GAME}`; const wide = Math.max(...lines.map((l) => x.measureText(l).width)); if (wide > maxW) fs *= maxW / wide;
  x.fillStyle = fg; x.font = `${fs}px ${GAME}`; x.textAlign = 'center'; x.textBaseline = 'middle'; lines.forEach((l, k) => x.fillText(l, W / 2, H / 2 + (k - (lines.length - 1) / 2) * fs * 1.0));
  }; paint(); gameFont().then(() => { paint(); done(); });
});
// bandera de la Comunidad de Madrid: carmesí con siete estrellas blancas (4 + 3)
const flagTex = () => canvasTex('flagmad', 512, 341, (x, W, H) => {
  x.fillStyle = '#c8102e'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffffff';
  const star = (cx, cy, r) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.4 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); };
  const r = H * 0.115, st = W * 0.185; for (let k = 0; k < 4; k++) star(W / 2 + (k - 1.5) * st, H * 0.34, r); for (let k = 0; k < 3; k++) star(W / 2 + (k - 1) * st, H * 0.66, r);
});
const crowdTex = () => canvasTex('crowd', 512, 64, (x, W, H) => {
  x.fillStyle = '#20407a'; x.fillRect(0, 0, W, H); const c = ['#f2d6b8', '#c8102e', '#ffffff', '#ffd23a', '#1d1f26', '#d9a06b', '#3a78d8'];
  for (let px = 3; px < W; px += 15) for (let row = 0; row < 2; row++) { if (Math.random() < 0.12) continue; x.fillStyle = c[Math.floor(Math.random() * c.length)]; x.fillRect(px + Math.random() * 3, 6 + row * 29, 11, 15); x.fillStyle = '#e8c4a0'; x.fillRect(px + 3 + Math.random() * 2, row * 29, 6, 7); }
});
const windowed = (key, wall, cols, rows, paintWin) => canvasTex(key, 256, 512, (x, W, H) => {
  x.fillStyle = wall; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 1400; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; x.fillRect(Math.random() * W, Math.random() * H, 7, 3); }
  const cw = W / cols, rh = H / rows; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) paintWin(x, c * cw, r * rh, cw, rh, r, c);
});
// fachadas madrileñas: ladrillo con terrazas, revoco claro con persianas y toldos verdes, y oficinas de cristal
const facades = () => [
  windowed('fbrick', '#a95f3e', 4, 8, (x, X, Y, w, h) => { x.fillStyle = '#ece6da'; x.fillRect(X + w * 0.1, Y + h * 0.62, w * 0.8, h * 0.08); x.fillStyle = '#22303a'; x.fillRect(X + w * 0.24, Y + h * 0.16, w * 0.52, h * 0.46); x.fillStyle = '#e8e2d6'; x.fillRect(X + w * 0.1, Y + h * 0.5, w * 0.8, h * 0.04); }),
  windowed('fbeige', '#dccdb2', 4, 8, (x, X, Y, w, h, r, c) => { x.fillStyle = '#2b3640'; x.fillRect(X + w * 0.24, Y + h * 0.2, w * 0.52, h * 0.5); x.fillStyle = '#b9a98e'; x.fillRect(X + w * 0.24, Y + h * 0.2, w * 0.52, h * (0.1 + ((r * 3 + c * 5) % 4) * 0.08)); if ((r + c * 3) % 3 === 0) { x.fillStyle = '#2f7a4c'; x.fillRect(X + w * 0.16, Y + h * 0.1, w * 0.68, h * 0.18); } }),
  windowed('fglass', '#24475f', 6, 14, (x, X, Y, w, h, r, c) => { x.fillStyle = (r * 7 + c * 3) % 5 === 0 ? '#7fb2cf' : '#35637f'; x.fillRect(X + 1.5, Y + 1.5, w - 3, h - 3); }),
];

export function madridDecor(tr, th, scene, anim, q) {
  const N = tr.N, L = WALL, sc = th.style.scale, D = new THREE.Object3D(), G = new THREE.Group(), shadow = !!q.shadows; scene.add(G);
  const grid = new Map(), cs = 12;
  for (let i = 0; i < N; i++) { const k = Math.floor(tr.X[i] / cs) + ',' + Math.floor(tr.Z[i] / cs); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const nearest = (x, z) => { let b = 1e9; const ax = Math.floor(x / cs), az = Math.floor(z / cs); for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) { const l = grid.get((ax + a) + ',' + (az + c)); if (l) for (const i of l) { const d = Math.hypot(tr.X[i] - x, tr.Z[i] - z); if (d < b) b = d; } } return b; };
  const idxOf = (px, py) => { let b = 1e18, bi = 0; for (let i = 0; i < N; i++) { const d = (tr.X[i] - px * sc) ** 2 + (tr.Z[i] - py * sc) ** 2; if (d < b) { b = d; bi = i; } } return bi; };
  const mod = (i) => ((i % N) + N) % N;
  const inTunnel = (i, pad) => (tr.tunnels || []).some((t) => i > t.s0 / tr.ds - pad && i < t.s1 / tr.ds + pad);
  const insideLoop = (x, z) => { let c = false; for (let i = 0, j = N - 4; i < N; j = i, i += 4) if ((tr.Z[i] > z) !== (tr.Z[j] > z) && x < ((tr.X[j] - tr.X[i]) * (z - tr.Z[i])) / (tr.Z[j] - tr.Z[i]) + tr.X[i]) c = !c; return c; };
  // altura de la coronación exterior en curvas peraltadas (el lado alto sube con el peralte)
  const topY = (i, side) => tr.Y[i] + Math.max(0, Math.tan(tr.bank ? tr.bank[i] : 0) * side * L);
  const occupied = [];
  const free = (x, z, r) => occupied.every((o) => (o[0] - x) ** 2 + (o[1] - z) ** 2 > (o[2] + r) ** 2);
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const sign = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const inst = (geo, mat, list, place, tint, cast = false) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length), c = new THREE.Color();
    list.forEach((s, k) => { D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); place(D, s, k); D.updateMatrix(); m.setMatrixAt(k, D.matrix); if (tint) m.setColorAt(k, c.setHex(tint(s, k))); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false; m.castShadow = cast && shadow; G.add(m); return m;
  };

  // ---- gradas del plano: módulos de 12 m que siguen la pista, tramos en coordenadas del plano [x0, y0, x1, y1, lado] ----
  const STANDS = [[212, 700, 268, 440, -1], [320, 318, 490, 275, 1], [750, 243, 825, 272, 1], [1222, 258, 1640, 410, -1], [1590, 495, 1480, 535, -1], [1395, 500, 1310, 395, -1], [1305, 395, 1235, 385, -1], [955, 392, 870, 440, -1], [330, 758, 225, 758, 1]];
  const standSpots = [];
  for (const [x0, y0, x1, y1, side] of STANDS) {
    const a = idxOf(x0, y0), b = idxOf(x1, y1), n = mod(b - a);
    for (let d = 0; d < n; d += 12) {
      const i = mod(a + d), lat = side * (L + 1.6), x = tr.X[i] - tr.TZ[i] * lat, z = tr.Z[i] + tr.TX[i] * lat, far = side * (L + 12), fx = tr.X[i] - tr.TZ[i] * far, fz = tr.Z[i] + tr.TX[i] * far;
      if (nearest(fx, fz) < L + 1.2) continue; // por dentro de una curva cerrada no cabe
      const yaw = Math.atan2(tr.TX[i], tr.TZ[i]) + (side > 0 ? Math.PI : 0);
      standSpots.push([x, topY(i, side), z, yaw]); occupied.push([(x + fx) / 2, (z + fz) / 2, 7.5]);
    }
  }
  { const tiers = []; for (let t = 0; t < 7; t++) tiers.push(new THREE.BoxGeometry(1.45, 0.95, 12.6).translate(0.72 + t * 1.45, 0.475 + t * 0.95, 0));
    inst(mergeGeometries(tiers), new THREE.MeshLambertMaterial({ map: crowdTex() }), standSpots, (d, s) => { d.position.set(s[0], s[1], s[2]); d.rotation.y = s[3]; }, null, true);
    inst(new THREE.BoxGeometry(10.4, 16, 12.6).translate(5.1, -8, 0), lam(0x8f9299), standSpots, (d, s) => { d.position.set(s[0], s[1], s[2]); d.rotation.y = s[3]; });
    const roof = mergeGeometries([new THREE.BoxGeometry(11.4, 0.28, 12.8).translate(5.4, 9.4, 0), new THREE.BoxGeometry(0.35, 11, 0.35).translate(10.4, 4, 0)]);
    inst(roof, lam(0xeef1f5), standSpots, (d, s) => { d.position.set(s[0], s[1], s[2]); d.rotation.y = s[3]; }, null, true); }
  // grada ovalada del interior de la curva de Valdebebas
  { const pts = []; for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector2(11 + k * 2.6, 0.4 + k * 1.3), new THREE.Vector2(13.6 + k * 2.6, 0.4 + k * 1.3));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshLambertMaterial({ map: crowdTex(), side: THREE.DoubleSide })); m.position.set(1525 * sc, 0, 397 * sc); m.scale.set(1.12, 1, 0.74); G.add(m); occupied.push([1525 * sc, 397 * sc, 34]); }

  // ---- pórticos sobre la pista ----
  const GANTRIES = [[440, 288, 'traced'], [1380, 278, 'traced'], [600, 638, 'celonis'], [1040, 265, 'celonis'], [1530, 297, 'curva']];
  const gantryI = GANTRIES.map(([x, y]) => idxOf(x, y));
  GANTRIES.forEach(([, , kind], n) => {
    const i = gantryI[n], g = new THREE.Group(), w = 2 * (L + 1.1), h = 4.4; g.position.set(tr.X[i], tr.Y[i], tr.Z[i]); g.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]);
    const mat = sign(kind === 'traced' ? tracedTex(1600, 368) : kind === 'celonis' ? celonisTex(1600, 368) : textTex('CURVA DE\nVALDEBEBAS', '#0b2a5c', '#ffffff', 1600, 368));
    const steel = lam(0x262a33), beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), [steel, steel, steel, steel, mat, mat]); beam.position.y = 8.6; g.add(beam);
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11, 0.9), steel); p.position.set(sd * (L + 1.1), 5.5, 0); g.add(p); }
    G.add(g);
  });

  // ---- vallas grandes junto a la pista, giradas hacia el piloto que llega; dos de Traced por cada una de Burger King (Celonis solo en sus dos pórticos) ----
  const BW = 13, BH = 4.7, boards = [[], []], A = 0.49, cA = Math.cos(A), sA = Math.sin(A);
  let bn = 0;
  for (let i0 = 40; i0 < N - 40; i0 += 58) {
    const i = i0, kind = bn % 3 === 2 ? 1 : 0;
    if (inTunnel(i, 34) || gantryI.some((g) => Math.min(Math.abs(g - i), N - Math.abs(g - i)) < 22)) continue;
    const tx = tr.TX[i], tz = tr.TZ[i]; let done = false;
    for (const side of bn % 2 ? [1, -1] : [-1, 1]) {
      const nx = -tz * side, nz = tx * side, fx = -tx * cA - nx * sA, fz = -tz * cA - nz * sA, bx = nx * cA - tx * sA, bz = nz * cA - tz * sA, off = L + 1.6 + (BW / 2) * cA;
      const cx = tr.X[i] + nx * off, cz = tr.Z[i] + nz * off;
      let ok = true; for (let k = -1; k <= 1; k += 0.5) { const px = cx + bx * k * BW / 2, pz = cz + bz * k * BW / 2; if (nearest(px, pz) < L + 1.2 || !free(px, pz, 1.5)) { ok = false; break; } }
      if (!ok) continue;
      boards[kind].push([cx, cz, Math.atan2(fx, fz), topY(i, side), fx, fz]); occupied.push([cx, cz, BW / 2]); done = true; break;
    }
    if (done) bn++;
  }
  const allBoards = boards[0].concat(boards[1]), bottomM = 2.6;
  inst(new THREE.BoxGeometry(BW + 0.5, BH + 0.5, 0.3), lam(0x1a1d24), allBoards, (d, s) => { d.position.set(s[0], s[3] + bottomM + BH / 2, s[1]); d.rotation.y = s[2]; }, null, true);
  inst(new THREE.BoxGeometry(0.45, 1, 0.45).translate(0, 0.5, 0), lam(0x2c3038), allBoards.flatMap((s) => [-1, 1].map((sd) => [s[0] + Math.cos(s[2]) * sd * BW * 0.36, s[1] - Math.sin(s[2]) * sd * BW * 0.36, s[3] + bottomM])), (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.y = s[2]; });
  [tracedTex(1024, 370), burgerTex(1024, 370)].forEach((t, k) => inst(new THREE.PlaneGeometry(BW, BH), sign(t), boards[k], (d, s) => { d.position.set(s[0] + s[4] * 0.17, s[3] + bottomM + BH / 2, s[1] + s[5] * 0.17); d.rotation.y = s[2]; }));

  // ---- banderas de la Comunidad de Madrid ----
  const flags = [];
  for (let i = 18, n = 0; i < N - 10; i += 38, n++) { if (inTunnel(i, 12)) continue; const side = n % 2 ? 1 : -1, l = side * (L + 0.9); flags.push([tr.X[i] - tr.TZ[i] * l, tr.Z[i] + tr.TX[i] * l, topY(i, side), Math.atan2(tr.TX[i], tr.TZ[i]) + Math.PI / 2 - side * 0.5]); }
  for (let k = 0; k < 7; k++) { const i = 14 + k * 7, l = L + 0.9; flags.push([tr.X[i] - tr.TZ[i] * l, tr.Z[i] + tr.TX[i] * l, tr.Y[i], Math.atan2(tr.TX[i], tr.TZ[i]) + Math.PI / 2 - 0.5]); }
  const FH = 12, FW = 4.8, FT = 3.2;
  inst(new THREE.CylinderGeometry(0.07, 0.13, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.7, roughness: 0.35 }), flags, (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.y = s[2] + FH; });
  const cloth = new THREE.PlaneGeometry(FW, FT, 12, 4).translate(FW / 2, 0, 0); { const p = cloth.attributes.position; for (let k = 0; k < p.count; k++) { const u = p.getX(k) / FW; p.setZ(k, Math.sin(u * 7) * 0.3 * u); } cloth.computeVertexNormals(); }
  const flagM = inst(cloth, new THREE.MeshLambertMaterial({ map: flagTex(), side: THREE.DoubleSide }), flags, (d, s) => { d.position.set(s[0], s[2] + FH - FT / 2 - 0.2, s[1]); d.rotation.y = s[3]; });
  let flagT = 0;
  if (flagM) anim.push((dt) => { flagT += Math.min(dt, 0.05); for (let k = 0; k < flags.length; k++) { const s = flags[k]; D.position.set(s[0], s[2] + FH - FT / 2 - 0.2, s[1]); D.rotation.set(0, s[3] + Math.sin(flagT * 2.4 + k * 1.7) * 0.2, 0); D.scale.set(1, 1, 1); D.updateMatrix(); flagM.setMatrixAt(k, D.matrix); } flagM.instanceMatrix.needsUpdate = true; });

  // ---- túneles: cartel en la boca y la M-11 pasando por encima de los dos ----
  const tun = tr.tunnels || [], names = ['TÚNEL DE VALDEBEBAS', 'TÚNEL IFEMA MADRID'];
  tun.forEach((t, n) => { const i = mod(Math.floor(t.s0 / tr.ds) - 1), m = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.9), sign(textTex(names[n] || '', '#0b2a5c', '#ffffff'))); m.position.set(tr.X[i] - tr.TX[i] * 0.8, tr.Y[i] + 7.7, tr.Z[i] - tr.TZ[i] * 0.8); m.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]) + Math.PI; G.add(m); });
  let hwyDist = () => 1e9;
  if (tun.length >= 2) {
    const mid = (t) => mod(Math.floor((t.s0 + t.s1) / 2 / tr.ds)), a = mid(tun[0]), b = mid(tun[1]);
    let dx = tr.X[b] - tr.X[a], dz = tr.Z[b] - tr.Z[a]; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    const ox = (tr.X[a] + tr.X[b]) / 2, oz = (tr.Z[a] + tr.Z[b]) / 2, yaw = Math.atan2(dx, dz), H = 1500, deck = Math.max(tr.Y[a], tr.Y[b]) + 11, nx = -dz, nz = dx;
    hwyDist = (x, z) => Math.abs((x - ox) * nx + (z - oz) * nz);
    const put = (geo, mat, y, lat = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(ox + nx * lat, y, oz + nz * lat); m.rotation.y = yaw; m.frustumCulled = false; G.add(m); };
    put(new THREE.BoxGeometry(38, 1.2, H * 2), lam(0x8d9096), deck - 0.6);
    for (const sd of [-1, 1]) put(new THREE.BoxGeometry(0.5, 1.1, H * 2), lam(0xc9ccd1), deck + 0.5, sd * 18.8);
    put(new THREE.BoxGeometry(1, 0.9, H * 2), lam(0xc9ccd1), deck + 0.45);
    const piers = []; for (let t = -H; t <= H; t += 36) for (const sd of [-13, 13]) { const x = ox + dx * t + nx * sd, z = oz + dz * t + nz * sd; if (nearest(x, z) > L + 2.5) piers.push([x, z]); }
    inst(new THREE.BoxGeometry(2.6, 1, 2.6).translate(0, 0.5, 0), lam(0x9a9da2), piers, (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.y = deck - 1.2; });
    // tráfico: dos sentidos, tres carriles
    const cols = [0xe8e8ea, 0x23262c, 0xa61e22, 0x2a4f9a, 0xb9bcc2, 0x3a3f46], cars = Array.from({ length: q.density < 1 ? 12 : 22 }, (_, k) => ({ t: -H + (k * 2 * H) / 22 + k * 11, dir: k % 2 ? 1 : -1, lat: (k % 2 ? 1 : -1) * (4.5 + (k % 3) * 4), sp: 24 + (k % 5) * 3 }));
    const traffic = inst(new THREE.BoxGeometry(1.9, 1.35, 4.5), lam(0xffffff), cars, (d, c) => { d.position.set(0, deck + 0.7, 0); }, (c, k) => cols[k % cols.length]);
    if (traffic) anim.push((dt) => { for (let k = 0; k < cars.length; k++) { const c = cars[k]; c.t += c.dir * c.sp * Math.min(dt, 0.05); if (c.t > H) c.t = -H; else if (c.t < -H) c.t = H; D.position.set(ox + dx * c.t + nx * c.lat, deck + 0.7, oz + dz * c.t + nz * c.lat); D.rotation.set(0, yaw, 0); D.scale.set(1, 1, 1); D.updateMatrix(); traffic.setMatrixAt(k, D.matrix); } traffic.instanceMatrix.needsUpdate = true; });
  }

  // ---- IFEMA: pabellones del plano dentro del trazado (coordenadas del plano) ----
  const facIfema = canvasTex('ifema', 512, 128, (x, W, H) => { x.fillStyle = '#e6e9ee'; x.fillRect(0, 0, W, H); x.fillStyle = '#3a5a78'; x.fillRect(0, H * 0.3, W, H * 0.42); x.fillStyle = '#c9d0d8'; for (let k = 0; k < 24; k++) x.fillRect((k * W) / 24, H * 0.3, 3, H * 0.42); });
  const facM = new THREE.MeshLambertMaterial({ map: facIfema });
  const pavilion = (x0, y0, x1, y1, h, roofCol, vault = true) => {
    const w = (x1 - x0) * sc, d = (y1 - y0) * sc, cx = ((x0 + x1) / 2) * sc, cz = ((y0 + y1) / 2) * sc, r = lam(roofCol);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [facM, facM, r, r, facM, facM]); b.position.set(cx, h / 2, cz); G.add(b);
    if (vault) { const v = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), r); v.position.set(cx, h, cz); v.scale.y = 0.24; G.add(v); }
  };
  { const base = new THREE.Mesh(new THREE.PlaneGeometry((690 - 298) * sc, (622 - 405) * sc).rotateX(-Math.PI / 2), lam(0xb6b4ac)); base.position.set(((298 + 690) / 2) * sc, 0.06, ((405 + 622) / 2) * sc); G.add(base); }
  pavilion(352, 410, 420, 616, 13, 0xa9c4ee); pavilion(440, 410, 510, 616, 15, 0x3e7fe0); pavilion(520, 410, 592, 616, 15, 0x3e7fe0); pavilion(606, 410, 680, 616, 13, 0x7d858c);
  pavilion(420, 505, 606, 525, 9, 0x3e7fe0, false); pavilion(300, 445, 345, 590, 10, 0xd1323a, false); pavilion(345, 490, 352, 530, 9, 0xd1323a, false); pavilion(255, 655, 432, 725, 11, 0xc4c7cc);
  occupied.push([((298 + 690) / 2) * sc, ((405 + 622) / 2) * sc, 0]);
  for (const [x, z, ry] of [[(386) * sc, (410 * sc) - 0.3, Math.PI], [300 * sc - 0.3, 518 * sc, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.6), sign(textTex('IFEMA MADRID', '#c8102e', '#ffffff'))); m.position.set(x, 12.8, z); m.rotation.y = ry; G.add(m); }

  // ---- monumentos y skyline ----
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < N; i++) { minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]); }
  const noBuild = [];
  const gl = (c, rep) => { const t = canvasTex(`tower${c}`, 128, 512, (x, W, H) => { x.fillStyle = c; x.fillRect(0, 0, W, H); for (let r = 0; r < 44; r++) for (let k = 0; k < 10; k++) { x.fillStyle = (r * 5 + k * 3) % 7 === 0 ? 'rgba(230,245,255,.55)' : 'rgba(10,25,40,.35)'; x.fillRect(k * 12.8 + 1.5, r * 11.6 + 1.5, 9.8, 8.6); } }); return new THREE.MeshLambertMaterial({ map: t }); };
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; g.add(m); return m; };
  // Cuatro Torres, al oeste: se ven de frente al final de la recta de abajo
  { const g = new THREE.Group(), tx = minX - 520, tz = (minZ + maxZ) / 2 + 40; g.position.set(tx, 0, tz); G.add(g); noBuild.push([tx, tz, 130]);
    const white = lam(0xe9edf2), dark = gl('#17324a'), blue = gl('#2f6d94'), teal = gl('#4b8fa0'), bronze = gl('#5d5140');
    add(g, new THREE.BoxGeometry(34, 150, 22).translate(0, 75, 0), blue, 0, 0, 0); for (const sd of [-1, 1]) add(g, new THREE.BoxGeometry(8, 42, 22), white, sd * 13, 171, 0); add(g, new THREE.BoxGeometry(36, 10, 24), white, 0, 196, 0); // Cepsa: arco abierto en lo alto
    add(g, new THREE.CylinderGeometry(19, 21, 172, 28).translate(0, 86, 0), bronze, 0, 0, 62); add(g, new THREE.CylinderGeometry(22, 19, 16, 28), lam(0xb99a4a), 0, 180, 62); // PwC
    add(g, new THREE.BoxGeometry(32, 180, 32).translate(0, 90, 0), teal, 0, 0, 124); add(g, new THREE.CylinderGeometry(11, 23, 20, 4).rotateY(Math.PI / 4), teal, 0, 190, 124); // Cristal
    add(g, new THREE.BoxGeometry(34, 168, 34).translate(0, 84, 0), dark, 0, 0, 186); add(g, new THREE.BoxGeometry(36, 8, 36), white, 0, 172, 186); } // Emperador
  // Puerta de Europa (torres KIO), inclinadas una hacia la otra
  { const g = new THREE.Group(), tx = minX - 300, tz = maxZ + 240, m = gl('#3b5a72'); g.position.set(tx, 0, tz); G.add(g); noBuild.push([tx, tz, 110]);
    for (const sd of [-1, 1]) { const t = add(g, new THREE.BoxGeometry(34, 118, 34).translate(0, 59, 0), m, sd * 44, 0, 0); t.rotation.z = sd * 0.26; } }
  // Puerta de Alcalá, de frente al llegar por la recta de abajo
  { const g = new THREE.Group(), tx = 207 * sc - 62, tz = 756 * sc; g.position.set(tx, 0, tz); g.rotation.y = Math.PI / 2; g.scale.setScalar(1.25); G.add(g); noBuild.push([tx, tz, 42]);
    const stone = lam(0xd8ccb4), shade = new THREE.MeshBasicMaterial({ color: 0x24282e }), dep = 8;
    add(g, new THREE.BoxGeometry(37, 12.5, dep).translate(0, 6.25, 0), stone, 0, 0, 0); add(g, new THREE.BoxGeometry(38.6, 0.9, dep + 1.2), stone, 0, 12.9, 0); add(g, new THREE.BoxGeometry(15, 3.6, dep).translate(0, 1.8, 0), stone, 0, 13.3, 0);
    const pedi = new THREE.Shape(); pedi.moveTo(-8.5, 0); pedi.lineTo(8.5, 0); pedi.lineTo(0, 3.1); pedi.closePath(); add(g, new THREE.ExtrudeGeometry(pedi, { depth: dep, bevelEnabled: false }).translate(0, 0, -dep / 2), stone, 0, 16.9, 0);
    add(g, new THREE.BoxGeometry(5.4, 2.6, 3).translate(0, 1.3, 0), lam(0x3a4436), 0, 18.6, 0);
    const arch = (w, h) => { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return new THREE.ShapeGeometry(s, 14); };
    for (const fz of [dep / 2 + 0.04]) { add(g, arch(5.4, 10.2), shade, 0, 0, fz); for (const sd of [-1, 1]) { add(g, arch(4.2, 9), shade, sd * 7.6, 0, fz); add(g, new THREE.PlaneGeometry(2.9, 6.4).translate(0, 3.2, 0), shade, sd * 14.4, 0, fz); } }
    for (const cx of [-17.6, -11, -9.6 + 5.4 - 1.2, 11, 17.6, 5.4]) add(g, new THREE.CylinderGeometry(0.5, 0.56, 12, 12).translate(0, 6, 0), stone, cx, 0, dep / 2 + 0.55); }
  // arena al sur del trazado (el óvalo que aparece en el plano)
  { const x = 1150 * sc, z = 760 * sc; if (nearest(x, z) > 48) { const a = new THREE.Mesh(new THREE.CylinderGeometry(48, 54, 22, 40, 1, true).translate(0, 11, 0), new THREE.MeshLambertMaterial({ color: 0xe6e8ec, side: THREE.DoubleSide })); a.position.set(x, 0, z); a.scale.z = 0.72; G.add(a); noBuild.push([x, z, 66]); } }

  // ---- ciudad: bloques con fachada en textura (3 materiales, sin ventanas sueltas, coste muy bajo) ----
  const step = q.density < 1 ? 44 : 30, types = [[], [], []]; let hash = 1;
  const rnd = () => { hash = (hash * 16807) % 2147483647; return (hash & 0xffff) / 0xffff; };
  for (let x = minX - 500; x <= maxX + 500; x += step) for (let z = minZ - 480; z <= maxZ + 480; z += step) {
    const px = x + (rnd() - 0.5) * 12, pz = z + (rnd() - 0.5) * 12, w = 15 + rnd() * 12, d = 13 + rnd() * 12;
    if (insideLoop(px, pz) || nearest(px, pz) < L + 18 || hwyDist(px, pz) < 26 + w || noBuild.some((o) => (o[0] - px) ** 2 + (o[1] - pz) ** 2 < o[2] * o[2]) || !free(px, pz, 16)) continue;
    const t = rnd(), k = t < 0.45 ? 0 : t < 0.86 ? 1 : 2, h = k === 2 ? 34 + rnd() * 42 : 15 + rnd() * 24;
    types[k].push([px, pz, w, d, h, (Math.floor(rnd() * 4) * Math.PI) / 2 + (rnd() - 0.5) * 0.2]);
  }
  const roofMat = lam(0xa89e8e);
  facades().forEach((t, k) => { const mf = new THREE.MeshLambertMaterial({ map: t }); inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [mf, mf, roofMat, roofMat, mf, mf], types[k], (dm, s) => { dm.position.set(s[0], 0, s[1]); dm.rotation.y = s[5]; dm.scale.set(s[2], s[4], s[3]); }); });

  // ---- vida de ciudad: césped del interior, coches aparcados, farolas, grúas de Valdebebas ----
  { const sh = new THREE.Shape(); for (let i = 0; i < N; i += 6) i ? sh.lineTo(tr.X[i], -tr.Z[i]) : sh.moveTo(tr.X[i], -tr.Z[i]); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), lam(0x6f8f48)); m.position.y = 0.03; G.add(m); }
  { const cars = [], lamps = []; for (let i = 6; i < N; i += 7) { if (inTunnel(i, 8)) continue; const side = i % 14 < 7 ? 1 : -1, l = side * (L + 9.5), x = tr.X[i] - tr.TZ[i] * l, z = tr.Z[i] + tr.TX[i] * l; if (i % 28 < 7) { const ll = -side * (L + 1.5), lx = tr.X[i] - tr.TZ[i] * ll, lz = tr.Z[i] + tr.TX[i] * ll; if (nearest(lx, lz) > L + 1 && free(lx, lz, 1)) lamps.push([lx, lz, tr.Y[i], Math.atan2(tr.TX[i], tr.TZ[i]) + (ll > 0 ? Math.PI : 0)]); } if (nearest(x, z) > L + 3 && free(x, z, 3) && !insideLoop(x, z) && hwyDist(x, z) > 22) cars.push([x, z, Math.atan2(tr.TX[i], tr.TZ[i]), Math.max(0, tr.Y[i] * (1 - 3.5 / (2.5 + 1.1 * tr.Y[i])))]); }
    const cc = [0xc8102e, 0xe8e8ea, 0x23262c, 0x2a4f9a, 0xb9bcc2, 0xd9a020], body = mergeGeometries([new THREE.BoxGeometry(1.9, 0.75, 4.4).translate(0, 0.62, 0), new THREE.BoxGeometry(1.7, 0.6, 2.2).translate(0, 1.28, -0.2)]);
    inst(body, lam(0xffffff), q.density < 1 ? cars.filter((_, k) => k % 2 === 0) : cars, (d, s) => { d.position.set(s[0], s[3], s[1]); d.rotation.y = s[2]; }, (s, k) => cc[k % cc.length]);
    const pole = mergeGeometries([new THREE.CylinderGeometry(0.09, 0.14, 9, 6).translate(0, 4.5, 0), new THREE.BoxGeometry(0.24, 0.18, 2.6).translate(0, 8.95, 1.2)]);
    inst(pole, lam(0x3c4048), lamps, (d, s) => { d.position.set(s[0], s[2], s[1]); d.rotation.y = s[3]; });
    const crane = mergeGeometries([new THREE.BoxGeometry(1.5, 62, 1.5).translate(0, 31, 0), new THREE.BoxGeometry(52, 1.2, 1.2).translate(14, 60, 0), new THREE.BoxGeometry(5, 3, 3).translate(-11, 58, 0)]), cr = []; for (let k = 0; k < 7; k++) { const px = minX + ((k + 0.5) / 7) * (maxX - minX), pz = minZ - 190 - (k % 3) * 60; cr.push([px, pz, k * 0.9]); }
    inst(crane, lam(0xf0b428), cr, (d, s) => { d.position.set(s[0], 0, s[1]); d.rotation.y = s[2]; }); }
  // ---- arbolado: parque de Valdebebas dentro del trazado y bulevares fuera ----
  const trees = [];
  const ifemaZone = (x, z) => x < 700 * sc && z > 300 * sc;
  for (let x = minX; x <= maxX; x += 12) for (let z = minZ; z <= maxZ; z += 12) { const px = x + (rnd() - 0.5) * 11, pz = z + (rnd() - 0.5) * 11; if (insideLoop(px, pz) && !ifemaZone(px, pz) && nearest(px, pz) > L + 5 && free(px, pz, 4) && hwyDist(px, pz) > 22) trees.push([px, pz, 0.8 + rnd() * 0.7, rnd() * 6.28]); }
  for (let i = 8; i < N; i += 11) for (const side of [-1, 1]) { const l = side * (L + 8 + rnd() * 10), px = tr.X[i] - tr.TZ[i] * l, pz = tr.Z[i] + tr.TX[i] * l; if (nearest(px, pz) > L + 4 && free(px, pz, 3) && hwyDist(px, pz) > 22 && !ifemaZone(px, pz)) trees.push([px, pz, 0.7 + rnd() * 0.6, rnd() * 6.28]); }
  const cap = q.density < 1 ? 400 : 1000, every = Math.max(1, Math.ceil(trees.length / cap)), list = trees.filter((_, k) => k % every === 0);
  // ---- verde y gente: setos y flores junto a las aceras, peatones, público en las gradas y balcones ----
  { const green = (count, a, b) => { const out = []; for (let g = 0; out.length < count && g < count * 10; g++) { const i = Math.floor(rnd() * N), side = rnd() < 0.5 ? -1 : 1, l = (a + rnd() * (b - a)) * side, x = tr.X[i] - tr.TZ[i] * l, z = tr.Z[i] + tr.TX[i] * l; if (nearest(x, z) > L + 1 && free(x, z, 1.2) && hwyDist(x, z) > 22) out.push([x, z, Math.max(0, tr.Y[i] * (1 - (Math.abs(l) - L - 6) / (2.5 + 1.1 * tr.Y[i]))), rnd()]); } return out; };
    const dn = q.density < 1 ? 0.5 : 1;
    spriteField(G, 'bush', green(Math.round(1200 * dn), L + 7, L + 24), 0.9, 2.2, 1.3);
    spriteField(G, 'poplar', green(Math.round(380 * dn), L + 8, L + 22), 9, 15);
    const people = [], shirt = (k) => SHIRTS[k % SHIRTS.length], toRoad = (i, side) => Math.atan2(tr.TZ[i] * side, -tr.TX[i] * side);
    for (let i = 3, c = 0; i < N; i += q.density < 1 ? 7 : 4) { if (inTunnel(i, 10)) continue; const side = c++ % 2 ? 1 : -1, l = L + 0.9 + rnd() * 4.3, len = 8 + rnd() * 18, tx = tr.TX[i], tz = tr.TZ[i], x = tr.X[i] - tz * l * side, z = tr.Z[i] + tx * l * side; if (nearest(x + tx * len * 0.5, z + tz * len * 0.5) < L + 1 || nearest(x - tx * len * 0.5, z - tz * len * 0.5) < L + 1 || !free(x, z, 1.5) || tr.walk.W[side > 0 ? 1 : 0][i] < 5.5) continue; const walk = rnd() < 0.62, y = tr.Y[i] + (tr.bank ? Math.tan(tr.bank[i]) * side * L : 0); people.push([x, y, z, walk ? Math.atan2(tx, tz) + (rnd() < 0.5 ? Math.PI : 0) : toRoad(i, side) + (rnd() - 0.5) * 0.8, walk ? WALK : crowdType(rnd()), 1.1 + rnd() * 0.8, walk ? len : 0, shirt(people.length)]); }
    standSpots.forEach((s) => { for (let t = 0, c = q.density < 1 ? 6 : 12; t < c; t++) { const lx = 0.72 + Math.floor(rnd() * 7) * 1.45, lz = (rnd() - 0.5) * 11, tier = Math.round((lx - 0.72) / 1.45), yaw = s[3], x = s[0] + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z = s[2] - Math.sin(yaw) * lx + Math.cos(yaw) * lz; people.push([x, s[1] + (tier + 1) * 0.95, z, Math.atan2(-Math.cos(yaw), Math.sin(yaw)) + (rnd() - 0.5) * 0.5, rnd() < 0.3 ? JUMP : rnd() < 0.85 ? CHEER : IDLE, 0, 0, shirt(people.length + 2)]); } });
    const slabs = [], step4 = Math.PI / 2; for (const list of [types[0], types[1]]) for (const b of list) { if (nearest(b[0], b[1]) > L + 46 || rnd() > dn) continue; let bi = 0, bd = 1e18; for (let i = 0; i < N; i += 5) { const d = (tr.X[i] - b[0]) ** 2 + (tr.Z[i] - b[1]) ** 2; if (d < bd) { bd = d; bi = i; } } let bestN = null, bv = -2; for (let f = 0; f < 4; f++) { const a = b[5] + f * step4, nx = Math.sin(a), nz = Math.cos(a), dx = tr.X[bi] - b[0], dz = tr.Z[bi] - b[1], v = (dx * nx + dz * nz) / (Math.hypot(dx, dz) || 1); if (v > bv) { bv = v; bestN = { a, nx, nz, half: f % 2 ? b[2] / 2 : b[3] / 2, wide: f % 2 ? b[3] : b[2] }; } } const fl = Math.floor(b[4] / 3.3); for (let c = 0; c < 3; c++) { const floor = 2 + Math.floor(rnd() * Math.max(1, fl - 3)), off = (rnd() - 0.5) * (bestN.wide - 4), x = b[0] + bestN.nx * (bestN.half + 0.7) + bestN.nz * off, z = b[1] + bestN.nz * (bestN.half + 0.7) - bestN.nx * off, y = floor * 3.3; slabs.push([x, y, z, bestN.a]); people.push([x, y + 0.12, z, bestN.a, rnd() < 0.55 ? CHEER : IDLE, 0, 0, shirt(people.length + 5)]); } }
    const bal = mergeGeometries([new THREE.BoxGeometry(3.2, 0.2, 1.5), new THREE.BoxGeometry(3.2, 0.9, 0.07).translate(0, 0.5, 0.72)]);
    inst(bal, lam(0xe8e2d6), slabs, (d, s) => { d.position.set(s[0], s[1], s[2]); d.rotation.y = s[3]; });
    npcMesh(G, people); }
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 3.4, 6).translate(0, 1.7, 0), crown = mergeGeometries([new THREE.IcosahedronGeometry(2.4, 1).translate(0, 5, 0), new THREE.IcosahedronGeometry(1.8, 1).translate(1.1, 4.2, 0.4)]);
  const place = (d, s) => { d.position.set(s[0], 0, s[1]); d.rotation.y = s[3]; d.scale.setScalar(s[2] * 1.5); };
  inst(trunk, lam(0x6b5540), list, place);
  inst(crown, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), list, place, (s, k) => [0x5f8a3e, 0x4c7a38, 0x76964a, 0x6a8f3c][k % 4]);
}
