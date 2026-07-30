import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandDeformationSimulation } from '../world/SandDeformationSimulation.js';
import { TestObjectSystem } from '../world/TestObjectSystem.js';

function createWebGL2Renderer() {
  return {
    capabilities: { isWebGL2: true },
    clear: vi.fn(),
    getRenderTarget: vi.fn(() => null),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
  };
}

describe('SandDeformationSimulation', () => {
  it('aplica um pass por atualização e troca o target publicado', () => {
    const renderer = createWebGL2Renderer();
    const simulation = new SandDeformationSimulation({ renderer, scene: new THREE.Scene() });
    const firstPublished = simulation.publishedTarget;

    simulation.queueBrush(0, 0, 1, 0.1, 0.02, 0.4, 0, 1, 0.2);
    simulation.update(1 / 60);

    expect(renderer.render).toHaveBeenCalledOnce();
    expect(simulation.publishedTarget).not.toBe(firstPublished);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
  });

  it('descarta recursos auxiliares e targets uma única vez', () => {
    const renderer = createWebGL2Renderer();
    const simulation = new SandDeformationSimulation({ renderer, scene: new THREE.Scene() });
    const targetDisposals = simulation.renderTargets.map((target) => vi.spyOn(target, 'dispose'));
    const brushTextureDispose = vi.spyOn(simulation.brushTexture, 'dispose');

    simulation.dispose();
    simulation.dispose();

    targetDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(brushTextureDispose).toHaveBeenCalledOnce();
    expect(simulation.disposed).toBe(true);
  });

  it('aplica a altura deformada e limita contatos pesados por distância ou tempo', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(0, -0.1, 0);
    const object = { mesh, velocity: new THREE.Vector3(1, 0, 0), type: 'pedra' };
    const sandSystem = {
      getElevationAt: vi.fn(() => 0.4),
      sampleWorld: vi.fn(() => ({ depth: 0.1 })),
      brush: vi.fn(),
    };
    const system = new TestObjectSystem([object]);

    system.update(1 / 60, null, sandSystem);
    expect(mesh.position.y).toBeCloseTo(0.15, 5);
    expect(sandSystem.brush).not.toHaveBeenCalled();

    system.update(0.12, null, sandSystem);
    expect(sandSystem.brush).toHaveBeenCalledOnce();
  });
});
