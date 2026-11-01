import assert from 'node:assert/strict';
import { THEMES } from '../src/themes.js';
import { buildTrack, ROAD_HALF, setRoad } from '../src/track.js';
import { CARS, makeCar, placeCar, stepCar } from '../src/car.js';
import { mudAt, mudParams, patchBoundary, puddleAt, puddleParams } from '../src/surface.js';

for (const [at, params] of [[puddleAt, puddleParams(0)], [mudAt, mudParams(0)]]) {
  const center = params.start + params.halfLength;
  assert.equal(at(center, params.lane), 1);
  assert.equal(at(center + params.halfLength * 1.5, params.lane), 0);
}

assert.notEqual(patchBoundary(0, 3), patchBoundary(Math.PI / 2, 3));

const theme = THEMES.spa;
const track = buildTrack(theme.seed, theme.style);
setRoad(track);
const kerbIndex = track.kerb.findIndex((side) => side !== 0);
assert.notEqual(kerbIndex, -1, 'Spa should have driveable kerbs');

const kerbSide = track.kerb[kerbIndex];
const kerbS = kerbIndex * track.ds;
const input = { steer: 0, throttle: 0, brake: 0, drift: false };
const kerbCar = makeCar(CARS.find((car) => car.id === 'porsche'), 'kerb-test', false);
placeCar(kerbCar, track, kerbS, kerbSide * (ROAD_HALF + 0.8), 18);
stepCar(kerbCar, input, 1 / 120, track, theme);
assert.equal(kerbCar.offroadFactor, 0, 'A kerb should not apply gravel physics');
assert.equal(kerbCar.offroad, false, 'A kerb should remain part of the road');

const runoffCar = makeCar(CARS.find((car) => car.id === 'porsche'), 'runoff-test', false);
placeCar(runoffCar, track, kerbS, kerbSide * (ROAD_HALF + 3.2), 18);
stepCar(runoffCar, input, 1 / 120, track, theme);
assert.ok(runoffCar.offroadFactor > 0.95, 'The gravel beyond the kerb should retain off-road physics');

console.log('Superficies irregulares y física de pianos: todo correcto');
