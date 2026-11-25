// Dibujo vectorial de un trazado (tarjetas de «Entrenar» y reto diario): nítido a cualquier tamaño.
export function trackSvg(tr, cls = '') {
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9, path = '';
  for (let i = 0; i < tr.N; i += 3) { const x = Math.round(tr.X[i]), z = Math.round(tr.Z[i]); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); path += (i ? 'L' : 'M') + x + ' ' + z; }
  const size = Math.max(b - a, d - c), pad = size * 0.06, w = +(size / 32).toFixed(1);
  return `<svg class="kx-line ${cls}" viewBox="${a - pad} ${c - pad} ${b - a + pad * 2} ${d - c + pad * 2}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="${path}Z" stroke-width="${w}"/><circle cx="${Math.round(tr.X[0])}" cy="${Math.round(tr.Z[0])}" r="${(w * 1.2).toFixed(1)}"/></svg>`;
}
