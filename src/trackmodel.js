// Circuitos importados: en lugar de generar el escenario, se carga su modelo (tools/prep-tracks.mjs) alrededor de la
// línea central que usa la física. Aquí solo se añaden cielo, luces, mar o suelo de fondo y las marcas de carrera.
import * as THREE from 'three';
import { parseGlb } from './glbload.js';

const cache = {}, pending = {};
export function loadTrackModel(id) {
  if (cache[id]) return Promise.resolve(cache[id]);
  return pending[id] || (pending[id] = parseGlb(`./assets/track_${id}.glb.gz`).then((g) => {
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
function edgePosts(tr) {
  const every = 5, n = Math.floor(tr.N / every) * 2;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 6).translate(0, 0.37, 0), new THREE.MeshLambertMaterial({ color: 0x8a6439 }), n);
  const ropeAt = [], d = new THREE.Object3D(); let k = 0;
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i + every <= tr.N; i += every) {
      const l = side * ((tr.wallEdge ? tr.wallEdge[side < 0 ? 0 : 1][i] : tr.wall) + 0.2), x = tr.X[i] - tr.TZ[i] * l, z = tr.Z[i] + tr.TX[i] * l;
      d.position.set(x, tr.Y[i], z); d.updateMatrix(); posts.setMatrixAt(k++, d.matrix); line.push(new THREE.Vector3(x, tr.Y[i] + 0.62, z));
    }
    for (let i = 0; i < line.length; i++) ropeAt.push(line[i], line[(i + 1) % line.length]);
  }
  posts.count = k; posts.computeBoundingSphere();
  const g = new THREE.Group(); g.add(posts, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropeAt), new THREE.LineBasicMaterial({ color: 0xe8dcc0 })));
  return g;
}

export function buildModelWorld(tr, th, opt = {}) {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  const sky = skyDome(th); scene.add(sky);
  scene.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI));
  const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.position.set(...th.sunDir); scene.add(sun, sun.target);
  sun.userData.dir = new THREE.Vector3(...th.sunDir).normalize();
  if (opt.shadows) {
    sun.castShadow = true; const ms = opt.mobile ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms);
    const c = sun.shadow.camera; c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 320; c.updateProjectionMatrix();
    sun.userData.dist = 110; sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025;
  }
  if (th.floor) { // mar o llanura hasta el horizonte, por debajo del modelo
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1900, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: th.floor.color }));
    floor.position.y = th.floor.y; scene.add(floor);
  }
  scene.add(finishLine(tr, th));
  if (th.edgePosts) scene.add(edgePosts(tr));
  // el modelo se comparte entre carreras: se añade una copia ligera (misma geometría)
  const add = (model) => { const copy = model.clone(true); scene.add(copy); };
  if (cache[th.model]) add(cache[th.model]); else loadTrackModel(th.model).then(add).catch((e) => console.warn('Circuito no disponible', String(e)));
  return { scene, sky, sun, updateWind() {}, updateWeather() {} };
}
