// Cuentas con Supabase Auth: usuario + contraseña (el usuario se convierte en usuario@driftrush.game; requiere "Confirm email" desactivado).
// Toda la lógica de perfil, amigos y estadísticas está en funciones RPC de la base de datos (supabase/accounts.sql) que identifican al jugador con auth.uid().
const KEY = 'dr.session', DOMAIN = '@driftrush.game';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const save = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } };
export const cleanUser = (u) => String(u || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

export class Account {
  constructor(lb) { this.lb = lb; this.session = load(); this.profile = null; this.listeners = []; this.lb.onChange = () => this.pushProfile(); }
  get cfg() { return (typeof window !== 'undefined' && window.DRIFT_CONFIG) || {}; }
  get enabled() { return !!(this.cfg.supabaseUrl && this.cfg.supabaseKey); }
  get loggedIn() { return !!(this.session && this.session.user); }
  get username() { return this.profile ? this.profile.username : (this.session && this.session.username) || ''; }
  onChange(fn) { this.listeners.push(fn); }
  emit() { for (const f of this.listeners) try { f(); } catch (e) { /* UI */ } }
  async http(path, init = {}, token) {
    const c = this.cfg, ac = new AbortController(), to = setTimeout(() => ac.abort(), 9000);
    try {
      const r = await fetch(c.supabaseUrl.replace(/\/$/, '') + path, { ...init, signal: ac.signal, headers: { apikey: c.supabaseKey, Authorization: 'Bearer ' + (token || c.supabaseKey), 'Content-Type': 'application/json', ...(init.headers || {}) } });
      const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* no JSON */ }
      if (!r.ok) { const m = j && (j.msg || j.message || j.error_description || j.error) || 'HTTP ' + r.status; const err = new Error(String(m)); err.status = r.status; throw err; }
      return j;
    } finally { clearTimeout(to); }
  }
  explain(e) {
    const m = String((e && e.message) || e);
    if (/Invalid login/i.test(m)) return 'Usuario o contraseña incorrectos';
    if (/already registered|already been registered/i.test(m)) return 'Ese usuario ya existe';
    if (/at least 6/i.test(m)) return 'La contraseña necesita al menos 6 caracteres';
    if (/abort|Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor';
    if (/duplicate key|profiles_username/i.test(m)) return 'Ese usuario ya existe';
    return m;
  }
  setSession(j, username) {
    this.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id }, username: username || (this.session && this.session.username) };
    save(this.session);
  }
  async token() {
    if (!this.loggedIn) return null;
    if (Date.now() > this.session.expires_at - 60000) {
      try { const j = await this.http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: this.session.refresh_token }) }); this.setSession(j); }
      catch (e) { if (e.status === 400 || e.status === 401) { this.signOut(); } return null; }
    }
    return this.session.access_token;
  }
  // Peticiones idénticas en vuelo se unifican (doble toque, reintentos): una sola llega al servidor.
  rpc(name, args = {}, authed = true) {
    this._fl = this._fl || new Map(); const k = name + '|' + authed + '|' + JSON.stringify(args);
    if (this._fl.has(k)) return this._fl.get(k);
    const p = (async () => {
      const t = authed ? await this.token() : null;
      if (authed && !t) throw new Error('Sesión caducada: vuelve a entrar');
      return await this.http('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args) }, t);
    })();
    this._fl.set(k, p); p.then(() => this._fl.delete(k), () => this._fl.delete(k)); return p;
  }
  // Datos en caché al instante y refresco en segundo plano (stale-while-revalidate). onData(datos, esCaché).
  cacheKey(name, args) { return 'dr.c.' + (this.session ? String(this.session.user.id).slice(0, 8) : 'x') + '.' + name + '.' + JSON.stringify(args || {}); }
  cached(name, args = {}) { try { const j = localStorage.getItem(this.cacheKey(name, args)); return j === null ? undefined : JSON.parse(j); } catch (_) { return undefined; } }
  async swr(name, args, onData) {
    const c = this.cached(name, args); if (c !== undefined) onData(c, true);
    const fresh = await this.rpc(name, args);
    try { localStorage.setItem(this.cacheKey(name, args), JSON.stringify(fresh === undefined ? null : fresh)); } catch (_) { /* sin espacio */ }
    if (c === undefined || JSON.stringify(c) !== JSON.stringify(fresh)) onData(fresh, false);
    return fresh;
  }
  async usernameFree(u) { return await this.rpc('username_available', { p: u }, false); }
  async signUp(username, password) {
    const u = cleanUser(username);
    if (u.length < 3) throw new Error('El usuario necesita 3-20 letras minúsculas, números o _');
    if (!(await this.usernameFree(u))) throw new Error('Ese usuario ya existe');
    const j = await this.http('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: u + DOMAIN, password }) });
    if (!j || !j.access_token) throw new Error('Registro sin sesión: hay que desactivar "Confirm email" en Supabase');
    this.setSession(j, u);
    await this.rpc('create_profile', { p_username: u, p_flag: this.lb.flag, p_helmet: this.lb.helmet });
    await this.refreshProfile(); return this.profile;
  }
  async signIn(username, password) {
    const u = cleanUser(username);
    const j = await this.http('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: u + DOMAIN, password }) });
    this.setSession(j, u); await this.refreshProfile();
    if (!this.profile) { await this.rpc('create_profile', { p_username: u, p_flag: this.lb.flag, p_helmet: this.lb.helmet }); await this.refreshProfile(); } // cuenta creada sin perfil (registro interrumpido)
    return this.profile;
  }
  signOut() { try { Object.keys(localStorage).filter((k) => k.startsWith('dr.c.')).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* nada */ } this.session = null; this.profile = null; save(null); this.lb.leaveAccount(); this.emit(); }
  async refreshProfile() {
    if (!this.loggedIn) return null;
    const st = await this.rpc('user_stats', { p_user: this.session.user.id }, false);
    if (!st) { this.profile = null; return null; } // cuenta sin perfil
    this.profile = st; this.lb.useAccount({ id: st.user_id, name: st.username, flag: st.flag, helmet: st.helmet }); this.emit(); return st;
  }
  async restore() { if (this.loggedIn && this.enabled) { try { await this.refreshProfile(); } catch (e) { /* sin red: se reintenta al abrir el perfil */ } } }
  async pushProfile() { if (!this.loggedIn || !this.lb.account) return; try { await this.rpc('update_profile', { p_flag: this.lb.flag, p_helmet: this.lb.helmet }); } catch (e) { /* se reintenta en el siguiente cambio */ } }
  async submitResult(trackId, carId, pos, field) { if (!this.loggedIn) return; try { await this.rpc('submit_result', { p_track: trackId, p_car: carId, p_pos: pos, p_field: field }); } catch (e) { /* no crítico */ } }
  friends() { return this.rpc('my_friends'); }
  addFriend(u) { return this.rpc('friend_request', { p_username: cleanUser(u) }); }
  respond(id, ok) { return this.rpc('friend_respond', { p_user: id, p_accept: ok }); }
  rivalry(id) { return this.rpc('rivalry', { p_friend: id }); }
  stats(id) { return this.rpc('user_stats', { p_user: id }, false); }
  hall() { return this.rpc('hall', {}, false); }
}
