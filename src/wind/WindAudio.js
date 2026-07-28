/**
 * Procedural ventilation/wind bed. It uses WebAudio noise so the scene does
 * not need an external asset and can follow each gust in real time.
 */
export class WindAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.lowpass = null;
    this.whistle = null;
    this.windLevel = 0;
    this.started = false;
  }

  start() {
    if (this.started) {
      this.context?.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.985;
      data[i] = brown;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    this.lowpass = this.context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 420;
    this.lowpass.Q.value = 0.45;
    this.whistle = this.context.createBiquadFilter();
    this.whistle.type = 'bandpass';
    this.whistle.frequency.value = 880;
    this.whistle.Q.value = 3.2;
    const whistleGain = this.context.createGain();
    whistleGain.gain.value = 0;
    this.whistleGain = whistleGain;
    this.master = this.context.createGain();
    this.master.gain.value = 0;

    source.connect(this.lowpass);
    this.lowpass.connect(this.master);
    source.connect(this.whistle);
    this.whistle.connect(whistleGain);
    whistleGain.connect(this.master);
    this.master.connect(this.context.destination);
    source.start();
    this.source = source;
    this.started = true;
    this.context.resume();
  }

  update(delta, intensity, gustIntensity) {
    if (!this.started || !this.context) return;
    const blend = 1 - Math.exp(-delta * 3.5);
    const target = Math.min(1, Math.max(0, (intensity - 0.55) / 4.5));
    this.windLevel += (target - this.windLevel) * blend;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.windLevel * 0.12, now, 0.12);
    this.lowpass.frequency.setTargetAtTime(260 + this.windLevel * 1450, now, 0.12);
    this.whistle.frequency.setTargetAtTime(620 + gustIntensity * 1200, now, 0.08);
    this.whistleGain.gain.setTargetAtTime(gustIntensity * gustIntensity * 0.045, now, 0.08);
  }

  suspend() {
    if (this.context?.state === 'running') this.context.suspend();
  }

  resume() {
    if (this.started) this.context?.resume();
  }

  dispose() {
    if (!this.context) return;
    this.source?.stop();
    this.source?.disconnect();
    this.lowpass?.disconnect();
    this.whistle?.disconnect();
    this.whistleGain?.disconnect();
    this.master?.disconnect();
    this.context.close();
    this.context = null;
    this.started = false;
  }
}
