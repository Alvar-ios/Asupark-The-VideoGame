// AudioWorklet: ejecuta el sintetizador de motor (engine-dsp.js) en el hilo de audio.
import { EngineDSP } from './engine-dsp.js';
class DriftEngine extends AudioWorkletProcessor {
  constructor() {
    super(); this.d = new EngineDSP(sampleRate, 'porsche'); this.p = { rpm: 850, throttle: 0.05, boost: 0, limiter: false };
    this.port.onmessage = (e) => { if (e.data.profile) this.d.setProfile(e.data.profile); else Object.assign(this.p, e.data); };
  }
  process(_, outs) { const o = outs[0]; this.d.process(o[0], this.p); for (let c = 1; c < o.length; c++) o[c].set(o[0]); return true; }
}
registerProcessor('drift-engine', DriftEngine);
