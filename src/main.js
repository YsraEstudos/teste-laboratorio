import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js';
import { InputManager } from './engine/InputManager.js';
import { PlayerController } from './entities/PlayerController.js';
import { WindChild } from './entities/WindChild.js';
import { WindParticleSystem } from './effects/WindParticleSystem.js';
import { WindAbilitySystem } from './abilities/WindAbilitySystem.js';
import { WindConfig } from './config/WindConfig.js';
import { createWindImpulse } from './wind/WindImpulse.js';
import { WindSystem } from './wind/WindSystem.js';
import { RadialMenu } from './ui/RadialMenu.js';
import { TacMap } from './ui/TacMap.js';
import { HUD } from './ui/HUD.js';
import { PerformanceProfiler } from './engine/PerformanceProfiler.js';
import { LaboratoryBuilder } from './world/LaboratoryBuilder.js';
import { NavigationGrid } from './world/NavigationGrid.js';
import { ObjectHighlightSystem } from './world/ObjectHighlightSystem.js';
import { FlashlightSystem } from './entities/FlashlightSystem.js';
import { gameStore } from './state/gameStore.js';
import { VFXManager } from './effects/VFXManager.js';
import { SandVFXSystem } from './effects/SandVFXSystem.js';
import { GroundDustSystem } from './effects/GroundDustSystem.js';

export class Game {
  static CONSTANTS = {
    WIND_BLAST_RANGE_SQ: WindConfig.blastRange ** 2,
  };
  constructor() {
    this.clock = new THREE.Clock();
    this.isPlaying = false;
    this.destroyed = false;
    this.animationId = null;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this._pointer = new THREE.Vector2();
    this._raycaster = new THREE.Raycaster();

    // Performance Telemetry Profiler (Edge & AMD GPU/CPU)
    this.profiler = new PerformanceProfiler(this);

    // World & Navigation
    this.lab = new LaboratoryBuilder(this.renderer.scene);
    this.navigation = new NavigationGrid(this.lab.colliders);
    this.wind = new WindSystem(this.renderer.scene, this.renderer.camera, this.lab);
    this.objectHighlight = new ObjectHighlightSystem();
    this.vfxManager = new VFXManager(this.renderer.scene);
    this.sandVFX = new SandVFXSystem(this.renderer.scene);
    this.groundDust = new GroundDustSystem(this.renderer.scene);

    // Player Character
    this.player = new PlayerController(this.renderer.camera, this.input, this.renderer.scene);
    this.player.setNavigation(this.navigation);
    this._windForce = new THREE.Vector3();

    // Flashlight System
    this.flashlight = new FlashlightSystem(this.renderer.scene);
    this.flashlight.setEquipped(gameStore.state.isFlashlightEquipped);
    this.flashlight.setEnabled(gameStore.state.isFlashlightOn);

    this.input.onInventoryToggle = () => {
      gameStore.setState({ inventoryOpen: !gameStore.state.inventoryOpen });
    };

    this.input.onFlashlightToggle = () => {
      if (!gameStore.state.isFlashlightEquipped) return;
      const nextState = !gameStore.state.isFlashlightOn;
      gameStore.setState({ isFlashlightOn: nextState });
    };

    this._unsubscribeStore = gameStore.subscribe((state) => {
      if (this.flashlight) {
        this.flashlight.setEquipped(state.isFlashlightEquipped);
        this.flashlight.setEnabled(state.isFlashlightOn);
      }
    });

    // Wind Particle FX
    this.windFX = new WindParticleSystem(this.renderer.scene);

    // Wind Child (Subject with Wind Powers) - Spawns in Entrance room near Player
    this.windChild = new WindChild(this.renderer.scene);
    this.windChild.setNavigation(this.navigation, this.lab.dynamicColliders);
    this.windChild.position.set(3.2, 0, 4.5);
    if (this.windChild.model) this.windChild.model.position.copy(this.windChild.position);
    this.windAbility = new WindAbilitySystem({
      owner: this.windChild,
      onRelease: (snapshot) => this._applyWindBlast(snapshot),
    });

    // Radial Context Menu & TacMap (M Key)
    this.radialMenu = new RadialMenu(this);
    this.tacMap = new TacMap(this);
    this.hud = new HUD(this);

    this._bindEvents(canvas);

    this._loop = this._loop.bind(this);
    this.animationId = requestAnimationFrame(this._loop);
  }

  _bindEvents(canvas) {
    // Left-click movement / interaction
    this._onPointerDown = (event) => {
      if (this.isTargetingWindBlast && event.button === 0) {
        this.isTargetingWindBlast = false;
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.style.cursor = 'default';

        const rect = canvas.getBoundingClientRect();
        this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._pointer, this.renderer.camera);

        const intersects = this._raycaster.intersectObjects(this.renderer.scene.children, true);
        let targetObj = null;
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          const testObjects = Array.isArray(this.lab.testObjects) ? this.lab.testObjects : (this.lab.testObjects?.objects || []);
          for (const obj of testObjects) {
             if (hit === obj.mesh || hit.parent === obj.mesh || hit.parent?.parent === obj.mesh) {
                targetObj = obj;
                break;
             }
          }
        }
        
        this.triggerWindBlastOnObjects(targetObj);
        return;
      }

      if (this.isPlaying && event.button === 0) {
        this.player.handlePointerDown(event);
      }
    };
    canvas.addEventListener('pointerdown', this._onPointerDown);

    // Right-click context menu for Wind Child
    this._onContextMenu = (event) => {
      event.preventDefault();
      if (!this.isPlaying) return;

      const rect = canvas.getBoundingClientRect();
      this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.renderer.camera);

      const [closestHit] = this._raycaster.intersectObjects(this.renderer.scene.children, true);
      if (!this._isWindChildHit(closestHit?.object)) return;

      this.radialMenu.show(event.clientX, event.clientY);
    };
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  _isWindChildHit(object) {
    const windChildModel = this.windChild?.model;
    let current = object;

    while (current) {
      if (
        current === windChildModel &&
        current.userData?.interactiveType === 'wind-child' &&
        current.userData?.isWindChild === true
      ) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Starts game
   */
  start() {
    if (this.destroyed) return;

    this.isPlaying = true;
    this.windAbility.resume();
    this.wind.startAudio();
    this.hud.hideStart();
    this.hud.hidePause();
  }

  resume() {
    if (this.destroyed) return;

    this.isPlaying = true;
    this.windAbility.resume();
    this.wind.resumeAudio();
    this.hud.hidePause();
  }

  pause() {
    this.radialMenu?.hide?.();
    this.windAbility.pause();
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.wind.suspendAudio();
    this.hud.showPause();
  }

  /**
   * Enters targeting mode for Wind Blast
   */
  enterWindBlastTargetingMode() {
    if (this.destroyed || !this.isPlaying) return;
    this.isTargetingWindBlast = true;
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.cursor = 'crosshair';
  }

  /**
   * Triggers wind blast against a specified target object or nearest object
   * @param {Record<string, any>} [targetObject=null]
   */
  triggerWindBlastOnObjects(targetObject = null) {
    if (this.destroyed || !this.windChild || !this.lab.testObjects) return;

    let targetObj = targetObject;
    const testObjects = Array.isArray(this.lab.testObjects)
      ? this.lab.testObjects
      : (this.lab.testObjects?.objects || []);

    if (!targetObj) {
      // Find closest test object to Wind Child
      let minDist = Infinity;
      for (const obj of testObjects) {
        const pos = obj.position || obj.mesh?.position;
        if (!pos) continue;
        const dist = this.windChild.position.distanceTo(pos);
        if (dist < minDist) {
          minDist = dist;
          targetObj = obj;
        }
      }
    }

    if (!targetObj) {
      alert('Nenhum objeto de teste "Confirmed 42" selecionado ou próximo o suficiente do Wind Child!');
      return;
    }

    const targetPos = targetObj.position || targetObj.mesh?.position;

    // Highlight target object for 400ms in cyan emissive flash
    if (this.objectHighlight) {
      this.objectHighlight.highlight(targetObj, 400);
    }

    // Orient Wind Child model towards the target
    if (this.windChild && this.windChild.position && targetPos) {
      const dx = targetPos.x - this.windChild.position.x;
      const dz = targetPos.z - this.windChild.position.z;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        this.windChild.rotation = Math.atan2(dx, dz);
        if (this.windChild.model && this.windChild.model.rotation) {
          this.windChild.model.rotation.y = this.windChild.rotation;
        }
      }
    }

    this.windAbility.start({
      targetObject: targetObj,
      origin: this.windChild.position,
      target: targetPos,
      powerLevel: this.windChild.powerLevel,
      happiness: this.windChild.happiness,
      energy: this.windChild.energy,
    });
  }

  _applyWindBlast({ targetObject, origin, target, powerLevel, happiness, energy }) {
    // Calculate Effective Power: PowerLevel (1-10) * Happiness% * Energy%
    const effectivePower = powerLevel * (happiness / 100) * (energy / 100);
    const pushVector = new THREE.Vector3().subVectors(target, origin).normalize();
    const impulse = createWindImpulse({
      origin,
      direction: pushVector,
      power: effectivePower,
      radius: Math.sqrt(Game.CONSTANTS.WIND_BLAST_RANGE_SQ),
      falloff: 'none',
      verticalLift: 0,
      duration: 0.2,
      source: 'blast',
    });

    // Visual and physical responses receive the same immutable blast event.
    this.windFX.triggerWindBlast(origin, target, powerLevel, impulse);
    this.wind.applyImpulse(impulse, [targetObject]);
    
    if (this.lab?.gpuSandSystem) {
      this.lab.gpuSandSystem.triggerSandBlast(origin, target, effectivePower);
    }
  }

  /**
   * Main loop
   */
  _loop() {
    if (this.destroyed) return;
    this.animationId = requestAnimationFrame(this._loop);

    const now = performance.now();
    this.profiler.startFrame(now);

    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.isPlaying) {
      this.profiler.startCPU();
      this.wind.update(delta);
      this.wind.samplePlayerForce(this.player.position, this._windForce);
      this.player.setWindForce(this._windForce);
      this.player.update(delta, this.lab.colliders, this.lab.doors);

      if (this.flashlight && this.player) {
        const angle = (this.player.model && this.player.model.rotation) ? this.player.model.rotation.y : 0;
        const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        this.flashlight.update(this.player.position, forward);
      }

      this.windAbility.update(delta);
      this.windChild.update(delta, this.lab.navigationColliders, this.lab.dynamicColliders);
      this.windFX.update(delta);
      this.vfxManager?.update?.(delta);
      this.sandVFX?.update?.(delta);
      this.groundDust?.update?.(delta);
      this.objectHighlight.update(delta);
      this.lab.update(delta, this.player.position, [this.windChild.position], this.wind);
      this.hud.update(delta);
      this.profiler.endCPU();
    }

    this.profiler.startGPU();
    this.renderer.render(delta);
    this.profiler.endGPU();

    this.profiler.endFrame(this.renderer.renderer);
    this.input.resetMouseDelta();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.isPlaying = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      if (this._onPointerDown) canvas.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onContextMenu) canvas.removeEventListener('contextmenu', this._onContextMenu);
    }

    if (this._unsubscribeStore) this._unsubscribeStore();
    this.flashlight?.dispose?.();
    this.tacMap?.destroy?.();
    this.radialMenu?.destroy?.();
    this.hud?.destroy?.();
    this.profiler?.destroy?.();
    this.input?.dispose?.();
    this.objectHighlight?.dispose?.();
    this.vfxManager?.dispose?.();
    this.sandVFX?.dispose?.();
    this.groundDust?.dispose?.();
    this.windAbility?.dispose?.();
    this.windFX?.dispose?.();
    this.wind?.dispose?.();
    this.windChild?.dispose?.();
    this.lab?.dispose?.();
    this.renderer?.dispose?.();
  }
}

function init() {
  new Game();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
