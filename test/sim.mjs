// Simulación sin gráficos: comprueba que cada pista se genera bien y que un piloto automático la completa.
import { THEMES, THEME_LIST, dailyInfo } from '../src/themes.js';
import { buildTrack, ROAD_HALF } from '../src/track.js';
import { CARS, makeCar, placeCar, stepCar, resetToTrack } from '../src/car.js';
import { buildSpeedProfile, aiInput, benchmark, aiType } from '../src/ai.js';

const dt = 1 / 120;
const list = THEME_LIST.map((k) => ({ name: THEMES[k].name, seed: THEMES[k].seed, style: THEMES[k].style, th: THEMES[k] }));
const d = dailyInfo(new Date('2026-10-30'));
list.push({ name: 'Diaria ' + d.key, seed: d.seed, style: d.style, th: d.theme });
for (let day = 1; day <= 6; day++) { const x = dailyInfo(new Date(2026, 9, 30 + day)); list.push({ name: 'Diaria +' + day, seed: x.seed, style: x.style, th: x.theme }); }

let bad = 0;
for (const it of list) {
  const t0 = performance.now();
  const tr = buildTrack(it.seed, it.style);
  const tgen = (performance.now() - t0) | 0;
  let maxK = 0, maxGrad = 0;
  for (let i = 0; i < tr.N; i++) { maxK = Math.max(maxK, tr.absK[i]); }
  for (const type of CARS) {
    const bt = aiType(type), c = makeCar(bt, 'bot', false), prof = buildSpeedProfile(tr, bt);
    placeCar(c, tr, 0, 0, 0);
    const ai = { lane: 0, skill: 0.96 }, inp = { steer: 0, throttle: 0, brake: 0, drift: false, ers: false };
    let t = 0, walls = 0, lapTimes = [], lastLap = 0, resets = 0, air = 0, pads = 0, maxSpeed = 0, offT = 0;
    while (t < 500 && lapTimes.length < 2) {
      aiInput(c, tr, prof, ai, inp);
      stepCar(c, inp, dt, tr, it.th);
      for (const e of c.events) { if (e.t === 'wall') walls++; if (e.t === 'takeoff') air++; if (e.t === 'pad') pads++; }
      c.events.length = 0;
      if (c.offroad) offT += dt;
      maxSpeed = Math.max(maxSpeed, c.speed);
      if (c.stuckT > 3) { resetToTrack(c, tr); resets++; }
      t += dt;
      if (c.D >= (lapTimes.length + 1) * tr.len) { lapTimes.push(t - lastLap); lastLap = t; }
    }
    const bm = benchmark(tr, type, it.th, it.seed + type.id);
    const ok = lapTimes.length >= 2 && resets === 0 && bm;
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : 'FAIL'} ${it.name.padEnd(22)} ${type.id.padEnd(8)} len=${tr.len | 0}m Rmin=${(1 / maxK) | 0}m gen=${tgen}ms ramps=${tr.ramps.length} pads=${tr.pads.length} rollers=${tr.rollers.length} lap=${lapTimes.map((x) => x.toFixed(1)).join('/')}s walls=${walls} jumps=${air} pads=${pads} resets=${resets} vmax=${(maxSpeed * 3.6) | 0}km/h off=${offT.toFixed(1)}s bench=${bm ? bm.lap.toFixed(1) + ' [' + bm.sec.map((x) => x.toFixed(1)).join(',') + ']' : 'NONE'}`);
  }
}
console.log(bad ? `\n${bad} fallos` : '\nTodo correcto');
process.exit(bad ? 1 : 0);
