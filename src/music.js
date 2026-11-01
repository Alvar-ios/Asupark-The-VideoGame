// Música original del menú, en estilo fusión japonés de los 80 (acordes de séptima/novena, bajo sincopado,
// piano eléctrico, lead sintetizado con eco y batería). Se sintetiza con WebAudio: no usa grabaciones ni temas ajenos.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Tres temas originales (estilo fusión japonés de los 80), cada uno con su personalidad.
export const SONGS = [
  { name: 'Cielo abierto', bpm: 126, swing: 0.06, chords: [[53, 57, 60, 64], [55, 59, 64, 65], [52, 55, 59, 62], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 65, 68], [55, 59, 62, 64], [55, 59, 62, 64]],
    roots: [41, 43, 40, 45, 38, 43, 36, 36], bass: [[0, 0, 2], [3, 0, 1], [6, 12, 1], [8, 0, 2], [10, 7, 1], [12, 0, 1], [14, 12, 1]], stabs: [0, 3, 6, 10, 13],
    kick: [0, 6, 10], kickOdd: [14], snare: [4, 12], hatEvery: 2, lead: 'saw',
    melody: [[[0, 76, 3], [4, 77, 1], [6, 79, 2], [10, 81, 2], [13, 79, 1], [14, 76, 2]], [[0, 79, 2], [3, 81, 1], [4, 83, 3], [8, 81, 2], [11, 79, 1], [12, 77, 4]], [[0, 76, 2], [3, 79, 1], [4, 83, 2], [8, 81, 1], [9, 79, 1], [10, 76, 2], [14, 74, 2]], [[0, 72, 2], [3, 76, 1], [4, 79, 3], [8, 83, 2], [11, 81, 1], [12, 79, 4]], [[0, 77, 3], [4, 76, 1], [6, 74, 2], [8, 72, 2], [11, 74, 1], [12, 77, 2], [14, 79, 2]], [[0, 80, 2], [3, 79, 1], [4, 77, 2], [6, 74, 2], [8, 71, 3], [12, 74, 2], [14, 77, 2]], [[0, 76, 4], [6, 79, 2], [8, 83, 3], [12, 81, 1], [13, 79, 1], [14, 76, 2]], [[0, 74, 2], [3, 76, 1], [4, 79, 6], [12, 77, 2], [14, 74, 2]]] },
  // Noche en autopista: más lento y melancólico, en La menor, con bajo pausado y melodía cantable
  { name: 'Noche en autopista', bpm: 104, swing: 0.11, chords: [[57, 60, 64, 67], [60, 66, 71, 64], [55, 59, 62, 66], [60, 64, 67, 71], [54, 57, 60, 64], [59, 63, 69, 72], [52, 55, 59, 62], [56, 62, 64, 68]],
    roots: [45, 38, 43, 36, 42, 47, 40, 40], bass: [[0, 0, 3], [6, 0, 1], [8, 7, 2], [12, 0, 1], [14, 12, 1]], stabs: [0, 6, 10, 14],
    kick: [0, 10], kickOdd: [7], snare: [4, 12], hatEvery: 2, lead: 'square',
    melody: [[[0, 76, 4], [6, 79, 2], [8, 81, 4], [14, 79, 2]], [[0, 78, 3], [4, 81, 2], [8, 83, 4], [14, 81, 2]], [[0, 79, 4], [6, 78, 2], [8, 74, 4], [14, 76, 2]], [[0, 76, 3], [4, 74, 1], [6, 71, 2], [8, 72, 6], [14, 74, 2]], [[0, 72, 3], [4, 76, 2], [8, 78, 4], [14, 76, 2]], [[0, 75, 2], [3, 78, 1], [4, 81, 4], [10, 78, 2], [12, 75, 4]], [[0, 74, 4], [6, 71, 2], [8, 79, 6], [14, 76, 2]], [[0, 76, 2], [3, 80, 1], [4, 83, 8], [14, 80, 2]]] },
  // Costa rápida: brillante y funky, en Re mayor, con bajo en semicorcheas
  { name: 'Costa rápida', bpm: 138, swing: 0.04, chords: [[54, 57, 61, 64], [52, 57, 59, 62], [56, 59, 64, 68], [57, 61, 64, 66], [62, 66, 69, 73], [56, 62, 64, 66], [56, 61, 64, 68], [57, 61, 66, 69]],
    roots: [38, 40, 37, 42, 47, 40, 45, 45], bass: [[0, 0, 1], [2, 0, 1], [3, 12, 1], [6, 0, 1], [8, 0, 1], [10, 7, 1], [11, 0, 1], [14, 12, 1]], stabs: [2, 4, 7, 10, 12, 15],
    kick: [0, 3, 8, 11], kickOdd: [6], snare: [4, 12], hatEvery: 1, lead: 'saw',
    melody: [[[0, 78, 2], [3, 81, 1], [4, 85, 3], [8, 83, 2], [11, 81, 1], [12, 78, 3]], [[0, 80, 2], [2, 83, 2], [4, 85, 2], [8, 83, 1], [9, 80, 1], [10, 76, 3], [14, 80, 2]], [[0, 80, 3], [4, 83, 1], [6, 85, 2], [8, 88, 3], [12, 85, 2], [14, 83, 2]], [[0, 81, 2], [3, 85, 1], [4, 84, 3], [8, 81, 2], [11, 78, 1], [12, 81, 4]], [[0, 85, 3], [4, 83, 1], [6, 81, 2], [8, 78, 3], [12, 81, 2], [14, 85, 2]], [[0, 83, 2], [3, 80, 1], [4, 78, 2], [6, 80, 2], [8, 83, 3], [12, 86, 2], [14, 83, 2]], [[0, 85, 4], [6, 88, 2], [8, 85, 3], [12, 84, 1], [13, 81, 1], [14, 80, 2]], [[0, 81, 2], [3, 85, 1], [4, 88, 6], [12, 85, 2], [14, 81, 2]]] },
];

export class Music {
  constructor(ctx, dest, noise) {
    this.ctx = ctx; this.noise = noise; this.playing = false; this.timer = 0; this.bufs = {}; this.pend = {}; this.src = null; this.vol = 0.55; this.songIdx = Math.floor(Math.random() * SONGS.length); this.song = SONGS[this.songIdx]; this.stepDur = 60 / this.song.bpm / 4;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.4;
    const fb = ctx.createGain(); fb.gain.value = 0.36; const wet = ctx.createGain(); wet.gain.value = 0.3;
    this.send = ctx.createGain(); this.send.gain.value = 1; this.send.connect(this.delay); this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.out);
  }
  setVolume(v) { this.vol = v; if (this.playing) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  // La música se pre-renderiza: cada tema se genera una vez en un OfflineAudioContext y se reproduce como un buffer.
  // Antes se programaban las notas en vivo desde el hilo principal; cuando el juego iba justo, las notas llegaban tarde (música lenta) y luego de golpe (rápida).
  render(idx) {
    if (this.bufs[idx]) return Promise.resolve(this.bufs[idx]);
    if (this.pend[idx]) return this.pend[idx];
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) return Promise.reject(new Error('sin OfflineAudioContext'));
    const S = SONGS[idx], ST = 60 / S.bpm / 4, steps = 256, sr = this.ctx.sampleRate, loopN = Math.round(steps * ST * sr), tailN = Math.round(2.6 * sr);
    const oc = new OC(2, loopN + tailN, sr), m = new Music(oc, oc.destination, this.noise);
    m.song = S; m.stepDur = ST; m.out.gain.value = 1; m.delay.delayTime.value = (60 / S.bpm) * 0.75;
    for (let st = 0; st < steps; st++) m.play(st, 0.02 + st * ST);
    this.pend[idx] = oc.startRendering().then((buf) => {
      const out = this.ctx.createBuffer(2, loopN, sr);
      for (let ch = 0; ch < 2; ch++) { const src = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1)), dst = out.getChannelData(ch); dst.set(src.subarray(0, loopN)); for (let k = 0; k < tailN && k < loopN; k++) dst[k] += src[loopN + k]; } // la cola del eco se pliega al principio: bucle sin cortes
      this.bufs[idx] = out; return out;
    });
    return this.pend[idx];
  }
  start() {
    if (this.playing) return; this.playing = true; const c = this.ctx;
    this.out.gain.cancelScheduledValues(c.currentTime); this.out.gain.setTargetAtTime(this.vol, c.currentTime, 0.6);
    this.songIdx = this.nextIdx != null && this.nextIdx !== this.songIdx ? this.nextIdx : this.pickNext(this.songIdx); this.nextIdx = null; this.playNext();
  }
  pickNext(cur) { if (SONGS.length < 2) return 0; let n; do n = Math.floor(Math.random() * SONGS.length); while (n === cur); return n; } // siempre una canción al azar, distinta de la actual
  playNext() {
    if (!this.playing) return; const idx = this.songIdx, c = this.ctx;
    const live = setTimeout(() => { if (this.playing && !this.src && !this.bufs[idx]) this.startLive(); }, 2500); // mientras se prepara el tema, suena en vivo
    this.render(idx).then((buf) => {
      clearTimeout(live); if (this.timer) { clearInterval(this.timer); this.timer = 0; }
      if (!this.playing || this.songIdx !== idx) return;
      const src = c.createBufferSource(); src.buffer = buf; src.connect(this.out); src.start(); this.src = src;
      src.onended = () => { if (this.src === src && this.playing) { this.songIdx = this.nextIdx != null ? this.nextIdx : this.pickNext(idx); this.nextIdx = null; this.playNext(); } };
      this.nextIdx = this.pickNext(idx); setTimeout(() => this.render(this.nextIdx).catch(() => {}), 2000); // el siguiente tema se prepara con calma
    }).catch(() => this.startLive());
  }
  startLive() { // respaldo si el navegador no puede pre-renderizar
    if (this.timer || !this.playing) return; this.step = 0; this.next = this.ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.tick(), 50); this.tick();
  }
  stop() {
    if (!this.playing) return; this.playing = false; const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.18);
    clearInterval(this.timer); this.timer = 0;
    if (this.src) { const s = this.src; this.src = null; s.onended = null; try { s.stop(t + 0.5); } catch (_) {} }
  }
  tick() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') { this.next = ctx.currentTime + 0.1; return; }
    // si el hilo principal se atasca (frame largo) y nos pasamos, no soltamos de golpe las notas atrasadas: eso sonaba a chasquido
    if (this.next < ctx.currentTime - 0.04) { this.next = ctx.currentTime + 0.06; this.step = Math.ceil(this.step / 2) * 2; }
    while (this.next < ctx.currentTime + 0.5) {
      if (this.step === 0) { this.song = SONGS[this.songIdx]; this.stepDur = 60 / this.song.bpm / 4; this.delay.delayTime.setValueAtTime((60 / this.song.bpm) * 0.75, this.next); }
      this.play(this.step, this.next); this.next += this.stepDur; this.step++;
      if (this.step >= 256) { this.step = 0; this.songIdx = this.pickNext(this.songIdx); } // al acabar un tema, pasa al siguiente
    }
  }
  play(step, t) {
    const S = this.song, ST = this.stepDur, bar = Math.floor(step / 16) % 8, s = step % 16, pass = Math.floor(step / 128); t += (s % 2) ? ST * S.swing : 0;
    // batería
    if (S.kick.includes(s) || (bar % 2 && S.kickOdd.includes(s))) this.kick(t, s === 0 ? 1 : 0.8);
    if (S.snare.includes(s)) this.snare(t, 0.9); else if (s === 15 && bar % 4 === 3) this.snare(t, 0.35);
    if (s % S.hatEvery === 0) this.hat(t, s % 4 === 2 ? 0.34 : 0.2, false); else if (s % 4 === 3) this.hat(t, 0.1, false);
    if (s === 14 && bar % 2 === 1) this.hat(t, 0.3, true);
    // bajo
    for (const [bs, iv, len] of S.bass) if (bs === s) this.bass(S.roots[bar] + iv, t, ST * len * 0.92);
    // piano eléctrico: acordes picados
    if (S.stabs.includes(s)) { const ch = S.chords[bar], vel = s === S.stabs[0] ? 1 : 0.72; for (const n of ch) this.epiano(n, t, ST * (s === 0 ? 3.2 : 1.5), 0.05 * vel); }
    // melodía (la segunda vuelta sube de registro)
    for (const [ms, note, len] of S.melody[bar]) if (ms === s) this.lead(note + (pass && note <= 79 ? 12 : 0), t, ST * len * 0.95, pass ? 0.075 : 0.065);
    if (pass && s % 4 === 1 && (bar === 3 || bar === 7)) this.epiano(S.chords[bar][(s >> 2) % 4] + 12, t, ST * 1.5, 0.028);
  }
  env(g, t, a, peak, dur, rel = 0.05) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.25), t + a + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel); }
  epiano(m, t, dur, v) {
    const c = this.ctx, f = mtof(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null;
    car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 14;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.06, t + 0.18); mod.connect(mg); mg.connect(car.frequency);
    const car2 = c.createOscillator(); car2.type = 'triangle'; car2.frequency.value = f; const g2 = c.createGain(); g2.gain.value = 0.35; car2.connect(g2); g2.connect(g);
    car.connect(g); this.env(g, t, 0.004, v, dur * 1.4, 0.25);
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.5; g.connect(pan); pan.connect(this.out); } else g.connect(this.out);
    for (const o of [car, mod, car2]) { o.start(t); o.stop(t + dur * 1.4 + 0.4); }
  }
  bass(m, t, dur) {
    const c = this.ctx, f = mtof(m), o = c.createOscillator(), sub = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; sub.type = 'sine'; o.frequency.value = f; sub.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.12);
    const sg = c.createGain(); sg.gain.value = 0.9; sub.connect(sg); sg.connect(g); o.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.006); g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    g.connect(this.out); o.start(t); sub.start(t); o.stop(t + dur + 0.3); sub.stop(t + dur + 0.3);
  }
  lead(m, t, dur, v) {
    const c = this.ctx, f = mtof(m), a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    a.type = this.song.lead === 'square' ? 'square' : 'sawtooth'; b.type = this.song.lead === 'square' ? 'triangle' : 'square'; a.frequency.value = f; b.frequency.value = f; a.detune.value = 6; b.detune.value = -7;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(14, t + Math.max(0.05, dur * 0.6)); lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(2300, t + dur); lp.Q.value = 1.2;
    const bg = c.createGain(); bg.gain.value = 0.45; a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    g.connect(this.out); g.connect(this.send); for (const o of [a, b, lfo]) { o.start(t); o.stop(t + dur + 0.4); }
  }
  kick(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.34 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.3);
  }
  noiseBurst(t, dur, type, freq, q, vol) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  snare(t, v) { this.noiseBurst(t, 0.17, 'bandpass', 1900, 0.8, 0.2 * v); const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); g.gain.setValueAtTime(0.14 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.15); }
  hat(t, v, open) { this.noiseBurst(t, open ? 0.2 : 0.045, 'highpass', 7200, 0.7, 0.1 * v); }
}
