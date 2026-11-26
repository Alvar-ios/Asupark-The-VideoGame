// Dibujos compartidos por la tienda, las misiones y la caja: monedas, premios y cosméticos.
import { RARITY } from './economy.js';
import { decalSvg } from './decals.js';

// punto: moneda amarilla con forma de rueda; gema: piedra azul tallada
export const COIN = '<svg class="kx-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffc400"/><circle cx="12" cy="12" r="7" fill="none" stroke="#7a5a00" stroke-width="2.4"/><circle cx="12" cy="12" r="2.2" fill="#7a5a00"/></svg>';
export const GEM = '<svg class="kx-gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l5 7-11 12L1 10z" fill="#22c8f0"/><path d="M6 3l2 7H1zm12 0l-2 7h7zM8 10h8l-4 12z" fill="#86e6ff"/><path d="M6 3h12l-2 7H8z" fill="#c4f4ff"/></svg>';
const num = (n) => Number(n).toLocaleString('es-ES');
export const amount = (r) => [r && r.pts ? `<span class="kx-amt">${COIN}${num(r.pts)}</span>` : '', r && r.gems ? `<span class="kx-amt">${GEM}${num(r.gems)}</span>` : ''].join('');

const GRAD = {
  gloss: (c) => [[0, '#ffffff'], [0.16, c], [0.72, c], [1, '#1c1f26']],
  matte: (c) => [[0, c], [1, c]],
  metal: (c) => [[0, c], [0.42, '#ffffff'], [0.55, c], [1, '#0b0d12']],
  neon: (c) => [[0, '#ffffff'], [0.3, c], [1, c]],
  chrome: () => [[0, '#ffffff'], [0.35, '#aab4c2'], [0.5, '#4a5262'], [0.62, '#e9edf3'], [1, '#8b94a3']],
  gold: () => [[0, '#fff3b8'], [0.38, '#f6bd2f'], [0.55, '#8a5a00'], [0.72, '#ffd65a'], [1, '#b57f0c']],
};
let gid = 0;
// muestra de color o pintura: un cuadrado redondeado con su acabado
export function paintSvg(item) {
  const id = 'kxp' + (gid++), stops = GRAD[item.finish](item.color).map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const glow = item.finish === 'neon' ? `<rect x="3" y="3" width="58" height="58" rx="15" fill="${item.color}" opacity=".3"/>` : '';
  const shine = item.finish === 'matte' ? '' : '<path d="M11 24q2-13 15-13h17q-20 6-32 25z" fill="#fff" opacity=".28"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${glow}<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="12" fill="url(#${id})" stroke="rgba(255,255,255,.28)" stroke-width="1.4"/>${shine}</svg>`;
}

// mono del piloto: torso con sus franjas, guantes y casco neutro
export function suitSvg(s) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="12" r="9" fill="#c9ced8"/><path d="M25 10h14l-2 6H27z" fill="#15171b"/>
    <path d="M20 24q12-7 24 0l9 20-7 4-4-9-1 21H23l-1-21-4 9-7-4z" fill="#${s.main}" stroke="rgba(0,0,0,.55)" stroke-width="1.4"/>
    <path d="M22 34h20v6H22z" fill="#${s.accent}"/><path d="M23 52h18v5H23z" fill="#${s.extra}"/>${s.style === 'flames' ? `<path d="M23 60l3-14 3 7 3-12 3 12 3-7 3 14z" fill="#${s.accent}"/>` : ''}
    <circle cx="14" cy="47" r="4.5" fill="#${s.extra}" stroke="#${s.accent}"/><circle cx="50" cy="47" r="4.5" fill="#${s.extra}" stroke="#${s.accent}"/></svg>`;
}
export const kartImg = (skin) => `<img class="kx-kartpic" data-noblur src="./assets/thumbs/skin_${skin}.webp" alt="">`;
export const itemArt = (item, helmetSvg) => (item.type === 'helmet' ? helmetSvg(item.helmet) : item.type === 'kart' ? kartImg(item.skin) : item.type === 'suit' ? suitSvg(item.suit) : item.type === 'decal' ? decalSvg(item.decal) : paintSvg(item));
export const KIND = { paint: 'Color', decal: 'Calcomanía', kart: 'Kart', suit: 'Mono', helmet: 'Casco' };
export const itemKind = (item) => (item.type === 'paint' && item.finish !== 'gloss' ? 'Pintura' : KIND[item.type]);

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
}).join('')}</ul><p class="kx-odds-note">No salen objetos repetidos mientras te quede alguno de esa rareza.</p>`;
