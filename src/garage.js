// Garaje: el kart elegido en grande (con el mismo modelo 3D que se conduce), los dos karts, sus prestaciones,
// el color y el dorsal.
const STATS = [['Velocidad punta', 'vmax', (v) => Math.round(v * 3.6) + ' km/h'], ['Aceleración', 'accel', null], ['Giro', 'yaw', null], ['Agarre', 'grip', null]];

import { paintSvg } from './rewards.js';

export function initGarage({ $, esc, garage, openShop }) {
  const box = () => $('kxGarage');
  let token = 0;

  function paintShot() {
    const mine = ++token, k = garage.current(), img = $('kxHero'); if (!img) return;
    img.classList.add('wait');
    garage.shot(k.id, 960, 600).then((u) => { const el = $('kxHero'); if (mine !== token || !el || !u) return; el.src = u; el.classList.remove('wait'); });
  }
  function thumbs() {
    for (const k of garage.list()) garage.shot(k.id, 360, 225).then((u) => { const el = box().querySelector(`[data-kart="${k.id}"] img`); if (el && u) el.src = u; });
  }
  function render() {
    const list = garage.list(), k = garage.current();
    const max = Object.fromEntries(STATS.map(([, p]) => [p, Math.max(...list.map((x) => x[p]))]));
    const special = garage.special(), specials = garage.specials(), color = special ? '' : garage.color(k.id).toLowerCase();
    const base = garage.color(k.id).toLowerCase();
    box().innerHTML = `<div class="kx-stage"><img id="kxHero" data-noblur class="wait" alt="${esc(k.name)}"><span class="kx-num">${garage.num()}</span></div>
      <h3 class="kx-kartname">${esc(k.name)}</h3><p class="kx-lead">${esc(k.desc)}</p>
      <div class="kx-karts">${list.map((x) => `<button type="button" data-kart="${x.id}" class="${x.id === k.id ? 'on' : ''}" aria-pressed="${x.id === k.id}"><img data-noblur alt=""><b>${esc(x.name)}</b><small>${x.id === k.id ? 'En uso' : 'Elegir'}</small></button>`).join('')}</div>
      <section class="kx-card"><h3>Prestaciones</h3>${STATS.map(([label, p, show]) => `<div class="kx-stat"><span>${label}</span><i><s style="width:${Math.round(k[p] / (max[p] * 1.06) * 100)}%"></s></i><b>${show ? show(k[p]) : k[p].toFixed(1)}</b></div>`).join('')}</section>
      <section class="kx-card"><h3>Personalizar</h3>
        ${k.freeColor ? `<div class="kx-swatches">${k.paints.map(([n, hex]) => `<button type="button" data-paint="${hex}" class="${hex.toLowerCase() === color ? 'on' : ''}" style="--c:${hex}" aria-label="${esc(n)}"></button>`).join('')}<label class="kx-custom" style="--c:${base}"><input type="color" id="kxColor" value="${base}" aria-label="Otro color"><span>+</span></label></div>` : `<div class="kx-finishes"><button type="button" data-finish="" class="${special ? '' : 'on'}">Dorado de serie</button></div>`}
        <div class="kx-finishes">${specials.map((p) => `<button type="button" data-finish="${p.id}" class="${special && special.id === p.id ? 'on' : ''}">${paintSvg(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>
        <button type="button" class="kx-link" data-shop="1">Más acabados en la tienda</button>
        <div class="kx-dorsal"><span>Dorsal</span><button type="button" data-num="-1" aria-label="Dorsal anterior">−</button><input id="kxNum" inputmode="numeric" maxlength="2" value="${garage.num()}" aria-label="Número de dorsal"><button type="button" data-num="1" aria-label="Dorsal siguiente">+</button></div>
      </section>`;
    paintShot(); thumbs();
  }
  const keep = () => { const m = $('kxMain'), y = m.scrollTop; render(); m.scrollTop = y; };
  $('kxGarage').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.shop) return openShop();
    if (b.dataset.finish !== undefined) { garage.setSpecial(b.dataset.finish || null); return keep(); }
    if (b.dataset.kart) { if (b.dataset.kart !== garage.current().id) { garage.pick(b.dataset.kart); keep(); } else garage.rev(); }
    else if (b.dataset.paint) { garage.setColor(b.dataset.paint); keep(); }
    else if (b.dataset.num) { garage.setNum((garage.num() + +b.dataset.num + 100) % 100); keep(); }
  });
  $('kxGarage').addEventListener('change', (e) => {
    if (e.target.id === 'kxColor') { garage.setColor(e.target.value); keep(); }
    if (e.target.id === 'kxNum') { const v = parseInt(e.target.value.replace(/\D/g, ''), 10); garage.setNum(v >= 0 && v <= 99 ? v : garage.num()); keep(); }
  });
  return { render };
}
