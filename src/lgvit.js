// Vitrina de la liga (inspirada en la sección Resultados de la app de la F1): Carreras, Pilotos y Premios por temporada,
// con selectores en forma de pastilla que abren una hoja inferior con «Hecho».
export function createVit(E) {
  const { S, esc, fmt, flagSvg, ic, me, PTS, dailyFor, av, colorMap, v2Head, v2Seg, calHtml, dayTxt, paint, redraw, load, acc, toast } = E;
  const TABS = [['cal', 'Calendario'], ['car', 'Carreras'], ['pil', 'Pilotos'], ['pre', 'Premios']];
  const mmOf = () => Object.fromEntries(S.state.members.map((m) => [m.user_id, m]));
  const fl = (f) => `<span class="flag sm">${flagSvg(f || 'es')}</span>`;
  const dshort = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');
  const track = (d) => { try { return dailyFor(d) || { name: 'Reto del día', flag: 'es' }; } catch (_) { return { name: 'Reto del día', flag: 'es' }; } };
  const days = () => [...((S.state && S.state.days) || [])].sort((a, b) => (a.day < b.day ? 1 : -1));
  const curDay = () => { const ds = days(); return ds.find((d) => d.day === S.vday) || ds[0] || null; };
  const hallAv = (h, cls = 'md') => av({ helmet: h.h }, '#111', cls);
  const pill = (kind, inner) => `<button type="button" class="vt-pill" data-vo="${kind}">${inner}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;

  function sheet() {
    if (!S.vpick) return '';
    const L = S.state.league, mm = mmOf(), opts = [];
    if (S.vpick === 'season') for (let s = L.current; s >= 1; s--) opts.push([`season|${s}`, `Temporada ${s}${s === L.current ? ' · en curso' : ''}`, L.season === s]);
    if (S.vpick === 'race') for (const d of days()) { const t = track(d.day); opts.push([`race|${d.day}`, `${fl(t.flag)}${esc(t.name)} <small>${dshort(d.day)}</small>`, (curDay() || {}).day === d.day]); }
    if (S.vpick === 'drv') for (const s of S.state.standings) { const m = mm[s.user_id] || { username: '?' }; opts.push([`drv|${s.user_id}`, `${av(m, '#111', 'xs')}${esc(m.username)}`, drvId() === s.user_id]); }
    const items = opts.map(([k, h, on]) => `<button type="button" class="vt-opt${on ? ' on' : ''}" data-vp="${k}">${h}</button>`).join('');
    return `<div class="vt-scrim" data-vo="close"></div><div class="vt-sheet" role="dialog"><div class="vt-list">${items}</div><button type="button" class="vt-done" data-vo="close">Hecho</button></div>`;
  }

  function races() {
    const d = curDay(); if (!d) return '<p class="lg-note">Aún no hay carreras en esta temporada.</p>';
    const mm = mmOf(), t = track(d.day), lead = d.rows[0].ms, nGh = d.rows.filter((r) => r.gh).length;
    const rows = d.rows.map((r, i) => { const m = mm[r.user_id] || { username: '?' };
      return `<div class="vt-r${r.user_id === me() ? ' me' : ''}"><i>${i + 1}</i>${av(m, '#111', 'sm')}<span class="vt-n"><b>${esc(m.username)}</b><small>${r.gh ? `<button type="button" class="vt-rp" data-rp="${d.day}|${r.user_id}">${ic('play')} Vuelta</button>` : ''}</small></span><span class="vt-t"><b>${fmt(r.ms / 1000)}</b><small>${i ? '+' + ((r.ms - lead) / 1000).toFixed(3) : 'Líder'}</small></span><em>${PTS[i] || 0}</em></div>`; }).join('');
    return `<div class="vt-sel">${pill('race', `${fl(t.flag)}<b>${esc(t.name)}</b>`)}</div>
      <div class="vt-h"><b>${esc(t.name)}</b><small>${esc(dayTxt(d.day))}${t.car ? ' · ' + esc(t.car) : ''}</small></div>
      ${nGh > 1 ? `<button type="button" class="vt-cine" data-rpall="${d.day}">${ic('play')} Repetición · todos los pilotos</button>` : ''}
      <div class="vt-cols"><span>Pos.</span><span>Piloto</span><span>Tiempo</span><span>Pts</span></div><div class="vt-tb">${rows}</div>`;
  }

  const drvId = () => { const st = S.state.standings; return (st.find((x) => x.user_id === S.vdrv) || st.find((x) => x.user_id === me()) || st[0] || {}).user_id; };
  function drivers() {
    const mm = mmOf(), st = S.state.standings, col = colorMap();
    const sel = st.find((x) => x.user_id === drvId()); if (!sel) return '<p class="lg-note">Aún no hay pilotos.</p>';
    const m = mm[sel.user_id] || { username: '?' };
    const pl = `<div class="vt-sel">${pill('drv', `${av(m, '#111', 'xs')}<b>${esc(m.username)}</b>`)}</div>`;
    const pos = st.findIndex((s) => s.user_id === sel.user_id) + 1;
    const list = days().slice().reverse().map((d) => { const i = d.rows.findIndex((r) => r.user_id === sel.user_id), t = track(d.day), r = d.rows[i];
      return `<div class="vt-r"><i>${i >= 0 ? i + 1 : '–'}</i><span class="vt-gp">${fl(t.flag)}<b>${esc(t.name)}</b></span><span class="vt-t"><small>${dshort(d.day)}</small>${r ? `<b>${fmt(r.ms / 1000)}</b>` : ''}</span><em>${i >= 0 ? PTS[i] || 0 : 0}</em></div>`; }).join('');
    return `${pl}<div class="vt-card" style="--c:${col[sel.user_id]}">${av(m, col[sel.user_id], 'lg')}<div><small>P${pos} · ${sel.pts} pts</small><b>${esc(m.username)}</b></div></div>
      <div class="vt-stats"><span><b>${sel.wins}</b>victorias</span><span><b>${sel.podiums || 0}</b>podios</span><span><b>${sel.days || 0}</b>carreras</span><span><b>${sel.best ? fmt(sel.best / 1000) : '–'}</b>mejor</span></div>
      <div class="vt-cols"><span>Pos.</span><span>Gran premio</span><span>Fecha</span><span>Pts</span></div><div class="vt-tb">${list || '<p class="lg-note">Sin carreras todavía.</p>'}</div>`;
  }

  function awards() {
    const hall = S.hall;
    if (!hall) { if (!S.hallBusy) { S.hallBusy = true; acc.rpc('league_hall', { p_league: S.id }).then((h) => { S.hall = Array.isArray(h) ? h : []; }).catch(() => { S.hall = []; }).finally(() => { S.hallBusy = false; if (S.tab === 'vit' && S.vt === 'pre') redraw(); }); } return '<div class="vt-load"><i class="sk" style="height:96px"></i><i class="sk" style="height:96px"></i></div>'; }
    if (!hall.length) return '<p class="lg-note">Todavía no hay premios: se reparten cuando se juegan los primeros días.</p>';
    const tot = {};
    const rec = (p, key, n = 1) => { const o = tot[p.u] || (tot[p.u] = { p, cups: 0, w: 0, pod: 0, runner: 0 }); o[key] += n; o.p = p; };
    const cups = [];
    for (const s of hall) {
      for (const p of s.st) { rec(p, 'w', p.w); rec(p, 'pod', p.p); }
      if (!s.live && s.st.length >= 2) { rec(s.st[0], 'cups'); rec(s.st[1], 'runner'); cups.push(s); }
    }
    const shelf = [...hall].reverse().map((s) => { const c = s.st[0], done = !s.live && s.st.length >= 2;
      return `<div class="vt-cup${done ? '' : ' live'}"><span class="vt-trophy">${ic('trophy')}</span>${hallAv(c, 'md')}<b>${esc(c.n)}</b><small>Temporada ${s.s}</small><em>${done ? `${c.pts} pts` : 'En juego'}</em></div>`; }).join('');
    const ppl = Object.values(tot).sort((a, b) => b.cups - a.cups || b.w - a.w || b.pod - a.pod);
    const best = (key) => { const top = Math.max(0, ...ppl.map((o) => o[key])); return top ? ppl.filter((o) => o[key] === top) : []; };
    const bl = hall.flatMap((s) => s.st.filter((p) => p.b).map((p) => ({ p, s: s.s }))).sort((a, b) => a.p.b - b.p.b)[0];
    const aw = [['Más campeonatos', best('cups'), 'cups', 'copas'], ['Más victorias', best('w'), 'w', 'victorias'], ['Más podios', best('pod'), 'pod', 'podios']].filter(([, w]) => w.length)
      .map(([n, w, k, u]) => `<div class="vt-aw"><small>${n}</small>${hallAv(w[0].p, 'sm')}<b>${esc(w.map((o) => o.p.n).join(' · '))}</b><em>${w[0][k]} ${u}</em></div>`).join('')
      + (bl ? `<div class="vt-aw"><small>Mejor vuelta</small>${hallAv(bl.p, 'sm')}<b>${esc(bl.p.n)}</b><em>${fmt(bl.p.b / 1000)} · T${bl.s}</em></div>` : '');
    const cab = ppl.map((o) => `<div class="vt-cab"><span class="vt-who">${hallAv(o.p, 'sm')}<b>${esc(o.p.n)}</b></span><span class="vt-ic" title="Campeonatos">${ic('trophy')}<b>${o.cups}</b></span><span class="vt-ic" title="Subcampeonatos">${ic('medal')}<b>${o.runner}</b></span><span class="vt-ic" title="Victorias">${ic('flag')}<b>${o.w}</b></span><span class="vt-ic" title="Podios">${ic('star')}<b>${o.pod}</b></span></div>`).join('');
    return `<div class="vt-h"><b>Campeones</b><small>${cups.length} temporada${cups.length === 1 ? '' : 's'} terminada${cups.length === 1 ? '' : 's'}</small></div><div class="vt-shelf">${shelf}</div>
      <div class="vt-h"><b>Récords de la liga</b></div><div class="vt-awg">${aw}</div>
      <div class="vt-h"><b>Vitrina de pilotos</b><small>campeonatos · subcampeonatos · victorias · podios</small></div><div class="vt-cabs">${cab}</div>`;
  }

  function render() {
    const L = S.state.league; S.vt = S.vt || 'cal';
    const seasonPill = S.vt === 'pre' ? '' : `<div class="vt-sel">${pill('season', `<b>Temporada ${L.season}${L.season === L.current ? ' · en curso' : ''}</b>`)}</div>`;
    const tabs = `<div class="vt-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-vt="${k}" class="${S.vt === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const body = S.vt === 'pil' ? drivers() : S.vt === 'pre' ? awards() : S.vt === 'car' ? races() : calHtml(true);
    paint.innerHTML = `${v2Head(L)}${v2Seg()}${tabs}${seasonPill}<div class="vt-body">${body}</div>${sheet()}`;
  }

  async function click(b) {
    const d = b.dataset;
    if (d.vt) { S.vt = d.vt; S.vpick = null; return render(); }
    if (d.vo) { S.vpick = d.vo === 'close' ? null : d.vo; return render(); }
    if (d.vp) {
      const [k, v] = d.vp.split('|'); S.vpick = null;
      if (k === 'season') { try { await load(+v); S.vday = null; S.vdrv = null; } catch (e) { toast(acc.explain(e)); } return redraw(); }
      if (k === 'race') { S.vday = v; S.vt = 'car'; return render(); }
      if (k === 'drv') { S.vdrv = v; S.vt = 'pil'; return render(); }
    }
  }
  return { render, click };
}
