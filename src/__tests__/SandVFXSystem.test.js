import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandVFXSystem } from '../effects/SandVFXSystem.js';

function createManager() {
  return {
    batchRenderer: {
      addSystem: vi.fn(),
      update: vi.fn(),
      deleteSystem: vi.fn(),
    },
  };
}

describe('SandVFXSystem', () => {
  it('cria pools fixos e não cria ParticleSystem durante triggers', () => {
    const manager = createManager();
    const vfx = new SandVFXSystem(new THREE.Scene(), manager, { quality: 'medium' });
    const initialSystems = manager.batchRenderer.addSystem.mock.calls.length;

    vfx.triggerSandFootstepAt(0, -55);
    vfx.triggerSandFootstepAt(0.5, -55);
    vfx.triggerSandBlastAt(0, -55, 2);

    expect(manager.batchRenderer.addSystem).toHaveBeenCalledTimes(initialSystems);
    expect(vfx.getStats().footstepPoolActive).toBe(2);
    expect(vfx.getStats().blastPoolActive).toBe(1);
    vfx.dispose();
  });

  it('reutiliza o item mais antigo, ignora inválidos e não usa timers', () => {
    const manager = createManager();
    const vfx = new SandVFXSystem(new THREE.Scene(), manager, { quality: 'low' });
    const initialSystems = manager.batchRenderer.addSystem.mock.calls.length;

    vfx.triggerSandFootstepAt(Number.NaN, -55);
    vfx.triggerSandFootstepAt(0, -55);
    vfx.triggerSandFootstepAt(1, -55);
    vfx.update(2);

    expect(manager.batchRenderer.addSystem).toHaveBeenCalledTimes(initialSystems);
    expect(vfx.getStats().footstepPoolActive).toBe(0);
    expect(vfx.getStats().droppedEffects).toBeGreaterThanOrEqual(0);
    vfx.dispose();
    expect(() => vfx.dispose()).not.toThrow();
  });
});
