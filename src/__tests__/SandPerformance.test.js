import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectSandSample, percentile } from '../engine/PerformanceStats.js';
import { isLabDebugEnabled } from '../engine/LabDebug.js';
import { SandTerrainSystem } from '../world/SandTerrainSystem.js';

describe('sand performance baseline', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calcula p95 sem ordenar o array original', () => {
    const values = [8, 10, 12, 20, 40];

    expect(percentile(values, 0.95)).toBe(40);
    expect(values).toEqual([8, 10, 12, 20, 40]);
  });

  it('calcula limites de percentil (0 e 1) e lida com array de elemento único', () => {
    const values = [8, 10, 12, 20, 40];

    expect(percentile(values, 0)).toBe(8);
    expect(percentile(values, 1)).toBe(40);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  it('relata o orçamento atual da areia', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene());

    try {
      const stats = terrain.getDebugStats();
      expect(stats.triangles).toBe(240 * 180 * 2);
      expect(stats.deformationBytes).toBe(512 * 384 * 3);
    } finally {
      terrain.dispose();
    }
  });

  it('rejeita a coleta sem uma instância de jogo em execução', async () => {
    await expect(collectSandSample({ game: null })).rejects.toThrow('collectSandSample requires a running Game');
  });

  it('exige flag explícita para expor o hook de debug', () => {
    expect(isLabDebugEnabled({ isDevelopmentOrTest: true, optIn: false })).toBe(false);
    expect(isLabDebugEnabled({ isDevelopmentOrTest: false, optIn: true })).toBe(false);
    expect(isLabDebugEnabled({ isDevelopmentOrTest: true, optIn: true })).toBe(true);
  });

  it('coleta amostra aguardando frames + 1 quadros e descartando a primeira medição', async () => {
    let animationFrameCount = 0;
    const requestAnimationFrameMock = vi.fn((cb) => {
      animationFrameCount += 1;
      setTimeout(() => cb(performance.now()), 1);
      return animationFrameCount;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);

    const mockGame = {
      renderer: {
        renderer: {
          getContext: () => ({ isContextLost: () => false }),
          info: {
            render: { calls: 10, triangles: 100 },
            memory: { textures: 2, geometries: 3 },
          },
        },
      },
    };

    const sample = await collectSandSample({ game: mockGame, frames: 5 });
    expect(animationFrameCount).toBe(6);
    expect(sample.drawCalls).toBe(10);
  });

  it('rejeita waitForAnimationFrame quando requestAnimationFrame não dispara a tempo', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.useFakeTimers();

    const samplePromise = collectSandSample({
      game: {
        renderer: {
          renderer: {
            getContext: () => ({ isContextLost: () => false }),
            info: { render: {}, memory: {} },
          },
        },
      },
      frames: 2,
    });

    const assertionPromise = expect(samplePromise).rejects.toThrow('Animation frame timed out');
    await vi.advanceTimersByTimeAsync(1500);
    await assertionPromise;
  });
});
