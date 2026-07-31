// @ts-check
import * as THREE from 'three';
import {
  ParticleSystem,
  ParticleEmitter,
  ConstantValue,
  IntervalValue,
  ColorRange,
  Vector4,
  RectangleEmitter,
  ConeEmitter,
  SphereEmitter,
  SizeOverLife,
  ColorOverLife,
  PiecewiseBezier,
  RenderMode,
} from 'three.quarks';
import { containsSandPoint } from '../world/SandBounds.js';
import { getSandQuality } from '../world/SandQualityProfile.js';

/**
 * SandVFXSystem - fixed-pool three.quarks effects for the sand arena.
 *
 * Particle systems are created and registered once during initialization.
 * Contacts only reposition and replay an existing pool item, so a crowded
 * frame does not allocate ParticleSystem, ParticleEmitter, or timer objects.
 */
export class SandVFXSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./VFXManager.js').VFXManager} vfxManager
   * @param {{quality?: 'low'|'medium'|'high'}} [options]
   */
  constructor(scene, vfxManager, options = {}) {
    this.scene = scene;
    this.vfxManager = vfxManager;
    this.quality = options.quality || 'high';
    this.profile = getSandQuality(this.quality);
    this.disposed = false;
    this.elapsed = 0;
    this.triggeredFootsteps = 0;
    this.triggeredBlasts = 0;
    this.droppedEffects = 0;
    this.lastPlayerFootstepTime = 0;
    this.lastChildFootstepTime = 0;
    this.ambientEmitter = null;
    this.ambientSystem = null;
    this.footstepPool = [];
    this.blastPool = [];

    this._initCanvasTexture();
    this._initAmbientSandQuarksSystem();
    this._initEffectPools();
  }

  _initCanvasTexture() {
    let canvas = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
          grad.addColorStop(0, 'rgba(255, 235, 180, 1.0)');
          grad.addColorStop(0.4, 'rgba(230, 180, 90, 0.8)');
          grad.addColorStop(0.8, 'rgba(190, 140, 60, 0.3)');
          grad.addColorStop(1, 'rgba(150, 100, 30, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 64, 64);
        }
      } catch {
        canvas = null;
      }
    }
    if (!canvas) canvas = { width: 64, height: 64 };

    this.sandTexture = new THREE.CanvasTexture(canvas);
    this.sandTexture.colorSpace = THREE.SRGBColorSpace;
    this.sandMaterial = new THREE.MeshBasicMaterial({
      map: this.sandTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  _initAmbientSandQuarksSystem() {
    if (!this.profile.ambientParticles || !this.vfxManager?.batchRenderer) return;

    try {
      const ambientSystem = new ParticleSystem({
        duration: 10,
        looping: true,
        startLife: new IntervalValue(3.0, 5.5),
        startSpeed: new IntervalValue(0.2, 0.8),
        startSize: new IntervalValue(0.08, 0.22),
        startColor: new ColorRange(new Vector4(1.0, 0.9, 0.65, 0.8), new Vector4(0.9, 0.75, 0.45, 0.6)),
        emissionOverTime: new ConstantValue(35),
        shape: new RectangleEmitter({ width: 22.0, height: 16.0 }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        startTileIndex: new ConstantValue(0),
        uTileCount: 1,
        vTileCount: 1,
        renderOrder: 1,
      });

      ambientSystem.behaviors.push(
        new SizeOverLife(
          new PiecewiseBezier([
            [new ConstantValue(0.4), 0],
            [new ConstantValue(1.0), 0.5],
            [new ConstantValue(0.1), 1],
          ]),
        ),
        new ColorOverLife(new ColorRange(new Vector4(1.0, 0.88, 0.6, 0.0), new Vector4(0.95, 0.75, 0.4, 0.85))),
      );

      const ambientEmitter = new ParticleEmitter(ambientSystem);
      ambientEmitter.position.set(0, 0.8, -55.0);
      ambientEmitter.rotation.x = -Math.PI / 2;
      this.scene.add(ambientEmitter);
      this.vfxManager.batchRenderer.addSystem(ambientSystem);
      ambientSystem.play();
      this.ambientEmitter = ambientEmitter;
      this.ambientSystem = ambientSystem;
    } catch (error) {
      console.warn('SandVFXSystem: Quarks ambient initialization fallback:', error);
    }
  }

  _initEffectPools() {
    if (!this.vfxManager?.batchRenderer || !this.profile.footstepVfx) return;

    for (let i = 0; i < this.profile.maxContactEmitters; i += 1) {
      const item = this._createFootstepItem();
      if (item) this.footstepPool.push(item);
    }

    // Blasts have a separate small pool so a wind event cannot starve steps.
    for (let i = 0; i < 2; i += 1) {
      const item = this._createBlastItem();
      if (item) this.blastPool.push(item);
    }
  }

  _createPooledItem({ config, behaviors, rotationX, failureMessage }) {
    try {
      const system = new ParticleSystem(config);
      system.behaviors.push(...behaviors);

      const emitter = new ParticleEmitter(system);
      emitter.position.set(0, -100, -55);
      if (rotationX !== undefined) emitter.rotation.x = rotationX;
      this.scene.add(emitter);
      this.vfxManager.batchRenderer.addSystem(system);
      system.stop();
      return { emitter, system, active: false, activeUntil: 0, sequence: 0 };
    } catch (error) {
      console.warn(failureMessage, error);
      return null;
    }
  }

  _createFootstepItem() {
    return this._createPooledItem({
      config: {
        duration: 0.2,
        looping: false,
        startLife: new IntervalValue(0.5, 0.9),
        startSpeed: new IntervalValue(0.6, 1.4),
        startSize: new IntervalValue(0.12, 0.32),
        startColor: new ColorRange(new Vector4(1.0, 0.85, 0.5, 0.9), new Vector4(0.85, 0.65, 0.3, 0.5)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [{ time: 0, count: new ConstantValue(14), cycle: 1, interval: 0, probability: 1 }],
        shape: new ConeEmitter({ radius: 0.25, angle: Math.PI / 4 }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        renderOrder: 2,
      },
      behaviors: [
        new SizeOverLife(
          new PiecewiseBezier([
            [new ConstantValue(0.5), 0],
            [new ConstantValue(1.2), 0.4],
            [new ConstantValue(0.0), 1],
          ]),
        ),
        new ColorOverLife(new ColorRange(new Vector4(1.0, 0.9, 0.6, 0.9), new Vector4(0.8, 0.55, 0.25, 0.0))),
      ],
      rotationX: -Math.PI / 2,
      failureMessage: 'SandVFXSystem footstep pool initialization error:',
    });
  }

  _createBlastItem() {
    return this._createPooledItem({
      config: {
        duration: 0.5,
        looping: false,
        startLife: new IntervalValue(0.8, 1.8),
        startSpeed: new IntervalValue(3.0, 8.5),
        startSize: new IntervalValue(0.18, 0.45),
        startColor: new ColorRange(new Vector4(1.0, 0.92, 0.65, 1.0), new Vector4(0.9, 0.7, 0.35, 0.7)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [{ time: 0, count: new ConstantValue(100), cycle: 1, interval: 0, probability: 1 }],
        shape: new SphereEmitter({ radius: 0.8, thickness: 0.8 }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        renderOrder: 3,
      },
      behaviors: [
        new SizeOverLife(
          new PiecewiseBezier([
            [new ConstantValue(0.6), 0],
            [new ConstantValue(2.0), 0.3],
            [new ConstantValue(0.0), 1],
          ]),
        ),
        new ColorOverLife(new ColorRange(new Vector4(1.0, 0.95, 0.7, 1.0), new Vector4(0.75, 0.5, 0.2, 0.0))),
      ],
      failureMessage: 'SandVFXSystem blast pool initialization error:',
    });
  }

  _acquire(pool) {
    let oldest = null;
    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      if (!item.active) return item;
      if (!oldest || item.sequence < oldest.sequence) oldest = item;
    }
    return oldest;
  }

  _activate(pool, x, z, y, lifetime) {
    if (this.disposed || !containsSandPoint(x, z)) {
      this.droppedEffects += 1;
      return false;
    }
    const item = this._acquire(pool);
    if (!item) {
      this.droppedEffects += 1;
      return false;
    }

    item.system.stop();
    item.emitter.position.set(x, y, z);
    item.emitter.rotation.x = -Math.PI / 2;
    item.active = true;
    item.activeUntil = this.elapsed + lifetime;
    item.sequence = this.elapsed + this.triggeredFootsteps + this.triggeredBlasts + 1;
    item.system.play();
    return true;
  }

  /**
   * Emits a pooled footstep puff at arena coordinates.
   * @param {number} x
   * @param {number} z
   */
  triggerSandFootstepAt(x, z) {
    if (!this.profile.footstepVfx) {
      this.droppedEffects += 1;
      return false;
    }
    const emitted = this._activate(this.footstepPool, x, z, 0.08, 1.0);
    if (emitted) this.triggeredFootsteps += 1;
    return emitted;
  }

  /**
   * Compatibility wrapper for callers that already have a Vector3.
   * @param {THREE.Vector3|{x:number,z:number}} position
   */
  triggerSandFootstep(position) {
    if (!position) return false;
    return this.triggerSandFootstepAt(position.x, position.z);
  }

  /**
   * Emits a pooled blast at arena coordinates.
   * @param {number} x
   * @param {number} z
   * @param {number} powerLevel
   */
  triggerSandBlastAt(x, z, powerLevel = 1) {
    if (!Number.isFinite(powerLevel) || powerLevel <= 0 || !this.profile.footstepVfx) {
      this.droppedEffects += 1;
      return false;
    }
    const emitted = this._activate(this.blastPool, x, z, Math.max(0.05, 0.08 + powerLevel * 0.05), 2.2);
    if (emitted) this.triggeredBlasts += 1;
    return emitted;
  }

  /**
   * Compatibility wrapper for the old origin/target API.
   * @param {THREE.Vector3|{x:number,z:number}} origin
   * @param {THREE.Vector3|number} targetOrPower
   * @param {number} powerLevel
   */
  triggerSandBlast(origin, targetOrPower, powerLevel = 1) {
    if (!origin) return false;
    const target = typeof targetOrPower === 'number' ? origin : targetOrPower || origin;
    const power = typeof targetOrPower === 'number' ? targetOrPower : powerLevel;
    return this.triggerSandBlastAt(target.x, target.z, power);
  }

  update(delta) {
    if (this.disposed) return;
    const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 0;
    this.elapsed += safeDelta;
    this._expirePool(this.footstepPool);
    this._expirePool(this.blastPool);
  }

  _expirePool(pool) {
    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      if (item.active && item.activeUntil <= this.elapsed) {
        item.system.stop();
        item.active = false;
      }
    }
  }

  getStats() {
    return {
      quality: this.quality,
      footstepPoolSize: this.footstepPool.length,
      blastPoolSize: this.blastPool.length,
      footstepPoolActive: this._countActive(this.footstepPool),
      blastPoolActive: this._countActive(this.blastPool),
      triggeredFootsteps: this.triggeredFootsteps,
      triggeredBlasts: this.triggeredBlasts,
      droppedEffects: this.droppedEffects,
      activeAmbient: this.ambientSystem ? 1 : 0,
    };
  }

  _countActive(pool) {
    let count = 0;
    for (let i = 0; i < pool.length; i += 1) {
      if (pool[i].active) count += 1;
    }
    return count;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.ambientEmitter?.parent) this.ambientEmitter.parent.remove(this.ambientEmitter);
    if (this.ambientSystem && this.vfxManager?.batchRenderer) {
      try {
        this.vfxManager.batchRenderer.deleteSystem(this.ambientSystem);
      } catch {
        /* idempotent cleanup */
      }
    }

    this._disposePool(this.footstepPool);
    this._disposePool(this.blastPool);
    this.footstepPool.length = 0;
    this.blastPool.length = 0;
    this.ambientEmitter = null;
    this.ambientSystem = null;
    this.sandMaterial?.dispose();
    this.sandTexture?.dispose();
  }

  _disposePool(pool) {
    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      if (item.emitter.parent) item.emitter.parent.remove(item.emitter);
      try {
        this.vfxManager?.batchRenderer?.deleteSystem(item.system);
      } catch {
        /* idempotent cleanup */
      }
      try {
        item.system?.dispose();
      } catch {
        /* idempotent cleanup */
      }
      item.active = false;
    }
  }
}
