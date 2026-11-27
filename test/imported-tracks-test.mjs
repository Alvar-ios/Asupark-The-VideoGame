// Circuitos importados: la arena frena mucho, la salida lanzada no puede chocar y el fantasma recuerda su kart.
import assert from 'node:assert/strict';
const { THEMES } = await import('../src/themes.js');
const { buildTrack, locate, pointAt } = await import('../src/track.js');
const { CARS, makeCar, placeCar, stepCar, railStep } = await import('../src/car.js');
const th = THEMES.mariocircuit, tr = buildTrack(th.seed, th.style), env = { ...th, gripMul: 1 }, g = tr.paved;
const on = (x, z) => { const i = Math.floor((x - g.x) / g.cell), j = Math.floor((z - g.z) / g.cell), n = j * g.w + i; return (g.bits[n >> 3] >> (n & 7)) & 1; };
// velocidad que se alcanza yendo recto con las dos ruedas en asfalto, una fuera y las dos fuera (recta larga de salida)
const P = {}; const edgeAt = (s, side) => { let d = 0; while (d < 11) { pointAt(tr, s, side * d, P); if (!on(P.x, P.z)) break; d += 0.05; } return d; };
const speed = {};
for (const [name, off] of [['en el centro', null], ['a ras del borde, dentro', -0.75], ['una rueda fuera', 0], ['las dos fuera, pegado al asfalto', 0.75], ['arena, 2 m fuera', 2]]) {
  const c = makeCar(CARS[0], 'x', true); let s = 5; placeCar(c, tr, s, off == null ? 0 : edgeAt(s, 1) + off, 30);
  for (let i = 0; i < 240; i++) { const lat = off == null ? 0 : edgeAt(c.loc.s, 1) + off; pointAt(tr, c.loc.s, lat, P); const v = Math.hypot(c.vx, c.vz); c.x = P.x; c.z = P.z; c.psi = Math.atan2(P.tx, P.tz); c.vx = Math.sin(c.psi) * v; c.vz = Math.cos(c.psi) * v; if (v < 1) break; stepCar(c, { steer: 0, throttle: 1, brake: 0, drift: false }, 1 / 120, tr, env); if (i === 239 || c.loc.s > 60 && c.loc.s < 300) { if (c.loc.s > 60 && c.loc.s < 300) break; } }
  speed[name] = Math.hypot(c.vx, c.vz) * 3.6;
  console.log(name.padEnd(34), (Math.hypot(c.vx, c.vz) * 3.6).toFixed(0), 'km/h', c.offroad ? '(fuera)' : '');
}
assert.ok(speed['a ras del borde, dentro'] > 110, 'por el asfalto no se frena');
assert.ok(speed['una rueda fuera'] < 95, 'una rueda fuera frena');
assert.ok(speed['las dos fuera, pegado al asfalto'] < 50, 'la arena pegada al asfalto frena mucho');
for (const key of ['misty', 'mariocircuit', 'lider']) {
  const t = THEMES[key], track = buildTrack(t.seed, t.style), c = makeCar(CARS[0], 'x', true); placeCar(c, track, -170, 0, 18);
  let walls = 0, maxLat = 0, maxJump = 0, last = c.D, steps = 0; for (; c.D < 0 && steps < 4000; steps++) { railStep(c, track, 1 / 120); walls += c.events.filter((e) => e.t === 'wall').length; maxLat = Math.max(maxLat, Math.abs(c.loc.lat)); maxJump = Math.max(maxJump, Math.abs(c.D - last - c.speed / 120)); last = c.D; }
  console.log(key, 'raíles hasta la meta:', (steps / 120).toFixed(1), 's, golpes', walls, '| desvío máximo del centro', maxLat.toFixed(2), 'm | llega a', (c.speed * 3.6).toFixed(0), 'km/h');
  assert.ok(c.D >= 0 && walls === 0 && maxLat < 0.6);
}
const { packGhost, splitGhost } = await import('../src/ghostlook.js'); const { itemById, ITEMS } = await import('../src/economy.js');
const frames = Array.from({ length: 400 }, (_, i) => i * 0.123);
for (const it of ITEMS.filter((i) => ['kart', 'paint', 'decal'].includes(i.type))) { const x = splitGhost(JSON.parse(JSON.stringify(packGhost(frames, { [it.type]: it })))); assert.equal(x.frames.length, 400); assert.equal(it.type === 'kart' ? x.skin : it.type === 'paint' ? x.paint.id : x.decal, it.type === 'kart' ? it.skin : it.type === 'paint' ? it.id : it.decal, it.id); }
assert.equal(splitGhost(frames).frames.length, 400); assert.equal(splitGhost(packGhost(frames, {})).skin, null);
console.log('fantasma: el aspecto va y vuelve con todos los karts, colores y calcomanías; los antiguos se siguen leyendo');
