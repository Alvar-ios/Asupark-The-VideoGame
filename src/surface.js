// Shared road-water layout so the visual puddles and grip model line up.
export function puddleAt(s, lat) {
  const index = Math.floor((s - 48) / 91);
  if (index < 0) return 0;
  const start = 48 + index * 91;
  const lane = Math.sin(index * 12.989) * 3.8;
  const halfLength = 2.3 + (index % 4) * 0.24;
  const halfWidth = 0.55 + (index % 3) * 0.16;
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
