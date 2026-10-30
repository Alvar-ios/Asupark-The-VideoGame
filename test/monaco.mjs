import { buildTrack } from '../src/track.js';
import fs from 'node:fs';
const nodes = JSON.parse(process.argv[2]);
const style = { fixedNodes: nodes, scale: +process.argv[3] || 1, chicanes: 0, hill: 0, ramps: 0, rollers: 0, pads: 3, minR: +process.env.MINR || 14, sep: +process.env.SEP || 34, padSep: 80, candFrom: 80, candTo: 80, thr: [0.006, 0.01, 0.014],
  hillPts: [[0, 0], [0.09, 1.5], [0.2, 9], [0.3, 17], [0.4, 16], [0.47, 9], [0.55, 4], [0.65, 3], [0.8, 1], [1, 0]] };
try {
  const tr = buildTrack('monaco', style);
  let maxK = 0, hair = 0, prev = 0; for (let i = 0; i < tr.N; i++) { maxK = Math.max(maxK, tr.absK[i]); const h = tr.absK[i] > 0.03; if (h && !prev) hair++; prev = h; }
  let maxG = 0; for (let i = 1; i < tr.N; i++) maxG = Math.max(maxG, Math.abs(tr.Y[i] - tr.Y[i - 1]) / tr.ds);
  console.log('len', tr.len | 0, 'Rmin', (1 / maxK) | 0, 'tightCorners', hair, 'maxGrad', maxG.toFixed(3), 'pads', tr.pads.length);
  let minSep = 1e9, at = [0,0]; for (let i = 0; i < tr.N; i += 3) for (let j = i + 1; j < tr.N; j += 3) { const gap = Math.min(j - i, tr.N - (j - i)); if (gap < 90) continue; const d = Math.hypot(tr.X[i] - tr.X[j], tr.Z[i] - tr.Z[j]); if (d < minSep) { minSep = d; at = [i, j]; } }
  let wr = 1e9, wi = 0; for (let i = 0; i < tr.N; i++) if (1 / tr.absK[i] < wr) { wr = 1 / tr.absK[i]; wi = i; }
  console.log('minSep', minSep.toFixed(1), 'worstR', wr.toFixed(1), 'at xz', tr.X[wi].toFixed(0), tr.Z[wi].toFixed(0)); const low = []; for (let i = 0; i < tr.N; i += 1) if (1 / tr.absK[i] < 22) low.push(i); const grp = []; for (const i of low) { if (!grp.length || i - grp[grp.length - 1][1] > 15) grp.push([i, i]); else grp[grp.length - 1][1] = i; } console.log('tight<22m at', grp.map(g => tr.X[g[0]].toFixed(0) + ',' + tr.Z[g[0]].toFixed(0) + ' (R' + (1 / Math.max(...Array.from({ length: g[1] - g[0] + 1 }, (_, k) => tr.absK[g[0] + k]))).toFixed(0) + ')').join(' | '));
  fs.writeFileSync('/tmp/monaco.json', JSON.stringify({ X: Array.from(tr.X), Z: Array.from(tr.Z), k: Array.from(tr.kap) }));
} catch (e) { console.log('FAIL', e.message); }
