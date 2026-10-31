// Piloto automático para los rivales
const T_VMAX_FRAC = (c) => c.type.vmax * 0.9;
import { ROAD_HALF } from './track.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Velocidad máxima admisible en cada punto según curvatura + frenada anticipada
export function buildSpeedProfile(tr, T) {
  const N = tr.N, v = new Float32Array(N), vmax = T.vmax * 0.97;
  for (let i = 0; i < N; i++) {
    let k = 0;
    for (let d = -6; d <= 6; d++) k = Math.max(k, tr.absK[(i + d + N) % N]);
    const f = (s) => k * s * (1 + (s / YAW_SPEED) * (s / YAW_SPEED)) - 0.70 * T.yaw * YAW_SCALE;
    if (f(vmax) <= 0) v[i] = vmax;
    else { let lo = 6, hi = vmax; for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } v[i] = lo; }
  }
  const brk = 17;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * brk * tr.ds));
    }
  }
  return v;
}

export function aiInput(c, tr, prof, ai, out) {
  const N = tr.N, speed = c.speed, loc = c.loc;
  const li = (c.hint + Math.floor((7 + 0.42 * speed) / tr.ds)) % N;
  const kAhead = tr.kap[(c.hint + Math.floor((18 + speed * 0.6) / tr.ds)) % N];
  const apex = -Math.sign(kAhead) * Math.min(4.2, Math.abs(kAhead) * 220);
  const lane = clamp(ai.lane * 0.5 + apex, -ROAD_HALF + 2, ROAD_HALF - 2);
  const tx = tr.X[li] + -tr.TZ[li] * lane, tz = tr.Z[li] + tr.TX[li] * lane;
  const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
  const dx = tx - c.x, dz = tz - c.z;
  const fwd = dx * sn + dz * cs, rgt = dx * -cs + dz * sn;
  out.steer = clamp(Math.atan2(rgt, Math.max(0.1, fwd)) * 1.9, -1, 1);
  const vi = (c.hint + Math.floor((speed * 0.3) / tr.ds)) % N;
  const vt = prof[vi] * ai.skill;
  if (speed > vt + 1.5) { out.throttle = 0; out.brake = clamp((speed - vt) / 7, 0.25, 1); }
  else { out.brake = 0; out.throttle = speed < vt ? 1 : 0.35; }
  out.drift = false;
  return out;
}

// Récord de referencia de la pista: una vuelta lanzada del piloto automático (3 sectores + vuelta).
import { makeCar, placeCar, stepCar, YAW_SCALE, YAW_SPEED } from './car.js';
const benchCache = {};
export function benchmark(tr, type, env, key) {
  if (benchCache[key]) return benchCache[key];
  const c = makeCar(type, 'bench', false), prof = buildSpeedProfile(tr, type);
  placeCar(c, tr, 2, 0, 0);
  const ai = { lane: 0, skill: 0.985 }, inp = { steer: 0, throttle: 0, brake: 0, drift: false };
  const T = [0, 0, 0, 0, 0, 0, 0], third = tr.len / 3;
  const nP = Math.ceil(tr.len / 10) + 1, prof2 = new Float32Array(nP).fill(-1);
  let t = 0, j = 1;
  const H = 1 / 120;
  while (t < 600 && j <= 6) {
    aiInput(c, tr, prof, ai, inp);
    stepCar(c, inp, H, tr, env);
    c.events.length = 0;
    if (c.stuckT > 3) break;
    t += H;
    while (j <= 6 && c.D >= j * third) { T[j] = t; j++; }
    if (j > 3 || c.D >= tr.len) { const k = Math.floor((c.D - tr.len) / 10); if (k >= 0 && k < nP && prof2[k] < 0) prof2[k] = t; }
  }
  const t0 = T[3];
  const res = j > 6 ? { sec: [T[4] - T[3], T[5] - T[4], T[6] - T[5]], lap: T[6] - T[3], prof: Array.from(prof2, (v) => (v < 0 ? -1 : +(v - t0).toFixed(3))) } : null;
  benchCache[key] = res;
  return res;
}
