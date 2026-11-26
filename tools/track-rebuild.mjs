// Reconstrucción de la calzada de un circuito importado (la usa prep-tracks.mjs).
// El juego dibuja una calzada nueva con las mismas alturas que usa la física, así que aquí solo hay que:
//  1) dar un perfil de alturas sin saltos ni escalones;
//  2) quitar del modelo el suelo viejo que quede en el pasillo de la pista;
//  3) apartar el decorado que invada demasiado: puede entrar, pero siempre queda un paso libre.
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
  for (const op of cfg.rebuild.profile) {
    const a = index(op.from), b = index(op.to), len = wrap(b - a, n), y0 = Y[a], y1 = op.flat ? Y[a] : Y[b];
    for (let k = 0; k <= len; k++) Y[wrap(a + k, n)] = y0 + (y1 - y0) * smooth(k / len);
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

export function rebuild(cfg, line, tris) {
  const R = cfg.rebuild, S = cfg.scale, edge = cfg.half + (cfg.wallExtra ?? 0.25), nearest = makeNearest(cfg, line);
  const isFloor = (t) => R.floor.test(t.mat.getName()) || (cfg.road.node && t.chain.some((c) => cfg.road.node.test(c)));
  const isSoft = (t) => R.soft.test(t.mat.getName()) || t.chain.some((c) => R.soft.test(c));
  const centre = (t) => [0, 1, 2].map((k) => (t.v[0].p[k] + t.v[1].p[k] + t.v[2].p[k]) / 3);

  // carteles y vallas sueltas que pisen la pista: fuera enteros
  const blocked = new Set();
  for (const t of tris) if (R.remove.test(t.mat.getName())) { const q = nearest(centre(t), 2, 4); if (q && q.d < edge) blocked.add(t.chain[0]); }
  let list = tris.filter((t) => !(R.remove.test(t.mat.getName()) && blocked.has(t.chain[0])));
  const loose = new Set();
  for (const t of list) if (/^Rock_/.test(t.mat.getName())) { const q = nearest(centre(t), -1.5, 14); if (q && q.d < edge + 6 && (R.cut || []).some(([a, b]) => (a <= b ? q.s >= a && q.s <= b : q.s >= a || q.s <= b))) loose.add(t.chain[0]); }
  list = list.filter((t) => !loose.has(t.chain[0]));
  list = refine(cfg, line, list, 1.5, edge + 4.5);

  // apartar el decorado: nada a la altura del kart a menos de `clear` metros del eje
  const moved = new Map();
  const push = (v) => {
    if (moved.has(v)) return moved.get(v);
    let out = v; const q = nearest(v.p, 1.2, 4.2);
    if (q && q.d < edge + 3) {
      // en los tramos donde la roca cruza el camino en diagonal se empuja siempre hacia el mismo lado
      let side = Math.sign(q.lat) || 1, weight = 1;
      for (const [s0, s1, to] of R.sides || []) {
        const inside = q.s >= s0 && q.s <= s1, w = inside ? 1 : 1 - Math.min(1, Math.min(Math.abs(q.s - s0), Math.abs(q.s - s1)) / 6);
        if (w > 0 && (inside || Math.sign(q.lat) !== to)) { side = to; weight = w; }
      }
      const u = q.lat * side;
      if (u < R.clear && u > -(edge + 1)) {
        const to = R.clear + Math.max(0, u + edge) * 0.04; // conserva un poco de relieve
        const delta = (to - u) * side * weight / S;
        out = { ...v, p: [v.p[0] - q.tz * delta, v.p[1], v.p[2] + q.tx * delta] };
      }
    }
    moved.set(v, out); return out;
  };
  list = list.map((t) => (isFloor(t) || isSoft(t) ? t : { ...t, v: t.v.map(push) }));

  // suelo viejo dentro del pasillo: fuera. En el margen se baja un poco para que no asome por el borde de la calzada nueva
  const kept = [];
  for (const t of list) {
    const floor = isFloor(t), soft = isSoft(t);
    // en la rampa (que pasa por donde antes había un cortado) no queda nada por encima en todo el ancho, ni suelo viejo
    const points = [centre(t), ...t.v.map((v) => v.p)];
    const inCut = (q) => (R.cut || []).some(([a, b]) => (a <= b ? q.s >= a && q.s <= b : q.s >= a || q.s <= b));
    if (points.some((p) => { const q = nearest(p, 1, 12); return q && q.dy > -0.4 && q.d < edge + 1.2 && inCut(q); })) continue;
    // restos bajos del escalón que partía el camino en dos carriles: asomarían unos centímetros sobre la calzada
    if (!floor) { const near = t.v.map((v) => nearest(v.p, 2.5, 0.45)); if (near.every(Boolean) && near.some((q) => q.d < edge - 0.15)) continue; }
    // jirones de la meseta que se quedarían colgando en el aire junto a la rampa
    if (floor && points.some((p) => { const q = nearest(p, -2.2, 14); return q && q.d < edge + 11 && inCut(q); })) continue;
    // y en el resto, nada queda atravesado en el paso libre
    if (!floor && points.some((p) => { const q = nearest(p, 1, 4.5); return q && q.d < R.clear - 0.5 && q.dy > -0.3 && q.dy < 3; })) continue;
    if (!floor && !soft) {
      // restos planos (rampas, rellenos) que quedarían por encima de la calzada
      const [A, B, C] = t.v.map((v) => v.p), u = B.map((v, k) => v - A[k]), w = C.map((v, k) => v - A[k]);
      const ny = u[2] * w[0] - u[0] * w[2], len = Math.hypot(u[1] * w[2] - u[2] * w[1], ny, u[0] * w[1] - u[1] * w[0]) || 1;
      if (Math.abs(ny) / len > 0.65) { const q = nearest(centre(t), 0.6, 1.0); if (q && q.d < edge - 0.15) continue; }
      kept.push(t); continue;
    }
    const q = nearest(centre(t), 3, 4);
    if (q && q.d < edge - 0.2) continue;
    kept.push({ ...t, v: t.v.map((v) => { const p = nearest(v.p, 1.5, 3.5); return p && p.d < edge + 0.35 && p.dy > -0.12 ? { ...v, p: [v.p[0], p.y - 0.12 / S, v.p[2]] } : v; }) });
  }
  console.log('  carteles quitados', blocked.size, '| triángulos', tris.length, '->', kept.length);
  return kept;
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
