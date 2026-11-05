// Construcción de la escena 3D de una pista (three.js)
import * as THREE from 'three';
import { ROAD_HALF, WALL, setRoad, rainAt } from './track.js';
import { SURF, zoneAt, smoothstep, patchBoundary, puddleParams, mudParams, MARIO_OIL_PATCHES } from './surface.js';
import { rngFromSeed } from './rng.js';
import { getSponsorTexture } from './sponsors.js';

const col = (hex) => new THREE.Color(hex);

function skyMesh(th) {
  const isKart = th.deco === 'kart';
  const storm = th.weather === 'rain';
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: isKart ? col(0x289ef5) : col(th.skyTop).lerp(col(0x424e5a), storm ? 0.52 : 0) },
      hor: { value: isKart ? col(0xfef6a2) : col(th.skyHor).lerp(col(0x7d8995), storm ? 0.54 : 0) },
      sunC: { value: col(th.sun).lerp(col(0xa9b3bf), storm ? 0.65 : 0) },
      sunD: { value: new THREE.Vector3(...th.sunDir).normalize() }
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 hor; uniform vec3 sunC; uniform vec3 sunD;
      varying vec3 vD;
      void main(){
        float h = clamp(vD.y, 0.0, 1.0);
        vec3 c = mix(hor, top, pow(h, 0.44));
        float haze = pow(1.0 - abs(vD.y), 3.8);
        c = mix(c, hor * 1.06, haze * 0.32);
        float s = max(dot(normalize(vD), sunD), 0.0);
        float sunDisk = pow(s, 1200.0) * 2.2;
        float sunGlow = pow(s, 72.0) * 0.42 + pow(s, 9.0) * 0.12;
        c += sunC * (sunDisk + sunGlow);
        if(vD.y < 0.0) c = hor;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
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

function mergeBufferGeometries(geos) {
  let totalPos = 0, totalNorm = 0, totalUv = 0, totalCol = 0;
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of nonIndexed) {
    if (g.attributes.position) totalPos += g.attributes.position.array.length;
    if (g.attributes.normal) totalNorm += g.attributes.normal.array.length;
    if (g.attributes.uv) totalUv += g.attributes.uv.array.length;
    if (g.attributes.color) totalCol += g.attributes.color.array.length;
  }
  const pos = new Float32Array(totalPos);
  const norm = totalNorm === totalPos ? new Float32Array(totalNorm) : null;
  const uv = totalUv > 0 ? new Float32Array(totalUv) : null;
  const col = totalCol === totalPos ? new Float32Array(totalCol) : null;

  let posOff = 0, normOff = 0, uvOff = 0, colOff = 0;
  for (const g of nonIndexed) {
    if (g.attributes.position) {
      pos.set(g.attributes.position.array, posOff);
      posOff += g.attributes.position.array.length;
    }
    if (norm && g.attributes.normal) {
      norm.set(g.attributes.normal.array, normOff);
      normOff += g.attributes.normal.array.length;
    }
    if (uv && g.attributes.uv) {
      uv.set(g.attributes.uv.array, uvOff);
      uvOff += g.attributes.uv.array.length;
    }
    if (col && g.attributes.color) {
      col.set(g.attributes.color.array, colOff);
      colOff += g.attributes.color.array.length;
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (norm) merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  else merged.computeVertexNormals();
  if (uv) merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}

// ---- viento: las copas se balancean en el vértice (sin físicas) y hojas sueltas recorren el circuito ----
const windU = { uTime: { value: 0 } };
const windLeaves = [];
let lastWindT = 0;
// material con balanceo de copa: los vértices altos se desplazan con una onda que depende de la posición de cada árbol
export function windy(mat) { return mat; } // sin balanceo de copas: se quitó por rendimiento
// textura de follaje: manchas de luz y sombra que rompen el color plano de las copas
let foliageTexCache = null;
function foliageTex() {
  if (!foliageTexCache) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${(0.1 + Math.random() * 0.2).toFixed(3)})` : `rgba(255,255,255,${(0.12 + Math.random() * 0.22).toFixed(3)})`;
      g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 9, 0, Math.PI * 2); g.fill();
    }
    foliageTexCache = new THREE.CanvasTexture(cv); foliageTexCache.colorSpace = THREE.SRGBColorSpace; foliageTexCache.wrapS = foliageTexCache.wrapT = THREE.RepeatWrapping;
  }
  return foliageTexCache;
}
export function foliage(amp = 1, color = 0xffffff, rough = 0.92) {
  return windy(new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true, map: foliageTex() }), amp);
}
// hoja: silueta ovalada con borde, pintada en una textura con transparencia
let leafTexCache = null;
function leafTex() {
  if (!leafTexCache) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 40; const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 40); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(32, 20, 30, 13, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 20); g.lineTo(60, 20); g.stroke();
    leafTexCache = new THREE.CanvasTexture(cv); leafTexCache.colorSpace = THREE.SRGBColorSpace;
  }
  return leafTexCache;
}
// hojas que se desprenden y van con el viento: una sola InstancedMesh con n hojas recicladas (coste fijo)
function makeLeaves(tr, scene, n, palette) {
  const mat = new THREE.MeshLambertMaterial({ map: leafTex(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.26), mat, n);
  m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; scene.add(m);
  const dummy = new THREE.Object3D(), pal = palette.map(col);
  const pts = Array.from({ length: n }, () => ({}));
  const spawn = (d) => {
    const i = Math.floor(Math.random() * tr.N), side = Math.random() < 0.5 ? -1 : 1, l = WALL + 6 + Math.random() * 55;
    d.x = tr.X[i] + -tr.TZ[i] * l * side; d.z = tr.Z[i] + tr.TX[i] * l * side; d.y = 3 + Math.random() * 10;
    d.ph = Math.random() * 6.283; d.sp = 0.75 + Math.random() * 0.5; d.rs = Math.random() * 6.283; d.life = 5 + Math.random() * 7; d.age = 0;
  };
  pts.forEach((d, k) => { spawn(d); d.age = Math.random() * d.life; m.setColorAt(k, pal[k % pal.length]); });
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  windLeaves.push({
    update(t, dt) {
      const wx = 2.4, wz = 0.9;
      for (let k = 0; k < n; k++) {
        const d = pts[k]; d.age += dt;
        if (d.age > d.life || d.y < 0.3) { spawn(d); }
        d.x += (wx + Math.sin(t * 0.7 + d.ph) * 0.7) * dt * d.sp; d.z += (wz + Math.cos(t * 0.5 + d.ph) * 0.5) * dt * d.sp;
        d.y += (-0.4 + Math.sin(t * 2.1 + d.ph) * 0.55) * dt;
        dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(t * 1.7 + d.rs, t * 1.1 + d.ph, Math.sin(t * 2.4 + d.ph) * 0.9); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
  });
}
// llamar en cada fotograma: mueve el viento y las hojas
export function updateWind(t) {
  const dt = Math.min(0.1, Math.max(0, t - lastWindT)); lastWindT = t;
  windU.uTime.value = t;
  for (const L of windLeaves) L.update(t, dt);
}
function colorGeometry(geo, r, g, b) {
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  const count = nonIdx.attributes.position.count;
  const cols = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    cols[v * 3] = r;
    cols[v * 3 + 1] = g;
    cols[v * 3 + 2] = b;
  }
  nonIdx.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return nonIdx;
}

const asphaltCache = new Map();
function asphaltTex(th) {
  const key = th.id || 'default';
  if (asphaltCache.has(key)) return asphaltCache.get(key);
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), im = ctx.createImageData(size, size);
  let baseLum = 120, noiseAmp = 30, speckRatio = 0.11, warmR = 0, coolB = 0;
  if (th.id === 'spa') {
    baseLum = 54; noiseAmp = 34; speckRatio = 0.16; coolB = 3;
  } else if (th.id === 'monaco') {
    baseLum = 108; noiseAmp = 26; speckRatio = 0.12; warmR = 5;
  } else if (th.id === 'desierto') {
    baseLum = 146; noiseAmp = 34; speckRatio = 0.08; warmR = 16;
  } else if (th.id === 'nieve') {
    baseLum = 138; noiseAmp = 36; speckRatio = 0.15; coolB = 14;
  } else if (th.id === 'neon') {
    baseLum = 58; noiseAmp = 28; speckRatio = 0.16; coolB = 12;
  } else {
    baseLum = 114; noiseAmp = 30; speckRatio = 0.10;
  }
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    let n = (Math.random() - 0.5) * noiseAmp;
    if (Math.random() < speckRatio) n += (Math.random() < 0.5 ? 46 : -42);
    const groove = Math.sin(x * 0.14) * 4.5;
    const v = Math.max(0, Math.min(255, Math.round(baseLum + n + groove)));
    const idx = i * 4;
    im.data[idx] = Math.max(0, Math.min(255, v + warmR));
    im.data[idx + 1] = v;
    im.data[idx + 2] = Math.max(0, Math.min(255, v + coolB));
    im.data[idx + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  // parches de reparación y grietas: rompen la uniformidad y dan aspecto de carretera real (aleatorio fijo por circuito)
  { let sd = 12345 + String(th.id || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 977; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 7; k++) { const w = 30 + rn() * 70, h = 18 + rn() * 60, x = rn() * (size - w), y = rn() * (size - h); ctx.fillStyle = rn() < 0.5 ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(x, y, w, h); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(15,15,18,0.34)';
    for (let k = 0; k < 5; k++) { let x = rn() * size, y = rn() * size; ctx.beginPath(); ctx.moveTo(x, y); for (let n = 0; n < 6; n++) { x += (rn() - 0.5) * 40; y += 10 + rn() * 26; ctx.lineTo(x, y); } ctx.stroke(); } }
  if (th.id === 'desierto' || th.id === 'monaco') {
    ctx.strokeStyle = 'rgba(25, 25, 30, 0.38)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(size * 0.22, 0); ctx.bezierCurveTo(size * 0.27, size * 0.45, size * 0.16, size * 0.72, size * 0.24, size); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 32);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  asphaltCache.set(key, tex);
  return tex;
}

let marioTarmacTextureCache = null;
function marioTarmacTex() {
  if (marioTarmacTextureCache) return marioTarmacTextureCache;
  const size = 32, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), im = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dither = ((x + y) % 2 === 0 ? 8 : -8) + ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 6 : -6);
      const v = Math.max(0, Math.min(255, 140 + dither));
      im.data[idx] = im.data[idx + 1] = im.data[idx + 2] = v;
      im.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  marioTarmacTextureCache = new THREE.CanvasTexture(canvas);
  marioTarmacTextureCache.wrapS = marioTarmacTextureCache.wrapT = THREE.RepeatWrapping;
  marioTarmacTextureCache.repeat.set(8, 32);
  marioTarmacTextureCache.magFilter = THREE.NearestFilter;
  marioTarmacTextureCache.minFilter = THREE.NearestFilter;
  marioTarmacTextureCache.colorSpace = THREE.SRGBColorSpace;
  return marioTarmacTextureCache;
}

let marioArrowTextureCache = null;
function marioArrowTex() {
  if (marioArrowTextureCache) return marioArrowTextureCache;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  x.fillStyle = '#ffcc00';
  for (let i = 0; i < 2; i++) {
    const yOff = i * 48;
    x.beginPath();
    x.moveTo(64, 18 + yOff);
    x.lineTo(108, 54 + yOff);
    x.lineTo(84, 54 + yOff);
    x.lineTo(64, 38 + yOff);
    x.lineTo(44, 54 + yOff);
    x.lineTo(20, 54 + yOff);
    x.closePath();
    x.fill();
  }
  marioArrowTextureCache = new THREE.CanvasTexture(c);
  marioArrowTextureCache.colorSpace = THREE.SRGBColorSpace;
  return marioArrowTextureCache;
}

let gravelTextureCache = null;
function gravelTex() {
  if (gravelTextureCache) return gravelTextureCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c5a270'; ctx.fillRect(0, 0, size, size);
  const stonePals = ['#b89462', '#dcbc8a', '#9e7b4e', '#dfd0b2', '#866b47', '#e8d8be'];
  for (let i = 0; i < 480; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 1 + Math.random() * 2.8;
    ctx.fillStyle = stonePals[Math.floor(Math.random() * stonePals.length)];
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(100, 75, 45, 0.16)'; ctx.lineWidth = 2.0;
  for (let y = 4; y < size; y += 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  gravelTextureCache = new THREE.CanvasTexture(canvas);
  gravelTextureCache.wrapS = gravelTextureCache.wrapT = THREE.RepeatWrapping;
  gravelTextureCache.repeat.set(10, 40);
  gravelTextureCache.colorSpace = THREE.SRGBColorSpace;
  return gravelTextureCache;
}

let kerbTextureCache = null;
function kerbTex() {
  if (kerbTextureCache) return kerbTextureCache;
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e5ebf3'; ctx.fillRect(0, 0, 128, 128);
  const im = ctx.getImageData(0, 0, 128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const n = (Math.random() - 0.5) * 26;
    im.data[i * 4] = Math.max(0, Math.min(255, im.data[i * 4] + n));
    im.data[i * 4 + 1] = Math.max(0, Math.min(255, im.data[i * 4 + 1] + n));
    im.data[i * 4 + 2] = Math.max(0, Math.min(255, im.data[i * 4 + 2] + n));
  }
  ctx.putImageData(im, 0, 0);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)'; ctx.fillRect(0, y, 128, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)'; ctx.fillRect(0, y + 4, 128, 3);
  }
  ctx.fillStyle = 'rgba(18, 20, 24, 0.42)';
  for (let i = 0; i < 30; i++) {
    const rx = 16 + Math.random() * 96, ry = Math.random() * 128;
    const rw = 2 + Math.random() * 8, rh = 12 + Math.random() * 28;
    ctx.fillRect(rx, ry, rw, rh);
  }
  kerbTextureCache = new THREE.CanvasTexture(canvas);
  kerbTextureCache.wrapS = kerbTextureCache.wrapT = THREE.RepeatWrapping;
  kerbTextureCache.repeat.set(2, 8);
  kerbTextureCache.colorSpace = THREE.SRGBColorSpace;
  return kerbTextureCache;
}

let armcoTextureCache = null;
function armcoTex() {
  if (armcoTextureCache) return armcoTextureCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) {
    const wave = Math.sin((y / size) * Math.PI * 8);
    const lum = Math.round(180 + wave * 46);
    ctx.fillStyle = `rgb(${lum}, ${lum + 2}, ${lum + 6})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 16; x < size; x += 32) {
    for (let y = 16; y < size; y += 32) {
      ctx.fillStyle = '#656a74'; ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
  armcoTextureCache = new THREE.CanvasTexture(canvas);
  armcoTextureCache.wrapS = armcoTextureCache.wrapT = THREE.RepeatWrapping;
  armcoTextureCache.repeat.set(12, 1);
  armcoTextureCache.colorSpace = THREE.SRGBColorSpace;
  return armcoTextureCache;
}

const sponsorBoardCaches = [];
function getSponsorTex(idx) {
  if (sponsorBoardCaches[idx]) return sponsorBoardCaches[idx];
  const brands = [
    { bg: '#0d1117', fg: '#f0f4f8', text: 'ASUPARK RACING', accent: '#e52521' },
    { bg: '#e52521', fg: '#fefefe', text: 'PIRELLI', accent: '#ffd000' },
    { bg: '#0b2046', fg: '#ffffff', text: 'MOBIL 1', accent: '#e52521' },
    { bg: '#101720', fg: '#00e5ff', text: 'BREMBO', accent: '#ffffff' },
    { bg: '#0f172a', fg: '#38bdf8', text: 'TAG HEUER', accent: '#22c55e' },
    { bg: '#b91c1c', fg: '#ffffff', text: 'BRIDGESTONE', accent: '#000000' },
  ];
  const b = brands[idx % brands.length];
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = b.bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = b.accent; ctx.fillRect(0, 0, 512, 10); ctx.fillRect(0, 118, 512, 10);
  ctx.font = '900 58px "Jersey 10",Impact,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = b.fg;
  ctx.fillText(b.text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sponsorBoardCaches[idx] = tex;
  return tex;
}

const distBoardCaches = {};
function distanceBoardTex(num) {
  if (distBoardCaches[num]) return distBoardCaches[num];
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
  ctx.lineWidth = 14; ctx.strokeStyle = '#c92a2a'; ctx.strokeRect(10, 10, 236, 236);
  ctx.fillStyle = '#111317';
  ctx.font = '900 120px "Jersey 10",Impact,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  distBoardCaches[num] = tex;
  return tex;
}
// Cactus: textura con costillas verticales, espinas y tonos de sol. Se comparte entre todos los cactus.
let cactusTexCache = null;
function cactusMat(color = 0xffffff) {
  if (!cactusTexCache) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d');
    const base = g.createLinearGradient(0, 0, 128, 0);
    base.addColorStop(0, '#2c6328'); base.addColorStop(0.45, '#5ea047'); base.addColorStop(0.7, '#78b657'); base.addColorStop(1, '#2c6328');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 12; r++) { // costillas: sombra a un lado y luz al otro
      const x = (r + 0.5) * 128 / 12;
      g.fillStyle = 'rgba(16,44,16,.5)'; g.fillRect(x - 2, 0, 4, 256);
      g.fillStyle = 'rgba(205,255,160,.28)'; g.fillRect(x + 2.5, 0, 2, 256);
    }
    for (let k = 0; k < 520; k++) { g.fillStyle = 'rgba(248,242,214,.9)'; g.fillRect(Math.random() * 128, Math.random() * 256, 1.6, 1.6); } // espinas
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(70,52,20,${0.05 + Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 256, 2 + Math.random() * 6, 0, Math.PI * 2); g.fill(); } // polvo y manchas
    cactusTexCache = new THREE.CanvasTexture(cv); cactusTexCache.colorSpace = THREE.SRGBColorSpace; cactusTexCache.wrapS = THREE.RepeatWrapping;
  }
  return new THREE.MeshStandardMaterial({ color, map: cactusTexCache, roughness: 0.62 });
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
    const cloudy = th.weather === 'rain', cloudGroups = cloudy ? 27 : 18;
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: cloudy ? 0.84 : 0.54, fog: false, depthWrite: false });
    const cg = new THREE.IcosahedronGeometry(1, 1), clouds = new THREE.InstancedMesh(cg, cm, cloudGroups * 4), d = new THREE.Object3D();
    const cloudCol = col(th.weather === 'rain' ? 0x505d6b : th.skyHor).lerp(col(th.weather === 'rain' ? 0x758392 : 0xffffff), th.weather === 'rain' ? 0.34 : 0.78);
    for (let i = 0; i < cloudGroups; i++) {
      const a = rng() * 6.283, r = (cloudy ? 480 : 800) + rng() * 1000, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = (cloudy ? 170 : 220) + rng() * 220, width = (cloudy ? 150 : 100) + rng() * (cloudy ? 150 : 100), height = (cloudy ? 30 : 18) + rng() * (cloudy ? 26 : 18);
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
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: th.sun, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: th.night ? 0.5 : th.weather === 'rain' ? 0.18 : 0.9 }));
  const d = new THREE.Vector3(...th.sunDir).normalize().multiplyScalar(1500); sp.position.copy(d); sp.scale.setScalar(th.night ? 220 : th.weather === 'rain' ? 260 : 520); sp.renderOrder = -8; g.add(sp);
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
  x.fillStyle = color; x.font = '64px "Jersey 10",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 128, 52);
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
  const group = new THREE.Group(), D = new THREE.Object3D(), frames = [], panes = [], sills = [], balconies = [], rails = [], roofs = [], awnings = [];
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), items.length);
  items.forEach((b, k) => {
    D.position.set(b.x, -1, b.z); D.scale.set(b.d, b.h + 1, b.w); D.rotation.set(0, b.ry, 0); D.updateMatrix(); m.setMatrixAt(k, D.matrix); m.setColorAt(k, b.c);
    roofs.push({ x: b.x, y: b.h, z: b.z, d: b.d, w: b.w, ry: b.ry });
    const floors = Math.max(2, Math.floor((b.h + 1) / 3.8));
    for (const face of [-1, 1]) for (let floor = 1; floor < floors; floor++) for (let column = 0; column < 2; column++) {
      // las ventanas sobresalen de la fachada (marco y alféizar) en vez de quedar pegadas al muro
      const localX = face * (b.d * 0.5 + 0.2), localZ = (column ? 1 : -1) * b.w * 0.2;
      const x = b.x + localX * Math.cos(b.ry) + localZ * Math.sin(b.ry), z = b.z - localX * Math.sin(b.ry) + localZ * Math.cos(b.ry);
      const y = -1 + (floor + 0.52) * (b.h + 1) / floors, width = b.w * 0.21, height = Math.min(1.7, (b.h + 1) / floors * 0.52);
      frames.push({ x, y, z, ry: b.ry + Math.PI / 2, width: width + 0.18, height: height + 0.2 });
      panes.push({ x, y, z, ry: b.ry + Math.PI / 2, width, height, shade: (k * 5 + floor * 3 + column) % 7 });
      sills.push({ x, y: y - height / 2 - 0.06, z, ry: b.ry + Math.PI / 2, width: width + 0.35 });
      if (face === -b.side && floor > 1 && column === 0) {
        const bx = b.x + (localX + face * 0.52) * Math.cos(b.ry) + localZ * Math.sin(b.ry);
        const bz = b.z - (localX + face * 0.52) * Math.sin(b.ry) + localZ * Math.cos(b.ry);
        balconies.push({ x: bx, y: y - height * 0.56, z: bz, ry: b.ry });
        rails.push({ x: bx + face * Math.cos(b.ry) * 0.48, y: y - height * 0.1, z: bz - face * Math.sin(b.ry) * 0.48, ry: b.ry });
      }
      if (face === -b.side && floor === 1 && (k + column) % 2 === 0) {
        const ax = b.x + (localX + face * 0.65) * Math.cos(b.ry) + localZ * Math.sin(b.ry);
        const az = b.z - (localX + face * 0.65) * Math.sin(b.ry) + localZ * Math.cos(b.ry);
        awnings.push({ x: ax, y: y - height * 0.12, z: az, ry: b.ry, shade: (k + column) % 4 });
      }
    }
  });
  m.frustumCulled = false; group.add(m);
  const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb9ac98, roughness: 0.96 }), roofs.length);
  roofs.forEach((b, k) => { D.position.set(b.x, b.y - 0.1, b.z); D.scale.set(b.d + 0.5, 0.3, b.w + 0.5); D.rotation.set(0, b.ry, 0); D.updateMatrix(); roof.setMatrixAt(k, D.matrix); });
  roof.frustumCulled = false; group.add(roof);
  const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf0e4d0, roughness: 0.84 }), frames.length);
  frames.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.24, b.height, b.width); D.rotation.set(0, b.ry, 0); D.updateMatrix(); frame.setMatrixAt(k, D.matrix); });
  frame.frustumCulled = false; group.add(frame);
  const sill = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe6ddcb, roughness: 0.8 }), sills.length);
  sills.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.34, 0.1, b.width); D.rotation.set(0, b.ry, 0); D.updateMatrix(); sill.setMatrixAt(k, D.matrix); });
  sill.frustumCulled = false; group.add(sill);
  const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.2, emissive: 0x121c25, emissiveIntensity: 0.25 }), panes.length);
  const glassPalette = [0x344c5c, 0x3c5965, 0x526a72, 0x65777b, 0x314251, 0x9a8b71, 0x5b6d77].map(col);
  panes.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.1, b.height, b.width); D.rotation.set(0, b.ry, 0); D.updateMatrix(); glass.setMatrixAt(k, D.matrix); glass.setColorAt(k, glassPalette[b.shade]); });
  glass.frustumCulled = false; group.add(glass);
  const balcony = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xb5b0a7, roughness: 0.78 }), balconies.length);
  balconies.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.9, 0.12, 1.8); D.rotation.set(0, b.ry, 0); D.updateMatrix(); balcony.setMatrixAt(k, D.matrix); });
  balcony.frustumCulled = false; group.add(balcony);
  const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x565b5e, metalness: 0.55, roughness: 0.42 }), rails.length);
  rails.forEach((b, k) => { D.position.set(b.x, b.y, b.z); D.scale.set(0.08, 0.62, 1.8); D.rotation.set(0, b.ry, 0); D.updateMatrix(); rail.setMatrixAt(k, D.matrix); });
  rail.frustumCulled = false; group.add(rail);
  if (awnings.length) {
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide });
    const awningPal = [0xc43228, 0x1d558b, 0x27743d, 0xbf812d].map(col);
    const am = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), awningMat, awnings.length);
    awnings.forEach((b, k) => {
      D.position.set(b.x, b.y, b.z);
      D.scale.set(1.05, 0.32, 1.75);
      D.rotation.set(0, b.ry, 0.22);
      D.updateMatrix();
      am.setMatrixAt(k, D.matrix);
      am.setColorAt(k, awningPal[b.shade]);
    });
    am.frustumCulled = false; group.add(am);
  }
  return group;
}

// Cuenca marítima de Port Hercule con muelles, pantalanes flotantes y yates de lujo amarrados
function monacoHarbor(scene, shadows) {
  const group = new THREE.Group();
  const waterGeo = new THREE.PlaneGeometry(185, 215).rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x114269,
    roughness: 0.15,
    metalness: 0.28,
    map: waterTexture(),
    envMapIntensity: 0.95,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(118, 0.05, -125);
  waterMesh.receiveShadow = shadows;
  group.add(waterMesh);

  const quayMat = new THREE.MeshStandardMaterial({ color: 0x9b948a, roughness: 0.88 });
  const quays = [
    { x: 34, z: -125, w: 7, l: 215, h: 0.55 },
    { x: 120, z: -228, w: 180, l: 7, h: 0.55 },
    { x: 206, z: -130, w: 7, l: 195, h: 0.55 },
  ];
  for (const q of quays) {
    const qm = new THREE.Mesh(new THREE.BoxGeometry(q.w, q.h, q.l), quayMat);
    qm.position.set(q.x, q.h * 0.5, q.z);
    qm.receiveShadow = shadows;
    qm.castShadow = shadows;
    group.add(qm);
  }

  const pontoonMat = new THREE.MeshStandardMaterial({ color: 0x765c43, roughness: 0.82 });
  const pontoons = [
    { x: 105, z: -80, w: 125, l: 3.2 },
    { x: 105, z: -135, w: 125, l: 3.2 },
    { x: 100, z: -185, w: 115, l: 3.2 },
  ];
  for (const p of pontoons) {
    const pm = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.35, p.l), pontoonMat);
    pm.position.set(p.x, 0.2, p.z);
    pm.receiveShadow = shadows;
    group.add(pm);
  }

  const yachtSpots = [
    { x: 55, z: -72, ry: 0, s: 1.1 }, { x: 75, z: -72, ry: 0, s: 1.25 }, { x: 95, z: -72, ry: 0, s: 1.0 }, { x: 118, z: -72, ry: 0, s: 1.35 }, { x: 142, z: -72, ry: 0, s: 1.15 },
    { x: 62, z: -88, ry: Math.PI, s: 1.05 }, { x: 84, z: -88, ry: Math.PI, s: 1.3 }, { x: 106, z: -88, ry: Math.PI, s: 1.1 }, { x: 130, z: -88, ry: Math.PI, s: 1.4 },
    { x: 58, z: -127, ry: 0, s: 1.2 }, { x: 80, z: -127, ry: 0, s: 1.4 }, { x: 105, z: -127, ry: 0, s: 1.1 }, { x: 132, z: -127, ry: 0, s: 1.5 },
    { x: 68, z: -143, ry: Math.PI, s: 1.15 }, { x: 92, z: -143, ry: Math.PI, s: 1.35 }, { x: 120, z: -143, ry: Math.PI, s: 1.25 },
    { x: 65, z: -177, ry: 0, s: 1.3 }, { x: 95, z: -177, ry: 0, s: 1.45 }, { x: 128, z: -177, ry: 0, s: 1.2 },
    { x: 75, z: -193, ry: Math.PI, s: 1.1 }, { x: 110, z: -193, ry: Math.PI, s: 1.35 },
  ];

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf6f8fc, roughness: 0.35, metalness: 0.1 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x9b7b58, roughness: 0.75 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x162432, roughness: 0.15, metalness: 0.85 });

  const hullGeo = new THREE.BoxGeometry(4.6, 1.8, 14.5).translate(0, 0.9, 0);
  const deckGeo = new THREE.BoxGeometry(4.3, 0.12, 13.8).translate(0, 1.82, 0);
  const cabinGeo = new THREE.BoxGeometry(3.6, 1.5, 8.5).translate(0, 2.6, -0.6);
  const glassGeo = new THREE.BoxGeometry(3.68, 0.75, 5.2).translate(0, 2.7, 0.2);

  const hullMesh = new THREE.InstancedMesh(hullGeo, hullMat, yachtSpots.length);
  const deckMesh = new THREE.InstancedMesh(deckGeo, deckMat, yachtSpots.length);
  const cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, yachtSpots.length);
  const glassMesh = new THREE.InstancedMesh(glassGeo, glassMat, yachtSpots.length);

  const D = new THREE.Object3D();
  yachtSpots.forEach((sp, idx) => {
    D.position.set(sp.x, 0.05, sp.z);
    D.rotation.set(0, sp.ry, 0);
    D.scale.set(sp.s, sp.s, sp.s);
    D.updateMatrix();

    hullMesh.setMatrixAt(idx, D.matrix);
    deckMesh.setMatrixAt(idx, D.matrix);
    cabinMesh.setMatrixAt(idx, D.matrix);
    glassMesh.setMatrixAt(idx, D.matrix);
  });

  hullMesh.castShadow = cabinMesh.castShadow = shadows;
  hullMesh.receiveShadow = deckMesh.receiveShadow = cabinMesh.receiveShadow = shadows;
  hullMesh.frustumCulled = deckMesh.frustumCulled = cabinMesh.frustumCulled = glassMesh.frustumCulled = false;
  group.add(hullMesh, deckMesh, cabinMesh, glassMesh);

  const palmSpots = [];
  for (let z = -220; z <= -35; z += 12) palmSpots.push([30.5, z]);
  for (let x = 40; x <= 180; x += 14) palmSpots.push([x, -224]);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5239, roughness: 0.92 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7534, roughness: 0.88, side: THREE.DoubleSide });

  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 5.8, 7).translate(0, 2.9, 0);
  const frondGeo = new THREE.ConeGeometry(2.4, 1.2, 7).translate(0, 5.8, 0);

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondMesh = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);

  palmSpots.forEach((p, idx) => {
    D.position.set(p[0], 0, p[1]);
    D.rotation.set((idx % 3 - 1) * 0.06, idx * 0.8, (idx % 2 === 0 ? 1 : -1) * 0.08);
    const s = 0.85 + (idx % 4) * 0.12;
    D.scale.set(s, s, s);
    D.updateMatrix();

    trunkMesh.setMatrixAt(idx, D.matrix);
    frondMesh.setMatrixAt(idx, D.matrix);
  });

  trunkMesh.castShadow = frondMesh.castShadow = shadows;
  trunkMesh.receiveShadow = shadows;
  trunkMesh.frustumCulled = frondMesh.frustumCulled = false;
  group.add(trunkMesh, frondMesh);

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
  const N = tr.N, hw = ROAD_HALF, L = WALL, isKart = th.deco === 'kart';
  const cycD = (a, b) => { const d = Math.abs(a - b); return Math.min(d, N - d); };
  const wetZone = !!(tr.rain && tr.rain.length), cWet = col(0x1a2430), cConcrete = col(0x9b988f); // microclima de lluvia: asfalto más oscuro y húmedo en esos tramos
  const effectiveStride = stride;
  const roadData = { pos: [], colors: [], uvs: [] };
  const kerbData = { pos: [], colors: [], uvs: [] };
  const gravelData = { pos: [], colors: [], uvs: [] };
  const edgeData = { pos: [], colors: [], uvs: [] };

  const cRoad = col(th.road), cRoad2 = col(th.road).multiplyScalar(0.92);
  const cGrass = col(th.grass), cDirt = col(th.dirt);
  const k1 = col(th.kerb1).multiplyScalar(0.9), k2 = col(th.kerb2).multiplyScalar(0.92);
  const yel = col(0xffc400), blk = col(0x222222);
  const kset = th.kerbs3 ? th.kerbs3.map((c) => col(c).multiplyScalar(0.92)) : null;
  const cGravel = col(0xd4be88);

  const kEnv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = th.noKerbs ? 0 : tr.kerb[i]; if (!v) continue;
    let d = 14; for (let k = 1; k < 14; k++) if (tr.kerb[(i + k) % N] !== v || tr.kerb[(i - k + N) % N] !== v) { d = k; break; }
    kEnv[i] = Math.min(1, d / 9);
  }
  const wornC = (c, n) => { const f = 0.9 + 0.1 * (((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1); return c.clone().multiplyScalar(f); };

  const pushQuad = (target, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c, uv, outerColor = c) => {
    target.pos.push(ax, ay, az, cx, cy, cz, bx, by, bz, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (const shade of [outerColor, outerColor, c, c, outerColor, c]) target.colors.push(shade.r, shade.g, shade.b);
    const [ua, va, ub, vb, uc, vc, ud, vd] = uv;
    target.uvs.push(ua, va, uc, vc, ub, vb, ub, vb, uc, vc, ud, vd);
  };

  for (let i = 0; i < N; i += effectiveStride) {
    const j = (i + effectiveStride) % N, s = i * tr.ds;
    const hi = tr.Y[i], hj = tr.Y[j];
    const hwI = tr.hw ? tr.hw[i] : hw, hwJ = tr.hw ? tr.hw[j] : hw; // semianchura del asfalto (variable en algunos circuitos)
    const brI = !!tr.bridge && cycD(i, tr.bridge.i) < tr.bridge.span, brJ = !!tr.bridge && cycD(j, tr.bridge.i) < tr.bridge.span; // sobre el cruce: laterales verticales de hormigón en vez de talud
    const eoI = brI ? L + 0.35 : L + 2.5 + hi * 1.1, eoJ = brJ ? L + 0.35 : L + 2.5 + hj * 1.1;
    const KWI = isKart ? 1.4 : Math.min(1.9, L - hwI - 0.2), KWJ = isKart ? 1.4 : Math.min(1.9, L - hwJ - 0.2);
    const GW = tr.rg ? hwI + tr.rg[i] : hwI + KWI + 0.02, GWj = tr.rg ? hwJ + tr.rg[j] : hwJ + KWJ + 0.02;

    // br: bajo el tablero del puente los bordes laterales solo bajan 1,4 m (canto del tablero) para dejar libre el paso de la pista inferior
    const lat = (k, h, eo, krL, krR, gw, hw, KW, br) => isKart
      ? [[-eo, 0], [-L, h - 0.04], [-gw, h - 0.02], [-(hw + KW), h - 0.02], [-(hw + KW), h + krL], [-(hw + 0.2), h + krL * 0.9], [-hw, h + 0.005], [-0.22, h], [0.22, h], [hw, h + 0.005], [hw + 0.2, h + krR * 0.9], [hw + KW, h + krR], [hw + KW, h - 0.02], [gw, h - 0.02], [L, h - 0.04], [eo, 0]][k]
      : [[-eo, br ? h - 1.4 : 0], [-L, h - 0.05], [-gw, h - 0.02], [-(hw + KW), h - 0.02], [-(hw + KW), h + krL], [-(hw + KW * 0.45), h + krL * 0.75], [-hw, h + 0.004], [-0.22, h], [0.22, h], [hw, h + 0.004], [hw + KW * 0.45, h + krR * 0.75], [hw + KW, h + krR], [hw + KW, h - 0.02], [gw, h - 0.02], [L, h - 0.05], [eo, br ? h - 1.4 : 0]][k];

    const sLen = isKart ? 3.2 : 3.0, s2k = (i + effectiveStride) * tr.ds;
    const kv = (th.noKerbs ? 0 : tr.kerb[i]), kvj = (th.noKerbs ? 0 : tr.kerb[j]);
    const wave = (x, e) => (isKart ? 0.22 : (th.kerbRough ? 0.13 + 0.04 * Math.sin(Math.PI * (((x % sLen) + sLen) % sLen) / sLen) : 0.048 + 0.024 * Math.sin(Math.PI * (((x % sLen) + sLen) % sLen) / sLen))) * e;
    const krLi = kv === -1 ? wave(s, kEnv[i]) : 0, krRi = kv === 1 ? wave(s, kEnv[i]) : 0;
    const krLj = kvj === -1 ? wave(s2k, kEnv[j]) : 0, krRj = kvj === 1 ? wave(s2k, kEnv[j]) : 0;
    const inRamp = tr.ramps.some((r) => s >= r.s0 && s < r.s0 + r.len);
    const stripeN = Math.floor(s / sLen), stripe = stripeN % 2 === 0;

    for (let b = 0; b < 15; b++) {
      const [l0, y0i] = lat(b, hi, eoI, krLi, krRi, GW, hwI, KWI, brI), [l1, y1i] = lat(b + 1, hi, eoI, krLi, krRi, GW, hwI, KWI, brI);
      const [l0j, y0j] = lat(b, hj, eoJ, krLj, krRj, GWj, hwJ, KWJ, brJ), [l1j, y1j] = lat(b + 1, hj, eoJ, krLj, krRj, GWj, hwJ, KWJ, brJ);

      const P = (idx, l, y) => {
        const posX = tr.X[idx], posZ = tr.Z[idx];
        const nx = -tr.TZ[idx], nz = tr.TX[idx];
        const bnk = (Math.abs(l) <= L ? l * Math.tan(tr.bank[idx]) : (l > 0 ? 1 : -1) * L * Math.tan(tr.bank[idx]));
        return [posX + nx * l, y + bnk, posZ + nz * l];
      };

      const a = P(i, l0, y0i), bb = P(i, l1, y1i), c = P(j, l0j, y0j), d = P(j, l1j, y1j);
      let color;
      let outerColor = null;

      if (brI && (b <= 2 || b >= 12)) {
        color = cConcrete; outerColor = cConcrete;
      } else if (b === 0 || b === 14) {
        color = cGrass; outerColor = cDirt;
      } else if (b === 1 || b === 13) {
        color = tr.rg ? cGrass.clone().multiplyScalar(Math.floor(s / 14) % 2 ? 1 : 0.93) : cGrass;
      } else if (b === 2 || b === 12) {
        color = tr.rg ? cGravel.clone().multiplyScalar(0.92 + 0.08 * (((Math.sin(Math.floor(s / 3) * 5.31 + b) * 4375.5) % 1 + 1) % 1)) : cGrass;
      } else if (b === 3 || b === 4 || b === 5 || b === 9 || b === 10 || b === 11) {
        const hasKerb = b < 6 ? kv === -1 : kv === 1;
        const baseKerb = isKart
          ? (stripe ? col(0xee2c2c) : col(0xffffff))
          : (kset ? kset[stripeN % 3] : (stripe ? k1 : k2));
        let kShaded = isKart ? baseKerb.clone() : wornC(baseKerb, stripeN).lerp(cRoad2, 1 - kEnv[i]);
        if (b === 4 || b === 10) kShaded.multiplyScalar(isKart ? 1.0 : 1.08);
        else if (b === 3 || b === 11) kShaded.multiplyScalar(isKart ? 0.9 : 0.72);
        color = th.noKerbs ? cGrass : hasKerb ? kShaded : (tr.rg ? cGravel : cRoad2);
      } else {
        if (isKart) {
          const isStraight = Math.abs(tr.kap[i]) < 0.007;
          color = isStraight
            ? (Math.floor(s / 3.4) % 2 === 0 ? col(0x545863) : col(0x363941))
            : col(0x363941);
        } else {
          color = Math.floor(s / 24) % 2 ? cRoad : cRoad2;
          if (wetZone) { const rk = rainAt(tr, s); if (rk > 0.02) color = color.clone().lerp(cWet, 0.5 * rk).multiplyScalar(1 - 0.28 * rk); }
          const zn = zoneAt(tr, s);
          if (zn && zn.w > 0.5 && zn.key !== 'asphalt') {
            const zc = SURF[zn.key].col;
            if (zc != null) color = col(zc).multiplyScalar(Math.floor(s / 6) % 2 ? 1 : 0.93);
          }
          if (inRamp) color = Math.floor(s / 1.5) % 2 ? yel : blk;
        }
      }

      const s2 = (i + effectiveStride) * tr.ds, K = 1 / 5;
      let target;
      if (b >= 6 && b <= 8) target = roadData;
      else if ((b >= 3 && b <= 5) || (b >= 9 && b <= 11)) target = kerbData;
      else if (b === 2 || b === 12) target = gravelData;
      else target = edgeData;

      pushQuad(target, a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], d[0], d[1], d[2], color, [l0 * K, s * K, l1 * K, s * K, l0j * K, s2 * K, l1j * K, s2 * K], outerColor || color);
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
  const rTex = isKart ? marioTarmacTex() : asphaltTex(th);

  let roadRough = 0.76, roadMetal = 0.01, envInt = 0.28;
  if (isKart) {
    roadRough = 0.85; roadMetal = 0.01; envInt = 0.15;
  } else if (th.id === 'spa') {
    roadRough = 0.68; roadMetal = 0.01; envInt = 0.3;
  } else if (th.id === 'neon') {
    roadRough = 0.40; roadMetal = 0.05; envInt = 0.88;
  } else if (th.id === 'nieve') {
    roadRough = 0.68; roadMetal = 0.04; envInt = 0.55;
  } else if (th.id === 'desierto') {
    roadRough = 0.88; roadMetal = 0.01; envInt = 0.16;
  } else if (th.id === 'monaco') {
    roadRough = 0.74; roadMetal = 0.02; envInt = 0.32;
  } else if (th.id === 'amazonas') {
    roadRough = 0.58; roadMetal = 0.02; envInt = 0.46; // selva húmeda: asfalto con brillo suave del cielo
  } else if (th.id === 'valle') {
    roadRough = 0.7; roadMetal = 0.02; envInt = 0.34;
  }

  const roadMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    roughness: roadRough, metalness: roadMetal, envMapIntensity: envInt, map: rTex
  });

  const kerbMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    roughness: isKart ? 0.45 : 0.68, metalness: 0.02,
    map: isKart ? null : kerbTex(), envMapIntensity: 0.22, flatShading: isKart
  });

  const gravelMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.95, metalness: 0.01, map: gravelTex()
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    roughness: 0.92, metalness: 0.01
  });

  const group = new THREE.Group();
  for (const [data, mat] of [
    [roadData, roadMaterial],
    [kerbData, kerbMaterial],
    [gravelData, gravelMaterial],
    [edgeData, edgeMaterial]
  ]) {
    if (data.pos.length) {
      const mesh = new THREE.Mesh(geometry(data), mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Líneas dobles pintadas en los bordes para Mario Circuit (amarilla interior, blanca exterior)
  if (isKart) {
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffd000, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f7fa, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const side of [-1, 1]) {
      const yLine = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, side * (ROAD_HALF - 0.32) - 0.12, side * (ROAD_HALF - 0.32) + 0.12, 0.04), yellowMat);
      const wLine = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, side * (ROAD_HALF - 0.08) - 0.12, side * (ROAD_HALF - 0.08) + 0.12, 0.04), whiteMat);
      yLine.frustumCulled = wLine.frustumCulled = false;
      group.add(yLine, wLine);
    }
  }

  return group;
}

let marioBlockGeoCache = null;
function getMarioBlockGeo() {
  if (marioBlockGeoCache) return marioBlockGeoCache;
  const boxPart = new THREE.BoxGeometry(1.6, 0.95, 1.6).toNonIndexed();
  boxPart.translate(0, 0.475, 0);
  const pyrPart = new THREE.CylinderGeometry(0.68, 1.13, 0.35, 4).toNonIndexed();
  pyrPart.rotateY(Math.PI / 4);
  pyrPart.translate(0, 1.125, 0);
  const posA = boxPart.attributes.position.array, posB = pyrPart.attributes.position.array;
  const combinedPos = new Float32Array(posA.length + posB.length);
  combinedPos.set(posA, 0); combinedPos.set(posB, posA.length);
  marioBlockGeoCache = new THREE.BufferGeometry();
  marioBlockGeoCache.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));
  marioBlockGeoCache.computeVertexNormals();
  return marioBlockGeoCache;
}

function marioTrackBlocks(tr, th) {
  const N = tr.N, L = WALL;
  const step = 1.75;
  const blockCountPerSide = Math.floor(tr.len / step);
  const totalBlocks = blockCountPerSide * 2;

  const blockGeo = getMarioBlockGeo();
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.42, metalness: 0.05, flatShading: true
  });
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, totalBlocks);
  const dummy = new THREE.Object3D(), pal = [0xe52521, 0x1b75d0, 0x2bb830, 0xf8d028].map(col);

  let k = 0;
  for (const side of [-1, 1]) {
    for (let idx = 0; idx < blockCountPerSide; idx++) {
      const s = idx * step;
      const i = Math.floor((s / tr.ds)) % N;
      const tx = tr.TX[i], tz = tr.TZ[i];
      const nx = -tz * side, nz = tx * side;
      const x = tr.X[i] + nx * L, z = tr.Z[i] + nz * L;
      const y = tr.Y[i] + bankOff(tr, i, side * L);
      const heading = Math.atan2(tx, tz);

      dummy.position.set(x, y, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, heading, 0);
      dummy.updateMatrix();
      blocks.setMatrixAt(k, dummy.matrix);
      blocks.setColorAt(k, pal[(idx + (side > 0 ? 2 : 0)) % pal.length]);
      k++;
    }
  }
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  blocks.castShadow = false;
  blocks.receiveShadow = true;
  blocks.frustumCulled = false;
  return blocks;
}

function wallMesh(tr, th, stride = 1) {
  const N = tr.N, L = WALL;
  const isKart = th.deco === 'kart';
  if (isKart) {
    return marioTrackBlocks(tr, th);
  }

  const pos = [], colors = [], uvs = [];
  const c1 = col(th.wall1), c2 = col(th.wall2);
  const H = 0.65, T = 0.45;

  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i += stride) {
      const j = (i + stride) % N, s = i * tr.ds;
      const c = Math.floor(s / 6) % 2 ? c1 : c2;
      const P = (idx, l, y) => [tr.X[idx] + -tr.TZ[idx] * l * side, y + bankOff(tr, idx, l * side), tr.Z[idx] + tr.TX[idx] * l * side];
      const a0 = P(i, L, tr.Y[i] - 0.05), a1 = P(i, L, tr.Y[i] + H), b0 = P(j, L, tr.Y[j] - 0.05), b1 = P(j, L, tr.Y[j] + H);
      const t0 = P(i, L + T, tr.Y[i] + H), t1 = P(j, L + T, tr.Y[j] + H);
      const quad = (p, q, r, s2, u0, u1) => {
        pos.push(...p, ...r, ...q, ...q, ...r, ...s2);
        for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b);
        uvs.push(u0, 0, u1, 0, u0, 1, u0, 1, u1, 0, u1, 1);
      };
      const u0 = (s / 4) % 1, u1 = ((s + stride * tr.ds) / 4) % 1;
      quad(a0, a1, b0, b1, u0, u1);
      quad(a1, t0, b1, t1, u0, u1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();

  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: armcoTex(), roughness: 0.38, metalness: 0.72,
    side: THREE.DoubleSide, envMapIntensity: 0.55
  });

  const mesh = new THREE.Mesh(g, wallMat);
  return mesh;
}

function marioArena(th, scene, shadows) {
  const minX = -135, maxX = 135, minZ = -135, maxZ = 135;
  const sandGeo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2);
  const sandMesh = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ color: th.dirt, roughness: 0.95 }));
  sandMesh.position.set((minX + maxX) * 0.5, 0.012, (minZ + maxZ) * 0.5);
  sandMesh.receiveShadow = shadows;
  scene.add(sandMesh);

  // Zonas de césped interiores en los bucles abiertos (distancia segura > 12m de la carretera)
  const safeInfields = [
    { x: -70, z: -62, w: 42, d: 26 },
    { x: -24, z: -18, w: 64, d: 12 },
    { x: -72, z: 74, w: 38, d: 34 },
    { x: 60, z: 10, w: 42, d: 88 },
  ];
  const grassMat = new THREE.MeshStandardMaterial({ color: th.grass, roughness: 0.9 });
  for (const isl of safeInfields) {
    const islMesh = new THREE.Mesh(new THREE.PlaneGeometry(isl.w, isl.d).rotateX(-Math.PI / 2), grassMat);
    islMesh.position.set(isl.x, 0.02, isl.z);
    islMesh.receiveShadow = shadows;
    scene.add(islMesh);
  }

  // Muro perimetral exterior del estadio con bloques 3D
  const step = 1.8;
  const pts = [];
  for (let x = minX; x <= maxX; x += step) { pts.push([x, minZ]); pts.push([x, maxZ]); }
  for (let z = minZ; z <= maxZ; z += step) { pts.push([minX, z]); pts.push([maxX, z]); }

  const blockGeo = getMarioBlockGeo();
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, flatShading: true });
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, pts.length);
  const dummy = new THREE.Object3D(), pal = [0xe52521, 0x1b75d0, 0x2bb830, 0xf8d028].map(col);

  pts.forEach(([px, pz], k) => {
    dummy.position.set(px, 0, pz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    blocks.setMatrixAt(k, dummy.matrix);
    blocks.setColorAt(k, pal[k % pal.length]);
  });
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  blocks.castShadow = false;
  blocks.receiveShadow = shadows;
  blocks.frustumCulled = false;
  scene.add(blocks);
}

function marioPipes(scene, shadows) {
  const pipeSpots = [
    [68, 30], [68, -30], [-40, -18], [-70, -18],
    [-62, 78], [98, -100], [-114, 114], [-108, -100]
  ];
  const count = pipeSpots.length;
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1db82a, roughness: 0.38, metalness: 0.08 });
  const darkRimMat = new THREE.MeshStandardMaterial({ color: 0x07280d, roughness: 0.8, metalness: 0.02 });

  const baseGeo = new THREE.CylinderGeometry(0.9, 0.9, 2.2, 18).translate(0, 1.1, 0);
  const lipGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.58, 18).translate(0, 2.15, 0);
  const capGeo = new THREE.CircleGeometry(0.92, 18).rotateX(-Math.PI / 2).translate(0, 2.42, 0);

  const baseMesh = new THREE.InstancedMesh(baseGeo, pipeMat, count);
  const lipMesh = new THREE.InstancedMesh(lipGeo, pipeMat, count);
  const capMesh = new THREE.InstancedMesh(capGeo, darkRimMat, count);

  const d = new THREE.Object3D();
  pipeSpots.forEach((sp, idx) => {
    d.position.set(sp[0], 0, sp[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();

    baseMesh.setMatrixAt(idx, d.matrix);
    lipMesh.setMatrixAt(idx, d.matrix);
    capMesh.setMatrixAt(idx, d.matrix);
  });

  baseMesh.castShadow = lipMesh.castShadow = false;
  baseMesh.receiveShadow = lipMesh.receiveShadow = shadows;
  baseMesh.frustumCulled = lipMesh.frustumCulled = capMesh.frustumCulled = false;
  scene.add(baseMesh); scene.add(lipMesh); scene.add(capMesh);
}

let marioBrickTextureCache = null;
function marioBrickTex() {
  if (marioBrickTextureCache) return marioBrickTextureCache;
  const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b84418'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#2b1008';
  ctx.fillRect(0, 0, size, 2); ctx.fillRect(0, 16, size, 2); ctx.fillRect(0, 32, size, 2); ctx.fillRect(0, 48, size, 2); ctx.fillRect(0, 62, size, 2);
  for (let r = 0; r < 4; r++) {
    const y = r * 16 + 2;
    const shift = (r % 2 === 0) ? 0 : 16;
    for (let x = shift; x < size; x += 32) ctx.fillRect(x, y, 2, 14);
  }
  ctx.fillStyle = '#e57a44';
  for (let r = 0; r < 4; r++) {
    const y = r * 16 + 2;
    ctx.fillRect(0, y, size, 2);
  }
  marioBrickTextureCache = new THREE.CanvasTexture(canvas);
  marioBrickTextureCache.magFilter = THREE.NearestFilter;
  marioBrickTextureCache.minFilter = THREE.NearestFilter;
  marioBrickTextureCache.colorSpace = THREE.SRGBColorSpace;
  return marioBrickTextureCache;
}

let marioQuestionTextureCache = null;
function marioQuestionTex() {
  if (marioQuestionTextureCache) return marioQuestionTextureCache;
  const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fc9838'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#421a08'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 60, 60);
  ctx.fillStyle = '#421a08';
  ctx.fillRect(6, 6, 4, 4); ctx.fillRect(54, 6, 4, 4); ctx.fillRect(6, 54, 4, 4); ctx.fillRect(54, 54, 4, 4);
  ctx.font = '900 44px "Jersey 10",Impact,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1205'; ctx.fillText('?', 34, 34);
  ctx.fillStyle = '#ffffff'; ctx.fillText('?', 32, 32);
  marioQuestionTextureCache = new THREE.CanvasTexture(canvas);
  marioQuestionTextureCache.magFilter = THREE.NearestFilter;
  marioQuestionTextureCache.minFilter = THREE.NearestFilter;
  marioQuestionTextureCache.colorSpace = THREE.SRGBColorSpace;
  return marioQuestionTextureCache;
}

function marioProps(scene, shadows) {
  const brickMat = new THREE.MeshStandardMaterial({ map: marioBrickTex(), roughness: 0.85, metalness: 0.05 });
  const qMat = new THREE.MeshStandardMaterial({ map: marioQuestionTex(), roughness: 0.45, metalness: 0.08 });
  const boxGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);

  const brickSpots = [];
  const qSpots = [];
  // Column behind right finish arch post: x ~ 113.5, z ~ 11 (clear distance > 10.7m from track)
  for (let h = 0; h < 4; h++) brickSpots.push([113.5, 1.0 + h * 2.0, 11]);
  for (let h = 0; h < 3; h++) brickSpots.push([113.5, 1.0 + h * 2.0, 8.5]);

  // Floating row in the northern infield: 2 bricks, 1 ?, 2 bricks
  const rowZ = -60;
  for (let i = -2; i <= 2; i++) {
    const x = -30 + i * 2.1;
    if (i === 0) qSpots.push([x, 4.5, rowZ]);
    else brickSpots.push([x, 4.5, rowZ]);
  }

  // Floating row in the center infield (safe distance > 19m from track):
  for (let i = -1; i <= 1; i++) {
    const x = -20 + i * 2.1;
    if (i === 0) qSpots.push([x, 4.0, -18]);
    else brickSpots.push([x, 4.0, -18]);
  }

  // Column in the western sand:
  for (let i = 0; i < 3; i++) {
    brickSpots.push([-115, 1.0 + i * 2.0, 25]);
  }

  const dummy = new THREE.Object3D();
  if (brickSpots.length) {
    const brickMesh = new THREE.InstancedMesh(boxGeo, brickMat, brickSpots.length);
    brickSpots.forEach((p, idx) => {
      dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      brickMesh.setMatrixAt(idx, dummy.matrix);
    });
    brickMesh.castShadow = false;
    brickMesh.receiveShadow = shadows;
    brickMesh.frustumCulled = false;
    scene.add(brickMesh);
  }

  if (qSpots.length) {
    const qMesh = new THREE.InstancedMesh(boxGeo, qMat, qSpots.length);
    qSpots.forEach((p, idx) => {
      dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      qMesh.setMatrixAt(idx, dummy.matrix);
    });
    qMesh.castShadow = false;
    qMesh.receiveShadow = shadows;
    qMesh.frustumCulled = false;
    scene.add(qMesh);
  }
}

function marioArrows(tr, scene) {
  const arrowS = [
    tr.len * 0.08,
    tr.len * 0.28,
    tr.len * 0.52,
    tr.len * 0.76
  ];
  const arrowMat = new THREE.MeshBasicMaterial({
    map: marioArrowTex(),
    transparent: true,
    opacity: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    side: THREE.DoubleSide
  });

  for (const s of arrowS) {
    const mesh = new THREE.Mesh(stripGeom(tr, s, s + 4.5, -2.2, 2.2, 0.045), arrowMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}

function distanceMarkers(tr, th, scene) {
  if (th.deco === 'kart') return;
  const N = tr.N;
  const zones = [];
  let lastS = -100;
  for (let i = 40; i < N - 40; i += 10) {
    const ak = Math.abs(tr.kap[i]);
    const s = i * tr.ds;
    if (ak > 0.013 && s - lastS > 90) {
      const iPrev = Math.max(0, i - Math.round(60 / tr.ds));
      if (Math.abs(tr.kap[iPrev]) < 0.007) {
        zones.push({ i, s, side: tr.kap[i] > 0 ? -1 : 1 });
        lastS = s;
      }
    }
  }
  if (!zones.length) return;

  const distances = [200, 150, 100, 50];
  const boardGeo = new THREE.PlaneGeometry(1.1, 0.60);
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7c838d, metalness: 0.8, roughness: 0.35 });

  const dummy = new THREE.Object3D();
  for (const dist of distances) {
    const tex = distanceBoardTex(dist);
    const boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const boards = new THREE.InstancedMesh(boardGeo, boardMat, zones.length);
    const posts = new THREE.InstancedMesh(postGeo, postMat, zones.length);

    zones.forEach((z, idx) => {
      const sMarker = Math.max(0, z.s - dist * 0.4);
      const iM = Math.floor(sMarker / tr.ds) % N;
      const tx = tr.TX[iM], tz = tr.TZ[iM];
      const side = z.side;
      const nx = -tz * side, nz = tx * side;
      const x = tr.X[iM] + nx * (WALL + 0.45), zPos = tr.Z[iM] + nz * (WALL + 0.45);
      const y = tr.Y[iM] + bankOff(tr, iM, side * (WALL + 0.45));
      const heading = Math.atan2(tx, tz);

      dummy.position.set(x, y + 0.50, zPos);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, heading + Math.PI, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x - nx * 0.03, y + 0.90, zPos - nz * 0.03);
      dummy.rotation.set(0, heading + Math.PI, 0);
      dummy.updateMatrix();
      boards.setMatrixAt(idx, dummy.matrix);
    });

    boards.frustumCulled = posts.frustumCulled = false;
    scene.add(posts);
    scene.add(boards);
  }
}

function createFoamWedgeGeometry() {
  const W = 0.55, H = 0.36, L2 = 1.6;
  const pos = [
    // Rampa frontal inclinada (cara principal donde va el logo con 32 grados de elevación)
    0, 0.02, -L2,   W, H, -L2,   0, 0.02, L2,
    0, 0.02, L2,    W, H, -L2,   W, H, L2,
    // Cara trasera vertical
    W, 0, -L2,      W, 0, L2,    W, H, -L2,
    W, H, -L2,      W, 0, L2,    W, H, L2,
    // Base inferior
    0, 0, -L2,      W, 0, -L2,   0, 0, L2,
    0, 0, L2,       W, 0, -L2,   W, 0, L2,
    // Tapón lateral 1 (Z = -L2)
    0, 0.02, -L2,   W, 0, -L2,   W, H, -L2,
    // Tapón lateral 2 (Z = +L2)
    0, 0.02, L2,    W, H, L2,    W, 0, L2,
  ];
  const uvs = [
    // Rampa frontal
    0.02, 0.04,   0.02, 0.96,   0.98, 0.04,
    0.98, 0.04,   0.02, 0.96,   0.98, 0.96,
    // Trasera
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
    // Base
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
    // Tapón 1
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
    // Tapón 2
    0.02, 0.02,   0.02, 0.02,   0.02, 0.02,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

// Marca local por circuito (rótulo en las barreras junto a los patrocinadores globales)
const LOCAL_BRANDS = {
  pruebas: ['ESTRELLA GALICIA', '#c8102e', '#ffffff'], monaco: ['HÔTEL DE PARIS', '#0b1f3a', '#e8c872'], spa: ['SPA MONOPOLE', '#0a4d8c', '#ffffff'],
  valle: ['GUARANÁ ANTARCTICA', '#0a7a3c', '#ffe14d'], desierto: ['TEQUILA SAUZA', '#7a2a0a', '#ffd166'], neon: ['ASAHI SUPER DRY', '#101820', '#f2f2f2'],
  nieve: ['RICOLA', '#00873c', '#ffffff'], amazonas: ['INCA KOLA', '#f6c600', '#c8102e'], karting: ['KARTING CLUB', '#d91e18', '#ffffff'],
};
const localBrandCache = {};
function localBrandTex(th) {
  const b = LOCAL_BRANDS[th.id]; if (!b || typeof document === 'undefined') return null;
  if (localBrandCache[th.id]) return localBrandCache[th.id];
  const c = document.createElement('canvas'); c.width = 1536; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = b[1]; x.fillRect(0, 0, 1536, 128); x.fillStyle = b[2]; x.fillRect(0, 0, 1536, 8); x.fillRect(0, 120, 1536, 8);
  x.font = '900 84px "Jersey 10",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const cx of [384, 1152]) x.fillText(b[0], cx, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; localBrandCache[th.id] = t; return t;
}
function sponsorBarrierDecals(tr, th, scene) {
  if (th.deco === 'kart') return;
  const N = tr.N;
  const sections = [];
  const minSpacing = 38;
  let lastS = -50;
  for (let s = 25; s < tr.len - 30; s += 16) {
    const i = Math.floor(s / tr.ds) % N;
    if (Math.abs(tr.kap[i]) < 0.0055 && s - lastS >= minSpacing) {
      if ((tr.tunnels || []).some((t) => s > t.s0 - 6 && s < t.s1 + 6)) continue;
      sections.push({ s0: s, s1: s + 12.0, brandIdx: Math.floor(s / 32) % (localBrandTex(th) ? 5 : 4) });
      lastS = s;
    }
  }
  if (!sections.length) return;

  for (let b = 0; b < 5; b++) {
    const group = sections.filter((sec) => sec.brandIdx === b);
    if (!group.length) continue;
    const tex = b === 4 ? localBrandTex(th) : getSponsorTexture(b);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.35,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.8,
      polygonOffsetUnits: -1.8,
    });

    const pos = [], uvs = [], idx = [];
    let vOffset = 0;

    for (const sec of group) {
      const stepN = Math.max(2, Math.round((sec.s1 - sec.s0) / tr.ds));
      for (const side of [-1, 1]) {
        const baseV = vOffset;
        for (let k = 0; k <= stepN; k++) {
          const s = sec.s0 + (k / stepN) * (sec.s1 - sec.s0);
          const f = (((s / tr.ds) % N) + N) % N;
          const i = Math.floor(f), j = (i + 1) % N, t = f - i;
          const tx = tr.TX[i] + (tr.TX[j] - tr.TX[i]) * t;
          const tz = tr.TZ[i] + (tr.TZ[j] - tr.TZ[i]) * t;
          const tl = Math.hypot(tx, tz) || 1;
          const nx = -tz / tl, nz = tx / tl;
          const xCenter = tr.X[i] + (tr.X[j] - tr.X[i]) * t;
          const zCenter = tr.Z[i] + (tr.Z[j] - tr.Z[i]) * t;
          const yCenter = tr.Y[i] + (tr.Y[j] - tr.Y[i]) * t;

          const lat = side * (WALL - 0.015);
          const px = xCenter + nx * lat;
          const pz = zCenter + nz * lat;
          const py = yCenter + bankOff(tr, i, lat);

          // Puntos inferior y superior del decal en la cara vertical del guardarraíl
          pos.push(px, py + 0.08, pz);
          pos.push(px, py + 0.58, pz);

          const u = (k / stepN) * (b === 4 ? 1.0 : 2.0); // 2 repeticiones del logo por tramo de 12 m (la marca local lleva 2 rótulos en su textura)
          uvs.push(u, 0.0, u, 1.0);
          vOffset += 2;
        }
        for (let k = 0; k < stepN; k++) {
          const a = baseV + k * 2;
          if (side === 1) {
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          } else {
            idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}

function sponsorFoamWedges(tr, th, scene) {
  if (th.deco === 'kart') return;
  const N = tr.N;
  const wedges = [];
  const minSpacing = 42;
  let lastS = -60;
  for (let s = 30; s < tr.len - 35; s += 18) {
    const i = Math.floor(s / tr.ds) % N;
    if (s - lastS >= minSpacing) {
      if ((tr.tunnels || []).some((t) => s > t.s0 - 6 && s < t.s1 + 6)) continue;
      const brandIdx = Math.floor(s / 36) % 4;
      // Posicionados a los lados en el arcén/borde de pista
      const side = (Math.floor(s / 24) % 2 === 0 ? 1 : -1);
      wedges.push({ s, i, side, brandIdx });
      lastS = s;
    }
  }
  if (!wedges.length) return;

  const wedgeGeo = createFoamWedgeGeometry();
  const dummy = new THREE.Object3D();

  for (let b = 0; b < 4; b++) {
    const group = wedges.filter((w) => w.brandIdx === b);
    if (!group.length) continue;
    const tex = getSponsorTexture(b);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.48,
      metalness: 0.12,
    });
    const mesh = new THREE.InstancedMesh(wedgeGeo, mat, group.length);

    group.forEach((w, idx) => {
      const i = w.i;
      const tx = tr.TX[i], tz = tr.TZ[i];
      const heading = Math.atan2(tx, tz);
      const side = w.side;
      // Asentada en el suelo del arcén (WALL - 0.65m), de perfil bajo (0.36m alto)
      const lat = side * (WALL - 0.65);
      const x = tr.X[i] + -tz * lat;
      const zPos = tr.Z[i] + tx * lat;
      const y = tr.Y[i] + bankOff(tr, i, lat);

      dummy.position.set(x, y + 0.01, zPos);
      dummy.scale.set(side > 0 ? 1 : -1, 1, 1);
      dummy.rotation.set(0, heading + Math.PI, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    });

    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function motorsportAmbiance(tr, th, scene, q) {
  if (th.deco === 'kart') return;
  const N = tr.N;

  // 1. Pórtico de salida/meta elevado sobre la pista en s = 0
  const gantryPillars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.38, 6.8, 0.38).translate(0, 3.4, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.85, roughness: 0.28 }),
    2
  );
  const dummy = new THREE.Object3D();
  const tx0 = tr.TX[0], tz0 = tr.TZ[0];
  const heading0 = Math.atan2(tx0, tz0);

  for (let sIdx = 0; sIdx < 2; sIdx++) {
    const side = sIdx === 0 ? -1 : 1;
    const lat = side * (WALL + 0.65);
    const px = tr.X[0] + -tz0 * lat, pz = tr.Z[0] + tx0 * lat;
    const py = tr.Y[0] + bankOff(tr, 0, lat);
    dummy.position.set(px, py - 0.2, pz);
    dummy.rotation.set(0, heading0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    gantryPillars.setMatrixAt(sIdx, dummy.matrix);
  }
  gantryPillars.castShadow = !!q.shadows;
  scene.add(gantryPillars);

  // Viga transversal del pórtico
  const span = (WALL + 0.65) * 2 + 0.6;
  const beamGeo = new THREE.BoxGeometry(span, 0.58, 0.72);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x343c46, metalness: 0.8, roughness: 0.3 });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.set(tr.X[0], tr.Y[0] + 6.3, tr.Z[0]);
  beamMesh.rotation.set(0, heading0 + Math.PI / 2, 0);
  beamMesh.castShadow = !!q.shadows;
  scene.add(beamMesh);

  // Semáforo de salida: 5 luces rojas bajo el pórtico
  const lightHousing = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.42, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 })
  );
  lightHousing.position.set(tr.X[0], tr.Y[0] + 5.65, tr.Z[0]);
  lightHousing.rotation.set(0, heading0 + Math.PI / 2, 0);
  scene.add(lightHousing);

  const startLightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12).rotateX(Math.PI / 2);
  const redLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1a1a,
    emissive: 0xff0000,
    emissiveIntensity: 0.9,
    roughness: 0.2
  });
  const startLights = new THREE.InstancedMesh(startLightGeo, redLightMat, 5);
  for (let k = 0; k < 5; k++) {
    const xOff = (k - 2) * 0.52;
    const lx = tr.X[0] - tz0 * xOff, lz = tr.Z[0] + tx0 * xOff;
    dummy.position.set(lx, tr.Y[0] + 5.65, lz);
    dummy.rotation.set(0, heading0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    startLights.setMatrixAt(k, dummy.matrix);
  }
  scene.add(startLights);

  // 2. Gran tribuna principal de espectadores a lo largo de la recta principal (s = 18 a 68)
  const standLength = 52, standTiers = 6, standTierDepth = 0.72, standTierH = 0.42;
  const sMid = 44;
  const iMid = Math.floor(sMid / tr.ds) % N;
  const txM = tr.TX[iMid], tzM = tr.TZ[iMid];
  const headingM = Math.atan2(txM, tzM);
  const standLat = WALL + 4.2;
  const standX = tr.X[iMid] + -tzM * standLat;
  const standZ = tr.Z[iMid] + txM * standLat;
  const standY = tr.Y[iMid] + bankOff(tr, iMid, standLat);

  // Gradas escalonadas en 1 sola geometría optimizada
  const bleachersGroup = new THREE.Group();
  bleachersGroup.position.set(standX, standY, standZ);
  bleachersGroup.rotation.set(0, headingM, 0);

  const concMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.88 });
  const bleacherGeos = [];
  for (let t = 0; t < standTiers; t++) {
    const tierGeo = new THREE.BoxGeometry(standTierDepth, standTierH * (t + 1), standLength);
    tierGeo.translate(t * standTierDepth, (standTierH * (t + 1)) * 0.5, 0);
    bleacherGeos.push(tierGeo);
  }
  const bleachersMesh = new THREE.Mesh(mergeBufferGeometries(bleacherGeos), concMat);
  bleachersMesh.receiveShadow = !!q.shadows;
  bleachersMesh.castShadow = false;
  bleachersGroup.add(bleachersMesh);

  // Techo cubierta volada sobre la tribuna (proyecta la sombra principal sobre toda la grada)
  const roofMesh = new THREE.Mesh(
    new THREE.BoxGeometry(standTiers * standTierDepth + 1.2, 0.22, standLength + 2.0),
    new THREE.MeshStandardMaterial({ color: 0x3d444e, metalness: 0.65, roughness: 0.4 })
  );
  roofMesh.position.set((standTiers * standTierDepth) * 0.45, standTiers * standTierH + 2.5, 0);
  roofMesh.rotation.set(0, 0, 0.12);
  roofMesh.castShadow = !!q.shadows;
  bleachersGroup.add(roofMesh);

  // Asientos coloridos de espectadores (rojo, azul, amarillo, blanco)
  const seatGeo = new THREE.BoxGeometry(0.38, 0.28, 0.35);
  const seatColors = [0xdf2626, 0x1e60c4, 0xf5b800, 0xf0f3f8].map(col);
  const seatMesh = new THREE.InstancedMesh(
    seatGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    standTiers * 28
  );
  let seatIdx = 0;
  for (let t = 0; t < standTiers; t++) {
    for (let r = 0; r < 28; r++) {
      const zSeat = (r - 13.5) * 1.8;
      dummy.position.set(t * standTierDepth + 0.12, standTierH * (t + 1) + 0.15, zSeat);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      seatMesh.setMatrixAt(seatIdx, dummy.matrix);
      seatMesh.setColorAt(seatIdx, seatColors[(t * 7 + r * 3) % seatColors.length]);
      seatIdx++;
    }
  }
  if (seatMesh.instanceColor) seatMesh.instanceColor.needsUpdate = true;
  seatMesh.castShadow = false;
  seatMesh.receiveShadow = !!q.shadows;
  bleachersGroup.add(seatMesh);
  scene.add(bleachersGroup);

  // 3. Muro de boxes (Pit Wall) en el lado interior de la recta principal
  const pitWallLength = 65;
  const pitLat = -(WALL + 0.35);
  const pitWallGeo = new THREE.BoxGeometry(0.42, 0.95, pitWallLength);
  const pitWallMat = new THREE.MeshStandardMaterial({ color: 0x767d86, roughness: 0.82 });
  const pitWallMesh = new THREE.Mesh(pitWallGeo, pitWallMat);
  pitWallMesh.position.set(tr.X[0] + -tz0 * pitLat, tr.Y[0] + bankOff(tr, 0, pitLat) + 0.48, tr.Z[0] + tx0 * pitLat);
  pitWallMesh.rotation.set(0, heading0, 0);
  pitWallMesh.receiveShadow = !!q.shadows;
  pitWallMesh.castShadow = false;
  scene.add(pitWallMesh);

  // Puestos de ingenieros en el muro de boxes (pit perches) con monitores
  const perchMat = new THREE.MeshStandardMaterial({ color: 0x1f242b, metalness: 0.7, roughness: 0.35 });
  const monitorMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00b4d8, emissiveIntensity: 0.6, roughness: 0.2 });
  for (let p = 0; p < 4; p++) {
    const sP = (p - 1.5) * 14;
    const px = (tr.X[0] + -tz0 * (pitLat - 0.65)) + tx0 * sP;
    const pz = (tr.Z[0] + tx0 * (pitLat - 0.65)) + tz0 * sP;
    const py = tr.Y[0] + bankOff(tr, 0, pitLat);
    const perch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 1.6), perchMat);
    perch.position.set(px, py + 0.7, pz);
    perch.rotation.set(0, heading0, 0);
    perch.receiveShadow = !!q.shadows;
    scene.add(perch);

    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.55), monitorMat);
    mon.position.set(px + tz0 * 0.48, py + 1.25, pz - tx0 * 0.48);
    mon.rotation.set(0, heading0, 0);
    scene.add(mon);
  }

  // 4. Puestos elevados de comisarios de pista (Marshal posts) en 4 curvas
  const marshalPositions = [
    Math.floor(N * 0.18),
    Math.floor(N * 0.42),
    Math.floor(N * 0.65),
    Math.floor(N * 0.88),
  ];
  const postHutGeo = new THREE.BoxGeometry(1.9, 1.6, 1.9);
  const hutMat = new THREE.MeshStandardMaterial({ color: 0xe5e8ec, roughness: 0.8 });
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x2264d8, roughness: 0.4 });
  const stiltsGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.8, 6);
  const stiltsMat = new THREE.MeshStandardMaterial({ color: 0x4d535b, metalness: 0.8, roughness: 0.3 });

  marshalPositions.forEach((mIdx) => {
    const tx = tr.TX[mIdx], tz = tr.TZ[mIdx];
    const heading = Math.atan2(tx, tz);
    const side = tr.kap[mIdx] > 0 ? 1 : -1;
    const mLat = side * (WALL + 3.2);
    const mx = tr.X[mIdx] + -tz * mLat;
    const mz = tr.Z[mIdx] + tx * mLat;
    const my = tr.Y[mIdx] + bankOff(tr, mIdx, mLat);

    const hut = new THREE.Mesh(postHutGeo, hutMat);
    hut.position.set(mx, my + 2.5, mz);
    hut.rotation.set(0, heading, 0);
    hut.receiveShadow = !!q.shadows;
    hut.castShadow = false;
    scene.add(hut);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.65, 4).rotateY(Math.PI / 4), hutRoofMat);
    roof.position.set(mx, my + 3.6, mz);
    roof.castShadow = !!q.shadows;
    scene.add(roof);

    for (const sx of [-0.75, 0.75]) {
      for (const sz of [-0.75, 0.75]) {
        const stilt = new THREE.Mesh(stiltsGeo, stiltsMat);
        stilt.position.set(mx + sx, my + 0.9, mz + sz);
        scene.add(stilt);
      }
    }
  });
}

function sponsorHoardings(tr, th, scene) {
  if (th.deco === 'kart') return;
  // 1. Envoltorios de patrocinadores integrados directamente en el guardarraíl
  sponsorBarrierDecals(tr, th, scene);
  // 2. Cuñas de espuma de perfil bajo en arcenes y escapatorias
  sponsorFoamWedges(tr, th, scene);
}

// tira que sigue la carretera (turbos y luces de neón)
const roadHalfAt = (tr) => (i, j, t) => (tr.hw ? tr.hw[i] + (tr.hw[j] - tr.hw[i]) * t : ROAD_HALF); // semianchura del asfalto en un punto
function stripGeom(tr, s0, s1, l0, l1, lift) {
  const pos = [], idx = [];
  const n = Math.max(2, Math.round((s1 - s0) / tr.ds));
  for (let k = 0; k <= n; k++) {
    const s = s0 + (k / n) * (s1 - s0), f = (((s / tr.ds) % tr.N) + tr.N) % tr.N, i = Math.floor(f), j = (i + 1) % tr.N, t = f - i;
    const tx = tr.TX[i] + (tr.TX[j] - tr.TX[i]) * t, tz = tr.TZ[i] + (tr.TZ[j] - tr.TZ[i]) * t, tl = Math.hypot(tx, tz);
    const nx = -tz / tl, nz = tx / tl, x = tr.X[i] + (tr.X[j] - tr.X[i]) * t, z = tr.Z[i] + (tr.Z[j] - tr.Z[i]) * t, y = tr.Y[i] + (tr.Y[j] - tr.Y[i]) * t + lift;
    const a0 = typeof l0 === 'function' ? l0(i, j, t) : l0, a1 = typeof l1 === 'function' ? l1(i, j, t) : l1; // el borde lateral puede depender del ancho de la pista en ese punto
    pos.push(x + nx * a0, y + bankOff(tr, i, a0), z + nz * a0, x + nx * a1, y + bankOff(tr, i, a1), z + nz * a1);
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

let oilTextureCache = null;
function oilTexture() {
  if (oilTextureCache) return oilTextureCache;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 14, 18, 0.98)');
  grad.addColorStop(0.48, 'rgba(18, 22, 28, 0.95)');
  grad.addColorStop(0.76, 'rgba(28, 25, 38, 0.92)');
  grad.addColorStop(0.88, 'rgba(20, 35, 30, 0.86)');
  grad.addColorStop(1, 'rgba(10, 10, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  oilTextureCache = new THREE.CanvasTexture(canvas);
  oilTextureCache.colorSpace = THREE.SRGBColorSpace;
  return oilTextureCache;
}

function marioBannerTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#111215'; x.fillRect(0, 0, 512, 128);
  const colors = ['#e52521', '#f8d028', '#1b75d0', '#2bb830'];
  const bw = 16, bh = 14;
  for (let i = 0; i < 32; i++) {
    x.fillStyle = colors[i % 4]; x.fillRect(i * bw, 0, bw - 1, bh);
    x.fillStyle = colors[(i + 1) % 4]; x.fillRect(i * bw, bh, bw - 1, bh);
    x.fillStyle = colors[(i + 2) % 4]; x.fillRect(i * bw, 128 - bh * 2, bw - 1, bh);
    x.fillStyle = colors[(i + 3) % 4]; x.fillRect(i * bw, 128 - bh, bw - 1, bh);
  }
  for (let j = 0; j < 5; j++) {
    x.fillStyle = colors[j % 4]; x.fillRect(0, 28 + j * bh, bw * 2, bh - 1);
    x.fillStyle = colors[(j + 2) % 4]; x.fillRect(512 - bw * 2, 28 + j * bh, bw * 2, bh - 1);
  }
  x.font = '900 62px "Jersey 10",Impact,"Arial Black",sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#b3171d';
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
    if (dx !== 0 || dy !== 0) x.fillText('MARIO KART', 256 + dx, 65 + dy);
  }
  x.fillStyle = '#ffd000';
  x.fillText('MARIO KART', 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function archMesh(tr, th) {
  const g = new THREE.Group();
  if (th.deco === 'kart') {
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.08 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.22, metalness: 0.65 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1d, roughness: 0.72, metalness: 0.04 });
    const bannerMat = new THREE.MeshBasicMaterial({ map: marioBannerTex() });
    const w = (WALL + 1.2) * 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, 0.5), bannerMat);
    beam.position.set(0, 8.2, 0); g.add(beam);
    for (const s of [-1, 1]) {
      const px = s * (WALL + 0.5);
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), baseMat);
      pedestal.position.set(px, 0.7, 0); g.add(pedestal);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 8.8, 16), postMat);
      p.position.set(px, 5.0, 0); g.add(p);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), goldMat);
      finial.position.set(px, 9.7, 0); g.add(finial);
    }
  } else {
    const post = new THREE.MeshLambertMaterial({ color: 0x2a2f3a, flatShading: true });
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(i * 16, j * 16, 16, 16); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const w = (WALL + 1.5) * 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
    beam.position.set(0, 9.2, 0);
    g.add(beam);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9.5, 1.2), post); p.position.set(s * (WALL + 0.6), 4.7, 0); g.add(p); }
  }
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
    x.fillStyle = '#f4f7ff'; x.font = '94px "Jersey 10",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
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
// Elementos de diseño del circuito: un puente de carretera que cruza la pista (campo) y torres de focos (noche).
// Cada pieza se comprueba contra el resto del trazado: si tocara otra parte de la pista, se omite.
function trackFeatures(tr, th, scene, q) {
  const N = tr.N, dummy = new THREE.Object3D();
  const offTrack = (x, z, r, skipFrom, skipTo) => { // true si el punto queda lejos de cualquier tramo del circuito fuera de [skipFrom, skipTo]
    for (let j = 0; j < N; j += 3) { const s = j * tr.ds; if (skipFrom != null && s > skipFrom && s < skipTo) continue; if ((tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < r * r) return false; }
    return true;
  };
  const tunnelAt = (s, pad) => (tr.tunnels || []).some((t) => s > t.s0 - pad && s < t.s1 + pad);
  if (th.id === 'valle' || th.id === 'desierto' || th.id === 'pruebas') { // puente de carretera sobre la pista, con pilares fuera de las vallas
    const i = Math.floor(N * 0.42), s = i * tr.ds, lx = -tr.TZ[i], lz = tr.TX[i]; // vector lateral
    const pad = WALL + 6, px = [tr.X[i] + lx * pad, tr.X[i] - lx * pad], pz = [tr.Z[i] + lz * pad, tr.Z[i] - lz * pad];
    const ok = !tunnelAt(s, 60) && px.every((x, k) => offTrack(x, pz[k], 4, s - 70, s + 70));
    if (ok) {
      const theta = Math.atan2(-tr.TX[i], -tr.TZ[i]), g = new THREE.Group();
      const concrete = new THREE.MeshStandardMaterial({ color: th.id === 'desierto' ? 0xc9b59a : 0xb7b5ad, roughness: 0.9 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(pad * 2 + 2, 1.1, 9), concrete); deck.position.set(0, 8.2, 0); deck.castShadow = !!q.shadows; deck.receiveShadow = true; g.add(deck);
      for (const sd of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(pad * 2 + 2, 0.9, 0.3), concrete); rail.position.set(0, 9.3, sd * 4.35); rail.castShadow = !!q.shadows; g.add(rail); }
      for (const sd of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.2, 2.6), concrete); pil.position.set(sd * pad, 4.1, 0); pil.castShadow = !!q.shadows; pil.receiveShadow = true; g.add(pil); }
      g.position.set(tr.X[i], tr.Y[i], tr.Z[i]); g.rotation.set(0, theta, 0);
      scene.add(g);
    }
  }
  if (th.night && th.id === 'neon') { // torres de focos a los lados de la pista: luz cálida en la noche
    const poles = [], heads = [];
    for (let s = 60; s < tr.len - 60; s += 150) {
      const i = Math.floor(s / tr.ds) % N, side = poles.length % 2 ? -1 : 1, l = WALL + 16;
      const x = tr.X[i] + -tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
      if (!offTrack(x, z, WALL + 8, s - 60, s + 60)) continue;
      poles.push([x, tr.Y[i], z]); heads.push([x, tr.Y[i] + 22, z, Math.atan2(tr.TX[i], tr.TZ[i]) + side * 0.6]);
    }
    if (poles.length) {
      const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 22, 0.9).translate(0, 11, 0), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.7, metalness: 0.4 }), poles.length);
      poles.forEach((p, k) => { dummy.position.set(p[0], p[1], p[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pm.setMatrixAt(k, dummy.matrix); });
      pm.frustumCulled = false; scene.add(pm);
      const hm = new THREE.InstancedMesh(new THREE.BoxGeometry(5.5, 1.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), heads.length);
      heads.forEach((h, k) => { dummy.position.set(h[0], h[1], h[2]); dummy.rotation.set(0, h[3], 0.35); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); hm.setMatrixAt(k, dummy.matrix); });
      hm.frustumCulled = false; scene.add(hm);
    }
  }
}
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
  const inst = (geo, mat, list, f, canCast = true) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, k) => { f(dummy, s); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
    m.frustumCulled = false; m.castShadow = canCast && !!q.shadows; m.receiveShadow = !!q.shadows; scene.add(m); return m;
  };
  const lam = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  if (th.deco === 'pine' || th.deco === 'snowpine') {
    const snow = th.deco === 'snowpine';
    const treeTransform = (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2] * s[5], s[2] * s[6], s[2] * s[5]); d.rotation.set(0, s[3], 0); };
    const trunk = inst(new THREE.CylinderGeometry(0.24, 0.44, 5.8, 12, 1).translate(0, 2.9, 0), lam(0x4c3524), spots, treeTransform, false);
    spots.forEach((_, k) => trunk.setColorAt(k, col(0x4c3524).multiplyScalar(0.78 + ((k * 19) % 8) * 0.055)));
    if (snow) {
      // Pinos alpinos con nieve acumulada: 4 niveles fusionados en 2 geometrías (ramas + nieve)
      const bTiers = [
        colorGeometry(new THREE.ConeGeometry(2.85, 3.6, 18, 1).translate(0, 3.6, 0), 0.72, 0.72, 0.72),
        colorGeometry(new THREE.ConeGeometry(2.32, 3.2, 18, 1).translate(0, 5.2, 0), 0.88, 0.88, 0.88),
        colorGeometry(new THREE.ConeGeometry(1.78, 2.8, 18, 1).translate(0, 6.6, 0), 1.04, 1.04, 1.04),
        colorGeometry(new THREE.ConeGeometry(1.18, 2.4, 18, 1).translate(0, 7.9, 0), 1.18, 1.18, 1.18),
      ];
      const sTiers = [
        new THREE.ConeGeometry(2.7, 1.4, 18).translate(0, 4.6, 0),
        new THREE.ConeGeometry(2.18, 1.3, 18).translate(0, 6.1, 0),
        new THREE.ConeGeometry(1.65, 1.2, 18).translate(0, 7.4, 0),
        new THREE.ConeGeometry(1.08, 1.1, 18).translate(0, 8.5, 0),
      ];
      const snowBoughGeo = mergeBufferGeometries(bTiers);
      const snowCapGeo = mergeBufferGeometries(sTiers);
      const bMesh = inst(snowBoughGeo, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), 0.9), spots, treeTransform, true);
      spots.forEach((_, k) => bMesh.setColorAt(k, col(th.treeCol).multiplyScalar(0.92 + ((k * 13) % 7) * 0.02)));
      if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;

      inst(snowCapGeo, new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.82 }), spots, treeTransform, false);
    } else {
      const conifers = spots.filter((s) => s[7] >= 0.48), deciduous = spots.filter((s) => s[7] < 0.48);
      // Pinos de alta definición: 4 niveles escalonados fusionados en 1 sola geometría y 1 solo draw call
      const cTiers = [
        colorGeometry(new THREE.ConeGeometry(2.85, 3.8, 18, 1).translate(0, 3.6, 0), 0.70, 0.70, 0.70),
        colorGeometry(new THREE.ConeGeometry(2.35, 3.4, 18, 1).translate(0, 5.2, 0), 0.85, 0.85, 0.85),
        colorGeometry(new THREE.ConeGeometry(1.80, 3.0, 18, 1).translate(0, 6.7, 0), 1.02, 1.02, 1.02),
        colorGeometry(new THREE.ConeGeometry(1.20, 2.6, 18, 1).translate(0, 8.1, 0), 1.18, 1.18, 1.18),
      ];
      const coniferCrownGeo = mergeBufferGeometries(cTiers);
      const coniferMesh = inst(coniferCrownGeo, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }), 0.9), conifers, treeTransform, true);
      conifers.forEach((_, k) => { coniferMesh.setColorAt(k, col(th.treeCol).multiplyScalar(0.9 + ((k * 17) % 9) * 0.018)); });
      if (coniferMesh.instanceColor) coniferMesh.instanceColor.needsUpdate = true;

      // Árboles caducifolios frondosos: 5 lóbulos esféricos fusionados en 1 sola geometría y 1 solo draw call
      const dSpheres = [
        colorGeometry(new THREE.SphereGeometry(1, 10, 7).scale(2.3, 2.1, 2.3).translate(0, 5.7, 0), 0.98, 0.98, 0.98),
        colorGeometry(new THREE.SphereGeometry(1, 8, 6).scale(1.7, 1.5, 1.7).translate(0, 4.7, 1.25), 0.86, 0.86, 0.86),
        colorGeometry(new THREE.SphereGeometry(1, 8, 6).scale(1.7, 1.5, 1.7).translate(0, 4.6, -1.25), 1.04, 1.04, 1.04),
        colorGeometry(new THREE.SphereGeometry(1, 8, 6).scale(1.6, 1.45, 1.6).translate(-1.3, 4.8, 0), 0.88, 0.88, 0.88),
        colorGeometry(new THREE.SphereGeometry(1, 8, 6).scale(1.6, 1.45, 1.6).translate(1.3, 4.8, 0), 1.06, 1.06, 1.06),
      ];
      const deciduousCrownGeo = mergeBufferGeometries(dSpheres);
      const deciduousMesh = inst(deciduousCrownGeo, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), 1.1), deciduous, treeTransform, true);
      deciduous.forEach((_, k) => {
        const autumnTint = (k * 11) % 7 === 0 ? 0.22 : 0;
        deciduousMesh.setColorAt(k, col(th.treeCol).lerp(col(0x777849), autumnTint).multiplyScalar(0.9 + ((k * 13) % 9) * 0.018));
      });
      if (deciduousMesh.instanceColor) deciduousMesh.instanceColor.needsUpdate = true;
    }
  } else if (th.deco === 'kart') {
    const trunks = inst(new THREE.CylinderGeometry(0.48, 0.62, 4.3, 10).translate(0, 2.15, 0), lam(0x82572f), spots, (d, s) => {
      d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0);
    }, false);
    const crowns = inst(new THREE.SphereGeometry(1, 12, 9).scale(2.8, 2.35, 2.65).translate(0, 5.1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots, (d, s) => {
      d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2] * s[5], s[2] * s[6], s[2] * s[5]); d.rotation.set(0, s[3], 0);
    }, true);
    spots.forEach((_, k) => crowns.setColorAt(k, col([0x38a438, 0x55ba3d, 0x2e8e40, 0x70c94a][k % 4])));
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  } else if (th.deco === 'cactus') {
    const half = spots.length >> 1;
    // Cactus saguaro de alta definición: tronco acanalado con 16 segmentos y dos brazos curvados
    inst(new THREE.CylinderGeometry(0.48, 0.58, 5.2, 16, 4).translate(0, 2.6, 0), cactusMat(), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2] * 1.1, s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 10).rotateZ(Math.PI / 2).translate(1.0, 3.2, 0), cactusMat(), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.26, 0.26, 1.8, 10).translate(1.9, 4.1, 0), cactusMat(), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.26, 0.26, 2.0, 10).rotateZ(-Math.PI / 2).translate(-0.9, 2.5, 0), cactusMat(), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    inst(new THREE.CylinderGeometry(0.24, 0.24, 1.6, 10).translate(-1.7, 3.3, 0), cactusMat(), spots.slice(0, half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); });
    // Rocas estratificadas del desierto
    inst(new THREE.IcosahedronGeometry(2.2, 1).translate(0, 1.0, 0), lam(0xa65f35), spots.slice(half), (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2] * 1.4, s[2] * 0.9, s[2] * 1.2); d.rotation.set(0, s[3], 0); });
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
    m.frustumCulled = false; m.castShadow = !!q.shadows; scene.add(m);
    const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb7aa96, roughness: 0.96 }), roofData.length);
    roofData.forEach((s, k) => {
      dummy.position.set(s.x, s.y, s.z); dummy.scale.set(s.w * 1.08, 0.45, s.w * 1.08); dummy.rotation.set(0, s.yaw, 0); dummy.updateMatrix(); roof.setMatrixAt(k, dummy.matrix);
    });
    roof.frustumCulled = false; roof.castShadow = !!q.shadows; scene.add(roof);
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
  if (th.deco === 'pine' || th.deco === 'toy' || th.deco === 'snowpine' || th.deco === 'kart') {
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
    const gm = inst(blade, new THREE.MeshStandardMaterial({ color, roughness: 0.96, side: THREE.DoubleSide }), bladeSpots, (d, s) => { d.position.set(s[0], s[4] || 0, s[1]); d.scale.set(s[2], s[2], s[2]); d.rotation.set(0, s[3], 0); }, false);
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
  } else if (th.deco === 'kart') {
    const geometry = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const mm = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color: 0xffffff }), mts.length);
    mts.forEach((s, k) => {
      dummy.position.set(s[0], -4, s[1]); dummy.scale.set(s[2] * 1.9, s[2] * 0.85, s[2] * 1.7); dummy.rotation.set(0, s[3], 0); dummy.updateMatrix();
      mm.setMatrixAt(k, dummy.matrix); mm.setColorAt(k, col([0x278f37, 0x3ca840, 0x56b541, 0x338c54][k % 4]));
    });
    if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
    mm.frustumCulled = false; mm.castShadow = false; scene.add(mm);
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
  outerDecor(tr, th, scene, rng, q, clearance, cxm, czm, R);
  return { cx: cxm, cz: czm, R, windMeshes };
}

// Elementos fuera de las vallas, según el paisaje de cada circuito: relieves, rocas, mesetas, cactus, bosques y pequeños poblados.
// Se añade después de la decoración existente, así que no altera la colocación de árboles ni montañas.
function outerDecor(tr, th, scene, rng, q, clearance, cxm, czm, R) {
  const id = th.id, dens = q.density, dummy = new THREE.Object3D();
  windLeaves.length = 0; // cada circuito construido empieza sin hojas de la carrera anterior
  // Amazonas: lagos junto a la pista. Se colocan antes que nada y el resto de elementos los esquiva
  const lakes = [];
  if (id === 'amazonas') {
    const base = clearance;
    for (let g = 0; lakes.length < (dens < 1 ? 3 : 4) && g < 300; g++) {
      const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, rx = 38 + rng() * 40, rz = 24 + rng() * 22, rmax = Math.max(rx, rz), l = WALL + 20 + rmax + rng() * 30;
      const x = tr.X[i] + -tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
      if (tr.Y[i] > 2.5) continue; // en terreno bajo
      if (!base(x, z, rmax + WALL + 6)) continue; // sin tocar ninguna parte del trazado
      if (lakes.some((k) => (k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + rmax + 20) ** 2)) continue;
      lakes.push({ x, z, rx, rz, r: rmax, a: Math.atan2(tr.TX[i], tr.TZ[i]) });
    }
    clearance = (x, z, r) => base(x, z, r) && lakes.every((k) => (k.x - x) ** 2 + (k.z - z) ** 2 > (k.r + r * 0.5 + 3) ** 2);
    const disc = new THREE.CircleGeometry(1, 44).rotateX(-Math.PI / 2);
    const shoreMat = new THREE.MeshStandardMaterial({ color: 0x4a5a30, roughness: 1 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e6f6a, roughness: 0.06, metalness: 0.15, envMapIntensity: 1.5, transparent: true, opacity: 0.93 });
    for (const k of lakes) {
      const shore = new THREE.Mesh(disc, shoreMat); shore.scale.set(k.rx * 1.12, 1, k.rz * 1.12); shore.position.set(k.x, 0.03, k.z); shore.rotation.y = k.a; shore.receiveShadow = !!q.shadows; scene.add(shore);
      const water = new THREE.Mesh(disc, waterMat); water.scale.set(k.rx, 1, k.rz); water.position.set(k.x, 0.07, k.z); water.rotation.y = k.a; scene.add(water);
    }
  }
  const n = (v) => Math.max(1, Math.round(v * dens));
  const lam = (c, rough = 0.92) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });
  const pick = (arr, s) => arr[Math.abs(Math.floor(s[0] * 7.31 + s[1] * 3.17)) % arr.length];
  const put = (geo, mat, list, place, tint, cast = true) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, k) => { place(dummy, s, k); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); if (tint) m.setColorAt(k, col(tint(s, k))); });
    if (tint && m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false; m.castShadow = cast && !!q.shadows; m.receiveShadow = !!q.shadows; scene.add(m);
  };
  // altura del terreno junto a la pista (la misma aproximación que usan los árboles junto a la valla)
  const groundAt = (i, l) => Math.max(0, tr.Y[i] * (1 - (l - WALL) / (2.5 + 1.1 * tr.Y[i])));
  // puntos junto a la pista, fuera de la valla: [x, z, giro, escala, altura]
  const nearPts = (count, lMin, lMax) => {
    const out = [];
    for (let g = 0; out.length < count && g < count * 30; g++) {
      const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, l = lMin + rng() * (lMax - lMin);
      const x = tr.X[i] + -tr.TZ[i] * l * side, z = tr.Z[i] + tr.TX[i] * l * side;
      if (clearance(x, z, WALL + 4)) out.push([x, z, rng() * 6.283, 0.75 + rng() * 0.55, groundAt(i, l)]);
    }
    return out;
  };
  // puntos lejanos, en el anillo exterior (más allá del radio del circuito, nunca sobre el trazado)
  const farPts = (count, d0, d1) => {
    const out = [];
    for (let k = 0; k < count; k++) { const a = rng() * 6.283, d = R + d0 + rng() * (d1 - d0); out.push([cxm + Math.cos(a) * d, czm + Math.sin(a) * d, rng() * 6.283, 0.75 + rng() * 0.55, 0]); }
    return out;
  };
  // pequeños poblados junto a la pista: 3-6 casas en un solar, sin tocar el trazado. Cada casa: [x, z, giro, ancho, alto, fondo, muro, tejado, altura tejado, y]
  const villages = (count, walls, roofs, roofH) => {
    const houses = []; let made = 0;
    for (let g = 0; made < count && g < 80; g++) {
      const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, l = WALL + 50 + rng() * 110;
      const cx = tr.X[i] + -tr.TZ[i] * l * side, cz = tr.Z[i] + tr.TX[i] * l * side;
      if (!clearance(cx, cz, WALL + 40)) continue;
      made++; const hn = 4 + Math.floor(rng() * 5), rot = (rng() - 0.5) * 0.6, gy = groundAt(i, l);
      for (let k = 0; k < hn; k++) {
        const hx = cx + (rng() - 0.5) * 48, hz = cz + (rng() - 0.5) * 48;
        if (!clearance(hx, hz, WALL + 9)) continue;
        houses.push([hx, hz, rot + (rng() - 0.5) * 0.3, 5 + rng() * 3, 3.4 + rng() * 1.6, 5 + rng() * 3, walls[k % walls.length], roofs[k % roofs.length], roofH, gy]);
      }
    }
    return houses;
  };
  const renderHouses = (list) => {
    put(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(0xffffff, 0.88), list, (d, s) => { d.position.set(s[0], s[9], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[4], s[5]); }, (s) => s[6]);
    // tejado a cuatro aguas: un cono de cuatro lados girado 45° encaja exactamente con la casa
    put(new THREE.ConeGeometry(0.707, 1, 4).translate(0, 0.5, 0), lam(0xffffff, 0.9), list, (d, s) => { d.position.set(s[0], s[9] + s[4], s[1]); d.rotation.set(0, s[2] + Math.PI / 4, 0); d.scale.set(s[3] * 1.05, s[8], s[5] * 1.05); }, (s) => s[7]);
  };

  // relieves: colinas redondeadas en el anillo exterior
  const hillPal = { desierto: [0xc27a4a, 0xb86b3e, 0xd08a55], spa: [0x2f4f2c, 0x3a5a33, 0x284428], valle: [0x5aa54e, 0x4f9a46, 0x6cb55a], nieve: [0xe9f2fa, 0xdce9f5, 0xf4f9ff], pruebas: [0x5f8a4e, 0x6b9455, 0x557b48], amazonas: [0x2e6a38, 0x2a5f34, 0x347a40] }[id];
  if (hillPal) {
    // la base de cada colina (radio w) queda siempre fuera del círculo que contiene el circuito: nunca lo atraviesa
    const hills = Array.from({ length: n(id === 'spa' ? 46 : 30) }, () => { const w = 80 + rng() * 170, a = rng() * 6.283, d = R + w + 40 + rng() * 260; return [cxm + Math.cos(a) * d, czm + Math.sin(a) * d, rng() * 6.283, w, 14 + rng() * 40]; });
    put(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xffffff, 1), hills, (d, s) => { d.position.set(s[0], -2, s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[4], s[3] * 0.82); }, (s) => pick(hillPal, s));
  }

  // bosques de coníferas más allá de la valla (Spa y Cumbre Nevada)
  if (id === 'spa' || id === 'nieve') {
    const crown = mergeBufferGeometries([new THREE.ConeGeometry(2.4, 4.2, 7).translate(0, 3.6, 0), new THREE.ConeGeometry(1.8, 3.4, 7).translate(0, 5.6, 0), new THREE.ConeGeometry(1.1, 2.6, 7).translate(0, 7.2, 0)]);
    const pines = farPts(n(id === 'spa' ? 520 : 260), 25, 240).concat(nearPts(n(id === 'spa' ? 160 : 90), WALL + 25, WALL + 150));
    const place = (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[3], s[3]); };
    put(new THREE.CylinderGeometry(0.22, 0.36, 2.5, 6).translate(0, 1.25, 0), lam(0x4c3524), pines, place);
    put(crown, foliage(0.8, 0xffffff, 0.94), pines, place, (s, k) => col(th.treeCol).multiplyScalar(0.9 + (k % 7) * 0.02).getHex());
  }

  // desierto: mesetas, cactus saguaro y barril, y un pequeño poblado de adobe
  if (id === 'desierto') {
    const mesas = farPts(n(12), 60, 360).map((s) => [s[0], s[1], s[2], 16 + rng() * 26, 14 + rng() * 30]);
    put(new THREE.CylinderGeometry(0.8, 1, 1, 14).translate(0, 0.5, 0), lam(0xffffff), mesas, (d, s) => { d.position.set(s[0], -1, s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[4], s[3]); }, (s) => pick([0xb8653a, 0xc97d4c, 0x9c5232, 0xd58b5b], s));
    // saguaro con puntas y codos redondeados (esferas en las juntas) en vez de cilindros con cortes planos
    const saguaro = mergeBufferGeometries([
      new THREE.CylinderGeometry(0.46, 0.56, 5.2, 18, 4).translate(0, 2.6, 0),
      new THREE.SphereGeometry(0.46, 16, 8).translate(0, 5.2, 0),
      new THREE.CylinderGeometry(0.27, 0.27, 2.2, 12).rotateZ(Math.PI / 2).translate(1.0, 3.2, 0),
      new THREE.SphereGeometry(0.27, 12, 8).translate(2.1, 3.2, 0),
      new THREE.CylinderGeometry(0.25, 0.25, 1.8, 12).translate(1.9, 4.1, 0),
      new THREE.SphereGeometry(0.25, 12, 8).translate(1.9, 5.0, 0),
      new THREE.CylinderGeometry(0.25, 0.25, 2.0, 12).rotateZ(-Math.PI / 2).translate(-0.9, 2.5, 0),
      new THREE.SphereGeometry(0.25, 12, 8).translate(-1.9, 2.5, 0),
      new THREE.CylinderGeometry(0.23, 0.23, 1.6, 12).translate(-1.7, 3.3, 0),
      new THREE.SphereGeometry(0.23, 12, 8).translate(-1.7, 4.1, 0),
    ]);
    const saguaros = nearPts(n(120), WALL + 6, WALL + 130).concat(farPts(n(60), 30, 200));
    put(saguaro, cactusMat(), saguaros, (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3] * 1.15, s[3] * 1.15, s[3] * 1.15); }, (s) => pick([0x4a8a3a, 0x3f7d33, 0x5a9742], s));
    put(new THREE.SphereGeometry(1, 12, 8).scale(1, 0.85, 1).translate(0, 0.8, 0), lam(0xffffff, 0.85), nearPts(n(60), WALL + 6, WALL + 100), (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3] * 0.9, s[3] * 0.9, s[3] * 0.9); }, (s) => pick([0x3f7d33, 0x4f8b3c], s));
    renderHouses(villages(3, [0xefe3c8, 0xe6cfa6, 0xd9b38c], [0x8a4a2b, 0x7a3e22], 1.7));
  }
  // poblados de montaña, valle y nieve
  if (id === 'spa') renderHouses(villages(2, [0x6f4f2e, 0x8a6a44, 0x5b4128], [0x2f2f33, 0x3c3a36], 3.4));
  if (id === 'valle') renderHouses(villages(3, [0xf3f1e8, 0xf6d9a8, 0xe8c8b0], [0xb84a2a, 0xa23e24], 2.2));
  if (id === 'nieve') renderHouses(villages(2, [0x6b4b30, 0x7a5a3a], [0xe8f0f7, 0xdfe9f2], 3.4));

  // rocas sueltas junto a la pista y en el paisaje
  if (hillPal) {
    const rockPal = id === 'desierto' ? [0xa65f35, 0x8c4a2a, 0xc0764a] : id === 'nieve' ? [0x9aa6b2, 0xb8c3cc, 0x7f8b97] : [0x7d7a72, 0x8f8a80, 0x6b675f];
    const rocks = nearPts(n(id === 'desierto' ? 60 : 40), WALL + 5, WALL + 110).concat(farPts(n(60), 40, 300));
    put(new THREE.IcosahedronGeometry(1, 0), lam(0xffffff, 0.98), rocks, (d, s) => { const r = 1.2 + s[3] * 2.2; d.position.set(s[0], s[4] + r * 0.2, s[1]); d.rotation.set(s[2], s[2] * 1.7, s[2] * 0.6); d.scale.set(r * 1.25, r * 0.8, r); }, (s) => pick(rockPal, s));
  }

  // más variedad y frondosidad: árboles de copa redonda, palmeras y arbustos junto a la valla y en el paisaje
  if (id === 'spa' || id === 'valle' || id === 'pruebas') {
    const crownG = mergeBufferGeometries([0, 1, 2, 3].map((k) => new THREE.SphereGeometry(1, 9, 7).scale(2.2 - (k % 2) * 0.3, 1.9, 2.2 - (k % 2) * 0.3).translate(Math.cos(k * 1.57) * 1.2, 5.2 + (k % 2) * 0.9, Math.sin(k * 1.57) * 1.2)));
    const trunkG = new THREE.CylinderGeometry(0.28, 0.44, 4.6, 7).translate(0, 2.3, 0);
    const broad = farPts(n(id === 'valle' ? 160 : 380), 30, 220).concat(nearPts(n(id === 'valle' ? 80 : 120), WALL + 22, WALL + 140));
    const place = (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[3], s[3]); };
    put(trunkG, lam(0x5b4128), broad, place);
    put(crownG, foliage(1.0, 0xffffff, 0.9), broad, place, (s, k) => col(th.treeCol).multiplyScalar(0.85 + ((k * 13) % 9) * 0.03).getHex());
  }
  if (id === 'valle' || id === 'desierto') {
    const frond = (k) => colorGeometry(new THREE.ConeGeometry(0.7, 4.2, 3).rotateZ(-Math.PI / 2 + 0.45).translate(2.0, 8.4, 0).rotateY((k * Math.PI) / 3), 0.42, 0.74, 0.34);
    const palmG = mergeBufferGeometries([colorGeometry(new THREE.CylinderGeometry(0.22, 0.38, 8, 6).translate(0, 4, 0), 0.42, 0.3, 0.18), ...[0, 1, 2, 3, 4, 5].map(frond)]);
    const palms = nearPts(n(id === 'valle' ? 70 : 50), WALL + 8, WALL + 120).concat(farPts(n(id === 'valle' ? 60 : 40), 60, 260));
    put(palmG, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), 0.9), palms, (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3], s[3], s[3]); });
  }
  if (id !== 'monaco' && id !== 'neon' && id !== 'prisma') {
    const shrubG = mergeBufferGeometries([new THREE.SphereGeometry(1, 8, 6).scale(1.3, 0.8, 1.3).translate(0, 0.7, 0), new THREE.SphereGeometry(1, 7, 5).scale(0.9, 0.7, 0.9).translate(1.1, 0.5, 0.4), new THREE.SphereGeometry(1, 7, 5).scale(0.8, 0.6, 0.8).translate(-0.9, 0.45, -0.5)]);
    const shrubCol = id === 'desierto' ? [0x8a7a4a, 0x7c8a4f, 0x9a8456] : id === 'nieve' ? [0xdbe8f2, 0xc8d9e8] : [th.treeCol, 0x4f8a3c, 0x5e9a46];
    const shrubs = nearPts(n(240), WALL + 4, WALL + 70).concat(farPts(n(120), 30, 260));
    put(shrubG, foliage(0.35, 0xffffff, 0.95), shrubs, (d, s) => { d.position.set(s[0], s[4], s[1]); d.rotation.set(0, s[2], 0); d.scale.set(s[3] * 1.1, s[3] * 1.1, s[3] * 1.1); }, (s) => pick(shrubCol, s));
  }

  // Amazonas: selva muy alta y frondosa
  if (id === 'amazonas') {
    const farOk = (pts) => pts.filter((p) => clearance(p[0], p[1], 6)); // fuera de los lagos
    const place = (d, s2) => { d.position.set(s2[0], s2[4], s2[1]); d.rotation.set(0, s2[2], 0); d.scale.set(s2[3], s2[3], s2[3]); };
    const tintG = (pal) => (s2) => pick(pal, s2);
    // árboles gigantes (30-45 m): tronco con base ancha y copa de varias masas aplanadas, como los emergentes de la selva
    const giantTrunk = new THREE.CylinderGeometry(0.9, 1.9, 38, 9).translate(0, 19, 0);
    const blob = (rx, ry, rz, x, y, z) => new THREE.SphereGeometry(1, 9, 7).scale(rx, ry, rz).translate(x, y, z);
    const giantCrown = mergeBufferGeometries([blob(7.5, 3.2, 7.5, 0, 36, 0), blob(5.5, 2.6, 5.5, 5, 34, 2), blob(5.2, 2.4, 5.2, -4.5, 34.5, -3), blob(5, 2.4, 5, 2, 39, -4), blob(5, 2.4, 5, -3, 33, 4.5), blob(4.5, 2.2, 4.5, 0, 42, 0.5)]);
    const gScale = (s2) => 0.8 + (s2[3] - 0.75) * 0.75; // 0.8-1.2: unos 30-45 m
    const giantsNear = nearPts(n(150), WALL + 4, WALL + 120), giantsFar = farOk(farPts(n(240), 25, 260));
    const gPlace = (d, s2) => { const k = gScale(s2); d.position.set(s2[0], s2[4], s2[1]); d.rotation.set(0, s2[2], 0); d.scale.set(k, k, k); };
    const barkMat = lam(0x5a4632, 0.95);
    for (const [list, cast] of [[giantsNear, true], [giantsFar, false]]) {
      put(giantTrunk, barkMat, list, gPlace, null, cast);
      put(giantCrown, foliage(1, 0xffffff, 0.92), list, gPlace, tintG([0x2a7a30, 0x1f6a2a, 0x38853a, 0x2a6a38, 0x34803a]), cast);
    }
    // árboles medios (12-18 m) en segundo plano
    const midTrunk = new THREE.CylinderGeometry(0.35, 0.6, 9, 7).translate(0, 4.5, 0);
    const midCrown = mergeBufferGeometries([blob(3.8, 2.8, 3.8, 0, 11, 0), blob(2.8, 2.2, 2.8, 2.4, 9.5, 1), blob(2.8, 2.2, 2.8, -2.2, 9.8, -1.2), blob(2.6, 2, 2.6, 0.5, 13.2, -0.5)]);
    const mids = nearPts(n(220), WALL + 3, WALL + 90).concat(farOk(farPts(n(380), 20, 240)));
    const mPlace = (d, s2) => { const k = 0.9 + (s2[3] - 0.75) * 0.9; d.position.set(s2[0], s2[4], s2[1]); d.rotation.set(0, s2[2], 0); d.scale.set(k, k, k); };
    put(midTrunk, barkMat, mids, mPlace, null, false);
    put(midCrown, foliage(1, 0xffffff, 0.9), mids, mPlace, tintG([0x3b8a3c, 0x2f7a35, 0x4a9a44, 0x33803a]), false);
    // palmeras altas (aguaje): tronco fino y penacho de hojas
    const frondG = (k) => colorGeometry(new THREE.ConeGeometry(0.9, 5, 3).rotateZ(-Math.PI / 2 + 0.5).translate(2.6, 14.2, 0).rotateY((k * Math.PI) / 4), 0.36, 0.7, 0.3);
    const palmTall = mergeBufferGeometries([colorGeometry(new THREE.CylinderGeometry(0.26, 0.42, 14, 6).translate(0, 7, 0), 0.42, 0.32, 0.2), ...[0, 1, 2, 3, 4, 5, 6, 7].map(frondG)]);
    put(palmTall, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), nearPts(n(110), WALL + 3, WALL + 70), place, null, false);
    // sotobosque: helechos y plantas de hoja ancha, muy densos junto a la valla
    const fernG = mergeBufferGeometries([0, 1, 2, 3, 4, 5].map((k) => new THREE.ConeGeometry(0.28, 2.6, 3).rotateZ(1.0).translate(0.9, 0.9, 0).rotateY((k * Math.PI) / 3)));
    const ferns = nearPts(n(520), WALL + 1.5, WALL + 40);
    put(fernG, lam(0xffffff, 0.95), ferns, (d, s2) => { d.position.set(s2[0], s2[4], s2[1]); d.rotation.set(0, s2[2], 0); const k = 0.8 + s2[3] * 0.6; d.scale.set(k, k, k); }, tintG([0x3f8a34, 0x4f9a3a, 0x2f7a2c, 0x5aa040]), false);
    // nenúfares sobre los lagos
    const pads = [];
    for (const k of lakes) for (let q2 = 0; q2 < 16; q2++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * 0.82, ex = Math.cos(a) * d * k.rx, ez = Math.sin(a) * d * k.rz; pads.push([k.x + ex * Math.cos(k.a) + ez * Math.sin(k.a), k.z - ex * Math.sin(k.a) + ez * Math.cos(k.a), rng() * 6.283, 0.7 + rng() * 0.8, 0.09]); }
    put(new THREE.CircleGeometry(0.55, 9).rotateX(-Math.PI / 2), lam(0x3e8a3a, 0.9), pads, (d, s2) => { d.position.set(s2[0], s2[4], s2[1]); d.rotation.set(0, s2[2], 0); d.scale.set(s2[3], 1, s2[3]); }, null, false);
  }

  // hojas al viento: en los circuitos de bosque y valle, con pocas hojas en móvil
  if (id === 'spa' || id === 'valle' || id === 'pruebas' || id === 'amazonas') makeLeaves(tr, scene, Math.max(30, Math.round((id === 'spa' ? 110 : 70) * dens)), id === 'valle' ? [0x6fa83a, 0x8cc04a, 0xc9a23a, 0x5e9a32] : [0x4f8a2e, 0x6e9b2f, 0x8f6a2a, 0x3f7a2a]);
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
    hemiSky: palette.hemiSky || dk(th.hemiSky, 0x4f5963, k), hemiGround: palette.hemiGround || dk(th.hemiGround, 0x1d231c, k * 0.7), hemiI: th.hemiI * (th.night ? 0.72 : 0.62), sunI: th.sunI * (th.night ? 0.35 : 0.12), sun: palette.sun || dk(th.sun, 0x7f8a95, 0.6),
    fogNear: th.fogNear * 0.8, fogFar: th.fogFar * 0.85,
  };
}
// Parrilla de salida con cajones escalonados en la recta principal
function startGridBoxes(tr, th) {
  const g = new THREE.Group();
  const isKart = th.deco === 'kart';
  const mat = new THREE.MeshBasicMaterial({
    color: isKart ? 0xffffff : (th.surface === 'snow' ? 0xd0e8ff : 0xf2f4f8),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: isKart ? 0.95 : 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -2.5,
    polygonOffsetUnits: -2.5,
  });
  const count = 10;
  for (let k = 0; k < count; k++) {
    const sBox = tr.len - 38 + k * 3.4;
    const side = (k % 2 === 0 ? -1 : 1) * (ROAD_HALF * 0.42);
    const boxMesh = new THREE.Mesh(stripGeom(tr, sBox, sBox + 1.6, side - 1.15, side + 1.15, 0.038), mat);
    boxMesh.frustumCulled = false;
    g.add(boxMesh);
  }
  return g;
}

// Marcas de frenada (skid marks) en las aproximaciones a curvas fuertes
function brakingMarks(tr, th) {
  const g = new THREE.Group();
  const rubberMat = new THREE.MeshBasicMaterial({
    color: 0x16181b,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const N = tr.N;
  let lastS = -50;
  for (let i = 20; i < N - 20; i += 8) {
    const ak = Math.abs(tr.kap[i]);
    const s = i * tr.ds;
    if (ak > 0.012 && s - lastS > 45) {
      const s0 = Math.max(0, s - 18), s1 = s;
      for (const side of [-1, 1]) {
        const skid = new THREE.Mesh(stripGeom(tr, s0, s1, side * 0.72 - 0.18, side * 0.72 + 0.18, 0.032), rubberMat);
        skid.frustumCulled = false;
        g.add(skid);
      }
      lastS = s;
    }
  }
  return g;
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
    const c = sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 320; c.updateProjectionMatrix();
    sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.2;
  }
  const microRain = !!(tr.rain && tr.rain.length); // chaparrón local: la lluvia solo se ve (y se oye) dentro de su tramo
  const ambientRain = th.weather === 'rain' || microRain, ambientSnow = th.surface === 'snow';
  let weatherMesh = null, weatherDrops = [];
  if (ambientRain || ambientSnow) {
    // lluvia: muchas más gotas, finas y alargadas; nieve: copos algo mayores y más numerosos
    const count = ambientRain ? (opt.mobile ? 220 : 520) : (opt.mobile ? 160 : 380);
    const geo = ambientRain ? new THREE.CylinderGeometry(0.009, 0.009, 1, 4) : new THREE.SphereGeometry(0.09, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: ambientRain ? 0xd3e6f7 : 0xf4f9ff, transparent: true, opacity: ambientRain ? 0.5 : 0.85, depthWrite: false });
    weatherMesh = new THREE.InstancedMesh(geo, mat, count); weatherMesh.frustumCulled = false;
    const weatherRng = rngFromSeed('preview-weather:' + tr.seed), weatherDummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const drop = { x: (weatherRng() - 0.5) * 48, y: weatherRng() * 30, z: (weatherRng() - 0.5) * 48, scale: 0.6 + weatherRng() * 0.9, phase: weatherRng() * Math.PI * 2, spd: 0.8 + weatherRng() * 0.5 };
      weatherDrops.push(drop); weatherDummy.position.set(drop.x, drop.y, drop.z); weatherDummy.scale.setScalar(drop.scale); weatherDummy.updateMatrix(); weatherMesh.setMatrixAt(i, weatherDummy.matrix);
    }
    scene.add(weatherMesh);
  }
  const weatherDummy = new THREE.Object3D();
  const updateWeather = (dt, x = 0, y = 0, z = 0, k = microRain && th.weather !== 'rain' ? 0 : 1) => {
    if (!weatherMesh) return;
    weatherMesh.visible = k > 0.03; if (!weatherMesh.visible) return;
    weatherMesh.material.opacity = (ambientRain ? 0.5 : 0.85) * Math.min(1, k); // k: intensidad de la lluvia en el punto (microclima)
    const fall = ambientRain ? 38 : 2.4;
    for (let i = 0; i < weatherDrops.length; i++) {
      const p = weatherDrops[i]; p.y -= fall * p.spd * Math.min(dt, 0.05);
      if (!ambientRain) { p.x += Math.sin(p.phase + p.y * 0.08) * dt * 0.8; p.z += Math.cos(p.phase + p.y * 0.06) * dt * 0.65; }
      else { p.x += 2.6 * p.spd * Math.min(dt, 0.05); } // lluvia algo inclinada por el viento
      if (p.y < -4) { p.y = ambientRain ? 22 + Math.random() * 10 : 18 + Math.random() * 7; p.x = (Math.random() - 0.5) * 48; p.z = (Math.random() - 0.5) * 48; }
      // la estela se alarga con la velocidad de caída: lluvia rápida y con trazos visibles
      const streak = ambientRain ? 1.2 + p.spd * 1.1 : 1;
      weatherDummy.position.set(x + p.x, y + p.y, z + p.z); weatherDummy.scale.set(p.scale, p.scale * streak, p.scale); weatherDummy.updateMatrix(); weatherMesh.setMatrixAt(i, weatherDummy.matrix);
    }
    weatherMesh.instanceMatrix.needsUpdate = true;
  };

  const road = roadMesh(tr, th, q.stride); scene.add(road);
  for (const t of tr.tunnels || []) scene.add(tunnelMesh(tr, t, th));
  trackFeatures(tr, th, scene, q);
  if (th.urban) scene.add(urbanMesh(tr, th));
  if (th.harbor) scene.add(monacoHarbor(scene, !!q.shadows));
  // Marcas tenues de goma en la trazada: dos huellas de rueda, sin línea central de carretera.
  const rubber = new THREE.MeshStandardMaterial({ color: th.weather === 'rain' ? 0x35404a : 0x25292d, roughness: 0.94, metalness: 0.02, transparent: true, opacity: th.weather === 'rain' ? 0.36 : 0.24, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, side * 0.66 - 0.085, side * 0.66 + 0.085, 0.026), rubber);
    line.frustumCulled = false; scene.add(line);
  }
  scene.add(startGridBoxes(tr, th));
  if (th.deco !== 'kart') scene.add(brakingMarks(tr, th));
  const walls = wallMesh(tr, th, q.stride);
  walls.receiveShadow = true;
  walls.castShadow = !!q.shadows;
  scene.add(walls);

  if (th.deco === 'kart') {
    marioArena(th, scene, !!q.shadows);
    marioPipes(scene, !!q.shadows);
    marioProps(scene, !!q.shadows);
    marioArrows(tr, scene);
  } else {
    distanceMarkers(tr, th, scene);
    sponsorHoardings(tr, th, scene);
    motorsportAmbiance(tr, th, scene, q);
  }
  if (th.oil) {
    const oilMat = new THREE.MeshPhysicalMaterial({
      color: 0x111317,
      map: oilTexture(),
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      side: THREE.DoubleSide
    });
    for (const p of MARIO_OIL_PATCHES) {
      const mesh = new THREE.Mesh(surfacePatchGeom(tr, p.s, p.halfLength * 2, p.lane, p.halfWidth, p.seed, 0.045), oilMat);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
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
    const hwf = roadHalfAt(tr), g = stripGeom(tr, 0, 1.0, (i, j, t) => -hwf(i, j, t), hwf, 0.05), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), uv.getY(k));
    const fl = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); fl.receiveShadow = true; scene.add(fl);
  }
  // Líneas blancas continuas de borde, separadas de los pianos elevados (circuitos realistas).
  if (th.deco !== 'kart') {
    const edgeMat = new THREE.MeshBasicMaterial({ color: th.surface === 'snow' ? 0xd7e9ff : 0xf5f2e9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const side of [-1, 1]) {
      const hwf = roadHalfAt(tr), edge = new THREE.Mesh(stripGeom(tr, 0, tr.len - 1, (i, j, t) => side * (hwf(i, j, t) - 0.24) - 0.075, (i, j, t) => side * (hwf(i, j, t) - 0.24) + 0.075, 0.075), edgeMat);
      edge.frustumCulled = false; scene.add(edge);
    }
  }
  if (th.deco !== 'kart') {
    scene.add(gantry(tr, tr.len / 3, 'S2', '#66e8ff'));
    scene.add(gantry(tr, (tr.len * 2) / 3, 'S3', '#66e8ff'));
    tyreStacks(tr, th, scene);
    turnSigns(tr, th, scene, !!opt.mobile);
  }

  const info = scenery(tr, th, scene, rng, q);
  const windDummy = new THREE.Object3D();
  let windClock = 0;
  const updateWind = (dt) => {
    if (!info.windMeshes || !info.windMeshes.length) return;
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
  for (const f of [1 / 3, 2 / 3]) { const hwf = roadHalfAt(tr), m = new THREE.Mesh(stripGeom(tr, tr.len * f, tr.len * f + 1.4, (i, j, t) => -hwf(i, j, t), hwf, 0.07), lm); m.frustumCulled = false; scene.add(m); }
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
