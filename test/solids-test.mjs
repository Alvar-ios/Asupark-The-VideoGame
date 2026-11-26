// Obstáculos de los circuitos importados: embistiendo a toda velocidad desde cualquiera de sus caras no se atraviesan.
import assert from 'node:assert/strict';
import { THEMES } from '../src/themes.js';
import { buildTrack, locate } from '../src/track.js';
import { CARS, makeCar, stepCar } from '../src/car.js';

const th = THEMES.misty, tr = buildTrack(th.seed, th.style), type = CARS[0], env = { ...th, gripMul: 1 };
const list = [...new Set([...tr.solids.values()].flat())].filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.35);
assert.ok(list.length > 30, 'el circuito tiene obstáculos');
let tried = 0, through = 0;
for (let k = 0; k < list.length; k += Math.max(1, Math.floor(list.length / 120))) {
  const s = list[k], ex = s[2] - s[0], ez = s[3] - s[1], l = Math.hypot(ex, ez), mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2;
  for (const side of [-1, 1]) {
    const nx = -ez / l * side, nz = ex / l * side, x = mx + nx * 1.4, z = mz + nz * 1.4;
    const loc = locate(tr, x, z, -1, {}); if (Math.abs(loc.h - s[4]) > 1.5 || Math.abs(loc.lat) > tr.wallEdge[loc.lat < 0 ? 0 : 1][loc.i]) continue; // fuera de la pista no se puede estar
    const c = makeCar(type, 'x', true);
    Object.assign(c, { x, z, px: x, pz: z, y: loc.h, py: loc.h, psi: Math.atan2(-nx, -nz), vx: -nx * 40, vz: -nz * 40, hint: loc.i, lastS: loc.s }); Object.assign(c.loc, loc);
    tried++;
    for (let i = 0; i < 30; i++) {
      stepCar(c, { steer: 0, throttle: 1, brake: 0, drift: false }, 1 / 120, tr, env);
      const along = ((c.x - s[0]) * ex + (c.z - s[1]) * ez) / (l * l), off = (c.x - mx) * nx + (c.z - mz) * nz;
      if (along > 0.15 && along < 0.85 && off < -0.1) { through++; break; }
    }
  }
}
assert.ok(tried > 20, `embestidas probadas: ${tried}`);
assert.ok(through <= tried * 0.02, `atravesados ${through} de ${tried}`);
console.log(`Obstáculos sólidos: ${tried} embestidas a 40 m/s, ${through} atravesadas`);
