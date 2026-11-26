// Decorado de la escena de la caja: una recta de karting con pilas de neumáticos, carro de herramientas, bidones,
// piezas de kart, karts aparcados, arco, focos y naves al fondo. Todo se genera por código.
import * as THREE from 'three';

export function canvasTex(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
export function rngFrom(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const std = (color, roughness = 0.7, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const mesh = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; };
const group = (x, y, z, ry = 0, ...kids) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.add(...kids); return g; };
const tube = (pts, r, mat) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 10), mat);

export function buildSet(scene, rnd) {
  const M = {
    rubber: std(0x17181a, 0.92), chrome: std(0xd9dde4, 0.18, 0.95), steel: std(0x8a909a, 0.4, 0.8), dark: std(0x23262c, 0.6, 0.35),
    red: std(0xb5171e, 0.45, 0.25), yellow: std(0xe9ae00, 0.5, 0.15), white: std(0xe9e9e4, 0.6), blue: std(0x1f4f9e, 0.45, 0.3),
  };

  // ---------- suelo: hormigón, asfalto con líneas y pianos ----------
  const noise = (base, spread, dots) => (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < dots; i++) { const v = Math.floor(rnd() * spread); x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  };
  const ground = mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), std(0xffffff, 0.95, 0, { map: canvasTex(256, 256, noise('#6a655d', 170, 2600), { repeat: [26, 26] }) }), 0, -0.012, -20, false);
  const asphalt = mesh(new THREE.PlaneGeometry(5.2, 70).rotateX(-Math.PI / 2), std(0xffffff, 0.86, 0.05, { map: canvasTex(512, 512, noise('#33353a', 150, 11000), { repeat: [2, 26] }) }), 0, 0, -26, false);
  scene.add(ground, asphalt);
  for (const sx of [-2.36, 2.36]) scene.add(mesh(new THREE.PlaneGeometry(0.11, 70).rotateX(-Math.PI / 2), std(0xe8e8e2, 0.7), sx, 0.004, -26, false));
  // marcas de goma de las frenadas
  const skid = canvasTex(256, 1024, (x, w, h) => { x.clearRect(0, 0, w, h); for (let k = 0; k < 7; k++) { x.strokeStyle = `rgba(8,8,10,${0.18 + rnd() * 0.25})`; x.lineWidth = 5 + rnd() * 6; x.beginPath(); const x0 = 40 + rnd() * 170; x.moveTo(x0, h); x.bezierCurveTo(x0 + rnd() * 60 - 30, h * 0.7, x0 + rnd() * 90 - 45, h * 0.4, x0 + rnd() * 120 - 60, rnd() * 300); x.stroke(); } });
  const sk = mesh(new THREE.PlaneGeometry(4.4, 17).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: skid, transparent: true, depthWrite: false }), 0, 0.006, -5, false); scene.add(sk);
  const kerbGeo = new THREE.BoxGeometry(0.42, 0.06, 0.7), kerbs = new THREE.InstancedMesh(kerbGeo, std(0xffffff, 0.65), 140);
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 140; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); mtx.makeTranslation(side * 2.66, 0.02, 7 - k * 0.7); kerbs.setMatrixAt(i, mtx); kerbs.setColorAt(i, col.set(k % 2 ? 0xe8e8e2 : 0xc81d22)); }
  kerbs.receiveShadow = true; scene.add(kerbs);
  const grid = canvasTex(512, 64, (x, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#f2f2ee' : '#16171a'; x.fillRect(i * 32, j * 32, 32, 32); } });
  scene.add(mesh(new THREE.PlaneGeometry(4.6, 0.55).rotateX(-Math.PI / 2), std(0xffffff, 0.7, 0, { map: grid }), 0, 0.008, -3.4, false));

  // ---------- pilas de neumáticos ----------
  const tyreGeo = new THREE.TorusGeometry(0.29, 0.135, 12, 26).rotateX(Math.PI / 2);
  const spots = [];
  for (let i = 0; i < 15; i++) for (const side of [-1, 1]) spots.push([side * (3.15 + rnd() * 0.18), -1.2 - i * 1.15 + rnd() * 0.2, 3 + Math.floor(rnd() * 2)]);
  // montones grandes a los lados del encuadre y detrás
  spots.push([-2.2, 0.55, 4], [-2.75, -0.1, 5], [2.25, 0.4, 3], [2.8, -0.25, 5], [-1.9, -7.8, 3], [1.95, -8.4, 4]);
  const count = spots.reduce((n, s) => n + s[2], 0);
  const tyres = new THREE.InstancedMesh(tyreGeo, std(0xffffff, 0.9), count);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let n = 0;
  spots.forEach(([x, z, h], s) => { for (let k = 0; k < h; k++) { q.setFromEuler(new THREE.Euler(0, rnd() * 6.3, 0)); p.set(x + rnd() * 0.06 - 0.03, 0.14 + k * 0.255, z + rnd() * 0.06 - 0.03); mtx.compose(p, q, one); tyres.setMatrixAt(n, mtx); tyres.setColorAt(n, col.set(k === h - 1 ? [0xb8191f, 0xe6e6e0, 0x1b1c1f, 0xe9ae00][s % 4] : 0x1b1c1f)); n++; } });
  tyres.castShadow = true; tyres.receiveShadow = true; scene.add(tyres);

  // ---------- rueda suelta (neumático, llanta y buje) ----------
  const wheel = (rim = M.chrome) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.23, 0.12, 12, 24), M.rubber), mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 20).rotateX(Math.PI / 2), rim), mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12).rotateX(Math.PI / 2), M.dark));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.19, 8).rotateX(Math.PI / 2), M.dark, Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0)); }
    return g;
  };
  const lean = (x, z, ry, tilt, rim) => { const w = wheel(rim); w.position.y = 0.34; const h = group(x, 0, z, ry, w); w.rotation.x = tilt; scene.add(h); };
  lean(-1.95, 0.95, 0.9, -0.32, M.yellow); lean(2.05, -1.55, -1.1, -0.25, M.chrome); lean(-2.55, -2.9, 1.3, -0.2, M.chrome);

  // ---------- carro de herramientas ----------
  const cart = new THREE.Group();
  cart.add(mesh(new THREE.BoxGeometry(0.95, 0.82, 0.52), M.red, 0, 0.58, 0), mesh(new THREE.BoxGeometry(1.01, 0.05, 0.58), M.dark, 0, 1.01, 0));
  for (let i = 0; i < 4; i++) { cart.add(mesh(new THREE.BoxGeometry(0.88, 0.012, 0.01), M.dark, 0, 0.3 + i * 0.19, 0.263, false), mesh(new THREE.BoxGeometry(0.7, 0.028, 0.035), M.chrome, 0, 0.36 + i * 0.19, 0.275, false)); }
  for (const [cx, cz] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) cart.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 14).rotateZ(Math.PI / 2), M.rubber, cx, 0.085, cz));
  // llaves fijas y vasos encima
  const spanner = () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.42, 0.025, 0.05), M.chrome)); for (const e of [-0.23, 0.23]) { const r = mesh(new THREE.TorusGeometry(0.05, 0.018, 8, 16, Math.PI * 1.5).rotateX(Math.PI / 2), M.chrome, e, 0, 0); r.rotation.y = e < 0 ? 2.4 : -0.7; g.add(r); } return g; };
  [[-0.18, 0.1, 0.3], [0.02, -0.06, -0.15], [0.2, 0.13, 0.55]].forEach(([x, z, a]) => { const s = spanner(); s.position.set(x, 1.05, z); s.rotation.y = a; cart.add(s); });
  for (let i = 0; i < 5; i++) cart.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.09, 12), M.chrome, -0.36 + i * 0.075, 1.08, -0.16));
  cart.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.24, 14), M.blue, 0.36, 1.155, -0.12), mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.06, 8), M.white, 0.36, 1.3, -0.12));
  cart.position.set(-2.15, 0, -1.75); cart.rotation.y = 0.55; scene.add(cart);

  // ---------- bidones ----------
  const jerry = (mat) => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.34, 0.46, 0.19), mat, 0, 0.23, 0), mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 16, Math.PI), mat, -0.03, 0.47, 0), mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), M.dark, 0.11, 0.49, 0)); for (const s of [0.098, -0.098]) for (const a of [0.55, -0.55]) { const rib = mesh(new THREE.BoxGeometry(0.34, 0.025, 0.012), mat, 0, 0.22, s, false); rib.rotation.z = a; g.add(rib); } return g; };
  [[M.red, 2.05, -0.55, -0.5], [M.yellow, 2.42, -0.95, -0.15], [M.blue, -2.5, 0.75, 0.7]].forEach(([m, x, z, a]) => { const j = jerry(m); j.position.set(x, 0, z); j.rotation.y = a; scene.add(j); });

  // ---------- piezas: motor de kart sobre un banco, escape, defensa, eje y volante ----------
  const bench = new THREE.Group();
  bench.add(mesh(new THREE.BoxGeometry(0.85, 0.06, 0.55), M.steel, 0, 0.55, 0));
  for (const [bx, bz] of [[-0.38, -0.23], [0.38, -0.23], [-0.38, 0.23], [0.38, 0.23]]) bench.add(mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), M.dark, bx, 0.275, bz));
  bench.add(mesh(new THREE.BoxGeometry(0.38, 0.2, 0.3), M.dark, -0.08, 0.68, 0));
  for (let i = 0; i < 7; i++) bench.add(mesh(new THREE.BoxGeometry(0.28, 0.016, 0.28), M.steel, -0.08, 0.8 + i * 0.034, 0));
  bench.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), M.chrome, -0.08, 1.08, 0), mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 18).rotateZ(Math.PI / 2), M.chrome, 0.17, 0.69, 0));
  bench.add(tube([[0.05, 0.86, 0.12], [0.32, 0.92, 0.2], [0.42, 0.72, 0.28], [0.2, 0.64, 0.3], [-0.25, 0.63, 0.3]], 0.045, M.chrome), mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 14).rotateZ(Math.PI / 2), M.steel, -0.36, 0.63, 0.3));
  bench.position.set(2.55, 0, -4.9); bench.rotation.y = -0.65; scene.add(bench);
  const bumper = tube([[-0.7, 0.06, 0], [-0.62, 0.06, 0.28], [0, 0.06, 0.38], [0.62, 0.06, 0.28], [0.7, 0.06, 0]], 0.035, M.chrome);
  bumper.position.set(-1.9, 0, -0.55); bumper.rotation.y = 1.15; scene.add(bumper);
  const axle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 12).rotateZ(Math.PI / 2), M.steel, 1.95, 0.06, 1.05); axle.rotation.y = 0.8; scene.add(axle);
  const helm = new THREE.Group(); helm.add(mesh(new THREE.TorusGeometry(0.2, 0.034, 10, 28), M.dark), mesh(new THREE.BoxGeometry(0.4, 0.045, 0.03), M.steel), mesh(new THREE.BoxGeometry(0.045, 0.2, 0.03), M.steel, 0, -0.1, 0), mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateX(Math.PI / 2), M.yellow));
  helm.position.set(1.9, 0.21, 0.3); helm.rotation.set(-0.35, -0.75, 0); scene.add(helm);
  // conos
  for (const [cx, cz] of [[-2.05, -4.6], [2.1, -5.2], [-2.1, -9.5]]) scene.add(group(cx, 0, cz, 0, mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), M.dark, 0, 0.02, 0), mesh(new THREE.ConeGeometry(0.13, 0.46, 16), std(0xff6a00, 0.6), 0, 0.27, 0), mesh(new THREE.CylinderGeometry(0.064, 0.082, 0.09, 16), M.white, 0, 0.25, 0, false)));

  // ---------- arco, banderines y focos ----------
  const banner = canvasTex(1024, 192, (x, w, h) => {
    x.fillStyle = '#101216'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w / 48 + 1; i++) { x.fillStyle = i % 2 ? '#fff' : '#dc1f17'; x.beginPath(); x.moveTo(i * 48, h); x.lineTo(i * 48 + 24, h - 26); x.lineTo(i * 48 + 72, h - 26); x.lineTo(i * 48 + 48, h); x.fill(); }
    x.font = 'italic 800 116px KartDisplay, Impact, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left';
    const a = 'Kartlos', b = 'App', wa = x.measureText(a).width, wt = wa + x.measureText(b).width, x0 = (w - wt) / 2;
    x.fillStyle = '#fff'; x.fillText(a, x0, 78); x.fillStyle = '#ffc400'; x.fillText(b, x0 + wa, 78);
  });
  for (const gx of [-3.7, 3.7]) { scene.add(mesh(new THREE.BoxGeometry(0.2, 3.9, 0.2), M.dark, gx, 1.95, -10.5)); }
  scene.add(mesh(new THREE.BoxGeometry(7.6, 1.05, 0.16), M.dark, 0, 3.75, -10.5), mesh(new THREE.PlaneGeometry(5.6, 1.0), new THREE.MeshBasicMaterial({ map: banner }), 0, 3.75, -10.41, false));
  const flagCols = [0xdc1f17, 0xffffff, 0xffc400, 0x1f6fe0], tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.28, 0], 3)); tri.computeVertexNormals();
  const pennants = [];
  for (const [za, y0] of [[-7, 3.05], [-14, 3.4]]) for (let i = 0; i <= 24; i++) { const t = i / 24, f = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({ color: flagCols[i % 4], side: THREE.DoubleSide })); f.position.set(-4.6 + t * 9.2, y0 - Math.sin(t * Math.PI) * 0.42, za); scene.add(f); pennants.push(f); }
  const glowTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(0.25, 'rgba(255,226,160,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  for (const [fx, fz] of [[-4.4, -5.5], [4.4, -5.5], [-4.8, -16], [4.8, -16]]) {
    scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.8, 10), M.steel, fx, 2.4, fz, false), mesh(new THREE.BoxGeometry(0.7, 0.36, 0.14), M.dark, fx, 4.86, fz, false), mesh(new THREE.PlaneGeometry(0.6, 0.26), new THREE.MeshBasicMaterial({ color: 0xfff2cf }), fx, 4.86, fz + 0.08, false));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); s.position.set(fx, 4.86, fz + 0.2); s.scale.setScalar(2.2); scene.add(s);
  }
  // valla y neumáticos de fondo
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), M.steel, 44);
  for (let i = 0; i < 44; i++) { mtx.makeTranslation((i % 2 ? 1 : -1) * 4.1, 0.75, 1 - Math.floor(i / 2) * 1.2); post.setMatrixAt(i, mtx); }
  scene.add(post);
  const mesh2 = canvasTex(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(205,212,224,.55)'; x.lineWidth = 2; for (let i = -64; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); } }, { repeat: [60, 4] });
  for (const fx of [-4.1, 4.1]) { const net = mesh(new THREE.PlaneGeometry(27, 1.3), new THREE.MeshBasicMaterial({ map: mesh2, transparent: true, depthWrite: false, side: THREE.DoubleSide }), fx, 0.8, -11.5, false); net.rotation.y = Math.PI / 2; scene.add(net); }

  // ---------- naves del polígono y cielo de atardecer ----------
  const windows = (base) => canvasTex(256, 128, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { x.fillStyle = rnd() > 0.45 ? '#ffd98a' : '#232838'; x.fillRect(10 + i * 27, 26, 18, 22); } x.fillStyle = '#1b1e28'; x.fillRect(96, 70, 64, 58); x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 8; i++) x.fillRect(96, 74 + i * 7, 64, 2); });
  const sheds = [[-13, -24, 11, 4.2], [-3.5, -31, 9, 3.4], [6.5, -27, 10, 5], [15, -21, 8, 3.8], [-18, -12, 7, 3.2], [18, -9, 7, 3.6]];
  sheds.forEach(([x, z, w, h], i) => {
    const tone = ['#6b4a44', '#55606e', '#7a756b', '#4d5566'][i % 4];
    const s = mesh(new THREE.BoxGeometry(w, h, 4), std(0xffffff, 0.9, 0, { map: windows(tone), emissive: 0xffffff, emissiveMap: windows('#000000'), emissiveIntensity: 0.35 }), x, h / 2, z, false); scene.add(s);
    scene.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.3, 4.4), M.dark, x, h + 0.12, z, false));
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(16, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1230'); g.addColorStop(0.3, '#232a55'); g.addColorStop(0.43, '#6a4a72'); g.addColorStop(0.49, '#e2795a'); g.addColorStop(0.52, '#ffb05c'); g.addColorStop(0.56, '#5a3d48'); g.addColorStop(1, '#15131a'); x.fillStyle = g; x.fillRect(0, 0, w, h); }) }));
  scene.add(sky);
  return { glowTex, pennants };
}
