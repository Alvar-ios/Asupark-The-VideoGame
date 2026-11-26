// La caja: un paquete de recambios de cartón, como los que llegan al taller. Impresión de una tinta con plantilla,
// precinto, etiqueta de envío, pegatinas pegadas a mano y roces. Aquí están sus texturas y el dibujo de la tienda.
import { canvasTex, rngFrom } from './boxprops.js';

export const CARTONS = {
  daily: { board: '#b98a55', shade: '#8f6636', ink: '#1d1812', accent: '#d21f16', tape: '#ffc400', tapeInk: '#17140d', glow: 0xffd24a, label: 'CAJA DIARIA', lot: 'KX-D01' },
  pit: { board: '#a8231c', shade: '#74140f', ink: '#f4ede0', accent: '#ffc400', tape: '#f1ece0', tapeInk: '#a8231c', glow: 0xff7a4d, label: 'CAJA DE BOXES', lot: 'KX-B12' },
  podium: { board: '#25221d', shade: '#121009', ink: '#e6b63f', accent: '#f4ede0', tape: '#dcae3c', tapeInk: '#171309', glow: 0xffe08a, label: 'CAJA PODIO', lot: 'KX-P24' },
};

const FONT = 'KartDisplay, Impact, sans-serif';
const K = 'M10 9h9v11.5L31 9h10L27.5 24 41 39H31L19 27.5V39h-9z';

// fibra del cartón: manchas suaves, motas y las líneas apenas visibles del ondulado
function board(x, w, h, c, rnd) {
  x.fillStyle = c.board; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const px = rnd() * w, py = rnd() * h, r = 20 + rnd() * 90, g = x.createRadialGradient(px, py, 0, px, py, r); const dark = rnd() < 0.55; g.addColorStop(0, dark ? 'rgba(40,20,0,.09)' : 'rgba(255,240,214,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  for (let px = 0; px < w; px += 9) { x.fillStyle = 'rgba(0,0,0,.035)'; x.fillRect(px, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(px + 4, 0, 2, h); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(30,16,0,.22)' : 'rgba(255,244,222,.16)'; x.fillRect(rnd() * w, rnd() * h, rnd() * 3 + 0.6, 1); }
}
// desgaste: bordes sobados, algún golpe y la marca de una rueda
function wear(x, w, h, c, rnd, tyre) {
  const edge = (gx, gy, gw, gh, x0, y0, x1, y1) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(20,10,0,.34)'); g.addColorStop(1, 'rgba(20,10,0,0)'); x.fillStyle = g; x.fillRect(gx, gy, gw, gh); };
  edge(0, 0, 26, h, 0, 0, 26, 0); edge(w - 26, 0, 26, h, w, 0, w - 26, 0); edge(0, h - 40, w, 40, 0, h, 0, h - 40);
  for (let i = 0; i < 26; i++) { x.strokeStyle = rnd() < 0.5 ? 'rgba(255,236,205,.28)' : 'rgba(25,12,0,.25)'; x.lineWidth = 0.8 + rnd() * 2; const px = rnd() * w, py = rnd() < 0.6 ? (rnd() < 0.5 ? rnd() * 24 : h - rnd() * 40) : rnd() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 46, py + (rnd() - 0.5) * 12); x.stroke(); }
  if (tyre) { x.save(); x.translate(w * (0.1 + rnd() * 0.2), h * 0.9); x.rotate(-0.34); x.fillStyle = 'rgba(12,10,8,.2)'; for (let i = 0; i < 17; i++) { x.fillRect(i * 20, -30, 11, 24); x.fillRect(i * 20 + 7, 6, 11, 24); x.fillRect(i * 20 + 3, -4, 13, 8); } x.restore(); }
}
// letras de plantilla: tinta algo irregular y los cortes del molde
function stencil(x, text, px, py, size, color, c, maxW) {
  x.save(); x.font = `italic 800 ${size}px ${FONT}`; x.textBaseline = 'alphabetic';
  const k = maxW ? Math.min(1, maxW / x.measureText(text).width) : 1; x.translate(px, py); x.scale(k, 1);
  x.globalAlpha = 0.92; x.fillStyle = color; x.fillText(text, 0, 0);
  x.globalAlpha = 1; x.fillStyle = c.board; const wd = x.measureText(text).width; for (let i = 26; i < wd; i += size * 0.56) x.fillRect(i, -size * 0.78, 3, size * 0.82);
  x.restore();
}
function mark(x, px, py, s, color) { x.save(); x.translate(px, py); x.scale(s, s); x.fillStyle = color; x.fill(new Path2D(K)); x.restore(); }
// pegatina redonda o rectangular, pegada torcida y con su sombra
function sticker(x, px, py, rot, draw) { x.save(); x.translate(px, py); x.rotate(rot); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3; draw(x); x.restore(); }
function roundel(x, r, num) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.fillStyle = '#f2efe6'; x.fill(); x.shadowColor = 'transparent'; x.lineWidth = r * 0.13; x.strokeStyle = '#16181d'; x.stroke(); x.fillStyle = '#16181d'; x.font = `italic 800 ${r * 1.25}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(num, 0, r * 0.07); }
function shipping(x, w, h, lot, rnd) {
  x.fillStyle = '#efeadc'; x.fillRect(0, 0, w, h); x.shadowColor = 'transparent';
  x.fillStyle = '#17150f'; x.font = `700 17px ${FONT}`; x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText('KARTLOS RACING PARTS', 10, 8);
  x.fillRect(10, 29, w - 20, 2); x.font = '600 13px sans-serif'; x.fillText('Destino: box 7, pit lane', 10, 36); x.fillText(`Lote ${lot}`, 10, 53);
  let bx = 10; while (bx < w - 14) { const bw = 1 + Math.floor(rnd() * 4); x.fillRect(bx, 74, bw, h - 90); bx += bw + 1 + Math.floor(rnd() * 3); }
  x.font = '600 11px monospace'; x.fillText('8 4137 0092 ' + lot.slice(-3), 10, h - 14);
}
function arrowsUp(x, px, py, color) { x.save(); x.translate(px, py); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 5; x.strokeRect(0, 0, 74, 78); for (const ax of [22, 52]) { x.beginPath(); x.moveTo(ax, 12); x.lineTo(ax + 13, 32); x.lineTo(ax + 5, 32); x.lineTo(ax + 5, 56); x.lineTo(ax - 5, 56); x.lineTo(ax - 5, 32); x.lineTo(ax - 13, 32); x.fill(); } x.fillRect(11, 62, 52, 6); x.restore(); }

// cara frontal (con el nombre de la caja) o lateral
export function faceTex(c, side, seed) {
  return canvasTex(768, 560, (x, w, h) => {
    const rnd = rngFrom(seed);
    board(x, w, h, c, rnd);
    if (!side) {
      // banda impresa con la marca, el nombre y la franja de bordillo
      mark(x, 22, 30, 3.5, c.ink);
      stencil(x, 'KARTLOS', 180, 100, 74, c.ink, c);
      stencil(x, 'RACING PARTS', 184, 148, 38, c.accent, c);
      stencil(x, c.label, 44, 322, 108, c.ink, c, w - 90);
      for (let i = 0; i < 22; i++) { x.fillStyle = i % 2 ? c.ink : c.accent; x.globalAlpha = 0.9; x.beginPath(); x.moveTo(44 + i * 31, 372); x.lineTo(44 + i * 31 + 31, 372); x.lineTo(44 + i * 31 + 17, 400); x.lineTo(44 + i * 31 - 14, 400); x.fill(); x.globalAlpha = 1; }
      sticker(x, w - 290, 426, 0.03, (g) => shipping(g, 244, 122, c.lot, rnd));
      sticker(x, w - 86, 78, -0.18, (g) => roundel(g, 52, '7'));
      arrowsUp(x, 52, 440, c.ink);
    } else {
      stencil(x, 'ESTE LADO ARRIBA', 60, 120, 52, c.ink, c, w - 260);
      arrowsUp(x, w - 150, 46, c.ink);
      mark(x, 210, 170, 6.6, c.ink);
      stencil(x, 'RECAMBIOS DE KART', 60, 508, 44, c.accent, c, w - 120);
      sticker(x, 118, 300, -0.12, (g) => { g.fillStyle = '#ffc400'; g.fillRect(-74, -34, 148, 68); g.shadowColor = 'transparent'; g.fillStyle = '#17140d'; g.font = `italic 800 30px ${FONT}`; g.textAlign = 'center'; g.fillText('FRÁGIL', 0, -2); g.font = '700 13px sans-serif'; g.fillText('piezas de carreras', 0, 21); });
      sticker(x, w - 128, 346, 0.2, (g) => { g.fillStyle = '#16181d'; g.fillRect(-62, -44, 124, 88); g.shadowColor = 'transparent'; for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) { g.fillStyle = '#f2efe6'; g.fillRect(-56 + i * 14, -38 + j * 15.2, 14, 15.2); } });
    }
    wear(x, w, h, c, rnd, !side);
  });
}
// cara de arriba de una solapa: cartón con la marca y roces
export const flapTex = (c, seed) => canvasTex(512, 256, (x, w, h) => { const rnd = rngFrom(seed); board(x, w, h, c, rnd); mark(x, 190, 42, 2.8, c.ink); stencil(x, 'NO APILAR', 164, 214, 34, c.accent, c); wear(x, w, h, c, rnd, false); });
// interior sin imprimir
export const innerTex = (c, seed) => canvasTex(256, 256, (x, w, h) => { const rnd = rngFrom(seed); board(x, w, h, { board: '#8a6238' }, rnd); wear(x, w, h, c, rnd, false); });
// canto cortado: las dos caras y el ondulado entre medias
export const edgeTex = (c) => { const t = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#6b4a2a'; x.fillRect(0, 0, w, h); x.fillStyle = c.board; x.fillRect(0, 0, w, 7); x.fillRect(0, h - 7, w, 7); x.strokeStyle = '#c99a63'; x.lineWidth = 3.4; x.beginPath(); for (let i = 0; i <= w; i += 2) x.lineTo(i, h / 2 + Math.sin(i / 16 * Math.PI) * 8); x.stroke(); }); t.wrapS = 1000; t.repeat.set(4, 1); return t; };
// precinto impreso, algo arrugado
export const tapeTex = (c) => canvasTex(1024, 128, (x, w, h) => {
  const rnd = rngFrom(77);
  x.fillStyle = c.tape; x.fillRect(0, 0, w, h);
  x.fillStyle = c.tapeInk; x.font = `italic 800 52px ${FONT}`; x.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) { mark(x, i * 262 + 6, 28, 1.5, c.tapeInk); x.fillText('KARTLOS', i * 262 + 74, h / 2 + 3); }
  x.fillRect(0, 10, w, 4); x.fillRect(0, h - 14, w, 4);
  for (let i = 0; i < 60; i++) { x.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,.32)' : 'rgba(0,0,0,.16)'; x.lineWidth = 1 + rnd() * 2; const px = rnd() * w; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (rnd() - 0.5) * 40, h); x.stroke(); }
});

// dibujo de la tienda: el mismo paquete visto de tres cuartos, con las solapas entreabiertas
export function boxSvg(id) {
  const c = CARTONS[id];
  return `<svg class="kx-boxart" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="92" rx="46" ry="6" fill="#000" opacity=".4"/>
    <path d="M18 38l42 12 42-12-42-12z" fill="#4a3319"/>
    <path d="M18 38l42-12-9-13-41 12z" fill="${c.shade}" stroke="#000" stroke-opacity=".35"/><path d="M60 26l42 12 8-13-41-12z" fill="${c.board}" stroke="#000" stroke-opacity=".35"/>
    <path d="M18 38l42 12v40L18 76z" fill="${c.board}"/><path d="M60 50l42-12v38L60 90z" fill="${c.shade}"/>
    <path d="M18 38l42 12-10 11-42-13z" fill="${c.board}" stroke="#000" stroke-opacity=".4"/><path d="M60 50l42-12 9 11-41 13z" fill="${c.shade}" stroke="#000" stroke-opacity=".4"/>
    <path d="M13 43l42 13 3-3.500-42-13z" fill="${c.tape}"/><path d="M65 56l41-13-3-3.500-41 13z" fill="${c.tape}"/>
    <path transform="matrix(.78 .22 0 .78 22 52)" d="${K}" fill="${c.ink}"/>
    <path d="M70 70l22-6v15l-22 6z" fill="#efeadc"/><path d="M73 77v6m3-7v7m2-8v7m4-8v7m2-8v7m4-8v6" stroke="#17150f" stroke-width="1.200"/>
    <circle cx="48" cy="68" r="6" fill="#f2efe6" stroke="#16181d" stroke-width="1.400"/><path d="M45.500 65h5l-3.500 7" fill="none" stroke="#16181d" stroke-width="1.600"/>
    <path d="M18 38v38l42 14 42-14V38M60 50v40" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.200"/></svg>`;
}
