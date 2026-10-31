// El motor es sintético (src/engine-dsp.js, en un AudioWorklet). Las grabaciones CC0 quedan solo como respaldo si el worklet no carga.
import { PROFILES } from './engine-dsp.js';
import { Music } from './music.js';
const SYNTH_ID = new Proxy({}, { get: (_, id) => (PROFILES[id] ? id : 'porsche') });
const RECORDED_ENGINES = {
  bora: ['./assets/audio/engine_bora.wav', 0.72, 0.28, 3900],
  porsche: ['./assets/audio/engine_porsche.wav', 0.86, 0.32, 5200],
  m3: ['./assets/audio/engine_m3.wav', 0.82, 0.32, 5000],
  cupra: ['./assets/audio/engine_cupra.wav', 0.78, 0.29, 4600],
  mini: ['./assets/audio/engine_mini.wav', 0.83, 0.3, 4800],
  qashqai: ['./assets/audio/engine_qashqai.wav', 0.7, 0.25, 3600],
};
function seamlessLoop(ctx, source, fadeSeconds = 0.12) {
  const fade = Math.min(Math.floor(source.sampleRate * fadeSeconds), Math.floor(source.length / 8));
  if (fade < 2) return source;
  const loop = ctx.createBuffer(source.numberOfChannels, source.length - fade, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel), output = loop.getChannelData(channel);
    output.set(input.subarray(fade, source.length - fade), 0);
    const seam = source.length - fade * 2;
    for (let i = 0; i < fade; i++) {
      const t = i / (fade - 1);
      output[seam + i] = input[source.length - fade + i] * (1 - t) + input[i] * t;
    }
  }
  return loop;
}
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.ok = false; this.engineSource = null; this.engineCar = null; this.engineToken = 0; this.vol = { master: 1, music: 0.7, engine: 0.65 }; this.engineOn = true; this.music = null; this.requestedCar = null; this.engineRpm = 0.22; this.lastAudioTime = 0; this.lastMsg = null; this.lastMsgT = 0; }
  init(carId) {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); if (carId) this.startSynth(carId); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC({ latencyHint: 'balanced' }));
      // si el navegador pausa el audio (cambio de pestaña, llamada, bloqueo en móvil) lo reanudamos solos
      const wake = () => { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); };
      ctx.onstatechange = () => { if (ctx.state === 'interrupted' || ctx.state === 'suspended') setTimeout(wake, 250); };
      document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
      for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, wake, { passive: true });
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4; comp.knee.value = 24; comp.attack.value = 0.004; comp.release.value = 0.2;
      // limitador final: los picos de golpes + motor + música no llegan nunca a saturar (eso sonaba a chasquido)
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08; comp.connect(lim); lim.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.58; this.master.connect(comp);
      // ruidos
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const nz = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(b); b.connect(g); g.connect(this.master); s.start(); return { g, b }; };
      this.skid = nz('bandpass', 1500, 4);
      this.wind = nz('lowpass', 400, 0.4);
      this.rain = nz('lowpass', 1150, 0.35);
      this.gravel = nz('bandpass', 850, 1.2);
      this.spray = nz('highpass', 720, 0.45);
      this.music = new Music(ctx, this.master, buf); this.applyVolumes();
      this.ok = true;
      if (carId) this.startSynth(carId);
    } catch (e) { this.ok = false; }
  }
  // Intenta el motor sintético; si falla, usa la grabación de respaldo
  async startSynth(carId) {
    if (!this.ctx || this.synthTried === 'failed') { this.ensureEngine(carId); return; }
    if (this.synth) { if (this.synthCar !== carId) { this.synthCar = carId; this.synth.port.postMessage({ profile: SYNTH_ID[carId] || 'porsche' }); } return; }
    if (this.synthTried) return;
    this.synthTried = 'loading';
    try {
      await this.ctx.audioWorklet.addModule(new URL('engine-worklet.js', document.baseURI).href);
      const node = new AudioWorkletNode(this.ctx, 'drift-engine', { outputChannelCount: [2] });
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = this.engineOn ? 0.6 * this.vol.engine : 0; node.connect(this.engineGain); this.engineGain.connect(this.master);
      this.synth = node; this.synthCar = this.requestedSynth || carId; node.port.postMessage({ profile: SYNTH_ID[this.synthCar] || 'porsche' }); this.synthTried = 'ok';
    } catch (e) { this.synthTried = 'failed'; console.warn('Motor sintético no disponible; uso grabaciones', e); this.ensureEngine(carId); }
  }
  async ensureEngine(carId) {
    const profile = RECORDED_ENGINES[carId];
    if (!this.ctx || !profile || this.engineCar === carId || this.requestedCar === carId) return;
    this.requestedCar = carId; const token = ++this.engineToken;
    try {
      const response = await fetch(profile[0]);
      if (!response.ok) throw new Error(`Audio ${response.status}: ${profile[0]}`);
      const bytes = await response.arrayBuffer(), decoded = await this.ctx.decodeAudioData(bytes.slice(0));
      const buffer = seamlessLoop(this.ctx, decoded);
      if (token !== this.engineToken || this.requestedCar !== carId) return;
      if (this.engineSource) {
        const old = this.engineSource, now = this.ctx.currentTime;
        old.gain.gain.setTargetAtTime(0, now, 0.06);
        try { old.source.stop(now + 0.3); } catch (_) {}
      }
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = buffer.duration;
      filter.type = 'lowpass'; filter.frequency.value = profile[3]; filter.Q.value = 0.45;
      gain.gain.value = 0;
      source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(0, 0);
      this.engineSource = { source, filter, gain, profile }; this.engineCar = carId;
    } catch (e) {
      if (token === this.engineToken) { this.requestedCar = null; console.warn('No se pudo cargar la grabación del motor', e); }
    }
  }
  setMuted(m) { this.muted = m; this.applyVolumes(); }
  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    const t = this.ctx ? this.ctx.currentTime : 0, ramp = (param, v) => { try { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, 0.02); } catch (_) { param.value = v; } };
    if (this.master) ramp(this.master.gain, this.muted ? 0 : 0.58 * this.vol.master);
    if (this.music) this.music.setVolume(0.55 * this.vol.music * (this.duck ? 0.6 : 1));
    if (this.engineGain && this.engineOn) ramp(this.engineGain.gain, 0.6 * this.vol.engine);
  }
  // El motor y los ruidos de rodadura solo suenan durante la carrera (no en menú ni en pausa)
  setEngineActive(on) {
    if (this.engineOn === on || !this.ok) { this.engineOn = on; return; }
    this.engineOn = on; const t = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(on ? 0.6 * this.vol.engine : 0, t, on ? 0.08 : 0.04);
    if (!on) {
      if (this.engineSource) this.engineSource.gain.gain.setTargetAtTime(0, t, 0.04);
      for (const n of [this.wind, this.rain, this.spray, this.gravel, this.skid]) if (n) n.g.gain.setTargetAtTime(0, t, 0.05);
    }
  }
  setMusicDuck(d) { if (this.duck !== d) { this.duck = d; this.applyVolumes(); } }
  setMusic(on) { if (!this.music) return; if (on) this.music.start(); else this.music.stop(); }
  update(p) {
    if (!this.ok) return;
    if (p.carId && p.carId !== (this.synth ? this.synthCar : this.engineCar)) this.startSynth(p.carId);
    if (p.carId) this.requestedSynth = p.carId;
    const t = this.ctx.currentTime, dt = this.lastAudioTime ? Math.min(0.1, Math.max(0, t - this.lastAudioTime)) : 1 / 60;
    this.lastAudioTime = t;
    const throttle = Math.max(0, Math.min(1, p.throttle || 0)), brake = Math.max(0, Math.min(1, p.brake || 0));
    const targetRpm = Math.max(0.16, Math.min(1, p.rpm * 0.72 + throttle * 0.34 - brake * 0.2));
    this.engineRpm += (targetRpm - this.engineRpm) * (1 - Math.exp(-dt / (throttle > 0.12 ? 0.075 : 0.2)));
    if (this.synth) {
      const pr = PROFILES[SYNTH_ID[p.carId] || 'porsche'], norm = Math.max(0, Math.min(1, (p.rpm - 0.22) / 0.78));
      const rpm = pr.idle + (pr.redline * 0.97 - pr.idle) * norm, hiRev = rpm / pr.redline;
      const msg = { rpm, throttle, boost: throttle * Math.min(1, Math.max(0.15, (hiRev - 0.25) * 1.8)), limiter: p.rpm > 0.985 && throttle > 0.5 }, L = this.lastMsg;
      if (!L || msg.limiter !== L.limiter || Math.abs(msg.rpm - L.rpm) > pr.redline * 0.004 || Math.abs(msg.throttle - L.throttle) > 0.02 || t - this.lastMsgT > 0.12) {
        if (!L || t - this.lastMsgT > 0.022 || msg.limiter !== L.limiter) { this.synth.port.postMessage(msg); this.lastMsg = msg; this.lastMsgT = t; }
      }
    } else if (this.engineSource) {
      const profile = this.engineSource.profile;
      const rate = Math.max(0.68, Math.min(1.62, profile[1] + this.engineRpm * 0.55 + throttle * 0.24 - brake * 0.11));
      this.engineSource.source.playbackRate.setTargetAtTime(rate, t, throttle > 0.12 ? 0.07 : 0.18);
      this.engineSource.filter.frequency.setTargetAtTime(Math.max(750, Math.min(profile[3], 820 + this.engineRpm * 4200 + throttle * 1500 - brake * 520)), t, throttle > 0.12 ? 0.08 : 0.18);
      const load = Math.max(0.12, Math.min(1, 0.16 + this.engineRpm * 0.38 + throttle * 0.55 - brake * 0.16));
      this.engineSource.gain.gain.setTargetAtTime(profile[2] * load * (p.air ? 0.72 : 1) * this.vol.engine, t, 0.1);
    }
    const r = Math.min(1, p.speed / p.vmax);
    this.wind.g.gain.setTargetAtTime(r * r * 0.09, t, 0.15);
    this.rain.g.gain.setTargetAtTime(p.weather === 'rain' ? 0.021 : 0, t, 0.3);
    this.spray.g.gain.setTargetAtTime(p.weather === 'rain' ? Math.min(0.035, (p.puddleWater || 0) * 0.035 * r + (p.offroadFactor || 0) * 0.008 * r) : 0, t, 0.07);
    const tireTone = { snow: 850, ice: 2600, dirt: 1050, gravel: 950, grass: 700, sand: 800, wet: 2050 }[p.surface] || (p.weather === 'rain' ? 2050 : 1550);
    this.skid.b.frequency.setTargetAtTime(tireTone, t, 0.18);
    const offroad = p.offroadFactor || (p.offroad ? 1 : 0);
    this.gravel.g.gain.setTargetAtTime(Math.min(0.035, r * 0.035 * offroad), t, 0.16);
    this.skid.g.gain.setTargetAtTime(Math.max(0, Math.min(1, (p.slip - 2.5) / 8)) * (p.air ? 0 : 0.085) + (p.onKerb ? 0.035 * r : 0) + (0.022 * r * offroad), t, 0.08);
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
    if (name === 'wall') { this.burst(520 + Math.min(1000, v * 16), 0.22, Math.min(0.4, 0.08 + v * 0.012)); this.burst(170, 0.14, Math.min(0.22, 0.035 + v * 0.006)); }
    else if (name === 'bump') { this.burst(420 + Math.min(700, v * 12), 0.15, Math.min(0.3, 0.05 + v * 0.01)); this.burst(180, 0.09, 0.05); }
    else if (name === 'land') this.burst(380, 0.28, Math.min(0.34, 0.05 + v * 0.016));
    else if (name === 'takeoff') this.burst(460, 0.12, 0.035);
    else if (name === 'drift') this.burst(1750, 0.12, 0.035);
    else if (name === 'shift') { this.burst(1350, 0.045, 0.035); this.burst(390, 0.075, 0.025); }
    else if (name === 'sector') this.beep(1000, 0.07, 0.07, 'sine');
    else if (name === 'purple') { this.beep(1046, 0.09, 0.09, 'triangle'); setTimeout(() => this.beep(1568, 0.18, 0.09, 'triangle'), 90); }
    else if (name === 'count') this.beep(440, 0.2, 0.15, 'triangle');
    else if (name === 'go') this.beep(880, 0.4, 0.18, 'triangle');
    else if (name === 'lap') { this.beep(660, 0.1, 0.1, 'triangle'); setTimeout(() => this.beep(990, 0.16, 0.1, 'triangle'), 110); }
    else if (name === 'finish') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.25, 0.12, 'triangle'), i * 140)); }
  }
}
