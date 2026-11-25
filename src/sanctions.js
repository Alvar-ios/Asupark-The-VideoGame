// Comunicados de la FIA: aviso en el inicio para todos, hoja con el documento y apelaciones públicas del sancionado.
import { ic } from './icons.js';
import { toastEl } from './ux.js';
const SEEN = 'dr.sancSeen';
export function initSanctions({ $, acc, esc }) {
  let list = [], cur = null;
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (_) { return []; } };
  const mark = (id) => { const s = seen(); if (!s.includes(id)) { s.push(id); try { localStorage.setItem(SEEN, JSON.stringify(s.slice(-30))); } catch (_) { /* sin almacenamiento */ } } };
  const day = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const stamp = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
  const card = (s) => {
    const fresh = !seen().includes(s.id);
    return `<button type="button" class="hm-sanc${fresh ? ' new' : ''}" data-sanc="${s.id}"><span class="sn-ic">${ic('alert')}</span><span class="sn-t"><small>Comunicado de la FIA${fresh ? '<em>NUEVO</em>' : ''}</small><b>${esc(s.driver)} sancionado: −${s.points} puntos</b><small>${esc(s.league)} · ${esc(s.title)} · ${day(s.created_at)}${s.appeals ? ` · ${s.appeals} apelación${s.appeals === 1 ? '' : 'es'}` : ''}</small></span><i>›</i></button>`;
  };
  async function render() {
    const box = $('hmSanc'); if (!box) return;
    const paint = (l) => { list = Array.isArray(l) ? l : []; box.innerHTML = list.map(card).join(''); box.classList.toggle('hidden', !list.length); };
    try { if (acc.loggedIn) await acc.swr('sanctions_feed', {}, (d) => paint(d)); else paint(await acc.rpc('sanctions_feed', {}, false)); } catch (_) { /* sin red: se queda lo que hubiera */ }
  }
  async function appeals() {
    const box = $('sancAp'); if (!box || !cur) return;
    try {
      const l = await acc.rpc('sanction_appeals', { p_id: cur.id }, false);
      box.innerHTML = l.length ? l.map((a) => `<div class="snc-a"><div><b>${esc(a.driver)}</b><small>${stamp(a.created_at)}</small></div><p>${esc(a.body)}</p></div>`).join('') : '<p class="snc-n">Todavía no hay apelaciones.</p>';
    } catch (_) { box.innerHTML = '<p class="snc-n">No se han podido cargar las apelaciones.</p>'; }
  }
  async function open(id) {
    if (!list.find((x) => x.id === id)) await render();
    const s = list.find((x) => x.id === id); if (!s) return; cur = s; mark(id);
    const form = s.mine
      ? `<div class="snc-form"><textarea id="sancTx" maxlength="600" rows="3" placeholder="Presenta tu apelación. La verán todos los pilotos." aria-label="Apelación"></textarea><button id="sancSend" class="big" type="button">APELAR</button></div>`
      : `<p class="snc-n">Solo el piloto sancionado puede presentar apelación.</p>`;
    $('sancBody').innerHTML = `<a class="snc-doc" href="./${esc(s.image)}" target="_blank" rel="noopener"><img src="./${esc(s.image)}" alt="Comunicado de los comisarios: sanción a ${esc(s.driver)}"></a>
      <div class="snc-sum"><div><b>−${s.points}</b><small>PUNTOS</small></div><div><b>${esc(s.driver)}</b><small>${esc(s.league)} · ${esc(s.title)}</small></div></div>
      <p class="snc-n">${esc(s.reason)}. En caso de reincidencia se planteará la expulsión de la competición.</p>
      <h3>Apelaciones públicas</h3><div id="sancAp" class="snc-ap"><p class="snc-n">Cargando…</p></div>${form}`;
    $('sanction').classList.remove('hidden'); const sc = $('sanction'); if (sc) sc.scrollTop = 0;
    render(); appeals();
  }
  const close = () => { $('sanction').classList.add('hidden'); render(); };
  $('sancClose').onclick = close;
  $('sanction').addEventListener('click', async (e) => {
    if (e.target === $('sanction')) return close();
    const b = e.target.closest('#sancSend'); if (!b || !cur) return;
    const tx = $('sancTx'), v = tx.value.trim(); if (v.length < 3) return toastEl.show('Escribe tu apelación');
    b.disabled = true;
    try { await acc.rpc('sanction_appeal', { p_id: cur.id, p_body: v }); tx.value = ''; toastEl.show('Apelación publicada'); await appeals(); }
    catch (err) { toastEl.show((err && err.message) || 'No se ha podido publicar'); }
    b.disabled = false;
  });
  const hs = $('hmSanc'); if (hs) hs.addEventListener('click', (e) => { const b = e.target.closest('[data-sanc]'); if (b) open(b.dataset.sanc); });
  document.addEventListener('dr:sanction', (e) => open(e.detail.id));
  return { render, open };
}
