// Sintetizador de motor (DSP puro, sin dependencias): se usa en un AudioWorklet y en Node para probarlo.
// Modelo: cada cilindro, al encenderse, empuja un pulso de presión (irregular: la combustión nunca es idéntica);
// el pulso atraviesa resonancias graves del escape y la carrocería. Encima: rugido, turbo/compresor, petardeos, eléctrico.
const F = (a) => a; // formantes: [Hz, Q, ganancia, parte que crece con el gas]
export const PROFILES = {
  // Porsche 911 (964) Turbo S: bóxer 6 turbo refrigerado por aire
  porsche: { name: 'Porsche 911 Turbo S', cyl: 6, amp: [1, 0.84, 1.05, 0.9, 0.98, 0.8], idle: 850, redline: 7000, gain: 1,
    tau: 0.46, rough: 0.2, miss: 0.1, sub: 0.9, rumble: 0.55, fan: 0.3, turboNoise: 0.7, turboWhine: 0.5, crackle: 1.5, crkMin: 2400, thump: 1, burble: 0.12,
    formants: F([[46, 3.2, 1.1, 0], [70, 3, 1, 0], [118, 2.8, 0.9, 0.05], [215, 2.6, 0.7, 0.2], [440, 2.4, 0.42, 0.4], [920, 2.2, 0.25, 0.7], [1900, 2, 0.12, 1], [3300, 2, 0.06, 1]]) },
  // VW Bora: 4 cilindros en línea, muy petardeante
  bora: { name: 'VW Bora (4 cil., petardeante)', cyl: 4, amp: [1, 0.88, 1.06, 0.92], idle: 800, redline: 6500, gain: 0.95,
    tau: 0.4, rough: 0.28, miss: 0.14, sub: 0.55, rumble: 0.35, fan: 0, turboNoise: 0, turboWhine: 0, crackle: 2.2, crkMin: 1800, thump: 1.1, burble: 1.1,
    formants: F([[62, 3, 1.0, 0], [96, 3, 1.0, 0.05], [165, 2.8, 0.85, 0.15], [300, 2.6, 0.65, 0.3], [620, 2.4, 0.45, 0.5], [1300, 2.2, 0.3, 0.8], [2500, 2, 0.14, 1]]) },
  // Mini Cooper S: 4 cil. con compresor (silbido agudo y fuerte) y muchos petardeos al reducir
  mini: { name: 'Mini Cooper S (compresor)', cyl: 4, amp: [1, 0.9, 1.04, 0.94], idle: 850, redline: 6500, gain: 0.95,
    tau: 0.36, rough: 0.2, miss: 0.08, sub: 0.45, rumble: 0.3, fan: 0, turboNoise: 0.25, turboWhine: 0, supercharger: 1, crackle: 2.8, crkMin: 2000, thump: 0.9, burble: 0.3,
    formants: F([[70, 3, 0.95, 0], [110, 3, 0.95, 0.05], [190, 2.8, 0.8, 0.2], [380, 2.6, 0.6, 0.4], [780, 2.4, 0.45, 0.6], [1600, 2.2, 0.3, 0.9], [3000, 2, 0.16, 1]]) },
  // BMW M3 E46: 6 en línea, muy grave y potente
  m3: { name: 'BMW M3 E46 (6 en línea)', cyl: 6, amp: [1, 1.02, 0.98, 1, 1.03, 0.97], idle: 900, redline: 8000, gain: 1.2,
    tau: 0.52, rough: 0.1, miss: 0.03, sub: 1.3, rumble: 0.8, fan: 0, turboNoise: 0, turboWhine: 0, crackle: 0.9, crkMin: 3000, thump: 1.4, burble: 0.05,
    formants: F([[38, 3.2, 1.25, 0], [58, 3.2, 1.2, 0], [92, 3, 1.05, 0.05], [165, 2.8, 0.85, 0.2], [320, 2.6, 0.6, 0.4], [650, 2.4, 0.38, 0.6], [1400, 2.2, 0.24, 0.9], [2800, 2, 0.12, 1]]) },
  // Cupra León híbrido: motor 4 cil. discreto + motor eléctrico
  cupra: { name: 'Cupra León (híbrido)', cyl: 4, amp: [1, 0.92, 1.03, 0.95], idle: 800, redline: 6200, gain: 0.75,
    tau: 0.42, rough: 0.12, miss: 0.04, sub: 0.5, rumble: 0.25, fan: 0, turboNoise: 0.2, turboWhine: 0.2, crackle: 0, crkMin: 9999, thump: 0, burble: 0, electric: 1,
    formants: F([[66, 3, 0.9, 0], [105, 3, 0.9, 0.05], [185, 2.8, 0.7, 0.2], [380, 2.6, 0.5, 0.4], [800, 2.4, 0.32, 0.6], [1700, 2.2, 0.18, 0.9], [3200, 2, 0.08, 1]]) },
  // Nissan Qashqai: como el Bora pero más suave
  qashqai: { name: 'Nissan Qashqai (suave)', cyl: 4, amp: [1, 0.94, 1.02, 0.96], idle: 780, redline: 6000, gain: 0.8,
    tau: 0.44, rough: 0.14, miss: 0.05, sub: 0.5, rumble: 0.3, fan: 0, turboNoise: 0, turboWhine: 0, crackle: 0.25, crkMin: 2500, thump: 0.6, burble: 0.15,
    formants: F([[64, 3, 0.95, 0], [100, 3, 0.95, 0.05], [170, 2.8, 0.75, 0.1], [310, 2.6, 0.5, 0.2], [620, 2.4, 0.3, 0.4], [1250, 2.2, 0.16, 0.6], [2400, 2, 0.07, 0.8]]) },
};
// Perfiles derivados: parten de uno base y se ajustan (más grave/agudo, cilindros, sobrealimentación…)
const shiftF = (fm, k) => fm.map((f) => [f[0] * k, f[1], f[2], f[3]]);
const amps = (n) => Array.from({ length: n }, (_, i) => 1 + 0.06 * Math.sin(i * 2.3 + 0.7));
const derive = (base, k, o) => { const P = Object.assign({}, PROFILES[base], o); P.formants = shiftF((o && o.formants) || PROFILES[base].formants, k); if (o && o.cyl) P.amp = amps(o.cyl); return P; };
Object.assign(PROFILES, {
  minitoon: derive('mini', 1.1, { name: 'Mini Toon (compresor agudo)', gain: 0.9, redline: 6800 }),
  gtr: derive('porsche', 1.0, { name: 'Skyline GT-R (RB26 biturbo)', redline: 8000, gain: 1.05, turboNoise: 0.8, turboWhine: 0.7, crackle: 2, burble: 0.5, sub: 0.8 }),
  f360: derive('m3', 1.25, { name: 'Ferrari 360 (V8 que grita)', cyl: 8, idle: 1000, redline: 8600, gain: 1.05, sub: 0.7, rumble: 0.5, crackle: 1.3, crkMin: 2800, thump: 0.9, burble: 0.3, rough: 0.08 }),
  golf: derive('bora', 1.15, { name: 'Golf GTI Mk1 (4 cil. carburado)', redline: 6800, gain: 0.9, crackle: 0.9, burble: 0.4, rough: 0.3, sub: 0.4, rumble: 0.25 }),
  mx5: derive('bora', 1.1, { name: 'MX-5 NA (4 cil. limpio)', redline: 7200, gain: 0.85, crackle: 0.35, burble: 0.1, rough: 0.12, miss: 0.04, sub: 0.45 }),
  z240: derive('m3', 0.95, { name: 'Datsun 240Z (6 en línea clásico)', redline: 6800, gain: 1.05, sub: 1.0, rumble: 0.6, crackle: 1.3, burble: 0.6, rough: 0.2, miss: 0.08, tau: 0.5 }),
  mustang: derive('m3', 0.78, { name: 'Mustang 65 (V8 grave)', cyl: 8, idle: 700, redline: 5800, gain: 1.3, sub: 1.6, rumble: 1.0, crackle: 1.6, crkMin: 2200, thump: 1.7, burble: 1.3, rough: 0.28, miss: 0.1, tau: 0.58 }),
  s4: derive('m3', 1.0, { name: 'Audi S4 (V6 compresor)', redline: 7000, gain: 1.05, supercharger: 0.8, sub: 0.9, rumble: 0.5, crackle: 0.7, burble: 0.2 }),
  cobra: derive('m3', 0.7, { name: 'Cobra 427 (V8 7.0)', cyl: 8, idle: 700, redline: 6500, gain: 1.45, sub: 1.8, rumble: 1.2, crackle: 2.2, crkMin: 2000, thump: 2, burble: 1.7, rough: 0.3, miss: 0.12, tau: 0.6 }),
  stradale: derive('m3', 1.3, { name: 'Alfa 33 Stradale (V8 agudo)', cyl: 8, idle: 1100, redline: 9500, gain: 1.0, sub: 0.5, rumble: 0.4, crackle: 1.1, crkMin: 3500, thump: 0.8, burble: 0.3, rough: 0.1, tau: 0.34 }),
  slr: derive('m3', 0.85, { name: 'SLR (V8 sobrealimentado)', cyl: 8, idle: 750, redline: 6600, gain: 1.4, supercharger: 1, sub: 1.5, rumble: 1.0, crackle: 1.8, crkMin: 2300, thump: 1.5, burble: 1.0, rough: 0.2 }),
  aston: derive('porsche', 1.8, { name: 'F1 híbrido (V6 turbo)', cyl: 6, idle: 3500, redline: 13500, gain: 0.95, electric: 0.4, turboWhine: 0.8, turboNoise: 0.6, sub: 0.25, rumble: 0.15, crackle: 0.5, crkMin: 6000, thump: 0.3, burble: 0, rough: 0.04, miss: 0.02, tau: 0.25 }),
  lotus: derive('m3', 1.45, { name: 'Lotus 72 (Cosworth V8)', cyl: 8, idle: 2000, redline: 10500, gain: 1.05, sub: 0.5, rumble: 0.35, crackle: 0.9, crkMin: 4000, thump: 0.6, burble: 0.2, rough: 0.2, miss: 0.08, tau: 0.3 }),
  mclaren: derive('m3', 1.6, { name: 'McLaren MP4-25 (V8 18000)', cyl: 8, idle: 3500, redline: 14500, gain: 0.95, sub: 0.2, rumble: 0.15, crackle: 0.6, crkMin: 6000, thump: 0.3, burble: 0, rough: 0.04, miss: 0.02, tau: 0.25 }),
});
class SVF { // filtro de estado variable (paso banda)
  constructor() { this.l = 0; this.b = 0; }
  bp(x, f, q, sr) { const g = 2 * Math.sin(Math.PI * Math.min(f, sr * 0.25) / sr), k = 1 / q; this.l += g * this.b; const h = x - this.l - k * this.b; this.b += g * h; return this.b; }
}
export class EngineDSP {
  constructor(sr, profile = 'porsche', seed = 1) {
    this.sr = sr; this.setProfile(profile); this.seed = seed >>> 0 || 1;
    this.phase = 0; this.cyl = 0; this.env = 0; this.hp = 0; this.hpIn = 0;
    this.limPh = 0; this.limHz = 9; this.limDepth = 0.05; this.limMix = 0; this.lastRpm = 0; this.rpmS = 900; this.thrS = 0; this.boostS = 0; this.pend = 0; this.pendEnv = 0; this.limT = 0; this.t = 0;
    this.subLP = 0; this.rumLP = 0; this.wob = 0; this.wobT = 0; this.evS = 0;
    this.nF = new SVF(); this.fanF = new SVF(); this.turF = new SVF(); this.crkF = new SVF(); this.crkF2 = new SVF(); this.thF = new SVF();
    this.turPh = 0; this.scPh = 0; this.evPh = 0; this.crk = 0; this.thump = 0; this.popsLeft = 0; this.popT = 0; this.popAmp = 0;
  }
  resetState() { for (const f of this.f) { f.l = 0; f.b = 0; } for (const f of [this.nF, this.fanF, this.turF, this.crkF, this.crkF2, this.thF]) { f.l = 0; f.b = 0; } this.env = 0; this.hp = 0; this.hpIn = 0; this.subLP = 0; this.rumLP = 0; this.crk = 0; this.thump = 0; this.popsLeft = 0; }
  setProfile(name) { this.P = PROFILES[name] || PROFILES.porsche; this.f = this.P.formants.map(() => new SVF()); }
  rnd() { this.seed ^= this.seed << 13; this.seed >>>= 0; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5; this.seed >>>= 0; return this.seed / 4294967296; }
  pop(amp) { this.crk = Math.max(this.crk, amp); this.thump = Math.max(this.thump, amp * this.P.thump); }
  // out: Float32Array; p: {rpm, throttle(0..1), boost(0..1), limiter(bool)}
  process(out, p) {
    const sr = this.sr, P = this.P, n = out.length;
    for (let i = 0; i < n; i++) {
      this.t += 1 / sr;
      this.rpmS += (p.rpm - this.rpmS) * 0.0016; this.thrS += (p.throttle - this.thrS) * 0.004; this.boostS += (p.boost - this.boostS) * 0.0006;
      // ralentí inestable: el régimen "caza" arriba y abajo
      const lowRpm = Math.max(0, 1 - this.rpmS / 2800);
      this.wobT += 1 / sr; if (this.wobT > 0.05) { this.wobT = 0; this.wob += (this.rnd() - 0.5) * 0.02 - this.wob * 0.05; }
      const rpm0 = this.rpmS * (1 + (this.wob + 0.012 * Math.sin(6.28 * 1.7 * this.t)) * lowRpm);
      // limitador real: corta el encendido, las vueltas caen un poco y vuelve a entrar; ritmo y profundidad irregulares
      this.limMix += ((p.limiter ? 1 : 0) - this.limMix) * 0.003;
      this.limPh += this.limHz / sr;
      if (this.limPh >= 1) { this.limPh -= 1; this.limHz = 6.5 + this.rnd() * 6; this.limDepth = 0.035 + this.rnd() * 0.045; }
      const dip = this.limPh < 0.4 ? this.limPh / 0.4 : 1 - (this.limPh - 0.4) / 0.6, cutting = p.limiter && this.limPh < 0.4;
      const rpm = rpm0 * (1 - this.limDepth * dip * this.limMix); this.lastRpm = rpm;
      const thr = this.thrS, load = thr * Math.min(1, 0.35 + rpm / 4500);
      const firingHz = rpm / 60 * (P.cyl / 2), period = 1 / Math.max(20, firingHz);
      // híbrido: a pocas vueltas y poco gas manda el eléctrico
      let ev = 0; if (P.electric) { ev = Math.max(0, Math.min(1, (1 - (rpm - 700) / 1900) * (thr < 0.6 ? 1 : 0.35))); this.evS += (ev - this.evS) * 0.0008; ev = this.evS; }
      this.phase += rpm / 60 / 2 / sr * P.cyl;
      if (this.phase >= 1) {
        this.phase -= 1; this.cyl = (this.cyl + 1) % P.cyl;
        // variación ciclo a ciclo: grande a pocas vueltas (ese "parpadeo" de la combustión)
        const vr = P.rough * (0.35 + 1.1 * lowRpm);
        let a = P.amp[this.cyl] * (0.5 + 0.9 * load) * (1 - vr + 2 * vr * this.rnd()) * Math.pow(Math.max(0.4, firingHz / 100), 0.85);
        if (this.rnd() < P.miss * lowRpm * (1.2 - load)) a *= 0.22; // encendido flojo
        if (cutting) a *= 0.12;
        if (thr < 0.04 && rpm > 1500) a *= 0.4;
        this.pend = Math.max(0, (this.rnd() * 0.08) * period * sr); this.pendEnv = a;
      }
      if (this.pend > 0 && --this.pend <= 0) { this.env = Math.max(this.env, this.pendEnv); this.pend = 0; }
      const tau = period * (P.tau + 0.22 * (1 - thr));
      const x0 = this.env; this.env *= Math.exp(-1 / (tau * sr));
      this.hp = 0.996 * (this.hp + x0 - this.hpIn); this.hpIn = x0;
      const x = this.hp;
      // resonancias graves; los agudos solo se abren con carga
      let y = 0;
      for (let k = 0; k < P.formants.length; k++) { const Fm = P.formants[k]; y += this.f[k].bp(x, Fm[0] * (1 + 0.22 * rpm / P.redline), Fm[1], sr) * Fm[2] * (Fm[3] > 0.3 ? 1.7 : 1) * ((1 - Fm[3]) + Fm[3] * (0.2 + 0.9 * load)); }
      // refuerzo de graves: pulso filtrado a ~130 Hz
      this.subLP += (x - this.subLP) * (1 - Math.exp(-6.283 * 130 / sr)); y += this.subLP * P.sub * 1.6;
      const nz = this.rnd() * 2 - 1;
      // rugido: ruido grave modulado por la carga
      this.rumLP += (nz - this.rumLP) * (1 - Math.exp(-6.283 * 110 / sr));
      const rumble = this.rumLP * P.rumble * (0.35 + 0.9 * load) * 2.2;
      const intake = this.nF.bp(nz, 500 + rpm * 0.35, 0.9, sr) * (0.01 + 0.04 * load) * (rpm / P.redline);
      const fan = P.fan ? this.fanF.bp(nz, 1500 + rpm * 0.5, 3, sr) * P.fan * 0.035 * (rpm / P.redline) : 0;
      // turbo: sobre todo soplido (ruido) y un silbido muy tenue de fondo
      let tur = 0;
      if (P.turboNoise || P.turboWhine) {
        const bo = this.boostS * Math.min(1, thr * 1.5 + 0.05);
        tur += this.turF.bp(nz, 2200 + this.boostS * 3200 + rpm * 0.2, 1.6, sr) * P.turboNoise * 0.075 * bo;
        this.turPh += (2300 + this.boostS * 4200 + rpm * 0.3) / sr; if (this.turPh >= 1) this.turPh -= 1;
        tur += Math.sin(6.2831853 * this.turPh) * P.turboWhine * 0.006 * bo;
      }
      // compresor (Mini): silbido ligado a las vueltas, presente con el gas
      if (P.supercharger) {
        this.scPh += (rpm / 60 * 11.5) / sr; if (this.scPh >= 1) this.scPh -= 1;
        const sc = (Math.sin(6.2831853 * this.scPh) + 0.45 * Math.sin(12.566 * this.scPh) + 0.2 * Math.sin(18.85 * this.scPh));
        tur += sc * 0.032 * (0.25 + 0.75 * thr) * Math.min(1, rpm / 2500);
      }
      // híbrido: zumbido del inversor eléctrico (sube con la velocidad)
      let evs = 0;
      if (P.electric) { this.evPh += (260 + (rpm - 700) * 0.55 + 1500 * ev) / sr; if (this.evPh >= 1) this.evPh -= 1; evs = (Math.sin(6.2831853 * this.evPh) + 0.35 * Math.sin(12.566 * this.evPh)) * 0.02 * (0.35 + 0.65 * Math.max(ev, thr * 0.5)); }
      // petardeos: explosión grave + chasquido; al soltar el gas (en racimos) y, según el coche, también bajo carga
      const overrun = thr < 0.06 && rpm > P.crkMin;
      if (overrun && this.popsLeft <= 0 && this.rnd() < (P.crackle * 9 / sr) * (rpm / P.redline)) { this.popsLeft = 1 + Math.floor(this.rnd() * 4 * Math.min(1, P.crackle)); this.popT = 0; this.popAmp = 0.7 + this.rnd() * 0.5; }
      else if (!overrun && thr > 0.25 && P.burble && this.popsLeft <= 0 && this.rnd() < (P.burble * 7 / sr) * (rpm / P.redline)) { this.popsLeft = 1; this.popT = 0; this.popAmp = 0.3 + this.rnd() * 0.25; }
      if (this.popsLeft > 0 && --this.popT <= 0) { this.pop(this.popAmp); this.popAmp *= 0.8; this.popsLeft--; this.popT = sr * (0.022 + this.rnd() * 0.05); }
      let crack = 0;
      if (this.crk > 0.004) { crack = (this.crkF.bp(nz, 1300 + 1200 * this.rnd(), 1.2, sr) + this.crkF2.bp(nz, 420, 1.6, sr) * 0.7) * this.crk * 0.6; this.crk *= 0.9984; } else this.crk = 0;
      if (this.thump > 0.004) { crack += this.thF.bp(nz, 150, 1.3, sr) * this.thump * 1.7; this.thump *= 0.9993; } else this.thump = 0;
      const engine = (y * 0.5 + rumble + intake + fan) * (1 - 0.88 * ev);
      let s = (engine + tur + evs + crack) * P.gain;
      s = Math.tanh(1.5 * s + 0.2 * s * s); // saturación suave: calidez
      if (s !== s || s > 2 || s < -2) { s = 0; this.resetState(); } // red de seguridad: si un filtro se desbocara, se reinicia en vez de chillar
      out[i] = s * 0.62;
    }
  }
}
