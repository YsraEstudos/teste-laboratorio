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

    // Player Character
    this.player = new PlayerController(this.renderer.camera, this.input, this.renderer.scene);
    this.player.setNavigation(this.navigation);
    this._windForce = new THREE.Vector3();

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
   * Triggers wind blast
   */
  triggerWindBlastOnObjects() {
    if (this.destroyed || !this.windChild || !this.lab.testObjects) return;

    // Find closest test object to Wind Child
    let closestObj = null;
    let minDist = Infinity;
    for (const obj of this.lab.testObjects) {
      const dist = this.windChild.position.distanceTo(obj.position);
      if (dist < minDist) {
        minDist = dist;
        closestObj = obj;
      }
    }

    if (!closestObj || minDist > Math.sqrt(Game.CONSTANTS.WIND_BLAST_RANGE_SQ)) {
      alert('Nenhum objeto de teste "Confirmed 42" próximo o suficiente do Wind Child!');
      return;
    }

    this.windAbility.start({
      targetObject: closestObj,
      origin: this.windChild.position,
      target: closestObj.position,
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
      this.windAbility.update(delta);
      this.windChild.update(delta, this.lab.navigationColliders, this.lab.dynamicColliders);
      this.windFX.update(delta);
      this.lab.update(delta, this.player.position, this.wind);
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

    this.tacMap?.destroy?.();
    this.radialMenu?.destroy?.();
    this.hud?.destroy?.();
    this.profiler?.destroy?.();
    this.input?.dispose?.();
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
