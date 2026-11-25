// Moderación de nombres. En el cliente solo se tapan al mostrarlos y se rechazan al registrarse;
// la barrera real está en la base de datos (supabase/moderation.sql), con la misma lista.
const BANNED = ['nigg', 'nigga', 'negrata', 'negromierda', 'sudaca', 'maricon', 'maricona', 'faggot', 'hitler', 'heilh', 'neonazi', 'retrasado', 'subnormal', 'mongolo', 'hijodeputa', 'hijoputa', 'follar', 'violador', 'pedofilo'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
const flat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0134578@$!]/g, (c) => LEET[c] || '').replace(/[^a-z]/g, '');
export const isBadName = (s) => { const t = flat(s); return !!t && BANNED.some((w) => t.includes(w)); };
const KEYS = new Set(['name', 'username', 'driver', 'u', 'champion', 'p_name']);
// recorre una respuesta del servidor y sustituye los nombres ofensivos
export function scrubNames(v) {
  if (Array.isArray(v)) { for (const x of v) scrubNames(x); return v; }
  if (!v || typeof v !== 'object') return v;
  for (const k of Object.keys(v)) { const x = v[k]; if (typeof x === 'string') { if (KEYS.has(k) && isBadName(x)) v[k] = 'Piloto'; } else if (x && typeof x === 'object') scrubNames(x); }
  return v;
}
