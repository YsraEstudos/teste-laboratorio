import { SAND_BOUNDS, containsSandPoint } from './SandBounds.js';

const DEFAULT_MAX_ACTORS = 8;

/** Bounded, allocation-free contact sampler for player, Wind Child and objects. */
export class SandContactSystem {
  constructor({
    bounds = SAND_BOUNDS,
    maxActors = DEFAULT_MAX_ACTORS,
    minDistance = 0.35,
    minInterval = 0.12,
    maxInterpolatedSteps = 4,
    maxBrushesPerFrame = 96,
    onContact = null,
  } = {}) {
    this.bounds = bounds;
    this.maxActors = maxActors;
    this.minDistance = minDistance;
    this.minInterval = minInterval;
    this.maxInterpolatedSteps = maxInterpolatedSteps;
    this.maxBrushesPerFrame = maxBrushesPerFrame;
    this.onContact = onContact;
    this.actorIds = new Array(maxActors).fill(null);
    this.actorX = new Float32Array(maxActors);
    this.actorZ = new Float32Array(maxActors);
    this.actorElapsed = new Float32Array(maxActors);
    this.actorInitialized = new Uint8Array(maxActors);
    this.brushesThisFrame = 0;
    this.droppedContacts = 0;
    this.acceptedContacts = 0;
    this.disposed = false;
  }

  beginFrame() {
    if (this.disposed) return;
    this.brushesThisFrame = 0;
  }

  _findActor(id) {
    for (let index = 0; index < this.maxActors; index += 1) {
      if (this.actorIds[index] === id) return index;
    }
    for (let index = 0; index < this.maxActors; index += 1) {
      if (this.actorIds[index] === null) {
        this.actorIds[index] = id;
        return index;
      }
    }
    return -1;
  }

  updateActor(id, position, delta, radius = 0.35, depth = 0.12, berm = 0.03, compression = 0.7, source = 'actor') {
    if (this.disposed || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const index = this._findActor(id);
    if (index < 0) return false;
    const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 0;
    this.actorElapsed[index] += safeDelta;

    if (!containsSandPoint(position.x, position.z, 0, this.bounds)) {
      this.actorInitialized[index] = 0;
      this.actorX[index] = position.x;
      this.actorZ[index] = position.z;
      return false;
    }

    if (!this.actorInitialized[index]) {
      this.actorInitialized[index] = 1;
      this.actorX[index] = position.x;
      this.actorZ[index] = position.z;
      this.actorElapsed[index] = 0;
      return false;
    }

    const previousX = this.actorX[index];
    const previousZ = this.actorZ[index];
    const dx = position.x - previousX;
    const dz = position.z - previousZ;
    const distSq = dx * dx + dz * dz;
    const minDistSq = this.minDistance * this.minDistance;
    if (distSq === 0 || (distSq < minDistSq && this.actorElapsed[index] < this.minInterval)) return false;

    const distance = Math.sqrt(distSq);
    const steps = Math.min(this.maxInterpolatedSteps, Math.max(1, Math.ceil(distance / this.minDistance)));
    const yaw = Math.atan2(dx, dz);
    let accepted = false;
    for (let step = 1; step <= steps; step += 1) {
      if (this.brushesThisFrame >= this.maxBrushesPerFrame) {
        this.droppedContacts += steps - step + 1;
        break;
      }
      const t = step / steps;
      const x = previousX + dx * t;
      const z = previousZ + dz * t;
      const handled = this.onContact?.(x, z, radius, depth, berm, compression, yaw, 1, 0, source) !== false;
      if (handled) {
        this.brushesThisFrame += 1;
        this.acceptedContacts += 1;
        accepted = true;
      } else {
        this.droppedContacts += 1;
      }
    }
    this.actorX[index] = position.x;
    this.actorZ[index] = position.z;
    this.actorElapsed[index] = 0;
    return accepted;
  }

  updateWake(id, position, delta, radius = 0.3, depth = 0.06, berm = 0.02, compression = 0.45) {
    return this.updateActor(id, position, delta, radius, depth, berm, compression, 'wake');
  }

  getStats() {
    return {
      acceptedContacts: this.acceptedContacts,
      droppedContacts: this.droppedContacts,
      brushesThisFrame: this.brushesThisFrame,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.onContact = null;
    this.actorIds.fill(null);
    this.actorInitialized.fill(0);
  }
}
