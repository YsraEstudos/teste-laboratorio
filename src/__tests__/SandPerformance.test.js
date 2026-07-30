import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collectSandSample, percentile } from '../engine/PerformanceStats.js';
import { SandTerrainSystem } from '../world/SandTerrainSystem.js';

describe('sand performance baseline', () => {
  it('calcula p95 sem ordenar o array original', () => {
    const values = [8, 10, 12, 20, 40];

    expect(percentile(values, 0.95)).toBe(40);
    expect(values).toEqual([8, 10, 12, 20, 40]);
  });

  it('relata o orçamento atual da areia', () => {
    const stats = new SandTerrainSystem(new THREE.Scene()).getDebugStats();

    expect(stats.triangles).toBe(32768);
    expect(stats.deformationBytes).toBe(512 * 512 * 4);
  });

  it('rejeita a coleta sem uma instância de jogo em execução', async () => {
    await expect(collectSandSample({ game: null })).rejects.toThrow(
      'collectSandSample requires a running Game',
    );
  });
});
