import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandDeformationSimulation } from '../world/SandDeformationSimulation.js';

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
});
