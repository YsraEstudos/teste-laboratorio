import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TestObjectSystem } from '../world/TestObjectSystem.js';

describe('TestObjectSystem', () => {
  it('aplica a altura deformada e limita contatos pesados por distância ou tempo', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(0, -0.1, 0);
    const object = { mesh, velocity: new THREE.Vector3(1, 0, 0), type: 'pedra' };
    const sandSystem = {
      getElevationAt: vi.fn(() => 0.3),
      sampleWorld: vi.fn(() => ({ depth: 0.1 })),
      brush: vi.fn(),
    };
    const system = new TestObjectSystem([object]);

    system.update(1 / 60, null, sandSystem);
    expect(mesh.position.y).toBeCloseTo(0.15, 5);
    expect(sandSystem.brush).toHaveBeenCalledTimes(1);

    system.update(0.12, null, sandSystem);
    expect(sandSystem.brush).toHaveBeenCalledTimes(2);
  });
});
