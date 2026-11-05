// Música del juego: temas grabados de TeteCovers (mp3). Se descargan al abrir el juego (el primero) y el siguiente se prepara mientras suena el actual.
// El volumen baja muy suave al final de cada tema y el siguiente entra solapado, sin silencios. Al entrar o salir de un circuito la música no se corta: solo se atenúa.
// [archivo, título, autor]. Sin autor conocido => TeteCovers. Todas llevan un fade-out de 2 s grabado en el propio mp3.
const COVERS = [
  ['borja-rinon-piano', 'Borja Riñón on the Piano', 'TeteCovers'],
  ['calamare-m40', 'Calamare en la M40', 'El Patica'],
  ['drifting-baptism', 'Drifting after Baptism', 'TeteCovers'],
  ['paco-galaxia', 'Paco Galaxia', 'TeteCovers'],
  ['roadtrip-boyberry', 'Roadtrip a la BoyBerry', 'Trakatrá'],
  ['susurro-bruno-perez', 'Susurro de Bruno Pérez', 'TeteCovers'],
  ['night-abalos', 'Night with Ábalos', 'Koldo'],
  ['green-machine', 'My Green Machine', 'TeteCovers'],
  ['jalando-arepas', 'Jalando Arepas en el Carro', 'Federico Cojones'],
  ['i-love-mal', 'I Love Mal', 'TeteCovers'],
  ['fan-bokeron', 'Fan del Bokerón', 'TeteCovers'],
  ['coffee-cigarette', 'Coffee and Cigarette Clay Puppet', 'TeteCovers'],
  ['ceuta-beat', 'Ceuta Beat', 'Peter Sánchez'],
  ['aitana-intermitentes', 'Aitana No Pone Intermitentes', 'TeteCovers'],
  ['upshifting-2-3', 'Upshifting from 2 to 3', 'TeteCovers'],
  ['summer-chipiona', 'Summer in Chipiona', 'El Cigala'],
];
export const SONGS = COVERS.map(([f, name, author]) => ({ tag: 'TeteCovers', name, author, file: `assets/music/${f}.mp3` }));
const raw = {}; // arrayBuffers ya pedidos (promesas)
const fetchRaw = (idx) => raw[idx] || (raw[idx] = fetch(SONGS[idx].file).then((r) => { if (!r.ok) throw new Error('mp3'); return r.arrayBuffer(); }).catch((e) => { delete raw[idx]; throw e; }));
const FIRST = Math.floor(Math.random() * SONGS.length);
try { fetchRaw(FIRST); } catch (_) { /* sin red: se reintenta luego */ }
const FADE_OUT = 6, OVERLAP = 2.5, FADE_IN = 1.6;

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx; this.playing = false; this.muted = false; this.vol = 0.55; this.songIdx = FIRST; this.bufs = {}; this.dec = {}; this.cur = null; this.gen = 0; this.onSong = null;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
  }
  setVolume(v) { this.vol = v; if (this.playing && !this.muted) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  load(idx) {
    if (this.bufs[idx]) return Promise.resolve(this.bufs[idx]);
    if (this.dec[idx]) return this.dec[idx];
    this.dec[idx] = fetchRaw(idx).then((ab) => new Promise((ok, ko) => this.ctx.decodeAudioData(ab.slice(0), ok, ko))).then((b) => (this.bufs[idx] = b));
    this.dec[idx].catch(() => { delete this.dec[idx]; });
    return this.dec[idx];
  }
  pickNext(cur) { if (SONGS.length < 2) return 0; let n; do n = Math.floor(Math.random() * SONGS.length); while (n === cur); return n; }
  // arranca (o reanuda) la música. Si ya estaba sonando solo recupera el volumen: nunca reinicia el tema
  start() {
    const c = this.ctx; this.muted = false;
    this.out.gain.cancelScheduledValues(c.currentTime); this.out.gain.setTargetAtTime(this.vol, c.currentTime, 0.8);
    if (this.playing) return; this.playing = true; this.playSong(this.songIdx, 0, true);
  }
  stop() { // atenúa sin cortar: el tema sigue por debajo y se recupera donde iba
    if (!this.playing || this.muted) return; this.muted = true; const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.5);
  }
  choose(idx) {
    if (!(idx >= 0 && idx < SONGS.length)) return;
    if (!this.playing) { this.songIdx = idx; return; }
    this.fadeOut(this.cur, 0.7); this.playSong(idx, 0, true);
  }
  fadeOut(c, dur) {
    if (!c) return; const t = this.ctx.currentTime; c.gen = -1; clearTimeout(c.timer);
    try { c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0, t + dur); c.src.stop(t + dur + 0.05); } catch (_) { /* ya parado */ }
  }
  // when: segundos desde ahora en que debe empezar (para solapar con el final del anterior)
  playSong(idx, when, announce) {
    const gen = ++this.gen; this.songIdx = idx;
    this.load(idx).then((buf) => {
      if (gen !== this.gen || !this.playing) return;
      const c = this.ctx, t0 = c.currentTime + Math.max(0.02, when), src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.connect(g); g.connect(this.out);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + FADE_IN);
      const dur = buf.duration, fo = t0 + dur - FADE_OUT, curve = new Float32Array(32);
      for (let i = 0; i < 32; i++) curve[i] = 0.5 + 0.5 * Math.cos((i / 31) * Math.PI); // bajada en coseno: muy suave
      g.gain.setValueAtTime(1, fo); g.gain.setValueCurveAtTime(curve, fo, FADE_OUT);
      src.start(t0); const rec = { src, g, gen, timer: 0 }; const prev = this.cur; this.cur = rec;
      if (prev && prev !== rec && prev.gen !== -1) this.fadeOut(prev, Math.max(0.5, when));
      if (announce !== false && this.onSong) { clearTimeout(this.annT); this.annT = setTimeout(() => { if (gen === this.gen && this.onSong && !this.muted) this.onSong(SONGS[idx]); }, Math.max(0, when * 1000)); }
      // el siguiente se prepara ya y entra solapado con el final de este
      const nxt = this.pickNext(idx); this.load(nxt).catch(() => {});
      rec.timer = setTimeout(() => { if (gen === this.gen && this.playing) this.playSong(nxt, OVERLAP, true); }, Math.max(1000, (when + dur - 2 * OVERLAP) * 1000));
    }).catch(() => { if (gen === this.gen && this.playing) setTimeout(() => this.playing && gen === this.gen && this.playSong(this.pickNext(idx), 0, true), 4000); });
  }
}
