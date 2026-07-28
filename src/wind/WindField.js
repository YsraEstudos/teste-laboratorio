import * as THREE from 'three';
import { ROOMS } from '../world/RoomData.js';

const TAU = Math.PI * 2;
const WIND_PROFILES = Object.freeze({
  entrance: [0.9, 0.85, -0.2],
  central: [0.8, 0.75, 0.3],
  green: [1.3, 1.45, 0.15],
  standard: [1.02, 1, 0],
  testing: [1.55, 1.7, -0.1],
});

/**
 * Continuous airflow model for the laboratory. It combines slow weather drift,
 * short gusts, room-specific ventilation, and position-dependent turbulence.
 */
export class WindField {
  constructor(rooms = ROOMS) {
    this.rooms = rooms;
    this.time = 0;
    this.baseAngle = -0.72;
    this.targetAngle = this.baseAngle;
    this.baseStrength = 1.25;
    this.targetStrength = this.baseStrength;
    this.gustAge = 0;
    this.gustDelay = 3.5 + Math.random() * 5;
    this.gustDuration = 0;
    this.gustStrength = 0;
    this.gustAngleOffset = 0;
    this.gustIntensity = 0;
    this.intensity = 0;
    this._zoneMultiplier = 0.68;
    this._zoneGustMultiplier = 0.55;
    this._zoneAngleOffset = 0;
  }

  update(delta) {
    this.time += delta;
    const driftBlend = 1 - Math.exp(-delta * 0.08);
    this.baseAngle += this._angleDelta(this.targetAngle, this.baseAngle) * driftBlend;
    this.baseStrength += (this.targetStrength - this.baseStrength) * driftBlend;

    if (Math.abs(this._angleDelta(this.targetAngle, this.baseAngle)) < 0.015 && Math.random() < delta * 0.025) {
      this.targetAngle += (Math.random() - 0.5) * 1.2;
      this.targetStrength = 0.8 + Math.random() * 1.15;
    }

    this.gustAge += delta;
    if (this.gustDuration === 0 && this.gustAge >= this.gustDelay) {
      this.gustAge = 0;
      this.gustDuration = 1.8 + Math.random() * 3.4;
      this.gustStrength = 1.5 + Math.random() * 2.8;
      this.gustAngleOffset = (Math.random() - 0.5) * 0.52;
    }

    if (this.gustDuration > 0) {
      const progress = this.gustAge / this.gustDuration;
      if (progress >= 1) {
        this.gustDuration = 0;
        this.gustAge = 0;
        this.gustDelay = 4 + Math.random() * 11;
        this.gustIntensity = 0;
      } else {
        // A smooth attack and falloff keeps gusts forceful without abrupt changes.
        this.gustIntensity = Math.sin(progress * Math.PI) ** 1.35;
      }
    }

    this.intensity = this.baseStrength + this.gustStrength * this.gustIntensity;
  }

  sample(position, out) {
    this._applyZone(position.x, position.z);
    const height = THREE.MathUtils.smoothstep(position.y, 0.04, 2.8);
    const roomStrength = this.baseStrength * this._zoneMultiplier
      + this.gustStrength * this.gustIntensity * this._zoneGustMultiplier;
    const directionalNoise = Math.sin(position.z * 0.13 + this.time * 0.55)
      + Math.sin(position.x * 0.21 - this.time * 0.38) * 0.55;
    const angle = this.baseAngle + this._zoneAngleOffset + directionalNoise * 0.12
      + this.gustAngleOffset * this.gustIntensity;

    // Near-floor flow is slower, while low-frequency curls make dust peel away from walls.
    const speed = roomStrength * (0.18 + height * 0.82);
    const curlX = Math.sin(position.z * 0.37 + this.time * 1.7) * 0.38
      + Math.cos(position.y * 1.2 + this.time * 1.1) * 0.14;
    const curlZ = Math.cos(position.x * 0.31 - this.time * 1.45) * 0.38
      + Math.sin(position.y * 0.9 + this.time * 1.3) * 0.14;
    const lift = Math.sin(position.x * 0.26 + position.z * 0.18 + this.time * 1.8)
      * (0.08 + this.gustIntensity * 0.28) * height;

    out.set(Math.cos(angle) * speed + curlX, lift, Math.sin(angle) * speed + curlZ);
    return out;
  }

  getStrengthAt(position) {
    this._applyZone(position.x, position.z);
    return this.baseStrength * this._zoneMultiplier
      + this.gustStrength * this.gustIntensity * this._zoneGustMultiplier;
  }

  _applyZone(x, z) {
    for (const room of this.rooms) {
      if (x < room.minX || x > room.maxX || z < room.minZ || z > room.maxZ) continue;
      const profile = WIND_PROFILES[room.windProfile] ?? WIND_PROFILES.standard;
      return this._setZone(...profile);
    }

    this._setZone(0.68, 0.55, 0);
  }

  _setZone(multiplier, gustMultiplier, angleOffset) {
    this._zoneMultiplier = multiplier;
    this._zoneGustMultiplier = gustMultiplier;
    this._zoneAngleOffset = angleOffset;
  }

  _angleDelta(target, current) {
    return ((target - current + Math.PI) % TAU) - Math.PI;
  }
}
