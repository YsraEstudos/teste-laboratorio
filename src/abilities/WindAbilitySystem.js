import { WindAbilityConfig } from './WindAbilityConfig.js';

function normalizeConfig(config) {
  const merged = { ...WindAbilityConfig, ...config };
  return Object.freeze({
    ...merged,
    chargeDuration: config.chargeDuration ?? config.chargeSeconds ?? WindAbilityConfig.chargeDuration,
    cooldownDuration: config.cooldownDuration ?? config.cooldownSeconds ?? WindAbilityConfig.cooldownDuration,
  });
}

function freezeSnapshot(snapshot) {
  return Object.freeze({
    targetObject: snapshot.targetObject,
    origin: Object.freeze(snapshot.origin.clone()),
    target: Object.freeze(snapshot.target.clone()),
    powerLevel: snapshot.powerLevel,
    happiness: snapshot.happiness,
    energy: snapshot.energy,
  });
}

export class WindAbilitySystem {
  constructor({ owner, config = WindAbilityConfig, onRelease = () => {} }) {
    this.owner = owner;
    this.config = normalizeConfig(config);
    this.onRelease = onRelease;
    this.state = 'ready';
    this.elapsed = 0;
    this.paused = false;
    this.disposed = false;
    this.snapshot = null;
  }

  start(snapshot) {
    const requiredEnergy = this.config.minimumEnergy + this.config.energyCost;
    if (this.disposed || this.paused || this.state !== 'ready' || this.owner.energy < requiredEnergy) {
      return false;
    }

    this.snapshot = freezeSnapshot(snapshot);
    this.elapsed = 0;
    this.state = 'charging';
    this.owner.startCharging();
    return true;
  }

  update(delta) {
    if (this.disposed || this.paused || !Number.isFinite(delta) || delta <= 0) return;

    if (this.state === 'ready' || this.state === 'cooldown') this._recoverEnergy(delta);
    this.elapsed += delta;

    if (this.state === 'charging' && this.elapsed >= this.config.chargeDuration) {
      this._release();
      return;
    }

    if (this.state === 'cooldown' && this.elapsed >= this.config.cooldownDuration) {
      this.elapsed = 0;
      this.state = 'ready';
    }
  }

  pause() {
    if (this.disposed) return;

    this.paused = true;
    if (this.state === 'charging') {
      this.owner.stopCharging();
      this.snapshot = null;
      this.elapsed = 0;
      this.state = 'ready';
    }
  }

  resume() {
    if (this.disposed) return;
    this.paused = false;
  }

  getState() {
    const isCoolingDown = this.state === 'cooldown';
    return Object.freeze({
      state: this.state,
      elapsed: this.elapsed,
      remaining: isCoolingDown ? Math.max(0, this.config.cooldownDuration - this.elapsed) : 0,
      energy: this.owner?.energy ?? 0,
      canRelease:
        !this.disposed &&
        !this.paused &&
        this.state === 'ready' &&
        (this.owner?.energy ?? 0) >= this.config.minimumEnergy + this.config.energyCost,
    });
  }

  dispose() {
    if (this.disposed) return;

    if (this.state === 'charging') this.owner.stopCharging();
    this.snapshot = null;
    this.elapsed = 0;
    this.state = 'ready';
    this.paused = true;
    this.disposed = true;
    this.onRelease = null;
    this.owner = null;
  }

  _release() {
    const snapshot = this.snapshot;
    if (!snapshot) return;

    this.owner.stopCharging();
    this.owner.releaseWindBlast();
    this.owner.energy = Math.max(this.config.minimumEnergy, this.owner.energy - this.config.energyCost);
    this.snapshot = null;
    this.elapsed = 0;
    this.state = 'cooldown';
    this.onRelease(snapshot);
  }

  _recoverEnergy(delta) {
    this.owner.energy = Math.min(100, this.owner.energy + this.config.energyRecoveryRate * delta);
  }
}
