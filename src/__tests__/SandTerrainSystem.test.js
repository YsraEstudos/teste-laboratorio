import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SandTerrainSystem } from '../world/SandTerrainSystem.js';

describe('SandTerrainSystem quality budget', () => {
  it('uses the high quality geometry budget without casting shadows', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'high' });
    expect(terrain.getDebugStats().triangles).toBe(8192);
    expect(terrain.mesh.castShadow).toBe(false);
    terrain.dispose();
  });

  it('releases PBR maps after the terrain is disposed', () => {
    const terrain = new SandTerrainSystem(new THREE.Scene(), { quality: 'medium' });
    const dispose = vi.spyOn(terrain.material.map, 'dispose');
    terrain.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
