import { THEMES, THEME_LIST } from '../src/themes.js';
import { buildTrack } from '../src/track.js';
import { CARS, makeCar, placeCar, stepCar } from '../src/car.js';
import { buildSpeedProfile, aiInput, AI_TOP } from '../src/ai.js';
// piloto automático de la salida lanzada: ¿llega a la meta sin chocar en todos los circuitos y coches?
let bad = 0;
for (const k of THEME_LIST) { const th = THEMES[k], tr = buildTrack(th.seed, th.style);
  for (const type of CARS) { const prof = buildSpeedProfile(tr, type), c = makeCar(type, 'a', false); placeCar(c, tr, -260, 0, 18);
    const ai = { lane: 0, skill: AI_TOP * 0.5 }, inp = {}; let walls = 0, t = 0, tl5 = null;
    while (c.D < 0 && t < 40) { aiInput(c, tr, prof, ai, inp); if (c.speed > 34) { inp.throttle = 0; inp.brake = Math.max(inp.brake, 0.15); } stepCar(c, inp, 1/120, tr, th); for (const e of c.events) if (e.t === 'wall') walls++; c.events.length = 0; t += 1/120; if (tl5 == null && -c.D / Math.max(20, c.speed) <= 5.5) tl5 = t; }
    const lead = t - tl5; if (walls > 0 || t >= 40) { bad++; console.log('MAL', k, type.id, 'choques', walls, 'tiempo', t.toFixed(1)); } else if (type.id === 'porsche') console.log('ok', k, 'llega en', t.toFixed(1), 's; cuenta atrás', lead.toFixed(1), 's; v', c.speed.toFixed(0)); } }
console.log(bad ? bad + ' fallos' : 'Todo correcto');
