import { buildTrack } from '../src/track.js';
import { THEMES } from '../src/themes.js';
const base = THEMES.pruebas.style;
const out = [];
for (const nodes of [15, 17, 19]) for (let n = 1; n <= 150; n++) {
  const style = { ...base, nodes, wobble: 0.55, pinch: 0.55, chicanes: 3 };
  let tr; try { tr = buildTrack('tw-' + nodes + '-' + n, style); } catch (e) { continue; }
  let turn = 0, flips = 0, last = 0, maxK = 0;
  for (let i = 0; i < tr.N; i++) { turn += Math.abs(tr.kap[i]) * tr.ds; maxK = Math.max(maxK, tr.absK[i]); const k = tr.kap[i]; if (Math.abs(k) > 0.012) { const sg = Math.sign(k); if (last && sg !== last) flips++; last = sg; } }
  if (tr.len > 1250 || tr.ramps.length < 2 || tr.rollers.length < 1 || tr.pads.length < 4) continue;
  out.push({ seed: 'tw-' + nodes + '-' + n, nodes, len: tr.len | 0, turn: +turn.toFixed(1), flips, Rmin: (1 / maxK) | 0, ramps: tr.ramps.length, rollers: tr.rollers.length, pads: tr.pads.length, sc: turn + flips * 0.8 });
}
out.sort((a, b) => b.sc - a.sc);
console.log(out.slice(0, 8).map((x) => JSON.stringify(x)).join('\n'));
