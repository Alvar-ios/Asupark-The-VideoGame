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
class SVF { // filtro de estado variable (paso banda)
  constructor() { this.l = 0; this.b = 0; }
  bp(x, f, q, sr) { const g = 2 * Math.sin(Math.PI * Math.min(f, sr * 0.45) / sr), k = 1 / q; this.l += g * this.b; const h = x - this.l - k * this.b; this.b += g * h; return this.b; }
}
export class EngineDSP {
  constructor(sr, profile = 'porsche', seed = 1) {
    this.sr = sr; this.setProfile(profile); this.seed = seed >>> 0 || 1;
    this.phase = 0; this.cyl = 0; this.env = 0; this.hp = 0; this.hpIn = 0;
    this.rpmS = 900; this.thrS = 0; this.boostS = 0; this.pend = 0; this.pendEnv = 0; this.limT = 0; this.t = 0;
    this.subLP = 0; this.rumLP = 0; this.wob = 0; this.wobT = 0; this.evS = 0;
    this.nF = new SVF(); this.fanF = new SVF(); this.turF = new SVF(); this.crkF = new SVF(); this.crkF2 = new SVF(); this.thF = new SVF();
    this.turPh = 0; this.scPh = 0; this.evPh = 0; this.crk = 0; this.thump = 0; this.popsLeft = 0; this.popT = 0; this.popAmp = 0;
  }
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
      const rpm = this.rpmS * (1 + (this.wob + 0.012 * Math.sin(6.28 * 1.7 * this.t)) * lowRpm);
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
        if (p.limiter) { this.limT++; if (this.limT & 1) a *= 0.18; } else this.limT = 0;
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
      out[i] = s * 0.62;
    }
  }
}
