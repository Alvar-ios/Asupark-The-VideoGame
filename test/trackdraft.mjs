// Borrador de circuitos de trazado fijo: estadísticas y dibujo. Uso: node test/trackdraft.mjs <archivo.json>
import { buildTrack } from '../src/track.js';
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const style = { chicanes: 0, hill: 0, ramps: 0, rollers: 0, pads: 0, padSep: 80, candFrom: 80, candTo: 80, thr: [0.006, 0.01, 0.014], ...cfg };
try {
  const tr = buildTrack('draft', style);
  let wr = 1e9, wi = 0, tight = []; for (let i = 0; i < tr.N; i++) { const r = 1 / tr.absK[i]; if (r < wr) { wr = r; wi = i; } }
  let minSep = 1e9; for (let i = 0; i < tr.N; i += 3) for (let j = i + 1; j < tr.N; j += 3) { const gap = Math.min(j - i, tr.N - (j - i)); if (gap < 90) continue; const d = Math.hypot(tr.X[i] - tr.X[j], tr.Z[i] - tr.Z[j]); if (d < minSep) minSep = d; }
  let maxG = 0; for (let i = 1; i < tr.N; i++) maxG = Math.max(maxG, Math.abs(tr.Y[i] - tr.Y[i - 1]) / tr.ds);
  let hmin = 1e9, hmax = -1e9; for (let i = 0; i < tr.N; i++) { hmin = Math.min(hmin, tr.Y[i]); hmax = Math.max(hmax, tr.Y[i]); }
  console.log('len', tr.len | 0, 'peorR', wr.toFixed(1), 'a', wi, 'sepMin', minSep.toFixed(1), 'pendMax', (maxG * 100).toFixed(1) + '%', 'altura', hmin.toFixed(1), '→', hmax.toFixed(1));
  fs.writeFileSync('/tmp/draft.json', JSON.stringify({ X: Array.from(tr.X), Z: Array.from(tr.Z), k: Array.from(tr.absK) }));
} catch (e) { console.log('FALLO', e.message); }
