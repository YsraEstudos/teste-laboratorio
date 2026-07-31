import * as THREE from 'three';
import { SandDeformationSimulation } from './SandDeformationSimulation.js';
import { SAND_BOUNDS, isFiniteSandBrush } from './SandBounds.js';

const MAX_RELAX_STEP = 1;
const MAX_RELAX_PASSES = 256;
const TILE_SIZE = 16;
const DEFAULT_MAX_BRUSHES = 96;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Authoritative persistent sand deformation field.
 *
 * The CPU TypedArrays are the source of truth for both grounding and the
 * render textures. The optional GPU simulation is deliberately opt-in and is
 * never selected by a normal quality profile.
 */
export class SandDeformationField {
  constructor({
    renderer = null,
    scene = null,
    resolution = 256,
    width = resolution,
    height = resolution,
    minX = SAND_BOUNDS.minX,
    maxX = SAND_BOUNDS.maxX,
    minZ = SAND_BOUNDS.minZ,
    maxZ = SAND_BOUNDS.maxZ,
    maxDepth = 0.2,
    decayPerSecond = 0.1,
    maxBrushesPerFrame = DEFAULT_MAX_BRUSHES,
    experimentalGpu = false,
  } = {}) {
    this.width = Number.isInteger(width) && width > 1 ? width : 256;
    this.height = Number.isInteger(height) && height > 1 ? height : this.width;
    this.resolution = this.width;
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.maxDepth = Number.isFinite(maxDepth) && maxDepth > 0 ? maxDepth : 0.2;
    this.decayPerSecond = Number.isFinite(decayPerSecond) && decayPerSecond >= 0 ? decayPerSecond : 0.1;
    this.maxBrushesPerFrame =
      Number.isInteger(maxBrushesPerFrame) && maxBrushesPerFrame > 0 ? maxBrushesPerFrame : DEFAULT_MAX_BRUSHES;

    const cellCount = this.width * this.height;
    this.data = new Uint8Array(cellCount);
    this.bermData = new Uint8Array(cellCount);
    this.compressionData = new Uint8Array(cellCount);

    // RedFormat/R8 is compact on WebGL2. WebGL1 has no red-only texture
    // upload path, so keep the authoritative one-byte arrays and publish a
    // preallocated RGBA view without changing physics or allocating per frame.
    this.isWebGL2 = renderer?.capabilities ? renderer.capabilities.isWebGL2 === true : true;
    this.textureFormat = this.isWebGL2 ? THREE.RedFormat : THREE.RGBAFormat;
    this.uploadData = this.isWebGL2
      ? null
      : {
          depth: new Uint8Array(cellCount * 4),
          berm: new Uint8Array(cellCount * 4),
          compression: new Uint8Array(cellCount * 4),
        };

    this.cpuTexture = this._createChannelTexture(this.data, this.uploadData?.depth);
    this.bermTexture = this._createChannelTexture(this.bermData, this.uploadData?.berm);
    this.compressionTexture = this._createChannelTexture(this.compressionData, this.uploadData?.compression);
    this.texture = this.cpuTexture;

    this.backend = 'cpuR8';
    this.simulation = null;
    const supportsFloatTargets =
      !renderer?.extensions ||
      renderer.extensions.has?.('EXT_color_buffer_float') ||
      renderer.extensions.has?.('EXT_color_buffer_half_float');
    if (experimentalGpu && renderer?.capabilities?.isWebGL2 && supportsFloatTargets && this.width === this.height) {
      this.backend = 'gpuPingPong';
      this.simulation = new SandDeformationSimulation({
        renderer,
        scene,
        resolution: this.width,
        minX: this.minX,
        maxX: this.maxX,
        minZ: this.minZ,
        maxZ: this.maxZ,
        maxDepth: this.maxDepth,
        decayPerSecond: this.decayPerSecond,
      });
      this.texture = this.simulation.publishedTarget.texture;
    }

    this.brushCount = 0;
    this.pendingDirty = false;
    this.dirty = false;
    this.decayAccumulator = 0;
    this._lastRelaxSeconds = 0;
    this.disposed = false;
    this.stats = {
      acceptedBrushes: 0,
      droppedBrushes: 0,
      activeTiles: 0,
      textureUploads: 0,
    };

    this.tilesX = Math.ceil(this.width / TILE_SIZE);
    this.tilesY = Math.ceil(this.height / TILE_SIZE);
    this.activeTileFlags = new Uint8Array(this.tilesX * this.tilesY);
    this._defaultSampleOut = { depth: 0, berm: 0, compression: 0 };
  }

  _createChannelTexture(sourceData, uploadData = null) {
    const texture = new THREE.DataTexture(
      uploadData || sourceData,
      this.width,
      this.height,
      this.textureFormat,
      THREE.UnsignedByteType,
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  toIndex(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return -1;
    const u = (x - this.minX) / (this.maxX - this.minX);
    const v = (z - this.minZ) / (this.maxZ - this.minZ);
    if (u < 0 || u > 1 || v < 0 || v > 1) return -1;
    const px = clamp(Math.round(u * (this.width - 1)), 0, this.width - 1);
    const py = clamp(Math.round(v * (this.height - 1)), 0, this.height - 1);
    return py * this.width + px;
  }

  stamp(x, z, radius, depth) {
    const accepted = this.brush(x, z, radius, depth, 0, 0, 0, 1, 0);
    if (accepted) this.flush(0);
    return accepted;
  }

  brush(x, z, radius, depth, berm = 0, compression = 0, yaw = 0, elongation = 1, edge = 0) {
    if (
      this.disposed ||
      !isFiniteSandBrush(x, z, radius, depth, berm, compression, yaw, elongation, edge) ||
      radius <= 0 ||
      depth < 0 ||
      berm < 0 ||
      elongation <= 0
    ) {
      this.stats.droppedBrushes += 1;
      return false;
    }
    if (this.brushCount >= this.maxBrushesPerFrame) {
      this.stats.droppedBrushes += 1;
      return false;
    }

    this.brushCount += 1;
    this.stats.acceptedBrushes += 1;

    // Apply to the CPU authority immediately so physics sees the contact in
    // the same tick. flush() controls publication and texture upload.
    this._applyBrush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
    if (this.simulation) this.simulation.queueBrush(x, z, radius, depth, berm, compression, yaw, elongation, edge);
    return true;
  }

  _containsPoint(x, z) {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }

  _applyBrush(x, z, radius, depth, berm, compression, yaw, elongation, edge) {
    const worldWidth = this.maxX - this.minX;
    const worldHeight = this.maxZ - this.minZ;
    const radiusX = radius * Math.max(elongation, 0.1);
    const radiusZ = radius;
    const unclampedMinPx = Math.floor(((x - radiusX - this.minX) / worldWidth) * (this.width - 1));
    const unclampedMaxPx = Math.ceil(((x + radiusX - this.minX) / worldWidth) * (this.width - 1));
    const unclampedMinPy = Math.floor(((z - radiusZ - this.minZ) / worldHeight) * (this.height - 1));
    const unclampedMaxPy = Math.ceil(((z + radiusZ - this.minZ) / worldHeight) * (this.height - 1));

    if (unclampedMaxPx < 0 || unclampedMinPx >= this.width || unclampedMaxPy < 0 || unclampedMinPy >= this.height) {
      return false;
    }

    const minPx = clamp(unclampedMinPx, 0, this.width - 1);
    const maxPx = clamp(unclampedMaxPx, 0, this.width - 1);
    const minPy = clamp(unclampedMinPy, 0, this.height - 1);
    const maxPy = clamp(unclampedMaxPy, 0, this.height - 1);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const edgePower = 1 + clamp(edge, 0, 1);
    let changed = false;

    for (let py = minPy; py <= maxPy; py += 1) {
      const sampleZ = this.minZ + (py / (this.height - 1)) * worldHeight;
      for (let px = minPx; px <= maxPx; px += 1) {
        const sampleX = this.minX + (px / (this.width - 1)) * worldWidth;
        const dx = sampleX - x;
        const dz = sampleZ - z;
        const localX = (dx * cos + dz * sin) / radiusX;
        const localZ = (-dx * sin + dz * cos) / radiusZ;
        const distSq = localX * localX + localZ * localZ;
        if (distSq > 1.0) continue;

        const distance = Math.sqrt(distSq);
        const linearFalloff = 1 - smoothstep(0, 1, distance);
        const falloff = edge === 0 ? linearFalloff : linearFalloff ** edgePower;
        const index = py * this.width + px;
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
          this._markActiveTile(px, py);
          changed = true;
        }
      }
    }
    // The center sample is only meaningful when the brush anchor is inside the
    // field: clamping it to a border cell would stamp a full-strength center
    // value at the edge when the anchor sits outside the bounds.
    if (this._containsPoint(x, z)) {
      const centerPx = clamp(Math.round(((x - this.minX) / worldWidth) * (this.width - 1)), 0, this.width - 1);
      const centerPy = clamp(Math.round(((z - this.minZ) / worldHeight) * (this.height - 1)), 0, this.height - 1);
      const centerIndex = centerPy * this.width + centerPx;
      const centerDepth = Math.round(clamp(depth / this.maxDepth, 0, 1) * 255);
      const centerBerm = Math.round(clamp(berm / this.maxDepth, 0, 1) * 255);
      const centerCompression = Math.round(clamp(compression, 0, 1) * 255);
      if (
        centerDepth > this.data[centerIndex] ||
        centerBerm > this.bermData[centerIndex] ||
        centerCompression > this.compressionData[centerIndex]
      ) {
        this.data[centerIndex] = Math.max(this.data[centerIndex], centerDepth);
        this.bermData[centerIndex] = Math.max(this.bermData[centerIndex], centerBerm);
        this.compressionData[centerIndex] = Math.max(this.compressionData[centerIndex], centerCompression);
        this._markActiveTile(centerPx, centerPy);
        changed = true;
      }
    }
    this.pendingDirty ||= changed;
    return changed;
  }

  _markActiveTile(px, py) {
    const tileIndex = Math.floor(py / TILE_SIZE) * this.tilesX + Math.floor(px / TILE_SIZE);
    if (this.activeTileFlags[tileIndex] === 0) {
      this.activeTileFlags[tileIndex] = 1;
      this.stats.activeTiles += 1;
    }
  }

  _decayTile(tileX, tileY, stepFraction) {
    const startX = tileX * TILE_SIZE;
    const startY = tileY * TILE_SIZE;
    const endX = Math.min(startX + TILE_SIZE, this.width);
    const endY = Math.min(startY + TILE_SIZE, this.height);
    let changed = false;
    let active = false;

    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        const index = py * this.width + px;
        // Quantized proportional decay. A plain multiplier floors to a
        // constant -1 per step (full marks erased in ~17 s regardless of
        // decayPerSecond). Instead, subtract a per-cell amount proportional
        // to the current value, never dropping below 1 level per step, so
        // deep marks persist for ~1-2 minutes and shallow ones fade quickly.
        const depthLoss = Math.max(1, Math.round(stepFraction * this.data[index]));
        const bermLoss = Math.max(1, Math.round(stepFraction * this.bermData[index]));
        const compressionLoss = Math.max(1, Math.round(stepFraction * this.compressionData[index]));
        const depth = this.data[index] > depthLoss ? this.data[index] - depthLoss : 0;
        const berm = this.bermData[index] > bermLoss ? this.bermData[index] - bermLoss : 0;
        const compression =
          this.compressionData[index] > compressionLoss ? this.compressionData[index] - compressionLoss : 0;
        if (
          depth !== this.data[index] ||
          berm !== this.bermData[index] ||
          compression !== this.compressionData[index]
        ) {
          this.data[index] = depth;
          this.bermData[index] = berm;
          this.compressionData[index] = compression;
          changed = true;
        }
        active ||= depth > 0 || berm > 0 || compression > 0;
      }
    }

    if (!active) {
      const tileIndex = tileY * this.tilesX + tileX;
      if (this.activeTileFlags[tileIndex]) {
        this.activeTileFlags[tileIndex] = 0;
        this.stats.activeTiles -= 1;
      }
    }
    return changed;
  }

  _relax(delta) {
    this._lastRelaxSeconds = 0;
    if (this.stats.activeTiles === 0 || this.decayPerSecond <= 0) return false;
    this.decayAccumulator += delta;
    let changed = false;
    const stepFraction = this.decayPerSecond * MAX_RELAX_STEP;
    let passes = 0;
    // Bound a single call so a pathological delta (e.g. 100000 s) cannot run
    // thousands of blocking passes. Excess time stays in decayAccumulator and
    // is consumed by later flushes; _lastRelaxSeconds reports the seconds
    // actually consumed so the GPU simulation advances in lockstep.
    while (this.decayAccumulator >= MAX_RELAX_STEP && passes < MAX_RELAX_PASSES) {
      this.decayAccumulator -= MAX_RELAX_STEP;
      passes += 1;
      for (let tileY = 0; tileY < this.tilesY; tileY += 1) {
        for (let tileX = 0; tileX < this.tilesX; tileX += 1) {
          const tileIndex = tileY * this.tilesX + tileX;
          if (this.activeTileFlags[tileIndex]) {
            // NOTE: do not use `changed ||= this._decayTile(...)` — that
            // short-circuits and skips every tile after the first change,
            // leaving the deepest part of a multi-tile footprint untouched.
            changed = this._decayTile(tileX, tileY, stepFraction) || changed;
          }
        }
      }
    }
    this._lastRelaxSeconds = passes * MAX_RELAX_STEP;
    if (changed) this.pendingDirty = true;
    return changed;
  }

  flush(delta = 0) {
    if (this.disposed) return false;
    const hadBrushes = this.brushCount > 0;
    this.brushCount = 0;
    // Normalize the elapsed time so NaN/Infinity/negative deltas can never
    // reach the CPU decay loop or the GPU uDecay uniform.
    const elapsed = Number.isFinite(delta) && delta > 0 ? delta : 0;
    const relaxed = elapsed > 0 ? this._relax(elapsed) : false;
    if (this.simulation && (hadBrushes || relaxed)) {
      // Advance the GPU with the seconds the CPU actually relaxed (bounded by
      // MAX_RELAX_PASSES) instead of Math.max(delta, MAX_RELAX_STEP): a zero or
      // tiny delta must drain the brush queue without applying decay.
      this.simulation.update(relaxed ? this._lastRelaxSeconds : elapsed);
      this.texture = this.simulation.publishedTarget.texture;
    }
    if (hadBrushes || relaxed || this.pendingDirty) this.dirty = true;
    this.pendingDirty = false;
    return hadBrushes || relaxed;
  }

  advance(delta) {
    return this.flush(delta);
  }

  consumeDirty() {
    if (!this.dirty) return false;
    this.dirty = false;
    if (this.uploadData) {
      this._packChannel(this.data, this.uploadData.depth);
      this._packChannel(this.bermData, this.uploadData.berm);
      this._packChannel(this.compressionData, this.uploadData.compression);
    }
    this.cpuTexture.needsUpdate = true;
    this.bermTexture.needsUpdate = true;
    this.compressionTexture.needsUpdate = true;
    this.stats.textureUploads += 1;
    return true;
  }

  _packChannel(source, target) {
    for (let index = 0; index < source.length; index += 1) {
      target[index * 4] = source[index];
    }
  }

  sampleWorld(x, z, out = null) {
    const target = out || this._defaultSampleOut;
    const index = this.toIndex(x, z);
    if (index < 0) {
      target.depth = 0;
      target.berm = 0;
      target.compression = 0;
      return target;
    }
    target.depth = (this.data[index] / 255) * this.maxDepth;
    target.berm = (this.bermData[index] / 255) * this.maxDepth;
    target.compression = this.compressionData[index] / 255;
    return target;
  }

  getTexture() {
    return this.texture;
  }

  serialize() {
    return {
      version: 1,
      width: this.width,
      height: this.height,
      minX: this.minX,
      maxX: this.maxX,
      minZ: this.minZ,
      maxZ: this.maxZ,
      maxDepth: this.maxDepth,
      depth: Array.from(this.data),
      berm: Array.from(this.bermData),
      compression: Array.from(this.compressionData),
    };
  }

  restore(snapshot) {
    if (
      this.disposed ||
      (this.backend !== 'cpuR8' && this.backend !== 'gpuPingPong') ||
      !snapshot ||
      snapshot.version !== 1
    )
      return false;
    if (
      snapshot.width !== this.width ||
      snapshot.height !== this.height ||
      snapshot.minX !== this.minX ||
      snapshot.maxX !== this.maxX ||
      snapshot.minZ !== this.minZ ||
      snapshot.maxZ !== this.maxZ ||
      snapshot.maxDepth !== this.maxDepth
    )
      return false;

    const channels = [snapshot.depth, snapshot.berm, snapshot.compression];
    for (const channel of channels) {
      if (!channel || channel.length !== this.data.length) return false;
      for (let index = 0; index < channel.length; index += 1) {
        if (!Number.isInteger(channel[index]) || channel[index] < 0 || channel[index] > 255) return false;
      }
    }

    this.data.set(snapshot.depth);
    this.bermData.set(snapshot.berm);
    this.compressionData.set(snapshot.compression);
    this.activeTileFlags.fill(0);
    this.stats.activeTiles = 0;
    for (let py = 0; py < this.height; py += 1) {
      for (let px = 0; px < this.width; px += 1) {
        const index = py * this.width + px;
        if (this.data[index] || this.bermData[index] || this.compressionData[index]) {
          this._markActiveTile(px, py);
        }
      }
    }
    this.brushCount = 0;
    this.pendingDirty = false;
    this.decayAccumulator = 0;
    this.dirty = true;

    // Keep the GPU render pass in sync with the restored authority: drop any
    // queued brushes and re-upload the restored channels into the ping-pong
    // targets before the snapshot is exposed through this.texture.
    if (this.simulation) {
      this.simulation.brushCount = 0;
      this.simulation.uploadChannels(this.data, this.bermData, this.compressionData);
      this.texture = this.simulation.publishedTarget.texture;
    }
    return true;
  }

  getStats() {
    return {
      backend: this.backend,
      resolution: this.resolution,
      width: this.width,
      height: this.height,
      acceptedBrushes: this.stats.acceptedBrushes,
      droppedBrushes: this.stats.droppedBrushes,
      activeTiles: this.stats.activeTiles,
      textureUploads: this.stats.textureUploads,
      textureFormat: this.textureFormat === THREE.RedFormat ? 'r8' : 'rgba8',
      authoritativeBytes: this.data.byteLength + this.bermData.byteLength + this.compressionData.byteLength,
      uploadBytes: this.uploadData
        ? this.uploadData.depth.byteLength + this.uploadData.berm.byteLength + this.uploadData.compression.byteLength
        : this.data.byteLength + this.bermData.byteLength + this.compressionData.byteLength,
      readback: false,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.simulation) {
      this.simulation.dispose();
    }
    this.cpuTexture.dispose();
    this.bermTexture.dispose();
    this.compressionTexture.dispose();
  }
}
