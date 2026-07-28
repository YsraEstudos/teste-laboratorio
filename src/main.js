import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js';
import { InputManager } from './engine/InputManager.js';
import { PlayerController } from './entities/PlayerController.js';
import { WindChild } from './entities/WindChild.js';
import { WindParticleSystem } from './effects/WindParticleSystem.js';
import { WindSystem } from './wind/WindSystem.js';
import { RadialMenu } from './ui/RadialMenu.js';
import { TacMap } from './ui/TacMap.js';
import { HUD } from './ui/HUD.js';
import { PerformanceProfiler } from './engine/PerformanceProfiler.js';
import { LaboratoryBuilder } from './world/LaboratoryBuilder.js';
import { NavigationGrid } from './world/NavigationGrid.js';

export class Game {
  static CONSTANTS = {
    WIND_BLAST_RANGE_SQ: 18.0 ** 2,
    WIND_CHARGE_DELAY_MS: 700,
    PAPER_LEAF_MIN_POWER: 0.0,
    CARDBOARD_MIN_POWER: 1.7,
    ROCK_MIN_POWER: 4.5,
    CARDBOARD_MAX_SPEED: 12.5,
    ROCK_MAX_SPEED: 6.5,
  };
  constructor() {
    this.clock = new THREE.Clock();
    this.isPlaying = false;
    this.destroyed = false;
    this.animationId = null;
    this.windBlastTimer = null;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);

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
    this.windChild.setNavigation(this.navigation);
    this.windChild.position.set(3.2, 0, 4.5);
    if (this.windChild.model) this.windChild.model.position.copy(this.windChild.position);

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
      this.radialMenu.show(event.clientX, event.clientY);
    };
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  /**
   * Starts game
   */
  start() {
    if (this.destroyed) return;

    this.isPlaying = true;
    this.wind.startAudio();
    this.hud.hideStart();
    this.hud.hidePause();
  }

  resume() {
    if (this.destroyed) return;

    this.isPlaying = true;
    this.wind.resumeAudio();
    this.hud.hidePause();
  }

  pause() {
    this._cancelWindBlast();
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.wind.suspendAudio();
    this.hud.showPause();
  }

  /**
   * Triggers wind blast
   */
  triggerWindBlastOnObjects() {
    if (this.destroyed || this.windBlastTimer !== null || !this.windChild || !this.lab.testObjects) return;

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

    const targetPos = closestObj.position.clone();
    const childPos = this.windChild.position.clone();

    // Trigger hands-forward trembling animation and wind blast
    this.windChild.startCharging();

    this.windBlastTimer = setTimeout(() => {
      this.windBlastTimer = null;
      if (this.destroyed) return;

      this.windChild.stopCharging();
      this.windChild.releaseWindBlast();

      // Trigger high-quality particle vortex & shockwaves
      this.windFX.triggerWindBlast(childPos, targetPos, this.windChild.powerLevel);

      // Calculate Effective Power: PowerLevel (1-10) * Happiness% * Energy%
      const effectivePower =
        this.windChild.powerLevel * (this.windChild.happiness / 100) * (this.windChild.energy / 100);
      const pushVector = new THREE.Vector3().subVectors(targetPos, childPos).normalize();

      if (closestObj.type === 'folha_papel' || closestObj.type === 'folha_arvore') {
        // Loose paper sheets & tree leaves: Pushed easily at Power Level 1!
        const speed = 4.5 + effectivePower * 1.2;
        closestObj.velocity.copy(pushVector).multiplyScalar(speed);
        closestObj.velocity.y = 3.5 + effectivePower * 0.8; // Upward air lift!
      } else if (closestObj.type === 'papelao') {
        // Cardboard Box: Requires Power Level 2+ (effectivePower >= Game.CONSTANTS.CARDBOARD_MIN_POWER)
        if (effectivePower >= 1.7) {
          const speed = Math.min(Game.CONSTANTS.CARDBOARD_MAX_SPEED, 3.2 + (effectivePower - 1.5) * 1.2);
          closestObj.velocity.copy(pushVector).multiplyScalar(speed);
        } else {
          // Level 1: Too weak for cardboard box! Shakes slightly
          closestObj.velocity.copy(pushVector).multiplyScalar(0.35);
        }
      } else if (closestObj.type === 'pedra') {
        // Heavy Rock: Requires Power Level 5+ (effectivePower >= Game.CONSTANTS.ROCK_MIN_POWER)
        if (effectivePower >= 4.5) {
          const speed = Math.min(Game.CONSTANTS.ROCK_MAX_SPEED, (effectivePower - 4.0) * 0.95);
          closestObj.velocity.copy(pushVector).multiplyScalar(speed);
        } else {
          // Too heavy for Level 1-4! Shakes slightly
          closestObj.velocity.copy(pushVector).multiplyScalar(0.35);
        }
      }
    }, Game.CONSTANTS.WIND_CHARGE_DELAY_MS);
  }

  _cancelWindBlast() {
    if (this.windBlastTimer === null) return;

    clearTimeout(this.windBlastTimer);
    this.windBlastTimer = null;
    this.windChild?.stopCharging?.();
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
      this.windChild.update(delta, this.lab.colliders);
      this.windFX.update(delta);
      this.lab.update(delta, this.player.position, this.wind);
      this.hud.update();
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
    this._cancelWindBlast();

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
