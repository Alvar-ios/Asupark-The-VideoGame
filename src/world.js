// Construcción de la escena 3D de una pista (three.js)
import * as THREE from 'three';
import { ROAD_HALF, WALL, setRoad } from './track.js';
import { SURF, zoneAt, smoothstep, patchBoundary, puddleParams, mudParams } from './surface.js';
import { rngFromSeed } from './rng.js';

const col = (hex) => new THREE.Color(hex);

function skyMesh(th) {
  const storm = th.weather === 'rain';
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: col(th.skyTop).lerp(col(0x465361), storm ? 0.48 : 0) }, hor: { value: col(th.skyHor).lerp(col(0x8996a2), storm ? 0.5 : 0) }, sunC: { value: col(th.sun).lerp(col(0xa9b3bf), storm ? 0.65 : 0) }, sunD: { value: new THREE.Vector3(...th.sunDir).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunC; uniform vec3 sunD; varying vec3 vD; void main(){ float h = clamp(vD.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float haze = pow(1.0-abs(vD.y),3.0); c = mix(c,hor,haze*0.2); float s = max(dot(normalize(vD), sunD),0.0); c += sunC*(pow(s,600.0)*1.5 + pow(s,18.0)*0.28 + pow(s,5.0)*0.045); if(vD.y<0.0) c = hor; gl_FragColor = vec4(c,1.0); }',
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
function groundTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), im = x.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const n = 224 + (Math.random() - 0.5) * 42 - (Math.random() < 0.025 ? 28 : 0);
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = n; im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(42, 42); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
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
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: th.weather === 'rain' ? 0.76 : 0.54, fog: false, depthWrite: false });
    const cg = new THREE.IcosahedronGeometry(1, 1), clouds = new THREE.InstancedMesh(cg, cm, 72), d = new THREE.Object3D();
    const cloudCol = col(th.weather === 'rain' ? 0x505d6b : th.skyHor).lerp(col(th.weather === 'rain' ? 0x758392 : 0xffffff), th.weather === 'rain' ? 0.34 : 0.78);
    for (let i = 0; i < 18; i++) {
      const a = rng() * 6.283, r = 800 + rng() * 800, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = 220 + rng() * 250, width = 100 + rng() * 100, height = 18 + rng() * 18;
      for (let j = 0; j < 4; j++) {
        const q = i * 4 + j, u = (j - 1.5) / 2.3;
        d.position.set(x + Math.cos(a) * u * width, y + (j % 2) * height * 0.5, z + Math.sin(a) * u * width);
        d.scale.set(width * (0.48 + rng() * 0.17), height * (0.9 + rng() * 0.35), width * (0.38 + rng() * 0.18));
        d.rotation.set(0, a, 0); d.updateMatrix(); clouds.setMatrixAt(q, d.matrix);
        clouds.setColorAt(q, cloudCol.clone().lerp(col(0xffffff), rng() * 0.18));
      }
    }
    clouds.renderOrder = -9; clouds.frustumCulled = false; g.add(clouds);
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
const bankOff = (tr, i, l) => { const b = tr.bank ? tr.bank[i % tr.N] : 0; return b ? Math.tan(b) * Math.max(-WALL, Math.min(WALL, l)) : 0; }; // altura extra del peralte a distancia lateral l
function tyreStacks(tr, th, scene) {
  const spots = [];
  for (let i = 0; i < tr.N; i += 5) {
    const k = tr.kap[i];
    if (Math.abs(k) < 0.018) continue;
    const side = k > 0 ? 1 : -1, l = (WALL + 1.25) * side;
    spots.push([tr.X[i] + -tr.TZ[i] * l, tr.Y[i] + bankOff(tr, i, l), tr.Z[i] + tr.TX[i] * l, i]);
  }
  if (!spots.length) return;
  const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.length * 3);
  const d = new THREE.Object3D(), a = col(th.kerb1), b = col(th.kerb2), dk = col(0x15171c);
  spots.forEach((sp, k) => { for (let h = 0; h < 3; h++) { d.position.set(sp[0], sp[1] + 0.25 + h * 0.5, sp[2]); d.rotation.set(0, 0, 0); d.updateMatrix(); m.setMatrixAt(k * 3 + h, d.matrix); m.setColorAt(k * 3 + h, h === 1 ? (Math.floor(sp[3] / 5) % 2 ? a : b) : dk); } });
  m.frustumCulled = false; m.castShadow = false; scene.add(m);
}

// Malla estática de carretera + arcenes + terraplenes (colores por vértice)
// calles de ciudad: fachadas continuas pegadas a las vallas (sin hueco entre muro y edificio)
function urbanMesh(tr, th) {
  const pal = (th.palette || [0xf3e9d8, 0xe8c9a0, 0xd9a47a]).map(col), N = tr.N, items = [], step = 8;
  for (let s = 0; s < tr.len; s += step) {
    const i = Math.floor(s / tr.ds) % N;
    if ((tr.tunnels || []).some((t) => s > t.s0 - 4 && s < t.s1 + 4)) continue;
    for (const side of [-1, 1]) {
      const hsh = Math.abs(Math.sin(s * 12.9898 + side * 78.233) * 43758.5453) % 1, h2 = Math.abs(Math.sin(s * 4.1414 + side * 9.77) * 24634.6345) % 1;
      if (h2 < 0.36) continue; // huecos: plazas y calles laterales
      const d = 8 + hsh * 6, off = WALL + 0.4 + (h2 > 0.55 ? (h2 - 0.55) * 14 : 0) + d / 2;
      const x = tr.X[i] + -tr.TZ[i] * side * off, z = tr.Z[i] + tr.TX[i] * side * off;
      let clash = false;
      for (let j = 0; j < N; j += 3) { const gap = Math.min(Math.abs(j - i), N - Math.abs(j - i)); if (gap < 14) continue; if ((tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < (WALL + d * 0.75 + 3) ** 2) { clash = true; break; } }
      const kk = tr.kap[i] * side; if (kk < -0.0005 && 1 / -kk < off + d * 0.75 + 4) clash = true; // por la cara interior de una curva cerrada el edificio acabaría dentro de la pista
      if (clash) continue;
      items.push({ x, z, ry: Math.atan2(tr.TX[i], tr.TZ[i]), side, d, w: step + 0.6, h: tr.Y[i] + 6 + hsh * 9 + (Math.floor(s / step) % 3) * 2.5, c: pal[Math.floor(hsh * 997) % pal.length] });
    }
  }
  const group = new THREE.Group(), D = new THREE.Object3D(), frames = [], panes = [], balconies = [], rails = [], roofs = [];
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), items.length);
  items.forEach((b, k) => {
    D.position.set(b.x, -1, b.z); D.scale.set(b.d, b.h + 1, b.w); D.rotation.set(0, b.ry, 0); D.updateMatrix(); m.setMatrixAt(k, D.matrix); m.setColorAt(k, b.c);
    roofs.push({ x: b.x, y: b.h, z: b.z, d: b.d, w: b.w, ry: b.ry });
    const floors = Math.max(2, Math.floor((b.h + 1) / 3.8));
    for (const face of [-1, 1]) for (let floor = 1; floor < floors; floor++) for (let column = 0; column < 2; column++) {
      const localX = face * (b.d * 0.5 + 0.08), localZ = (column ? 1 : -1) * b.w * 0.2;
      const x = b.x + localX * Math.cos(b.ry) + localZ * Math.sin(b.ry), z = b.z - localX * Math.sin(b.ry) + localZ * Math.cos(b.ry);
      const y = -1 + (floor + 0.52) * (b.h + 1) / floors, width = b.w * 0.21, height = Math.min(1.7, (b.h + 1) / floors * 0.52);
      frames.push({ x, y, z, ry: b.ry + Math.PI / 2, width: width + 0.18, height: height + 0.2 });
      panes.push({ x, y, z, ry: b.ry + Math.PI / 2, width, height, shade: (k * 5 + floor * 3 + column) % 7 });
      if (face === -b.side && floor > 1 && column === 0) {
        const bx = b.x + (localX + face * 0.52) * Math.cos(b.ry) + localZ * Math.sin(b.ry);
        const bz = b.z - (localX + face * 0.52) * Math.sin(b.ry) + localZ * Math.cos(b.ry);
        balconies.push({ x: bx, y: y - height * 0.56, z: bz, ry: b.ry });
        rails.push({ x: bx + face * Math.cos(b.ry) * 0.48, y: y - height * 0.1, z: bz - face * Math.sin(b.ry) * 0.48, ry: b.ry });
      }
    }
  });
  m.frustumCulled = false; group.add(m);
  const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb9ac98, roughness: 0.96 }), roofs.length);
  roofs.forEach((b, k) => { D.position.set(b.x, b.y - 0.1, b.z); D.scale.set(b.d + 0.5, 0.3, b.w + 0.5); D.rotation.set(0, b.ry, 0); D.updateMatrix(); roof.setMatrixAt(k, D.matrix); });
  roof.frustumCulled = false; group.add(roof);
  const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf0e4d0, roughness: 0.84 }), frames.length);
  frames.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.12, b.height, b.width); D.rotation.set(0, b.ry, 0); D.updateMatrix(); frame.setMatrixAt(k, D.matrix); });
  frame.frustumCulled = false; group.add(frame);
  const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.2, emissive: 0x121c25, emissiveIntensity: 0.25 }), panes.length);
  const glassPalette = [0x344c5c, 0x3c5965, 0x526a72, 0x65777b, 0x314251, 0x9a8b71, 0x5b6d77].map(col);
  panes.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.15, b.height, b.width); D.rotation.set(0, b.ry, 0); D.updateMatrix(); glass.setMatrixAt(k, D.matrix); glass.setColorAt(k, glassPalette[b.shade]); });
  glass.frustumCulled = false; group.add(glass);
  const balcony = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb5b0a7, roughness: 0.78 }), balconies.length);
  balconies.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.9, 0.12, 1.8); D.rotation.set(0, b.ry, 0); D.updateMatrix(); balcony.setMatrixAt(k, D.matrix); });
  balcony.frustumCulled = false; group.add(balcony);
  const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x565b5e, metalness: 0.55, roughness: 0.42 }), rails.length);
  rails.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.08, 0.62, 1.8); D.rotation.set(0, b.ry, 0); D.updateMatrix(); rail.setMatrixAt(k, D.matrix); });
  rail.frustumCulled = false; group.add(rail);
  return group;
}
// túnel: carcasa elíptica oscura sobre la pista, con aros de luz en el techo y bocas más claras
function tunnelMesh(tr, t, th) {
  // carcasa cerrada: paredes verticales desde el suelo + bóveda elíptica (cima a ~9 m), bocas con marco y luces a ambos lados y en el techo
  const g = new THREE.Group(), N = tr.N, Lh = WALL + 0.6, steps = Math.max(2, Math.round((t.s1 - t.s0) / 2)), ring = 16, wallH = 3.6, rv = 5.4;
  const pos = [], idx = [], lights = [];
  const ringPts = (h) => { const pts = [[-Lh, h - 1.2], [-Lh, h + wallH]]; for (let r = 1; r < ring; r++) { const a = Math.PI * (1 - r / ring); pts.push([Lh * Math.cos(a), h + wallH + rv * Math.sin(a)]); } pts.push([Lh, h + wallH], [Lh, h - 1.2]); return pts; };
  const rn = ringPts(0).length;
  for (let k = 0; k <= steps; k++) {
    const i = Math.floor((t.s0 + (t.s1 - t.s0) * k / steps) / tr.ds) % N, h = tr.Y[i];
    for (const [l, y] of ringPts(h)) pos.push(tr.X[i] + -tr.TZ[i] * l, y, tr.Z[i] + tr.TX[i] * l);
    if (k % 3 === 0) { const ry = Math.atan2(tr.TX[i], tr.TZ[i]); for (const [l, y, w] of [[0, h + wallH + rv - 0.25, 3.2], [-Lh + 1.4, h + wallH + 1.2, 0.5], [Lh - 1.4, h + wallH + 1.2, 0.5]]) lights.push([tr.X[i] + -tr.TZ[i] * l, y, tr.Z[i] + tr.TX[i] * l, ry, w]); }
  }
  for (let k = 0; k < steps; k++) for (let r = 0; r < rn - 1; r++) { const a = k * rn + r, b = a + 1, c = a + rn, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x6b7078, emissive: 0x1d2026, side: THREE.DoubleSide })));
  const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 1.3), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), lights.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  lights.forEach((L, n) => { e.set(0, L[3], 0); q.setFromEuler(e); m.compose(new THREE.Vector3(L[0], L[1], L[2]), q, new THREE.Vector3(L[4], 1, 1)); lm.setMatrixAt(n, m); });
  g.add(lm);
  for (const sEnd of [t.s0, t.s1]) { const i = Math.floor(sEnd / tr.ds) % N, h = tr.Y[i], fr = new THREE.Mesh(new THREE.TorusGeometry(Lh, 0.55, 6, 24, Math.PI), new THREE.MeshLambertMaterial({ color: 0xcfd3d8 })); fr.position.set(tr.X[i], h + wallH, tr.Z[i]); fr.rotation.y = Math.atan2(tr.TX[i], tr.TZ[i]); fr.scale.y = rv / Lh; g.add(fr); }
  return g;
}
function roadMesh(tr, th, stride = 1) {
  const N = tr.N, hw = ROAD_HALF, L = WALL;
  const roadData = { pos: [], colors: [], uvs: [] }, edgeData = { pos: [], colors: [], uvs: [] };
  const cRoad = col(th.road), cRoad2 = col(th.road).multiplyScalar(0.93), cGrass = col(th.grass), cDirt = col(th.dirt);
  const k1 = col(th.kerb1).multiplyScalar(0.86), k2 = col(th.kerb2).multiplyScalar(0.88), yel = col(0xffc400), blk = col(0x222222);
  const kset = th.kerbs3 ? th.kerbs3.map((c) => col(c).multiplyScalar(0.92)) : null, cGravel = col(0xe2cf9c);
  // los pianos nacen y mueren poco a poco (altura y color se funden con el asfalto) y cada franja tiene un desgaste distinto
  const kEnv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = th.noKerbs ? 0 : tr.kerb[i]; if (!v) continue;
    let d = 14; for (let k = 1; k < 14; k++) if (tr.kerb[(i + k) % N] !== v || tr.kerb[(i - k + N) % N] !== v) { d = k; break; }
    kEnv[i] = Math.min(1, d / 9);
  }
  const wornC = (c, n) => { const f = 0.9 + 0.1 * (((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1); return c.clone().multiplyScalar(f); };
  const pushQuad = (target, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c, uv, outerColor = c) => {
    // a,b = borde i (izq, der); c,d = borde i+1 (izq, der)
    target.pos.push(ax, ay, az, cx, cy, cz, bx, by, bz, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (const shade of [outerColor, outerColor, c, c, outerColor, c]) target.colors.push(shade.r, shade.g, shade.b);
    const [ua, va, ub, vb, uc, vc, ud, vd] = uv;
    target.uvs.push(ua, va, uc, vc, ub, vb, ub, vb, uc, vc, ud, vd);
  };
  for (let i = 0; i < N; i += stride) {
    const j = (i + stride) % N, s = i * tr.ds;
    const hi = tr.Y[i], hj = tr.Y[j];
    const eoI = L + 2.5 + hi * 1.1, eoJ = L + 2.5 + hj * 1.1;
    // perfil lateral: hierba | pianos en relieve (rampa, cresta, escalón) | asfalto | escalón, cresta, rampa | hierba
    const KW = Math.min(1.9, L - hw - 0.2); // pianos más anchos
    const GW = tr.rg ? hw + tr.rg[i] : hw + KW + 0.02, GWj = tr.rg ? hw + tr.rg[j] : hw + KW + 0.02;
    // piano: a ras del asfalto en el borde de la pista y cada vez más alto hacia fuera; escalón en el lado exterior
    const lat = (k, h, eo, krL, krR, gw) => [[-eo, 0], [-L, h - 0.05], [-gw, h - 0.02], [-(hw + KW), h - 0.02], [-(hw + KW), h + krL], [-(hw + KW * 0.45), h + krL * 0.75], [-hw, h + 0.004], [-0.22, h], [0.22, h], [hw, h + 0.004], [hw + KW * 0.45, h + krR * 0.75], [hw + KW, h + krR], [hw + KW, h - 0.02], [gw, h - 0.02], [L, h - 0.05], [eo, 0]][k];
    const sLen = 3, s2k = (i + stride) * tr.ds;
    const kv = (th.noKerbs ? 0 : tr.kerb[i]), kvj = (th.noKerbs ? 0 : tr.kerb[j]), wave = (x, e) => (th.kerbRough ? 0.13 + 0.04 * Math.sin(Math.PI * (((x % sLen) + sLen) % sLen) / sLen) + ((Math.floor(x * 1.7) & 1) ? 0.05 : 0) : 0.03 + 0.018 * Math.sin(Math.PI * (((x % sLen) + sLen) % sLen) / sLen)) * e;
    const krLi = kv === -1 ? wave(s, kEnv[i]) : 0, krRi = kv === 1 ? wave(s, kEnv[i]) : 0, krLj = kvj === -1 ? wave(s2k, kEnv[j]) : 0, krRj = kvj === 1 ? wave(s2k, kEnv[j]) : 0;
    const inRamp = tr.ramps.some((r) => s >= r.s0 && s < r.s0 + r.len);
    const stripeN = Math.floor(s / sLen), stripe = stripeN % 2 === 0;
    for (let b = 0; b < 15; b++) {
      const [l0, y0i] = lat(b, hi, eoI, krLi, krRi, GW), [l1, y1i] = lat(b + 1, hi, eoI, krLi, krRi, GW);
      const [l0j, y0j] = lat(b, hj, eoJ, krLj, krRj, GWj), [l1j, y1j] = lat(b + 1, hj, eoJ, krLj, krRj, GWj);
      const P = (idx, l, y) => [tr.X[idx] + -tr.TZ[idx] * l, y + (Math.abs(l) <= L ? l * Math.tan(tr.bank[idx]) : (l > 0 ? 1 : -1) * L * Math.tan(tr.bank[idx])), tr.Z[idx] + tr.TX[idx] * l];
      const a = P(i, l0, y0i), bb = P(i, l1, y1i), c = P(j, l0j, y0j), d = P(j, l1j, y1j);
      let color;
      let outerColor = null;
      if (b === 0 || b === 14) { color = cGrass; outerColor = cDirt; }
      else if (b === 1 || b === 13) color = tr.rg ? cGrass.clone().multiplyScalar(Math.floor(s / 14) % 2 ? 1 : 0.93) : cGrass; // hierba segada a franjas
      else if (b === 2 || b === 12) color = tr.rg ? cGravel.clone().multiplyScalar(0.92 + 0.08 * (((Math.sin(Math.floor(s / 3) * 5.31 + b) * 4375.5) % 1 + 1) % 1)) : cGrass; // grava
      else if (b === 3 || b === 4 || b === 5 || b === 9 || b === 10 || b === 11) {
        const hasKerb = b < 6 ? kv === -1 : kv === 1;
        color = th.noKerbs ? cGrass : hasKerb
          ? wornC(kset ? kset[stripeN % 3] : (stripe ? k1 : k2), stripeN).lerp(cRoad2, 1 - kEnv[i])
          : tr.rg ? cGravel : cRoad2;
      }
      else {
        color = Math.floor(s / 24) % 2 ? cRoad : cRoad2;
        const zn = zoneAt(tr, s); if (zn && zn.w > 0.5 && zn.key !== 'asphalt') { const zc = SURF[zn.key].col; if (zc != null) color = col(zc).multiplyScalar(Math.floor(s / 6) % 2 ? 1 : 0.93); }
        if (inRamp) color = Math.floor(s / 1.5) % 2 ? yel : blk;
      }
      const s2 = (i + stride) * tr.ds, K = 1 / 5;
      pushQuad(b >= 6 && b <= 8 ? roadData : edgeData, a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], d[0], d[1], d[2], color, [l0 * K, s * K, l1 * K, s * K, l0j * K, s2 * K, l1j * K, s2 * K], outerColor || color);
    }
  }
  const geometry = (data) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    let up = 0; for (let k = 0; k < Math.min(nrm.count, 3000); k++) up += nrm.getY(k);
    if (up < 0) { for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, -nrm.getX(k), -nrm.getY(k), -nrm.getZ(k)); }
    return g;
  };
  const wet = th.weather === 'rain', snow = th.surface === 'snow', dirt = th.surface === 'dirt';
  const roadMaterial = wet
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, map: th.toy ? null : asphaltTex(), roughnessMap: wetRoughnessTexture(), color: 0xffffff, roughness: 0.82, metalness: 0.025, clearcoat: 0.68, clearcoatRoughness: 0.16, envMapIntensity: 0.8 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, map: th.toy ? null : asphaltTex(), roughness: snow ? 0.74 : dirt ? 0.78 : 0.86, metalness: 0.02 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, metalness: 0.01 });
  const group = new THREE.Group();
  for (const [data, material] of [[roadData, roadMaterial], [edgeData, edgeMaterial]]) {
    const mesh = new THREE.Mesh(geometry(data), material);
    mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

function wallMesh(tr, th, stride = 1) {
  const N = tr.N, L = WALL, pos = [], colors = [];
  const c1 = col(th.wall1), c2 = col(th.wall2);
  const H = 0.55, T = 0.5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, s = i * tr.ds, c = Math.floor(s / 6) % 2 ? c1 : c2;
      const P = (idx, l, y) => [tr.X[idx] + -tr.TZ[idx] * l * side, y + bankOff(tr, idx, l * side), tr.Z[idx] + tr.TX[idx] * l * side];
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
    pos.push(x + nx * l0, y + bankOff(tr, i, l0), z + nz * l0, x + nx * l1, y + bankOff(tr, i, l1), z + nz * l1);
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

function surfacePatchGeom(tr, s0, length, lane, halfWidth, seed, lift) {
  const pos = [], colors = [], uvs = [], indices = [], segments = 48;
  const rings = [0, 0.28, 0.52, 0.72, 0.82, 0.92, 1, 1.08];
  const center = s0 + length * 0.5;
  for (const radius of rings) {
    for (let k = 0; k < segments; k++) {
      const angle = (k / segments) * Math.PI * 2, edge = patchBoundary(angle, seed);
      const dx = Math.cos(angle) * radius * edge, dl = Math.sin(angle) * radius * edge;
      const s = center + dx * length * 0.5, lat = lane + dl * halfWidth;
      const f = (((s / tr.ds) % tr.N) + tr.N) % tr.N, i = Math.floor(f), j = (i + 1) % tr.N, t = f - i;
      const tx = tr.TX[i] + (tr.TX[j] - tr.TX[i]) * t, tz = tr.TZ[i] + (tr.TZ[j] - tr.TZ[i]) * t, tl = Math.hypot(tx, tz);
      const nx = -tz / tl, nz = tx / tl, x = tr.X[i] + (tr.X[j] - tr.X[i]) * t, z = tr.Z[i] + (tr.Z[j] - tr.Z[i]) * t;
      pos.push(x + nx * lat, tr.Y[i] + lift + bankOff(tr, i, lat), z + nz * lat);
      colors.push(1, 1, 1, 1 - smoothstep(0.72, 1.08, radius));
      uvs.push(dx * 0.5 + 0.5 + seed * 0.173, dl * 0.5 + 0.5 + seed * 0.317);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const a = r * segments + k, b = r * segments + (k + 1) % segments;
      const c = (r + 1) * segments + k, d = (r + 1) * segments + (k + 1) % segments;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

let mudTextureCache = null;
let waterTextureCache = null;
let wetRoughnessCache = null;
function wetRoughnessTexture() {
  if (wetRoughnessCache) return wetRoughnessCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = Math.sin(x * 0.17 + Math.sin(y * 0.13) * 2.4) * 10 + Math.sin(y * 0.31 + x * 0.07) * 7 + Math.random() * 18 - 9;
    const value = Math.max(0, Math.min(255, 166 + n)), i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  wetRoughnessCache = new THREE.CanvasTexture(canvas);
  wetRoughnessCache.wrapS = wetRoughnessCache.wrapT = THREE.RepeatWrapping;
  wetRoughnessCache.colorSpace = THREE.NoColorSpace;
  return wetRoughnessCache;
}

function waterTexture() {
  if (waterTextureCache) return waterTextureCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#87969a'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size, y = Math.random() * size, length = 2 + Math.random() * 18;
    ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(230,242,246,.1)' : 'rgba(43,65,74,.08)';
    ctx.lineWidth = 0.25 + Math.random() * 0.45;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + length * 0.5, y + Math.random() * 2 - 1, x + length, y); ctx.stroke();
  }
  waterTextureCache = new THREE.CanvasTexture(canvas);
  waterTextureCache.wrapS = waterTextureCache.wrapT = THREE.RepeatWrapping;
  waterTextureCache.colorSpace = THREE.SRGBColorSpace;
  return waterTextureCache;
}

function mudTexture() {
  if (mudTextureCache) return mudTextureCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = Math.random() * 36;
    image.data[i * 4] = 62 + n;
    image.data[i * 4 + 1] = 43 + n * 0.72;
    image.data[i * 4 + 2] = 27 + n * 0.48;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 1 + Math.random() * 7;
    ctx.fillStyle = `rgba(${35 + Math.random() * 35},${25 + Math.random() * 23},${16 + Math.random() * 17},${0.12 + Math.random() * 0.28})`;
    ctx.beginPath(); ctx.ellipse(x, y, r * (1.2 + Math.random()), r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  mudTextureCache = new THREE.CanvasTexture(canvas);
  mudTextureCache.wrapS = mudTextureCache.wrapT = THREE.RepeatWrapping;
  mudTextureCache.colorSpace = THREE.SRGBColorSpace;
  return mudTextureCache;
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

// Señales de curva de lectura rápida, colocadas fuera de la valla en los vértices del trazado.
function turnSigns(tr, th, scene, mobile) {
  const picks = [], gap = mobile ? 145 : 112;
  let lastS = -gap;
  for (let i = 24; i < tr.N - 24; i += 8) {
    const k = tr.kap[i], ak = Math.abs(k), s = i * tr.ds;
    if (ak < 0.009 || s - lastS < gap) continue;
    let peak = true;
    for (let d = -16; d <= 16; d += 8) if (Math.abs(tr.kap[(i + d + tr.N) % tr.N]) > ak) { peak = false; break; }
    if (!peak) continue;
    picks.push({ i, dir: Math.sign(k) }); lastS = s;
  }
  if (!picks.length) return;
  const texFor = (dir) => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 192;
    const x = c.getContext('2d');
    x.fillStyle = '#101725'; x.fillRect(0, 0, 384, 192);
    x.strokeStyle = '#' + new THREE.Color(th.kerb1).getHexString(); x.lineWidth = 14; x.strokeRect(8, 8, 368, 176);
    x.fillStyle = '#f4f7ff'; x.font = '900 94px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(dir > 0 ? '›  ›  ›' : '‹  ‹  ‹', 192, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const backGeo = new THREE.BoxGeometry(4.8, 2.35, 0.28), postGeo = new THREE.BoxGeometry(0.2, 3.2, 0.2), faceGeo = new THREE.PlaneGeometry(4.55, 2.08);
  const back = new THREE.InstancedMesh(backGeo, new THREE.MeshLambertMaterial({ color: 0x171b25, flatShading: true }), picks.length);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0xd7ddea, flatShading: true }), picks.length * 2);
  const faces = [1, -1].map((dir) => new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ map: texFor(dir), side: THREE.DoubleSide }), picks.filter((p) => p.dir === dir).length));
  const d = new THREE.Object3D(), counts = { 1: 0, '-1': 0 };
  picks.forEach(({ i, dir }, n) => {
    const tx = tr.TX[i], tz = tr.TZ[i], side = dir;
    const nx = -tz * side, nz = tx * side;
    const x = tr.X[i] + nx * (WALL + 2.1), z = tr.Z[i] + nz * (WALL + 2.1), y = tr.Y[i] + bankOff(tr, i, side * (WALL + 2.1));
    const heading = Math.atan2(tx, tz);
    d.position.set(x, y + 3.15, z); d.rotation.set(0, heading, 0); d.scale.set(1, 1, 1); d.updateMatrix(); back.setMatrixAt(n, d.matrix);
    d.position.set(x + tx * 2.1, y + 1.55, z + tz * 2.1); d.scale.set(1, 1, 1); d.updateMatrix(); posts.setMatrixAt(n * 2, d.matrix);
    d.position.set(x - tx * 2.1, y + 1.55, z - tz * 2.1); d.updateMatrix(); posts.setMatrixAt(n * 2 + 1, d.matrix);
    const face = faces[dir > 0 ? 0 : 1], q = counts[dir];
    d.position.set(x + tx * 0.17, y + 3.15, z + tz * 0.17); d.updateMatrix(); face.setMatrixAt(q, d.matrix); counts[dir]++;
  });
  back.castShadow = posts.castShadow = true;
  scene.add(back, posts, ...faces.filter((f) => f.count));
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
  const want = Math.round((th.deco === 'city' ? 260 : th.treeCount || 520) * q.density);
  let guard = 0;
  while (spots.length < want && guard++ < want * 25) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1;
    const near = th.treeNear != null, base = near ? WALL + th.treeNear * 0.5 : WALL + 14 + tr.Y[i] * 1.2;
    const l = base + Math.pow(rng(), near ? 1.9 : 1.6) * (near ? 95 : 140);
    if (near && tr.open && tr.open[i] && l - base < 55) continue; // zonas abiertas: sin árboles junto a la pista
    const x = tr.X[i] + -tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
    // junto a las vallas los árboles se asientan sobre el talud de la pista elevada
    const hw0 = tr.Y[i] + (near ? bankOff(tr, i, side * WALL) : 0), yy = near ? Math.max(0, hw0 * (1 - (l - WALL) / (2.5 + 1.1 * tr.Y[i]))) : 0;
    if (clearance(x, z, near ? WALL + 0.9 : WALL + 12 + 8 + tr.Y[i] * 1.2 + 4)) spots.push([x, z, near ? 0.85 + rng() * 1.0 : 0.7 + rng() * 0.9, rng() * 6.28, yy, 0.78 + rng() * 0.44, 0.82 + rng() * 0.38, rng()]);
  }
  const dummy = new THREE.Object3D();
  const windMeshes = [];
  const inst = (geo, mat, list, f) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, k) => { f(dummy, s); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    m.frustumCulled = false; m.castShadow = !!q.shadows; scene.add(m); return m;
  };
  const lam = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  if (th.deco === 'pine' || th.deco === 'snowpine') {
    const snow = th.deco === 'snowpine';
    const treeTransform = (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2] * s[5], s[2] * s[6], s[2] * s[5]); d.rotation.set(0, s[3], 0); };
    const trunk = inst(new THREE.CylinderGeometry(0.22, 0.38, 5.2, 9, 2).translate(0, 2.6, 0), lam(0x594331), spots, treeTransform);
    spots.forEach((_, k) => trunk.setColorAt(k, col(0x594331).multiplyScalar(0.78 + ((k * 19) % 8) * 0.055)));
    if (snow) {
      for (const [geo, mat] of [[new THREE.ConeGeometry(2.6, 5.2, 12).translate(0, 4.6, 0), lam(th.treeCol)], [new THREE.ConeGeometry(2.0, 4.2, 12).translate(0, 7.4, 0), lam(0xf2f8ff)]]) {
        const mesh = inst(geo, mat, spots, treeTransform);
        windMeshes.push({ mesh, spots, kind: 'tree' });
      }
    } else {
      const conifers = spots.filter((s) => s[7] >= 0.48), deciduous = spots.filter((s) => s[7] < 0.48);
      const crownSets = [
        { geo: new THREE.ConeGeometry(2.65, 5.6, 16, 2).translate(0, 3.45, 0), shade: 0.72 },
        { geo: new THREE.ConeGeometry(2.02, 4.8, 16, 2).translate(0, 5.45, 0), shade: 0.92 },
        { geo: new THREE.ConeGeometry(1.42, 4.0, 16, 2).translate(0, 7.35, 0), shade: 1.14 },
      ];
      for (const { geo, shade } of crownSets) {
        const mesh = inst(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, flatShading: true }), conifers, treeTransform);
        conifers.forEach((_, k) => { mesh.setColorAt(k, col(th.treeCol).multiplyScalar(shade * (0.9 + ((k * 17) % 9) * 0.018))); });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        windMeshes.push({ mesh, spots: conifers, kind: 'tree' });
      }
      const leafSets = [
        { geo: new THREE.SphereGeometry(1, 10, 7).scale(2.25, 1.9, 2.15).translate(0, 5.1, 0), shade: 1 },
        { geo: new THREE.SphereGeometry(1, 9, 6).scale(1.55, 1.45, 1.55).translate(-1.15, 4.55, 0.3), shade: 0.88 },
        { geo: new THREE.SphereGeometry(1, 9, 6).scale(1.55, 1.45, 1.55).translate(1.1, 4.6, -0.25), shade: 1.08 },
      ];
      for (const { geo, shade } of leafSets) {
        const mesh = inst(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true }), deciduous, treeTransform);
        deciduous.forEach((_, k) => {
          const autumnTint = (k * 11) % 7 === 0 ? 0.22 : 0;
          mesh.setColorAt(k, col(th.treeCol).lerp(col(0x777849), autumnTint).multiplyScalar(shade * (0.9 + ((k * 13) % 9) * 0.018)));
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        windMeshes.push({ mesh, spots: deciduous, kind: 'tree' });
      }
    }
  } else if (th.deco === 'cactus') {
    const half = spots.length >> 1;
    inst(new THREE.CylinderGeometry(0.45, 0.55, 4.2, 7).translate(0, 2.1, 0), lam(th.treeCol), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2] * 1.1, s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6).rotateZ(Math.PI / 2).translate(0.9, 2.6, 0), lam(th.treeCol), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.DodecahedronGeometry(2.2, 0).translate(0, 1.0, 0), lam(0xa65f35), spots.slice(half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2] * 1.4, s[2] * 0.9, s[2] * 1.2); d.rotation.set(0, s[3], 0); });
  } else if (th.deco === 'toy') {
    const pal = (th.palette || [0xff3b3b, 0x3bb0ff, 0xffd23b, 0x4cd964, 0xb36bff, 0xff8a3b]).map(col);
    const half = th.urban ? 0 : th.harbor ? spots.length : spots.length >> 1;
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), half);
    spots.slice(0, half).forEach((s, k) => { const w = th.harbor ? 7 + s[2] * 9 : 5 + s[2] * 7; dummy.position.set(s[0], s[4] || 0, s[1]); dummy.scale.set(w, th.harbor ? 10 + (k % 5) * 9 + s[2] * 8 : w * (0.7 + (k % 3) * 0.35), w); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); bm.setMatrixAt(k, dummy.matrix); bm.setColorAt(k, pal[k % 6]); });
    bm.frustumCulled = false; scene.add(bm);
    const rest = th.urban ? [] : spots.slice(half);
    const cm = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), rest.length);
    rest.forEach((s, k) => { const r = 2.5 + s[2] * 3; dummy.position.set(s[0], s[4] || 0, s[1]); dummy.scale.set(r, r * (1.6 + (k % 3) * 0.5), r); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); cm.setMatrixAt(k, dummy.matrix); cm.setColorAt(k, pal[(k + 2) % 6]); });
    cm.frustumCulled = false; scene.add(cm);
  } else if (th.deco === 'city') {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true }), spots.length);
    const roofData = [], frames = [], panes = [];
    const buildingPalette = [0xd8c6a9, 0xc8b194, 0xe0d5c4, 0xb98d72, 0xb9b5a9, 0xd1bb9d].map(col);
    spots.forEach((s, k) => {
      const h = 18 + s[2] * 22, w = 9 + s[2] * 6, yaw = s[3], floors = Math.max(3, Math.floor(h / 4.1)), columns = Math.max(2, Math.min(3, Math.floor(w / 6)));
      dummy.position.set(s[0], s[4] || 0, s[1]); dummy.scale.set(w, h, w); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
      m.setColorAt(k, buildingPalette[k % buildingPalette.length]);
      roofData.push({ x: s[0], y: (s[4] || 0) + h, z: s[1], w, yaw });
      for (let floor = 1; floor < floors; floor++) for (let face = 0; face < 4; face++) {
        const faceWidth = w * 0.72, winW = Math.min(2.15, faceWidth / (columns * 1.65)), winH = Math.min(2.25, (h / floors) * 0.5);
        for (let column = 0; column < columns; column++) {
          const offset = (column - (columns - 1) / 2) * (faceWidth / columns);
          const along = face < 2 ? offset : 0, across = face < 2 ? (face === 0 ? 1 : -1) * (w * 0.5 + 0.08) : offset;
          const localX = face < 2 ? along : (face === 2 ? 1 : -1) * (w * 0.5 + 0.08), localZ = face < 2 ? across : along;
          const x = s[0] + localX * Math.cos(yaw) + localZ * Math.sin(yaw);
          const z = s[1] - localX * Math.sin(yaw) + localZ * Math.cos(yaw);
          const y = (s[4] || 0) + (floor + 0.52) * (h / floors), rotation = yaw + (face < 2 ? 0 : Math.PI / 2);
          frames.push({ x, y, z, rotation, width: winW + 0.22, height: winH + 0.24 });
          panes.push({ x, y, z, rotation, width: winW, height: winH, shade: (k * 7 + floor * 3 + column) % 8 });
        }
      }
    });
    m.frustumCulled = false; scene.add(m);
    const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb7aa96, roughness: 0.96 }), roofData.length);
    roofData.forEach((s, k) => {
      dummy.position.set(s.x, s.y, s.z); dummy.scale.set(s.w * 1.08, 0.45, s.w * 1.08); dummy.rotation.set(0, s.yaw, 0); dummy.updateMatrix(); roof.setMatrixAt(k, dummy.matrix);
    });
    roof.frustumCulled = false; scene.add(roof);
    const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe5d9c4, roughness: 0.84 }), frames.length);
    frames.forEach((s, k) => {
      dummy.position.set(s.x, s.y, s.z); dummy.scale.set(s.width, s.height, 0.12); dummy.rotation.set(0, s.rotation, 0); dummy.updateMatrix(); frame.setMatrixAt(k, dummy.matrix);
    });
    frame.frustumCulled = false; scene.add(frame);
    const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.22, emissive: 0x111a22, emissiveIntensity: 0.3 }), panes.length);
    const glassPalette = [0x344c5c, 0x3c5965, 0x526a72, 0x65777b, 0x314251, 0x9a8b71, 0x5b6d77, 0x3b4e56].map(col);
    panes.forEach((s, k) => {
      dummy.position.set(s.x, s.y, s.z); dummy.scale.set(s.width, s.height, 0.14); dummy.rotation.set(0, s.rotation, 0); dummy.updateMatrix(); glass.setMatrixAt(k, dummy.matrix); glass.setColorAt(k, glassPalette[s.shade]);
    });
    glass.frustumCulled = false; scene.add(glass);
  }
  // Hierba baja junto al exterior: geometría sencilla, movimiento suave y coste contenido.
  if (th.deco === 'pine' || th.deco === 'toy' || th.deco === 'snowpine') {
    const grassSpots = [], count = Math.round((q.mobile ? 180 : 360) * q.density);
    for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
      const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, dist = WALL + 2 + rng() * 13;
      const x = tr.X[i] - tr.TZ[i] * dist * side, z = tr.Z[i] + tr.TX[i] * dist * side;
      if (clearance(x, z, WALL + 1.6)) grassSpots.push([x, z, 0.45 + rng() * 0.75, rng() * Math.PI * 2]), n++;
    }
    const color = th.deco === 'snowpine' ? 0xcde0d5 : th.grass;
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, -0.045, 0.3, 0.025, 0.045, 0.3, 0.025, 0.14, 0.72, 0.07], 3));
    blade.setIndex([0, 2, 1, 2, 3, 1, 2, 4, 3]); blade.computeVertexNormals();
    const bladeSpots = [];
    for (const s of grassSpots) for (let j = 0; j < 3; j++) bladeSpots.push([s[0], s[1], s[2] * (0.78 + j * 0.12), s[3] + j * Math.PI / 3]);
    const gm = inst(blade, new THREE.MeshStandardMaterial({ color, roughness: 0.96, side: THREE.DoubleSide }), bladeSpots, (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    windMeshes.push({ mesh: gm, spots: bladeSpots, kind: 'grass' });
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
    const a = (k / mcount) * Math.PI * 2 + rng() * 0.1, d = R + 560 + rng() * 420, h = 60 + rng() * 105;
    mts.push([cxm + Math.cos(a) * d, czm + Math.sin(a) * d, h, rng() * 6.28]);
  }
  const toy = th.deco === 'toy', tpal = [0xff6b6b, 0x6bc4ff, 0xffe06b, 0x7be08a, 0xc79bff, 0xffa66b].map(col);
  if (toy) {
    const mm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), mts.length);
    mts.forEach((s, k) => { dummy.position.set(s[0], -4, s[1]); dummy.scale.set(s[2] * 1.1, s[2] * 0.8, s[2] * 1.1); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix(); mm.setMatrixAt(k, dummy.matrix); mm.setColorAt(k, tpal[k % 6]); });
    mm.frustumCulled = false; scene.add(mm);
  } else {
    const mountainGeometry = (seed) => {
      const segments = 24, rings = 6, positions = [], indices = [];
      for (let r = 0; r < rings; r++) {
        const radius = [1, 0.86, 0.69, 0.51, 0.32, 0.14][r];
        for (let k = 0; k < segments; k++) {
          const a = (k / segments) * Math.PI * 2;
          const jag = Math.sin(k * 17.13 + seed * 3.7) * 0.045 + Math.sin(k * 7.7 - seed) * 0.025;
          const ridge = Math.sin(k * 0.81 + seed) * 0.035 + Math.sin(k * 0.37 - seed * 1.7) * 0.045;
          const peaks = Math.pow(Math.max(0, Math.sin(k * 1.37 + seed)), 3) * [0, 0.01, 0.035, 0.07, 0.1, 0.12][r];
          positions.push(Math.cos(a) * radius * (1 + jag), [0.015, 0.07, 0.18, 0.34, 0.53, 0.72][r] + ridge * (1 - radius) + peaks, Math.sin(a) * radius * (1 + jag));
        }
      }
      for (let r = 0; r < rings - 1; r++) for (let k = 0; k < segments; k++) {
        const a = r * segments + k, b = r * segments + (k + 1) % segments, c = a + segments, d = b + segments;
        indices.push(a, c, b, b, c, d);
      }
      const top = positions.length / 3; positions.push(0, 0.82, 0);
      for (let k = 0; k < segments; k++) indices.push((rings - 1) * segments + k, top, (rings - 1) * segments + (k + 1) % segments);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      return geometry;
    };
    for (let variant = 0; variant < 2; variant++) {
      const selected = mts.filter((_, k) => k % 2 === variant), geometry = mountainGeometry(variant + 1);
      const mm = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color: 0xffffff }), selected.length);
      selected.forEach((s, k) => {
        dummy.position.set(s[0], -4, s[1]); dummy.scale.set(s[2] * (1.75 + (k % 3) * 0.2), s[2], s[2] * (1.65 + (k % 4) * 0.16)); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix();
        mm.setMatrixAt(k, dummy.matrix);
        mm.setColorAt(k, col(th.mount).lerp(col(th.fog), 0.7 + ((k * 13) % 7) * 0.025));
      });
      mm.frustumCulled = false; scene.add(mm);
    }
  }
  return { cx: cxm, cz: czm, R, windMeshes };
}

// con lluvia el día se queda cubierto: colores, niebla y luz más oscuros (se aplica a todos los circuitos con lluvia)
function rainTheme(th) {
  if (th.weather !== 'rain' || th._rain) return th;
  const k = th.night ? 0.2 : 0.55, dk = (c, to, a) => col(c).lerp(col(to), Math.min(1, a)).getHex();
  const palette = th.rainPalette || {};
  return {
    ...th, _rain: true,
    skyTop: palette.skyTop || dk(th.skyTop, 0x252b32, k + 0.15), skyHor: palette.skyHor || dk(th.skyHor, 0x4b545d, k + 0.12), fog: palette.fog || dk(th.fog, 0x39424b, k + 0.12),
    ground: palette.ground || dk(th.ground, 0x182018, k * 0.8), grass: palette.grass || dk(th.grass, 0x1f2e1d, k * 0.75), dirt: palette.dirt || dk(th.dirt, 0x2c261d, k * 0.7), road: dk(th.road, 0x15181c, k * 0.5),
    wall1: dk(th.wall1, 0x3a3f45, k * 0.6), wall2: dk(th.wall2, 0x4a2a28, k * 0.6), mount: palette.mount || dk(th.mount, 0x1f2a28, k * 0.7), treeCol: palette.treeCol || dk(th.treeCol, 0x10241a, k * 0.65),
    kerb1: dk(th.kerb1, 0x4a2622, k * 0.55), kerb2: dk(th.kerb2, 0x8a8e90, k * 0.6), kerbs3: palette.kerbs3 || (th.kerbs3 ? th.kerbs3.map((c) => dk(c, 0x30343a, k * 0.45)) : th.kerbs3),
    hemiSky: palette.hemiSky || dk(th.hemiSky, 0x4f5963, k), hemiGround: palette.hemiGround || dk(th.hemiGround, 0x1d231c, k * 0.7), hemiI: th.hemiI * (th.night ? 1 : 0.8), sunI: th.sunI * (th.night ? 0.8 : 0.28), sun: palette.sun || dk(th.sun, 0x7f8a95, 0.6),
    fogNear: th.fogNear * 0.8, fogFar: th.fogFar * 0.85,
  };
}
export function buildWorld(tr, th, opt = {}) {
  th = rainTheme(th);
  setRoad(tr);
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
  const ambientRain = th.weather === 'rain', ambientSnow = th.surface === 'snow';
  let weatherMesh = null, weatherDrops = [];
  if (ambientRain || ambientSnow) {
    const count = Math.round((opt.mobile ? 110 : 230) * (ambientSnow ? 0.82 : 1));
    const geo = ambientRain ? new THREE.CylinderGeometry(0.012, 0.012, 0.72, 4).rotateX(0.2) : new THREE.SphereGeometry(0.065, 5, 4);
    const mat = new THREE.MeshBasicMaterial({ color: ambientRain ? 0xb5d5eb : 0xf0f7ff, transparent: true, opacity: ambientRain ? 0.55 : 0.78, depthWrite: false });
    weatherMesh = new THREE.InstancedMesh(geo, mat, count); weatherMesh.frustumCulled = false;
    const weatherRng = rngFromSeed('preview-weather:' + tr.seed), weatherDummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const drop = { x: (weatherRng() - 0.5) * 34, y: weatherRng() * 22, z: (weatherRng() - 0.5) * 34, scale: 0.55 + weatherRng() * 1.1, phase: weatherRng() * Math.PI * 2 };
      weatherDrops.push(drop); weatherDummy.position.set(drop.x, drop.y, drop.z); weatherDummy.scale.setScalar(drop.scale); weatherDummy.updateMatrix(); weatherMesh.setMatrixAt(i, weatherDummy.matrix);
    }
    scene.add(weatherMesh);
  }
  const weatherDummy = new THREE.Object3D();
  const updateWeather = (dt, x = 0, y = 0, z = 0) => {
    if (!weatherMesh) return;
    const fall = ambientRain ? 24 : 2.1;
    for (let i = 0; i < weatherDrops.length; i++) {
      const p = weatherDrops[i]; p.y -= fall * Math.min(dt, 0.05);
      if (!ambientRain) { p.x += Math.sin(p.phase + p.y * 0.08) * dt * 0.8; p.z += Math.cos(p.phase + p.y * 0.06) * dt * 0.65; }
      if (p.y < -4) { p.y = ambientRain ? 19 + Math.random() * 9 : 18 + Math.random() * 7; p.x = (Math.random() - 0.5) * 34; p.z = (Math.random() - 0.5) * 34; }
      weatherDummy.position.set(x + p.x, y + p.y, z + p.z); weatherDummy.scale.setScalar(p.scale); weatherDummy.updateMatrix(); weatherMesh.setMatrixAt(i, weatherDummy.matrix);
    }
    weatherMesh.instanceMatrix.needsUpdate = true;
  };

  const road = roadMesh(tr, th, q.stride); scene.add(road);
  for (const t of tr.tunnels || []) scene.add(tunnelMesh(tr, t, th));
  if (th.urban) scene.add(urbanMesh(tr, th));
  // Marcas tenues de goma en la trazada: dos huellas de rueda, sin línea central de carretera.
  const rubber = new THREE.MeshStandardMaterial({ color: th.weather === 'rain' ? 0x35404a : 0x25292d, roughness: 0.94, metalness: 0.02, transparent: true, opacity: th.weather === 'rain' ? 0.36 : 0.24, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, side * 0.66 - 0.085, side * 0.66 + 0.085, 0.026), rubber);
    line.frustumCulled = false; scene.add(line);
  }
  const walls = wallMesh(tr, th, q.stride); walls.receiveShadow = true; scene.add(walls);
  if (th.weather === 'rain') {
    const water = new THREE.MeshPhysicalMaterial({ color: 0xffffff, side: THREE.DoubleSide, map: waterTexture(), roughness: 0.07, metalness: 0.025, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.15, transparent: true, opacity: 0.9, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (let i = 0; ; i++) {
      const p = puddleParams(i);
      if (p.start >= tr.len - 36) break;
      const puddle = new THREE.Mesh(surfacePatchGeom(tr, p.start, p.halfLength * 2, p.lane, p.halfWidth, p.seed, 0.085), water);
      puddle.frustumCulled = false; scene.add(puddle);
    }
  }
  if (th.mud) {
    const mudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: mudTexture(), roughness: 0.98, metalness: 0, transparent: true, opacity: 0.95, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
    for (let i = 0; ; i++) {
      const m = mudParams(i);
      if (m.start >= tr.len - 60) break;
      const mesh = new THREE.Mesh(surfacePatchGeom(tr, m.start, m.halfLength * 2, m.lane, m.halfWidth, m.seed, 0.065), mudMat);
      mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
    }
  }
  scene.add(archMesh(tr, th));
  { // línea de meta a cuadros
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * 16, j * 16, 16, 16); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = stripGeom(tr, 0, 1.0, -ROAD_HALF, ROAD_HALF, 0.05), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k));
    const fl = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); fl.receiveShadow = true; scene.add(fl);
  }
  // Líneas blancas continuas de borde, separadas de los pianos elevados.
  const edgeMat = new THREE.MeshBasicMaterial({ color: th.surface === 'snow' ? 0xd7e9ff : 0xf5f2e9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, side * (ROAD_HALF - 0.24) - 0.075, side * (ROAD_HALF - 0.24) + 0.075, 0.075), edgeMat);
    edge.frustumCulled = false; scene.add(edge);
  }
  scene.add(gantry(tr, tr.len / 3, 'S2', '#66e8ff')); scene.add(gantry(tr, (tr.len * 2) / 3, 'S3', '#66e8ff'));
  tyreStacks(tr, th, scene);
  turnSigns(tr, th, scene, !!opt.mobile);

  const info = scenery(tr, th, scene, rng, q);
  const windDummy = new THREE.Object3D();
  let windClock = 0;
  const updateWind = (dt) => {
    windClock += Math.min(dt, 0.05);
    const t = windClock;
    for (const entry of info.windMeshes) {
      const { mesh, spots, kind } = entry;
      for (let k = 0; k < spots.length; k++) {
        const s = spots[k], phase = t * (kind === 'grass' ? 1.8 : 0.72) + s[0] * 0.035 + s[1] * 0.027;
        const sway = Math.sin(phase) * (kind === 'grass' ? 0.17 : 0.035) + Math.sin(phase * 0.53) * (kind === 'grass' ? 0.06 : 0.012);
        windDummy.position.set(s[0], s[4] || 0, s[1]);
        if (kind === 'tree') windDummy.scale.set(s[2] * s[5], s[2] * s[6], s[2] * s[5]);
        else windDummy.scale.setScalar(s[2]);
        windDummy.rotation.set(sway, s[3], -sway * 0.38);
        windDummy.updateMatrix(); mesh.setMatrixAt(k, windDummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  // suelo
  const gs = 5200;
  const gg = new THREE.PlaneGeometry(gs, gs, 1, 1).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ color: th.ground, map: groundTex() }));
  ground.position.set(info.cx, 0, info.cz); ground.receiveShadow = true; scene.add(ground);

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
  return { scene, sky, sun, updateWind, updateWeather };
}

export function disposeScene(scene) {
  if (scene.environment) scene.environment.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
  });
}
