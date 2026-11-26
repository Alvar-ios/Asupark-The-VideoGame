// Circuitos importados: en lugar de generar el escenario, se carga su modelo (tools/prep-tracks.mjs) alrededor de la
// línea central que usa la física. Aquí solo se añaden cielo, luces, mar o suelo de fondo y las marcas de carrera.
import * as THREE from 'three';
import { SOLID_CELL } from './track.js';
import { parseGlb } from './glbload.js';
import { TRACK_DATA } from './tracks-data.js';
import { reloadForUpdate } from './update.js';
import { seaSky, seaWater, mistBanks } from './seascape.js';

const cache = {}, pending = {};
export function loadTrackModel(id) {
  if (cache[id]) return Promise.resolve(cache[id]);
  const rev = TRACK_DATA[id].rev;
  return pending[id] || (pending[id] = parseGlb(`./assets/track_${id}.glb.gz?v=${rev}`).then((g) => {
    // modelo y código tienen que ser de la misma versión: si no, la pista saldría sin suelo o con muros invisibles
    if (g.scene.userData.rev !== rev) { reloadForUpdate(); throw new Error('hay una versión nueva del juego'); }
    g.scene.traverse((o) => { if (!o.isMesh) return; o.receiveShadow = true; o.castShadow = false; const m = o.material; m.envMapIntensity = 0.25; if (m.map) m.map.anisotropy = 4; if (m.transparent) m.depthWrite = false; });
    return (cache[id] = g.scene);
  }).catch((e) => { delete pending[id]; throw e; }));
}

function skyDome(th) {
  const geo = new THREE.SphereGeometry(1900, 24, 16), top = new THREE.Color(th.skyTop), hor = new THREE.Color(th.skyHor), col = [], v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < geo.attributes.position.count; i++) { v.fromBufferAttribute(geo.attributes.position, i); c.copy(hor).lerp(top, Math.max(0, Math.min(1, v.y / 900))); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Group(); sky.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))); return sky;
}
function finishLine(tr, th) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(i * 16, j * 16, 16, 16); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tr.half * 2 - 0.4, 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  m.position.set(tr.X[0], tr.Y[0] + 0.07, tr.Z[0]); m.rotation.y = Math.atan2(tr.TX[0], tr.TZ[0]); return m;
}
// donde el borde es un precipicio, unos postes con cuerda dejan claro hasta dónde se puede llegar
function edgePosts(tr, deck, walls) {
  const every = 5, n = Math.floor(tr.N / every) * 2;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 6).translate(0, 0.37, 0), new THREE.MeshLambertMaterial({ color: 0x8a6439 }), n);
  const ropeAt = [], d = new THREE.Object3D(); let k = 0;
  const walled = (i, side, x, z) => (deck && deck.apron && deck.apron[side < 0 ? 0 : 1][Math.round((i / tr.N) * deck.index.length) % deck.index.length] > 0)
    || [...(tr.solids ? tr.solids.get(Math.floor(x / SOLID_CELL) * 4096 + Math.floor(z / SOLID_CELL)) || [] : [])].some((q) => Math.abs(q[4] - tr.Y[i]) < 2.2 && Math.hypot((q[0] + q[2]) / 2 - x, (q[1] + q[3]) / 2 - z) < 2.8)
    || (walls && walls.some((w) => Math.abs(w[2] - tr.Y[i]) < 2.2 && Math.hypot(w[0] - x, w[1] - z) < 2.8));
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i + every <= tr.N; i += every) {
      const l = side * ((tr.wallEdge ? tr.wallEdge[side < 0 ? 0 : 1][i] : tr.wall) + 0.2), x = tr.X[i] - tr.TZ[i] * l, z = tr.Z[i] + tr.TX[i] * l;
      if (walled(i, side, x, z)) { line.push(null); continue; }
      d.position.set(x, tr.Y[i], z); d.updateMatrix(); posts.setMatrixAt(k++, d.matrix); line.push(new THREE.Vector3(x, tr.Y[i] + 0.62, z));
    }
    for (let i = 0; i < line.length; i++) if (line[i] && line[(i + 1) % line.length]) ropeAt.push(line[i], line[(i + 1) % line.length]);
  }
  posts.count = k; posts.computeBoundingSphere();
  const g = new THREE.Group(); g.add(posts, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropeAt), new THREE.LineBasicMaterial({ color: 0xe8dcc0 })));
  return g;
}

// Calzada reconstruida (circuitos con desniveles): se dibuja con las mismas alturas que usa la física, así el kart
// nunca se hunde ni flota. Lleva las texturas del propio modelo y un faldón de roca a los lados.
function deckMesh(tr, deck, model) {
  const mats = {}; model.traverse((o) => { if (o.isMesh && o.material.name && !mats[o.material.name]) mats[o.material.name] = o.material; });
  const N = tr.N, K = deck.index.length, tile = tr.len / Math.max(1, Math.round(tr.len / 5)), group = new THREE.Group();
  const edge = (i, side) => (tr.wallEdge ? tr.wallEdge[side < 0 ? 0 : 1][i % N] : tr.wall) + 0.4;
  const point = (i, lat, y) => [tr.X[i % N] - tr.TZ[i % N] * lat, y, tr.Z[i % N] + tr.TX[i % N] * lat];
  const parts = new Map();
  const part = (name) => parts.get(name) || parts.set(name, { P: [], U: [], I: [] }).get(name);
  // una tira entre la muestra i y la siguiente; cada columna es [lateral, altura, u]
  const strip = (name, i, cols, flip) => {
    const g = part(name), base = g.P.length / 3;
    for (const k of [i, i + 1]) for (const c of cols(k)) { g.P.push(...point(k, c[0], c[1])); g.U.push(c[2], c[3] ?? (k * tr.ds) / tile); }
    const w = g.P.length / 3 - base >> 1;
    for (let c = 0; c + 1 < w; c++) { const a = base + c, b = a + 1, d = a + w, e = d + 1; if (flip) g.I.push(a, d, b, b, d, e); else g.I.push(a, b, d, b, e, d); }
  };
  const [r0, r1] = deck.ramp.map((v) => v * N), onRamp = (i) => (r0 <= r1 ? i >= r0 && i <= r1 : i >= r0 || i <= r1);
  const soft = (i) => { let n = 0; for (let d = -6; d <= 6; d++) n += onRamp((i + d + N) % N) ? 1 : 0; return n / 13; };
  // en la rampa el faldón baja hasta el suelo; en lo alto es un buen canto de roca, salvo si debajo pasa otro tramo
  const under = (i) => { for (let j = 0; j < N; j += 3) if (tr.Y[j] < tr.Y[i] - 2.5 && Math.hypot(tr.X[j] - tr.X[i], tr.Z[j] - tr.Z[i]) < 10) return true; return false; };
  const ledge = Float32Array.from({ length: N }, (_, i) => (tr.Y[i] > 6 && !under(i) ? 3.4 : 1.2));
  const drop = Float32Array.from({ length: N }, (_, i) => { let l = 0; for (let d = -4; d <= 4; d++) l += ledge[(i + d + N) % N]; return l / 9 + soft(i) * Math.max(0, tr.Y[i] - 2.4); });
  // el faldón no se dibuja donde caería sobre otra parte de la calzada a una altura parecida (curvas cerradas y pasos juntos)
  const folds = (i, side) => {
    for (const out of [0.4, 1.5]) {
      const l = side * (edge(i, side) + out), px = tr.X[i] - tr.TZ[i] * l, pz = tr.Z[i] + tr.TX[i] * l;
      for (let j = 0; j < N; j++) { const apart = Math.min((j - i + N) % N, (i - j + N) % N); if (apart > 2 && Math.abs(tr.Y[j] - tr.Y[i]) < 2.2 && Math.hypot(tr.X[j] - px, tr.Z[j] - pz) < edge(j, side) - 0.3) return true; }
    }
    return false;
  };
  for (let i = 0; i < N; i++) {
    const name = deck.materials[deck.index[Math.round((i / N) * K) % K]];
    strip(name, i, (k) => [-1, -0.5, 0, 0.5, 1].map((f) => [f * edge(k, f || 1), tr.Y[k % N], (f + 1) / 2]), false);
    for (const side of [-1, 1]) {
      if (folds(i, side)) continue;
      // faldón de roca; en lo alto empieza con un arcén casi plano que llega hasta el pie de las paredes
      strip(deck.skirt, i, (k) => {
        const y = tr.Y[k % N], e = edge(k, side), out = 0.45, low = y - drop[k % N];
        return [[e, y - 0.01, 0], [e + out, y - 0.12, out / 13], [e + out + 1.2, low, (out + drop[k % N]) / 13]].map((c) => [side * c[0], c[1], (k * tr.ds) / 13, c[2]]);
      }, side > 0);
    }
  }
  // ¿ese punto cae sobre otro tramo de la calzada a una altura parecida?
  const over = (i, side, lat) => { const px = tr.X[i] - tr.TZ[i] * side * lat, pz = tr.Z[i] + tr.TX[i] * side * lat; for (let j = 0; j < N; j++) { const apart = Math.min((j - i + N) % N, (i - j + N) % N); if (apart > 8 && Math.abs(tr.Y[j] - tr.Y[i]) < 3 && Math.hypot(tr.X[j] - px, tr.Z[j] - pz) < edge(j, 1) + 0.8) return true; } return false; };
  // arcén de tierra hasta el pie de las paredes donde el suelo viejo ya no llega (usa el borde de la textura del camino)
  const dirt = deck.materials.find((m) => /Ground./.test(m)) || deck.materials[0];
  if (deck.apron) for (const side of [-1, 1]) {
    const w = deck.apron[side < 0 ? 0 : 1], width = (k) => { const f = ((k % N) / N) * K, a = Math.floor(f) % K, b = (a + 1) % K; return w[a] && w[b] ? w[a] + (w[b] - w[a]) * (f - Math.floor(f)) : Math.max(w[a], w[b]); };
    for (let i = 0; i < N; i++) {
      if (!width(i) || !width(i + 1)) continue;
      strip(dirt, i, (k) => { const e = edge(k, side), far = Math.max(e, width(k)), y = tr.Y[k % N]; const u = (m) => 0.14 + Math.min(0.72, m / (2 * e)); // la textura sigue a su escala: estirada parecería tarima
        return [[side * (e - 0.2), y - 0.03, 0.14], [side * (e + far) / 2, y - 0.1, u((far - e) / 2)], [side * far, y - 0.16, u(far - e)]]; }, side < 0);
      // en lo alto, un zócalo de roca al fondo del arcén: si bajo la pared queda rendija, detrás hay roca y no mar
      if (tr.Y[i] > 7 && !over(i, side, width(i))) strip(deck.skirt, i, (k) => { const far = width(k) || width(i), y = tr.Y[k % N], top = 1.7 + 0.45 * Math.sin((k % N) * 0.9) * Math.sin((k % N) * 0.37); return [[side * far, y - 0.5, (k * tr.ds) / 9, 0], [side * (far + 0.2), y + top, (k * tr.ds) / 9, 0.22]].map((c) => [c[0], c[1], c[2], c[3]]); }, side > 0);
    }
  }
  for (const [name, g] of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.U, 2)); geo.setIndex(g.I); geo.computeVertexNormals();
    const material = (mats[name] || new THREE.MeshStandardMaterial({ color: 0xb98a56, roughness: 0.95 })).clone();
    material.side = name === deck.skirt ? THREE.DoubleSide : THREE.FrontSide;
    if (name === deck.skirt) material.color.multiplyScalar(0.72); // en sombra, como el pie de los acantilados
    if (material.map) { material.map = material.map.clone(); material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping; material.map.needsUpdate = true; }
    const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; mesh.userData.deck = name; group.add(mesh);
  }
  return group;
}

// Modelos de colores planos: color más vivo y manchas suaves calculadas por posición, sin texturas nuevas
const vividCache = {};
function vividCopy(model, id, table) {
  if (vividCache[id]) return vividCache[id];
  const copy = model.clone(true), done = new Map();
  copy.traverse((o) => {
    if (!o.isMesh) return; const set = table[o.material.name]; if (!set) return;
    let m = done.get(o.material);
    if (!m) {
      m = o.material.clone(); done.set(o.material, m);
      if (set.color != null) { m.map = null; m.color.setHex(set.color); }
      if (set.emissive != null) m.emissive.setHex(set.emissive);
      if (set.grain) {
        const k = { value: new THREE.Vector3(set.grain, 1 / set.size, set.bands || 0) };
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uGrain = k;
          sh.vertexShader = 'varying vec3 vPlace;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlace=(modelMatrix*vec4(transformed,1.0)).xyz;');
          sh.fragmentShader = `uniform vec3 uGrain; varying vec3 vPlace;
float gh(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float gn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float a=gn(vPlace*uGrain.y), b=gn(vPlace*uGrain.y*3.7+7.0); diffuseColor.rgb*=1.0+uGrain.x*((a-0.5)*1.5+(b-0.5)*0.8); diffuseColor.rgb*=1.0+uGrain.z*(step(0.5,fract(vPlace.y*0.12+a*0.4))-0.5); }`);
        };
        m.customProgramCacheKey = () => 'grain';
      }
    }
    o.material = m;
  });
  return (vividCache[id] = copy);
}

export function buildModelWorld(tr, th, opt = {}) {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  const sky = th.sea ? seaSky({ ...th.sea, sunDir: th.sunDir }) : skyDome(th); scene.add(sky);
  scene.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI));
  const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.position.set(...th.sunDir); scene.add(sun, sun.target);
  sun.userData.dir = new THREE.Vector3(...th.sunDir).normalize();
  if (opt.shadows) {
    sun.castShadow = true; const ms = opt.mobile ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms);
    const c = sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 320; c.updateProjectionMatrix();
    sun.userData.dist = 110; sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025;
  }
  if (th.sea) scene.add(seaWater(th.sea), mistBanks(th.sea));
  if (th.floor) { // mar o llanura hasta el horizonte, por debajo del modelo
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1900, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: th.floor.color }));
    floor.position.y = th.floor.y; scene.add(floor);
  }
  scene.add(finishLine(tr, th));
  if (th.edgePosts) scene.add(edgePosts(tr, th.style.deck, th.style.deck && th.style.deck.walls));
  // el modelo se comparte entre carreras: se añade una copia ligera (misma geometría)
  const add = (model) => { scene.add((th.vivid ? vividCopy(model, th.model, th.vivid) : model).clone(true)); if (th.style.deck) scene.add(deckMesh(tr, th.style.deck, model)); };
  if (cache[th.model]) add(cache[th.model]); else loadTrackModel(th.model).then(add).catch((e) => console.warn('Circuito no disponible', String(e)));
  return { scene, sky, sun, updateWind() {}, updateWeather() {} };
}
