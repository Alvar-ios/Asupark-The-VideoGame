// Rally Safari (Kenia): elementos propios del circuito de tierra — vado con agua tras el salto, baches, carteles, banderas y el parque de asistencia.
// La sabana (acacias, baobabs, chozas, público) la pone filler.js con la configuración 'rally'.
import * as THREE from 'three';
import { WALL } from './track.js';

const hash = (x) => { const v = Math.sin(x * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const canvas = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

const rippleTex = () => { const t = canvas(256, 256, (x, W, H) => {
  x.fillStyle = '#8c6a46'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) { const px = hash(k) * W, py = hash(k + 50) * H, r = 6 + hash(k + 99) * 22; x.strokeStyle = `rgba(255,236,200,${0.1 + hash(k + 7) * 0.2})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(px, py, r * 1.6, r * 0.7, 0, 0, 6.283); x.stroke(); }
  for (let k = 0; k < 600; k++) { x.fillStyle = `rgba(${90 + hash(k) * 40},${60 + hash(k + 3) * 30},${30},0.12)`; x.fillRect(hash(k + 11) * W, hash(k + 22) * H, 3, 2); }
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

const signTex = (title, sub, bg, fg) => canvas(512, 256, (x, W, H) => {
  x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = fg; x.lineWidth = 14; x.strokeRect(10, 10, W - 20, H - 20);
  x.fillStyle = fg; x.textAlign = 'center'; x.font = '900 96px system-ui, sans-serif'; x.fillText(title, W / 2, 128); x.font = '700 44px system-ui, sans-serif'; x.fillText(sub, W / 2, 196);
});

export function rallyDecor(tr, th, scene, q, extraAnim) {
  const N = tr.N, G = new THREE.Group(), shadow = !!q.shadows; scene.add(G);
  const hwAt = (i) => (tr.hw ? tr.hw[i] : tr.half || 5.2);
  const at = (i, l) => [tr.X[i] - tr.TZ[i] * l, tr.Z[i] + tr.TX[i] * l];
  const D = new THREE.Object3D();
  const near = (x, z, r) => { for (let i = 0; i < N; i += 4) if ((tr.X[i] - x) ** 2 + (tr.Z[i] - z) ** 2 < r * r) return true; return false; };

  // ---- vado: agua marrón sobre la pista, con orillas de barro oscuro ----
  for (const f of tr.fords || []) {
    const i0 = Math.floor(f.s0 / tr.ds), i1 = Math.ceil(f.s1 / tr.ds), hw = hwAt(i0) + 7;
    const strip = (lat, y, mat, uvK) => {
      const pos = [], uv = [], idx = [];
      for (let i = i0; i <= i1; i++) { const k = i % N, [ax, az] = at(k, -lat), [bx, bz] = at(k, lat), y0 = tr.Y[k] + y, v = (i - i0) * uvK; pos.push(ax, y0, az, bx, y0, bz); uv.push(0, v, 1, v); if (i > i0) { const a = (i - i0 - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.receiveShadow = shadow; G.add(m); return m;
    };
    const mud = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    strip(hw + 1.5, 0.035, mud, 0.1);
    const tx = rippleTex(); tx.repeat.set(2, 6);
    const water = new THREE.MeshPhysicalMaterial({ color: 0xe0b684, map: tx, roughness: 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    strip(hw, 0.09, water, 0.12);
    extraAnim.push((dt) => { tx.offset.y -= dt * 0.12; tx.offset.x += dt * 0.02; });
    // piedras y matas en las orillas
    const rocks = [];
    for (let k = 0; k < 22; k++) { const i = Math.floor(i0 + hash(k * 3 + 1) * (i1 - i0)) % N, side = k % 2 ? 1 : -1, l = (hw + 0.5 + hash(k + 40) * 3) * side, [x, z] = at(i, l); rocks.push([x, tr.Y[i], z, 0.5 + hash(k + 70) * 0.9, hash(k + 90) * 6.28]); }
    const rm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95, flatShading: true }), rocks.length);
    rocks.forEach((r, k) => { D.position.set(r[0], r[1] + r[3] * 0.25, r[2]); D.rotation.set(r[4], r[4] * 1.7, 0); D.scale.set(r[3] * 1.3, r[3] * 0.8, r[3]); D.updateMatrix(); rm.setMatrixAt(k, D.matrix); });
    rm.frustumCulled = false; rm.castShadow = shadow; G.add(rm);
    // juncos
    const reedG = new THREE.ConeGeometry(0.07, 1.6, 4).translate(0, 0.8, 0), reeds = [];
    for (let k = 0; k < 160; k++) { const i = Math.floor(i0 - 6 + hash(k + 5) * (i1 - i0 + 12)) % N, side = hash(k + 8) < 0.5 ? -1 : 1, l = (hw + 0.2 + hash(k + 9) * 2.6) * side, [x, z] = at(i, l); reeds.push([x, tr.Y[i], z, 0.7 + hash(k + 13) * 0.8, hash(k + 17) * 6.28]); }
    const reedM = new THREE.InstancedMesh(reedG, new THREE.MeshStandardMaterial({ color: 0x8a9a45, roughness: 0.95, side: THREE.DoubleSide }), reeds.length);
    reeds.forEach((r, k) => { D.position.set(r[0], r[1], r[2]); D.rotation.set((hash(k) - 0.5) * 0.4, r[4], (hash(k + 2) - 0.5) * 0.4); D.scale.set(1, r[3], 1); D.updateMatrix(); reedM.setMatrixAt(k, D.matrix); });
    reedM.frustumCulled = false; G.add(reedM);
  }

  // ---- baches: hueco oscuro con borde de tierra levantada ----
  if (tr.potholes && tr.potholes.length) {
    const dark = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3b200e, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), tr.potholes.length);
    const rim = new THREE.InstancedMesh(new THREE.RingGeometry(0.88, 1.28, 22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb87a46, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), tr.potholes.length);
    tr.potholes.forEach((p, k) => {
      const i = Math.floor(p.s / tr.ds) % N, [x, z] = at(i, p.lat), ang = Math.atan2(tr.TX[i], tr.TZ[i]);
      D.position.set(x, tr.Y[i] + 0.06, z); D.rotation.set(0, ang, 0); D.scale.set(p.r * 1.1, 1, p.r * 1.35); D.updateMatrix(); dark.setMatrixAt(k, D.matrix); rim.setMatrixAt(k, D.matrix);
    });
    dark.frustumCulled = rim.frustumCulled = false; G.add(rim, dark);
  }

  // ---- carteles de aviso y banderas junto al salto y el vado ----
  const ramp = tr.ramps && tr.ramps[0];
  const sign = (i, side, tex, w, h, yaw) => {
    const [x, z] = at(i, (WALL + 1.2) * side), y = tr.Y[i];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h + 1.2, 6).translate(0, (h + 1.2) / 2, 0), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })); post.position.set(x, y, z); G.add(post);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); panel.position.set(x, y + 1.2 + h / 2, z); panel.rotation.y = yaw; G.add(panel);
  };
  if (ramp) {
    const iA = Math.floor((ramp.s0 - 70) / tr.ds), iB = Math.floor((ramp.s0 - 38) / tr.ds), tx1 = signTex('SALTO', 'Y VADO · 200 m', '#ffd23a', '#1a1a1a'), tx2 = signTex('¡SALTO!', 'AGUA TRAS LA RAMPA', '#e8332a', '#ffffff');
    for (const side of [-1, 1]) {
      const yaw = Math.atan2(tr.TX[iA], tr.TZ[iA]) + Math.PI / 2 * 0 + (side > 0 ? 0 : 0);
      sign(iA, side, tx1, 3.6, 1.8, Math.atan2(tr.TX[iA], tr.TZ[iA]) + Math.PI);
      sign(iB, side, tx2, 3.6, 1.8, Math.atan2(tr.TX[iB], tr.TZ[iB]) + Math.PI);
    }
    // banderas de cuadros y de color en la rampa
    const flagTex = canvas(128, 64, (x, W, H) => { for (let a = 0; a < 8; a++) for (let b = 0; b < 4; b++) { x.fillStyle = (a + b) % 2 ? '#111' : '#f4f4f4'; x.fillRect(a * 16, b * 16, 16, 16); } });
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide });
    const pennant = [0xe8332a, 0xffd23a, 0x1f9a4a, 0x111111];
    for (const side of [-1, 1]) for (let k = 0; k < 7; k++) {
      const s = ramp.s0 - 6 + k * 5, i = Math.floor(s / tr.ds) % N, [x, z] = at(i, (hwAt(i) + 1.6) * side), y = tr.Y[i];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 5).translate(0, 1.6, 0), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })); pole.position.set(x, y, z); G.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), k % 2 ? flagMat : new THREE.MeshBasicMaterial({ color: pennant[k % 4], side: THREE.DoubleSide })); fl.position.set(x + (tr.TX[i]) * 0.5, y + 2.9, z + tr.TZ[i] * 0.5); fl.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]) + Math.PI / 2; G.add(fl);
    }
  }

  // ---- parque de asistencia: carpas y camiones junto a la recta de salida ----
  { const tents = [], trucks = []; let side = 0;
    for (const sd of [1, -1]) { const i = 110, [x, z] = at(i, (WALL + 26) * sd); if (!near(x, z, WALL + 14)) { side = sd; break; } }
    if (side) for (let k = 0; k < 7; k++) {
      const i = 30 + k * 26, l = (WALL + 22 + (k % 2) * 7) * side, [x, z] = at(i, l); if (near(x, z, WALL + 12)) continue;
      tents.push([x, tr.Y[i], z, Math.atan2(tr.TX[i], tr.TZ[i]), k]);
      const [tx2, tz2] = at(i + 12, (WALL + 33) * side); if (!near(tx2, tz2, WALL + 12)) trucks.push([tx2, tr.Y[i], tz2, Math.atan2(tr.TX[i], tr.TZ[i]), k]);
    }
    const cols = [0xe8332a, 0xffd23a, 0x2a6fd0, 0x1f9a4a, 0xf2f2f2, 0xff7a1a, 0xe8559a];
    const tentG = new THREE.ConeGeometry(4.6, 3.2, 4).rotateY(Math.PI / 4).translate(0, 3.3, 0), wallG = new THREE.BoxGeometry(5.6, 1.9, 5.6).translate(0, 0.95, 0);
    const tm = new THREE.InstancedMesh(tentG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), tents.length), wm = new THREE.InstancedMesh(wallG, new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.9 }), tents.length);
    tents.forEach((t, k) => { D.position.set(t[0], t[1], t[2]); D.rotation.set(0, t[3], 0); D.scale.set(1, 1, 1); D.updateMatrix(); tm.setMatrixAt(k, D.matrix); wm.setMatrixAt(k, D.matrix); tm.setColorAt(k, new THREE.Color(cols[t[4] % cols.length])); });
    tm.frustumCulled = wm.frustumCulled = false; tm.castShadow = wm.castShadow = shadow; if (tents.length) G.add(wm, tm);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 3, 7.5).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), trucks.length), cab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 2.2, 2.2).translate(0, 1.7, 4.8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }), trucks.length);
    trucks.forEach((t, k) => { D.position.set(t[0], t[1], t[2]); D.rotation.set(0, t[3], 0); D.updateMatrix(); body.setMatrixAt(k, D.matrix); cab.setMatrixAt(k, D.matrix); body.setColorAt(k, new THREE.Color(cols[(t[4] + 2) % cols.length])); });
    body.frustumCulled = cab.frustumCulled = false; body.castShadow = cab.castShadow = shadow; if (trucks.length) G.add(body, cab);
  }
}
