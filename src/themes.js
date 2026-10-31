import { hashStr } from './rng.js';

export const THEMES = {
  pruebas: {
    id: 'pruebas', name: 'Circuito de Pruebas', sub: 'Circuito permanente · curvas y desniveles', seed: 'tw-15-26',
    style: {zones: [[0.62,0.7,'dirt']],  nodes: 15, wobble: 0.55, pinch: 0.55, angJit: 0.7, length: 850, hill: 8, chicanes: 3, ramps: 2, pads: 5, rollers: 1, minR: 20, sep: 44, banks: [[0.55,0.63,14]], chicaneThr: 0.006, chicaneW: 170, candFrom: 120, candTo: 140, rampRun: 100, thr: [0.006, 0.01, 0.014], thr2: [0.008, 0.012, 0.016], rollerN: 4, padSep: 70 },
    skyTop: 0x79a9d8, skyHor: 0xf1d6bb, fog: 0xd8d4cc, fogNear: 310, fogFar: 1800,
    ground: 0x4b5b42, grass: 0x657d4c, dirt: 0x75634d, road: 0x353a40, kerb1: 0xd8473d, kerb2: 0xe5e2d8,
    wall1: 0xd9d9d2, wall2: 0xa83d35, mount: 0x65717c, sun: 0xffd5a0, sunDir: [-0.72, 0.48, 0.5],
    hemiSky: 0xd9e7fa, hemiGround: 0x565849, hemiI: 0.92, sunI: 1.2, deco: 'pine', treeCol: 0x3d6840, night: false, temp: 22, humidity: 0.35, wind: [3, 0.6], gripMul: 1, offroad: 0.62,
  },
  monaco: {
    id: 'monaco', name: 'Puerto Urbano', sub: 'Réplica del trazado real: Santa Devota, Casino, horquilla, túnel y piscina', seed: 'monaco-1',
    style: { zones: [[0.666,0.757,'dry']], startNear: [60, 6], fixedNodes: [[120,12],[60,6],[0,0],[-70,-6],[-140,-14],[-182,-28],[-206,-62],[-208,-114],[-196,-172],[-172,-228],[-152,-268],[-152,-300],[-176,-326],[-172,-356],[-142,-378],[-100,-384],[-50,-378],[0,-366],[38,-346],[54,-318],[52,-290],[34,-268],[6,-262],[-18,-276],[-26,-246],[-8,-224],[30,-212],[80,-210],[130,-196],[168,-172],[190,-142],[206,-118],[194,-94],[208,-72],[232,-54],[222,-28],[206,-4],[200,22],[182,40],[150,38]], scale: 0.8, half: 3.4, wall: 5.2, chicanes: 0, hill: 0, ramps: 0, rollers: 0, pads: 2, minR: 6, sep: 16, padSep: 80, candFrom: 80, candTo: 80,
      tunnels: [[0.666,0.757]], hillPts: [[0,0.5],[0.179,1],[0.27,10],[0.355,20],[0.423,24],[0.533,21],[0.587,17],[0.624,13],[0.641,10],[0.666,9],[0.757,3],[0.815,1.5],[0.85,1],[0.902,0.5],[1,0.5]] },
    skyTop: 0x3f95f0, skyHor: 0xeaf4ff, fog: 0xdce9f6, fogNear: 240, fogFar: 1400,
    ground: 0x2a7fb5, grass: 0xa7adb5, dirt: 0x8c929a, road: 0x40434b, kerb1: 0xe5352f, kerb2: 0xffffff,
    wall1: 0xf3f3f3, wall2: 0xdf2f2a, mount: 0xb9c7d6, sun: 0xfff1cf, sunDir: [-0.35, 0.65, 0.5],
    hemiSky: 0xe6f1ff, hemiGround: 0x8a8f96, hemiI: 1.05, sunI: 1.15, deco: 'toy', harbor: true, urban: true, noKerbs: true, palette: [0xf3e9d8, 0xe8c9a0, 0xd9a47a, 0xf6f2ea, 0xcf8f6b, 0xe9dcc2], treeCol: 0x3d7a3c, night: false, temp: 19, humidity: 0.85, wind: [5, 2.2], gripMul: 1, offroad: 0.6, slope: 1.5, weather: 'rain', wetGrip: 0.76, brakeForce: 22,
  },
  spa: {
    id: 'spa', name: 'Ardenas · estilo Spa', sub: 'Corto y estrecho: horquilla, Eau Rouge y cambios de rasante', seed: 'spa-1',
    style: {zones: [[0.18,0.23,'gravel'],[0.62,0.68,'ice']], "ramps": 0, "rollers": 0, "pads": 0, "chicanes": 0, "hill": 0, "banks": [[0.86,0.94,12]], "rampList": [{"u":0.5,"len":10,"h":1.1}], "fixedNodes": [[-150, 240], [-60, 246], [40, 246], [92, 246], [122, 238], [136, 218], [124, 198], [96, 190], [66, 166], [60, 128], [38, 96], [30, 62], [44, 32], [26, 4], [-30, -14], [-120, -22], [-210, -22], [-248, -16], [-268, 2], [-292, 6], [-326, 22], [-352, 56], [-336, 94], [-296, 108], [-250, 110], [-214, 122], [-196, 152], [-206, 184], [-226, 206], [-212, 228], [-190, 236], [-170, 242]], "scale": 1.3, "minR": 8, "sep": 22, "half": 5, "wall": 7.8, "startNear": [-60, 246], "hillPts": [[0, 3], [0.1, 5], [0.2, 0], [0.3, 9], [0.45, 12], [0.55, 7], [0.68, 3], [0.8, 2], [0.92, 2], [1, 3]]},
    skyTop: 0x6f7f8c, skyHor: 0xc9d0d2, fog: 0xaab4b6, fogNear: 140, fogFar: 1000,
    ground: 0x35552f, grass: 0x44703a, dirt: 0x5b4a33, road: 0x30343a, kerb1: 0xd8473d, kerb2: 0xeeeeea,
    wall1: 0xc9cbc9, wall2: 0xb23a32, mount: 0x4d6a52, sun: 0xe9eef2, sunDir: [-0.3, 0.55, 0.45],
    hemiSky: 0xcfd9e0, hemiGround: 0x4c5a3c, hemiI: 0.95, sunI: 0.75, deco: 'pine', treeCol: 0x1f4d2b, night: false, temp: 11, humidity: 0.9, wind: [6, 1.0], gripMul: 0.98, offroad: 0.6, slope: 1.4,
    weather: 'rain', wetGrip: 0.78, brakeForce: 22, mud: true,
  },
  valle: {
    id: 'valle', name: 'Valle Verde · estilo Interlagos', sub: 'Descida do Lago, cuesta final y peralte en la Junção', seed: 'valle-v2',
    style: {zones: [[0.4,0.47,'dirt'],[0.7,0.74,'grass']],  fixedNodes: [[0,0],[70,0],[140,0],[200,6],[238,34],[236,70],[200,88],[170,84],[160,112],[188,134],[236,140],[272,168],[270,212],[232,238],[180,236],[140,214],[100,222],[60,250],[10,254],[-36,230],[-50,190],[-30,150],[-60,112],[-70,70],[-44,30]], half: 5, wall: 7.8, chicanes: 0, hill: 0, rollers: 0, minR: 12, sep: 30, scale: 1.2, ramps: 0, pads: 3, hillPts: [[0,3],[0.12,6],[0.22,2],[0.34,-1],[0.5,-3],[0.62,0],[0.74,4],[0.9,6],[1,3]], banks: [[0.84,0.95,16]], rampList: [{u:0.58,len:16,h:2.3}] },    skyTop: 0x547fc2, skyHor: 0xffc38d, fog: 0xe5bd9c, fogNear: 260, fogFar: 1500,
    ground: 0x4f9b45, grass: 0x5cae4f, dirt: 0x6e5a3c, road: 0x3c4049, kerb1: 0xe5352f, kerb2: 0xf4f4f4,
    wall1: 0xf4f4f4, wall2: 0xd8362f, mount: 0x6f8fa0, sun: 0xffbd7b, sunDir: [0.76, 0.34, 0.53],
    hemiSky: 0xc3d9fa, hemiGround: 0x6d5947, hemiI: 0.88, sunI: 1.3, deco: 'pine', treeCol: 0x2f7d3a, night: false, temp: 27, humidity: 0.55, wind: [4, 3.9], gripMul: 1, offroad: 0.62,
  },
  desierto: {
    id: 'desierto', name: 'Desierto Rojo · estilo México', sub: 'Recta larguísima, estadio peraltado y doble salto', seed: 'desierto-v2',
    style: {zones: [[0.06,0.3,'asphalt'],[0.7,0.78,'sand']],  fixedNodes: [[0,0],[90,0],[180,0],[260,0],[320,14],[345,50],[330,86],[296,96],[290,126],[318,148],[350,172],[340,212],[300,228],[262,214],[236,232],[246,266],[210,288],[160,276],[130,244],[90,236],[50,258],[0,262],[-44,240],[-58,196],[-40,150],[-52,100],[-40,48]], half: 5, wall: 7.8, chicanes: 0, hill: 0, rollers: 0, minR: 12, sep: 30, scale: 1.1, ramps: 0, pads: 3, hillPts: [[0,0],[0.3,1],[0.6,0],[1,0]], banks: [[0.52,0.66,22]], rampList: [{u:0.2,len:14,h:2},{u:0.26,len:14,h:2.8}] },    skyTop: 0xd9593a, skyHor: 0xffc98a, fog: 0xf2b27a, fogNear: 240, fogFar: 1400,
    ground: 0xc9733c, grass: 0xd4894a, dirt: 0x9a5a30, road: 0x4a4440, kerb1: 0x2a2a2a, kerb2: 0xffd23f,
    wall1: 0xffd23f, wall2: 0x2a2a2a, mount: 0xa8512f, sun: 0xffd9a0, sunDir: [-0.6, 0.35, 0.5],
    hemiSky: 0xffd9b0, hemiGround: 0x8a4a28, hemiI: 1.0, sunI: 1.2, deco: 'cactus', treeCol: 0x4a8a3a, night: false, temp: 38, humidity: 0.1, wind: [8, 1.6], gripMul: 0.95, offroad: 0.7, surface: 'dirt', offroadGrip: 0.58, brakeGrip: 0.78, rollingDrag: 0.82, steerOffroad: 0.64, dust: 0xbd7545, brakeForce: 25,
  },
  neon: {
    id: 'neon', name: 'Noche Neón · estilo Suzuka', sub: 'Eses, 130R peraltada y túnel urbano', seed: 'neon-v2',
    style: {zones: [[0.06,0.17,'dry'],[0.6,0.64,'ice']],  fixedNodes: [[0,0],[60,0],[120,-4],[160,-30],[200,-34],[226,-6],[262,4],[290,-22],[322,-12],[336,22],[322,54],[290,62],[262,88],[270,124],[300,146],[300,184],[262,206],[214,196],[190,170],[150,160],[112,176],[80,210],[36,224],[-14,206],[-34,170],[-30,120],[-48,76],[-30,30]], half: 5, wall: 7.8, chicanes: 0, hill: 0, rollers: 0, minR: 13, sep: 30, scale: 1, ramps: 0, pads: 5, hillPts: [[0,0],[0.3,2],[0.55,5],[0.8,2],[1,0]], tunnels: [[0.06,0.17]], banks: [[0.4,0.5,18]], rampList: [{u:0.74,len:10,h:1.2}] },    skyTop: 0x0a0630, skyHor: 0x5a1b7a, fog: 0x2a0f45, fogNear: 120, fogFar: 1000,
    ground: 0x241a44, grass: 0x33265a, dirt: 0x281c4a, road: 0x45456a, kerb1: 0x19e3ff, kerb2: 0xff2fb9,
    wall1: 0x19e3ff, wall2: 0xff2fb9, mount: 0x2a1850, sun: 0x9ab8ff, sunDir: [0.3, 0.7, -0.4],
    hemiSky: 0x9a8cff, hemiGround: 0x4a3590, hemiI: 2.0, sunI: 1.5, deco: 'city', treeCol: 0x331a66, night: true, temp: 15, humidity: 0.8, wind: [3, 5.0], gripMul: 1, offroad: 0.62, weather: 'rain', wetGrip: 0.82, brakeForce: 24,
  },
  nieve: {
    id: 'nieve', name: 'Cumbre Nevada · estilo Alpino', sub: 'Horquillas en cuesta, túnel de aludes y badenes', seed: 'nieve-v2',
    style: {zones: [[0,0.25,'asphalt'],[0.28,0.38,'dry'],[0.5,0.6,'ice']],  fixedNodes: [[0,0],[60,0],[120,0],[170,10],[200,40],[190,78],[150,92],[120,80],[90,98],[96,136],[132,152],[170,170],[176,210],[140,236],[96,226],[60,200],[20,210],[-18,236],[-62,224],[-80,184],[-62,146],[-84,108],[-76,62],[-44,26]], half: 5, wall: 7.8, chicanes: 0, hill: 0, rollers: 0, minR: 13, sep: 30, scale: 1, ramps: 0, pads: 4, hillPts: [[0,0],[0.15,4],[0.35,12],[0.5,16],[0.7,9],[0.88,3],[1,0]], tunnels: [[0.28,0.38]], rollers: 0, rampList: [{u:0.8,len:12,h:1.8}] },    skyTop: 0x7aa7d8, skyHor: 0xeef6ff, fog: 0xe3eefa, fogNear: 200, fogFar: 1300,
    ground: 0xe9f1f7, grass: 0xf4f9fc, dirt: 0xb7c4d0, road: 0x555b66, kerb1: 0x2f6fd6, kerb2: 0xf4f4f4,
    wall1: 0x2f6fd6, wall2: 0xf4f4f4, mount: 0xb4c7da, sun: 0xffffff, sunDir: [0.4, 0.7, 0.4],
    hemiSky: 0xe6f1ff, hemiGround: 0x9fb2c4, hemiI: 1.05, sunI: 1.0, deco: 'snowpine', treeCol: 0x2d6a55, night: false, temp: -6, humidity: 0.6, wind: [9, 2.4], gripMul: 0.78, offroad: 0.75, surface: 'snow', offroadGrip: 0.38, brakeGrip: 0.62, rollingDrag: 1.05, steerOffroad: 0.52, dust: 0xdbeafa, brakeForce: 20, traction: 0.86,
  },
};
export const THEME_LIST = ['pruebas', 'monaco', 'spa', 'valle', 'desierto', 'neon', 'nieve'];
const DAILY_THEMES = ['valle', 'desierto', 'neon', 'nieve'];

export function dailyInfo(d = new Date()) {
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const h = hashStr('daily-' + key);
  const th = THEMES[DAILY_THEMES[h % DAILY_THEMES.length]];
  const variant = (h >>> 3) % 3;
  const kinds = { valle: ['dirt', 'grass', 'gravel'], desierto: ['sand', 'asphalt', 'gravel'], neon: ['ice', 'wet', 'dry'], nieve: ['ice', 'asphalt', 'snow'] }[th.id];
  const style = { nodes: 10 + ((h >>> 5) % 5), wobble: 0.3 + (variant - 1) * 0.05, pinch: 0.45, angJit: 0.6, length: 1250 + ((h >>> 9) % 5) * 90, hill: 4, chicanes: 2, ramps: 2, pads: 4, rollers: 1, minR: 13, sep: 36, half: 5, wall: 7.8, autoZones: kinds };
  return { key, theme: th, seed: 'daily-' + key, style, name: 'Pista del día', sub: th.name + ' · ' + key };
}
