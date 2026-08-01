// @ts-check

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextureGenerator } from '../world/TextureGenerator.js';

const drawingContext = {
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  createLinearGradient: () => ({ addColorStop: vi.fn() }),
};

beforeEach(() => {
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => drawingContext,
    }),
  };
  TextureGenerator.clearCache();
});

afterEach(() => {
  TextureGenerator.clearCache();
  vi.restoreAllMocks();
});

describe('TextureGenerator.createSignageTexture', () => {
  it('keeps signage textures for different text separate', () => {
    const entrance = TextureGenerator.createSignageTexture('ENTRADA');
    const exit = TextureGenerator.createSignageTexture('SAÍDA');

    expect(entrance).not.toBe(exit);
  });

  it('reuses the texture for an identical signage signature', () => {
    expect(TextureGenerator.createSignageTexture('ENTRADA')).toBe(TextureGenerator.createSignageTexture('ENTRADA'));
  });

  it('normalizes default signage options before caching', () => {
    const defaultTexture = TextureGenerator.createSignageTexture('ENTRADA');
    const explicitDefaults = TextureGenerator.createSignageTexture('ENTRADA', {
      width: 768,
      height: 192,
      background: '#10222d',
      foreground: '#a9f0ff',
      border: '#4fd5e8',
    });

    expect(explicitDefaults).toBe(defaultTexture);
  });

  it('disposes every cached texture when clearing the cache', () => {
    const entrance = TextureGenerator.createSignageTexture('ENTRADA');
    const exit = TextureGenerator.createSignageTexture('SAÍDA');
    const disposeEntrance = vi.spyOn(entrance, 'dispose');
    const disposeExit = vi.spyOn(exit, 'dispose');

    TextureGenerator.clearCache();

    expect(disposeEntrance).toHaveBeenCalledOnce();
    expect(disposeExit).toHaveBeenCalledOnce();
  });
});

describe('TextureGenerator.acquireSandTextureSet', () => {
  it('shares maps and disposes them after the last consumer releases', () => {
    const first = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
    const second = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
    const disposeAlbedo = vi.spyOn(first.albedo, 'dispose');
    const disposeNormal = vi.spyOn(first.normal, 'dispose');
    const disposeRoughness = vi.spyOn(first.roughness, 'dispose');

    expect(second.albedo).toBe(first.albedo);
    expect(second.normal).toBe(first.normal);
    expect(second.roughness).toBe(first.roughness);

    first.release();
    expect(disposeAlbedo).not.toHaveBeenCalled();

    second.release();
    expect(disposeAlbedo).toHaveBeenCalledOnce();
    expect(disposeNormal).toHaveBeenCalledOnce();
    expect(disposeRoughness).toHaveBeenCalledOnce();
  });

  it('keeps referenced sand maps alive when clearing the regular texture cache', () => {
    const first = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
    const disposeAlbedo = vi.spyOn(first.albedo, 'dispose');

    TextureGenerator.clearCache();

    expect(disposeAlbedo).not.toHaveBeenCalled();
    const second = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
    expect(second.albedo).toBe(first.albedo);

    first.release();
    second.release();
    expect(disposeAlbedo).toHaveBeenCalledOnce();
  });

  it('limita o número de chamadas Math.random e isola entre chamadas', () => {
    const random = vi.spyOn(Math, 'random');
    const first = TextureGenerator.acquireSandTextureSet({ quality: 'high' });

    expect(random.mock.calls.length).toBeLessThan(100);

    // A aquisição é isolada: uma segunda chamada com a mesma qualidade reutiliza
    // o conjunto em cache e não consome mais aleatoriedade global.
    const second = TextureGenerator.acquireSandTextureSet({ quality: 'high' });
    expect(random.mock.calls.length).toBeLessThan(100);
    expect(second.albedo).toBe(first.albedo);

    first.release();
    second.release();
  });
});
