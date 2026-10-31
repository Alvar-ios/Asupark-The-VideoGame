// Verifica el motor sintético: sin NaN, nivel razonable, tono = frecuencia de explosiones, y escribe WAV para escuchar.
import { EngineDSP } from '../src/engine-dsp.js';
import fs from 'node:fs';
const sr = 44100;
function wav(name, f32) { const b = Buffer.alloc(44 + f32.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + f32.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(f32.length * 2, 40); for (let i = 0; i < f32.length; i++) b.writeInt16LE(Math.max(-1, Math.min(1, f32[i])) * 32767 | 0, 44 + i * 2); fs.writeFileSync(name, b); }
function render(secs, fn) { const d = new EngineDSP(sr), out = new Float32Array(Math.ceil(secs * sr / 128) * 128), blk = 128, tmp = new Float32Array(blk); for (let o = 0; o < out.length; o += blk) { const p = fn(o / sr); d.process(tmp, p); out.set(tmp, o); } return out; }
const mx = (a) => { let m = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
// 1) tono estable a varias vueltas: la energía debe estar en la frecuencia de explosiones (rpm/60*3) y múltiplos
let bad = 0;
for (const rpm of [1000, 2500, 4000, 6000]) {
  const o = render(2.5, () => ({ rpm, throttle: 0.8, boost: 0.5, limiter: false })), seg = o.slice(sr * 1.5, sr * 2.5);
  const f0 = rpm / 60 * 3; let best = 0, bf = 0;
  for (let f = 40; f < 1200; f += 1) { let re = 0, im = 0; for (let i = 0; i < seg.length; i += 2) { const w = 6.2831853 * f * i / sr; re += seg[i] * Math.cos(w); im += seg[i] * Math.sin(w); } const m = re * re + im * im; if (m > best) { best = m; bf = f; } }
  const ratio = bf / f0, ok = [0.5, 1, 2, 3, 4].some((r) => Math.abs(ratio - r) < 0.06) || bf < 400;
  const peak = mx(seg); console.log(`rpm ${rpm}: explosiones ${f0.toFixed(0)} Hz, pico espectral ${bf} Hz (x${ratio.toFixed(2)}), rms ${rms(seg).toFixed(3)}, pico ${peak.toFixed(2)}`);
  if (!isFinite(rms(seg)) || peak > 1 || rms(seg) < 0.01) { console.log('  FALLO nivel'); bad++; }
}
// 2) barrido a fondo con cambios de marcha, y soltar gas con petardeos, con limitador
const gears = [[0, 4.2], [1.6, 2.7], [3.4, 1.9], [5.4, 1.45], [7.6, 1.15]];
const sweep = render(12, (t) => { let g = 0; while (g < 4 && t > gears[g + 1][0]) g++; const into = t - gears[g][0], dur = (gears[g + 1] ? gears[g + 1][0] : 9.6) - gears[g][0]; const shifting = g > 0 && into < 0.16; const rpm = t > 9.6 ? Math.max(1100, 6900 - (t - 9.6) * 2400) : (shifting ? 5200 : 2800 + (into / dur) * 4100 + (g === 0 ? 0 : 0)); return { rpm: Math.min(7100, rpm), throttle: t > 9.6 ? 0 : shifting ? 0.1 : 1, boost: t > 9.6 ? 0.1 : shifting ? 0.1 : 0.9, limiter: false }; });
wav('/tmp/porsche_sweep.wav', sweep);
const lim = render(3, () => ({ rpm: 7000, throttle: 1, boost: 1, limiter: true })); wav('/tmp/porsche_limiter.wav', lim);
const idle = render(4, () => ({ rpm: 900, throttle: 0.05, boost: 0, limiter: false })); wav('/tmp/porsche_idle.wav', idle);
console.log('barrido: rms', rms(sweep).toFixed(3), 'pico', mx(sweep).toFixed(2), '| ralentí rms', rms(idle).toFixed(3), '| limitador rms', rms(lim).toFixed(3));
// sonoridad creciente con las vueltas
const l1 = rms(render(2, () => ({ rpm: 1500, throttle: 1, boost: 0.5, limiter: false })).slice(sr)), l2 = rms(render(2, () => ({ rpm: 6000, throttle: 1, boost: 0.9, limiter: false })).slice(sr));
console.log('rms 1500rpm', l1.toFixed(3), '< rms 6000rpm', l2.toFixed(3), l2 > l1 ? 'OK' : 'FALLO'); if (!(l2 > l1)) bad++;
process.exit(bad ? 1 : 0);
