// Catálogo: todo lo que hay en el juego, sacado del propio catálogo para que lo nuevo aparezca solo.
// Se entra con el código de cuenta completa (Ajustes).
import { ITEMS, RARITY } from './economy.js';
import { itemArt, KIND } from './rewards.js';

const GROUPS = [['kart', 'Karts'], ['paint', 'Colores y pinturas'], ['decal', 'Calcomanías'], ['suit', 'Monos'], ['helmet', 'Cascos']];
const ORDER = ['common', 'rare', 'epic', 'legendary'];

export function initCatalog({ $, esc, eco, helmetSvg, equip, isEquipped, circuits, openTrack }) {
  let filter = 'kart';
  const box = () => $('kxCatalog');
  function render() {
    const count = (t) => ITEMS.filter((i) => i.type === t).length;
    const list = ITEMS.filter((i) => i.type === filter).sort((a, b) => ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity));
    box().innerHTML = `<div class="kx-tabs">${GROUPS.map(([id, name]) => `<button type="button" data-cat="${id}" class="${filter === id ? 'on' : ''}">${name} (${count(id)})</button>`).join('')}<button type="button" data-cat="track" class="${filter === 'track' ? 'on' : ''}">Circuitos (${circuits().length})</button></div>
      ${filter === 'track' ? `<div class="kx-tracks">${circuits().map((c) => `<button type="button" class="kx-track" data-track="${c.key}">${c.art}<b>${esc(c.name)}</b><span>${esc(c.meta)}</span></button>`).join('')}</div>`
      : `<p class="kx-lead">${ORDER.map((r) => [list.filter((i) => i.rarity === r).length, RARITY[r].name.toLowerCase()]).filter(([n]) => n).map(([n, name]) => `${n} de rareza ${name}`).join(', ')}.</p>
      <div class="kx-items">${list.map((it) => { const have = eco.has(it.id), on = have && isEquipped(it); return `<article class="kx-item" style="--rc:${RARITY[it.rarity].color}"><span class="art">${itemArt(it, helmetSvg)}</span><b>${esc(it.name)}</b><small>${KIND[it.type]}, ${RARITY[it.rarity].name.toLowerCase()}</small>
        ${have ? `<button type="button" class="${on ? 'on' : ''}" data-wear="${it.id}">${on ? 'Puesto' : 'Equipar'}</button>` : '<small class="have">Sin conseguir</small>'}</article>`; }).join('')}</div>`}`;
  }
  $('kxCatalog').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.cat) { filter = b.dataset.cat; return render(); }
    if (b.dataset.track) return openTrack(b.dataset.track);
    if (b.dataset.wear) { equip(b.dataset.wear); const m = $('kxMain'), y = m.scrollTop; render(); m.scrollTop = y; }
  });
  return { render };
}
