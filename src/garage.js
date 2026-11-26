// Garaje: tu kart en grande con el piloto (el mismo modelo que se conduce), la carrocería, el color, la calcomanía,
// el mono y el dorsal. Solo aparece para elegir lo que ya tienes; el resto se consigue en las cajas.
import { RARITY } from './economy.js';
import { paintSvg, suitSvg, kartImg } from './rewards.js';
import { decalSvg } from './decals.js';
import { SUIT_DEFAULT } from './pilot.js';

export function initGarage({ $, esc, garage, openShop, openProfile, helmetSvg }) {
  const box = () => $('kxGarage');
  let token = 0;

  function paintShot() {
    const mine = ++token, img = $('kxHero'); if (!img) return;
    img.classList.add('wait');
    garage.shot(960, 640).then((u) => { const el = $('kxHero'); if (mine !== token || !el || !u) return; el.src = u; el.classList.remove('wait'); });
  }
  const left = (type) => garage.total(type) - garage.owned(type).length;
  const more = (type, one, many) => { const n = left(type); return n > 0 ? `<button type="button" class="kx-link" data-shop="1">Te ${n === 1 ? `queda 1 ${one}` : `quedan ${n} ${many}`} por conseguir</button>` : ''; };
  // una casilla: dibujo, nombre y el borde del color de su rareza (gris si viene de serie)
  const chip = (attr, on, art, name, rarity) => `<button type="button" ${attr} class="kx-tile${on ? ' on' : ''}" aria-pressed="${on}" style="--rc:${rarity ? RARITY[rarity].color : '#59616f'}"><i>${art}</i><span>${esc(name)}</span></button>`;

  function render() {
    const cur = garage.current(), look = garage.look(), rental = !cur.skin;
    const ORDER = ['common', 'rare', 'epic', 'legendary'];
    const paints = garage.owned('paint').slice().sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
    const paintOn = look.paint ? look.paint.id : '';
    box().innerHTML = `<div class="kx-stage"><img id="kxHero" data-noblur class="wait" alt="${esc(cur.name)}">${rental ? `<span class="kx-num">${garage.num()}</span>` : ''}</div>
      <h3 class="kx-kartname">${esc(cur.name)}</h3><p class="kx-lead">Todos los karts corren igual: solo cambia el aspecto.</p>
      <section class="kx-card"><h3>Carrocería</h3>
        <div class="kx-grid">${chip('data-kart=""', rental, '<span class="kx-kartpic rental"></span>', 'De serie')}${garage.owned('kart').map((k) => chip(`data-kart="${k.id}"`, cur.skin === k.skin, kartImg(k.skin), k.name, k.rarity)).join('')}</div>
        ${more('kart', 'kart', 'karts')}</section>
      ${rental ? `<section class="kx-card"><h3>Color</h3>
        <div class="kx-grid">${chip('data-paint=""', !paintOn, paintSvg({ color: garage.stock(), finish: 'gloss' }), 'Rojo de serie')}${paints.map((p) => chip(`data-paint="${p.id}"`, paintOn === p.id, paintSvg(p), p.name, p.rarity)).join('')}</div>
        ${more('paint', 'color', 'colores')}</section>
      <section class="kx-card"><h3>Calcomanía</h3>
        <div class="kx-grid">${chip('data-decal=""', !look.decal, '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="12" fill="#20242c"/><circle cx="32" cy="32" r="13" fill="none" stroke="#8b94a3" stroke-width="3.5"/><path d="M23 41l18-18" stroke="#8b94a3" stroke-width="3.5"/></svg>', 'Ninguna')}${garage.owned('decal').map((d) => chip(`data-decal="${d.id}"`, !!look.decal && look.decal.id === d.id, decalSvg(d.decal), d.name, d.rarity)).join('')}</div>
        ${more('decal', 'calcomanía', 'calcomanías')}</section>` : ''}
      <section class="kx-card"><h3>Piloto</h3>
        <div class="kx-grid">${chip('data-suit=""', !look.suit, suitSvg(SUIT_DEFAULT), 'Mono de serie')}${garage.owned('suit').map((s) => chip(`data-suit="${s.id}"`, !!look.suit && look.suit.id === s.id, suitSvg(s.suit), s.name, s.rarity)).join('')}</div>
        ${more('suit', 'mono', 'monos')}
        <button type="button" class="kx-helmetrow" data-helmet="1"><span class="art">${helmetSvg(garage.helmet())}</span><b>Casco</b><em>Cambiar en el perfil</em></button></section>
      ${rental ? `<section class="kx-card"><div class="kx-dorsal"><span>Dorsal</span><button type="button" data-num="-1" aria-label="Dorsal anterior">−</button><input id="kxNum" inputmode="numeric" maxlength="2" value="${garage.num()}" aria-label="Número de dorsal"><button type="button" data-num="1" aria-label="Dorsal siguiente">+</button></div></section>` : ''}`;
    paintShot();
  }
  const keep = () => { const m = $('kxMain'), y = m.scrollTop; render(); m.scrollTop = y; };
  const wear = (id, slot) => { if (id) garage.equip(id); else garage.unequip(slot); };
  $('kxGarage').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.shop) return openShop();
    if (d.helmet) return openProfile();
    if (d.kart !== undefined) { wear(d.kart, 'kart'); garage.rev(); }
    else if (d.paint !== undefined) wear(d.paint, 'paint');
    else if (d.decal !== undefined) wear(d.decal, 'decal');
    else if (d.suit !== undefined) wear(d.suit, 'suit');
    else if (d.num) garage.setNum((garage.num() + +d.num + 100) % 100);
    else return;
    keep();
  });
  $('kxGarage').addEventListener('change', (e) => {
    if (e.target.id === 'kxNum') { const v = parseInt(e.target.value.replace(/\D/g, ''), 10); garage.setNum(v >= 0 && v <= 99 ? v : garage.num()); keep(); }
  });
  return { render };
}
