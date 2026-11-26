// Economía de KartlosApp: puntos, gemas, catálogo de cosméticos, cajas, racha diaria y misiones.
// Todo lo que se puede tocar para equilibrar el juego está en las tablas de arriba.
// VERSIÓN DE PRUEBA: el saldo se guarda en el dispositivo. Antes de que valga dinero (o puntos comprables)
// estas mismas operaciones tienen que pasar al servidor, que es quien debe decidir premios y saldos.

export const RARITY = {
  common: { name: 'Común', color: '#9fb0c8', dup: 100, price: { pts: 500 } },
  rare: { name: 'Rara', color: '#3b9dff', dup: 250, price: { pts: 1200 } },
  epic: { name: 'Épica', color: '#b45cff', dup: 700, price: { pts: 3000 } },
  legendary: { name: 'Legendaria', color: '#ffc400', dup: 2000, price: { gems: 150 } },
};

// type paint: color y acabado del Kart de alquiler (finish gloss = color liso). type decal: calcomanía encima del color.
// type kart: carrocería completa (skin); todos corren igual. type suit: ropa del piloto.
// type helmet: casco «base|dibujo|visera|patrón» (el mismo formato que guarda el perfil).
// De salida solo se tiene el rojo de serie: el resto de colores salen en las cajas.
const color = (id, name, hex) => ({ id, type: 'paint', rarity: 'common', name, color: hex, finish: 'gloss' });
const kart = (skin, rarity, name) => ({ id: 'k-' + skin, type: 'kart', rarity, name, skin });
const suit = (id, rarity, name, main, accent, extra, more = {}) => ({ id, type: 'suit', rarity, name, suit: { main, accent, extra, ...more } });
export const ITEMS = [
  color('c-naranja', 'Naranja', '#f08a1c'), color('c-amarillo', 'Amarillo', '#f3c026'), color('c-verde', 'Verde', '#28a745'), color('c-azul', 'Azul', '#2d5fd0'),
  color('c-morado', 'Morado', '#7d3fc4'), color('c-rosa', 'Rosa', '#e8559a'), color('c-blanco', 'Blanco', '#f2f2f2'), color('c-negro', 'Negro', '#16181d'),
  { id: 'p-cemento', type: 'paint', rarity: 'common', name: 'Gris cemento', color: '#8d9299', finish: 'matte' },
  { id: 'p-noche', type: 'paint', rarity: 'common', name: 'Azul noche mate', color: '#1b2a52', finish: 'matte' },
  { id: 'p-militar', type: 'paint', rarity: 'common', name: 'Verde militar', color: '#55603a', finish: 'matte' },
  { id: 'p-granate', type: 'paint', rarity: 'common', name: 'Granate mate', color: '#6e1423', finish: 'matte' },
  { id: 'h-asfalto', type: 'helmet', rarity: 'common', name: 'Casco Asfalto', helmet: '3a3f48|ffc400|111827|2' },
  { id: 'h-mandarina', type: 'helmet', rarity: 'common', name: 'Casco Mandarina', helmet: 'ff7a1a|ffffff|111827|3' },
  { id: 'h-hielo', type: 'helmet', rarity: 'common', name: 'Casco Hielo', helmet: 'cfe8ff|1b2a52|111827|1' },
  { id: 'h-oliva', type: 'helmet', rarity: 'common', name: 'Casco Oliva', helmet: '55603a|e8e4d0|111827|2' },
  { id: 'p-azulmetal', type: 'paint', rarity: 'rare', name: 'Azul metalizado', color: '#1f6fe0', finish: 'metal' },
  { id: 'p-rojometal', type: 'paint', rarity: 'rare', name: 'Rojo metalizado', color: '#c40f16', finish: 'metal' },
  { id: 'p-plata', type: 'paint', rarity: 'rare', name: 'Plata de fábrica', color: '#b9c1cc', finish: 'metal' },
  { id: 'h-meta', type: 'helmet', rarity: 'rare', name: 'Casco Línea de meta', helmet: 'ffffff|111827|e63946|4' },
  { id: 'h-mitades', type: 'helmet', rarity: 'rare', name: 'Casco Dos mitades', helmet: '1d6fd6|f4d000|111827|7' },
  { id: 'p-lima', type: 'paint', rarity: 'epic', name: 'Lima neón', color: '#9dff00', finish: 'neon' },
  { id: 'p-magenta', type: 'paint', rarity: 'epic', name: 'Magenta neón', color: '#ff1fa8', finish: 'neon' },
  { id: 'h-llamas', type: 'helmet', rarity: 'epic', name: 'Casco Llamas', helmet: '16181d|ff6a00|e5e7eb|5' },
  { id: 'h-rayo', type: 'helmet', rarity: 'epic', name: 'Casco Rayo', helmet: '4c1d95|ffe14d|111827|6' },
  { id: 'p-cromo', type: 'paint', rarity: 'legendary', name: 'Cromo', color: '#e9edf3', finish: 'chrome' },
  { id: 'p-oro', type: 'paint', rarity: 'legendary', name: 'Oro líquido', color: '#f6bd2f', finish: 'gold' },
  { id: 'h-campeon', type: 'helmet', rarity: 'legendary', name: 'Casco Campeón', helmet: 'f6bd2f|ffffff|111827|8' },
  // calcomanías (raras)
  { id: 'd-franjas', type: 'decal', rarity: 'rare', name: 'Franjas dobles', decal: 'franjas' },
  { id: 'd-cuadros', type: 'decal', rarity: 'rare', name: 'Bandera a cuadros', decal: 'cuadros' },
  { id: 'd-camuflaje', type: 'decal', rarity: 'rare', name: 'Camuflaje', decal: 'camuflaje' },
  { id: 'd-llamas', type: 'decal', rarity: 'rare', name: 'Llamas', decal: 'llamas' },
  { id: 'd-rayo', type: 'decal', rarity: 'rare', name: 'Rayo', decal: 'rayo' },
  // karts completos
  kart('pizza1', 'rare', 'Pizzería Selva'), kart('pizza2', 'rare', 'Pizzería Corazón'), kart('pizza3', 'rare', 'Pizzería Impacto'),
  kart('pizza4', 'rare', 'Pizzería Circo'), kart('pizza5', 'rare', 'Pizzería Relámpago'), kart('pizza6', 'rare', 'Pizzería Estrellas'),
  kart('caramelo1', 'epic', 'Tarta de chuches'), kart('caramelo2', 'epic', 'Piruleta'), kart('caramelo3', 'epic', 'Menta helada'),
  kart('caramelo4', 'epic', 'Bizcocho'), kart('caramelo5', 'epic', 'Pastel de fresa'),
  kart('estandar', 'legendary', 'Kart estándar'),
  // ropa del piloto
  suit('s-taller', 'common', 'Mono de taller', '2f4a7a', 'e8ecf2', '1b1d22'),
  suit('s-pista', 'common', 'Mono de pista', 'b3161c', 'ffffff', '1b1d22'),
  suit('s-bosque', 'common', 'Mono de bosque', '1f5c3a', 'e8e4d0', '14161b'),
  suit('s-hielo', 'rare', 'Mono de hielo', 'dfe5ee', '1d6fd6', '16264f'),
  suit('s-carbono', 'rare', 'Mono de carbono', '17191e', '9dff00', '0b0c0f'),
  suit('s-llamas', 'epic', 'Mono en llamas', '16181d', 'ff6a00', 'ffc400', { style: 'flames' }),
  suit('s-oro', 'legendary', 'Mono de oro', 'd9a52a', '111827', 'f4f4f4', { metal: true }),
];
export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;

// Cada fila: [premio, probabilidad en %]. Las filas de cada caja suman 100.
export const BOXES = {
  daily: { id: 'daily', name: 'Caja diaria', cost: null, table: [['pts:50', 30], ['pts:100', 18], ['pts:250', 6], ['gems:3', 8], ['common', 28], ['rare', 8], ['epic', 1.7], ['legendary', 0.3]] },
  pit: { id: 'pit', name: 'Caja de boxes', cost: { pts: 600 }, table: [['common', 55], ['rare', 30], ['epic', 12], ['legendary', 3]] },
  podium: { id: 'podium', name: 'Caja podio', cost: { gems: 60 }, table: [['rare', 60], ['epic', 32], ['legendary', 8]] },
};

// Racha de conexión: siete días seguidos y vuelve a empezar. Si fallas un día, vuelves al primero.
export const STREAK = [{ pts: 50 }, { pts: 60 }, { pts: 70 }, { pts: 80 }, { pts: 100 }, { pts: 120 }, { pts: 150, gems: 10 }];

// Tres misiones al día (una de cada nivel). `ev` es lo que cuenta; `unique` cuenta circuitos distintos.
export const MISSIONS = {
  easy: { pts: 50, pool: [
    { id: 'vueltas5', text: 'Completa 5 vueltas válidas', ev: 'lap', goal: 5 },
    { id: 'salidas3', text: 'Sal a pista 3 veces', ev: 'session', goal: 3 },
    { id: 'practica', text: 'Termina una práctica del reto diario', ev: 'practice', goal: 1 },
  ] },
  medium: { pts: 80, pool: [
    { id: 'vueltas15', text: 'Completa 15 vueltas válidas', ev: 'lap', goal: 15 },
    { id: 'circuitos2', text: 'Rueda en 2 circuitos distintos', ev: 'lap', goal: 2, unique: true },
  ] },
  hard: { pts: 120, pool: [
    { id: 'marca', text: 'Mejora tu mejor vuelta en un circuito', ev: 'pb', goal: 1 },
    { id: 'clasificar', text: 'Marca un tiempo en la clasificación del reto', ev: 'quali', goal: 1 },
    { id: 'vueltas30', text: 'Completa 30 vueltas válidas', ev: 'lap', goal: 30 },
  ] },
};
export const ALL_MISSIONS_BONUS = { gems: 3 };

const KEY = 'dr.wallet';
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const prevDay = (k) => new Date(Date.parse(k + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
const SLOTS = ['paint', 'decal', 'kart', 'suit'];
const blank = () => ({ v: 2, pts: 0, gems: 0, owned: {}, look: {}, boxDay: null, streak: { day: null, n: 0 }, missions: null });

// unlockAll(): la cuenta con código lo tiene todo puesto a su disposición, sin tocar lo conseguido de verdad
export function createEconomy({ storage, dayKey, random = Math.random, unlockAll = () => false }) {
  let st;
  try { st = { ...blank(), ...(JSON.parse(storage.getItem(KEY)) || {}) }; } catch (_) { st = blank(); }
  if (st.paint) { st.look = { ...st.look, paint: st.paint }; delete st.paint; } // saldo guardado con la versión anterior
  const has = (id) => !!itemById(id) && (unlockAll() || !!st.owned[id]);
  const listeners = [];
  const save = () => { try { storage.setItem(KEY, JSON.stringify(st)); } catch (_) { /* sin almacenamiento */ } for (const f of listeners) f(); };
  const give = (r = {}) => { st.pts += r.pts || 0; st.gems += r.gems || 0; };
  const canPay = (c) => !c || (st.pts >= (c.pts || 0) && st.gems >= (c.gems || 0));
  const pay = (c) => { st.pts -= (c && c.pts) || 0; st.gems -= (c && c.gems) || 0; };

  // ---------- cajas ----------
  function pickRow(table) {
    let x = random() * table.reduce((n, r) => n + r[1], 0);
    for (const r of table) { x -= r[1]; if (x < 0) return r[0]; }
    return table[table.length - 1][0];
  }
  function prizeFrom(row) {
    const [kind, amount] = row.split(':');
    if (kind === 'pts' || kind === 'gems') return { kind, amount: +amount, rarity: kind === 'gems' ? 'rare' : +amount >= 250 ? 'rare' : 'common' };
    const pool = ITEMS.filter((i) => i.rarity === kind);
    return { kind: 'item', item: pool[Math.floor(random() * pool.length)], rarity: kind };
  }
  const dailyReady = () => st.boxDay !== dayKey();
  const canOpen = (id) => (id === 'daily' ? dailyReady() : canPay(BOXES[id].cost));
  // El premio se decide y se guarda ANTES de la animación: cerrarla a medias no lo pierde ni permite repetir.
  function openBox(id) {
    const box = BOXES[id]; if (!box || !canOpen(id)) return null;
    if (id === 'daily') st.boxDay = dayKey(); else pay(box.cost);
    const prize = prizeFrom(pickRow(box.table));
    if (prize.kind === 'item') {
      if (st.owned[prize.item.id]) { prize.dup = RARITY[prize.rarity].dup; st.pts += prize.dup; }
      else st.owned[prize.item.id] = 1;
    } else give({ [prize.kind]: prize.amount });
    save(); return prize;
  }
  // La tira de la ruleta sale de las mismas probabilidades que el premio: no se amañan los «casi».
  function reel(id, prize, length = 48, at = 40) {
    const out = Array.from({ length }, () => prizeFrom(pickRow(BOXES[id].table)));
    out[at] = prize; return out;
  }

  // ---------- tienda ----------
  // tres ofertas que cambian cada día: una común, una rara y una épica (las legendarias solo salen en cajas)
  const offers = () => ['common', 'rare', 'epic'].map((r) => { const pool = ITEMS.filter((i) => i.rarity === r); return pool[hash(dayKey() + r) % pool.length]; });
  function buy(id) {
    const it = itemById(id); if (!it || has(id) || !offers().some((o) => o.id === id)) return false;
    const price = RARITY[it.rarity].price; if (!canPay(price)) return false;
    pay(price); st.owned[id] = 1; save(); return true;
  }
  // pone un objeto; elegir color o calcomanía vuelve al Kart de alquiler, que es el único que los lleva
  function equip(id) {
    const it = itemById(id); if (!it || !SLOTS.includes(it.type) || !has(id)) return false;
    st.look = { ...st.look, [it.type]: id }; if (it.type === 'paint' || it.type === 'decal') delete st.look.kart;
    save(); return true;
  }
  const unequip = (slot) => { if (!SLOTS.includes(slot)) return; delete st.look[slot]; save(); };
  const look = () => Object.fromEntries(SLOTS.map((s) => [s, st.look[s] && has(st.look[s]) ? itemById(st.look[s]) : null]));
  const owned = () => ITEMS.filter((i) => has(i.id));

  // ---------- racha ----------
  function streak() {
    const today = dayKey(), claimed = st.streak.day === today, alive = claimed || st.streak.day === prevDay(today);
    const done = alive ? st.streak.n : 0; // días seguidos ya cobrados
    const next = claimed ? done : done + 1;
    const cycle = Math.floor((next - 1) / 7) * 7; // primer día del ciclo de siete que se está mostrando
    return { claimed, days: done, today: (next - 1) % 7, cells: STREAK.map((r, i) => ({ ...r, done: done - cycle > i, now: !claimed && (next - 1) % 7 === i })) };
  }
  function claimStreak() {
    const s = streak(); if (s.claimed) return null;
    const n = s.days + 1, reward = STREAK[(n - 1) % 7];
    st.streak = { day: dayKey(), n }; give(reward); save(); return reward;
  }

  // ---------- misiones ----------
  function today() {
    const day = dayKey();
    if (!st.missions || st.missions.day !== day) {
      const used = new Set(), kind = (d) => (d.unique ? 'circuitos' : d.ev); // nunca dos de la misma clase el mismo día
      const list = Object.entries(MISSIONS).map(([level, m]) => { const free = m.pool.filter((d) => !used.has(kind(d))), pool = free.length ? free : m.pool, d = pool[hash(day + level) % pool.length]; used.add(kind(d)); return { level, id: d.id, n: 0, seen: [], claimed: false }; });
      st.missions = { day, list, bonus: false }; save();
    }
    return st.missions;
  }
  const def = (m) => MISSIONS[m.level].pool.find((x) => x.id === m.id);
  const missions = () => today().list.map((m) => { const d = def(m); return { level: m.level, text: d.text, goal: d.goal, n: Math.min(m.n, d.goal), done: m.n >= d.goal, claimed: m.claimed, pts: MISSIONS[m.level].pts }; });
  // suma un suceso de la partida; devuelve las misiones que se acaban de completar
  function track(ev, data = {}) {
    const finished = []; let changed = false;
    for (const m of today().list) {
      const d = def(m); if (!d || d.ev !== ev || m.n >= d.goal) continue;
      if (d.unique) { if (!data.track || m.seen.includes(data.track)) continue; m.seen.push(data.track); }
      m.n++; changed = true; if (m.n >= d.goal) finished.push(d.text);
    }
    if (changed) save();
    return finished;
  }
  function claimMission(level) {
    const t = today(), m = t.list.find((x) => x.level === level); if (!m || m.claimed || m.n < def(m).goal) return null;
    m.claimed = true; const reward = { pts: MISSIONS[level].pts };
    if (!t.bonus && t.list.every((x) => x.claimed)) { t.bonus = true; reward.gems = ALL_MISSIONS_BONUS.gems; }
    give(reward); save(); return reward;
  }
  const pending = () => (streak().claimed ? 0 : 1) + missions().filter((m) => m.done && !m.claimed).length;

  return {
    get pts() { return st.pts; }, get gems() { return st.gems; },
    has, owned, look, equip, unequip,
    canOpen, dailyReady, openBox, reel, offers, buy,
    streak, claimStreak, missions, track, claimMission, pending,
    onChange: (f) => listeners.push(f),
    // solo para el modo de pruebas
    test: { give: (r) => { give(r); save(); }, newBox: () => { st.boxDay = null; save(); }, reset: () => { st = blank(); save(); } },
  };
}
