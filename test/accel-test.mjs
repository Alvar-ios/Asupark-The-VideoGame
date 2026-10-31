import { CARS, makeCar, placeCar, stepCar } from '../src/car.js';
// pista recta de 6 km para medir solo la aceleración
const N = 6000, tr = { seed: 'recta', N, ds: 1, len: N, X: new Float64Array(N), Z: Float64Array.from({ length: N }, (_, i) => i), Y: new Float64Array(N), TX: new Float64Array(N), TZ: new Float64Array(N).fill(1), kap: new Float64Array(N), absK: new Float64Array(N), ramps: [], pads: [], rollers: [] };
for (const type of CARS) {
  const c = makeCar(type, 'x', true); placeCar(c, tr, 2, 0, 0); const inp = { steer: 0, throttle: 1, brake: 0, drift: false };
  let t = 0, t100 = 0, t95 = 0; const H = 1 / 120;
  while (t < 90 && c.D < N - 200) {
    stepCar(c, inp, H, tr, { gripMul: 1, offroad: 0.6, slope: 0 }); c.events.length = 0; t += H;
    if (!t100 && c.speed * 3.6 >= 100) t100 = t; if (!t95 && c.speed >= type.vmax * 0.95) t95 = t; if (c.speed >= type.vmax * 0.99) break;
  }
  console.log(type.id.padEnd(8), '0-100:', t100.toFixed(1) + 's', ' 95% de máx:', (t95 || NaN).toFixed(1) + 's', ' final', (c.speed * 3.6) | 0, 'km/h en', t.toFixed(1) + 's');
}
