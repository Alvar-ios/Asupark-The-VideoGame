// Construcción de la escena 3D de una pista (three.js)
import * as THREE from 'three';
import { ROAD_HALF, WALL } from './track.js';
import { rngFromSeed } from './rng.js';

const col = (hex) => new THREE.Color(hex);

function skyMesh(th) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: col(th.skyTop) }, hor: { value: col(th.skyHor) }, sunC: { value: col(th.sun) }, sunD: { value: new THREE.Vector3(...th.sunDir).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunC; uniform vec3 sunD; varying vec3 vD; void main(){ float h = clamp(vD.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(normalize(vD), sunD),0.0); c += sunC*(pow(s,600.0)*1.5 + pow(s,12.0)*0.22); if(vD.y<0.0) c = hor; gl_FragColor = vec4(c,1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

function asphaltTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), im = x.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const n = 240 + (Math.random() - 0.5) * 18 - (Math.random() < 0.03 ? 22 : 0);
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = n; im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function glowTex(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.25, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// cielo completo: degradado + nubes (o estrellas) + halo del sol
function skyGroup(th, rng) {
  const g = new THREE.Group(); g.add(skyMesh(th));
  if (th.night) {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = rng() * 6.283, e = 0.08 + rng() * 1.2, r = 1700; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const st = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false })); st.renderOrder = -9; g.add(st);
  } else {
    const cm = new THREE.MeshBasicMaterial({ color: col(th.skyHor).lerp(col(0xffffff), 0.7), transparent: true, opacity: 0.85, fog: false, depthWrite: false });
    const cg = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 18; i++) {
      const a = rng() * 6.283, r = 800 + rng() * 800, m = new THREE.Mesh(cg, cm);
      m.position.set(Math.cos(a) * r, 230 + rng() * 220, Math.sin(a) * r); m.scale.set(130 + rng() * 150, 22 + rng() * 18, 80 + rng() * 80); m.renderOrder = -9; g.add(m);
    }
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: th.sun, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: th.night ? 0.5 : 0.9 }));
  const d = new THREE.Vector3(...th.sunDir).normalize().multiplyScalar(1500); sp.position.copy(d); sp.scale.setScalar(th.night ? 220 : 520); sp.renderOrder = -8; g.add(sp);
  g.frustumCulled = false;
  return g;
}
// reflejos para la pintura de los coches (mapa de entorno desde el cielo)
function makeEnv(renderer, th) {
  const sc = new THREE.Scene(); sc.add(skyMesh(th));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(1700, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col(th.ground).lerp(col(th.skyHor), 0.25) })); gnd.position.y = -4; sc.add(gnd);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(90, 12, 8), new THREE.MeshBasicMaterial({ color: col(th.sun).multiplyScalar(6) }));
  sunBall.position.copy(new THREE.Vector3(...th.sunDir).normalize().multiplyScalar(1300)); sc.add(sunBall);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0.03, 1, 4000);
  pm.dispose();
  sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
function signTex(label, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#0c1220'; x.fillRect(0, 0, 256, 96); x.strokeStyle = color; x.lineWidth = 8; x.strokeRect(4, 4, 248, 88);
  x.fillStyle = color; x.font = '900 italic 64px "Segoe UI",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function gantry(tr, s, label, color) {
  const g = new THREE.Group(), post = new THREE.MeshLambertMaterial({ color: 0x2a2f3a, flatShading: true });
  const w = (WALL + 1.6) * 2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, 0.6), new THREE.MeshBasicMaterial({ map: signTex(label, color) }));
  beam.position.y = 7.4; g.add(beam);
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), post); p.position.set(sd * (WALL + 0.8), 3.75, 0); g.add(p); }
  const i = Math.floor((s / tr.ds)) % tr.N;
  g.position.set(tr.X[i], tr.Y[i], tr.Z[i]); g.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]);
  return g;
}
// montones de neumáticos en el exterior de las curvas cerradas
function tyreStacks(tr, th, scene) {
  const spots = [];
  for (let i = 0; i < tr.N; i += 5) {
    const k = tr.kap[i];
    if (Math.abs(k) < 0.018) continue;
    const side = k > 0 ? 1 : -1, l = (WALL + 1.25) * side;
    spots.push([tr.X[i] + -tr.TZ[i] * l, tr.Y[i], tr.Z[i] + tr.TX[i] * l, i]);
  }
  if (!spots.length) return;
  const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.length * 3);
  const d = new THREE.Object3D(), a = col(th.kerb1), b = col(th.kerb2), dk = col(0x15171c);
  spots.forEach((sp, k) => { for (let h = 0; h < 3; h++) { d.position.set(sp[0], sp[1] + 0.25 + h * 0.5, sp[2]); d.rotation.set(0, 0, 0); d.updateMatrix(); m.setMatrixAt(k * 3 + h, d.matrix); m.setColorAt(k * 3 + h, h === 1 ? (Math.floor(sp[3] / 5) % 2 ? a : b) : dk); } });
  m.frustumCulled = false; m.castShadow = false; scene.add(m);
}

// Malla estática de carretera + arcenes + terraplenes (colores por vértice)
function roadMesh(tr, th, stride = 1) {
  const N = tr.N, hw = ROAD_HALF, L = WALL;
  const pos = [], colors = [], uvs = [];
  const cRoad = col(th.road), cRoad2 = col(th.road).multiplyScalar(0.93), cGrass = col(th.grass), cDirt = col(th.dirt);
  const k1 = col(th.kerb1), k2 = col(th.kerb2), white = col(0xf2f2f2), black = col(0x161616), yel = col(0xffc400), blk = col(0x222222);
  const pushQuad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c, uv) => {
    // a,b = borde i (izq, der); c,d = borde i+1 (izq, der)
    pos.push(ax, ay, az, cx, cy, cz, bx, by, bz, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b);
    const [ua, va, ub, vb, uc, vc, ud, vd] = uv;
    uvs.push(ua, va, uc, vc, ub, vb, ub, vb, uc, vc, ud, vd);
  };
  for (let i = 0; i < N; i += stride) {
    const j = (i + stride) % N, s = i * tr.ds;
    const hi = tr.Y[i], hj = tr.Y[j];
    const eoI = L + 2.5 + hi * 1.1, eoJ = L + 2.5 + hj * 1.1;
    const lat = (k, h, eo) => [[-eo, 0], [-L, h - 0.05], [-(hw + 1), h], [-hw, h], [-0.22, h], [0.22, h], [hw, h], [hw + 1, h], [L, h - 0.05], [eo, 0]][k];
    const inRamp = tr.ramps.some((r) => s >= r.s0 && s < r.s0 + r.len);
    const stripe = Math.floor(s / 5) % 2 === 0;
    const dashOn = Math.floor(s / 8) % 2 === 0;
    for (let b = 0; b < 9; b++) {
      const [l0, y0i] = lat(b, hi, eoI), [l1, y1i] = lat(b + 1, hi, eoI);
      const [l0j, y0j] = lat(b, hj, eoJ), [l1j, y1j] = lat(b + 1, hj, eoJ);
      const P = (idx, l, y) => [tr.X[idx] + -tr.TZ[idx] * l, y, tr.Z[idx] + tr.TX[idx] * l];
      const a = P(i, l0, y0i), bb = P(i, l1, y1i), c = P(j, l0j, y0j), d = P(j, l1j, y1j);
      let color;
      if (b === 0 || b === 8) color = cDirt;
      else if (b === 1 || b === 7) color = cGrass;
      else if (b === 2 || b === 6) color = stripe ? k1 : k2;
      else {
        color = Math.floor(s / 24) % 2 ? cRoad : cRoad2;
        if (b === 4 && dashOn) color = white;
        if (inRamp) color = Math.floor(s / 1.5) % 2 ? yel : blk;
      }
      const s2 = (i + stride) * tr.ds, K = 1 / 5;
      pushQuad(a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], d[0], d[1], d[2], color, [l0 * K, s * K, l1 * K, s * K, l0j * K, s2 * K, l1j * K, s2 * K]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  // las normales deben apuntar hacia arriba: si salen invertidas, las volteamos
  const nrm = g.attributes.normal;
  let up = 0; for (let k = 0; k < Math.min(nrm.count, 3000); k++) up += nrm.getY(k);
  if (up < 0) { for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, -nrm.getX(k), -nrm.getY(k), -nrm.getZ(k)); }
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, map: th.toy ? null : asphaltTex() }));
  m.receiveShadow = true;
  return m;
}

function wallMesh(tr, th, stride = 1) {
  const N = tr.N, L = WALL, pos = [], colors = [];
  const c1 = col(th.wall1), c2 = col(th.wall2);
  const H = 0.55, T = 0.5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, s = i * tr.ds, c = Math.floor(s / 6) % 2 ? c1 : c2;
      const P = (idx, l, y) => [tr.X[idx] + -tr.TZ[idx] * l * side, y, tr.Z[idx] + tr.TX[idx] * l * side];
      const a0 = P(i, L, tr.Y[i] - 0.05), a1 = P(i, L, tr.Y[i] + H), b0 = P(j, L, tr.Y[j] - 0.05), b1 = P(j, L, tr.Y[j] + H);
      const t0 = P(i, L + T, tr.Y[i] + H), t1 = P(j, L + T, tr.Y[j] + H);
      const quad = (p, q, r, s2) => { pos.push(...p, ...r, ...q, ...q, ...r, ...s2); for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b); };
      quad(a0, a1, b0, b1);
      quad(a1, t0, b1, t1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
}

// tira que sigue la carretera (turbos y luces de neón)
function stripGeom(tr, s0, s1, l0, l1, lift) {
  const pos = [], idx = [];
  const n = Math.max(2, Math.round((s1 - s0) / tr.ds));
  for (let k = 0; k <= n; k++) {
    const s = s0 + (k / n) * (s1 - s0), f = (((s / tr.ds) % tr.N) + tr.N) % tr.N, i = Math.floor(f), j = (i + 1) % tr.N, t = f - i;
    const tx = tr.TX[i] + (tr.TX[j] - tr.TX[i]) * t, tz = tr.TZ[i] + (tr.TZ[j] - tr.TZ[i]) * t, tl = Math.hypot(tx, tz);
    const nx = -tz / tl, nz = tx / tl, x = tr.X[i] + (tr.X[j] - tr.X[i]) * t, z = tr.Z[i] + (tr.Z[j] - tr.Z[i]) * t, y = tr.Y[i] + (tr.Y[j] - tr.Y[i]) * t + lift;
    pos.push(x + nx * l0, y, z + nz * l0, x + nx * l1, y, z + nz * l1);
  }
  const uv = [];
  for (let k = 0; k <= n; k++) uv.push(0, k / n, 1, k / n);
  for (let k = 0; k < n; k++) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function padTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128);
  x.strokeStyle = '#37f2d6'; x.lineWidth = 9; x.lineJoin = 'miter';
  for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(10, 50 + k * 64); x.lineTo(32, 20 + k * 64); x.lineTo(54, 50 + k * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function archMesh(tr, th) {
  const g = new THREE.Group(), post = new THREE.MeshLambertMaterial({ color: 0x2a2f3a, flatShading: true });
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(i * 16, j * 16, 16, 16); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const w = (WALL + 1.5) * 2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
  beam.position.set(0, 9.2, 0);
  g.add(beam);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9.5, 1.2), post); p.position.set(s * (WALL + 0.6), 4.7, 0); g.add(p); }
  const h = tr.Y[0], tx = tr.TX[0], tz = tr.TZ[0];
  g.position.set(tr.X[0], h, tr.Z[0]);
  g.rotation.y = Math.atan2(tx, tz);
  return g;
}

// Decoración: se coloca fuera de la carretera usando una malla espacial
function scenery(tr, th, scene, rng, q) {
  const cell = 40, grid = new Map(), key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < tr.N; i += 3) {
    const k = key(Math.floor(tr.X[i] / cell), Math.floor(tr.Z[i] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    minX = Math.min(minX, tr.X[i]); maxX = Math.max(maxX, tr.X[i]); minZ = Math.min(minZ, tr.Z[i]); maxZ = Math.max(maxZ, tr.Z[i]);
  }
  const clearance = (x, z, r) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell), rr = Math.ceil(r / cell);
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const l = grid.get(key(cx + a, cz + b));
      if (!l) continue;
      for (const i of l) if ((x - tr.X[i]) ** 2 + (z - tr.Z[i]) ** 2 < r * r) return false;
    }
    return true;
  };
  const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2, R = Math.hypot(maxX - minX, maxZ - minZ) / 2;
  const spots = [];
  const want = Math.round((th.deco === 'city' ? 260 : 520) * q.density);
  let guard = 0;
  while (spots.length < want && guard++ < want * 25) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1;
    const l = (WALL + 14 + tr.Y[i] * 1.2) + Math.pow(rng(), 1.6) * 140;
    const x = tr.X[i] + -tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
    if (clearance(x, z, WALL + 12 + 8 + tr.Y[i] * 1.2 + 4)) spots.push([x, z, 0.7 + rng() * 0.9, rng() * 6.28]);
  }
  const dummy = new THREE.Object3D();
  const inst = (geo, mat, list, f) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, k) => { f(dummy, s); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    m.frustumCulled = false; m.castShadow = !!q.shadows; scene.add(m); return m;
  };
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  if (th.deco === 'pine' || th.deco === 'snowpine') {
    const snow = th.deco === 'snowpine';
    inst(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6).translate(0, 1.1, 0), lam(0x6b4a2b), spots, (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.setScalar(s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.ConeGeometry(2.6, 5.2, 7).translate(0, 4.6, 0), lam(th.treeCol), spots, (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.setScalar(s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.ConeGeometry(2.0, 4.2, 7).translate(0, 7.4, 0), lam(snow ? 0xf2f8ff : th.treeCol), spots, (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.setScalar(s[2]); d.rotation.set(0, s[3], 0); });
  } else if (th.deco === 'cactus') {
    const half = spots.length >> 1;
    inst(new THREE.CylinderGeometry(0.45, 0.55, 4.2, 7).translate(0, 2.1, 0), lam(th.treeCol), spots.slice(0, half), (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.set(s[2], s[2] * 1.1, s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6).rotateZ(Math.PI / 2).translate(0.9, 2.6, 0), lam(th.treeCol), spots.slice(0, half), (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.DodecahedronGeometry(2.2, 0).translate(0, 1.0, 0), lam(0xa65f35), spots.slice(half), (d, s) => { d.position.set(s[0], 0, s[1]); d.scale.set(s[2] * 1.4, s[2] * 0.9, s[2] * 1.2); d.rotation.set(0, s[3], 0); });
  } else if (th.deco === 'toy') {
    const pal = [0xff3b3b, 0x3bb0ff, 0xffd23b, 0x4cd964, 0xb36bff, 0xff8a3b].map(col);
    const half = spots.length >> 1;
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), half);
    spots.slice(0, half).forEach((s, k) => { const w = 5 + s[2] * 7; dummy.position.set(s[0], 0, s[1]); dummy.scale.set(w, w * (0.7 + (k % 3) * 0.35), w); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); bm.setMatrixAt(k, dummy.matrix); bm.setColorAt(k, pal[k % 6]); });
    bm.frustumCulled = false; scene.add(bm);
    const rest = spots.slice(half);
    const cm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), rest.length);
    rest.forEach((s, k) => { const r = 2.5 + s[2] * 3; dummy.position.set(s[0], 0, s[1]); dummy.scale.set(r, r * (1.6 + (k % 3) * 0.5), r); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); cm.setMatrixAt(k, dummy.matrix); cm.setColorAt(k, pal[(k + 2) % 6]); });
    cm.frustumCulled = false; scene.add(cm);
  } else if (th.deco === 'city') {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.length);
    spots.forEach((s, k) => {
      const h = 14 + s[2] * 70, w = 10 + s[2] * 12;
      dummy.position.set(s[0], 0, s[1]); dummy.scale.set(w, h, w); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
      m.setColorAt(k, col([0x1c1a4a, 0x2a1860, 0x14224f, 0x30164f][k % 4]));
    });
    m.frustumCulled = false; scene.add(m);
    // ventanas de neón: franjas emisivas
    const glow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
    spots.forEach((s, k) => {
      const h = 14 + s[2] * 70, w = 10 + s[2] * 12;
      dummy.position.set(s[0], h * (0.45 + 0.4 * ((k * 7) % 5) / 5), s[1]); dummy.scale.set(w * 1.02, 1.2, w * 1.02); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); glow.setMatrixAt(k, dummy.matrix);
      glow.setColorAt(k, col(k % 2 ? 0x19e3ff : 0xff2fb9));
    });
    glow.frustumCulled = false; scene.add(glow);
  }
  // postes de neón junto a la valla
  if (th.night) {
    const posts = [];
    for (let s = 0; s < tr.len; s += 28) {
      const i = Math.floor(s / tr.ds) % tr.N;
      for (const side of [-1, 1]) posts.push([tr.X[i] + -tr.TZ[i] * (WALL + 1.3) * side, tr.Y[i], tr.Z[i] + tr.TX[i] * (WALL + 1.3) * side, side, tr.TX[i], tr.TZ[i]]);
    }
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 5.5, 0.25).translate(0, 2.75, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), posts.length);
    posts.forEach((p, k) => { dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); m.setColorAt(k, col(p[3] > 0 ? 0xff2fb9 : 0x19e3ff)); });
    m.frustumCulled = false; scene.add(m);
  }
  // montañas lejanas
  const mts = [];
  const mcount = q.mountains;
  for (let k = 0; k < mcount; k++) {
    const a = (k / mcount) * Math.PI * 2 + rng() * 0.1, d = R + 650 + rng() * 420, h = 120 + rng() * 280;
    mts.push([cxm + Math.cos(a) * d, czm + Math.sin(a) * d, h, rng() * 6.28]);
  }
  const toy = th.deco === 'toy', tpal = [0xff6b6b, 0x6bc4ff, 0xffe06b, 0x7be08a, 0xc79bff, 0xffa66b].map(col);
  const mm = new THREE.InstancedMesh(toy ? new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) : new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: toy ? 0xffffff : th.mount, flatShading: true }), mts.length);
  mts.forEach((s, k) => { dummy.position.set(s[0], -4, s[1]); if (toy) dummy.scale.set(s[2] * 1.1, s[2] * 0.8, s[2] * 1.1); else dummy.scale.set(s[2] * 1.5, s[2], s[2] * 1.5); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); mm.setMatrixAt(k, dummy.matrix); if (toy) mm.setColorAt(k, tpal[k % 6]); });
  mm.frustumCulled = false; scene.add(mm);
  return { cx: cxm, cz: czm, R };
}

export function buildWorld(tr, th, opt = {}) {
  const q = opt.mobile ? { stride: 2, density: 0.5, mountains: 22, shadows: !!opt.shadows } : { stride: 1, density: 1, mountains: 46, shadows: !!opt.shadows };
  const scene = new THREE.Scene();
  const rng = rngFromSeed('scenery:' + tr.seed);
  scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  const sky = skyGroup(th, rngFromSeed('sky:' + tr.seed)); scene.add(sky);
  if (opt.renderer) { try { scene.environment = makeEnv(opt.renderer, th); } catch (e) { /* sin reflejos */ } }
  scene.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI));
  const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.position.set(...th.sunDir); scene.add(sun); scene.add(sun.target);
  sun.userData.dir = new THREE.Vector3(...th.sunDir).normalize();
  if (opt.shadows) {
    sun.castShadow = true;
    const ms = opt.mobile ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms);
    const c = sun.shadow.camera; c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 260;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2;
  }

  const road = roadMesh(tr, th, q.stride); scene.add(road);
  const walls = wallMesh(tr, th, q.stride); walls.receiveShadow = true; scene.add(walls);
  scene.add(archMesh(tr, th));
  { // línea de meta a cuadros
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * 16, j * 16, 16, 16); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = stripGeom(tr, 0, 1.0, -ROAD_HALF, ROAD_HALF, 0.05), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k));
    const fl = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); fl.receiveShadow = true; scene.add(fl);
  }
  scene.add(gantry(tr, tr.len / 3, 'S2', '#66e8ff')); scene.add(gantry(tr, (tr.len * 2) / 3, 'S3', '#66e8ff'));
  tyreStacks(tr, th, scene);

  const info = scenery(tr, th, scene, rng, q);
  // suelo
  const gs = 5200;
  const gg = new THREE.PlaneGeometry(gs, gs, 1, 1).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ color: th.ground }));
  ground.position.set(info.cx, 0, info.cz); ground.receiveShadow = true; scene.add(ground);

  // turbos
  const tex = padTexture();
  const padMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const p of tr.pads) {
    const m = new THREE.Mesh(stripGeom(tr, p.s, p.s + p.len, p.lat - p.w / 2, p.lat + p.w / 2, 0.06), padMat);
    m.frustumCulled = false; scene.add(m);
    const base = new THREE.Mesh(stripGeom(tr, p.s, p.s + p.len, p.lat - p.w / 2, p.lat + p.w / 2, 0.04), new THREE.MeshBasicMaterial({ color: 0x0b3a3a, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    scene.add(base);
  }
  // líneas de sector
  const lm = new THREE.MeshBasicMaterial({ color: 0x66e8ff, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  for (const f of [1 / 3, 2 / 3]) { const m = new THREE.Mesh(stripGeom(tr, tr.len * f, tr.len * f + 1.4, -ROAD_HALF, ROAD_HALF, 0.07), lm); m.frustumCulled = false; scene.add(m); }
  // luces de borde en pista nocturna
  if (th.night) {
    for (const [a, b, c] of [[-(ROAD_HALF - 0.35), -(ROAD_HALF - 0.05), 0x19e3ff], [ROAD_HALF - 0.05, ROAD_HALF - 0.35, 0xff2fb9]]) {
      const m = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, Math.min(a, b), Math.max(a, b), 0.05), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      scene.add(m);
    }
  }
  return { scene, sky, sun, padTex: tex };
}

export function disposeScene(scene) {
  if (scene.environment) scene.environment.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
  });
}
