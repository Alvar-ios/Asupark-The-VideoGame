// Reconstrucción de la calzada de un circuito importado (la usa prep-tracks.mjs).
// El juego dibuja una calzada nueva con las mismas alturas que usa la física. Regla principal: el paisaje no se toca.
//  1) se da un perfil de alturas sin saltos ni escalones;
//  2) si una roca invade demasiado, se aparta LA CALZADA, no la roca;
//  3) del modelo solo se quita el suelo viejo que queda debajo de la calzada y lo poco que aún cierre el paso.
// Las distancias van en metros desde el primer punto del trazado.

const wrap = (i, n) => ((i % n) + n) % n;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// ---------- perfil ----------
export function reshapeProfile(cfg, line) {
  const S = cfg.scale, n = line.P.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(line.P[i][0] - line.P[i - 1][0], line.P[i][1] - line.P[i - 1][1]) * S);
  const total = cum[n - 1] + Math.hypot(line.P[0][0] - line.P[n - 1][0], line.P[0][1] - line.P[n - 1][1]) * S;
  const index = (s) => { let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(cum[i] - wrap(s, total)); if (d < bd) { bd = d; best = i; } } return best; };
  // fuera picos sueltos (mediana de 5)
  let Y = line.Y.map((_, i) => [-2, -1, 0, 1, 2].map((d) => line.Y[wrap(i + d, n)]).sort((a, b) => a - b)[2]);
  const base = Y[index(cfg.rebuild.base)];
  for (const op of cfg.rebuild.profile) {
    const i0 = index(op.from), len = wrap(index(op.to) - i0, n), y0 = base + op.a / S, y1 = base + op.b / S;
    // la primera rampa sigue la subida original (recta); las demás entran y salen suaves
    for (let k = 0; k <= len; k++) Y[wrap(i0 + k, n)] = y0 + (y1 - y0) * (op.b > op.a ? Math.pow(k / (len || 1), 1.5) : smooth(k / (len || 1)));
  }
  for (let pass = 0; pass < 3; pass++) Y = Y.map((_, i) => { let s = 0; for (let d = -2; d <= 2; d++) s += Y[wrap(i + d, n)]; return s / 5; });
  line.Y = Y; line.cum = cum; line.total = total; line.index = index;
  let worst = 0; for (let i = 0; i < n; i++) { const j = wrap(i + 1, n), d = Math.hypot(line.P[j][0] - line.P[i][0], line.P[j][1] - line.P[i][1]) || 1; worst = Math.max(worst, Math.abs(Y[j] - Y[i]) / d); }
  console.log('  pendiente máxima', (worst * 100).toFixed(0) + ' %');
  return line;
}

// ---------- consultas: muestra de la línea más cercana a un punto, en su mismo nivel ----------
export function makeNearest(cfg, line) {
  const S = cfg.scale, n = line.P.length;
  return (p, below, above) => {
    let best = null;
    for (let i = 0; i < n; i++) {
      const j = wrap(i + 1, n), a = line.P[i], b = line.P[j], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[2] - a[1]) * ez) / l2)), px = a[0] + ex * t, pz = a[1] + ez * t;
      const d = Math.hypot(p[0] - px, p[2] - pz) * S; if (best && d >= best.d) continue;
      const y = line.Y[i] + (line.Y[j] - line.Y[i]) * t, dy = (p[1] - y) * S; if (dy < -below || dy > above) continue;
      const l = Math.sqrt(l2), tx = ex / l, tz = ez / l;
      best = { i, d, y, dy, px, pz, tx, tz, lat: ((p[0] - px) * -tz + (p[2] - pz) * tx) * S, s: line.cum[i] + t * l * S };
    }
    return best;
  };
}

// ---------- parte en trozos pequeños lo que queda en la pista o junto a ella ----------
// Se parte en cuatro mientras el trozo toque el pasillo. El alcance es mayor que el de los empujones, así que los
// vértices que quedan a medias (en el borde de lo partido) nunca se mueven y no se abren grietas.
function refine(cfg, line, tris, maxEdge, reach) {
  const S = cfg.scale, R = reach / S, H = 7 / S;
  const segDist = (x, z, a, b) => { const ex = b[0] - a[0], ez = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(x - a[0] - ex * t, z - a[2] - ez * t); };
  const touches = (v) => {
    const [A, B, C] = v, x0 = Math.min(A[0], B[0], C[0]) - R, x1 = Math.max(A[0], B[0], C[0]) + R, z0 = Math.min(A[2], B[2], C[2]) - R, z1 = Math.max(A[2], B[2], C[2]) + R;
    const y0 = Math.min(A[1], B[1], C[1]) - H, y1 = Math.max(A[1], B[1], C[1]) + H;
    for (let i = 0; i < line.P.length; i++) {
      const [x, z] = line.P[i]; if (x < x0 || x > x1 || z < z0 || z > z1 || line.Y[i] < y0 || line.Y[i] > y1) continue;
      const side = (a, b) => (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]), s0 = side(A, B), s1 = side(B, C), s2 = side(C, A);
      if ((s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0)) return true;
      if (Math.min(segDist(x, z, A, B), segDist(x, z, B, C), segDist(x, z, C, A)) < R) return true;
    }
    return false;
  };
  const mid = (a, b) => {
    const mix = (u, v) => u.map((x, k) => (x + v[k]) / 2), q = mix(a.n, b.n), l = Math.hypot(...q) || 1;
    return { p: mix(a.p, b.p), n: q.map((v) => v / l), uv: mix(a.uv, b.uv), c: a.c && b.c ? mix(a.c, b.c) : a.c };
  };
  const out = [], todo = tris.slice();
  while (todo.length) {
    if (out.length + todo.length > 400000) throw new Error('la subdivisión se ha disparado');
    const t = todo.pop(), [A, B, C] = t.v;
    const long = Math.max(...[[A, B], [B, C], [C, A]].map(([p, q]) => Math.hypot(q.p[0] - p.p[0], q.p[1] - p.p[1], q.p[2] - p.p[2]) * S));
    if (long <= maxEdge || /water|ocean/i.test(t.mat.getName()) || !touches([A.p, B.p, C.p])) { out.push(t); continue; }
    const ab = mid(A, B), bc = mid(B, C), ca = mid(C, A);
    for (const v of [[A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca]]) todo.push({ ...t, v });
  }
  return out;
}

// ---------- aparta la calzada de las paredes ----------
// walls: cortes de las paredes a la altura del kart ({ a, b, y } en unidades del archivo). La calzada se desplaza de
// lado, poco a poco, hasta que ninguna pared quede a menos de `clear` metros del eje; entre dos paredes, se centra.
export function steerAway(cfg, line, walls) {
  const R = cfg.rebuild, S = cfg.scale, n = line.P.length, start = line.P.map((p) => p.slice()), reach = R.clear + 4;
  const points = [];
  for (const q of walls) { const len = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) * S, steps = Math.max(1, Math.ceil(len / 0.5)); for (let k = 0; k <= steps; k++) points.push([q.a[0] + (q.b[0] - q.a[0]) * k / steps, q.a[1] + (q.b[1] - q.a[1]) * k / steps, q.y]); }
  const frame = (i) => { const a = line.P[wrap(i - 1, n)], b = line.P[wrap(i + 1, n)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
  const measure = (i) => {
    const [x, z] = line.P[i], [tx, tz] = frame(i), s = line.cum[i]; let left = -1e9, right = 1e9;
    const forced = (R.sides || []).find(([s0, s1]) => s >= s0 && s <= s1);
    for (const [px, pz, y] of points) {
      if (Math.abs(y - line.Y[i]) * S > 1.6) continue;
      const along = ((px - x) * tx + (pz - z) * tz) * S; if (Math.abs(along) > 1.6) continue;
      const lat = ((px - x) * -tz + (pz - z) * tx) * S; if (Math.abs(lat) > reach) continue;
      if (forced ? forced[2] < 0 : lat < 0) left = Math.max(left, lat); else right = Math.min(right, lat);
    }
    return [left, right];
  };
  // se mueve solo cada muestra de lado, sobre la normal del trazado original: donde no hay pared queda como estaba
  const normal = start.map((_, i) => { const p = start[wrap(i - 2, n)], q = start[wrap(i + 2, n)], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; });
  let off = new Array(n).fill(0);
  const apply = () => { line.P = start.map(([x, z], i) => [x + normal[i][0] * off[i] / S, z + normal[i][1] * off[i] / S]); };
  for (let it = 0; it < 40; it++) {
    const shift = line.P.map((_, i) => {
      const [left, right] = measure(i), a = Math.max(0, left + R.clear), b = Math.min(0, right - R.clear);
      return a && b ? (left + right) / 2 : a || b;
    });
    if (shift.every((v) => Math.abs(v) < 0.05)) break;
    off = off.map((v, i) => Math.max(-7, Math.min(7, v + Math.max(-0.5, Math.min(0.5, shift[i] * 0.5)))));
    for (let pass = 0; pass < 2; pass++) off = off.map((v, i) => v * 0.5 + (off[wrap(i - 1, n)] + off[wrap(i + 1, n)]) * 0.25); // sin quiebros
    apply();
  }
  let near = 1e9, moved = 0, radius = 1e9, tight = 0;
  for (let i = 0; i < n; i++) {
    const [left, right] = measure(i), d = Math.min(-left, right); near = Math.min(near, d); if (d < R.clear - 0.5) tight++;
    moved = Math.max(moved, Math.hypot(line.P[i][0] - start[i][0], line.P[i][1] - start[i][1]) * S);
    const a = line.P[wrap(i - 2, n)], b = line.P[i], c = line.P[wrap(i + 2, n)], ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]), area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (area > 1e-9) radius = Math.min(radius, (ab * bc * ca) / (2 * area) * S);
  }
  console.log('  calzada apartada hasta', moved.toFixed(1), 'm | pared más cercana al eje', near.toFixed(1), 'm | muestras con pared a menos de', (R.clear - 0.5).toFixed(1), 'm:', tight, '| radio mínimo', radius.toFixed(1), 'm');
  return line;
}

export function rebuild(cfg, line, tris) {
  const R = cfg.rebuild, S = cfg.scale, edge = cfg.half + (cfg.wallExtra ?? 0.25), nearest = makeNearest(cfg, line);
  const isFloor = (t) => R.floor.test(t.mat.getName()) || (cfg.road.node && t.chain.some((c) => cfg.road.node.test(c)));
  const isSoft = (t) => R.soft.test(t.mat.getName()) || t.chain.some((c) => R.soft.test(c));
  const centre = (t) => [0, 1, 2].map((k) => (t.v[0].p[k] + t.v[1].p[k] + t.v[2].p[k]) / 3);

  // carteles y vallas sueltas que pisen la pista: fuera enteros
  const blocked = new Set();
  for (const t of tris) if (R.remove.test(t.mat.getName())) { const q = nearest(centre(t), 2, 4); if (q && q.d < edge) blocked.add(t.chain[0]); }
  // piedras sueltas que caigan en mitad del paso: se quita la piedra entera (a trozos quedaría hueca)
  const size = new Map();
  for (const t of tris) if (R.boulder.test(t.mat.getName())) { const e = size.get(t.chain[0]) || [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]]; for (const v of t.v) for (let k = 0; k < 3; k++) { e[0][k] = Math.min(e[0][k], v.p[k]); e[1][k] = Math.max(e[1][k], v.p[k]); } size.set(t.chain[0], e); }
  const small = (name) => { const e = size.get(name); return e && Math.max(e[1][0] - e[0][0], e[1][2] - e[0][2]) * S < 9; };
  for (const t of tris) if (R.boulder.test(t.mat.getName()) && small(t.chain[0]) && !blocked.has(t.chain[0]) && [centre(t), ...t.v.map((v) => v.p)].some((p) => { const q = nearest(p, 0.5, 3); return q && q.d < R.pass + 0.9 && q.dy > -0.2 && q.dy < 2.4; })) blocked.add(t.chain[0]);
  const list = refine(cfg, line, tris.filter((t) => !blocked.has(t.chain[0])), 1.2, edge + 1.5);

  const kept = []; let cut = 0;
  for (const t of list) {
    const points = [centre(t), ...t.v.map((v) => v.p)];
    if (isFloor(t)) {
      // suelo viejo debajo de la calzada nueva (o asomando sobre ella): fuera
      const q = nearest(centre(t), 2.5, 4.2);
      if (q && q.d < edge + 0.05) continue;
      // en el margen solo se baja lo justo para que no asome por el borde
      kept.push({ ...t, v: t.v.map((v) => { const p = nearest(v.p, 0.5, 0.5); return p && p.d < edge + 0.3 && p.dy > -0.1 ? { ...v, p: [v.p[0], p.y - 0.1 / S, v.p[2]] } : v; }) });
      continue;
    }
    if (R.keep.test(t.mat.getName())) { kept.push(t); continue; }
    // el canto del trampolín asoma al empezar la bajada: en esos metros se limpia todo el ancho, solo a ras de calzada
    if (R.lip && points.some((p) => { const q = nearest(p, 0.4, 1.3); return q && q.s >= R.lip[0] && q.s <= R.lip[1] && q.d < edge - 1.3 && q.dy > -0.35; })) { cut++; continue; }
    // decorado: solo se quita lo que todavía cierra el paso, a la altura del kart y casi en el centro
    if (points.some((p) => { const q = nearest(p, 0.5, 3); return q && q.d < R.pass && q.dy > -0.2 && q.dy < 2.6; })) { cut++; continue; }
    // restos bajos que asomarían unos centímetros por encima de la calzada: se hunden, sin quitar la pieza
    const rock = /DarkGreyCliff/i.test(t.mat.getName()) || R.boulder.test(t.mat.getName()), near = t.v.map((v) => nearest(v.p, 3, rock ? 1.1 : 0.4));
    if (near.every(Boolean) && near.every((q) => q.d < edge - 0.15)) { kept.push({ ...t, v: t.v.map((v, k) => (near[k].dy > -0.08 ? { ...v, p: [v.p[0], near[k].y - 0.08 / S, v.p[2]] } : v)) }); continue; }
    kept.push(t);
  }
  console.log('  piezas del decorado que cerraban el paso, quitadas:', cut, 'triángulos');
  console.log('  carteles quitados', blocked.size, '| triángulos', tris.length, '->', kept.length);
  return kept;
}

// arcenes: donde entre la calzada y una pared ya no queda suelo (se vería el mar por debajo), hasta dónde rellenar
export function aprons(cfg, line, tris, walls, before) {
  const R = cfg.rebuild, S = cfg.scale, n = line.P.length, edge = cfg.half + (cfg.wallExtra ?? 0.25);
  const cell = 3 / S;
  const floorQuery = (list, below, above, any = false) => {
    const grid = new Map();
    for (const t of list) {
      if (!any && !R.floor.test(t.mat.getName())) continue;
      const xs = t.v.map((v) => v.p[0]), zs = t.v.map((v) => v.p[2]);
      for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++) for (let j = Math.floor(Math.min(...zs) / cell); j <= Math.floor(Math.max(...zs) / cell); j++) { const k = i + ',' + j; (grid.get(k) || grid.set(k, []).get(k)).push(t); }
    }
    return (x, z, y) => (grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) || []).some((t) => {
      const [A, B, C] = t.v.map((v) => v.p), den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-12) return false;
      const a = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, b = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den;
      if (a < -1e-4 || b < -1e-4 || a + b > 1.0001) return false;
      const h = (a * A[1] + b * B[1] + (1 - a - b) * C[1] - y) * S; return h > below && h < above;
    });
  };
  const had = floorQuery(before, -1.4, 1.6), has = floorQuery(tris, -1.6, 0.8), low = Math.min(...line.Y);
  const covered = floorQuery(before, 0.4, 18, true); // hay montaña o meseta encima
  const out = [-1, 1].map((side) => line.P.map(([x, z], i) => {
    const a = line.P[wrap(i - 1, n)], b = line.P[wrap(i + 1, n)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    // 1) hueco que hemos abierto: había suelo y ya no lo hay. Se rellena hasta el último punto así
    let hole = 0;
    for (let d = edge - 0.3; d <= 15; d += 0.4) { const px = x - tz * side * d / S, pz = z + tx * side * d / S; if (had(px, pz, line.Y[i]) && !has(px, pz, line.Y[i])) hole = d; else if (d - Math.max(hole, edge) > 2.5) break; }
    // 2) pared cercana: un arcén hasta su pie, para que no quede rendija
    let wall = null;
    for (const q of walls) {
      const len = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) * S, steps = Math.max(4, Math.ceil(len / 0.8));
      for (let k = 0; k <= steps; k++) {
        const px = q.a[0] + (q.b[0] - q.a[0]) * k / steps, pz = q.a[1] + (q.b[1] - q.a[1]) * k / steps;
        if (Math.abs(q.y - line.Y[i]) * S > 2.2 || Math.abs((px - x) * tx + (pz - z) * tz) * S > 2.2) continue;
        const lat = ((px - x) * -tz + (pz - z) * tx) * S * side; if (lat > edge - 1.8 && lat < 11 && (wall == null || lat < wall)) wall = lat;
      }
    }
    let reach = Math.max(hole > edge + 0.2 ? Math.min(15, hole + 0.9) : 0, wall == null ? 0 : Math.max(edge + 0.8, wall + 1.2));
    // en lo alto las paredes se meten hacia dentro por abajo: el arcén sigue por debajo de ellas mientras tenga roca
    // encima (dentro de la montaña no se ve); nunca asoma por fuera
    if (reach && (line.Y[i] - low) * S > 6) for (let d = reach; d <= 13; d += 0.5) { if (!covered(x - tz * side * (d + 0.8) / S, z + tx * side * (d + 0.8) / S, line.Y[i])) break; reach = d; }
    return reach;
  }));
  // se ensancha un poco a lo largo para que no queden dientes
  return out.map((w) => w.map((v, i) => { const near = [-1, 0, 1].map((d) => w[wrap(i + d, n)]); return v ? v : Math.min(...near.filter(Boolean), Infinity) === Infinity ? 0 : Math.min(...near.filter(Boolean)); }));
}

// material de la calzada vieja bajo cada muestra (tierra o la plataforma de cemento del faro)
export function deckMaterials(cfg, line, tris) {
  const nearest = makeNearest(cfg, line), votes = line.P.map(() => new Map());
  for (const t of tris) {
    const name = t.mat.getName(); if (!cfg.rebuild.deck.test(name)) continue;
    const q = nearest([0, 1, 2].map((k) => (t.v[0].p[k] + t.v[1].p[k] + t.v[2].p[k]) / 3), 3, 4);
    if (q && q.d < cfg.half) votes[q.i].set(name, (votes[q.i].get(name) || 0) + 1);
  }
  const raw = votes.map((v) => ([...v].sort((a, b) => b[1] - a[1])[0] || [null])[0]);
  const fallback = raw.find((x) => x && /Ground/.test(x));
  return raw.map((_, i) => { const c = new Map(); for (let d = -4; d <= 4; d++) { const m = raw[wrap(i + d, raw.length)]; if (m) c.set(m, (c.get(m) || 0) + 1); } return ([...c].sort((a, b) => b[1] - a[1])[0] || [fallback])[0]; });
}
