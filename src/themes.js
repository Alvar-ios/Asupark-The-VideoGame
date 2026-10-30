import { hashStr } from './rng.js';

export const THEMES = {
  pruebas: {
    id: 'pruebas', name: 'Circuito de Pruebas', sub: 'Pista de juguete gigante', seed: 'tw-15-26',
    style: { nodes: 15, wobble: 0.55, pinch: 0.55, angJit: 0.7, length: 850, hill: 8, chicanes: 3, ramps: 2, pads: 5, rollers: 1, minR: 20, sep: 44, chicaneThr: 0.006, chicaneW: 170, candFrom: 120, candTo: 140, rampRun: 100, thr: [0.006, 0.01, 0.014], thr2: [0.008, 0.012, 0.016], rollerN: 4, padSep: 70 },
    skyTop: 0x7ec3ff, skyHor: 0xfff1da, fog: 0xfff1da, fogNear: 260, fogFar: 1500,
    ground: 0xd9b27c, grass: 0xff9a3a, dirt: 0xd96a00, road: 0xff7a1a, kerb1: 0x1f6fff, kerb2: 0xffffff,
    wall1: 0x1f6fff, wall2: 0xffffff, mount: 0x7d8fa0, sun: 0xfff3d6, sunDir: [-0.4, 0.8, 0.35],
    hemiSky: 0xffffff, hemiGround: 0xc99a5a, hemiI: 1.15, sunI: 1.0, deco: 'toy', treeCol: 0x3d7a3c, night: false, gripMul: 1, offroad: 0.62, toy: true,
  },
  valle: {
    id: 'valle', name: 'Valle Verde', sub: 'Rápida y fluida', seed: 'valle-11',
    style: { nodes: 11, wobble: 0.3, pinch: 0.15, angJit: 0.5, length: 2300, hill: 5.5, chicanes: 2, ramps: 2, pads: 6, rollers: 1 },
    skyTop: 0x3a7fd5, skyHor: 0xcfe6ff, fog: 0xcfe6ff, fogNear: 260, fogFar: 1500,
    ground: 0x4f9b45, grass: 0x5cae4f, dirt: 0x6e5a3c, road: 0x3c4049, kerb1: 0xe5352f, kerb2: 0xf4f4f4,
    wall1: 0xf4f4f4, wall2: 0xd8362f, mount: 0x6f8fa0, sun: 0xfff1c8, sunDir: [0.5, 0.6, 0.35],
    hemiSky: 0xcfe8ff, hemiGround: 0x4d6b3a, hemiI: 1.0, sunI: 1.1, deco: 'pine', treeCol: 0x2f7d3a, night: false, gripMul: 1, offroad: 0.62,
  },
  desierto: {
    id: 'desierto', name: 'Desierto Rojo', sub: 'Saltos y rasantes', seed: 'desierto-5',
    style: { nodes: 13, wobble: 0.38, pinch: 0.3, angJit: 0.6, length: 2100, hill: 3.5, chicanes: 1, ramps: 3, pads: 6, rollers: 2 },
    skyTop: 0xd9593a, skyHor: 0xffc98a, fog: 0xf2b27a, fogNear: 240, fogFar: 1400,
    ground: 0xc9733c, grass: 0xd4894a, dirt: 0x9a5a30, road: 0x4a4440, kerb1: 0x2a2a2a, kerb2: 0xffd23f,
    wall1: 0xffd23f, wall2: 0x2a2a2a, mount: 0xa8512f, sun: 0xffd9a0, sunDir: [-0.6, 0.35, 0.5],
    hemiSky: 0xffd9b0, hemiGround: 0x8a4a28, hemiI: 1.0, sunI: 1.2, deco: 'cactus', treeCol: 0x4a8a3a, night: false, gripMul: 0.95, offroad: 0.7,
  },
  neon: {
    id: 'neon', name: 'Noche Neón', sub: 'Técnica y de noche', seed: 'neon-3',
    style: { nodes: 14, wobble: 0.42, pinch: 0.35, angJit: 0.6, length: 2000, hill: 2.5, chicanes: 3, ramps: 2, pads: 8, rollers: 0 },
    skyTop: 0x0a0630, skyHor: 0x5a1b7a, fog: 0x2a0f45, fogNear: 120, fogFar: 1000,
    ground: 0x241a44, grass: 0x33265a, dirt: 0x281c4a, road: 0x45456a, kerb1: 0x19e3ff, kerb2: 0xff2fb9,
    wall1: 0x19e3ff, wall2: 0xff2fb9, mount: 0x2a1850, sun: 0x9ab8ff, sunDir: [0.3, 0.7, -0.4],
    hemiSky: 0x9a8cff, hemiGround: 0x4a3590, hemiI: 2.0, sunI: 1.5, deco: 'city', treeCol: 0x331a66, night: true, gripMul: 1, offroad: 0.62,
  },
  nieve: {
    id: 'nieve', name: 'Cumbre Nevada', sub: 'Resbaladiza y de altura', seed: 'nieve-9',
    style: { nodes: 10, wobble: 0.28, pinch: 0.12, angJit: 0.5, length: 2500, hill: 7, chicanes: 1, ramps: 2, pads: 5, rollers: 0 },
    skyTop: 0x7aa7d8, skyHor: 0xeef6ff, fog: 0xe3eefa, fogNear: 200, fogFar: 1300,
    ground: 0xe9f1f7, grass: 0xf4f9fc, dirt: 0xb7c4d0, road: 0x555b66, kerb1: 0x2f6fd6, kerb2: 0xf4f4f4,
    wall1: 0x2f6fd6, wall2: 0xf4f4f4, mount: 0xb4c7da, sun: 0xffffff, sunDir: [0.4, 0.7, 0.4],
    hemiSky: 0xe6f1ff, hemiGround: 0x9fb2c4, hemiI: 1.05, sunI: 1.0, deco: 'snowpine', treeCol: 0x2d6a55, night: false, gripMul: 0.78, offroad: 0.75,
  },
};
export const THEME_LIST = ['pruebas', 'valle', 'desierto', 'neon', 'nieve'];
const DAILY_THEMES = ['valle', 'desierto', 'neon', 'nieve'];

export function dailyInfo(d = new Date()) {
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const h = hashStr('daily-' + key);
  const th = THEMES[DAILY_THEMES[h % DAILY_THEMES.length]];
  const variant = (h >>> 3) % 3;
  const style = { ...th.style, nodes: 10 + ((h >>> 5) % 5), length: th.style.length + ((h >>> 9) % 5) * 120 - 200, wobble: th.style.wobble + (variant - 1) * 0.04 };
  return { key, theme: th, seed: 'daily-' + key, style, name: 'Pista del día', sub: th.name + ' · ' + key };
}
