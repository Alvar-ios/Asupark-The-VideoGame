// Sintetizador de motor (DSP puro, sin dependencias): se usa en un AudioWorklet y en Node para probarlo.
// Modelo: cada cilindro, al encenderse, empuja un pulso de presión; el pulso pasa por resonancias del escape/carrocería.
// Perfil "boxer6": 6 cilindros planos (3 explosiones por vuelta) con ligera irregularidad entre bancadas, turbo y ventilador.
export const PROFILES = {
  boxer6: {
    cyl: 6, amp: [1, 0.84, 1.05, 0.9, 0.98, 0.8], timing: [0, 0.004, -0.003, 0.005, -0.002, 0.003],
    idle: 850, redline: 7000,
    // resonancias del escape y la carrocería: [frecuencia Hz, Q, ganancia, parte que crece con el gas]
    formants: [[95, 3.2, 1.0, 0.0], [190, 3.0, 0.8, 0.1], [420, 2.6, 0.55, 0.3], [900, 2.4, 0.4, 0.6], [1800, 2.2, 0.28, 0.9], [3300, 2.0, 0.16, 1.0]],
    pulseTau: 0.2, turbo: 0.55, fan: 0.5, crackle: 1.0, rough: 0.05,
  },
};
class SVF { // filtro de estado variable (paso banda)
  constructor() { this.l = 0; this.b = 0; }
  bp(x, f, q, sr) { const g = 2 * Math.sin(Math.PI * Math.min(f, sr * 0.45) / sr), k = 1 / q; this.l += g * this.b; const h = x - this.l - k * this.b; this.b += g * h; return this.b; }
}
export class EngineDSP {
  constructor(sr, profile = 'boxer6', seed = 1) {
    this.sr = sr; this.P = PROFILES[profile]; this.seed = seed >>> 0 || 1;
    this.phase = 0; this.cyl = 0; this.env = 0; this.hp = 0; this.hpIn = 0; this.f = this.P.formants.map(() => new SVF());
    this.nLP = 0; this.nF = new SVF(); this.fanF = new SVF(); this.turPh = 0; this.crk = 0; this.crkF = new SVF(); this.limT = 0; this.rpmS = 900; this.thrS = 0; this.boostS = 0; this.pend = 0; this.pendEnv = 0; this.slow = 0;
  }
  rnd() { this.seed ^= this.seed << 13; this.seed >>>= 0; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5; this.seed >>>= 0; return this.seed / 4294967296; }
  // out: Float32Array; p: {rpm, throttle(0..1), boost(0..1), limiter(bool)}
  process(out, p) {
    const sr = this.sr, P = this.P, n = out.length;
    for (let i = 0; i < n; i++) {
      // suavizado de parámetros (la inercia del motor)
      this.rpmS += (p.rpm - this.rpmS) * 0.0016; this.thrS += (p.throttle - this.thrS) * 0.004; this.boostS += (p.boost - this.boostS) * 0.0006;
      const rpm = this.rpmS, thr = this.thrS, load = thr * Math.min(1, 0.35 + rpm / 4500);
      const firingHz = rpm / 60 * (P.cyl / 2), period = 1 / Math.max(20, firingHz);
      // avance del ciclo de 4 tiempos (2 vueltas)
      this.phase += rpm / 60 / 2 / sr * P.cyl;
      if (this.phase >= 1) {
        this.phase -= 1; this.cyl = (this.cyl + 1) % P.cyl;
        let a = P.amp[this.cyl] * (0.5 + 0.9 * load) * (0.92 + 0.16 * this.rnd()) * Math.pow(Math.max(0.4, firingHz / 100), 0.85); // área del pulso constante: más vueltas, más energía
        if (p.limiter) { this.limT++; if (this.limT & 1) a *= 0.18; } else this.limT = 0; // corte de encendido
        if (thr < 0.04 && rpm > 1500) a *= 0.35; // retención: menos presión
        this.pend = Math.max(0, P.timing[this.cyl] * 12 * period * sr); this.pendEnv = a; // retardo = fracción del periodo (irregularidad del escape)
      }
      if (this.pend > 0 && --this.pend <= 0) { this.env = Math.max(this.env, this.pendEnv); this.pend = 0; }
      const tau = period * (P.pulseTau + 0.12 * (1 - thr));
      const x0 = this.env; this.env *= Math.exp(-1 / (tau * sr));
      // quitar continua
      this.hp = 0.995 * (this.hp + x0 - this.hpIn); this.hpIn = x0;
      const x = this.hp * (1 + P.rough * (this.rnd() - 0.5));
      // resonancias: la apertura de gas abre los agudos
      let y = 0;
      for (let k = 0; k < P.formants.length; k++) { const F = P.formants[k]; y += this.f[k].bp(x, F[0] * (1 + 0.5 * rpm / P.redline), F[1], sr) * F[2] * ((1 - F[3]) + F[3] * (0.25 + 0.9 * load)); }
      // ruido de admisión y mecánica
      const nz = this.rnd() * 2 - 1;
      const intake = this.nF.bp(nz, 600 + rpm * 0.45, 0.9, sr) * (0.015 + 0.05 * load) * (rpm / P.redline);
      const fan = this.fanF.bp(nz, 1700 + rpm * 0.7, 6, sr) * P.fan * 0.05 * (rpm / P.redline);
      // turbo: silbido que sube con el soplado
      this.turPh += (2200 + this.boostS * 4800 + rpm * 0.35) / sr; if (this.turPh >= 1) this.turPh -= 1;
      const tur = Math.sin(6.2831853 * this.turPh) * P.turbo * 0.016 * this.boostS * Math.min(1, thr * 1.4);
      // petardeos al soltar el acelerador a muchas vueltas
      if (thr < 0.05 && rpm > 3000 && this.crk <= 0 && this.rnd() < (P.crackle * 11 / sr) * (rpm / P.redline)) this.crk = 0.5 + this.rnd() * 0.5;
      let crack = 0; if (this.crk > 0) { crack = this.crkF.bp(nz, 1100 + 900 * this.rnd(), 1.4, sr) * this.crk * 0.55; this.crk *= 0.9988; if (this.crk < 0.01) this.crk = 0; }
      const s = y * 0.55 + intake + fan + tur + crack;
      out[i] = Math.tanh(s * 1.6) * 0.62;
    }
  }
}
