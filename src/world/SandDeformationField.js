import * as THREE from 'three';
import { SandDeformationSimulation } from './SandDeformationSimulation.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Persistent deformation map shared by sand rendering and grounding. */
export class SandDeformationField {
  constructor({
    renderer = null,
    scene = null,
    resolution = 256,
    minX = -12,
    maxX = 12,
    minZ = -64,
    maxZ = -46,
    maxDepth = 0.2,
    decayPerSecond = 0.1,
  } = {}) {
    this.resolution = resolution;
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.maxDepth = maxDepth;
    this.decayPerSecond = decayPerSecond;
    this.data = new Uint8Array(resolution * resolution);
    this.bermData = new Uint8Array(resolution * resolution);
    this.compressionData = new Uint8Array(resolution * resolution);
    this.cpuTexture = new THREE.DataTexture(this.data, resolution, resolution, THREE.RedFormat, THREE.UnsignedByteType);
    this.cpuTexture.minFilter = THREE.LinearFilter;
    this.cpuTexture.magFilter = THREE.LinearFilter;
    this.cpuTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.cpuTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.cpuTexture.generateMipmaps = false;
    this.cpuTexture.needsUpdate = true;
    this.texture = this.cpuTexture;
    this.backend = 'cpuR8';
    this.simulation = null;
    const supportsFloatTargets = !renderer?.extensions || renderer.extensions.has('EXT_color_buffer_float');
    if (renderer?.capabilities?.isWebGL2 && supportsFloatTargets) {
      this.backend = 'gpuPingPong';
      this.simulation = new SandDeformationSimulation({ renderer, scene, resolution });
      this.texture = this.simulation.publishedTarget.texture;
    }
    this.dirty = false;
    this.decayAccumulator = 0;
    this.disposed = false;
  }

  toIndex(x, z) {
    const u = (x - this.minX) / (this.maxX - this.minX);
    const v = (z - this.minZ) / (this.maxZ - this.minZ);
    if (u < 0 || u > 1 || v < 0 || v > 1) return -1;
    const px = clamp(Math.round(u * (this.resolution - 1)), 0, this.resolution - 1);
    const py = clamp(Math.round(v * (this.resolution - 1)), 0, this.resolution - 1);
    return py * this.resolution + px;
  }

  stamp(x, z, radius, depth) {
    return this.brush(x, z, radius, depth, 0, 0, 0, 1, 0);
  }

  brush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
    if (this.disposed || radius <= 0 || this.toIndex(x, z) < 0) return false;
    const worldWidth = this.maxX - this.minX;
    const worldHeight = this.maxZ - this.minZ;
    const radiusX = radius * Math.max(elongation, 0.1);
    const radiusZ = radius;
    const minPx = clamp(Math.floor(((x - radiusX - this.minX) / worldWidth) * this.resolution), 0, this.resolution - 1);
    const maxPx = clamp(Math.ceil(((x + radiusX - this.minX) / worldWidth) * this.resolution), 0, this.resolution - 1);
    const minPy = clamp(
      Math.floor(((z - radiusZ - this.minZ) / worldHeight) * this.resolution),
      0,
      this.resolution - 1,
    );
    const maxPy = clamp(Math.ceil(((z + radiusZ - this.minZ) / worldHeight) * this.resolution), 0, this.resolution - 1);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    let changed = false;
    for (let py = minPy; py <= maxPy; py += 1) {
      const sampleZ = this.minZ + (py / (this.resolution - 1)) * worldHeight;
      for (let px = minPx; px <= maxPx; px += 1) {
        const sampleX = this.minX + (px / (this.resolution - 1)) * worldWidth;
        const dx = sampleX - x;
        const dz = sampleZ - z;
        const localX = (dx * cos + dz * sin) / radiusX;
        const localZ = (-dx * sin + dz * cos) / radiusZ;
        const distance = Math.hypot(localX, localZ);
        if (distance > 1) continue;
        const falloff = 1 - smoothstep(0, 1, distance);
        const index = py * this.resolution + px;
        const nextDepth = Math.max(this.data[index], Math.round(clamp(depth / this.maxDepth, 0, 1) * falloff * 255));
        const nextBerm = Math.max(
          this.bermData[index],
          Math.round(clamp(berm / this.maxDepth, 0, 1) * (0.2 + falloff * 0.8) * 255),
        );
        const nextCompression = Math.max(
          this.compressionData[index],
          Math.round(clamp(compression, 0, 1) * falloff * 255),
        );
        if (
          nextDepth !== this.data[index] ||
          nextBerm !== this.bermData[index] ||
          nextCompression !== this.compressionData[index]
        ) {
          this.data[index] = nextDepth;
          this.bermData[index] = nextBerm;
          this.compressionData[index] = nextCompression;
          changed = true;
        }
      }
    }
    if (!changed) return false;
    this.dirty = true;
    this.simulation?.queueBrush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
    return true;
  }

  advance(delta) {
    if (this.disposed || delta <= 0) return false;
    this.decayAccumulator += delta;
    if (this.decayAccumulator < 1 / 15) return false;
    const elapsed = this.decayAccumulator;
    this.decayAccumulator = 0;
    const multiplier = Math.max(0, 1 - this.decayPerSecond * elapsed);
    let changed = false;
    for (let index = 0; index < this.data.length; index += 1) {
      const depth = Math.floor(this.data[index] * multiplier);
      const berm = Math.floor(this.bermData[index] * multiplier);
      const compression = Math.floor(this.compressionData[index] * multiplier);
      if (depth !== this.data[index] || berm !== this.bermData[index] || compression !== this.compressionData[index]) {
        this.data[index] = depth;
        this.bermData[index] = berm;
        this.compressionData[index] = compression;
        changed = true;
      }
    }
    if (changed) this.dirty = true;
    if (this.simulation) {
      this.simulation.update(elapsed);
      this.texture = this.simulation.publishedTarget.texture;
    }
    return changed;
  }

  consumeDirty() {
    if (!this.dirty) return false;
    this.dirty = false;
    if (this.backend === 'cpuR8') this.cpuTexture.needsUpdate = true;
    return true;
  }

  sampleWorld(x, z) {
    const index = this.toIndex(x, z);
    if (index < 0) return { depth: 0, berm: 0, compression: 0 };
    return {
      depth: (this.data[index] / 255) * this.maxDepth,
      berm: (this.bermData[index] / 255) * this.maxDepth,
      compression: this.compressionData[index] / 255,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.simulation) {
      this.texture.dispose();
      this.cpuTexture.dispose();
      this.simulation.dispose();
    } else {
      this.cpuTexture.dispose();
    }
  }
}
