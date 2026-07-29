import * as THREE from 'three';
import { QuarksLoader } from 'three.quarks';

export class ParticlePresetRegistry {
  constructor(vfxManager) {
    this.vfxManager = vfxManager;
    this.loader = new QuarksLoader();
    this.templates = new Map();
    this.pools = new Map();
  }

  async loadPreset(name, url) {
    if (this.templates.has(name)) return this.templates.get(name);

    return new Promise((resolve) => {
      this.loader.load(
        url,
        (object) => {
          this._applyPolishSettings(object);

          this.templates.set(name, object);
          this.pools.set(name, []);

          if (this.vfxManager) {
            const multiplier = this.vfxManager.quality === 'low' ? 0.25 : this.vfxManager.quality === 'medium' ? 0.5 : 1.0;
            if (multiplier !== 1.0 && typeof this.vfxManager._scaleSystemEmission === 'function') {
              this.vfxManager._scaleSystemEmission(object, multiplier);
            }
            if (this.vfxManager.reducedMotion && typeof this.vfxManager._applyAccessibilityToSystem === 'function') {
              this.vfxManager._applyAccessibilityToSystem(object, true);
            }
          }

          resolve(object);
        },
        undefined,
        (err) => {
          console.warn(`ParticlePresetRegistry: Could not parse preset "${name}" at ${url}. Using fallback.`, err);
          const fallback = new THREE.Group();
          fallback.name = name;
          this.templates.set(name, fallback);
          this.pools.set(name, []);
          resolve(fallback);
        }
      );
    });
  }

  _applyPolishSettings(object) {
    object.traverse((child) => {
      if (child.type === 'ParticleEmitter' && child.system) {
        const sys = child.system;
        
        // Phase 6: Soft Particles
        sys.softParticles = true;
        sys.softNearFade = 0;
        sys.softFarFade = 2; // fade over 2 units
        
        // Phase 6: Lighting Reactivity Support
        if (sys.material) {
          sys.material.transparent = true;
          sys.material.depthWrite = false;
          sys.material.lights = true;
        }
      }
    });
  }

  getEffect(name) {
    if (!this.templates.has(name)) {
      console.warn(`ParticlePresetRegistry: Preset ${name} not found.`);
      return null;
    }

    const pool = this.pools.get(name);
    let effect;

    if (pool.length > 0) {
      effect = pool.pop();
    } else {
      const template = this.templates.get(name);
      effect = template.clone();
      effect.userData.presetName = name;
    }

    effect.traverse((child) => {
      if (child.type === 'ParticleEmitter') {
        const system = child.system;
        if (system) {
          system.restart();
          system.play();
          if (this.vfxManager && this.vfxManager.batchRenderer) {
            this.vfxManager.batchRenderer.addSystem(system);
          }
        }
      }
    });

    return effect;
  }

  releaseEffect(effect) {
    if (!effect) return;

    const name = effect.userData.presetName;
    if (!name || !this.pools.has(name)) {
      console.warn('ParticlePresetRegistry: Cannot release an effect without a valid presetName.');
      return;
    }

    effect.traverse((child) => {
      if (child.type === 'ParticleEmitter') {
        const system = child.system;
        if (system) {
          system.stop();
          if (this.vfxManager && this.vfxManager.batchRenderer) {
            this.vfxManager.batchRenderer.deleteSystem(system);
          }
        }
      }
    });

    if (effect.parent) {
      effect.parent.remove(effect);
    }

    this.pools.get(name).push(effect);
  }
}
