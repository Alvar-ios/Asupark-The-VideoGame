// Física arcade del coche (sin dependencias de three)
import { ROAD_HALF, WALL, locate, pointAt, wrapPi } from './track.js';

export const G = 14; // gravedad "flotante" arcade
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const CARS = [
  { id: 'turbo', name: 'Turbo GT', desc: 'Equilibrado y fácil', color: 0xe8372c, vmax: 57, accel: 14.5, yaw: 2.3, grip: 12.5, driftGrip: 2.8, radius: 1.15, kind: 'gt' },
  { id: 'drifter', name: 'Drifter', desc: 'Ágil y deslizante', color: 0x2f9bff, vmax: 54, accel: 15.5, yaw: 2.6, grip: 10.5, driftGrip: 3.4, radius: 1.15, kind: 'drift' },
  { id: 'bruiser', name: 'Bruiser', desc: 'Pesado, rápido y estable', color: 0xf7b32b, vmax: 60, accel: 12.5, yaw: 2.05, grip: 13.5, driftGrip: 2.4, radius: 1.3, kind: 'truck' },
];
export const AI_COLORS = [0x37d67a, 0xb06bff, 0xff7a3d, 0xeaeaea, 0x19c3d6];

export function makeCar(type, name, isPlayer) {
  return {
    type, name, isPlayer,
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, psi: 0,
    px: 0, py: 0, pz: 0, ppsi: 0,
    steer: 0, yawRate: 0, air: false, grad: 0, ers: 0.6, ersOn: false, drifting: false, driftDir: 0, driftT: 0,
    grip: type.grip, hint: -1, loc: { i: 0, t: 0, s: 0, h: 0, tx: 0, tz: 1, lat: 0 },
    lap: 0, lastS: 0, D: 0, safeD: 0, safeT: 0, padCool: 0, events: [], stuckT: 0,
    finished: false, finishTime: 0, brake: 0, throttle: 0, speed: 0, vf: 0, vl: 0, offroad: false,
    visPitch: 0, visRoll: 0, wheelSpin: 0, lapStart: 0, airTime: 0,
  };
}

const tmp = { x: 0, y: 0, z: 0, tx: 0, tz: 1 };
// Coloca el coche en la pista. s puede ser negativo (parrilla detrás de la meta).
export function placeCar(c, tr, s, lat, speed = 0) {
  pointAt(tr, s, lat, tmp);
  c.x = c.px = tmp.x; c.z = c.pz = tmp.z; c.y = c.py = tmp.y;
  c.psi = c.ppsi = Math.atan2(tmp.tx, tmp.tz);
  c.vx = Math.sin(c.psi) * speed; c.vz = Math.cos(c.psi) * speed; c.vy = 0;
  c.air = false; c.steer = 0; c.yawRate = 0; c.drifting = false; c.ersOn = false; c.grad = 0; c.grip = c.type.grip; c.driftT = 0;
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
  const T = c.type, loc = c.loc;
  c.px = c.x; c.py = c.y; c.pz = c.z; c.ppsi = c.psi;
  const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
  const fx = sn, fz = cs, rx = -cs, rz = sn;
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
  const speed = Math.hypot(c.vx, c.vz);
  const ground = !c.air;
  const off = Math.abs(loc.lat) > ROAD_HALF + 0.9;
  c.offroad = off && ground;

  // dirección suavizada
  const st = clamp(inp.steer, -1, 1);
  const rate = st === 0 || st * c.steer < 0 ? 9 : 5.2;
  c.steer += clamp(st - c.steer, -rate * dt, rate * dt);

  // freno de mano / derrape (recoge un poco de ERS)
  const wantD = inp.drift && ground && speed > 13;
  if (!c.drifting) {
    if (wantD && Math.abs(c.steer) > 0.25) { c.drifting = true; c.driftDir = Math.sign(c.steer); c.driftT = 0; }
  } else if (!wantD) { c.drifting = false; c.driftT = 0; }
  if (c.drifting && Math.abs(vl) > 2.2) { c.driftT += dt; c.ers = Math.min(1, c.ers + 0.045 * dt); }

  // giro
  let eff = c.steer;
  if (c.drifting) eff = c.driftDir * 0.62 + c.steer * 0.58;
  const maxYaw = T.yaw / (1 + (speed / 45) * (speed / 45));
  const auth = Math.min(1, Math.abs(vf) / 5) * (ground ? 1 : 0.22);
  const sgn = vf >= -0.3 ? 1 : -1;
  const yawT = eff * maxYaw * auth * sgn * (c.drifting ? 1.12 : 1);
  c.yawRate += (yawT - c.yawRate) * Math.min(1, (ground ? 8 : 2) * dt);
  const yaw = c.yawRate;

  // motor / freno / ERS
  c.ersOn = !!inp.ers && c.ers > 0.003 && ground && inp.brake < 0.1;
  if (c.ersOn) c.ers = Math.max(0, c.ers - 0.22 * dt);
  const boost = c.ersOn;
  const vmaxE = T.vmax * (boost ? 1.1 : 1) * (off ? env.offroad : 1);
  c.throttle = inp.throttle; c.brake = inp.brake;
  if (ground) {
    if (inp.brake > 0.05) {
      if (vf > 1) {
        const dv = Math.min(vf, 30 * inp.brake * dt);
        vf -= dv; c.ers = Math.min(1, c.ers + dv * 0.0105); // recuperación al frenar
      } else vf = Math.max(-16, vf - 14 * inp.brake * dt);
    } else if (inp.throttle > 0.01) {
      if (vf < 0) vf += 28 * dt;
      else if (vf < vmaxE) vf += T.accel * (boost ? 1.75 : 1) * inp.throttle * (1 - Math.pow(vf / vmaxE, 2.5)) * dt;
    } else if (vf !== 0) {
      const d = Math.min(Math.abs(vf), (2.2 + 0.0007 * vf * vf) * dt);
      vf -= Math.sign(vf) * d;
    }
    if (vf > vmaxE) vf -= (vf - vmaxE) * (off ? 3 : 1.1) * dt;
    if (off) vf *= Math.exp(-0.5 * dt);
    vf -= 9.8 * c.grad * 0.7 * dt;
    const gT = (c.drifting ? T.driftGrip : T.grip) * env.gripMul * (inp.brake > 0.5 && speed > 20 ? 0.85 : 1);
    c.grip += (gT - c.grip) * Math.min(1, (c.drifting ? 9 : 4) * dt);
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

  // turbos del asfalto
  if (c.padCool > 0) c.padCool -= dt;
  if (ground && c.padCool <= 0) {
    for (let k = 0; k < tr.pads.length; k++) {
      const p = tr.pads[k];
      let ds = loc.s - p.s;
      if (ds > tr.len / 2) ds -= tr.len; else if (ds < -tr.len / 2) ds += tr.len;
      if (ds >= 0 && ds < p.len && Math.abs(loc.lat - p.lat) < p.w / 2 + 0.8) {
        c.ers = Math.min(1, c.ers + 0.35); c.padCool = 0.7;
        c.events.push({ t: 'pad' });
        break;
      }
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

const GT = [0.19, 0.34, 0.49, 0.64, 0.8, 1.0];
// marcha y régimen (0..1) a partir de la velocidad
export function gearInfo(speed, vmax) {
  const top = vmax * 1.1;
  let g = 0;
  while (g < 5 && speed > top * GT[g] * 0.97) g++;
  const lo = g ? top * GT[g - 1] * 0.6 : 0, hi = top * GT[g];
  const rpm = clamp(0.28 + 0.72 * ((speed - lo) / (hi - lo)), 0.22, 1);
  return { gear: g + 1, rpm };
}
