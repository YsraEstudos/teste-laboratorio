import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandDeformationField } from '../world/SandDeformationField.js';

function createWebGL2Renderer() {
  return {
    capabilities: { isWebGL2: true },
    clear: vi.fn(),
    getRenderTarget: vi.fn(() => null),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
  };
}

describe('SandDeformationField', () => {
  it('ignora fora dos limites e limita profundidade', () => {
    const field = new SandDeformationField({
      width: 8,
      height: 8,
      minX: -4,
      maxX: 4,
      minZ: -4,
      maxZ: 4,
      maxDepth: 0.2,
    });

    field.stamp(100, 100, 1, 1);
    expect(field.data.every((value) => value === 0)).toBe(true);
    field.stamp(0, 0, 2, 1);
    expect(Math.max(...field.data)).toBe(255);
  });

  it('coalesce stamps e decai no intervalo agendado', () => {
    const field = new SandDeformationField({
      width: 8,
      height: 8,
      minX: -4,
      maxX: 4,
      minZ: -4,
      maxZ: 4,
      decayPerSecond: 0.1,
    });

    field.stamp(0, 0, 1, 0.1);
    field.stamp(0, 0, 1, 0.1);
    const peak = Math.max(...field.data);
    expect(field.consumeDirty()).toBe(true);
    expect(field.consumeDirty()).toBe(false);
    field.advance(1 / 60);
    expect(Math.max(...field.data)).toBe(peak);
    field.advance(1 / 15);
    expect(Math.max(...field.data)).toBeLessThan(peak);
  });

  it('mantém depression, berm e compression no mesmo brush', () => {
    const field = new SandDeformationField({
      width: 32,
      height: 32,
      minX: -4,
      maxX: 4,
      minZ: -4,
      maxZ: 4,
      maxDepth: 0.2,
    });

    field.brush(0, 0, 0.4, 0.12, 0.03, 0.8, Math.PI / 4, 1.6, 0.2);
    const sample = field.sampleWorld(0, 0);
    expect(sample.depth).toBeGreaterThan(0);
    expect(sample.compression).toBeGreaterThan(0);
    expect(sample.berm).toBeGreaterThan(0);
  });

  it('usa DataTexture R8 compacta no fallback CPU', () => {
    const field = new SandDeformationField({ width: 8, height: 8 });

    expect(field.backend).toBe('cpuR8');
    expect(field.texture.image.width).toBe(256);
    expect(field.texture.image.height).toBe(256);
    expect(field.texture.image.data.byteLength).toBe(65536);
    expect(field.texture.format).toBe(THREE.RedFormat);
    expect(field.texture.minFilter).toBe(THREE.LinearFilter);
    expect(field.texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(field.texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(field.texture.generateMipmaps).toBe(false);
  });

  it('seleciona GPU somente para renderer WebGL2', () => {
    const renderer = createWebGL2Renderer();
    const field = new SandDeformationField({ renderer });

    expect(field.backend).toBe('gpuPingPong');
    expect(field.simulation.renderTargets).toHaveLength(2);
    expect(field.simulation.renderTargets.every((target) => target.width === 256)).toBe(true);
    expect(field.simulation.renderTargets.every((target) => target.height === 256)).toBe(true);
    expect(field.simulation.renderTargets.every((target) => target.texture.type === THREE.HalfFloatType)).toBe(true);
  });

  it('preserva o círculo em metros quando o raio não é alongado', () => {
    const field = new SandDeformationField({
      width: 65,
      height: 65,
      minX: -4,
      maxX: 4,
      minZ: -4,
      maxZ: 4,
      maxDepth: 0.2,
    });

    field.brush(0, 0, 1, 0.1, 0, 0, 0, 1, 0);
    expect(field.sampleWorld(0.5, 0).depth).toBeCloseTo(field.sampleWorld(0, 0.5).depth, 5);
  });

  it('descarta o backend e a textura uma única vez', () => {
    const renderer = createWebGL2Renderer();
    const field = new SandDeformationField({ renderer });
    const targetDisposals = field.simulation.renderTargets.map((target) => vi.spyOn(target, 'dispose'));
    const materialDispose = vi.spyOn(field.simulation.material, 'dispose');
    const geometryDispose = vi.spyOn(field.simulation.geometry, 'dispose');
    const textureDispose = vi.spyOn(field.texture, 'dispose');

    field.dispose();
    field.dispose();

    targetDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
