// Tienda: caja diaria, cajas de pago, ofertas del día y colección propia.
import { BOXES, RARITY, ITEMS } from './economy.js';
import { COIN, GEM, amount, itemArt, itemKind, oddsList } from './rewards.js';
import { msToReset } from './daily.js';
import { boxSvg } from './boxart.js';
export { boxSvg };

const hms = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), p = (n) => String(n).padStart(2, '0'); return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
export function initShop({ $, esc, eco, helmetSvg, openBox, equip, isEquipped, testMode, toast }) {
  const box = () => $('kxShop');
  let ask = null; // compra pendiente de confirmar
  const price = (c) => amount(c);

  function render() {
    const ready = eco.dailyReady(), offers = eco.offers(), mine = eco.owned();
    box().innerHTML = `
      <section class="kx-gift${ready ? ' ready' : ''}">
        ${boxSvg('daily')}
        <div><h3>Caja diaria</h3><p>${ready ? 'Gratis. Ábrela y mira qué te toca.' : `Vuelve en <b class="kx-cd">${hms(msToReset())}</b>`}</p></div>
        <button type="button" class="kx-cta" data-open="daily" ${ready ? '' : 'disabled'}>${ready ? 'Abrir gratis' : 'Ya abierta'}</button>
        <details><summary>Qué puede tocar</summary>${oddsList(BOXES.daily)}</details>
      </section>
      <h3 class="kx-sub">Cajas</h3>
      <div class="kx-boxes">${['pit', 'podium'].map((id) => { const b = BOXES[id], ok = eco.canOpen(id); return `<section class="kx-boxcard ${id}">${boxSvg(id)}<h3>${b.name}</h3>
        <button type="button" data-open="${id}" ${ok ? '' : 'aria-disabled="true"'}>${price(b.cost)}</button><details><summary>Probabilidades</summary>${oddsList(b)}</details></section>`; }).join('')}</div>
      <h3 class="kx-sub">Ofertas de hoy</h3><p class="kx-lead">Cambian en <span class="kx-cd">${hms(msToReset())}</span></p>
      <div class="kx-items">${offers.map((it) => card(it, eco.has(it.id) ? '<small class="have">Ya es tuyo</small>' : `<button type="button" data-buy="${it.id}">${ask === it.id ? 'Confirmar' : price(RARITY[it.rarity].price)}</button>`)).join('')}</div>
      <h3 class="kx-sub">Tu colección <small>${mine.length} de ${ITEMS.length}</small></h3>
      ${mine.length ? `<div class="kx-items">${mine.map((it) => card(it, `<button type="button" class="${isEquipped(it) ? 'on' : ''}" data-equip="${it.id}">${isEquipped(it) ? 'Puesto' : 'Equipar'}</button>`)).join('')}</div>`
        : '<p class="kx-note">Todavía no tienes nada. Tu primer objeto puede salir de la caja diaria.</p>'}
      ${testMode ? `<section class="kx-card kx-test"><h3>Modo de pruebas</h3><p class="kx-note">Solo para probar la tienda. Se quitará cuando el saldo pase al servidor.</p>
        <div><button type="button" data-test="money">Sumar 2.000 puntos y 100 gemas</button><button type="button" data-test="box">Recuperar la caja diaria</button><button type="button" data-test="reset">Vaciar todo</button></div></section>` : ''}`;
  }
  const card = (it, action) => `<article class="kx-item" style="--rc:${RARITY[it.rarity].color}"><span class="art">${itemArt(it, helmetSvg)}</span><b>${esc(it.name)}</b><small>${itemKind(it)}, ${RARITY[it.rarity].name.toLowerCase()}</small>${action}</article>`;
  const keep = () => { const m = $('kxMain'), y = m.scrollTop; render(); m.scrollTop = y; };

  $('kxShop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) {
      if (!eco.canOpen(b.dataset.open)) return toast(b.dataset.open === 'daily' ? 'Ya has abierto la caja de hoy' : `Te falta saldo para esta caja. Consigue ${BOXES[b.dataset.open].cost.gems ? 'gemas con las misiones' : 'puntos con las misiones y la racha'}.`);
      return openBox(b.dataset.open);
    }
    if (b.dataset.buy) {
      if (ask !== b.dataset.buy) { ask = b.dataset.buy; return keep(); }
      ask = null;
      if (!eco.buy(b.dataset.buy)) toast('Te falta saldo para comprarlo'); else toast('Comprado. Ya está en tu colección.');
      return keep();
    }
    if (b.dataset.equip) { equip(b.dataset.equip); return keep(); }
    if (b.dataset.test) {
      if (b.dataset.test === 'money') eco.test.give({ pts: 2000, gems: 100 });
      else if (b.dataset.test === 'box') eco.test.newBox();
      else eco.test.reset();
      return keep();
    }
  });
  setInterval(() => { if (box().offsetParent) for (const el of box().querySelectorAll('.kx-cd')) el.textContent = hms(msToReset()); }, 1000);
  return { render: () => { ask = null; render(); } };
}

export const walletHtml = (eco) => `<span>${COIN}<b>${eco.pts.toLocaleString('es-ES')}</b></span><span>${GEM}<b>${eco.gems.toLocaleString('es-ES')}</b></span>`;
