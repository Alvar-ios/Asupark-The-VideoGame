// Pruebas de la economía: probabilidades, cobros, caja diaria, racha y misiones.
import assert from 'node:assert/strict';
import { createEconomy, BOXES, ITEMS, RARITY, STREAK } from '../src/economy.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
let day = '2026-03-02';
const next = (k = day) => new Date(Date.parse(k + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
let seed = 7; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const make = (storage = memory()) => createEconomy({ storage, dayKey: () => day, random });

for (const b of Object.values(BOXES)) assert.ok(Math.abs(b.table.reduce((n, r) => n + r[1], 0) - 100) < 1e-9, `las probabilidades de ${b.id} suman 100`);
assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length, 'sin identificadores repetidos');
for (const i of ITEMS) { assert.ok(RARITY[i.rarity], i.id); if (i.type === 'helmet') assert.match(i.helmet, /^([0-9a-f]{6}\|){3}[0-9]$/i, 'formato de casco que admite el servidor: ' + i.id); }

// caja diaria: una al día, y se guarda
{
  const s = memory(), e = make(s);
  assert.ok(e.dailyReady()); assert.ok(e.openBox('daily')); assert.equal(e.openBox('daily'), null, 'no se abre dos veces');
  assert.equal(make(s).dailyReady(), false, 'recargar no la devuelve');
  day = next(); assert.ok(e.dailyReady(), 'al día siguiente vuelve');
}
// cajas de pago: sin saldo no se abren; con saldo cobran; repetidos devuelven puntos
{
  const e = make();
  assert.equal(e.openBox('pit'), null); assert.equal(e.openBox('podium'), null);
  e.test.give({ pts: 600 }); const p = e.openBox('pit'); assert.equal(p.kind, 'item'); assert.equal(e.pts, 0); assert.ok(e.has(p.item.id));
  let dups = 0; for (let i = 0; i < 400; i++) { e.test.give({ pts: 600 }); const before = e.pts, r = e.openBox('pit'); if (r.dup) { dups++; assert.equal(e.pts, before - 600 + RARITY[r.rarity].dup); } else assert.equal(e.pts, before - 600); }
  assert.ok(dups > 0); assert.ok(e.pts >= 0);
}
// no sale nada repetido mientras quede algo de esa rareza sin conseguir
{
  const e = make(), got = new Set();
  for (let i = 0; i < 600; i++) {
    e.test.give({ pts: 600 }); const r = e.openBox('pit'), left = ITEMS.filter((x) => x.rarity === r.rarity && !got.has(x.id));
    if (left.length) { assert.ok(!r.dup, 'repetido quedando ' + left.length + ' de ' + r.rarity); assert.ok(!got.has(r.item.id)); } else assert.equal(r.dup, RARITY[r.rarity].dup);
    got.add(r.item.id);
  }
  assert.equal(got.size, ITEMS.length, 'con cajas suficientes se consigue todo');
}
// las frecuencias reales siguen la tabla
{
  const e = make(), count = {}, N = 60000;
  for (let i = 0; i < N; i++) { e.test.give({ gems: 60 }); const r = e.openBox('podium'); count[r.rarity] = (count[r.rarity] || 0) + 1; }
  for (const [r, pct] of BOXES.podium.table) assert.ok(Math.abs((count[r] || 0) / N * 100 - pct) < 1, `${r}: ${(count[r] / N * 100).toFixed(2)} % frente a ${pct} %`);
}
// la ruleta acaba en el premio
{ const e = make(); const p = e.openBox('daily'); const r = e.reel('daily', p, 48, 40); assert.equal(r.length, 48); assert.equal(r[40], p); }
// racha: sube cada día, el séptimo da gemas, fallar un día la reinicia
{
  const e = make(); day = '2026-04-01';
  for (let i = 0; i < 9; i++) { assert.equal(e.streak().claimed, false); assert.deepEqual(e.claimStreak(), STREAK[i % 7]); assert.equal(e.claimStreak(), null); day = next(); }
  assert.equal(e.gems, 10); assert.equal(e.streak().days, 9);
  day = next(); assert.equal(e.streak().days, 0, 'un día sin entrar rompe la racha'); assert.deepEqual(e.claimStreak(), STREAK[0]);
}
// la fila de siete casillas marca bien lo cobrado
{
  const e = make(); day = '2026-05-01';
  for (let i = 0; i < 7; i++) { e.claimStreak(); if (i < 6) day = next(); }
  assert.equal(e.streak().cells.filter((c) => c.done).length, 7, 'el séptimo día se ven las siete cobradas');
  day = next(); const s = e.streak(); assert.equal(s.cells.filter((c) => c.done).length, 0, 'empieza ciclo nuevo'); assert.ok(s.cells[0].now);
}
// misiones: tres al día, se cobran una vez y las tres dan gemas
{
  const e = make(); day = '2026-06-10';
  assert.equal(e.missions().length, 3); assert.equal(e.claimMission('easy'), null, 'no se cobra sin completarla');
  for (let i = 0; i < 40; i++) { e.track('lap', { track: i % 2 ? 'a' : 'b' }); e.track('session'); }
  e.track('practice'); e.track('pb'); e.track('quali');
  assert.ok(e.missions().every((m) => m.done), JSON.stringify(e.missions()));
  const a = e.claimMission('easy'), b = e.claimMission('medium'), c = e.claimMission('hard');
  assert.equal(a.pts + b.pts + c.pts, 250); assert.equal(c.gems, 3); assert.equal(e.claimMission('hard'), null);
  assert.equal(e.pts, 250); assert.equal(e.gems, 3);
  day = next(); assert.ok(e.missions().every((m) => m.n === 0), 'se renuevan cada día');
}
// en un año entero nunca salen dos misiones de la misma clase
{
  const e = make(), seen = new Set(); day = '2026-07-01';
  for (let i = 0; i < 365; i++) {
    const t = e.missions().map((m) => m.text); t.forEach((x) => seen.add(x));
    assert.ok(t.filter((x) => /^Completa d+ vueltas/.test(x)).length <= 1, day + ': ' + t.join(' | ')); day = next();
  }
  assert.ok(seen.size >= 7, 'salen casi todas las misiones: ' + seen.size);
}
// ofertas y compra
{
  const e = make(); const [first] = e.offers(); assert.equal(e.offers().length, 3);
  assert.equal(e.buy(first.id), false, 'sin saldo no compra'); e.test.give({ pts: 5000 }); assert.equal(e.buy(first.id), true); assert.equal(e.buy(first.id), false, 'no se compra dos veces');
  assert.equal(e.buy('p-oro'), false, 'las legendarias no se venden');
  assert.equal(e.equip('p-oro'), false, 'no se puede poner lo que no se tiene');
}
// de salida no se tiene ningún color; al elegir un color se vuelve al kart de alquiler
{
  const e = make(); assert.equal(e.owned().length, 0); assert.equal(e.equip('c-azul'), false);
  const all = createEconomy({ storage: memory(), dayKey: () => day, random, unlockAll: () => true });
  assert.equal(all.owned().length, ITEMS.length, 'con el código está todo');
  assert.ok(all.equip('k-estandar')); assert.equal(all.look().kart.skin, 'estandar');
  assert.ok(all.equip('d-llamas')); assert.equal(all.look().kart, null); assert.equal(all.look().decal.decal, 'llamas');
  assert.ok(all.equip('c-azul')); all.unequip('decal'); assert.equal(all.look().decal, null); assert.equal(all.look().paint.id, 'c-azul');
}
// lo desbloqueado por código no se queda al quitar el código
{
  const s = memory(); let on = true; const e = createEconomy({ storage: s, dayKey: () => day, random, unlockAll: () => on });
  e.equip('k-estandar'); on = false; assert.equal(e.look().kart, null); assert.equal(e.has('k-estandar'), false);
}
// el saldo de la versión anterior conserva la pintura puesta
{
  const s = memory(); s.setItem('dr.wallet', JSON.stringify({ v: 1, pts: 5, gems: 0, owned: { 'p-cromo': 1 }, paint: 'p-cromo', streak: { day: null, n: 0 } }));
  assert.equal(make(s).look().paint.id, 'p-cromo');
}
console.log('Economía: todo correcto');
