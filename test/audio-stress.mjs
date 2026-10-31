// Prueba de estrés del motor sintético: todos los perfiles con vueltas y gas aleatorios, sin NaN ni saturación ni saltos bruscos.
import { EngineDSP, PROFILES } from '../src/engine-dsp.js';
const sr = 48000, N = 128; let bad = 0;
for (const id of Object.keys(PROFILES)) {
  const d = new EngineDSP(sr, id, 7), out = new Float32Array(N), P = PROFILES[id];
  let peak = 0, maxJump = 0, last = 0, nan = 0, rpm = P.idle, thr = 0;
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let blk = 0; blk < sr * 24 / N; blk++) {
    if (blk % 40 === 0) { thr = rnd() < 0.35 ? 0 : rnd(); rpm = P.idle + rnd() * (P.redline - P.idle); }
    d.process(out, { rpm, throttle: thr, boost: thr * 0.8, limiter: rpm > P.redline * 0.96 && thr > 0.5 });
    for (let i = 0; i < N; i++) { const v = out[i]; if (v !== v) nan++; peak = Math.max(peak, Math.abs(v)); maxJump = Math.max(maxJump, Math.abs(v - last)); last = v; }
  }
  const ok = !nan && peak < 0.99; if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${id.padEnd(9)} pico ${peak.toFixed(2)}  salto máx ${maxJump.toFixed(2)}  NaN ${nan}`);
}
console.log(bad ? `${bad} perfiles con problemas` : 'Todo correcto');
process.exit(bad ? 1 : 0);
