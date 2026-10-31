// Música original del menú, en estilo fusión japonés de los 80 (acordes de séptima/novena, bajo sincopado,
// piano eléctrico, lead sintetizado con eco y batería). Se sintetiza con WebAudio: no usa grabaciones ni temas ajenos.
const BPM = 126, STEP = 60 / BPM / 4;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// 8 compases: Fmaj7 | G13 | Em7 | Am9 | Dm9 | G7b9 | Cmaj9 | Cmaj9
const CHORDS = [[53, 57, 60, 64], [55, 59, 64, 65], [52, 55, 59, 62], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 65, 68], [55, 59, 62, 64], [55, 59, 62, 64]];
const ROOTS = [41, 43, 40, 45, 38, 43, 36, 36];
const BASS = [[0, 0, 2], [3, 0, 1], [6, 12, 1], [8, 0, 2], [10, 7, 1], [12, 0, 1], [14, 12, 1]];
const STABS = [0, 3, 6, 10, 13];
const MELODY = [
  [[0, 76, 3], [4, 77, 1], [6, 79, 2], [10, 81, 2], [13, 79, 1], [14, 76, 2]],
  [[0, 79, 2], [3, 81, 1], [4, 83, 3], [8, 81, 2], [11, 79, 1], [12, 77, 4]],
  [[0, 76, 2], [3, 79, 1], [4, 83, 2], [8, 81, 1], [9, 79, 1], [10, 76, 2], [14, 74, 2]],
  [[0, 72, 2], [3, 76, 1], [4, 79, 3], [8, 83, 2], [11, 81, 1], [12, 79, 4]],
  [[0, 77, 3], [4, 76, 1], [6, 74, 2], [8, 72, 2], [11, 74, 1], [12, 77, 2], [14, 79, 2]],
  [[0, 80, 2], [3, 79, 1], [4, 77, 2], [6, 74, 2], [8, 71, 3], [12, 74, 2], [14, 77, 2]],
  [[0, 76, 4], [6, 79, 2], [8, 83, 3], [12, 81, 1], [13, 79, 1], [14, 76, 2]],
  [[0, 74, 2], [3, 76, 1], [4, 79, 6], [12, 77, 2], [14, 74, 2]],
];
export class Music {
  constructor(ctx, dest, noise) {
    this.ctx = ctx; this.noise = noise; this.playing = false; this.timer = 0; this.vol = 0.55;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = (60 / BPM) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.36; const wet = ctx.createGain(); wet.gain.value = 0.3;
    this.send = ctx.createGain(); this.send.gain.value = 1; this.send.connect(this.delay); this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.out);
  }
  setVolume(v) { this.vol = v; if (this.playing) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  start() {
    if (this.playing) return; this.playing = true; this.step = 0; this.next = this.ctx.currentTime + 0.12;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime); this.out.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.6);
    this.timer = setInterval(() => this.tick(), 60); this.tick();
  }
  stop() {
    if (!this.playing) return; this.playing = false; const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.18);
    clearInterval(this.timer); this.timer = 0;
  }
  tick() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') { this.next = ctx.currentTime + 0.1; return; }
    while (this.next < ctx.currentTime + 0.3) { this.play(this.step, this.next); this.next += STEP; this.step = (this.step + 1) % 256; }
  }
  play(step, t) {
    const bar = Math.floor(step / 16) % 8, s = step % 16, pass = Math.floor(step / 128), swing = (s % 2) ? STEP * 0.06 : 0; t += swing;
    // batería
    if (s === 0 || s === 6 || s === 10 || (s === 14 && bar % 2)) this.kick(t, s === 0 ? 1 : 0.8);
    if (s === 4 || s === 12) this.snare(t, 0.9); else if (s === 15 && bar % 4 === 3) this.snare(t, 0.35);
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.34 : 0.22, false); else if (s % 4 === 3) this.hat(t, 0.1, false);
    if (s === 14 && bar % 2 === 1) this.hat(t, 0.3, true);
    // bajo
    for (const [bs, iv, len] of BASS) if (bs === s) this.bass(ROOTS[bar] + iv, t, STEP * len * 0.92);
    // piano eléctrico: acordes picados
    if (STABS.includes(s)) { const ch = CHORDS[bar], vel = s === 0 ? 1 : 0.72; for (const n of ch) this.epiano(n, t, STEP * (s === 0 ? 3.2 : 1.5), 0.05 * vel); }
    // melodía (la segunda vuelta sube de registro)
    for (const [ms, note, len] of MELODY[bar]) if (ms === s) this.lead(note + (pass && note <= 79 ? 12 : 0), t, STEP * len * 0.95, pass ? 0.075 : 0.065);
    // pasos extra en la segunda vuelta: arpegio suave que rellena
    if (pass && s % 4 === 1 && (bar === 3 || bar === 7)) this.epiano(CHORDS[bar][(s >> 2) % 4] + 12, t, STEP * 1.5, 0.028);
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
    a.type = 'sawtooth'; b.type = 'square'; a.frequency.value = f; b.frequency.value = f; a.detune.value = 6; b.detune.value = -7;
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
