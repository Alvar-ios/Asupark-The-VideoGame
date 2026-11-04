// Clasificaciones por circuito. Con Supabase configurado (config.js) los tiempos se comparten entre jugadores;
// sin configurar, el juego sigue funcionando con los tiempos locales. Cada fila guarda con qué coche se hizo el tiempo.
const KEY_PLAYER = 'dr.player', KEY_QUEUE = 'dr.lbq';
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
export const cleanName = (n) => String(n || '').replace(/[^\p{L}\p{N} ._\-]/gu, '').trim().slice(0, 20);

export class Leaderboard {
  constructor() {
    let p = load(KEY_PLAYER, null);
    if (!p || !p.id) { p = { id: uuid(), name: 'Piloto' + String(Math.floor(Math.random() * 900) + 100) }; save(KEY_PLAYER, p); }
    this.player = p; this.sending = false;
  }
  get cfg() { return (typeof window !== 'undefined' && window.DRIFT_CONFIG) || {}; }
  get remote() { return !!(this.cfg.supabaseUrl && this.cfg.supabaseKey); }
  get name() { return this.player.name; }
  get flag() { return /^[a-z]{2}$/.test(this.player.flag || '') ? this.player.flag : 'es'; }
  get helmet() { return /^([0-9a-f]{6}\|){3}[0-9]$/i.test(this.player.helmet || '') ? this.player.helmet : 'e63946|ffffff|111827|1'; }
  setFlag(f) { if (/^[a-z]{2}$/.test(f)) { this.player.flag = f; save(KEY_PLAYER, this.player); } return this.flag; }
  setHelmet(h) { if (/^([0-9a-f]{6}\|){3}[0-9]$/i.test(h)) { this.player.helmet = h; save(KEY_PLAYER, this.player); } return this.helmet; }
  setName(n) { const c = cleanName(n); if (c.length >= 2) { this.player.name = c; save(KEY_PLAYER, this.player); } return this.player.name; }
  async call(path, init = {}) {
    const c = this.cfg, ac = new AbortController(), to = setTimeout(() => ac.abort(), 7000);
    try {
      const r = await fetch(c.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, { ...init, signal: ac.signal, headers: { apikey: c.supabaseKey, Authorization: 'Bearer ' + c.supabaseKey, 'Content-Type': 'application/json', ...(init.headers || {}) } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text(); return t ? JSON.parse(t) : null;
    } finally { clearTimeout(to); }
  }
  // Envía un tiempo (ms). Con fantasma (ghost) lo guarda junto al tiempo si la base de datos ya tiene la función submit_lap_ghost
  // (supabase/ghost-migration.sql). Si no, o si falla la red, se envía solo el tiempo y queda en cola.
  async submit(trackId, carId, ms, ghost) {
    if (ghost && this.remote && this.ghostOk !== false) {
      try {
        await this.call('rpc/submit_lap_ghost', { method: 'POST', body: JSON.stringify({ p_player: this.player.id, p_name: this.player.name, p_track: trackId, p_car: carId, p_ms: ms, p_ghost: ghost }) });
        this.ghostOk = true; return true;
      } catch (e) { this.ghostOk = false; }
    }
    const q = load(KEY_QUEUE, []).filter((e) => !(e.trackId === trackId && e.carId === carId && e.ms >= ms));
    q.push({ trackId, carId, ms }); save(KEY_QUEUE, q.slice(-60));
    return this.flush();
  }
  async flush() {
    if (!this.remote || this.sending) return false;
    this.sending = true;
    try {
      let q = load(KEY_QUEUE, []);
      while (q.length) {
        const e = q[0];
        await this.call('rpc/submit_lap', { method: 'POST', body: JSON.stringify({ p_player: this.player.id, p_name: this.player.name, p_track: e.trackId, p_car: e.carId, p_ms: e.ms }) });
        q = q.slice(1); save(KEY_QUEUE, q);
      }
      return true;
    } catch (e) { return false; } finally { this.sending = false; }
  }
  // Fantasma del mejor tiempo de una categoría (coches carIds) en el circuito, entre todos los jugadores: { time (s), car, ghost } o null
  async bestGhost(trackId, carIds, sinceIso) {
    if (!this.remote || !carIds || !carIds.length) return null;
    try {
      const cars = carIds.map((c) => encodeURIComponent(c)).join(',');
      const since = sinceIso ? `&updated_at=gte.${encodeURIComponent(sinceIso)}` : '';
      const q = this.call(`lap_times?select=car_id,lap_ms,ghost&track_id=eq.${encodeURIComponent(trackId)}&car_id=in.(${cars})&ghost=not.is.null${since}&order=lap_ms.asc&limit=1`);
      const wait = new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 2500));
      const rows = await Promise.race([q, wait]);
      const r = rows && rows[0];
      return r && Array.isArray(r.ghost) && r.ghost.length > 8 ? { time: r.lap_ms / 1000, car: r.car_id, ghost: r.ghost } : null;
    } catch (e) { return null; }
  }
  // Todas las filas de un circuito (mejor tiempo de cada piloto con cada coche); el juego las agrupa por categoría
  async all(trackId) {
    if (!this.remote) return { remote: false, rows: [] };
    try {
      await this.flush();
      const rows = await this.call(`lap_times?select=player_id,name,car_id,lap_ms,updated_at&track_id=eq.${encodeURIComponent(trackId)}&order=lap_ms.asc&limit=1000`);
      return { remote: true, rows: (rows || []).map((r) => ({ key: r.player_id, name: r.name, carId: r.car_id, ms: r.lap_ms, at: r.updated_at, you: r.player_id === this.player.id })) };
    } catch (e) { return { remote: true, error: true, rows: [] }; }
  }
}
