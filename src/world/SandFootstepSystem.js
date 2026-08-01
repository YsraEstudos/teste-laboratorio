import { SAND_BOUNDS, containsSandPoint } from './SandBounds.js';

const DEFAULT_MAX_ACTORS = 16;
const DEFAULT_TELEPORT_DISTANCE = 4;
const OOB_MARGIN = 0.05;

/**
 * Alternating, individual footprints on the sand.
 *
 * - 'player' actors step on an animation-phase boundary (0.5 of a gait
 *   cycle) gated by a minimum travelled distance, so steps only appear
 *   while actually moving and alternate left/right starting on the left.
 * - 'child' and 'generic' actors step purely by accumulated distance.
 * - Teleports (jump > 4 m between updates) reset the stepping state.
 *
 * Foot positions come from the registered offset: either a static local
 * {x, z} offset rotated by the actor's yaw, or a function that resolves
 * the animated world anchor (e.g. the sole of a boot) into a scratch
 * vector. All state lives in preallocated typed arrays; no per-frame
 * allocations.
 */
export class SandFootstepSystem {
  constructor({
    bounds = SAND_BOUNDS,
    maxActors = DEFAULT_MAX_ACTORS,
    teleportResetDistance = DEFAULT_TELEPORT_DISTANCE,
    onFootprint = null,
  } = {}) {
    this.bounds = bounds;
    this.maxActors = maxActors;
    this.teleportResetDistance = teleportResetDistance;
    this.onFootprint = onFootprint;
    this.sandVFX = null;
    this.disposed = false;

    this.actorIds = new Array(maxActors).fill(null);
    this.actorProfiles = new Array(maxActors).fill(null); // 'player' | 'child' | 'generic'
    this.actorLeftOffset = new Array(maxActors).fill(null); // {x, z} | function(out)
    this.actorRightOffset = new Array(maxActors).fill(null);
    this.actorWidth = new Float32Array(maxActors);
    this.actorLength = new Float32Array(maxActors);
    this.actorMinStep = new Float32Array(maxActors);
    this.actorX = new Float32Array(maxActors);
    this.actorZ = new Float32Array(maxActors);
    this.actorDistance = new Float32Array(maxActors);
    this.actorPrevPhase = new Float32Array(maxActors);
    this.actorInitialized = new Uint8Array(maxActors);
    // 0 = left, 1 = right. Initialized to 1 so the first step is the left foot.
    this.actorLastSide = new Uint8Array(maxActors).fill(1);

    this._scratchFoot = { x: 0, z: 0 };
    this.stepsThisFrame = 0;
    this.acceptedFootprints = 0;
    this.droppedFootprints = 0;
    this.discardedOutOfBounds = 0;
    this.stepsLeft = 0;
    this.stepsRight = 0;
  }

  beginFrame() {
    if (this.disposed) return;
    this.stepsThisFrame = 0;
  }

  _findActor(id) {
    for (let index = 0; index < this.maxActors; index += 1) {
      if (this.actorIds[index] === id) return index;
    }
    for (let index = 0; index < this.maxActors; index += 1) {
      if (this.actorIds[index] === null) {
        this.actorIds[index] = id;
        this.actorProfiles[index] = 'generic';
        this.actorLeftOffset[index] = { x: 0, z: 0 };
        this.actorRightOffset[index] = { x: 0, z: 0 };
        this.actorWidth[index] = 0.15;
        this.actorLength[index] = 0.29;
        this.actorMinStep[index] = 0.2;
        this.actorInitialized[index] = 0;
        this.actorLastSide[index] = 1;
        return index;
      }
    }
    return -1;
  }

  /**
   * Registers (or replaces) an actor's stepping configuration.
   * @param {string} id
   * @param {{
   *   footprintProfile?: 'player' | 'child' | 'generic',
   *   leftOffset?: {x: number, z: number} | ((out: {x: number, z: number}) => void),
   *   rightOffset?: {x: number, z: number} | ((out: {x: number, z: number}) => void),
   *   width?: number,
   *   length?: number,
   *   minStepDistance?: number,
   * }} [config]
   * @returns {boolean}
   */
  registerActor(
    id,
    {
      footprintProfile = 'generic',
      leftOffset = { x: 0, z: 0 },
      rightOffset = { x: 0, z: 0 },
      width = 0.15,
      length = 0.29,
      minStepDistance = 0.2,
    } = {},
  ) {
    if (this.disposed || typeof id !== 'string' || id.length === 0) return false;
    const index = this._findActor(id);
    if (index < 0) return false;
    this.actorProfiles[index] = footprintProfile;
    this.actorLeftOffset[index] = leftOffset;
    this.actorRightOffset[index] = rightOffset;
    this.actorWidth[index] = width;
    this.actorLength[index] = length;
    this.actorMinStep[index] = minStepDistance;
    return true;
  }

  hasDetailedFootprints(id) {
    const index = this.actorIds.indexOf(id);
    if (index < 0) return false;
    return this.actorProfiles[index] === 'player' || this.actorProfiles[index] === 'child';
  }

  setSandVFX(sandVFX) {
    if (this.disposed) return;
    this.sandVFX = sandVFX;
  }

  _resolveFoot(index, position, yaw, side) {
    const offset = side === 0 ? this.actorLeftOffset[index] : this.actorRightOffset[index];
    const scratch = this._scratchFoot;
    if (typeof offset === 'function') {
      scratch.x = position.x;
      scratch.z = position.z;
      offset(scratch);
      if (!Number.isFinite(scratch.x) || !Number.isFinite(scratch.z)) {
        scratch.x = position.x;
        scratch.z = position.z;
      }
      return;
    }
    const ox = offset?.x ?? 0;
    const oz = offset?.z ?? 0;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    scratch.x = position.x + ox * cosYaw + oz * sinYaw;
    scratch.z = position.z - ox * sinYaw + oz * cosYaw;
  }

  /**
   * Advances the actor's stepping state. At most one footprint per call.
   * @param {string} id
   * @param {{x: number, z: number}} position - actor root position
   * @param {number} yaw - heading, same convention as atan2(dx, dz)
   * @param {number} delta
   * @param {number|null} [animPhase] - phase in gait cycles (0..1 per cycle);
   *   required for 'player' stepping, ignored for distance-only actors
   * @returns {boolean}
   */
  updateActor(id, position, yaw, delta, animPhase = null) {
    if (this.disposed || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const index = this._findActor(id);
    if (index < 0) return false;
    const profile = this.actorProfiles[index];

    if (!containsSandPoint(position.x, position.z, OOB_MARGIN, this.bounds)) {
      this.discardedOutOfBounds += 1;
      this.actorInitialized[index] = 0;
      this.actorX[index] = position.x;
      this.actorZ[index] = position.z;
      this.actorDistance[index] = 0;
      this.actorPrevPhase[index] = Number.isFinite(animPhase) ? animPhase : 0;
      return false;
    }

    if (!this.actorInitialized[index]) {
      this.actorInitialized[index] = 1;
      this.actorX[index] = position.x;
      this.actorZ[index] = position.z;
      this.actorDistance[index] = 0;
      this.actorPrevPhase[index] = Number.isFinite(animPhase) ? animPhase : 0;
      return false;
    }

    const dx = position.x - this.actorX[index];
    const dz = position.z - this.actorZ[index];
    const distSq = dx * dx + dz * dz;

    // Teleport (or resume) resets stepping state without leaving a mark.
    const teleportSq = this.teleportResetDistance * this.teleportResetDistance;
    if (distSq > teleportSq) {
      this.actorInitialized[index] = 0;
      this.actorX[index] = position.x;
      this.actorZ[index] = position.z;
      this.actorDistance[index] = 0;
      this.actorPrevPhase[index] = Number.isFinite(animPhase) ? animPhase : 0;
      return false;
    }

    this.actorX[index] = position.x;
    this.actorZ[index] = position.z;
    this.actorDistance[index] += Math.sqrt(distSq);

    let stepTick = false;
    if (profile === 'player') {
      // A crossing of a 0.5 boundary in the gait cycle = one foot plant.
      const phase = Number.isFinite(animPhase) ? animPhase : 0;
      if (Math.floor(this.actorPrevPhase[index] * 2) !== Math.floor(phase * 2)) stepTick = true;
      this.actorPrevPhase[index] = phase;
    } else {
      // Distance-only actors (child/generic) step whenever the gate is met.
      stepTick = true;
    }

    if (!stepTick) return false;
    if (this.actorDistance[index] < this.actorMinStep[index]) return false;
    this.actorDistance[index] = 0;
    if (this.stepsThisFrame >= this.maxActors) return false;
    this.stepsThisFrame += 1;

    // Alternate sides; the first step is the left foot.
    this.actorLastSide[index] = this.actorLastSide[index] === 0 ? 1 : 0;
    const side = this.actorLastSide[index];

    this._resolveFoot(index, position, yaw, side);
    const accepted =
      this.onFootprint?.(this._scratchFoot.x, this._scratchFoot.z, yaw, {
        width: this.actorWidth[index],
        length: this.actorLength[index],
      }) !== false;

    if (accepted) {
      this.acceptedFootprints += 1;
      if (side === 0) this.stepsLeft += 1;
      else this.stepsRight += 1;
      this.sandVFX?.triggerSandFootstepAt?.(this._scratchFoot.x, this._scratchFoot.z);
    } else {
      this.droppedFootprints += 1;
    }
    return accepted;
  }

  getStats() {
    let registered = 0;
    for (let index = 0; index < this.actorIds.length; index += 1) {
      if (this.actorIds[index] !== null) registered += 1;
    }
    return {
      registered,
      acceptedFootprints: this.acceptedFootprints,
      droppedFootprints: this.droppedFootprints,
      discardedOutOfBounds: this.discardedOutOfBounds,
      stepsLeft: this.stepsLeft,
      stepsRight: this.stepsRight,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.onFootprint = null;
    this.sandVFX = null;
    this.actorIds.fill(null);
    this.actorProfiles.fill(null);
    this.actorLeftOffset.fill(null);
    this.actorRightOffset.fill(null);
  }
}
