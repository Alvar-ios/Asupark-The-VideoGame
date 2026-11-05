// Kart procedural (sin modelos externos): chasis tubular, carenados, asiento, motor, volante y piloto con casco.
// Misma forma de salida que buildModelCar: { root, tilt, wheels, tail, flames, W, paint, paints }. El kart mira hacia +Z.
import * as THREE from 'three';

const box = (w, h, d, x, y, z, mat, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

export function buildKart(color, opts = {}) {
  const root = new THREE.Group(), tilt = new THREE.Group(), body = new THREE.Group();
  root.add(tilt); tilt.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.7, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.3, metalness: 0.85 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.92, metalness: 0 });
  const rim = new THREE.MeshStandardMaterial({ color: opts.rim || 0xd9dde3, roughness: 0.35, metalness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const tail = new THREE.MeshBasicMaterial({ color: 0x8a0f0f });
  // chasis y suelo
  box(0.86, 0.06, 1.62, 0, 0.17, 0.02, dark, body);
  box(0.06, 0.07, 1.5, -0.3, 0.2, 0, chrome, body); box(0.06, 0.07, 1.5, 0.3, 0.2, 0, chrome, body);
  // morro y paragolpes delantero
  const nose = box(0.6, 0.14, 0.34, 0, 0.27, 0.86, paint, body); nose.rotation.x = -0.12;
  box(1.1, 0.09, 0.08, 0, 0.2, 1.0, dark, body);
  // carenados laterales (pontones)
  for (const s of [-1, 1]) { const pod = box(0.2, 0.2, 0.74, s * 0.56, 0.3, 0.06, paint, body); pod.rotation.y = s * 0.04; box(0.2, 0.04, 0.5, s * 0.56, 0.41, 0.1, white, body); }
  // paragolpes trasero
  box(1.2, 0.09, 0.08, 0, 0.26, -0.98, dark, body); box(0.26, 0.12, 0.05, 0, 0.34, -0.96, tail, body);
  // asiento, respaldo y motor
  box(0.48, 0.07, 0.46, 0, 0.3, -0.2, paint, body);
  const back = box(0.5, 0.42, 0.08, 0, 0.5, -0.44, paint, body); back.rotation.x = -0.12;
  box(0.34, 0.26, 0.3, 0.22, 0.34, -0.68, chrome, body); box(0.1, 0.1, 0.4, 0.2, 0.34, -0.9, chrome, body);
  // columna y volante
  const col = box(0.05, 0.05, 0.42, 0, 0.42, 0.42, chrome, body); col.rotation.x = 0.5;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16), dark); wheel.position.set(0, 0.56, 0.26); wheel.rotation.x = 1.0; body.add(wheel);
  // piloto: torso, brazos, casco
  const suit = new THREE.MeshStandardMaterial({ color: opts.suit || 0x2b2f38, roughness: 0.7 });
  box(0.34, 0.4, 0.2, 0, 0.62, -0.2, suit, body);
  for (const s of [-1, 1]) { const arm = box(0.08, 0.08, 0.34, s * 0.2, 0.62, 0.0, suit, body); arm.rotation.x = 0.35; }
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), new THREE.MeshStandardMaterial({ color: opts.helmet || 0xffffff, roughness: 0.25, metalness: 0.2 }));
  helm.position.set(0, 0.96, -0.2); helm.castShadow = true; body.add(helm);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 12, 8, -0.9, 1.8, 0.95, 0.75), new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.1, metalness: 0.6 }));
  visor.position.copy(helm.position); visor.rotation.y = 0; body.add(visor);
  // número delantero (placa)
  box(0.3, 0.2, 0.02, 0, 0.5, 0.99, white, body);
  // ruedas: pivote (dirección) → giro; eje X
  const wheels = [];
  const mk = (x, z, r, w) => {
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.set(x, r, z); body.add(pivot); pivot.add(spin);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18).rotateZ(Math.PI / 2), tire); t.castShadow = true; spin.add(t);
    const rm = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.01, 12).rotateZ(Math.PI / 2), rim); spin.add(rm);
    const nub = box(0.02, r * 1.1, 0.03, x < 0 ? -w * 0.5 - 0.005 : w * 0.5 + 0.005, 0, 0, white, spin); nub.position.x = (x < 0 ? -1 : 1) * (w * 0.5 + 0.006); // marca para ver el giro
    return { pivot, spin, front: z > 0 };
  };
  wheels.push(mk(-0.58, 0.68, 0.13, 0.14), mk(0.58, 0.68, 0.13, 0.14), mk(-0.64, -0.62, 0.15, 0.22), mk(0.64, -0.62, 0.15, 0.22));
  const flames = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  flames.add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.8, 8).rotateX(-Math.PI / 2).translate(0.2, 0.34, -1.4), fm));
  flames.visible = false; tilt.add(flames);
  return { root, tilt, wheels, tail, flames, W: 1.3, paint, paints: new Set([paint]) };
}
