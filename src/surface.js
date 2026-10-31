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
