// Con qué kart se hizo cada fantasma. La base de datos solo admite el recorrido (grupos de cuatro números), así que el
// aspecto viaja como un último grupo marcado: [MARCA, kart, color, calcomanía]. Así no hace falta cambiar el servidor.
// Los fantasmas guardados antes no lo llevan y salen con el kart de serie.
import { ITEMS } from './economy.js';
import { hashStr } from './rng.js';

const MARK = -987654;
const code = (id) => (id ? hashStr('ghost:' + id) : 0);
const byCode = new Map(ITEMS.map((i) => [code(i.id), i]));

// frames: [x, y, z, rumbo, ...]; look: lo que devuelve economy.look()
export function packGhost(frames, look) {
  const out = Array.from(frames, (v) => Math.round(v * 100) / 100);
  out.push(MARK, ...['kart', 'paint', 'decal'].map((slot) => code(look && look[slot] && look[slot].id)));
  return out;
}

// devuelve el recorrido sin la marca y el aspecto: { skin, paint, decal } (null si es el de serie)
export function splitGhost(ghost) {
  const n = ghost ? ghost.length : 0;
  if (n < 4 || Math.round(ghost[n - 4]) !== MARK) return { frames: ghost || null, skin: null, paint: null, decal: null };
  const [kart, paint, decal] = [1, 2, 3].map((k) => byCode.get(ghost[n - 4 + k]) || null);
  return { frames: ghost.slice(0, n - 4), skin: kart ? kart.skin : null, paint: kart ? null : paint, decal: kart || !decal ? null : decal.decal };
}
