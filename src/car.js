// Física arcade del coche (sin dependencias de three)
import { ROAD_HALF, WALL, setRoad, locate, pointAt, wrapPi } from './track.js';
import { puddleAt, mudAt, smoothstep } from './surface.js';

export const YAW_SCALE = 0.8, YAW_SPEED = 42; // sensibilidad de giro global
export const G = 14; // gravedad "flotante" arcade
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const CARS = [
  { id: 'bora', name: 'VW Bora VR6', desc: 'Berlina 2005 · estable y noble', color: 0x0b4d2c, vmax: 56, accel: 14, yaw: 2.25, grip: 13, driftGrip: 2.7, radius: 1.2, kind: 'bora', custom: true },
  { id: 'porsche', drive: 'rwd', name: 'Porsche 911 Turbo S', desc: 'Rapidísimo, motor trasero: cuidado al frenar', color: 0x0a1a28, vmax: 60, accel: 15.5, yaw: 2.85, grip: 12.6, driftGrip: 2.9, radius: 1.2, kind: 'porsche', custom: true },
  { id: 'm3', drive: 'rwd', name: 'BMW M3 E46', desc: 'Tracción trasera, ágil y rabioso', color: 0x0070ed, vmax: 58, accel: 15, yaw: 2.45, grip: 12.4, driftGrip: 2.7, radius: 1.2, kind: 'm3', custom: true },
  { id: 'cupra', name: 'Cupra León', desc: 'Compacto deportivo: mucho agarre', color: 0x193078, vmax: 56, accel: 14.5, yaw: 2.5, grip: 13.4, driftGrip: 2.6, radius: 1.2, kind: 'cupra', custom: true },
  { id: 'mini', name: 'Mini Cooper S Clubman', desc: 'Pequeño y nervioso: gira como un kart', color: 0xf7f7f7, vmax: 53, accel: 14, yaw: 2.8, grip: 13.6, driftGrip: 3.0, radius: 1.1, kind: 'mini', custom: true },
  { id: 'qashqai', name: 'Nissan Qashqai', desc: 'SUV pesado y estable', color: 0xf7f7f7, vmax: 54, accel: 12.5, yaw: 2.05, grip: 14, driftGrip: 2.3, radius: 1.3, kind: 'qashqai', custom: true },
];
export const AI_COLORS = [0x37d67a, 0xb06bff, 0xff7a3d, 0xeaeaea, 0x19c3d6];

export function makeCar(type, name, isPlayer) {
  return {
    type, name, isPlayer,
    mass: ({ porsche: 1510, m3: 1570, qashqai: 1780, mini: 1390 }[type.id] || 1460),
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
    const tireAuthority = clamp(Math.sqrt(T.grip / 12), 0.86, 1.08) * (1 - offroadBlend * (1 - (env.steerOffroad || 0.72))) * (env.surface === 'snow' ? 0.93 : 1);
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
        const dv = Math.min(vf, (env.brakeForce || 24) * inp.brake * dt);
        vf -= dv;
      } else vf = Math.max(-16, vf - 14 * inp.brake * dt);
    } else if (inp.throttle > 0.01) {
      if (vf < 0) vf += 28 * dt;
      else if (vf < vmaxE) vf += T.accel * ACCEL_SCALE * (env.traction || 1) * inp.throttle * (1 - Math.pow(vf / vmaxE, 2.2)) * dt;
    } else if (vf !== 0) {
      const d = Math.min(Math.abs(vf), (2.2 + 0.0007 * vf * vf) * dt);
      vf -= Math.sign(vf) * d;
    }
    if (vf > vmaxE) vf -= (vf - vmaxE) * (offroadBlend > 0.5 ? 3 : 1.1) * dt;
    if (offroadBlend > 0) vf *= Math.exp(-offroadBlend * (env.rollingDrag || 0.5) * dt);
    vf -= 9.8 * c.grad * (env.slope || 0.7) * dt;
    const soilGrip = env.offroadGrip || 0.68;
    const surfaceGrip = (1 - offroadBlend * (1 - soilGrip)) * (env.weather === 'rain' ? (env.wetGrip || 0.78) : 1);
    const puddleWater = env.weather === 'rain' ? puddleAt(loc.s, loc.lat) : 0;
    c.puddleWater = puddleWater;
    c.inPuddle = puddleWater > 0.12;
    const mud = env.mud ? mudAt(loc.s, loc.lat) : 0; c.mud = mud;
    if (mud > 0.02) vf *= Math.exp(-mud * 1.25 * dt);          // el barro frena
    if (puddleWater > 0.05) vf *= Math.exp(-puddleWater * 0.45 * dt);
    // ----- lógica de agarre: el neumático tiene un límite; si se le pide más, el coche se va un poco -----
    const wet = surfaceGrip * (1 - puddleWater * 0.5) * (1 - mud * 0.5);
    const limitG = 9.5 * (T.grip / 12.5) * env.gripMul * wet * (0.88 + 0.24 * c.tireTemp);
    const demand = (Math.abs(c.yawRate) * speed) / Math.max(3, limitG); c.demand = demand;
    const overload = smoothstep(0.78, 1.3, demand);
    // neumáticos: recto y acelerando se calientan y agarran más; al forzar en curva o deslizar se enfrían
    const straightGas = Math.abs(c.steer) < 0.18 && inp.throttle > 0.4 && inp.brake < 0.1;
    const tTarget = straightGas ? 1 : demand > 1 ? 0 : 0.5, tRate = straightGas ? 0.55 : demand > 1 ? 0.9 : 0.16;
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
