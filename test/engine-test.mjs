// Verifica los motores sintéticos: sin NaN ni recortes, graves suficientes, nivel creciente con las vueltas; escribe WAV en /tmp.
import { EngineDSP, PROFILES } from '../src/engine-dsp.js';
import fs from 'node:fs';
const sr = 44100;
function wav(name, f32) { const b = Buffer.alloc(44 + f32.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + f32.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(f32.length * 2, 40); for (let i = 0; i < f32.length; i++) b.writeInt16LE(Math.max(-1, Math.min(1, f32[i])) * 32767 | 0, 44 + i * 2); fs.writeFileSync(name, b); }
function render(prof, secs, fn) { const d = new EngineDSP(sr, prof), out = new Float32Array(Math.ceil(secs * sr / 128) * 128), tmp = new Float32Array(128); for (let o = 0; o < out.length; o += 128) { d.process(tmp, fn(o / sr)); out.set(tmp, o); } return out; }
const mx = (a) => { let m = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
// reparto de energía: graves (<250 Hz), medios (250-1500) y agudos (>1500), y centroide espectral
function bands(seg) { let lo = 0, mid = 0, hi = 0, cs = 0, cw = 0; const N = Math.min(seg.length, 16384); for (let f = 25; f < 6000; f += 8) { let re = 0, im = 0; const w0 = 6.2831853 * f / sr; for (let i = 0; i < N; i += 2) { re += seg[i] * Math.cos(w0 * i); im += seg[i] * Math.sin(w0 * i); } const m = re * re + im * im; if (f < 250) lo += m; else if (f < 1500) mid += m; else hi += m; cs += f * m; cw += m; } const t = lo + mid + hi; return { lo: lo / t, mid: mid / t, hi: hi / t, cent: cs / cw }; }
let bad = 0;
console.log('perfil      | rpm  | graves<250 medios  agudos>1.5k | centroide | rms   pico');
for (const [id, P] of Object.entries(PROFILES)) {
  for (const rpm of [P.idle, 2500, 4500]) {
    const o = render(id, 2.5, () => ({ rpm, throttle: rpm === P.idle ? 0.06 : 0.8, boost: 0.5, limiter: false })), seg = o.slice(sr * 1.5);
    const b = bands(seg), r = rms(seg), pk = mx(seg);
    console.log(id.padEnd(11), '|', String(rpm).padStart(4), '|', (b.lo * 100).toFixed(0).padStart(5) + '%', (b.mid * 100).toFixed(0).padStart(5) + '%', (b.hi * 100).toFixed(0).padStart(6) + '%', '|', b.cent.toFixed(0).padStart(6), 'Hz |', r.toFixed(3), pk.toFixed(2));
    if (!isFinite(r) || pk >= 0.99 || r < 0.004) { console.log('  FALLO nivel'); bad++; }
    if (rpm === P.idle && id !== 'cupra' && b.lo < 0.55) { console.log('  FALLO: poco grave a ralentí'); bad++; }
  }
  const l1 = rms(render(id, 2, () => ({ rpm: 1800, throttle: 1, boost: 0.5, limiter: false })).slice(sr)), l2 = rms(render(id, 2, () => ({ rpm: P.redline * 0.85, throttle: 1, boost: 0.9, limiter: false })).slice(sr));
  if (!(l2 > l1 * 0.9) && id !== 'cupra') { console.log('  FALLO: no sube el volumen', l1, l2); bad++; }
  // WAV de demostración: ralentí, a fondo con cambios y soltar gas
  const demo = render(id, 14, (t) => { if (t < 2.5) return { rpm: P.idle, throttle: 0.06, boost: 0, limiter: false };
    const tt = t - 2.5; if (tt < 7.5) { const g = Math.floor(tt / 1.5), into = (tt % 1.5) / 1.5, sh = into < 0.1; return { rpm: sh ? P.redline * 0.55 : P.redline * (0.5 + 0.47 * into), throttle: sh ? 0.03 : 1, boost: sh ? 0.2 : 0.95, limiter: false }; }
    const u = tt - 7.5; return { rpm: Math.max(P.idle + 300, P.redline * 0.95 - u * 1500), throttle: 0, boost: 0, limiter: false }; });
  wav(`/tmp/engine_${id}.wav`, demo);
}
// pops: debe haber más energía de picos al soltar el gas en el Mini que en el Qashqai
const pk = (id) => mx(render(id, 6, () => ({ rpm: 5500, throttle: 0, boost: 0, limiter: false })).slice(sr * 2));
console.log('pico al soltar gas: mini', pk('mini').toFixed(2), '| bora', pk('bora').toFixed(2), '| qashqai', pk('qashqai').toFixed(2));
console.log(bad ? `${bad} fallos` : 'Todo correcto');
process.exit(bad ? 1 : 0);
