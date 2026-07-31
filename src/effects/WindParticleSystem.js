import * as THREE from 'three';

/**
 * Three.quarks based Wind Particle System
 * Triggers abilities using ParticlePresetRegistry through VFXManager.
 */
export class WindParticleSystem {
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;
    this._audioContext = null;
  }

  // eslint-disable-next-line no-unused-vars
  triggerWindBlast(origin, target, powerLevel = 1, _impulse = null) {
    if (!this.vfxManager) return;

    // Play dynamic ability effects
    this._loadAndPlay('VortexBlast', origin, target, powerLevel);
    this._loadAndPlay('GroundDustBurst', origin, target, powerLevel);
    this._loadAndPlay('ShockwaveRing', origin, target, powerLevel);
    this._loadAndPlay('ImpactPlume', target, target, powerLevel, true);

    // Connect emission bursts with synthetic audio cue
    this._playBlastSound(powerLevel);
  }

  async _loadAndPlay(presetName, origin, target, powerLevel, isImpact = false) {
    try {
      await this.vfxManager.loadPreset(presetName, `vfx/${presetName}.json`);
      const pos = isImpact ? target : origin;
      const effect = this.vfxManager.playEffect(presetName, pos);

      if (effect && !isImpact) {
        const dir = new THREE.Vector3().subVectors(target, origin).normalize();
        if (dir.lengthSq() > 0) {
          effect.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        }
      }
    } catch {
      // Ignore if preset isn't created yet or URL fails
    }
  }

  _playBlastSound(powerLevel) {
    // A synthetic wind blast impact sound for emission burst timing
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this._audioContext) {
        this._audioContext = new AudioContext();
      }

      const ctx = this._audioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const duration = 0.5 + powerLevel * 0.1;

      // Noise buffer for the burst
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(400 + powerLevel * 200, ctx.currentTime);
      bandpass.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
      bandpass.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5 + powerLevel * 0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + duration);
    } catch {
      // Audio not supported or failed
    }
  }

  // eslint-disable-next-line no-unused-vars
  update(_delta) {
    // VFXManager takes care of three.quarks updates.
  }

  dispose() {
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}
