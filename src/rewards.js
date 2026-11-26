// Dibujos compartidos por la tienda, las misiones y la caja: monedas, premios y cosméticos.
import { RARITY } from './economy.js';

// punto: moneda amarilla con forma de rueda; gema: piedra azul tallada
export const COIN = '<svg class="kx-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffc400"/><circle cx="12" cy="12" r="7" fill="none" stroke="#7a5a00" stroke-width="2.4"/><circle cx="12" cy="12" r="2.2" fill="#7a5a00"/></svg>';
export const GEM = '<svg class="kx-gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l5 7-11 12L1 10z" fill="#22c8f0"/><path d="M6 3l2 7H1zm12 0l-2 7h7zM8 10h8l-4 12z" fill="#86e6ff"/><path d="M6 3h12l-2 7H8z" fill="#c4f4ff"/></svg>';
const num = (n) => Number(n).toLocaleString('es-ES');
export const amount = (r) => [r && r.pts ? `<span class="kx-amt">${COIN}${num(r.pts)}</span>` : '', r && r.gems ? `<span class="kx-amt">${GEM}${num(r.gems)}</span>` : ''].join('');

const GRAD = {
  matte: (c) => [[0, c], [1, c]],
  metal: (c) => [[0, c], [0.42, '#ffffff'], [0.55, c], [1, '#0b0d12']],
  neon: (c) => [[0, '#ffffff'], [0.3, c], [1, c]],
  chrome: () => [[0, '#ffffff'], [0.35, '#aab4c2'], [0.5, '#4a5262'], [0.62, '#e9edf3'], [1, '#8b94a3']],
  gold: () => [[0, '#fff3b8'], [0.38, '#f6bd2f'], [0.55, '#8a5a00'], [0.72, '#ffd65a'], [1, '#b57f0c']],
};
let gid = 0;
// pontones y morro de un kart visto desde arriba, pintados con el acabado
export function paintSvg(item) {
  const id = 'kxp' + (gid++), stops = GRAD[item.finish](item.color).map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const glow = item.finish === 'neon' ? `<ellipse cx="32" cy="32" rx="27" ry="25" fill="${item.color}" opacity=".22"/>` : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${glow}<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
    <g fill="#15171b"><rect x="3" y="12" width="9" height="13" rx="3"/><rect x="52" y="12" width="9" height="13" rx="3"/><rect x="2" y="40" width="11" height="16" rx="3"/><rect x="51" y="40" width="11" height="16" rx="3"/></g>
    <g fill="url(#${id})" stroke="rgba(0,0,0,.55)" stroke-width="1.2"><path d="M17 16q15-12 30 0l-3 7H20z"/><path d="M26 22h12l3 13H23z"/><path d="M14 28h8v24h-8q-4-12 0-24z"/><path d="M50 28h-8v24h8q4-12 0-24z"/><rect x="20" y="55" width="24" height="5" rx="2.5"/></g>
    <rect x="25" y="38" width="14" height="14" rx="4" fill="#23262e"/><circle cx="32" cy="34" r="5" fill="none" stroke="#e8eaee" stroke-width="2"/></svg>`;
}

export const itemArt = (item, helmetSvg) => (item.type === 'helmet' ? helmetSvg(item.helmet) : paintSvg(item));
export const itemKind = (item) => (item.type === 'helmet' ? 'Casco' : 'Pintura');

// tarjeta de un premio (ruleta y resultado)
export function prizeCard(p, helmetSvg) {
  const r = RARITY[p.rarity];
  const art = p.kind === 'item' ? itemArt(p.item, helmetSvg) : p.kind === 'pts' ? COIN : GEM;
  const label = p.kind === 'item' ? p.item.name : p.kind === 'pts' ? `${num(p.amount)} puntos` : `${num(p.amount)} gemas`;
  return `<div class="bx-card" style="--rc:${r.color}"><span class="bx-art">${art}</span><b>${label}</b></div>`;
}
export const prizeLabel = (p) => (p.kind === 'item' ? p.item.name : p.kind === 'pts' ? `${num(p.amount)} puntos` : `${num(p.amount)} gemas`);

// tabla de probabilidades legible: se enseña siempre junto a cada caja
export const oddsList = (box) => `<ul class="kx-odds">${box.table.map(([row, pct]) => {
  const [kind, n] = row.split(':');
  const name = kind === 'pts' ? `${n} puntos` : kind === 'gems' ? `${n} gemas` : `Objeto ${RARITY[kind].name.toLowerCase()}`;
  const color = RARITY[kind] ? RARITY[kind].color : kind === 'gems' ? '#22c8f0' : '#ffc400';
  return `<li><i style="background:${color}"></i><span>${name}</span><b>${String(pct).replace('.', ',')} %</b></li>`;
}).join('')}</ul>`;
