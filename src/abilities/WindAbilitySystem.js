import { WindAbilityConfig } from './WindAbilityConfig.js';

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
    this.config = Object.freeze({ ...WindAbilityConfig, ...config });
    this.onRelease = onRelease;
    this.state = 'ready';
    this.elapsed = 0;
    this.paused = false;
    this.disposed = false;
    this.snapshot = null;
  }

  start(snapshot) {
    if (this.disposed || this.paused || this.state !== 'ready' || this.owner.energy < this.config.energyCost) {
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

    this.elapsed += delta;

    if (this.state === 'charging' && this.elapsed >= this.config.chargeSeconds) {
      this._release();
      return;
    }

    if (this.state === 'cooldown' && this.elapsed >= this.config.cooldownSeconds) {
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
    this.owner.energy = Math.max(0, this.owner.energy - this.config.energyCost);
    this.snapshot = null;
    this.elapsed = 0;
    this.state = 'cooldown';
    this.onRelease(snapshot);
  }
}
