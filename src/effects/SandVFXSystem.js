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

/**
 * SandVFXSystem - Advanced Three.quarks Sand Animation System.
 * Handles continuous ambient golden sand swirls, footstep sand puffs,
 * and high-impact sand blast wave explosions.
 */
export class SandVFXSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./VFXManager.js').VFXManager} vfxManager
   */
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;
    this.disposed = false;
    this.lastPlayerFootstepTime = 0;
    this.lastChildFootstepTime = 0;
    this._lastPlayerPos = new THREE.Vector3();
    this._lastChildPos = new THREE.Vector3();

    this._initCanvasTexture();
    this._initAmbientSandQuarksSystem();
  }

  _initCanvasTexture() {
    // Generate soft glowing sand particle texture
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
    if (!canvas) {
      canvas = { width: 64, height: 64 };
    }
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
    if (!this.vfxManager?.batchRenderer) return;

    try {
      // 1. Ambient Golden Sand Swirl System (three.quarks RectangleEmitter)
      const ambientSystem = new ParticleSystem({
        duration: 10,
        looping: true,
        startLife: new IntervalValue(3.0, 5.5),
        startSpeed: new IntervalValue(0.2, 0.8),
        startSize: new IntervalValue(0.08, 0.22),
        startColor: new ColorRange(new Vector4(1.0, 0.9, 0.65, 0.8), new Vector4(0.9, 0.75, 0.45, 0.6)),
        emissionOverTime: new ConstantValue(35),
        shape: new RectangleEmitter({
          width: 22.0,
          height: 16.0,
        }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        startTileIndex: new ConstantValue(0),
        uTileCount: 1,
        vTileCount: 1,
        renderOrder: 1,
      });

      // Size fade & color over lifetime
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

      this.ambientEmitter = new ParticleEmitter(ambientSystem);
      this.ambientEmitter.position.set(0, 0.8, -55.0); // Center of Sand Arena
      this.ambientEmitter.rotation.x = -Math.PI / 2;
      this.scene.add(this.ambientEmitter);

      this.vfxManager.batchRenderer.addSystem(ambientSystem);
      ambientSystem.play();
      this.ambientSystem = ambientSystem;
    } catch (e) {
      console.warn('SandVFXSystem: Quarks ambient initialization fallback:', e);
    }
  }

  /**
   * Emits footstep sand puffs when walking in the Sand Arena
   * @param {THREE.Vector3} position
   */
  triggerSandFootstep(position) {
    if (this.disposed || !this.vfxManager?.batchRenderer) return;

    try {
      const footstepSystem = new ParticleSystem({
        duration: 0.2,
        looping: false,
        startLife: new IntervalValue(0.5, 0.9),
        startSpeed: new IntervalValue(0.6, 1.4),
        startSize: new IntervalValue(0.12, 0.32),
        startColor: new ColorRange(new Vector4(1.0, 0.85, 0.5, 0.9), new Vector4(0.85, 0.65, 0.3, 0.5)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          {
            time: 0,
            count: new ConstantValue(14),
            cycle: 1,
            interval: 0,
            probability: 1,
          },
        ],
        shape: new ConeEmitter({
          radius: 0.25,
          angle: Math.PI / 4,
        }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        renderOrder: 2,
      });

      footstepSystem.behaviors.push(
        new SizeOverLife(
          new PiecewiseBezier([
            [new ConstantValue(0.5), 0],
            [new ConstantValue(1.2), 0.4],
            [new ConstantValue(0.0), 1],
          ]),
        ),
        new ColorOverLife(new ColorRange(new Vector4(1.0, 0.9, 0.6, 0.9), new Vector4(0.8, 0.55, 0.25, 0.0))),
      );

      const emitter = new ParticleEmitter(footstepSystem);
      emitter.position.copy(position);
      emitter.position.y = 0.08;
      emitter.rotation.x = -Math.PI / 2; // Upward cone burst
      this.scene.add(emitter);

      this.vfxManager.batchRenderer.addSystem(footstepSystem);
      footstepSystem.play();

      // Auto cleanup emitter after lifetime
      setTimeout(() => {
        if (!this.disposed && emitter.parent) {
          emitter.parent.remove(emitter);
          try {
            this.vfxManager.batchRenderer.deleteSystem(footstepSystem);
          } catch {
            // Ignore deletion errors
          }
        }
      }, 1000);
    } catch (e) {
      console.warn('SandVFXSystem footstep emission error:', e);
    }
  }

  /**
   * Triggers dynamic three.quarks sand storm wave & plume explosion upon Wind Blast
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} target
   * @param {number} powerLevel
   */
  triggerSandBlast(origin, target, powerLevel = 1) {
    if (this.disposed || !this.vfxManager?.batchRenderer) return;

    try {
      const particleCount = Math.min(180, Math.round(50 + powerLevel * 25));
      const blastSystem = new ParticleSystem({
        duration: 0.5,
        looping: false,
        startLife: new IntervalValue(0.8, 1.8),
        startSpeed: new IntervalValue(3.0 + powerLevel * 0.8, 7.0 + powerLevel * 1.5),
        startSize: new IntervalValue(0.18, 0.45),
        startColor: new ColorRange(new Vector4(1.0, 0.92, 0.65, 1.0), new Vector4(0.9, 0.7, 0.35, 0.7)),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
          {
            time: 0,
            count: new ConstantValue(particleCount),
            cycle: 1,
            interval: 0,
            probability: 1,
          },
        ],
        shape: new SphereEmitter({
          radius: 0.8,
          thickness: 0.8,
        }),
        material: this.sandMaterial,
        renderMode: RenderMode.BillBoard,
        renderOrder: 3,
      });

      blastSystem.behaviors.push(
        new SizeOverLife(
          new PiecewiseBezier([
            [new ConstantValue(0.6), 0],
            [new ConstantValue(2.0), 0.3],
            [new ConstantValue(0.0), 1],
          ]),
        ),
        new ColorOverLife(new ColorRange(new Vector4(1.0, 0.95, 0.7, 1.0), new Vector4(0.75, 0.5, 0.2, 0.0))),
      );

      const emitter = new ParticleEmitter(blastSystem);
      emitter.position.copy(target);
      emitter.position.y = Math.max(0.2, target.y);
      this.scene.add(emitter);

      this.vfxManager.batchRenderer.addSystem(blastSystem);
      blastSystem.play();

      setTimeout(() => {
        if (!this.disposed && emitter.parent) {
          emitter.parent.remove(emitter);
          try {
            this.vfxManager.batchRenderer.deleteSystem(blastSystem);
          } catch {
            // Ignore deletion errors
          }
        }
      }, 2200);
    } catch (e) {
      console.warn('SandVFXSystem sand blast emission error:', e);
    }
  }

  _getDist(p1, p2) {
    if (!p1 || !p2) return 0;
    const dx = (p1.x || 0) - (p2.x || 0);
    const dy = (p1.y || 0) - (p2.y || 0);
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.hypot(dx, dy, dz);
  }

  _copyPos(dest, src) {
    if (!dest || !src) return;
    dest.x = src.x || 0;
    dest.y = src.y || 0;
    dest.z = src.z || 0;
  }

  /**
   * Frame update - Checks character movement in Sand Arena bounds for footstep effects
   * @param {number} delta
   * @param {THREE.Vector3|{x:number,y:number,z:number}} [playerPos]
   * @param {THREE.Vector3|{x:number,y:number,z:number}} [windChildPos]
   */
  update(delta, playerPos = null, windChildPos = null) {
    if (this.disposed) return;

    const now = performance.now();

    // Check Player in Sand Arena ($X \in [-11.5, 11.5], Z \in [-63.5, -46.5]$)
    if (playerPos) {
      if (playerPos.x >= -11.5 && playerPos.x <= 11.5 && playerPos.z >= -63.5 && playerPos.z <= -46.5) {
        const distMoved = this._getDist(playerPos, this._lastPlayerPos);
        if (distMoved > 0.4 && now - this.lastPlayerFootstepTime > 280) {
          this.triggerSandFootstep(playerPos);
          this.lastPlayerFootstepTime = now;
          this._copyPos(this._lastPlayerPos, playerPos);
        }
      } else {
        this._copyPos(this._lastPlayerPos, playerPos);
      }
    }

    // Check Wind Child in Sand Arena
    if (windChildPos) {
      if (windChildPos.x >= -11.5 && windChildPos.x <= 11.5 && windChildPos.z >= -63.5 && windChildPos.z <= -46.5) {
        const distMoved = this._getDist(windChildPos, this._lastChildPos);
        if (distMoved > 0.4 && now - this.lastChildFootstepTime > 280) {
          this.triggerSandFootstep(windChildPos);
          this.lastChildFootstepTime = now;
          this._copyPos(this._lastChildPos, windChildPos);
        }
      } else {
        this._copyPos(this._lastChildPos, windChildPos);
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.ambientEmitter) {
      if (this.ambientEmitter.parent) this.ambientEmitter.parent.remove(this.ambientEmitter);
    }
    if (this.ambientSystem && this.vfxManager?.batchRenderer) {
      try {
        this.vfxManager.batchRenderer.deleteSystem(this.ambientSystem);
      } catch {
        // Ignore deletion errors
      }
    }
    if (this.sandMaterial) this.sandMaterial.dispose();
    if (this.sandTexture) this.sandTexture.dispose();
  }
}
