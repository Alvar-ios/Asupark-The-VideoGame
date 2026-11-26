// Página de «Tiempos»: se elige circuito, se ve el récord en grande y debajo el resto de la clasificación.

// La misma lista en Tiempos, la ficha de circuito, el reto diario, los resultados y la clasificación en carrera.
export function timeRows(list, { esc, fmt, carName, best = list[0] ? list[0].ms : 0, name = (r) => `<span class="nom">${esc(r.name)}</span>`, sub = (r) => `<small>${esc(carName(r.carId))}</small>` }) {
  return `<ol class="kx-times">${list.map((r) => `<li class="${r.you ? 'me' : ''}${r.rank <= 3 ? ' p' + r.rank : ''}"><i>${r.rank}</i><span><b>${name(r)}</b>${sub(r)}</span><span class="t"><b>${fmt(r.ms / 1000)}</b><small>${r.rank === 1 ? 'Récord' : '+' + ((r.ms - best) / 1000).toFixed(3)}</small></span></li>`).join('')}</ol>`;
}

export function initTimes({ $, esc, fmt, carName, circuits, circuit, rows, openTrack }) {
  let key = null, token = 0;
  const box = () => $('kxTimes');
  async function render(wanted) {
    const list = circuits(); key = wanted || key || list[0].key;
    const mine = ++token, c = circuit(key);
    box().innerHTML = `<div class="kx-pick" role="tablist">${list.map((t) => `<button type="button" role="tab" aria-selected="${t.key === key}" class="${t.key === key ? 'on' : ''}" data-k="${t.key}">${t.art}<span>${esc(t.name)}</span></button>`).join('')}</div>
      <div id="kxBoard"><div class="kx-record loading"><span>Cargando tiempos…</span></div></div>`;
    const res = await rows(key); if (mine !== token) return;
    const [first, ...rest] = res.rows;
    const offline = res.online ? '' : `<p class="kx-note">${res.error ? 'Sin conexión con la clasificación: solo ves tus tiempos de este dispositivo.' : 'Solo ves tus tiempos de este dispositivo.'}</p>`;
    const record = first
      ? `<div class="kx-record${first.you ? ' me' : ''}"><span>Récord de ${esc(c.name)}</span><b class="kx-big">${fmt(first.ms / 1000)}</b><span class="kx-who"><b>${esc(first.name)}</b>${esc(carName(first.carId))}</span></div>`
      : `<div class="kx-record"><span>${esc(c.name)}</span><b class="kx-big">Libre</b><span class="kx-who">Nadie ha marcado tiempo todavía.</span></div>`;
    const me = res.rows.find((r) => r.you);
    const gap = me && first && me.rank > 1 ? `, a ${((me.ms - first.ms) / 1000).toFixed(3)} del récord` : '';
    const own = me ? `<p class="kx-mine">Vas <b>${me.rank}º</b>${gap}</p>` : c.best != null ? `<p class="kx-mine">Tu mejor vuelta aquí: <b>${fmt(c.best / 1000)}</b></p>` : '';
    const shown = rest.filter((r) => r.rank <= 20 || r.you);
    $('kxBoard').innerHTML = `${offline}${record}${own}${shown.length ? timeRows([first, ...shown], { esc, fmt, carName }).replace(/<li class="[^"]*p1">[\s\S]*?<\/li>/, '') : ''}
      <button type="button" class="kx-cta" data-go="1">Correr en este circuito</button>`;
  }
  $('kxTimes').addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]'); if (k) return render(k.dataset.k);
    if (e.target.closest('[data-go]')) openTrack(key);
  });
  return { render };
}
