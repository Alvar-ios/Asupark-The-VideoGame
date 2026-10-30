// Sonido procedural (WebAudio): motor suave tipo "coche de juguete", derrape, viento y avisos
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.ok = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4; comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6; this.master.connect(comp);
      // motor: sierra + triángulo, filtrado y sin distorsión
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
      this.o2 = ctx.createOscillator(); this.o2.type = 'triangle';
      const g1 = ctx.createGain(), g2 = ctx.createGain(); g1.gain.value = 0.35; g2.gain.value = 0.6;
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 800; this.lp.Q.value = 0.5;
      this.eg = ctx.createGain(); this.eg.gain.value = 0;
      this.o1.connect(g1); this.o2.connect(g2); g1.connect(this.lp); g2.connect(this.lp); this.lp.connect(this.eg); this.eg.connect(this.master);
      this.o1.start(); this.o2.start();
      // ERS: zumbido eléctrico suave
      this.ers = ctx.createOscillator(); this.ers.type = 'sine'; this.erg = ctx.createGain(); this.erg.gain.value = 0;
      this.ers.connect(this.erg); this.erg.connect(this.master); this.ers.start();
      // ruidos
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const nz = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(b); b.connect(g); g.connect(this.master); s.start(); return { g, b }; };
      this.skid = nz('bandpass', 1500, 4);
      this.wind = nz('lowpass', 400, 0.4);
      this.ok = true;
    } catch (e) { this.ok = false; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.6; }
  update(p) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, rpm = p.rpm, f = 85 + rpm * 190;
    this.o1.frequency.setTargetAtTime(f, t, 0.08);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.lp.frequency.setTargetAtTime(650 + rpm * 900 + p.throttle * 300, t, 0.1);
    this.eg.gain.setTargetAtTime(0.035 + 0.045 * (0.3 + 0.7 * p.throttle), t, 0.1);
    if (p.ersOn) { this.ers.frequency.setTargetAtTime(520 + rpm * 420, t, 0.1); this.erg.gain.setTargetAtTime(0.012, t, 0.08); }
    else this.erg.gain.setTargetAtTime(0, t, 0.08);
    this.skid.g.gain.setTargetAtTime(Math.max(0, Math.min(1, (p.slip - 3) / 10)) * (p.air ? 0 : 0.07), t, 0.08);
    const r = Math.min(1, p.speed / p.vmax);
    this.wind.g.gain.setTargetAtTime(r * r * 0.06, t, 0.15);
    this.skid.g.gain.setTargetAtTime(Math.max(0, Math.min(1, (p.slip - 3) / 10)) * (p.air ? 0 : 0.07) + (p.onKerb ? 0.05 : 0), t, 0.05);
  }
  beep(freq, dur = 0.15, vol = 0.12, type = 'sine') {
    if (!this.ok) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(freq, dur, vol) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name, v = 1) {
    if (!this.ok) return;
    if (name === 'wall') this.burst(800, 0.2, Math.min(0.3, 0.08 + v * 0.01));
    else if (name === 'land') this.burst(450, 0.22, Math.min(0.3, 0.06 + v * 0.015));
    else if (name === 'pad') { this.beep(880, 0.08, 0.08, 'triangle'); setTimeout(() => this.beep(1320, 0.14, 0.08, 'triangle'), 80); }
    else if (name === 'ersempty') this.beep(300, 0.2, 0.06, 'triangle');
    else if (name === 'sector') this.beep(1000, 0.07, 0.07, 'sine');
    else if (name === 'purple') { this.beep(1046, 0.09, 0.09, 'triangle'); setTimeout(() => this.beep(1568, 0.18, 0.09, 'triangle'), 90); }
    else if (name === 'count') this.beep(440, 0.2, 0.15, 'triangle');
    else if (name === 'go') this.beep(880, 0.4, 0.18, 'triangle');
    else if (name === 'lap') { this.beep(660, 0.1, 0.1, 'triangle'); setTimeout(() => this.beep(990, 0.16, 0.1, 'triangle'), 110); }
    else if (name === 'finish') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.25, 0.12, 'triangle'), i * 140)); }
  }
}
