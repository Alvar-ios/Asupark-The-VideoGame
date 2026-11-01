// Shared road-water layout so the visual puddles and grip model line up.
export function puddleAt(s, lat) {
  const index = Math.floor((s - 38) / 64);
  if (index < 0) return 0;
  const start = 38 + index * 64;
  const lane = Math.sin(index * 12.989) * 3.25;
  const halfLength = 3.7 + (index % 4) * 0.32;
  const halfWidth = 1.05 + (index % 3) * 0.22;
  const ds = Math.abs(s - (start + halfLength));
  const dl = Math.abs(lat - lane);
  const edge = Math.max(ds / halfLength, dl / halfWidth);
  if (edge >= 1) return 0;
  const t = 1 - edge;
  return t * t * (3 - 2 * t);
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Barro: manchas sobre la trazada (frenan y quitan agarre). Mismo diseño que los charcos, con otra cadencia.
export function mudParams(i) { return { lane: Math.sin(i * 7.31 + 1.3) * 2.5, halfLength: 6 + (i % 3) * 1.6, halfWidth: 1.7 + (i % 2) * 0.55 }; }
export const MUD_START = 120, MUD_STEP = 150;
export function mudAt(s, lat) {
  const index = Math.floor((s - MUD_START) / MUD_STEP);
  if (index < 0) return 0;
  const { lane, halfLength, halfWidth } = mudParams(index), start = MUD_START + index * MUD_STEP;
  const edge = Math.max(Math.abs(s - (start + halfLength)) / halfLength, Math.abs(lat - lane) / halfWidth);
  if (edge >= 1) return 0;
  const t = 1 - edge; return t * t * (3 - 2 * t);
}

// ===== Superficies: cada tipo cambia agarre, frenada, resistencia, dirección y tracción =====
// g agarre lateral, b frenada, d resistencia al avance, s autoridad de la dirección, a tracción al acelerar
export const SURF = {
  asphalt: { g: 1, b: 1, d: 0, s: 1, a: 1, col: null, name: 'ASFALTO' },
  wet: { g: 0.78, b: 0.8, d: 0.04, s: 0.96, a: 0.95, col: 0x2d3138, name: 'MOJADO' },
  dirt: { g: 0.74, b: 0.82, d: 0.22, s: 0.92, a: 0.92, col: 0x7a5a3a, name: 'TIERRA' },
  gravel: { g: 0.66, b: 0.74, d: 0.4, s: 0.88, a: 0.86, col: 0x8d877a, name: 'GRAVA' },
  grass: { g: 0.58, b: 0.62, d: 0.6, s: 0.82, a: 0.76, col: 0x4f8a3e, name: 'HIERBA' },
  sand: { g: 0.56, b: 0.66, d: 0.8, s: 0.82, a: 0.74, col: 0xd9b985, name: 'ARENA' },
  snow: { g: 0.46, b: 0.55, d: 0.45, s: 0.82, a: 0.78, col: 0xe8f0f6, name: 'NIEVE' },
  ice: { g: 0.3, b: 0.38, d: 0.04, s: 0.76, a: 0.6, col: 0xbfe6ff, name: 'HIELO' },
};
const ALIAS = { dry: 'asphalt' };
export const baseSurfKey = (env) => (env.weather === 'rain' ? 'wet' : env.surface === 'snow' ? 'snow' : env.surface === 'dirt' ? 'dirt' : 'asphalt');
// zona de superficie en la distancia s (con bordes suaves de 5 m): { key, w }
export function zoneAt(tr, s) {
  const Z = tr.zones; if (!Z) return null;
  for (const z of Z) {
    const e = Math.min(s - z.s0, z.s1 - s); if (e < -0.01) continue;
    return { key: ALIAS[z.type] || z.type, w: smoothstep(0, 16, e) };
  }
  return null;
}
// parámetros relativos a la superficie base del circuito (así los circuitos de nieve o tierra conservan su ajuste) + clima
const lerp = (a, b, t) => a + (b - a) * t, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
export function surfaceAt(tr, env, s, out) {
  const bk = baseSurfKey(env), B = SURF[bk], z = zoneAt(tr, s);
  let key = bk, g = 1, b = 1, d = 0, st = 1, a = 1;
  if (z && z.w > 0) {
    const Z = SURF[z.key], w = z.w;
    g = lerp(1, cl(Z.g / B.g, 0.2, 2.4), w); b = lerp(1, cl(Z.b / B.b, 0.2, 2.4), w); d = lerp(0, Z.d - B.d, w); st = lerp(1, cl(Z.s / B.s, 0.6, 1.3), w); a = lerp(1, cl(Z.a / B.a, 0.4, 1.6), w);
    if (w > 0.5) key = z.key;
  }
  // clima: temperatura y humedad modifican el agarre de la superficie en la que estás
  const T = env.temp == null ? 20 : env.temp, H = env.humidity == null ? 0.4 : env.humidity;
  let cg = 1;
  if (key === 'ice') cg = T > -1 ? 0.78 : T < -8 ? 1.12 : 1;               // cerca de 0 °C el hielo es lo más resbaladizo
  else if (key === 'snow') cg = T > 0 ? 0.88 : T < -8 ? 1.06 : 1;
  else { cg = 1 - cl((14 - T) * 0.006, -0.03, 0.12); if (key === 'asphalt') cg *= 1 - 0.06 * H; else if (key === 'dirt' || key === 'grass') cg *= 1 - 0.12 * H; }
  out.key = key; out.g = g * cg; out.b = b * (0.6 + 0.4 * cg); out.d = d; out.s = st; out.a = a;
  return out;
}

// escapatorias: más allá del arcén, primero grava y después hierba (solo en circuitos con tr.rg)
export function applyRunoff(tr, env, i, lat, roadHalf, blend, out) {
  if (!tr.rg || blend < 0.02) return;
  const e = Math.abs(lat) - roadHalf; if (e <= 0) return;
  const key = e < tr.rg[i] ? 'gravel' : 'grass', Z = SURF[key], B = SURF[baseSurfKey(env)];
  out.g *= lerp(1, cl(Z.g / B.g, 0.2, 2.4), blend); out.b *= lerp(1, cl(Z.b / B.b, 0.2, 2.4), blend); out.d += lerp(0, Z.d - B.d, blend);
  out.s *= lerp(1, cl(Z.s / B.s, 0.6, 1.3), blend); out.a *= lerp(1, cl(Z.a / B.a, 0.4, 1.6), blend);
  if (blend > 0.5) out.key = key;
}
