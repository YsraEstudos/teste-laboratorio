import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GPUComputeSandSystem } from '../world/GPUComputeSandSystem.js';

function makeFakeRenderer() {
  return {
    capabilities: { isWebGL2: true },
    extensions: { has: () => true },
    clear: vi.fn(),
    getRenderTarget: vi.fn(() => null),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
  };
}

describe('GPUComputeSandSystem', () => {
  it('não cria partículas nem targets sem habilitação explícita', () => {
    const system = new GPUComputeSandSystem(makeFakeRenderer(), new THREE.Scene());

    expect(system.isHeadless).toBe(true);
    expect(system.PARTICLES).toBeUndefined();
    expect(system.rt1).toBeUndefined();
  });

  it('limita o backend experimental a 128² no perfil médio', () => {
    const system = new GPUComputeSandSystem(makeFakeRenderer(), new THREE.Scene(), {
      enabled: true,
      quality: 'medium',
    });

    expect(system.isHeadless).toBe(false);
    expect(system.PARTICLES).toBe(128 * 128);
    system.dispose();
  });

  it('torna dispose e trigger seguros em repetição', () => {
    const system = new GPUComputeSandSystem(null, new THREE.Scene());

    expect(() => system.triggerSandBlast(new THREE.Vector3(), 1)).not.toThrow();
    expect(() => system.dispose()).not.toThrow();
    expect(() => system.dispose()).not.toThrow();
  });
});
