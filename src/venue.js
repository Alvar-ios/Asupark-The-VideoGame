// Vallas publicitarias de PalomApp (casi todos los circuitos) y torres de focos de estadio para los circuitos nocturnos.
import * as THREE from 'three';
import { WALL } from './track.js';
import { getSponsorTexture } from './sponsors.js';

const PALOM_IDX = 4; // textura de PalomApp dentro de SPONSOR_DATA

// Vallas exentas a ambos lados, ligeramente giradas hacia el piloto que se acerca. Se ven de lejos y se iluminan de noche.
export function palomappBoards(tr, th, scene, q) {
  const tex = getSponsorTexture(PALOM_IDX);
  if (!tex) return;
  const N = tr.N, night = !!th.night, dens = th.privateClub ? 140 : 95;
  const W = 11, H = 2.75, lift = 2.3;
  const body = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.6, metalness: 0.4 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: night ? 0.95 : 0.1 });
  const mats = [body, body, body, body, face, body];
  const boardG = new THREE.BoxGeometry(W, H, 0.25), postG = new THREE.BoxGeometry(0.28, lift + H * 0.5, 0.28).translate(0, (lift + H * 0.5) / 2, 0);
  const frameG = new THREE.BoxGeometry(W + 0.35, H + 0.35, 0.18);
  const near = (x, z, minD) => { for (let j = 0; j < N; j += 4) if ((tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2 < minD * minD) return true; return false; };
  const tun = (s) => (tr.tunnels || []).some((t) => s > t.s0 - 15 && s < t.s1 + 15);
  const G = new THREE.Group(); scene.add(G);
  let k = 0;
  for (let s = 45; s < tr.len - 40; s += dens) {
    const i = Math.floor(s / tr.ds) % N;
    if (Math.abs(tr.kap[i]) > 0.012 || tun(s)) continue;
    const side = k++ % 2 ? -1 : 1, tx = tr.TX[i], tz = tr.TZ[i], lat = WALL + 3.2;
    const x = tr.X[i] + -tz * lat * side, z = tr.Z[i] + tx * lat * side;
    // el resto del trazado no debe quedar a menos de ~11 m (circuitos que se cruzan o pasan cerca de sí mismos)
    let clash = false;
    for (let j = 0; j < N; j += 4) { const d2 = (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2; if (d2 < 8 * 8 && Math.abs(j * tr.ds - s) > 40) { clash = true; break; } }
    if (clash) continue;
    const a = 0.5, ix = tz * side, iz = -tx * side; // hacia la pista
    const nx = ix * Math.cos(a) - tx * Math.sin(a), nz = iz * Math.cos(a) - tz * Math.sin(a), yaw = Math.atan2(nx, nz), y0 = tr.Y[i];
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = yaw;
    const b = new THREE.Mesh(boardG, mats); b.position.y = lift + H / 2; b.castShadow = !!q.shadows; g.add(b);
    const fr = new THREE.Mesh(frameG, body); fr.position.set(0, lift + H / 2, -0.06); g.add(fr);
    for (const px of [-W * 0.38, W * 0.38]) { const p = new THREE.Mesh(postG, body); p.position.set(px, 0, -0.2); p.castShadow = !!q.shadows; g.add(p); }
    G.add(g);
  }
}

// Torres de focos tipo estadio / circuito urbano nocturno: panel de proyectores, haz de luz visible y charco de luz sobre el asfalto.
export function nightFloodlights(tr, th, scene, q, glowTex) {
  const N = tr.N, D = new THREE.Object3D(), spacing = 52, pH = 17;
  const towers = [];
  const tun = (s) => (tr.tunnels || []).some((t) => s > t.s0 - 20 && s < t.s1 + 20);
  let k = 0;
  for (let s = 20; s < tr.len - 20; s += spacing) {
    const i = Math.floor(s / tr.ds) % N;
    if (tun(s)) continue;
    const side = k++ % 2 ? -1 : 1, tx = tr.TX[i], tz = tr.TZ[i], lat = WALL + 7;
    const x = tr.X[i] + -tz * lat * side, z = tr.Z[i] + tx * lat * side;
    let clash = false;
    for (let j = 0; j < N; j += 4) { const d2 = (tr.X[j] - x) ** 2 + (tr.Z[j] - z) ** 2; if (d2 < 6.5 * 6.5 && Math.abs(j * tr.ds - s) > 40) { clash = true; break; } }
    if (clash) continue;
    towers.push({ x, y: tr.Y[i], z, i, side, cx: tr.X[i], cy: tr.Y[i], cz: tr.Z[i], tx, tz });
  }
  if (!towers.length) return;
  const n = towers.length;
  // postes
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.46, pH, 8).translate(0, pH / 2, 0), new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.6, metalness: 0.5 }), n);
  // cabezal: marco oscuro + panel emisivo de 2x3 proyectores (un único Mesh con la cara delantera brillante)
  const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 2.9, 0.35), new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.5, metalness: 0.6 }), n);
  const lampG = new THREE.CircleGeometry(0.62, 14);
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff6e0, side: THREE.DoubleSide });
  const lamps = new THREE.InstancedMesh(lampG, lampM, n * 6);
  // haz de luz (cono abierto con degradado de apex a base) y charco de luz en el suelo
  const cone = new THREE.ConeGeometry(5.5, 1, 28, 1, true).translate(0, -0.5, 0); // apex en el origen, base hacia -Y; se escala a la longitud del haz
  const cc = [], cp = cone.attributes.position;
  for (let v = 0; v < cp.count; v++) { const f = Math.min(1, -cp.getY(v)); cc.push(1 - f * 0.9, 1 - f * 0.9, 1 - f * 0.9); }
  cone.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  const beams = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: 0xffe7b8, vertexColors: true, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }), n);
  const pc = document.createElement('canvas'); pc.width = pc.height = 128; const px = pc.getContext('2d'); px.fillStyle = '#000'; px.fillRect(0, 0, 128, 128);
  const pg = px.createRadialGradient(64, 64, 0, 64, 64, 64); pg.addColorStop(0, '#fff'); pg.addColorStop(0.35, '#7a7a7a'); pg.addColorStop(0.7, '#202020'); pg.addColorStop(1, '#000'); px.fillStyle = pg; px.fillRect(0, 0, 128, 128);
  const poolTex = new THREE.CanvasTexture(pc);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffdca0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), n);
  const glowMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff0cc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95 });
  let lk = 0;
  towers.forEach((t, a) => {
    const hx = t.x, hy = t.y + pH + 1.2, hz = t.z;
    D.position.set(t.x, t.y, t.z); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); D.updateMatrix(); pm.setMatrixAt(a, D.matrix);
    // el panel mira hacia el centro de la pista (ligeramente adelantado)
    const tgx = t.cx + t.tx * 6, tgy = t.cy, tgz = t.cz + t.tz * 6, yaw = Math.atan2(tgx - hx, tgz - hz);
    const dist = Math.hypot(tgx - hx, tgy - hy, tgz - hz), pitch = Math.asin((hy - tgy) / dist);
    D.position.set(hx, hy, hz); D.rotation.set(pitch, yaw, 0, 'YXZ'); D.scale.set(1, 1, 1); D.updateMatrix(); frame.setMatrixAt(a, D.matrix);
    const M = D.matrix.clone();
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const lm = new THREE.Matrix4().makeTranslation((c - 1) * 1.4, (r - 0.5) * 1.25, 0.2); lamps.setMatrixAt(lk++, M.clone().multiply(lm));
    }
    // haz: del cabezal al centro de la pista
    const dir = new THREE.Vector3(tgx - hx, tgy - hy, tgz - hz).normalize(), q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    D.position.set(hx, hy, hz); D.quaternion.copy(q0); D.scale.set(1, dist, 1); D.updateMatrix(); beams.setMatrixAt(a, D.matrix); D.quaternion.identity();
    D.rotation.set(0, Math.atan2(t.tx, t.tz), 0); D.position.set(tgx, tgy + 0.07, tgz); D.scale.set(34, 1, 24); D.updateMatrix(); pools.setMatrixAt(a, D.matrix);
    const sp = new THREE.Sprite(glowMat); sp.position.set(hx, hy, hz); sp.scale.set(24, 24, 1); sp.renderOrder = 2; scene.add(sp);
  });
  for (const m of [pm, frame, lamps, beams, pools]) { m.frustumCulled = false; scene.add(m); }
  beams.renderOrder = 1; pools.renderOrder = 1;
}
