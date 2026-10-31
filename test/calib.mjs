// Compara el piloto automático con los mejores tiempos reales de la clasificación (ms).
import { THEMES } from '../src/themes.js';
import { buildTrack } from '../src/track.js';
import { CARS } from '../src/car.js';
import { benchmark } from '../src/ai.js';
const REAL = { pruebas: { aston: 21475, s4: 22900, cobra: 23175, stradale: 24275, gtr: 24950, mustang: 25683, z240: 25900, minitoon: 26525 }, spa: { aston: 38250, lotus: 40417, stradale: 42458, s4: 43483, bora: 43700, cobra: 43950, porsche: 45092, m3: 43725, cupra: 45717, z240: 45617, mustang: 45675 }, monaco: { aston: 31992, porsche: 38042 }, desierto: { porsche: 43575, mx5: 48950 }, valle: { porsche: 41442, golf: 47617 }, neon: { bora: 49108 } };
let sum = 0, n = 0;
for (const [tk, cars] of Object.entries(REAL)) {
  const th = THEMES[tk], tr = buildTrack(th.seed, th.style);
  for (const [cid, ms] of Object.entries(cars)) {
    const type = CARS.find((c) => c.id === cid), b = benchmark(tr, type, th, tk + cid + Math.random());
    const r = b ? b.lap * 1000 / ms : NaN; sum += r; n++;
    console.log(tk.padEnd(9), cid.padEnd(9), 'real', (ms / 1000).toFixed(1), 'IA', b ? b.lap.toFixed(1) : '—', 'IA/real', r.toFixed(2));
  }
}
console.log('media IA/real', (sum / n).toFixed(3));
