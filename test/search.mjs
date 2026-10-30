import { buildTrack } from '../src/track.js';
const style = { nodes: 15, wobble: 0.5, pinch: 0.5, angJit: 0.7, length: 850, hill: 8, chicanes: 2, ramps: 2, pads: 5, rollers: 1, minR: 20, sep: 44, chicaneThr: 0.006, chicaneW: 170, candFrom: 120, candTo: 140, rampRun: 100, thr: [0.006, 0.01, 0.014], thr2: [0.008, 0.012, 0.016], rollerN: 4, padSep: 70 };
const res = [];
for (let n = 1; n <= 260; n++) {
  let tr; try { tr = buildTrack('test-' + n, style); } catch (e) { continue; }
  let maxK = 0, tight = 0, prev = 0, hair = 0;
  for (let i = 0; i < tr.N; i++) {
    maxK = Math.max(maxK, tr.absK[i]);
    const hot = tr.absK[i] > 0.03;
    if (hot && !prev) hair++;
    prev = hot ? 1 : 0;
    if (tr.absK[i] > 0.018) tight++;
  }
  // cambios de signo de curvatura (eses)
  let flips = 0, last = 0;
  for (let i = 0; i < tr.N; i++) { const k = tr.kap[i]; if (Math.abs(k) > 0.012) { const sg = Math.sign(k); if (last && sg !== last) flips++; last = sg; } }
  const score = hair * 3 + flips * 2 + tr.ramps.length * 4 + tr.rollers.length * 4 + tr.pads.length - Math.abs(tr.len - 1050) / 25;
  res.push({ n, len: tr.len | 0, Rmin: (1 / maxK) | 0, hair, flips, tightPct: Math.round((tight / tr.N) * 100), ramps: tr.ramps.length, rollers: tr.rollers.length, pads: tr.pads.length, score: +score.toFixed(1) });
}
res.sort((a, b) => b.score - a.score);
console.log(res.slice(0, 12).map((r) => JSON.stringify(r)).join('\n'));
