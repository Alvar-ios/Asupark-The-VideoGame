// Física arcade del coche (sin dependencias de three)
import { ROAD_HALF, WALL, setRoad, locate, pointAt, wrapPi } from './track.js';
import { puddleAt, mudAt, smoothstep, surfaceAt } from './surface.js';
const SP = { key: 'asphalt', g: 1, b: 1, d: 0, s: 1, a: 1 };

export const YAW_SCALE = 0.8, YAW_SPEED = 42; // sensibilidad de giro global
export const GROUPS = [
  { id: 'cartoon', name: 'Cartoon', desc: 'Coches de dibujos: pura diversión' },
  { id: 'cv100', name: '100 CV', desc: 'Utilitarios y familiares' },
  { id: 'cv150', name: '150 CV', desc: 'Deportivos compactos' },
  { id: 'cv200', name: '200 CV', desc: 'Deportivos potentes' },
  { id: 'competicion', name: 'Competición', desc: 'Deportivos de altas prestaciones' },
  { id: 'f1', name: 'F1', desc: 'Monoplazas' },
];
export const G = 14; // gravedad "flotante" arcade
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const CARS = [
  // —— Cartoon: coches de dibujos, ágiles y divertidos
  { id: 'minitoon', brand: 'Mini', group: 'cartoon', name: 'Mini Clásico Toon', desc: 'Minúsculo y juguetón: gira como un kart', color: 0xd32a22, vmax: 51, accel: 13.6, yaw: 3.1, grip: 14, driftGrip: 3.1, radius: 1.0, mass: 780, kind: 'minitoon', paints: [['Rojo', '#d32a22'], ['Amarillo', '#f3c026'], ['Azul', '#2d5fd0']], custom: true },
  { id: 'gtr', brand: 'Nissan', group: 'cartoon', drive: 'rwd', name: 'Nissan Skyline GT-R Toon', desc: 'Turbo con cabeza grande: derrapa con ganas', color: 0x1f4fd0, vmax: 54, accel: 14.2, yaw: 2.8, grip: 13.2, driftGrip: 3.0, radius: 1.2, mass: 1100, kind: 'gtr', paints: [['Azul', '#1f4fd0'], ['Plata', '#b9bec6'], ['Negro', '#16181d']], custom: true },
  { id: 'f360', brand: 'Ferrari', group: 'cartoon', drive: 'rwd', name: 'Ferrari 360 Toon', desc: 'Rojo y gordito: V8 que grita', color: 0xd32a22, vmax: 55, accel: 14.5, yaw: 2.8, grip: 13, driftGrip: 2.9, radius: 1.2, mass: 1000, kind: 'f360', paints: [['Rojo', '#d32a22'], ['Amarillo', '#f3c026'], ['Negro', '#16181d']], custom: true },
  { id: 'mclaren', brand: 'McLaren', group: 'cartoon', name: 'McLaren MP4-25 Toon', desc: 'Monoplaza de dibujos: ruedas enormes y mucho agarre', color: 0xc8202c, vmax: 56, accel: 14.7, yaw: 2.85, grip: 13.5, driftGrip: 2.9, radius: 1.2, mass: 700, kind: 'mclaren', nopaint: true, custom: true },
  // —— 100 CV
  { id: 'qashqai', brand: 'Nissan', group: 'cv100', name: 'Nissan Qashqai', desc: 'SUV pesado y estable', color: 0xf7f7f7, vmax: 51, accel: 12.4, yaw: 2.1, grip: 14, driftGrip: 2.3, radius: 1.3, mass: 1780, kind: 'qashqai', paints: [['Blanco', '#f7f7f7'], ['Gris', '#6b7280'], ['Rojo', '#b3171d']], custom: true },
  { id: 'bora', brand: 'Volkswagen', group: 'cv100', name: 'VW Bora VR6', desc: 'Berlina 2005 · estable y noble', color: 0x0b4d2c, vmax: 52, accel: 12.8, yaw: 2.3, grip: 13.4, driftGrip: 2.7, radius: 1.2, mass: 1460, kind: 'bora', paints: [['Verde botella', '#0b4d2c'], ['Negro', '#16181d'], ['Plata', '#b9bec6']], custom: true },
  { id: 'cupra', brand: 'Cupra', group: 'cv100', name: 'Cupra León', desc: 'Compacto deportivo: mucho agarre', color: 0x193078, vmax: 53, accel: 13.2, yaw: 2.5, grip: 13.6, driftGrip: 2.6, radius: 1.2, mass: 1460, kind: 'cupra', paints: [['Azul', '#193078'], ['Gris', '#6b7280'], ['Blanco', '#f2f2f2']], custom: true },
  // —— 150 CV
  { id: 'golf', brand: 'Volkswagen', group: 'cv150', name: 'VW Golf GTI Mk1', desc: 'Ligero y noble: 110 CV de pura escuela', color: 0xf2f2f2, vmax: 53, accel: 13.6, yaw: 2.75, grip: 13.6, driftGrip: 2.8, radius: 1.1, mass: 820, kind: 'golf', paints: [['Blanco', '#f2f2f2'], ['Rojo', '#b3171d'], ['Azul', '#1f4fd0']], custom: true },
  { id: 'mini', brand: 'Mini', group: 'cv150', name: 'Mini Cooper S Clubman', desc: 'Pequeño y nervioso: gira como un kart', color: 0xf7f7f7, vmax: 54, accel: 14, yaw: 2.8, grip: 13.6, driftGrip: 3.0, radius: 1.1, mass: 1390, kind: 'mini', paints: [['Blanco', '#f7f7f7'], ['Rojo', '#b3171d'], ['Azul', '#2d5fd0']], custom: true },
  { id: 'mx5', brand: 'Mazda', group: 'cv150', drive: 'rwd', name: 'Mazda MX-5 NA', desc: 'Roadster ligero de tracción trasera', color: 0xd32a22, vmax: 54, accel: 13.9, yaw: 2.9, grip: 13.6, driftGrip: 3.0, radius: 1.1, mass: 960, kind: 'mx5', paints: [['Rojo', '#d32a22'], ['Azul', '#1f4fd0'], ['Blanco', '#f2f2f2']], custom: true },
  { id: 'z240', brand: 'Nissan', group: 'cv150', drive: 'rwd', name: 'Nissan Fairlady Z 240Z', desc: 'Clásico japonés: 6 en línea y tracción trasera', color: 0xa11d1d, vmax: 55, accel: 14.2, yaw: 2.6, grip: 12.9, driftGrip: 2.8, radius: 1.2, mass: 1070, kind: 'z240', paints: [['Rojo', '#a11d1d'], ['Naranja', '#e07b17'], ['Blanco', '#f2f2f2']], custom: true },
  { id: 'mustang', brand: 'Ford', group: 'cv150', drive: 'rwd', name: 'Ford Mustang 1965', desc: 'Muscle car con V8: mucho par, poco agarre', color: 0x14206a, vmax: 56, accel: 14.6, yaw: 2.25, grip: 11.9, driftGrip: 2.6, radius: 1.3, mass: 1250, kind: 'mustang', paints: [['Azul', '#14206a'], ['Rojo', '#b3171d'], ['Blanco', '#f2f2f2']], custom: true },
  // —— 200 CV
  { id: 's4', brand: 'Audi', group: 'cv200', name: 'Audi S4 2013', desc: 'Tracción total y compresor: sale como un tiro', color: 0xd32a22, vmax: 58, accel: 15.3, yaw: 2.5, grip: 14, driftGrip: 2.5, radius: 1.3, mass: 1700, kind: 's4', paints: [['Rojo', '#d32a22'], ['Gris', '#6b7280'], ['Negro', '#16181d']], custom: true },
  { id: 'm3', brand: 'BMW', group: 'cv200', drive: 'rwd', name: 'BMW M3 E46', desc: 'Tracción trasera, ágil y rabioso', color: 0x0070ed, vmax: 58, accel: 15.2, yaw: 2.5, grip: 12.5, driftGrip: 2.7, radius: 1.2, mass: 1570, kind: 'm3', paints: [['Azul', '#0070ed'], ['Negro', '#16181d'], ['Plata', '#b9bec6']], custom: true },
  { id: 'porsche', brand: 'Porsche', group: 'cv200', drive: 'rwd', name: 'Porsche 911 Turbo S', desc: 'Rapidísimo, motor trasero: cuidado al frenar', color: 0x0a1a28, vmax: 59, accel: 15.6, yaw: 2.85, grip: 12.6, driftGrip: 2.9, radius: 1.2, mass: 1510, kind: 'porsche', paints: [['Azul noche', '#0a1a28'], ['Plata', '#b9bec6'], ['Rojo', '#b3171d']], custom: true },
  { id: 'cobra', brand: 'AC', group: 'cv200', drive: 'rwd', name: 'AC Cobra 427', desc: 'V8 de 7 litros en un coche diminuto: brutal', color: 0x9a1b1b, vmax: 59, accel: 16, yaw: 2.7, grip: 11.9, driftGrip: 2.7, radius: 1.2, mass: 1150, kind: 'cobra', paints: [['Rojo', '#9a1b1b'], ['Azul', '#1f4fd0'], ['Verde', '#0b4d2c']], custom: true },
  // —— Competición
  { id: 'stradale', brand: 'Alfa Romeo', group: 'competicion', drive: 'rwd', name: 'Alfa Romeo 33 Stradale', desc: 'Motor central, 700 kg y un grito de V8', color: 0xb3171d, vmax: 63, accel: 16.5, yaw: 3.0, grip: 13.5, driftGrip: 3.0, radius: 1.1, mass: 700, kind: 'stradale', paints: [['Rojo', '#b3171d'], ['Plata', '#b9bec6'], ['Azul', '#1f4fd0']], custom: true },
  { id: 'slr', brand: 'Mercedes-Benz', group: 'competicion', drive: 'rwd', name: 'Mercedes SLR Stirling Moss', desc: 'V8 sobrealimentado y sin parabrisas', color: 0xc4c8cf, vmax: 64, accel: 16.8, yaw: 2.5, grip: 13.2, driftGrip: 2.6, radius: 1.3, mass: 1550, kind: 'slr', nopaint: true, custom: true },
  // —— F1
  { id: 'lotus', brand: 'Lotus', group: 'f1', drive: 'rwd', name: 'Lotus 72D (1972)', desc: 'Clásico negro y oro: ligero pero nervioso', color: 0x16181d, vmax: 66, accel: 17.8, yaw: 3.0, grip: 14, driftGrip: 3.0, radius: 1.1, mass: 650, kind: 'lotus', nopaint: true, custom: true },
  { id: 'aston', brand: 'Aston Martin', group: 'f1', name: 'Aston Martin AMR23', desc: 'Monoplaza actual: apoyo aerodinámico enorme', color: 0x0e7a6b, vmax: 74, accel: 21, yaw: 3.1, grip: 17, driftGrip: 2.8, radius: 1.2, mass: 800, kind: 'aston', nopaint: true, custom: true },
];
export const AI_COLORS = [0x37d67a, 0xb06bff, 0xff7a3d, 0xeaeaea, 0x19c3d6];

export function makeCar(type, name, isPlayer) {
  return {
    type, name, isPlayer,
    mass: type.mass || ({ porsche: 1510, m3: 1570, qashqai: 1780, mini: 1390 }[type.id] || 1460),
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, psi: 0,
    px: 0, py: 0, pz: 0, ppsi: 0,
    steer: 0, yawRate: 0, air: false, grad: 0, drifting: false, driftDir: 0, driftT: 0,
    tireTemp: 0.5, demand: 0, mud: 0, grip: type.grip, hint: -1, loc: { i: 0, t: 0, s: 0, h: 0, tx: 0, tz: 1, lat: 0 },
    lap: 0, lastS: 0, D: 0, safeD: 0, safeT: 0, events: [], stuckT: 0,
    finished: false, finishTime: 0, brake: 0, throttle: 0, speed: 0, vf: 0, vl: 0, offroad: false,
    visPitch: 0, visRoll: 0, impact: 0, impactSide: 0, onKerb: false, wheelSpin: 0, lapStart: 0, airTime: 0,
  };
}

const tmp = { x: 0, y: 0, z: 0, tx: 0, tz: 1 };
// Coloca el coche en la pista. s puede ser negativo (parrilla detrás de la meta).
export function placeCar(c, tr, s, lat, speed = 0) {
  pointAt(tr, s, lat, tmp);
  c.x = c.px = tmp.x; c.z = c.pz = tmp.z; c.y = c.py = tmp.y;
  c.psi = c.ppsi = Math.atan2(tmp.tx, tmp.tz);
  c.vx = Math.sin(c.psi) * speed; c.vz = Math.cos(c.psi) * speed; c.vy = 0;
  c.air = false; c.steer = 0; c.yawRate = 0; c.drifting = false; c.grad = 0; c.grip = c.type.grip; c.driftT = 0;
  c.hint = -1;
  locate(tr, c.x, c.z, -1, c.loc);
  c.hint = c.loc.i;
  c.lap = Math.floor(s / tr.len);
  c.lastS = c.loc.s;
  c.D = c.lap * tr.len + c.loc.s;
  c.safeD = c.D; c.safeT = 0; c.stuckT = 0;
}

export function resetToTrack(c, tr) {
  const s = ((c.safeD % tr.len) + tr.len) % tr.len;
  const lapBase = Math.floor(c.safeD / tr.len);
  placeCar(c, tr, s + lapBase * tr.len, 0, 14);
}

export function stepCar(c, inp, dt, tr, env) {
  setRoad(tr);
  const T = c.type, loc = c.loc, mf = clamp(c.mass / 1480, 0.92, 1.22); // peso: más inercia

  c.px = c.x; c.py = c.y; c.pz = c.z; c.ppsi = c.psi;
  const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
  const fx = sn, fz = cs, rx = -cs, rz = sn;
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
  const speed = Math.hypot(c.vx, c.vz);
  const ground = !c.air;
  const offroadBlend = smoothstep(ROAD_HALF - 0.7, ROAD_HALF + 2.4, Math.abs(loc.lat));
  surfaceAt(tr, env, loc.s, SP); c.surf = SP.key; // superficie bajo el coche (zonas mixtas + temperatura y humedad)
  const off = offroadBlend > 0.5;
  c.offroadFactor = ground ? offroadBlend : 0;
  c.offroad = off && ground;

  // dirección suavizada
  const st = clamp(inp.steer, -1, 1);
  const rate = (st === 0 || st * c.steer < 0 ? 8 : 3.6) * clamp(0.78 + T.yaw * 0.12, 0.9, 1.2);
  c.steer += clamp(st - c.steer, -rate * dt, rate * dt);

  // freno de mano y derrape
  const wantD = inp.drift && ground && speed > 11;
  if (!c.drifting) {
    if (wantD && Math.abs(c.steer) > 0.2) { c.drifting = true; c.driftDir = Math.sign(c.steer); c.driftT = 0; c.events.push({ t: 'drift' }); }
  } else if (!wantD) { c.drifting = false; c.driftT = 0; }
  if (c.drifting && Math.abs(c.steer) > 0.58 && Math.sign(c.steer) !== c.driftDir) c.driftDir = Math.sign(c.steer);
  if (c.drifting && Math.abs(vl) > 2.2) c.driftT += dt;

  // giro
  let eff = Math.sign(c.steer) * Math.pow(Math.abs(c.steer), 1.35); // respuesta progresiva: suave al centro
  if (c.drifting) eff = c.driftDir * 0.48 + c.steer * 0.68;
    const tireAuthority = clamp(Math.sqrt(T.grip / 12), 0.86, 1.08) * (1 - offroadBlend * (1 - (env.steerOffroad || 0.72))) * (env.surface === 'snow' ? 0.93 : 1) * SP.s * (1 + 2.5 * Math.abs(loc.bank || 0));
  const maxYaw = T.yaw * YAW_SCALE * tireAuthority / (1 + (speed / YAW_SPEED) * (speed / YAW_SPEED));
  const auth = Math.min(1, Math.abs(vf) / 5) * (ground ? 1 : 0.22);
  const sgn = vf >= -0.3 ? 1 : -1;
  const yawT = eff * maxYaw * auth * sgn * (c.drifting ? 1.12 : 1);
  c.yawRate += (yawT * (c.oversteer || 1) - c.yawRate) * Math.min(1, (ground ? 6.4 / mf : 2) * dt);
  const yaw = c.yawRate;

  // motor y freno
  const vmaxE = T.vmax * (1 - offroadBlend * (1 - (env.offroad || 0.62))) * (env.weather === 'rain' ? 0.97 : 1);
  c.throttle = inp.throttle; c.brake = inp.brake;
  if (ground) {
    if (inp.brake > 0.05) {
      if (vf > 1) {
        const dv = Math.min(vf, (env.brakeForce || 24) * SP.b * inp.brake * dt);
        vf -= dv;
      } else vf = Math.max(-16, vf - 14 * inp.brake * dt);
    } else if (inp.throttle > 0.01) {
      if (vf < 0) vf += 28 * dt;
      else if (vf < vmaxE) vf += T.accel * ACCEL_SCALE * (env.traction || 1) * SP.a * inp.throttle * (1 - Math.pow(vf / vmaxE, 2.2)) * dt;
    } else if (vf !== 0) {
      const d = Math.min(Math.abs(vf), (2.2 + 0.0007 * vf * vf) * dt);
      vf -= Math.sign(vf) * d;
    }
    if (vf > vmaxE) vf -= (vf - vmaxE) * (offroadBlend > 0.5 ? 3 : 1.1) * dt;
    if (offroadBlend > 0) vf *= Math.exp(-offroadBlend * (env.rollingDrag || 0.5) * dt);
    vf -= 9.8 * c.grad * (env.slope || 0.7) * dt;
    if (SP.d > 0.01) vf *= Math.exp(-SP.d * 0.25 * dt);
    if (env.wind && env.wind[0] && speed > 2) { // viento: gusts suaves; de cara frena, de cola empuja, de lado desvía
      const gust = env.wind[0] * (1 + 0.35 * Math.sin(c.D * 0.017 + 1.7)), wx = Math.sin(env.wind[1]) * gust, wz = Math.cos(env.wind[1]) * gust, sp = clamp(speed / 40, 0, 1.2);
      vf += (wx * fx + wz * fz) * 0.05 * sp * dt; const wl = wx * rx + wz * rz; vl += wl * 0.25 * sp * dt / mf; c.psi += wl * 0.0035 * sp * dt / mf;
    }
    const soilGrip = env.offroadGrip || 0.68;
    const surfaceGrip = (1 - offroadBlend * (1 - soilGrip)) * (env.weather === 'rain' ? (env.wetGrip || 0.78) : 1) * SP.g;
    const puddleWater = env.weather === 'rain' ? puddleAt(loc.s, loc.lat) : 0;
    c.puddleWater = puddleWater;
    c.inPuddle = puddleWater > 0.12;
    const mud = env.mud ? mudAt(loc.s, loc.lat) : 0; c.mud = mud;
    if (mud > 0.02) vf *= Math.exp(-mud * 1.25 * dt);          // el barro frena
    if (puddleWater > 0.05) vf *= Math.exp(-puddleWater * 0.45 * dt);
    // ----- lógica de agarre: el neumático tiene un límite; si se le pide más, el coche se va un poco -----
    const wet = surfaceGrip * (1 - puddleWater * 0.5) * (1 - mud * 0.5);
    const bk = loc.bank || 0, bankG = 1 + 2.2 * Math.abs(bk); // las curvas peraltadas agarran más
    vl -= 9.8 * Math.sin(bk) * 1.1 * dt; // y la pendiente lateral empuja el coche hacia dentro de la curva
    const limitG = 9.5 * (T.grip / 12.5) * env.gripMul * wet * bankG * (0.88 + 0.24 * c.tireTemp);
    const demand = (Math.abs(c.yawRate) * speed) / Math.max(3, limitG); c.demand = demand;
    const overload = smoothstep(0.78, 1.3, demand);
    // neumáticos: recto y acelerando se calientan y agarran más; al forzar en curva o deslizar se enfrían
    const straightGas = Math.abs(c.steer) < 0.18 && inp.throttle > 0.4 && inp.brake < 0.1;
    const tTarget = straightGas ? 1 : demand > 1 ? 0 : 0.5, tRate = (straightGas ? 0.55 : demand > 1 ? 0.9 : 0.16) * clamp(0.55 + ((env.temp == null ? 20 : env.temp) + 5) / 40, 0.5, 1.25); // con frío los neumáticos tardan en calentarse
    c.tireTemp += (tTarget - c.tireTemp) * Math.min(1, tRate * dt);
    // tracción trasera: acelerar a fondo con el volante girado descoloca la zaga
    c.oversteer = 1;
    if (T.drive === 'rwd' && inp.throttle > 0.7 && Math.abs(c.steer) > 0.35 && speed > 12) { c.oversteer = 1.07; }
    const gT = (c.drifting ? T.driftGrip : T.grip) * env.gripMul * wet * (0.9 + 0.2 * c.tireTemp) * (1 - 0.36 * overload) * (c.oversteer > 1 ? 0.9 : 1) * (inp.brake > 0.5 && speed > 20 ? (env.brakeGrip || 0.85) : 1);
    c.grip += (gT - c.grip) * Math.min(1, (c.drifting ? 7 : 3.2) * dt);
    vl *= Math.exp(-c.grip * dt);
    if (c.drifting) vf *= Math.exp(-0.08 * dt);
  } else {
    vl *= Math.exp(-0.3 * dt);
  }

  // recomponer velocidad (con el rumbo anterior) y girar
  c.vx = fx * vf + rx * vl; c.vz = fz * vf + rz * vl;
  c.psi -= yaw * dt;
  c.vf = vf; c.vl = vl; c.speed = Math.hypot(c.vx, c.vz);

  c.x += c.vx * dt; c.z += c.vz * dt;
  locate(tr, c.x, c.z, c.hint, loc);
  c.hint = loc.i;

  // vallas
  const lim = WALL - T.radius;
  if (Math.abs(loc.lat) > lim) {
    const side = Math.sign(loc.lat), over = Math.abs(loc.lat) - lim;
    const nx = side * -loc.tz, nz = side * loc.tx;
    c.x -= nx * over; c.z -= nz * over;
    const vn = c.vx * nx + c.vz * nz;
    if (vn > 0) {
      c.vx -= 1.3 * vn * nx; c.vz -= 1.3 * vn * nz;
      const keep = 1 - Math.min(0.3, vn * 0.01);
      c.vx *= keep; c.vz *= keep;
      if (vn > 3) c.events.push({ t: 'wall', v: vn, side });
    }
    // alinear el morro con la valla para no quedarse atascado
    const vang = Math.atan2(loc.tx, loc.tz);
    let diff = wrapPi(vang - c.psi);
    if (Math.abs(diff) > Math.PI / 2) diff = wrapPi(vang + Math.PI - c.psi);
    c.psi += clamp(diff * 6 * dt, -4 * dt, 4 * dt);
    c.drifting = false;
  }

  // pianos (bordillos): frenan un poco y vibran
  c.onKerb = !c.air && Math.abs(loc.lat) > ROAD_HALF - 0.2 && Math.abs(loc.lat) < ROAD_HALF + 1.15;
  if (c.onKerb && c.speed > 8) {
    c.vx *= Math.exp(-0.16 * dt); c.vz *= Math.exp(-0.16 * dt);
  }
  // altura y saltos
  const hNew = loc.h;
  if (!c.air) {
    const dd = Math.max(0.05, Math.abs(vf) * dt);
    const grad = clamp(((hNew - c.y) / dd) * (vf >= 0 ? 1 : -1), -0.35, 0.35);
    c.grad += (grad - c.grad) * 0.15;
    const yBall = c.y + c.vy * dt - 0.5 * G * dt * dt;
    if (c.vy > 1.5 && hNew < yBall - 0.05) {
      c.air = true; c.y = yBall; c.vy -= G * dt; c.airTime = 0;
      c.drifting = false;
      c.events.push({ t: 'takeoff', v: c.vy });
    } else {
      c.vy = (hNew - c.y) / dt; c.y = hNew;
    }
  } else {
    c.airTime += dt;
    c.vy -= G * dt; c.y += c.vy * dt;
    if (c.y <= hNew && c.vy <= 0) {
      const impact = -c.vy;
      c.y = hNew; c.vy = 0; c.air = false; c.grad = 0;
      if (impact > 7) { const k = 1 - Math.min(0.1, (impact - 7) * 0.012); c.vx *= k; c.vz *= k; }
      c.events.push({ t: 'land', v: impact });
    }
  }
  // progreso
  let dS = loc.s - c.lastS;
  if (dS < -tr.len / 2) c.lap++; else if (dS > tr.len / 2) c.lap--;
  c.lastS = loc.s;
  c.D = c.lap * tr.len + loc.s;
  if (ground && Math.abs(loc.lat) < ROAD_HALF) { c.safeT += dt; if (c.safeT > 0.6) { c.safeT = 0; c.safeD = c.D; } }
  if (c.speed < 1.5) c.stuckT += dt; else c.stuckT = 0;
}

// Aceleración: más progresiva (0-100 km/h en ~5 s y máxima en ~25 s); marchas más largas
export const ACCEL_SCALE = 0.42;
const GT = [0.27, 0.44, 0.6, 0.75, 0.88, 1.0];
// marcha y régimen (0..1) a partir de la velocidad
export function gearInfo(speed, vmax) {
  const top = vmax * 1.08;
  let g = 0;
  while (g < 5 && speed > top * GT[g] * 0.97) g++;
  const lo = g ? top * GT[g - 1] * 0.6 : 0, hi = top * GT[g];
  const rpm = clamp(0.28 + 0.72 * ((speed - lo) / (hi - lo)), 0.22, 1);
  return { gear: g + 1, rpm };
}
