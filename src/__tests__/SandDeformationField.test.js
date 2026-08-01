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

function createWebGL1Renderer() {
  return { capabilities: { isWebGL2: false } };
}

describe('SandDeformationField', () => {
  it('ignora fora dos limites e limita profundidade', () => {
    const field = new SandDeformationField({
      resolution: 8,
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
      resolution: 8,
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
    field.advance(1);
    expect(Math.max(...field.data)).toBeLessThan(peak);
  });

  it('mantém depression, berm e compression no mesmo brush', () => {
    const field = new SandDeformationField({
      resolution: 32,
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
    const resolution = 256;
    const field = new SandDeformationField({ resolution });

    expect(field.backend).toBe('cpuR8');
    expect(field.texture.image.width).toBe(resolution);
    expect(field.texture.image.height).toBe(resolution);
    expect(field.texture.image.data.byteLength).toBe(resolution * resolution);
    expect(field.texture.format).toBe(THREE.RedFormat);
    expect(field.texture.minFilter).toBe(THREE.LinearFilter);
    expect(field.texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(field.texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(field.texture.generateMipmaps).toBe(false);
  });

  it('usa RGBA8 empacotada quando o renderer é WebGL1', () => {
    const field = new SandDeformationField({ renderer: createWebGL1Renderer(), resolution: 8 });

    expect(field.backend).toBe('cpuR8');
    expect(field.texture.format).toBe(THREE.RGBAFormat);
    expect(field.texture.image.data.byteLength).toBe(8 * 8 * 4);
    field.stamp(0, -55, 1, 0.1);
    expect(field.consumeDirty()).toBe(true);
    expect(field.texture.image.data.some((value, index) => index % 4 === 0 && value > 0)).toBe(true);
    expect(field.texture.image.data.every((value, index) => index % 4 === 0 || value === 0)).toBe(true);
    expect(field.getStats().readback).toBe(false);
  });

  it('seleciona GPU somente para renderer WebGL2', () => {
    const renderer = createWebGL2Renderer();
    const field = new SandDeformationField({ renderer });

    expect(field.backend).toBe('cpuR8');
    expect(field.simulation).toBeNull();
  });

  it('só seleciona GPU quando o backend experimental é explicitamente habilitado', () => {
    const renderer = createWebGL2Renderer();
    const field = new SandDeformationField({ renderer, experimentalGpu: true });

    expect(field.backend).toBe('gpuPingPong');
    expect(field.simulation.renderTargets).toHaveLength(2);
    expect(field.simulation.renderTargets.every((target) => target.texture.type === THREE.HalfFloatType)).toBe(true);
  });

  it('preserva o círculo em metros quando o raio não é alongado', () => {
    const field = new SandDeformationField({
      resolution: 65,
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
    const field = new SandDeformationField({ renderer, experimentalGpu: true });
    const targetDisposals = field.simulation.renderTargets.map((target) => vi.spyOn(target, 'dispose'));
    const materialDispose = vi.spyOn(field.simulation.material, 'dispose');
    const geometryDispose = vi.spyOn(field.simulation.geometry, 'dispose');
    const cpuTextureDispose = vi.spyOn(field.cpuTexture, 'dispose');

    field.dispose();
    field.dispose();

    targetDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(cpuTextureDispose).toHaveBeenCalledOnce();
  });

  it('usa a resolução solicitada e rejeita valores não finitos sem alocação por brush', () => {
    const field = new SandDeformationField({ resolution: 8, maxDepth: 0.2, maxBrushesPerFrame: 2 });
    expect(field.data).toHaveLength(64);
    expect(field.brush(Number.NaN, 0, 1, 0.1)).toBe(false);
    expect(field.brush(0, 0, 0, 0.1)).toBe(false);
    expect(field.brush(0, 0, 1, Number.POSITIVE_INFINITY)).toBe(false);
    expect(field.getStats().acceptedBrushes).toBe(0);
  });

  it('limita brushes por frame, registra descarte e publica apenas após dirty', () => {
    const field = new SandDeformationField({ resolution: 8, maxBrushesPerFrame: 2 });
    expect(field.consumeDirty()).toBe(false);
    expect(field.brush(0, -55, 1, 0.1)).toBe(true);
    expect(field.brush(1, -55, 1, 0.1)).toBe(true);
    expect(field.brush(2, -55, 1, 0.1)).toBe(false);
    expect(field.getStats().droppedBrushes).toBe(1);
    expect(field.consumeDirty()).toBe(false);
    field.flush(0);
    expect(field.consumeDirty()).toBe(true);
    expect(field.consumeDirty()).toBe(false);
    expect(field.getStats().textureUploads).toBe(1);
  });

  it('não percorre nem altera o campo quando não há brush ou relaxamento ativo', () => {
    const field = new SandDeformationField({ resolution: 8 });
    const before = field.data.slice();
    expect(field.flush(1 / 60)).toBe(false);
    expect(field.data).toEqual(before);
    expect(field.getStats().activeTiles).toBe(0);
  });

  it('serializa e restaura os três canais sem perder a consulta física', () => {
    const source = new SandDeformationField({ resolution: 16 });
    source.brush(0, -55, 0.8, 0.12, 0.03, 0.7);
    const snapshot = source.serialize();
    const restored = new SandDeformationField({ resolution: 16 });

    expect(restored.restore(snapshot)).toBe(true);
    expect(restored.sampleWorld(0, -55)).toEqual(source.sampleWorld(0, -55));
    expect(restored.getStats().activeTiles).toBeGreaterThan(0);
    expect(restored.consumeDirty()).toBe(true);
    expect(restored.restore({ ...snapshot, width: 8 })).toBe(false);

    source.dispose();
    restored.dispose();
  });
});
