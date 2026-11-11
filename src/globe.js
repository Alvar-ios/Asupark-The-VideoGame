import * as THREE from 'three';
import { WORLD_EQ } from './worldmap.js';

// Globo terráqueo 3D para el selector de circuitos: se arrastra y se orienta/acerca al continente elegido.
// Los pines son etiquetas DOM proyectadas cada frame; las que se pisan se separan solas y una línea las une a su sitio real.
const D = Math.PI / 180;
export const ll2v = (lat, lon, r = 1) => { const ph = (lon + 180) * D, th = (90 - lat) * D; return new THREE.Vector3(-Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r); };

function earthTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const sea = x.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#0d3a6b'); sea.addColorStop(.5, '#0a4f8f'); sea.addColorStop(1, '#0d3a6b');
  x.fillStyle = sea; x.fillRect(0, 0, W, H);
  const land = new Path2D(WORLD_EQ), g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#e8eef2'); g.addColorStop(.12, '#8fa57a'); g.addColorStop(.3, '#5f8f4a'); g.addColorStop(.42, '#b9a566'); g.addColorStop(.5, '#4f9a3d'); g.addColorStop(.62, '#6fa04a'); g.addColorStop(.8, '#b7b08a'); g.addColorStop(.93, '#eef2f4'); g.addColorStop(1, '#ffffff');
  x.lineJoin = 'round'; x.shadowColor = 'rgba(120,200,255,.55)'; x.shadowBlur = 10; x.fillStyle = g; x.fill(land); x.shadowBlur = 0;
  x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1.4; x.stroke(land);
  x.strokeStyle = 'rgba(190,225,255,.16)'; x.lineWidth = 1; x.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) { const px = (lon + 180) / 360 * W; x.moveTo(px, 0); x.lineTo(px, H); }
  for (let lat = -75; lat <= 75; lat += 15) { const py = (90 - lat) / 180 * H; x.moveTo(0, py); x.lineTo(W, py); }
  x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function createGlobe(host) {
  const cv = document.createElement('canvas'); cv.className = 'gl-cv'; host.prepend(cv);
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); R.setClearColor(0, 0); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 20), grp = new THREE.Group(); scene.add(grp);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map: earthTexture() })); grp.add(earth);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {}, vertexShader: 'varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 n;void main(){float i=pow(.72-dot(n,vec3(0,0,1.)),3.);gl_FragColor=vec4(.3,.6,1.,1.)*i*1.6;}' })); scene.add(glow);
  scene.add(new THREE.AmbientLight(0xaac4ff, .75)); const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-2.5, 1.6, 3); scene.add(sun);
  const st = { lat: 30, lon: 10, zCam: 4.4, pins: [], t0: performance.now(), yawOff: 0, latOff: 0, drag: null, vis: false, cur: { a: 0, b: 0, z: 4.4 }, w: 0, h: 0 };
  const lineLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lineLayer.setAttribute('class', 'gl-lines'); host.appendChild(lineLayer);
  const pinLayer = document.createElement('div'); pinLayer.className = 'gl-pins'; host.appendChild(pinLayer);

  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h || (w === st.w && h === st.h)) return; st.w = w; st.h = h; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host);

  const tgt = () => { return { a: -(90 + st.lon) * D + st.yawOff, b: Math.max(-1.2, Math.min(1.2, (st.lat + st.latOff) * D)), z: st.zCam }; };
  const proj = new THREE.Vector3(), nrm = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!host.offsetParent) return; resize(); if (!st.w) return;
    const dt = Math.min(.25, (now - (st.last || now)) / 1000); st.last = now; const T = tgt(), k = 1 - Math.exp(-dt * (st.drag ? 18 : 4.5)), kz = 1 - Math.exp(-dt * 3.5), c = st.cur;
    c.a += (T.a - c.a) * k; c.b += (T.b - c.b) * k; c.z += (T.z - c.z) * kz;
    grp.rotation.set(c.b, c.a, 0);
    // desplazar el globo a la izquierda en pantallas anchas para dejar sitio al panel
    const sx = host.clientWidth > 640 && !document.body.classList.contains('mobile') ? .15 * 2 * c.z * Math.tan(16 * D) * (st.w / st.h) : 0; cam.position.set(sx, 0, c.z); cam.lookAt(sx, 0, 0);
    cam.updateMatrixWorld(); grp.updateMatrixWorld();
    R.render(scene, cam);
    // etiquetas: parten justo encima de su punto y las que se pisan se apartan; cálculo determinista para que no tiemblen
    const shown = [], panel = host.parentElement && host.parentElement.querySelector('#contPanel'), maxX = panel && getComputedStyle(panel).position === 'absolute' ? st.w - panel.offsetWidth - 16 : st.w;
    for (const p of st.pins) {
      p.v.copy(p.base).applyMatrix4(grp.matrixWorld); nrm.copy(p.v).normalize();
      const vis = nrm.dot(cam.position.clone().sub(p.v).normalize()) > .12;
      proj.copy(p.v).project(cam);
      p.ax = (proj.x * .5 + .5) * st.w; p.ay = (-proj.y * .5 + .5) * st.h;
      p.el.style.opacity = vis ? 1 : 0; p.el.style.pointerEvents = vis ? 'auto' : 'none'; p.line.style.opacity = vis ? 1 : 0; p.dot.style.opacity = vis ? 1 : 0;
      if (!vis) continue;
      if (!p.w) { p.w = p.el.offsetWidth; p.h = p.el.offsetHeight; }
      p.tx = p.ax; p.ty = p.ay - 16 - p.h / 2; shown.push(p);
    }
    shown.sort((a, b) => a.ax - b.ax || a.ay - b.ay);
    const clampP = (p) => { p.tx = Math.max(p.w / 2 + 4, Math.min(maxX - p.w / 2 - 4, p.tx)); p.ty = Math.max(p.h / 2 + 4, Math.min(st.h - p.h / 2 - 4, p.ty)); };
    for (let it = 0; it < 90; it++) {
      for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i], b = shown[j], dx = a.tx - b.tx, dy = a.ty - b.ty, ox = (a.w + b.w) / 2 + 5 - Math.abs(dx), oy = (a.h + b.h) / 2 + 5 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (oy < ox) { const s = (dy || (a.ay - b.ay) || -1) < 0 ? -1 : 1; a.ty += s * oy / 2; b.ty -= s * oy / 2; }
        else { const s = (dx || -1) < 0 ? -1 : 1; a.tx += s * ox / 2; b.tx -= s * ox / 2; }
      }
      shown.forEach(clampP);
    }
    const kp = 1 - Math.exp(-dt * 14);
    for (const p of shown) {
      if (p.x == null) { p.x = p.tx; p.y = p.ty; } else { p.x += (p.tx - p.x) * kp; p.y += (p.ty - p.y) * kp; }
      p.el.style.transform = `translate(${(p.x - p.w / 2).toFixed(1)}px,${(p.y - p.h / 2).toFixed(1)}px)`; p.el.style.zIndex = p.on ? 5 : 3;
      p.line.setAttribute('x1', p.ax); p.line.setAttribute('y1', p.ay); p.line.setAttribute('x2', p.x); p.line.setAttribute('y2', p.y);
      p.dot.setAttribute('cx', p.ax); p.dot.setAttribute('cy', p.ay);
    }
  }
  requestAnimationFrame(frame);

  host.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; st.drag = { x: e.clientX, y: e.clientY, yo: st.yawOff, lo: st.latOff }; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointermove', (e) => { if (!st.drag) return; st.yawOff = st.drag.yo + (e.clientX - st.drag.x) * .008; st.latOff = st.drag.lo + (e.clientY - st.drag.y) * .25; });
  const up = () => { st.drag = null; }; host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);

  return {
    focus(lat, lon, zCam) { if (st.lat !== lat || st.lon !== lon) { st.yawOff = 0; st.latOff = 0; } st.lat = lat; st.lon = lon; st.zCam = zCam || 4.4; },
    setPins(list) {
      pinLayer.innerHTML = ''; lineLayer.innerHTML = ''; const NS = 'http://www.w3.org/2000/svg';
      st.pins = list.map((p) => { const el = document.createElement('button'); el.type = 'button'; el.className = 'gl-pin' + (p.on ? ' on' : ''); el.title = p.title; el.setAttribute('aria-label', p.title); el.innerHTML = p.html + (p.label ? `<span>${p.label}</span>` : ''); el.onclick = p.onClick; pinLayer.appendChild(el);
        const line = document.createElementNS(NS, 'line'), dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', p.on ? 4 : 3); if (p.on) { line.setAttribute('class', 'on'); dot.setAttribute('class', 'on'); } lineLayer.append(line, dot);
        return { el, line, dot, on: p.on, base: ll2v(p.lat, p.lon, 1.005), v: new THREE.Vector3() }; });
    },
  };
}
