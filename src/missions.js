// Panel lateral de recompensas: racha de siete días y misiones del día. La pestaña asoma por el borde y avisa
// cuando hay algo que recoger.
import { amount, COIN } from './rewards.js';
import { ALL_MISSIONS_BONUS } from './economy.js';
import { msToReset } from './daily.js';

const hm = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)} h ${m % 60} min`; };

export function initMissions({ $, esc, eco }) {
  const tab = $('kxMisTab'), drawer = $('kxMis'), body = $('kxMisBody');
  let open = false;

  function paintTab() {
    const n = eco.pending();
    tab.classList.toggle('hot', n > 0);
    tab.querySelector('i').textContent = n || '';
    tab.setAttribute('aria-label', n ? `Recompensas: ${n} por recoger` : 'Recompensas y misiones');
  }
  function render() {
    const s = eco.streak(), list = eco.missions(), done = list.filter((m) => m.claimed).length;
    body.innerHTML = `
      <section><h3>Racha diaria</h3><p class="kx-note">${s.days ? `Llevas ${s.days} día${s.days === 1 ? '' : 's'} seguido${s.days === 1 ? '' : 's'}.` : 'Entra cada día y el premio sube.'} Si fallas un día, vuelve a empezar.</p>
        <ol class="kx-week">${s.cells.map((c, i) => `<li class="${c.done ? 'done' : c.now ? 'now' : ''}${i === 6 ? ' big' : ''}"><span>Día ${i + 1}</span>${amount(c)}</li>`).join('')}</ol>
        <button type="button" class="kx-cta" data-streak ${s.claimed ? 'disabled' : ''}>${s.claimed ? 'Recogido hoy' : 'Recoger premio de hoy'}</button></section>
      <section><h3>Misiones de hoy</h3><p class="kx-note">Se renuevan en ${hm(msToReset())}. Completa las tres y ganas ${ALL_MISSIONS_BONUS.gems} gemas.</p>
        ${list.map((m) => `<article class="kx-mission${m.claimed ? ' claimed' : m.done ? ' done' : ''}"><div><b>${esc(m.text)}</b><span class="bar"><i style="width:${Math.round(m.n / m.goal * 100)}%"></i></span><small>${m.n} de ${m.goal}</small></div>
          ${m.claimed ? '<em>Cobrada</em>' : m.done ? `<button type="button" data-claim="${m.level}">Recoger ${m.pts}${COIN}</button>` : `<em>${amount({ pts: m.pts })}</em>`}</article>`).join('')}
        <p class="kx-note center">${done} de 3 cobradas</p></section>`;
  }
  function set(v) {
    open = v; drawer.classList.toggle('on', v); drawer.setAttribute('aria-hidden', String(!v)); drawer.inert = !v;
    if (v) render();
  }
  tab.onclick = () => set(true);
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) return set(false);
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) return set(false);
    if (b.hasAttribute('data-streak')) eco.claimStreak();
    else if (b.dataset.claim) eco.claimMission(b.dataset.claim);
    else return;
    const y = body.scrollTop; render(); body.scrollTop = y;
  });
  addEventListener('keydown', (e) => { if (open && e.key === 'Escape') set(false); });
  eco.onChange(paintTab);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintTab(); });
  set(false); paintTab();
  return { close: () => set(false), paintTab };
}
