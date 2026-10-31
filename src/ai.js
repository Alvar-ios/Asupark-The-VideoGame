// Piloto automático para los rivales
const envNum = (k, d) => (typeof process !== 'undefined' && process.env && process.env[k] ? +process.env[k] : d); // solo para calibrar en Node
// el piloto automático rinde como un jugador habilidoso: más motor y más agarre que el coche de serie (calibrado con los tiempos reales de la clasificación)
export const AI_TOP = 1.45; // habilidad del mejor piloto (multiplica la velocidad objetivo de la línea de carrera)
export const aiType = (t) => t; // los rivales usan exactamente las mismas stats que el coche; solo cambia cómo conducen
export const AICFG = { grip: envNum('AIG', 1.2), brake: envNum('AIB', 26), w: envNum('AIW', 2.1) };
import { ROAD_HALF, setRoad } from './track.js';
import { SURF, zoneAt } from './surface.js';
const zoneGrip = (tr, s) => { const z = zoneAt(tr, s); return z ? 1 + (Math.min(1, SURF[z.key].g) - 1) * z.w : 1; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Velocidad máxima admisible en cada punto según curvatura + frenada anticipada
// línea de carrera: banda elástica que minimiza la curvatura dentro del ancho útil de la pista (entra abierto, corta el vértice, sale abierto)
export function racingLine(tr) {
  if (tr._line) return tr._line;
  const N = tr.N, w = Math.max(1.2, tr.half - AICFG.w), o = new Float32Array(N), nx = new Float32Array(N), nz = new Float32Array(N);
  for (let i = 0; i < N; i++) { nx[i] = -tr.TZ[i]; nz[i] = tr.TX[i]; }
  const Q = (i) => { i = (i + N) % N; return [tr.X[i] + nx[i] * o[i], tr.Z[i] + nz[i] * o[i]]; };
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < N; i++) {
      const a = Q(i - 4), b = Q(i), c = Q(i + 4);
      const d = ((a[0] + c[0] - 2 * b[0]) * nx[i] + (a[1] + c[1] - 2 * b[1]) * nz[i]) * 0.5;
      o[i] = Math.max(-w, Math.min(w, o[i] + d * 0.5));
    }
  }
  const X = new Float32Array(N), Z = new Float32Array(N), k = new Float32Array(N);
  for (let i = 0; i < N; i++) { const q = Q(i); X[i] = q[0]; Z[i] = q[1]; }
  const th = (i) => { const a = (i - 1 + N) % N, b = (i + 1) % N; return Math.atan2(X[b] - X[a], Z[b] - Z[a]); };
  for (let i = 0; i < N; i++) k[i] = Math.abs(((th((i + 4) % N) - th((i - 4 + N) % N) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / (8 * tr.ds);
  return (tr._line = { o, X, Z, k });
}
export function buildSpeedProfile(tr, T) {
  const LN = racingLine(tr);
  const N = tr.N, v = new Float32Array(N), vmax = T.vmax * 0.97;
  for (let i = 0; i < N; i++) {
    let k = 0;
    for (let d = -6; d <= 6; d++) k = Math.max(k, LN.k[(i + d + N) % N]);
    const zg = zoneGrip(tr, i * tr.ds);
    const bf = 1 + 2.5 * Math.abs(tr.bank ? tr.bank[i] : 0), vm = T.vmax, aero = T.aero || 0;
    const f = (s) => k * s * (1 + (s / YAW_SPEED) * (s / YAW_SPEED)) - AICFG.grip * T.yaw * YAW_SCALE * zg * bf * (1 + aero * 0.8 * (s / vm) * (s / vm));
    if (f(vmax) <= 0) v[i] = vmax;
    else { let lo = 6, hi = vmax; for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } v[i] = lo; }
  }
  const brk = AICFG.brake;
  const bz = (i) => 0.45 + 0.55 * zoneGrip(tr, i * tr.ds);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * brk * bz(j) * tr.ds));
    }
  }
  return v;
}

export function aiInput(c, tr, prof, ai, out) {
  setRoad(tr);
  const N = tr.N, speed = c.speed, LN = racingLine(tr);
  const li = (c.hint + Math.max(3, Math.floor(((ai.la0 || 7.9) + (ai.la1 || 0.58) * speed) / tr.ds))) % N;
  const lane = ai.lane || 0;
  const tx = LN.X[li] + -tr.TZ[li] * lane * 0.3, tz = LN.Z[li] + tr.TX[li] * lane * 0.3;
  const sn = Math.sin(c.psi), cs = Math.cos(c.psi);
  const dx = tx - c.x, dz = tz - c.z;
  const fwd = dx * sn + dz * cs, rgt = dx * -cs + dz * sn;
  const want = clamp(Math.atan2(rgt, Math.max(0.1, fwd)) * (ai.gain || 2.9), -1, 1);
  ai.st = (ai.st || 0) + (want - (ai.st || 0)) * (ai.smooth || 0.22); // volante suave: sin zigzag
  out.steer = ai.st;
  const vi = (c.hint + Math.floor((speed * 0.25) / tr.ds)) % N;
  const vt = prof[vi] * ai.skill;
  if (speed > vt + 1.2) { out.throttle = 0; out.brake = clamp((speed - vt) / 6, 0.2, 1); }
  else { out.brake = 0; out.throttle = speed < vt - 1 ? 1 : 0.55; }
  // freno de mano: como hacen los jugadores rápidos, se desliza en las curvas cerradas para no perder velocidad
  const kA = LN.k[(c.hint + Math.floor((4 + speed * 0.25) / tr.ds)) % N];
  out.drift = false;
  return out;
}

// Récord de referencia de la pista: una vuelta lanzada del piloto automático (3 sectores + vuelta).
import { makeCar, placeCar, stepCar, YAW_SCALE, YAW_SPEED } from './car.js';
const benchCache = {};
export function benchmark(tr, type, env, key) {
  if (benchCache[key]) return benchCache[key];
  type = aiType(type); const c = makeCar(type, 'bench', false), prof = buildSpeedProfile(tr, type);
  placeCar(c, tr, 2, 0, 0);
  const ai = { lane: 0, skill: AI_TOP }, inp = { steer: 0, throttle: 0, brake: 0, drift: false };
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
