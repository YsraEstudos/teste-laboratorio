import { BatchedRenderer } from 'three.quarks';
import { ParticlePresetRegistry } from './ParticlePresetRegistry.js';

export class VFXManager {
  constructor(scene) {
    this.batchRenderer = new BatchedRenderer();
    scene.add(this.batchRenderer);
    this.isPaused = false;
    this.registry = new ParticlePresetRegistry(this);
    this.activeEffects = [];
    this.quality = 'high'; // low, medium, high
    this.reducedMotion = false;
  }

  async loadPreset(name, url) {
    return this.registry.loadPreset(name, url);
  }

  playEffect(name, position, roomId = null) {
    const effect = this.registry.getEffect(name);
    if (!effect) return null;

    if (position) {
      effect.position.copy(position);
    }
    effect.userData.roomId = roomId;

    this.activeEffects.push(effect);
    return effect;
  }

  releaseEffect(effect) {
    const index = this.activeEffects.indexOf(effect);
    if (index > -1) {
      this.activeEffects.splice(index, 1);
    }
    this.registry.releaseEffect(effect);
  }

  setQuality(level) {
    if (!['low', 'medium', 'high'].includes(level)) return;
    this.quality = level;
    this.applyScalabilitySettings();
  }

  setReducedMotion(isReduced) {
    this.reducedMotion = !!isReduced;
    this.applyAccessibilitySettings();
  }

  setDepthTexture(depthTexture) {
    if (this.batchRenderer && this.batchRenderer.setDepthTexture) {
      this.batchRenderer.setDepthTexture(depthTexture);
    }
  }

  applyScalabilitySettings() {
    const multiplier = this.quality === 'low' ? 0.25 : this.quality === 'medium' ? 0.5 : 1.0;
    for (const template of this.registry.templates.values()) {
      this._scaleSystemEmission(template, multiplier);
    }
    for (const effect of this.activeEffects) {
      this._scaleSystemEmission(effect, multiplier);
    }
  }

  applyAccessibilitySettings() {
    const disableFlashes = this.reducedMotion;
    for (const template of this.registry.templates.values()) {
      this._applyAccessibilityToSystem(template, disableFlashes);
    }
    for (const effect of this.activeEffects) {
      this._applyAccessibilityToSystem(effect, disableFlashes);
    }
  }

  _scaleSystemEmission(object3D, multiplier) {
    object3D.traverse((child) => {
      if (child.type === 'ParticleEmitter' && child.system) {
        const sys = child.system;
        if (sys.emissionOverTime) {
          if (sys._originalEmissionValue === undefined && sys._originalEmissionValueA === undefined) {
            if (typeof sys.emissionOverTime.value === 'number') {
              sys._originalEmissionValue = sys.emissionOverTime.value;
            } else if (typeof sys.emissionOverTime.a === 'number' && typeof sys.emissionOverTime.b === 'number') {
              sys._originalEmissionValueA = sys.emissionOverTime.a;
              sys._originalEmissionValueB = sys.emissionOverTime.b;
            }
          }

          if (sys._originalEmissionValue !== undefined) {
            sys.emissionOverTime.value = sys._originalEmissionValue * multiplier;
          } else if (sys._originalEmissionValueA !== undefined) {
            sys.emissionOverTime.a = sys._originalEmissionValueA * multiplier;
            sys.emissionOverTime.b = sys._originalEmissionValueB * multiplier;
          }
        }
      }
    });
  }

  _applyAccessibilityToSystem(object3D, disableFlashes) {
    object3D.traverse((child) => {
      if (child.type === 'ParticleEmitter' && child.system) {
        const sys = child.system;
        
        if (sys._originalBlending === undefined) {
          sys._originalBlending = sys.blending !== undefined ? sys.blending : (sys.material ? sys.material.blending : 1); // 1 is NormalBlending
        }
        
        if (disableFlashes) {
          if (sys.blending === 2) sys.blending = 1; // 2 is AdditiveBlending
          if (sys.material && sys.material.blending === 2) sys.material.blending = 1;
        } else {
          if (sys.blending !== undefined) sys.blending = sys._originalBlending;
          if (sys.material) sys.material.blending = sys._originalBlending;
        }

        if (sys.behaviors) {
          if (!sys._originalBehaviors) {
            sys._originalBehaviors = [...sys.behaviors];
          }
          if (disableFlashes) {
            sys.behaviors = sys._originalBehaviors.filter(b => {
              const name = b.type || b.constructor.name;
              return !name.includes('Turbulence') && !name.includes('Noise') && !name.includes('Flash');
            });
          } else {
            sys.behaviors = [...sys._originalBehaviors];
          }
        }
      }
    });
  }

  updateCulling(activeRoomIds) {
    for (const effect of this.activeEffects) {
      const roomId = effect.userData.roomId;
      if (roomId !== null && roomId !== undefined) {
        const isVisible = activeRoomIds.includes(roomId);
        
        effect.traverse((child) => {
          if (child.type === 'ParticleEmitter') {
            const system = child.system;
            if (system) {
              if (isVisible && system.paused) {
                system.play();
              } else if (!isVisible && !system.paused) {
                system.pause();
              }
            }
          }
        });
      }
    }
  }

  update(delta) {
    if (this.isPaused) return;
    this.batchRenderer.update(delta);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  dispose() {
    if (this.batchRenderer.parent) {
      this.batchRenderer.parent.remove(this.batchRenderer);
    }
    for (const effect of [...this.activeEffects]) {
      this.registry.releaseEffect(effect);
    }
    this.activeEffects = [];
  }
}
