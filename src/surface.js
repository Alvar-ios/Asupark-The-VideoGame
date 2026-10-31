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
